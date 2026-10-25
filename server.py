import os
import sys
import json
import time
import sqlite3
import random
import threading
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

DB_PATH = os.path.join(os.path.dirname(__file__), "dados_1t.db")
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")

class SecaoComparada:
    def __init__(self, chave, uf, cod_mun, nm_mun, zona, secao,
                 lula_1t, flavio_1t, outros_1t,
                 lula_2t, flavio_2t, brancos_2t=0, nulos_2t=0):
        self.chave = chave
        self.uf = uf
        self.cod_mun = cod_mun
        self.nm_mun = nm_mun
        self.zona = zona
        self.secao = secao
        
        self.lula_1t = lula_1t
        self.flavio_1t = flavio_1t
        self.outros_1t = outros_1t
        
        self.lula_2t = lula_2t
        self.flavio_2t = flavio_2t
        self.brancos_2t = brancos_2t
        self.nulos_2t = nulos_2t
        
        self.delta_lula = lula_2t - lula_1t
        self.delta_flavio = flavio_2t - flavio_1t
        
        # Vencedores
        self.vencedor_1t = "Lula" if lula_1t > flavio_1t else ("Flávio" if flavio_1t > lula_1t else "Empate")
        self.vencedor_2t = "Lula" if lula_2t > flavio_2t else ("Flávio" if flavio_2t > lula_2t else "Empate")
        
        # Houve virada?
        if self.vencedor_1t != "Empate" and self.vencedor_2t != "Empate" and self.vencedor_1t != self.vencedor_2t:
            self.virada = f"{self.vencedor_1t} -> {self.vencedor_2t}"
            self.virou = True
        else:
            self.virada = f"Manteve {self.vencedor_2t}"
            self.virou = False

    def to_dict(self):
        return {
            "chave": self.chave,
            "uf": self.uf,
            "cod_mun": self.cod_mun,
            "nm_mun": self.nm_mun,
            "zona": self.zona,
            "secao": self.secao,
            "lula_1t": self.lula_1t,
            "flavio_1t": self.flavio_1t,
            "outros_1t": self.outros_1t,
            "lula_2t": self.lula_2t,
            "flavio_2t": self.flavio_2t,
            "brancos_2t": self.brancos_2t,
            "nulos_2t": self.nulos_2t,
            "delta_lula": self.delta_lula,
            "delta_flavio": self.delta_flavio,
            "vencedor_1t": self.vencedor_1t,
            "vencedor_2t": self.vencedor_2t,
            "virada": self.virada,
            "virou": self.virou
        }

