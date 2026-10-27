import os
import sys
import time
import csv
import sqlite3

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

CSV_PATH = os.path.join(os.path.dirname(__file__), "votacao_secao_2026_BR", "votacao_secao_2026_BR.csv")
DB_PATH = os.path.join(os.path.dirname(__file__), "dados_1t.db")
DB_BACKUP_PATH = os.path.join(os.path.dirname(__file__), "dados_eleicao.db")

def indexar_eleicao_completa():
    start_time = time.time()
    print("==================================================")
    print("[*] INDEXADOR CONSOLIDADO DA ELEICAO 2026 (1T & 2T)")
    print("==================================================")
    print(f"Lendo base consolidada oficial: {CSV_PATH}")

    if not os.path.exists(CSV_PATH):
        print(f"ERRO: Arquivo {CSV_PATH} não encontrado!")
        sys.exit(1)

    # Dicionário de seções:
    # chave -> [0:uf, 1:cod_mun, 2:nm_mun, 3:zona, 4:secao, 5:local, 6:endereco,
    #           7:l1, 8:f1, 9:o1, 10:b1, 11:n1,
    #           12:l2, 13:f2, 14:b2, 15:n2]
    secoes = {}

    total_linhas = 0
    linhas_presidente = 0
    
    with open(CSV_PATH, "r", encoding="latin1") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        
        for row in reader:
            total_linhas += 1
            if total_linhas % 1000000 == 0:
                print(f"Linhas processadas: {total_linhas:,} (Seções únicas até agora: {len(secoes):,})...", flush=True)

            # Filtra apenas Presidente (coluna 18: DS_CARGO)
            if len(row) <= 21 or row[18] != "Presidente":
                continue

            linhas_presidente += 1
            turno = row[5]      # 1 ou 2
            uf = row[10]
            try:
                cod_mun = int(row[13])
                zona = int(row[15])
                secao = int(row[16])
                qtd_votos = int(row[21])
            except ValueError:
                continue

            nm_mun = row[14]
            nr_votavel = row[19]
            nm_local = row[24] if len(row) > 24 else ""
            ds_endereco = row[25] if len(row) > 25 else ""

            chave = f"{uf}_{cod_mun}_{zona}_{secao}"

            if chave not in secoes:
                secoes[chave] = [
                    uf, cod_mun, nm_mun, zona, secao, nm_local, ds_endereco,
                    0, 0, 0, 0, 0, # 1T: l1, f1, o1, b1, n1
                    0, 0, 0, 0     # 2T: l2, f2, b2, n2
                ]

            sec = secoes[chave]
            # Atualiza endereço/local caso não preenchido
            if not sec[5] and nm_local:
                sec[5] = nm_local
            if not sec[6] and ds_endereco:
                sec[6] = ds_endereco

            if turno == "1":
                if nr_votavel == "13":
                    sec[7] += qtd_votos
                elif nr_votavel == "22":
                    sec[8] += qtd_votos
                elif nr_votavel == "95":
                    sec[10] += qtd_votos
                elif nr_votavel == "96":
                    sec[11] += qtd_votos
                else:
                    sec[9] += qtd_votos
            elif turno == "2":
                if nr_votavel == "13":
                    sec[12] += qtd_votos
                elif nr_votavel == "22":
                    sec[13] += qtd_votos
                elif nr_votavel == "95":
                    sec[14] += qtd_votos
                elif nr_votavel == "96":
                    sec[15] += qtd_votos

    print(f"\nLeitura do CSV concluída!")
    print(f"Total de linhas lidas: {total_linhas:,}")
    print(f"Linhas de Presidente: {linhas_presidente:,}")
    print(f"Total de Seções Eleitorais únicas: {len(secoes):,}")

    # Remove bancos existentes temporariamente para reconstrução limpa
    for p in [DB_PATH, DB_BACKUP_PATH]:
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Otimizações de escrita no SQLite
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = MEMORY")
    cursor.execute("PRAGMA cache_size = 100000")

    print("\nCriando tabelas e índices...")
    cursor.execute("""
        CREATE TABLE secoes_completo (
            chave TEXT PRIMARY KEY,
            uf TEXT,
            cod_municipio INTEGER,
            nm_municipio TEXT,
            zona INTEGER,
            secao INTEGER,
            nm_local TEXT,
            ds_endereco TEXT,
            
            -- 1º Turno
            votos_lula_1t INTEGER DEFAULT 0,
            votos_flavio_1t INTEGER DEFAULT 0,
            votos_outros_1t INTEGER DEFAULT 0,
            votos_branco_1t INTEGER DEFAULT 0,
            votos_nulo_1t INTEGER DEFAULT 0,
            votos_validos_1t INTEGER DEFAULT 0,
            votos_total_1t INTEGER DEFAULT 0,
            pct_lula_1t REAL DEFAULT 0.0,
            pct_flavio_1t REAL DEFAULT 0.0,
            vencedor_1t TEXT,
            
            -- 2º Turno
            votos_lula_2t INTEGER DEFAULT 0,
            votos_flavio_2t INTEGER DEFAULT 0,
            votos_branco_2t INTEGER DEFAULT 0,
            votos_nulo_2t INTEGER DEFAULT 0,
            votos_validos_2t INTEGER DEFAULT 0,
            votos_total_2t INTEGER DEFAULT 0,
            pct_lula_2t REAL DEFAULT 0.0,
            pct_flavio_2t REAL DEFAULT 0.0,
            vencedor_2t TEXT,
            
            -- Comparativo / Análise
            delta_lula INTEGER DEFAULT 0,
            delta_flavio INTEGER DEFAULT 0,
            swing_lula REAL DEFAULT 0.0,
            virada TEXT DEFAULT 'Não'
        )
    """)

    # Tabela 1T para compatibilidade legada imediata
    cursor.execute("""
        CREATE TABLE secoes_1t (
            chave TEXT PRIMARY KEY,
            uf TEXT,
            cod_municipio INTEGER,
            nm_municipio TEXT,
            zona INTEGER,
            secao INTEGER,
            votos_lula INTEGER DEFAULT 0,
            votos_flavio INTEGER DEFAULT 0,
            votos_outros INTEGER DEFAULT 0,
            votos_branco INTEGER DEFAULT 0,
            votos_nulo INTEGER DEFAULT 0,
            votos_validos INTEGER DEFAULT 0,
            votos_total INTEGER DEFAULT 0
        )
    """)

    print("Processando cálculos eleitorais (deltas, swings, viradas)...")
    registros_completo = []
    registros_1t = []

    total_viradas_lula = 0
    total_viradas_flavio = 0

    for chave, s in secoes.items():
        uf, cod_mun, nm_mun, zona, secao, local, endereco, l1, f1, o1, b1, n1, l2, f2, b2, n2 = s
        
        # 1º Turno
        val1 = l1 + f1 + o1
        tot1 = val1 + b1 + n1
        p1_lula = round((l1 / val1 * 100), 2) if val1 > 0 else 0.0
        p1_flavio = round((f1 / val1 * 100), 2) if val1 > 0 else 0.0
        venc1 = "Lula" if l1 > f1 else ("Flávio" if f1 > l1 else "Empate")

        # 2º Turno
        val2 = l2 + f2
        tot2 = val2 + b2 + n2
        p2_lula = round((l2 / val2 * 100), 2) if val2 > 0 else 0.0
        p2_flavio = round((f2 / val2 * 100), 2) if val2 > 0 else 0.0
        venc2 = "Lula" if l2 > f2 else ("Flávio" if f2 > l2 else "Empate")

        # Deltas
        d_lula = l2 - l1
        d_flavio = f2 - f1
        swing_lula = round(p2_lula - p1_lula, 2)

        # Virada
        if venc1 == "Flávio" and venc2 == "Lula":
            virada = "Flávio -> Lula"
            total_viradas_lula += 1
        elif venc1 == "Lula" and venc2 == "Flávio":
            virada = "Lula -> Flávio"
            total_viradas_flavio += 1
        else:
            virada = "Não"

        registros_completo.append((
            chave, uf, cod_mun, nm_mun, zona, secao, local, endereco,
            l1, f1, o1, b1, n1, val1, tot1, p1_lula, p1_flavio, venc1,
            l2, f2, b2, n2, val2, tot2, p2_lula, p2_flavio, venc2,
            d_lula, d_flavio, swing_lula, virada
        ))

        registros_1t.append((
            chave, uf, cod_mun, nm_mun, zona, secao,
            l1, f1, o1, b1, n1, val1, tot1
        ))

    print(f"Gravando {len(registros_completo):,} seções no SQLite...")
    cursor.executemany("""
        INSERT INTO secoes_completo VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
    """, registros_completo)

    cursor.executemany("""
        INSERT INTO secoes_1t VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
        )
    """, registros_1t)

    print("Criando índices de alta performance...")
    cursor.execute("CREATE INDEX idx_comp_uf ON secoes_completo (uf)")
    cursor.execute("CREATE INDEX idx_comp_mun ON secoes_completo (cod_municipio)")
    cursor.execute("CREATE INDEX idx_comp_nmmun ON secoes_completo (uf, nm_municipio)")
    cursor.execute("CREATE INDEX idx_comp_busca ON secoes_completo (uf, zona, secao)")
    cursor.execute("CREATE INDEX idx_comp_virada ON secoes_completo (virada)")
    cursor.execute("CREATE INDEX idx_comp_swing ON secoes_completo (swing_lula)")

    cursor.execute("CREATE INDEX idx_1t_uf ON secoes_1t (uf)")
    cursor.execute("CREATE INDEX idx_1t_mun ON secoes_1t (cod_municipio)")

    # Cria tabela de resumo por estado para consulta rápida
    print("Gerando resumo consolidado por UF...")
    cursor.execute("""
        CREATE TABLE resumo_uf AS
        SELECT 
            uf,
            COUNT(*) as total_secoes,
            SUM(votos_lula_1t) as lula_1t,
            SUM(votos_flavio_1t) as flavio_1t,
            SUM(votos_validos_1t) as validos_1t,
            SUM(votos_lula_2t) as lula_2t,
            SUM(votos_flavio_2t) as flavio_2t,
            SUM(votos_validos_2t) as validos_2t,
            SUM(CASE WHEN virada = 'Flávio -> Lula' THEN 1 ELSE 0 END) as viradas_para_lula,
            SUM(CASE WHEN virada = 'Lula -> Flávio' THEN 1 ELSE 0 END) as viradas_para_flavio
        FROM secoes_completo
        GROUP BY uf
    """)

    conn.commit()
    conn.close()

    elapsed = time.time() - start_time
    print("==================================================")
    print(f"[OK] INDEXACAO CONCLUIDA COM SUCESSO EM {elapsed:.1f}s!")
    print(f"Banco gerado: {DB_PATH} ({os.path.getsize(DB_PATH)/(1024*1024):.1f} MB)")
    print(f"Total de Viradas Flávio -> Lula: {total_viradas_lula:,}")
    print(f"Total de Viradas Lula -> Flávio: {total_viradas_flavio:,}")
    print("==================================================")

if __name__ == "__main__":
    indexar_eleicao_completa()
