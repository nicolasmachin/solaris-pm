#!/usr/bin/env python3
"""
Normaliza los `original_*.pdf` de UTE a un formato canonical que pdf-lib puede
parsear. Las plantillas originales vienen con encripción "empty password" y
referencias internas malformadas que pdf-lib (estricto) rechaza.

PyPDF2 es más tolerante: lee, decrypta con password vacío, y reescribe en
formato limpio. El resultado queda como `clean_*.pdf` en la misma carpeta.

Idempotente: correr varias veces es seguro. Solo se ejecuta cuando UTE
actualiza algún template (cambio raro). Para correrlo:

    docker compose exec server /opt/proposal-venv/bin/python3 \\
        scripts/prepare-ute-templates.py
"""
from PyPDF2 import PdfReader, PdfWriter
import os
import sys

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "ute-templates")

def main() -> int:
    if not os.path.isdir(BASE):
        print(f"No existe la carpeta {BASE}", file=sys.stderr)
        return 1
    failures = 0
    for filename in sorted(os.listdir(BASE)):
        if not filename.startswith("original_") or not filename.endswith(".pdf"):
            continue
        src = os.path.join(BASE, filename)
        dst = os.path.join(BASE, filename.replace("original_", "clean_"))
        try:
            reader = PdfReader(src)
            if reader.is_encrypted:
                reader.decrypt("")
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            with open(dst, "wb") as out:
                writer.write(out)
            print(f"  ✓ {filename} → {os.path.basename(dst)}")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {filename}: {e}", file=sys.stderr)
            failures += 1
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
