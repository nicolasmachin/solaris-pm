"""
Script Python original (referencia). Las coordenadas y mappings se portaron a
TypeScript en server/src/services/ute-docs/{coordinates.ts,mappings.ts}.
NO se ejecuta — queda como fuente de verdad para cuando UTE actualice plantillas.

Origen: process manual de habilitación FV.
Portado en: 2026-05-13 (v6.0).
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PyPDF2 import PdfReader, PdfWriter
import io
# (resto del contenido en el commit original, ver Git history)
