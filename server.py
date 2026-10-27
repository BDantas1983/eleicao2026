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

class ElectionDataService:
    def __init__(self):
        self.lock = threading.RLock()
        
        # Metadados do TSE
        self.ultima_atualizacao = "Base Oficial TSE Consolidada (100% Apurada)"
        self.data_tse = "25/10/2026"
        self.hora_tse = "23:27:02"
        
        # Totais 2º Turno Real
        self.secoes_totalizadas = 499206
        self.total_secoes = 499206
        self.pct_apurado = 100.0
        
        self.votos_lula_2t = 64256232
        self.votos_flavio_2t = 59826041
        self.pct_lula_2t = 51.79
        self.pct_flavio_2t = 48.21
        
        self.votos_validos_2t = 124082273
        self.votos_brancos_2t = 1430496
        self.votos_nulos_2t = 2723305
        self.total_apurado_2t = 128236074
        
        # Base 1º Turno
        self.total_1t_lula = 53879538
        self.total_1t_flavio = 56104503
        self.total_1t_validos = 119286033
        self.pct_lula_1t = 45.17
        self.pct_flavio_1t = 47.03
        
        # Estatísticas de Viradas
        self.viradas_flavio_lula = 31395
        self.viradas_lula_flavio = 565
        
        # Carrega dados do banco local SQLite
        self.carregar_totais_banco()

    def carregar_totais_banco(self):
        if not os.path.exists(DB_PATH):
            return
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("""
                SELECT 
                    COUNT(*),
                    SUM(votos_lula_1t), SUM(votos_flavio_1t), SUM(votos_validos_1t),
                    SUM(votos_lula_2t), SUM(votos_flavio_2t), SUM(votos_validos_2t),
                    SUM(votos_branco_2t), SUM(votos_nulo_2t), SUM(votos_total_2t),
                    SUM(CASE WHEN virada = 'Flávio -> Lula' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN virada = 'Lula -> Flávio' THEN 1 ELSE 0 END)
                FROM secoes_completo
            """)
            row = c.fetchone()
            if row and row[0]:
                with self.lock:
                    self.total_secoes = row[0]
                    self.secoes_totalizadas = row[0]
                    self.pct_apurado = 100.0
                    
                    self.total_1t_lula = row[1] or 0
                    self.total_1t_flavio = row[2] or 0
                    self.total_1t_validos = row[3] or 1
                    self.pct_lula_1t = round((self.total_1t_lula / self.total_1t_validos) * 100, 2)
                    self.pct_flavio_1t = round((self.total_1t_flavio / self.total_1t_validos) * 100, 2)
                    
                    self.votos_lula_2t = row[4] or 0
                    self.votos_flavio_2t = row[5] or 0
                    self.votos_validos_2t = row[6] or 1
                    self.pct_lula_2t = round((self.votos_lula_2t / self.votos_validos_2t) * 100, 2)
                    self.pct_flavio_2t = round((self.votos_flavio_2t / self.votos_validos_2t) * 100, 2)
                    
                    self.votos_brancos_2t = row[7] or 0
                    self.votos_nulos_2t = row[8] or 0
                    self.total_apurado_2t = row[9] or 0
                    
                    self.viradas_flavio_lula = row[10] or 0
                    self.viradas_lula_flavio = row[11] or 0
            conn.close()
            print(f"[DB CARREGADO] Seções: {self.total_secoes:,} | Lula 2T: {self.votos_lula_2t:,} ({self.pct_lula_2t:.2f}%) | Flávio 2T: {self.votos_flavio_2t:,} ({self.pct_flavio_2t:.2f}%) | Viradas F->L: {self.viradas_flavio_lula:,}")
        except Exception as e:
            print("[!] Aviso ao ler totais do SQLite:", e)

    def consultar_secao_real(self, uf, zona, secao):
        """Consulta os dados completos da seção (1T e 2T lado a lado com Bairro) no banco."""
        uf = uf.upper().strip()
        zona = int(zona)
        secao = int(secao)
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            SELECT chave, uf, cod_municipio, nm_municipio, zona, secao, nm_local, ds_endereco, nm_bairro, nr_cep,
                   votos_lula_1t, votos_flavio_1t, votos_outros_1t, votos_branco_1t, votos_nulo_1t,
                   votos_validos_1t, votos_total_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t,
                   votos_lula_2t, votos_flavio_2t, votos_branco_2t, votos_nulo_2t,
                   votos_validos_2t, votos_total_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t,
                   delta_lula, delta_flavio, swing_lula, virada
            FROM secoes_completo
            WHERE uf = ? AND zona = ? AND secao = ?
        """, (uf, zona, secao))
        row = c.fetchone()
        conn.close()

        if not row:
            return {"error": f"Seção {secao} (Zona {zona} - {uf}) não encontrada na base consolidada."}

        return {
            "chave": row[0],
            "uf": row[1],
            "cod_mun": row[2],
            "nm_mun": row[3],
            "zona": row[4],
            "secao": row[5],
            "local": row[6],
            "endereco": row[7],
            "bairro": row[8],
            "cep": row[9],
            
            # 1º Turno
            "lula_1t": row[10],
            "flavio_1t": row[11],
            "outros_1t": row[12],
            "brancos_1t": row[13],
            "nulos_1t": row[14],
            "validos_1t": row[15],
            "total_1t": row[16],
            "pct1_lula": row[17],
            "pct1_flavio": row[18],
            "vencedor_1t": row[19],
            
            # 2º Turno
            "lula_2t": row[20],
            "flavio_2t": row[21],
            "brancos_2t": row[22],
            "nulos_2t": row[23],
            "validos_2t": row[24],
            "total_2t": row[25],
            "pct2_lula": row[26],
            "pct2_flavio": row[27],
            "vencedor_2t": row[28],
            
            # Comparativo
            "delta_lula": row[29],
            "delta_flavio": row[30],
            "swing_lula": row[31],
            "virada": row[32],
            "status_2t": "Apuração Oficial Consolidada 100%"
        }

    def get_payload(self):
        with self.lock:
            delta_lula = self.votos_lula_2t - self.total_1t_lula
            delta_flavio = self.votos_flavio_2t - self.total_1t_flavio
            
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
                "lula_votos_1t_mesmas": self.total_1t_lula,
                "flavio_votos_1t_mesmas": self.total_1t_flavio,
                "lula_pct_1t_mesmas": self.pct_lula_1t,
                "flavio_pct_1t_mesmas": self.pct_flavio_1t,
                "delta_lula": delta_lula,
                "delta_flavio": delta_flavio,
                "brancos_2t": self.votos_brancos_2t,
                "nulos_2t": self.votos_nulos_2t,
                "votos_validos_2t": self.votos_validos_2t,
                "total_votos_2t": self.total_apurado_2t,
                "viradas_flavio_lula": self.viradas_flavio_lula,
                "viradas_lula_flavio": self.viradas_lula_flavio
            }

app_state = ElectionDataService()

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

        elif path == "/api/secoes":
            uf = query.get("uf", [""])[0].upper().strip()
            virada = query.get("virada", [""])[0]
            limit = min(int(query.get("limit", ["50"])[0]), 200)

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            sql = """
                SELECT uf, nm_municipio, zona, secao, 
                       votos_lula_1t, votos_flavio_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t,
                       votos_lula_2t, votos_flavio_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t,
                       virada, delta_lula, delta_flavio, swing_lula, nm_local, nm_bairro
                FROM secoes_completo
                WHERE 1=1
            """
            params = []
            if uf:
                sql += " AND uf = ?"
                params.append(uf)
            if virada == "true" or virada == "viradas":
                sql += " AND virada != 'Não'"
            elif virada == "flavio_lula":
                sql += " AND virada = 'Flávio -> Lula'"
            elif virada == "lula_flavio":
                sql += " AND virada = 'Lula -> Flávio'"

            sql += " ORDER BY ABS(delta_lula) DESC LIMIT ?"
            params.append(limit)

            c.execute(sql, params)
            rows = []
            for r in c.fetchall():
                rows.append({
                    "uf": r[0],
                    "nm_mun": r[1],
                    "zona": r[2],
                    "secao": r[3],
                    "lula_1t": r[4],
                    "flavio_1t": r[5],
                    "pct1_lula": r[6],
                    "pct1_flavio": r[7],
                    "vencedor_1t": r[8],
                    "lula_2t": r[9],
                    "flavio_2t": r[10],
                    "pct2_lula": r[11],
                    "pct2_flavio": r[12],
                    "vencedor_2t": r[13],
                    "virada": r[14],
                    "delta_lula": r[15],
                    "delta_flavio": r[16],
                    "swing_lula": r[17],
                    "local": r[18],
                    "bairro": r[19]
                })
            conn.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(rows).encode("utf-8"))
            return

        elif path == "/api/municipios":
            uf = query.get("uf", ["SP"])[0].upper().strip()
            q = query.get("q", [""])[0].upper().strip()
            virada = query.get("virada", [""])[0]
            limit = min(int(query.get("limit", ["100"])[0]), 500)

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            sql = """
                SELECT uf, cod_municipio, nm_municipio, total_secoes,
                       lula_1t, flavio_1t, validos_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t,
                       lula_2t, flavio_2t, validos_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t,
                       delta_lula, delta_flavio, swing_lula, virada_municipio,
                       viradas_secoes_lula, viradas_secoes_flavio
                FROM resumo_municipios
                WHERE 1=1
            """
            params = []
            if uf:
                sql += " AND uf = ?"
                params.append(uf)
            if q:
                sql += " AND nm_municipio LIKE ?"
                params.append(f"%{q}%")
            if virada == "viradas":
                sql += " AND virada_municipio != 'Não'"
            elif virada == "flavio_lula":
                sql += " AND virada_municipio = 'Flávio -> Lula'"
            elif virada == "lula_flavio":
                sql += " AND virada_municipio = 'Lula -> Flávio'"

            sql += " ORDER BY total_secoes DESC LIMIT ?"
            params.append(limit)

            c.execute(sql, params)
            rows = []
            for r in c.fetchall():
                rows.append({
                    "uf": r[0],
                    "cod_mun": r[1],
                    "nm_mun": r[2],
                    "total_secoes": r[3],
                    "lula_1t": r[4],
                    "flavio_1t": r[5],
                    "validos_1t": r[6],
                    "pct_lula_1t": r[7],
                    "pct_flavio_1t": r[8],
                    "vencedor_1t": r[9],
                    "lula_2t": r[10],
                    "flavio_2t": r[11],
                    "validos_2t": r[12],
                    "pct_lula_2t": r[13],
                    "pct_flavio_2t": r[14],
                    "vencedor_2t": r[15],
                    "delta_lula": r[16],
                    "delta_flavio": r[17],
                    "swing_lula": r[18],
                    "virada": r[19],
                    "viradas_secoes_lula": r[20],
                    "viradas_secoes_flavio": r[21]
                })
            conn.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(rows).encode("utf-8"))
            return

        elif path == "/api/municipio":
            uf = query.get("uf", ["SP"])[0].upper().strip()
            cod_mun = query.get("cod_mun", [""])[0]
            nome = query.get("nome", [""])[0].upper().strip()

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            
            sql_m = """
                SELECT uf, cod_municipio, nm_municipio, total_secoes,
                       lula_1t, flavio_1t, validos_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t,
                       lula_2t, flavio_2t, validos_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t,
                       delta_lula, delta_flavio, swing_lula, virada_municipio,
                       viradas_secoes_lula, viradas_secoes_flavio
                FROM resumo_municipios
                WHERE uf = ?
            """
            params_m = [uf]
            if cod_mun:
                sql_m += " AND cod_municipio = ?"
                params_m.append(int(cod_mun))
            elif nome:
                sql_m += " AND nm_municipio = ?"
                params_m.append(nome)
            else:
                sql_m += " ORDER BY total_secoes DESC LIMIT 1"

            c.execute(sql_m, params_m)
            r = c.fetchone()
            if not r:
                conn.close()
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Municipio nao encontrado"}')
                return

            mun_data = {
                "uf": r[0], "cod_mun": r[1], "nm_mun": r[2], "total_secoes": r[3],
                "lula_1t": r[4], "flavio_1t": r[5], "validos_1t": r[6], "pct_lula_1t": r[7], "pct_flavio_1t": r[8], "vencedor_1t": r[9],
                "lula_2t": r[10], "flavio_2t": r[11], "validos_2t": r[12], "pct_lula_2t": r[13], "pct_flavio_2t": r[14], "vencedor_2t": r[15],
                "delta_lula": r[16], "delta_flavio": r[17], "swing_lula": r[18], "virada": r[19],
                "viradas_secoes_lula": r[20], "viradas_secoes_flavio": r[21]
            }

            # Bairros desse município
            c.execute("""
                SELECT nm_bairro, total_secoes, lula_1t, flavio_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t,
                       lula_2t, flavio_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t, delta_lula, delta_flavio, swing_lula, virada_bairro, viradas_secoes_lula
                FROM resumo_bairros
                WHERE uf = ? AND cod_municipio = ?
                ORDER BY total_secoes DESC LIMIT 150
            """, (r[0], r[1]))
            bairros = []
            for b in c.fetchall():
                bairros.append({
                    "bairro": b[0], "total_secoes": b[1],
                    "lula_1t": b[2], "flavio_1t": b[3], "pct_lula_1t": b[4], "pct_flavio_1t": b[5], "vencedor_1t": b[6],
                    "lula_2t": b[7], "flavio_2t": b[8], "pct_lula_2t": b[9], "pct_flavio_2t": b[10], "vencedor_2t": b[11],
                    "delta_lula": b[12], "delta_flavio": b[13], "swing_lula": b[14], "virada": b[15], "viradas_lula": b[16]
                })

            # Top Escolas/Locais de Votação
            c.execute("""
                SELECT nm_local, nm_bairro, ds_endereco, COUNT(*) as secoes,
                       SUM(votos_lula_1t), SUM(votos_flavio_1t),
                       SUM(votos_lula_2t), SUM(votos_flavio_2t),
                       SUM(CASE WHEN virada != 'Não' THEN 1 ELSE 0 END) as viradas
                FROM secoes_completo
                WHERE uf = ? AND cod_municipio = ? AND nm_local != ''
                GROUP BY nm_local, nm_bairro
                ORDER BY secoes DESC LIMIT 60
            """, (r[0], r[1]))
            locais = []
            for loc in c.fetchall():
                val2 = loc[6] + loc[7]
                p2_l = round(loc[6]/val2*100, 2) if val2 > 0 else 0
                p2_f = round(loc[7]/val2*100, 2) if val2 > 0 else 0
                venc = "Lula" if loc[6] > loc[7] else ("Flávio" if loc[7] > loc[6] else "Empate")
                locais.append({
                    "local": loc[0], "bairro": loc[1], "endereco": loc[2], "secoes": loc[3],
                    "lula_1t": loc[4], "flavio_1t": loc[5],
                    "lula_2t": loc[6], "flavio_2t": loc[7],
                    "pct_lula_2t": p2_l, "pct_flavio_2t": p2_f,
                    "vencedor_2t": venc,
                    "viradas": loc[8]
                })

            conn.close()
            resp_payload = {
                "municipio": mun_data,
                "bairros": bairros,
                "locais": locais
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(resp_payload).encode("utf-8"))
            return

        elif path == "/api/bairros":
            uf = query.get("uf", ["SP"])[0].upper().strip()
            cod_mun = query.get("cod_mun", [""])[0]
            nome_mun = query.get("municipio", [""])[0].upper().strip()
            sort = query.get("sort", ["secoes"])[0]
            limit = min(int(query.get("limit", ["100"])[0]), 300)

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            sql = "SELECT uf, cod_municipio, nm_municipio, nm_bairro, total_secoes, lula_1t, flavio_1t, pct_lula_1t, pct_flavio_1t, vencedor_1t, lula_2t, flavio_2t, pct_lula_2t, pct_flavio_2t, vencedor_2t, delta_lula, delta_flavio, swing_lula, virada_bairro, viradas_secoes_lula FROM resumo_bairros WHERE uf = ?"
            params = [uf]
            if cod_mun:
                sql += " AND cod_municipio = ?"
                params.append(int(cod_mun))
            elif nome_mun:
                sql += " AND nm_municipio = ?"
                params.append(nome_mun)

            if sort == "lula":
                sql += " ORDER BY pct_lula_2t DESC"
            elif sort == "flavio":
                sql += " ORDER BY pct_flavio_2t DESC"
            elif sort == "swing":
                sql += " ORDER BY ABS(swing_lula) DESC"
            elif sort == "viradas":
                sql += " ORDER BY viradas_secoes_lula DESC"
            else:
                sql += " ORDER BY total_secoes DESC"

            sql += " LIMIT ?"
            params.append(limit)

            c.execute(sql, params)
            rows = []
            for b in c.fetchall():
                rows.append({
                    "uf": b[0], "cod_mun": b[1], "nm_mun": b[2], "bairro": b[3], "total_secoes": b[4],
                    "lula_1t": b[5], "flavio_1t": b[6], "pct_lula_1t": b[7], "pct_flavio_1t": b[8], "vencedor_1t": b[9],
                    "lula_2t": b[10], "flavio_2t": b[11], "pct_lula_2t": b[12], "pct_flavio_2t": b[13], "vencedor_2t": b[14],
                    "delta_lula": b[15], "delta_flavio": b[16], "swing_lula": b[17], "virada": b[18], "viradas_lula": b[19]
                })
            conn.close()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(rows).encode("utf-8"))
            return

        elif path == "/api/resumo_ufs":
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("""
                SELECT uf, total_secoes, lula_1t, flavio_1t, validos_1t,
                       lula_2t, flavio_2t, validos_2t, viradas_para_lula, viradas_para_flavio
                FROM resumo_uf ORDER BY total_secoes DESC
            """)
            items = []
            for r in c.fetchall():
                items.append({
                    "uf": r[0],
                    "total_secoes": r[1],
                    "lula_1t": r[2],
                    "flavio_1t": r[3],
                    "pct_lula_1t": round(r[2]/r[4]*100, 2) if r[4] > 0 else 0,
                    "pct_flavio_1t": round(r[3]/r[4]*100, 2) if r[4] > 0 else 0,
                    "lula_2t": r[5],
                    "flavio_2t": r[6],
                    "pct_lula_2t": round(r[5]/r[7]*100, 2) if r[7] > 0 else 0,
                    "pct_flavio_2t": round(r[6]/r[7]*100, 2) if r[7] > 0 else 0,
                    "viradas_para_lula": r[8],
                    "viradas_para_flavio": r[9]
                })
            conn.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(items).encode("utf-8"))
            return

        elif path == "/api/forcar_atualizacao":
            app_state.carregar_totais_banco()
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
    print("🇧🇷 COMPARADOR ELEITORAL OFICIAL (DADOS 100% CONSOLIDADOS)")
    print("🏙️ DASHBOARD DE CIDADES, BAIRROS E SEÇÕES ELEITORAIS ATIVO")
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
