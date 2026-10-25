import csv
import sqlite3
import os
import time

CSV_PATH = r"d:\Eleição\votacao_secao_2026_BR\votacao_secao_2026_BR.csv"
DB_PATH = r"d:\Eleição\dados_1t.db"

def indexar_primeiro_turno():
    start_time = time.time()
    print(f"Iniciando indexacao do 1º Turno a partir de {CSV_PATH}...")
    
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS secoes_1t (
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_uf ON secoes_1t (uf)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mun ON secoes_1t (cod_municipio)")

    # Dicionário temporário para agrupar por seção
    # chave: (uf, cod_mun, nm_mun, zona, secao) -> [lula, flavio, outros, branco, nulo]
    secoes = {}
    
    total_linhas = 0
    with open(CSV_PATH, "r", encoding="latin1") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            total_linhas += 1
            if total_linhas % 500000 == 0:
                print(f"Processadas {total_linhas:,} linhas...")
                
            turno = row.get("NR_TURNO")
            cargo = row.get("DS_CARGO")
            if turno != "1" or cargo != "Presidente":
                continue
                
            uf = row.get("SG_UF", "")
            cod_mun = int(row.get("CD_MUNICIPIO", 0) or 0)
            nm_mun = row.get("NM_MUNICIPIO", "")
            zona = int(row.get("NR_ZONA", 0) or 0)
            secao = int(row.get("NR_SECAO", 0) or 0)
            nr_votavel = row.get("NR_VOTAVEL", "")
            
            try:
                qtd_votos = int(row.get("QT_VOTOS", 0) or 0)
            except ValueError:
                qtd_votos = 0
                
            chave = f"{uf}_{cod_mun}_{zona}_{secao}"
            
            if chave not in secoes:
                # [uf, cod_mun, nm_mun, zona, secao, lula, flavio, outros, branco, nulo]
                secoes[chave] = [uf, cod_mun, nm_mun, zona, secao, 0, 0, 0, 0, 0]
                
            item = secoes[chave]
            if nr_votavel == "13":
                item[5] += qtd_votos
            elif nr_votavel == "22":
                item[6] += qtd_votos
            elif nr_votavel == "95":
                item[8] += qtd_votos
            elif nr_votavel == "96":
                item[9] += qtd_votos
            else:
                item[7] += qtd_votos

    print(f"Total de secoes unicas encontradas: {len(secoes):,}")
    print("Gravando no banco SQLite...")
    
    registros = []
    for chave, d in secoes.items():
        v_lula = d[5]
        v_flavio = d[6]
        v_outros = d[7]
        v_branco = d[8]
        v_nulo = d[9]
        v_validos = v_lula + v_flavio + v_outros
        v_total = v_validos + v_branco + v_nulo
        registros.append((
            chave, d[0], d[1], d[2], d[3], d[4],
            v_lula, v_flavio, v_outros, v_branco, v_nulo,
            v_validos, v_total
        ))
        
    cursor.executemany("""
        INSERT INTO secoes_1t (
            chave, uf, cod_municipio, nm_municipio, zona, secao,
            votos_lula, votos_flavio, votos_outros, votos_branco, votos_nulo,
            votos_validos, votos_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, registros)
    
    conn.commit()
    conn.close()
    
    elapsed = time.time() - start_time
    print(f"Indexacao concluida com sucesso em {elapsed:.2f}s! Banco gerado: {DB_PATH}")

if __name__ == "__main__":
    indexar_primeiro_turno()
