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

CSV_BAIRROS = os.path.join(os.path.dirname(__file__), "eleitorado_locais_votacao_2026", "eleitorado_local_votacao_2026_BRASIL.csv")
DB_PATH = os.path.join(os.path.dirname(__file__), "dados_1t.db")

def enriquecer_banco():
    start_time = time.time()
    print("==================================================")
    print("[*] ENRIQUECIMENTO DE DADOS: BAIRROS E MUNICÍPIOS")
    print("==================================================")

    if not os.path.exists(CSV_BAIRROS):
        print(f"ERRO: Arquivo {CSV_BAIRROS} não encontrado!")
        sys.exit(1)

    print(f"Lendo base de locais e bairros: {CSV_BAIRROS}...")

    # Mapeamento chave -> (nm_bairro, nr_cep, lat, long, nm_local, endereco)
    # chave: UF_CODMUN_ZONA_SECAO
    bairros_map = {}
    linhas = 0

    with open(CSV_BAIRROS, "r", encoding="latin1") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        # 6: SG_UF, 7: CD_MUNICIPIO, 9: NR_ZONA, 10: NR_SECAO, 15: NM_LOCAL_VOTACAO, 18: DS_ENDERECO, 19: NM_BAIRRO, 20: NR_CEP, 22: NR_LATITUDE, 23: NR_LONGITUDE
        for row in reader:
            linhas += 1
            if len(row) <= 20:
                continue

            uf = row[6].upper().strip()
            try:
                cod_mun = int(row[7])
                zona = int(row[9])
                secao = int(row[10])
            except ValueError:
                continue

            nm_local = row[15].strip()
            ds_endereco = row[18].strip()
            nm_bairro = row[19].strip().upper()
            nr_cep = row[20].strip()
            nr_lat = row[22].strip().replace(",", ".") if len(row) > 22 else ""
            nr_long = row[23].strip().replace(",", ".") if len(row) > 23 else ""

            if not nm_bairro or nm_bairro in ["#NULO", "#NE", "-1", "SEM BAIRRO"]:
                nm_bairro = "CENTRO / NÃO ESPECIFICADO"

            chave = f"{uf}_{cod_mun}_{zona}_{secao}"
            bairros_map[chave] = (nm_bairro, nr_cep, nr_lat, nr_long, nm_local, ds_endereco)

    print(f"Total de locais/seções lidos no CSV: {linhas:,}")
    print(f"Chaves únicas no dicionário: {len(bairros_map):,}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = MEMORY")
    cursor.execute("PRAGMA cache_size = 100000")

    # 1. Adiciona coluna nm_bairro, nr_cep se não existirem
    print("Atualizando estrutura da tabela secoes_completo...")
    cursor.execute("PRAGMA table_info(secoes_completo)")
    cols = [c[1] for c in cursor.fetchall()]

    if "nm_bairro" not in cols:
        cursor.execute("ALTER TABLE secoes_completo ADD COLUMN nm_bairro TEXT DEFAULT 'NÃO ESPECIFICADO'")
    if "nr_cep" not in cols:
        cursor.execute("ALTER TABLE secoes_completo ADD COLUMN nr_cep TEXT DEFAULT ''")
    if "nr_lat" not in cols:
        cursor.execute("ALTER TABLE secoes_completo ADD COLUMN nr_lat REAL")
    if "nr_long" not in cols:
        cursor.execute("ALTER TABLE secoes_completo ADD COLUMN nr_long REAL")

    print("Gravando bairros nas seções da base de dados...")
    # Cria tabela temporária para join rápido
    cursor.execute("DROP TABLE IF EXISTS temp_bairros")
    cursor.execute("""
        CREATE TABLE temp_bairros (
            chave TEXT PRIMARY KEY,
            nm_bairro TEXT,
            nr_cep TEXT,
            nr_lat REAL,
            nr_long REAL
        )
    """)

    registros_temp = []
    for chave, vals in bairros_map.items():
        nm_bairro, nr_cep, nr_lat, nr_long, _, _ = vals
        try:
            lat_f = float(nr_lat) if nr_lat else None
            long_f = float(nr_long) if nr_long else None
        except ValueError:
            lat_f, long_f = None, None
        registros_temp.append((chave, nm_bairro, nr_cep, lat_f, long_f))

    cursor.executemany("INSERT INTO temp_bairros VALUES (?, ?, ?, ?, ?)", registros_temp)

    # Atualiza secoes_completo a partir de temp_bairros
    cursor.execute("""
        UPDATE secoes_completo
        SET nm_bairro = (SELECT temp_bairros.nm_bairro FROM temp_bairros WHERE temp_bairros.chave = secoes_completo.chave),
            nr_cep = (SELECT temp_bairros.nr_cep FROM temp_bairros WHERE temp_bairros.chave = secoes_completo.chave),
            nr_lat = (SELECT temp_bairros.nr_lat FROM temp_bairros WHERE temp_bairros.chave = secoes_completo.chave),
            nr_long = (SELECT temp_bairros.nr_long FROM temp_bairros WHERE temp_bairros.chave = secoes_completo.chave)
        WHERE EXISTS (SELECT 1 FROM temp_bairros WHERE temp_bairros.chave = secoes_completo.chave)
    """)
    cursor.execute("DROP TABLE temp_bairros")

    # Define fallback para seções sem bairro
    cursor.execute("UPDATE secoes_completo SET nm_bairro = 'CENTRO / NÃO ESPECIFICADO' WHERE nm_bairro IS NULL OR nm_bairro = ''")

    print("Criando índices de busca por bairro...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_comp_bairro ON secoes_completo (uf, cod_municipio, nm_bairro)")

    # 2. Gera Tabela Consolidada de Municípios
    print("Gerando tabela consolidada: resumo_municipios...")
    cursor.execute("DROP TABLE IF EXISTS resumo_municipios")
    cursor.execute("""
        CREATE TABLE resumo_municipios AS
        SELECT 
            uf,
            cod_municipio,
            nm_municipio,
            COUNT(*) as total_secoes,
            
            -- 1º Turno
            SUM(votos_lula_1t) as lula_1t,
            SUM(votos_flavio_1t) as flavio_1t,
            SUM(votos_validos_1t) as validos_1t,
            ROUND(CAST(SUM(votos_lula_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100, 2) as pct_lula_1t,
            ROUND(CAST(SUM(votos_flavio_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100, 2) as pct_flavio_1t,
            CASE WHEN SUM(votos_lula_1t) > SUM(votos_flavio_1t) THEN 'Lula'
                 WHEN SUM(votos_flavio_1t) > SUM(votos_lula_1t) THEN 'Flávio'
                 ELSE 'Empate' END as vencedor_1t,
            
            -- 2º Turno
            SUM(votos_lula_2t) as lula_2t,
            SUM(votos_flavio_2t) as flavio_2t,
            SUM(votos_validos_2t) as validos_2t,
            ROUND(CAST(SUM(votos_lula_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100, 2) as pct_lula_2t,
            ROUND(CAST(SUM(votos_flavio_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100, 2) as pct_flavio_2t,
            CASE WHEN SUM(votos_lula_2t) > SUM(votos_flavio_2t) THEN 'Lula'
                 WHEN SUM(votos_flavio_2t) > SUM(votos_lula_2t) THEN 'Flávio'
                 ELSE 'Empate' END as vencedor_2t,

            -- Deltas e Viradas
            SUM(votos_lula_2t) - SUM(votos_lula_1t) as delta_lula,
            SUM(votos_flavio_2t) - SUM(votos_flavio_1t) as delta_flavio,
            ROUND((CAST(SUM(votos_lula_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100) - 
                  (CAST(SUM(votos_lula_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100), 2) as swing_lula,

            CASE 
                WHEN SUM(votos_flavio_1t) > SUM(votos_lula_1t) AND SUM(votos_lula_2t) > SUM(votos_flavio_2t) THEN 'Flávio -> Lula'
                WHEN SUM(votos_lula_1t) > SUM(votos_flavio_1t) AND SUM(votos_flavio_2t) > SUM(votos_lula_2t) THEN 'Lula -> Flávio'
                ELSE 'Não'
            END as virada_municipio,

            SUM(CASE WHEN virada = 'Flávio -> Lula' THEN 1 ELSE 0 END) as viradas_secoes_lula,
            SUM(CASE WHEN virada = 'Lula -> Flávio' THEN 1 ELSE 0 END) as viradas_secoes_flavio
        FROM secoes_completo
        GROUP BY uf, cod_municipio, nm_municipio
    """)
    cursor.execute("CREATE INDEX idx_mun_uf ON resumo_municipios (uf)")
    cursor.execute("CREATE INDEX idx_mun_nome ON resumo_municipios (nm_municipio)")
    cursor.execute("CREATE INDEX idx_mun_virada ON resumo_municipios (virada_municipio)")

    # 3. Gera Tabela Consolidada de Bairros
    print("Gerando tabela consolidada: resumo_bairros...")
    cursor.execute("DROP TABLE IF EXISTS resumo_bairros")
    cursor.execute("""
        CREATE TABLE resumo_bairros AS
        SELECT 
            uf,
            cod_municipio,
            nm_municipio,
            nm_bairro,
            COUNT(*) as total_secoes,
            
            -- 1º Turno
            SUM(votos_lula_1t) as lula_1t,
            SUM(votos_flavio_1t) as flavio_1t,
            SUM(votos_validos_1t) as validos_1t,
            ROUND(CAST(SUM(votos_lula_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100, 2) as pct_lula_1t,
            ROUND(CAST(SUM(votos_flavio_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100, 2) as pct_flavio_1t,
            CASE WHEN SUM(votos_lula_1t) > SUM(votos_flavio_1t) THEN 'Lula'
                 WHEN SUM(votos_flavio_1t) > SUM(votos_lula_1t) THEN 'Flávio'
                 ELSE 'Empate' END as vencedor_1t,
            
            -- 2º Turno
            SUM(votos_lula_2t) as lula_2t,
            SUM(votos_flavio_2t) as flavio_2t,
            SUM(votos_validos_2t) as validos_2t,
            ROUND(CAST(SUM(votos_lula_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100, 2) as pct_lula_2t,
            ROUND(CAST(SUM(votos_flavio_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100, 2) as pct_flavio_2t,
            CASE WHEN SUM(votos_lula_2t) > SUM(votos_flavio_2t) THEN 'Lula'
                 WHEN SUM(votos_flavio_2t) > SUM(votos_lula_2t) THEN 'Flávio'
                 ELSE 'Empate' END as vencedor_2t,

            -- Deltas e Viradas
            SUM(votos_lula_2t) - SUM(votos_lula_1t) as delta_lula,
            SUM(votos_flavio_2t) - SUM(votos_flavio_1t) as delta_flavio,
            ROUND((CAST(SUM(votos_lula_2t) AS REAL) / MAX(1, SUM(votos_validos_2t)) * 100) - 
                  (CAST(SUM(votos_lula_1t) AS REAL) / MAX(1, SUM(votos_validos_1t)) * 100), 2) as swing_lula,

            CASE 
                WHEN SUM(votos_flavio_1t) > SUM(votos_lula_1t) AND SUM(votos_lula_2t) > SUM(votos_flavio_2t) THEN 'Flávio -> Lula'
                WHEN SUM(votos_lula_1t) > SUM(votos_flavio_1t) AND SUM(votos_flavio_2t) > SUM(votos_lula_2t) THEN 'Lula -> Flávio'
                ELSE 'Não'
            END as virada_bairro,

            SUM(CASE WHEN virada = 'Flávio -> Lula' THEN 1 ELSE 0 END) as viradas_secoes_lula,
            SUM(CASE WHEN virada = 'Lula -> Flávio' THEN 1 ELSE 0 END) as viradas_secoes_flavio
        FROM secoes_completo
        GROUP BY uf, cod_municipio, nm_municipio, nm_bairro
    """)
    cursor.execute("CREATE INDEX idx_bairros_busca ON resumo_bairros (uf, cod_municipio)")
    cursor.execute("CREATE INDEX idx_bairros_nome ON resumo_bairros (uf, nm_municipio, nm_bairro)")
    cursor.execute("CREATE INDEX idx_bairros_virada ON resumo_bairros (virada_bairro)")

    conn.commit()
    conn.close()

    elapsed = time.time() - start_time
    print("==================================================")
    print(f"[OK] ENRIQUECIMENTO CONCLUÍDO COM SUCESSO EM {elapsed:.1f}s!")
    print(f"Banco atualizado: {DB_PATH}")
    print("==================================================")

if __name__ == "__main__":
    enriquecer_banco()
