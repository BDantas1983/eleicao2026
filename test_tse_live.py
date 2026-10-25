import urllib.request
import json

url = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())

print("Data de geração:", data.get("dg"), data.get("hg"))
print("Seções totalizadas (s):", data.get("s"))
print("Eleitorado apto (e):", data.get("e"))
print("Votos apurados (v):", data.get("v"))

carg = data.get("carg", [{}])[0]
print("Cargo:", carg.get("nm"))
for agr in carg.get("agr", []):
    for par in agr.get("par", []):
        for cand in par.get("cand", []):
            n = cand.get("n")
            nm = cand.get("nm")
            vap = cand.get("vap")
            pvap = cand.get("pvap")
            print(f"Candidato: {n} - {nm} | Votos: {vap} | %: {pvap}")
