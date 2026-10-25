import urllib.request
import json

url = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, timeout=5) as r:
        data = json.loads(r.read().decode())
        
    print("=== STATUS OFICIAL DO TSE AGORA ===")
    print("Ultima atualizacao TSE:", data.get("dg"), data.get("hg"))
    s = data.get("s", {})
    st = s.get("st")
    ts = s.get("ts")
    pst = s.get("pst")
    print(f"Secoes totalizadas: {st} de {ts} ({pst}%)")
    
    v = data.get("v", {})
    print(f"Total de votos apurados: {v.get('tv')}")
    
    carg = data.get("carg", [{}])[0]
    for agr in carg.get("agr", []):
        for par in agr.get("par", []):
            for cand in par.get("cand", []):
                n = cand.get("n")
                nm = cand.get("nm")
                vap = cand.get("vap")
                pvap = cand.get("pvap")
                print(f"Candidato: {n} - {nm} | Votos: {vap} ({pvap}%)")
except Exception as e:
    print("Erro ao acessar TSE:", e)

# Verificar quais estados têm urnas abertas agora
print("\n=== URNAS APURADAS POR ESTADO ===")
all_ufs = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to','zz']
total_estados_com_urna = 0
for uf in all_ufs:
    u_url = f"https://resultados.tse.jus.br/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.json"
    try:
        req_u = urllib.request.Request(u_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req_u, timeout=2) as resp:
            u_data = json.loads(resp.read().decode())
            u_st = int(u_data.get("s", {}).get("st", 0))
            if u_st > 0:
                total_estados_com_urna += 1
                u_ts = u_data.get("s", {}).get("ts")
                u_pst = u_data.get("s", {}).get("pst")
                print(f"{uf.upper()}: {u_st} de {u_ts} secoes ({u_pst}%)")
    except Exception:
        pass
