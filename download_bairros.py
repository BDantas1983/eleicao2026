import os
import sys
import time
import urllib.request
import zipfile

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip"
DEST_DIR = os.path.join(os.path.dirname(__file__), "eleitorado_locais_votacao_2026")
ZIP_PATH = os.path.join(DEST_DIR, "eleitorado_local_votacao_2026.zip")

def download_and_extract():
    os.makedirs(DEST_DIR, exist_ok=True)
    print(f"Baixando pacote oficial de locais de votação e bairros: {URL}")
    print(f"Destino: {ZIP_PATH}")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    req = urllib.request.Request(URL, headers=headers)

    start_time = time.time()
    last_print = 0

    with urllib.request.urlopen(req, timeout=60) as response, open(ZIP_PATH, "wb") as out_file:
        total_size = int(response.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 512

        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)

            now = time.time()
            if now - last_print >= 2 or downloaded == total_size:
                pct = (downloaded / total_size * 100) if total_size > 0 else 0
                mb_down = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                speed = mb_down / (now - start_time) if (now - start_time) > 0 else 0
                print(f"Progresso: {mb_down:.1f}MB / {mb_total:.1f}MB ({pct:.1f}%) - {speed:.2f} MB/s", flush=True)
                last_print = now

    elapsed = time.time() - start_time
    print(f"[OK] Download concluído com sucesso em {elapsed:.1f}s!")

    print("Extraindo arquivos...")
    with zipfile.ZipFile(ZIP_PATH, "r") as z:
        for info in z.infolist():
            print(f" - Extraindo: {info.filename} ({info.file_size / (1024*1024):.1f} MB)")
            z.extract(info, DEST_DIR)

    print("[OK] Extração finalizada com sucesso!")

if __name__ == "__main__":
    download_and_extract()
