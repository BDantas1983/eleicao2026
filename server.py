import os
import sys
import json
import time
import sqlite3
import threading
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

DB_PATH = os.path.join(os.path.dirname(__file__), "dados_1t.db")
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")

# URLs Oficiais da CDN do TSE para o 2º Turno Presidencial 2026
TSE_BR_URL = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json"
TSE_BU_BASE = "https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3221"

class RealTimeDataTSE:
    def __init__(self):
        self.lock = threading.RLock()
        
        # Metadados do TSE
        self.ultima_atualizacao = "Aguardando conexão com TSE..."
        self.data_tse = ""
        self.hora_tse = ""
        
        # Apuração 2º Turno Real
        self.secoes_totalizadas = 0
        self.total_secoes = 499248
        self.pct_apurado = 0.0
        
        self.votos_lula_2t = 0
        self.votos_flavio_2t = 0
        self.pct_lula_2t = 0.0
        self.pct_flavio_2t = 0.0
        
        self.votos_validos_2t = 0
        self.votos_brancos_2t = 0
        self.votos_nulos_2t = 0
        self.total_apurado_2t = 0
        
        # Base 1º Turno (para cálculo comparativo)
        # Total nacional do 1º Turno
        self.total_1t_lula = 53879538
        self.total_1t_flavio = 56104503
        self.total_1t_validos = 119286033
        
        # Proporcional às seções apuradas no 2T
        self.votos_lula_1t_prop = 0
        self.votos_flavio_1t_prop = 0
        self.pct_lula_1t = 45.17
        self.pct_flavio_1t = 47.03
        
        # Histórico de urnas/seções apuradas
        self.cache_secoes_2t = {}
        
        # Faz a primeira leitura imediata
        self.atualizar_dados_tse()

    def atualizar_dados_tse(self):
        """Consulta diretamente a CDN do TSE para pegar os dados reais oficiais."""
        try:
            req = urllib.request.Request(TSE_BR_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode("utf-8")
                data = json.loads(raw)

            with self.lock:
                self.data_tse = data.get("dg", "")
                self.hora_tse = data.get("hg", "")
                self.ultima_atualizacao = f"{self.data_tse} {self.hora_tse}"
                
                # Seções apuradas
                s = data.get("s", {})
                self.secoes_totalizadas = int(s.get("st", 0))
                self.total_secoes = int(s.get("ts", 499248))
                
                pst_str = s.get("pst", "0").replace(",", ".")
                try:
                    self.pct_apurado = float(pst_str)
                except ValueError:
                    self.pct_apurado = (self.secoes_totalizadas / self.total_secoes * 100) if self.total_secoes > 0 else 0.0

                # Votos
                v = data.get("v", {})
                self.total_apurado_2t = int(v.get("tv", 0))
                self.votos_validos_2t = int(v.get("vvc", 0))
                self.votos_brancos_2t = int(v.get("vb", 0))
                self.votos_nulos_2t = int(v.get("tvn", 0))

                # Candidatos
                carg = data.get("carg", [{}])[0]
                for agr in carg.get("agr", []):
                    for par in agr.get("par", []):
                        for cand in par.get("cand", []):
                            numero = cand.get("n")
                            votos = int(cand.get("vap", 0))
                            pct = float(cand.get("pvap", "0").replace(",", "."))
                            
                            if numero == "13":
                                self.votos_lula_2t = votos
                                self.pct_lula_2t = pct
                            elif numero == "22":
                                self.votos_flavio_2t = votos
                                self.pct_flavio_2t = pct

                # Comparativo com o 1T para o mesmo universo de seções
                fracao_apurada = self.pct_apurado / 100.0 if self.pct_apurado > 0 else 0
                self.votos_lula_1t_prop = int(self.total_1t_lula * fracao_apurada)
                self.votos_flavio_1t_prop = int(self.total_1t_flavio * fracao_apurada)
                
            print(f"[TSE REAL {self.hora_tse}] Apurado: {self.pct_apurado:.2f}% ({self.secoes_totalizadas:,} secoes) | Lula: {self.votos_lula_2t:,} ({self.pct_lula_2t:.2f}%) | Flavio: {self.votos_flavio_2t:,} ({self.pct_flavio_2t:.2f}%)")
        except Exception as e:
            print("[!] Falha ao consultar TSE:", e)

    def consultar_secao_real(self, uf, zona, secao):
        """Busca os dados do 1T no banco local e os dados do 2T no TSE."""
        uf = uf.upper().strip()
        zona = int(zona)
        secao = int(secao)
        
        # 1. Pega do 1º Turno (base consolidada de 1GB)
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            SELECT chave, uf, cod_municipio, nm_municipio, zona, secao,
                   votos_lula, votos_flavio, votos_outros, votos_branco, votos_nulo
            FROM secoes_1t
            WHERE uf = ? AND zona = ? AND secao = ?
        """, (uf, zona, secao))
        row = c.fetchone()
        conn.close()

        if not row:
            return {"error": f"Seção {secao} (Zona {zona} - {uf}) não encontrada na base de dados do 1º Turno."}

        chave, uf_res, cod_mun, nm_mun, z_res, s_res, v1_lula, v1_flavio, v1_outros, v1_br, v1_nu = row

        v1_validos = v1_lula + v1_flavio + v1_outros
        pct1_lula = (v1_lula / v1_validos * 100) if v1_validos > 0 else 0
        pct1_flavio = (v1_flavio / v1_validos * 100) if v1_validos > 0 else 0
        vencedor_1t = "Lula" if v1_lula > v1_flavio else ("Flávio" if v1_flavio > v1_lula else "Empate")

        # 2. Tenta puxar o Boletim de Urna (BU) oficial do 2º Turno se já transmitido pelo TSE
        v2_lula = None
        v2_flavio = None
        status_2t = "Aguardando envio do Boletim de Urna pelo Cartório Eleitoral ao TSE"

        # Formato de busca na CDN do TSE:
        # aux URL: /arquivo-urna/3221/dados/<uf>/<mun>/<zona>/<secao>/p0003221-<uf>-m<mun>-z<zona>-s<secao>-aux.json
        mun_str = f"{cod_mun:05d}"
        zona_str = f"{zona:04d}"
        secao_str = f"{secao:04d}"
        uf_lower = uf.lower()
        
        url_aux = f"{TSE_BU_BASE}/dados/{uf_lower}/{mun_str}/{zona_str}/{secao_str}/p0003221-{uf_lower}-m{mun_str}-z{zona_str}-s{secao_str}-aux.json"
        
        try:
            req = urllib.request.Request(url_aux, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data_aux = json.loads(resp.read().decode())
                if "hashes" in data_aux and len(data_aux["hashes"]) > 0:
                    status_2t = "Boletim de Urna transmitido e recebido pelo TSE"
        except Exception:
            pass

        return {
            "chave": chave,
            "uf": uf_res,
            "cod_mun": cod_mun,
            "nm_mun": nm_mun,
            "zona": z_res,
            "secao": s_res,
            "lula_1t": v1_lula,
            "flavio_1t": v1_flavio,
            "outros_1t": v1_outros,
            "pct1_lula": pct1_lula,
            "pct1_flavio": pct1_flavio,
            "vencedor_1t": vencedor_1t,
            "lula_2t": v2_lula,
            "flavio_2t": v2_flavio,
            "status_2t": status_2t
        }

    def get_payload(self):
        with self.lock:
            # Deltas
            delta_lula = self.votos_lula_2t - self.votos_lula_1t_prop
            delta_flavio = self.votos_flavio_2t - self.votos_flavio_1t_prop
            
            return {
                "ultima_atualizacao": self.ultima_atualizacao,
                "data_tse": self.data_tse,
                "hora_tse": self.hora_tse,
                "total_secoes": self.total_secoes,
                "secoes_apuradas": self.secoes_totalizadas,
                "pct_apurado": self.pct_apurado,
                "lula_votos_2t": self.votos_lula_2t,
                "flavio_votos_2t": self.votos_flavio_2t,
                "lula_pct_2t": self.pct_lula_2t,
                "flavio_pct_2t": self.pct_flavio_2t,
                "lula_votos_1t_mesmas": self.votos_lula_1t_prop,
                "flavio_votos_1t_mesmas": self.votos_flavio_1t_prop,
                "lula_pct_1t_mesmas": self.pct_lula_1t,
                "flavio_pct_1t_mesmas": self.pct_flavio_1t,
                "delta_lula": delta_lula,
                "delta_flavio": delta_flavio,
                "brancos_2t": self.votos_brancos_2t,
                "nulos_2t": self.votos_nulos_2t,
                "votos_validos_2t": self.votos_validos_2t,
                "total_votos_2t": self.total_apurado_2t
            }

app_state = RealTimeDataTSE()

# Thread que consulta o TSE a cada 10 segundos
def tse_polling_loop():
    while True:
        try:
            app_state.atualizar_dados_tse()
        except Exception as e:
            print("Erro no polling do TSE:", e)
        time.sleep(10)

poll_thread = threading.Thread(target=tse_polling_loop, daemon=True)
poll_thread.start()

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(app_state.get_payload()).encode("utf-8"))
            return

        elif path == "/api/secao":
            uf = query.get("uf", [""])[0]
            zona = query.get("zona", ["0"])[0]
            secao = query.get("secao", ["0"])[0]
            
            try:
                res = app_state.consultar_secao_real(uf, int(zona), int(secao))
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(res).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode())
            return

        elif path == "/api/forcar_atualizacao":
            app_state.atualizar_dados_tse()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            return

        return super().do_GET()

def run_server(port=8000):
    httpd = None
    for p in range(port, port + 10):
        try:
            server_address = ("", p)
            ThreadingHTTPServer.allow_reuse_address = True
            httpd = ThreadingHTTPServer(server_address, CustomHandler)
            port = p
            break
        except OSError:
            continue

    if not httpd:
        print("[!] Erro: Nao foi possivel iniciar servidor nas portas 8000-8010.")
        return

    print("\n" + "="*60)
    print("🇧🇷 MONITOR OFICIAL DO TSE (DADOS REAIS EM TEMPO REAL)")
    print(f"📊 Acesse no seu navegador: http://localhost:{port}")
    print("="*60 + "\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado pelo usuário.")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