class AppState:
    def __init__(self):
        self.lock = threading.RLock()
        self.mode = "sim"  # 'sim' ou 'tse'
        self.is_playing = True
        self.speed = 5  # multiplicador
        
        self.secoes_total_list = []
        self.secoes_map_1t = {}
        self.total_secoes = 0
        
        self.current_idx = 0
        self.lula_votos_2t = 0
        self.flavio_votos_2t = 0
        self.brancos_2t = 0
        self.nulos_2t = 0
        
        self.lula_votos_1t_mesmas = 0
        self.flavio_votos_1t_mesmas = 0
        self.outros_votos_1t_mesmas = 0
        
        # Histórico de seções comparadas (ordem cronológica inversa)
        self.secoes_apuradas_2t = {}  # chave -> SecaoComparada
        self.lista_secoes_recentes = []  # últimas 500 para a tabela
        
        self.ultimos_lotes = []
        self.taxa_secoes_seg = 0
        self.last_tick_time = time.time()
        
        self.taxa_outros_para_lula = 0.44
        self.taxa_outros_para_flavio = 0.48
        
        self.load_database()

    def load_database(self):
        print(f"Carregando seções do 1º Turno do banco {DB_PATH}...")
        if not os.path.exists(DB_PATH):
            print("Erro: dados_1t.db não encontrado.")
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT chave, uf, cod_municipio, nm_municipio, zona, secao,
                   votos_lula, votos_flavio, votos_outros, votos_branco, votos_nulo
            FROM secoes_1t
            ORDER BY 
                CASE 
                    WHEN uf = 'ZZ' THEN 1
                    WHEN uf IN ('DF', 'PR', 'SC', 'RS') THEN 2
                    WHEN uf IN ('SP', 'RJ', 'MG', 'ES') THEN 3
                    WHEN uf IN ('GO', 'MT', 'MS') THEN 4
                    WHEN uf IN ('BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI') THEN 5
                    ELSE 6
                END,
                cod_municipio, zona, secao
        """)
        rows = cursor.fetchall()
        conn.close()
        
        self.secoes_total_list = rows
        self.total_secoes = len(rows)
        for r in rows:
            chave = r[0]
            self.secoes_map_1t[chave] = r
            
        print(f"{self.total_secoes:,} seções carregadas com sucesso!")

    def reset_sim(self):
        with self.lock:
            self.current_idx = 0
            self.lula_votos_2t = 0
            self.flavio_votos_2t = 0
            self.brancos_2t = 0
            self.nulos_2t = 0
            self.lula_votos_1t_mesmas = 0
            self.flavio_votos_1t_mesmas = 0
            self.outros_votos_1t_mesmas = 0
            self.secoes_apuradas_2t = {}
            self.lista_secoes_recentes = []
            self.ultimos_lotes = []
            self.taxa_secoes_seg = 0
            print("Simulador reiniciado para 0 seções.")

    def tick_simulador(self):
        with self.lock:
            if not self.is_playing or self.mode != "sim":
                return
            if self.current_idx >= self.total_secoes:
                return

            now = time.time()
            dt = max(0.1, now - self.last_tick_time)
            self.last_tick_time = now

            tamanho_lote = int(100 * self.speed)
            fim_idx = min(self.total_secoes, self.current_idx + tamanho_lote)
            
            lote_secoes = self.secoes_total_list[self.current_idx:fim_idx]
            self.current_idx = fim_idx
            
            qtd_lote = len(lote_secoes)
            self.taxa_secoes_seg = int(qtd_lote / dt)

            lote_lula_2t = 0
            lote_flavio_2t = 0
            uf_lote = lote_secoes[0][1] if lote_secoes else "BR"

            for s in lote_secoes:
                chave, uf, cod_mun, nm_mun, zona, secao, v1_lula, v1_flavio, v1_outros, v1_br, v1_nu = s

                var_lula = random.uniform(0.98, 1.02)
                var_flavio = random.uniform(0.98, 1.02)
                
                mig_lula = int(v1_outros * self.taxa_outros_para_lula * random.uniform(0.95, 1.05))
                mig_flavio = int(v1_outros * self.taxa_outros_para_flavio * random.uniform(0.95, 1.05))
                
                v2_lula = max(0, int(v1_lula * var_lula) + mig_lula)
                v2_flavio = max(0, int(v1_flavio * var_flavio) + mig_flavio)
                v2_br = int(v1_br * random.uniform(0.9, 1.05))
                v2_nu = int(v1_nu * random.uniform(0.9, 1.05))

                self.lula_votos_2t += v2_lula
                self.flavio_votos_2t += v2_flavio
                self.brancos_2t += v2_br
                self.nulos_2t += v2_nu

                self.lula_votos_1t_mesmas += v1_lula
                self.flavio_votos_1t_mesmas += v1_flavio
                self.outros_votos_1t_mesmas += v1_outros

                lote_lula_2t += v2_lula
                lote_flavio_2t += v2_flavio

                # Salva o comparativo urna a urna
                obj = SecaoComparada(
                    chave, uf, cod_mun, nm_mun, zona, secao,
                    v1_lula, v1_flavio, v1_outros,
                    v2_lula, v2_flavio, v2_br, v2_nu
                )
                self.secoes_apuradas_2t[chave] = obj
                self.lista_secoes_recentes.append(obj)

            if len(self.lista_secoes_recentes) > 1000:
                self.lista_secoes_recentes = self.lista_secoes_recentes[-1000:]

            total_lote_validos = max(1, lote_lula_2t + lote_flavio_2t)
            self.ultimos_lotes.append({
                "uf": uf_lote,
                "secoes": qtd_lote,
                "hora": time.strftime("%H:%M:%S"),
                "lula_pct": (lote_lula_2t / total_lote_validos) * 100,
                "flavio_pct": (lote_flavio_2t / total_lote_validos) * 100
            })
            if len(self.ultimos_lotes) > 15:
                self.ultimos_lotes.pop(0)

    def consultar_secao(self, uf, zona, secao):
        with self.lock:
            uf = uf.upper().strip()
            zona = int(zona)
            secao = int(secao)
            
            # Buscar no banco 1T
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
                return None
                
            chave = row[0]
            v1_lula = row[6]
            v1_flavio = row[7]
            v1_outros = row[8]
            
            # Verificar se já temos 2T para esta seção
            if chave in self.secoes_apuradas_2t:
                comp = self.secoes_apuradas_2t[chave]
                return comp.to_dict()
            else:
                # Seção ainda não totalizada no 2T
                return {
                    "chave": chave,
                    "uf": row[1],
                    "cod_mun": row[2],
                    "nm_mun": row[3],
                    "zona": row[4],
                    "secao": row[5],
                    "lula_1t": v1_lula,
                    "flavio_1t": v1_flavio,
                    "outros_1t": v1_outros,
                    "lula_2t": None,
                    "flavio_2t": None,
                    "status_2t": "Aguardando apuração do 2º Turno para esta seção"
                }

    def get_secoes_comparadas(self, limit=50, filtro_uf=None, apenas_viradas=False):
        with self.lock:
            resultado = []
            # Itera do mais recente para o mais antigo
            for item in reversed(self.lista_secoes_recentes):
                if filtro_uf and item.uf != filtro_uf.upper():
                    continue
                if apenas_viradas and not item.virou:
                    continue
                resultado.append(item.to_dict())
                if len(resultado) >= limit:
                    break
            return resultado

    def get_status_payload(self):
        with self.lock:
            secoes_apuradas = self.current_idx
            total_secoes = max(1, self.total_secoes)
            pct_apurado = (secoes_apuradas / total_secoes) * 100

            validos_2t = self.lula_votos_2t + self.flavio_votos_2t
            lula_pct_2t = (self.lula_votos_2t / validos_2t * 100) if validos_2t > 0 else 0
            flavio_pct_2t = (self.flavio_votos_2t / validos_2t * 100) if validos_2t > 0 else 0

            validos_1t = self.lula_votos_1t_mesmas + self.flavio_votos_1t_mesmas
            lula_pct_1t = (self.lula_votos_1t_mesmas / validos_1t * 100) if validos_1t > 0 else 0
            flavio_pct_1t = (self.flavio_votos_1t_mesmas / validos_1t * 100) if validos_1t > 0 else 0

            delta_lula = self.lula_votos_2t - self.lula_votos_1t_mesmas
            delta_flavio = self.flavio_votos_2t - self.flavio_votos_1t_mesmas
            saldo_liquido = delta_lula - delta_flavio

            outros_total = max(1, self.outros_votos_1t_mesmas)
            absorcao_lula = (delta_lula / outros_total * 100) if outros_total > 0 else 0
            absorcao_flavio = (delta_flavio / outros_total * 100) if outros_total > 0 else 0

            projecao_final = None
            if pct_apurado >= 0.5:
                total_1t_lula = 53879538
                total_1t_flavio = 56104503
                total_1t_outros = 9301992
                
                proj_lula = total_1t_lula + (total_1t_outros * (absorcao_lula / 100))
                proj_flavio = total_1t_flavio + (total_1t_outros * (absorcao_flavio / 100))
                proj_total = proj_lula + proj_flavio
                if proj_total > 0:
                    projecao_final = {
                        "lula": (proj_lula / proj_total) * 100,
                        "flavio": (proj_flavio / proj_total) * 100
                    }

            return {
                "mode": self.mode,
                "is_playing": self.is_playing,
                "speed": self.speed,
                "total_secoes": self.total_secoes,
                "secoes_apuradas": secoes_apuradas,
                "pct_apurado": pct_apurado,
                "lula_votos_2t": self.lula_votos_2t,
                "flavio_votos_2t": self.flavio_votos_2t,
                "lula_pct_2t": lula_pct_2t,
                "flavio_pct_2t": flavio_pct_2t,
                "brancos_2t": self.brancos_2t,
                "nulos_2t": self.nulos_2t,
                "lula_votos_1t_mesmas": self.lula_votos_1t_mesmas,
                "flavio_votos_1t_mesmas": self.flavio_votos_1t_mesmas,
                "lula_pct_1t_mesmas": lula_pct_1t,
                "flavio_pct_1t_mesmas": flavio_pct_1t,
                "delta_lula": delta_lula,
                "delta_flavio": delta_flavio,
                "saldo_liquido": saldo_liquido,
                "absorcao_lula": absorcao_lula,
                "absorcao_flavio": absorcao_flavio,
                "projecao_final": projecao_final,
                "taxa_secoes_seg": self.taxa_secoes_seg,
                "ultimos_lotes": self.ultimos_lotes
            }

    def tick_tse(self):
        try:
            url = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4) as r:
                data = json.loads(r.read().decode())
            
            with self.lock:
                s = data.get("s", {})
                st = int(s.get("st", 0))
                self.current_idx = st
                
                v = data.get("v", {})
                self.brancos_2t = int(v.get("vb", 0))
                self.nulos_2t = int(v.get("tvn", 0))
                
                carg = data.get("carg", [{}])[0]
                for agr in carg.get("agr", []):
                    for par in agr.get("par", []):
                        for cand in par.get("cand", []):
                            n = cand.get("n")
                            vap = int(cand.get("vap", 0))
                            if n == "13":
                                self.lula_votos_2t = vap
                            elif n == "22":
                                self.flavio_votos_2t = vap
        except Exception:
            pass

state = AppState()

def simulation_loop():
    while True:
        try:
            if state.mode == "sim":
                state.tick_simulador()
            elif state.mode == "tse":
                state.tick_tse()
        except Exception as e:
            print("Erro no tick:", e)
        time.sleep(0.5)

sim_thread = threading.Thread(target=simulation_loop, daemon=True)
sim_thread.start()

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        if path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = state.get_status_payload()
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        elif path == "/api/secao":
            uf = query.get("uf", [""])[0]
            zona = query.get("zona", ["0"])[0]
            secao = query.get("secao", ["0"])[0]
            
            try:
                resultado = state.consultar_secao(uf, int(zona), int(secao))
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(resultado or {"error": "Seção não encontrada"}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode())
            return

        elif path == "/api/secoes_comparadas":
            limit = int(query.get("limit", [50])[0])
            uf = query.get("uf", [None])[0]
            viradas = query.get("apenas_viradas", ["false"])[0].lower() == "true"
            
            dados = state.get_secoes_comparadas(limit=limit, filtro_uf=uf, apenas_viradas=viradas)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(dados).encode("utf-8"))
            return

        elif path == "/api/tse_ao_vivo":
            # Endpoint que busca o totalizador atual do TSE e cruza os dados
            try:
                url = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    data = json.loads(r.read().decode())
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/control":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                action = data.get("action")
                
                with state.lock:
                    if action == "play":
                        state.is_playing = True
                    elif action == "pause":
                        state.is_playing = False
                    elif action == "reset":
                        state.reset_sim()
                    elif action == "set_speed":
                        state.speed = max(1, min(100, int(data.get("speed", 5))))
                    elif action == "set_mode":
                        state.mode = data.get("mode", "sim")
                        
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode())
            return
        
        self.send_response(404)
        self.end_headers()

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
    print("[+] SISTEMA DE COMPARACAO URNA A URNA (1T vs 2T) ATIVO")
    print(f"[+] Acesse no seu navegador: http://localhost:{port}")
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
