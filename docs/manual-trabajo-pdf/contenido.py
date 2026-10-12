#!/usr/bin/env python3
"""
El Procedimiento General de Trabajo (PGT) de Voltia, en hojas A4 para el canvas.

**Las hojas salen del .md**, `docs/Procedimiento-General-de-Trabajo-Voltia.md`,
que es la fuente de verdad. No hay texto copiado acá: se corrige el .md, se
vuelve a correr esto, se mide y se publica. Así el canvas no puede quedar
diciendo otra cosa que el documento.

Lo que sí se decide acá es la forma:
- las tres **partes** y qué capítulos tiene cada una (PARTES, abajo);
- la **apertura de cada capítulo**: número grande y título, para que se vea
  dónde empieza cada uno (un pedido explícito: en la versión anterior el
  capítulo solo figuraba en la cabecera de la hoja);
- el **corte de hoja**, automático con las alturas **medidas** de cada bloque
  (medir-bloques.mjs): las tablas largas se parten por fila repitiendo la
  cabecera, y un subtítulo o una frase que termina en dos puntos nunca queda
  sola al pie. Las hojas que siguen a la primera de un capítulo llevan arriba
  de qué capítulo son.

Los bloques visuales (tablas, avisos, frases) son los del Manual de Posventa,
importados de `docs/manual-posventa-pdf/generar.py`.

Uso (genera, mide y saca vistas en una pasada):
    bash docs/manual-trabajo-pdf/armar.sh <carpeta> [Hoja.dc.html,...]
"""

import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
POSVENTA = os.path.join(AQUI, "..", "manual-posventa-pdf")
# El mismo generador arma más de un manual: MANUAL=operaciones toma el de
# Operaciones. Lo que cambia entre uno y otro está en CONFIG y en PARTES.
MANUAL = os.environ.get("MANUAL", "pgt")
CONFIG = {
    "pgt": {"fuente": "Procedimiento-General-de-Trabajo-Voltia.md",
            "pie": "Procedimiento General de Trabajo · Voltia",
            "titulo": "Procedimiento General de Trabajo", "subtitulo": "PGT de Voltia", "corto": "PGT",
            "canvas": "Procedimiento General de Trabajo (PGT) de Voltia"},
    "operaciones": {"fuente": "Manual-de-Trabajo-Operaciones.md",
                    "pie": "Manual de trabajo de Operaciones · Voltia",
                    "titulo": "Manual de trabajo de Operaciones", "subtitulo": "Operaciones · Obra · Logística",
                    "corto": "Operaciones", "canvas": "Manual de trabajo de Operaciones"},
    "ventas": {"fuente": "Manual-de-Trabajo-Ventas.md",
               "pie": "Manual de trabajo de Ventas · Voltia",
               "titulo": "Manual de trabajo de Ventas", "subtitulo": "Del lead a la venta y el onboarding",
               "corto": "Ventas", "canvas": "Manual de trabajo de Ventas"},
}[MANUAL]
FUENTE = os.path.join(AQUI, "..", CONFIG["fuente"])
sys.path.insert(0, AQUI)
sys.path.insert(1, POSVENTA)

import imagenes as IMG  # noqa: E402

# Cada canvas tiene su propio almacén de imágenes: un /_blob/ del PGT no se ve
# en el de Operaciones. assets-operaciones.json dice qué id tiene cada foto y
# cada logo en el canvas de Operaciones.
if MANUAL == "operaciones":
    _MAPA_OPS = json.load(open(os.path.join(AQUI, "assets-operaciones.json")))
    for _k in dir(IMG):
        _v = getattr(IMG, _k)
        if isinstance(_v, str) and _v.startswith("/_blob/") and _v[7:] in _MAPA_OPS:
            setattr(IMG, _k, _MAPA_OPS[_v[7:]])
# Cada manual con su foto de portada: si no, todos salen con la misma.
if MANUAL == "ventas":
    IMG.PORTADA = "/_blob/c41de33a7f6be025d3e530d01a15874d"  # casa con paneles en la azotea, al atardecer
    IMG.CIERRE = "/_blob/883d4a8ac113879dd1d3be810b57c788"  # paneles sobre techo de chapa
if MANUAL == "operaciones":
    # Ya en la dirección del canvas de Operaciones (no pasa por assets-operaciones.json).
    IMG.PORTADA = "/_blob/871e3d109a7c1625835db5de3dfa7693"  # estructura a suelo, en obra
import generar  # noqa: E402
from generar import (  # noqa: E402
    AZUL, AZUL_FONDO, BORDE, GRIS, GRIS_CLARO, NEGRO, ROJO, ROJO_BORDE, ROJO_FONDO, SANS, SERIF, TEXTO,
    VERDE, VERDE_FONDO, VERDE_TEXTO,
    ANCHO, ALTO, FUENTES, altura_estimada, numerados, pagina,
)

PIE = CONFIG["pie"]
generar.configurar(PIE, IMG.LOGO_ISOTIPO, IMG.LOGO_ISOTIPO_BLANCO)

# Las partes agrupan capítulos (por número de capítulo del .md). Los anexos van
# después de la última parte, sin portadilla propia.
PARTES = [
    ("1", "Cómo se conecta Voltia", [0, 1, 2],
     "Los documentos de trabajo, el recorrido de un proyecto y las reglas que valen para todas "
     "las áreas.", IMG.PORTADILLA_PARTE1),
    ("2", "Las áreas y cómo trabajan juntas", [3, 4, 5],
     "Qué hace cada área, qué le deja a la siguiente y a quién se le pregunta qué.", IMG.PORTADILLA_PARTE2),
    ("3", "El cliente y Voltia PM", [6, 7, 8],
     "Lo que todas las áreas tienen que saber del trato con el cliente, la herramienta y qué hacer "
     "cuando algo sale mal.", IMG.PORTADILLA_PARTE3),
]

if MANUAL == "operaciones":
    PARTES = [
        ("A", "Operaciones", [0, 1, 2, 3, 4, 5, 6, 7, 8],
         "Cómo funciona el área entera: dónde empieza y termina cada etapa, los 12 días hasta la obra, "
         "la fecha de obra y las reglas del área.", IMG.PORTADILLA_PARTE2),
        ("B", "Obra", [9, 10, 11, 12, 13, 14, 15, 16, 17],
         "El trabajo en la propiedad del cliente: el informe del capataz, la preparación, la seguridad, los criterios técnicos, "
         "la puesta en marcha y el cierre de la obra.", IMG.PORTADILLA_PARTE3),
        ("C", "Logística", [18, 19, 20],
         "Las compras y la entrega de materiales: dónde empieza y termina, y qué hacer si algo demora.",
         IMG.PORTADILLA_PARTE1),
    ]

# Ventas no tiene partes: los capítulos van seguidos, sin portadillas, en el
# orden del .md (incluida la sección sin número "Las reglas de Ventas").
if MANUAL == "ventas":
    PARTES = []

# Los capítulos de "Cuando algo sale mal", cuyos casos van en tarjetas.
CAPITULOS_CASOS = {"operaciones": (8, 16, 20), "ventas": (6,)}.get(MANUAL, ())

# Lo que entra en una hoja: 1123 menos los márgenes (72 + 56) y el pie. Con
# alturas medidas (medir-bloques.mjs) el colchón es chico; sin ellas se
# estima y conviene dejar más.
CAPACIDAD = ALTO - 72 - 56 - 30 - 14

# Los bloques de cada capítulo, por id, y sus alturas medidas si las hay.
BLOQUES = {}
ALTURAS = {}


# ── Del markdown a HTML ───────────────────────────────────────────────────────

def en_linea(t):
    """Lo que el .md usa dentro de un párrafo: negrita, cursiva y nada más."""
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    if MANUAL == "ventas":
        t = simbolos(t)
    return t


# Los símbolos de los botones de Voltia PM que cita el .md de Ventas: las
# fuentes del manual no los tienen y salían como cuadraditos. Los emojis se
# sacan (el botón se reconoce por su texto) y los íconos se dibujan.
_SVG_IC = ('<svg viewBox="0 0 24 24" width="0.95em" height="0.95em" style="vertical-align: -0.12em" '
           'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{}</svg>')
SIMBOLOS = {
    "⋮⋮": ('<svg viewBox="0 0 24 24" width="0.95em" height="0.95em" style="vertical-align: -0.12em" '
           'fill="currentColor">' + "".join(f'<circle cx="{x}" cy="{y}" r="2"/>' for x in (9, 15) for y in (5, 12, 19))
           + "</svg>"),
    "✓": _SVG_IC.format('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    "✗": _SVG_IC.format('<path d="M6 6l12 12M18 6L6 18"/>'),
}


def simbolos(t):
    t = re.sub(r"[\U0001F300-\U0001FAFF\u2600-\u27BF](?<![✓✗])\uFE0F?\s?", "", t)
    for k, v in SIMBOLOS.items():
        t = t.replace(k, v)
    return t


def bloques_de(lineas):
    """Parte las líneas de un capítulo en bloques: (tipo, contenido)."""
    out, i = [], 0
    while i < len(lineas):
        l = lineas[i]
        if not l.strip() or l.strip() == "---" or l.startswith("# "):
            i += 1
            continue
        if l.startswith("### "):
            out.append(("h3", l[4:].strip()))
            i += 1
        elif l.startswith("#### "):
            out.append(("h4", l[5:].strip()))
            i += 1
        elif re.match(r"^!\[[^\]]*\]\(captura:[\w-]+\)\s*$", l):
            # Una captura de Voltia PM: ![epígrafe](captura:nombre), con el
            # nombre de capturas-operaciones.json.
            m = re.match(r"^!\[([^\]]*)\]\(captura:([\w-]+)\)", l)
            out.append(("captura", (m.group(2), m.group(1))))
            i += 1
        elif l.startswith("|"):
            filas = []
            while i < len(lineas) and lineas[i].startswith("|"):
                filas.append(lineas[i])
                i += 1
            celdas = [[c.strip() for c in f.strip().strip("|").split("|")] for f in filas]
            out.append(("tabla", (celdas[0], [c for c in celdas[2:]])))
        elif l.startswith(">"):
            cita = []
            while i < len(lineas) and lineas[i].startswith(">"):
                cita.append(lineas[i][1:].strip())
                i += 1
            out.append(("cita", cita))
        elif re.match(r"^- ", l):
            items = []
            while i < len(lineas) and (lineas[i].startswith("- ") or lineas[i].startswith("  ")):
                if lineas[i].startswith("- "):
                    items.append(lineas[i][2:].strip())
                else:
                    items[-1] += " " + lineas[i].strip()
                i += 1
            out.append(("lista", items))
        elif re.match(r"^\d+\. ", l):
            items = []
            while i < len(lineas):
                x = lineas[i]
                if re.match(r"^\d+\. ", x):
                    items.append(re.sub(r"^\d+\. ", "", x).strip())
                elif x.startswith("   - "):
                    # Una sublista dentro del paso: se marca y se dibuja aparte.
                    items[-1] += "\n- " + x.strip()[2:]
                elif x.startswith("   "):
                    items[-1] += " " + x.strip()
                elif not x.strip() and i + 1 < len(lineas) and lineas[i + 1].startswith("   ") and lineas[i + 1].strip():
                    # Un párrafo más del mismo paso, separado por una línea en blanco.
                    items[-1] += "\n\n"
                    i += 1
                    items[-1] += lineas[i].strip()
                else:
                    break
                i += 1
            items = [re.sub(r"\n\n ", "\n\n", x) for x in items]
            out.append(("numerada", items))
        else:
            par = []
            while i < len(lineas) and lineas[i].strip() and not re.match(r"^(\||>|- |\d+\. |#{1,4} |---|!\[)", lineas[i]):
                par.append(lineas[i].strip())
                i += 1
            out.append(("p", " ".join(par)))
    return out


def tabla_pgt(cabeceras, filas, anchos, margen=16):
    """La tabla del Manual de Posventa, más compacta: el PGT es casi todo tablas
    y con el aire de aquella las hojas quedaban a medio llenar."""
    ths = ""
    for i, (c, a) in enumerate(zip(cabeceras, anchos)):
        pad = "8px 12px 8px 0" if i == 0 else ("8px 0 8px 12px" if i == len(cabeceras) - 1 else "8px 12px")
        ancho = f" width: {a}px;" if a else ""
        ths += (f'<th style="padding: {pad}; text-align: left; font-family: {SANS}; font-size: 11px; '
                f'font-weight: 600; letter-spacing: 1.2px; color: {GRIS_CLARO}; '
                f'border-bottom: 1.5px solid {NEGRO};{ancho}">{c}</th>')
    trs = ""
    for fila in filas:
        tds = ""
        for i, celda in enumerate(fila):
            pad = "8px 12px 8px 0" if i == 0 else ("8px 0 8px 12px" if i == len(fila) - 1 else "8px 12px")
            peso = f"font-weight: 600; color: {NEGRO};" if i == 0 else f"color: {TEXTO};"
            tds += (f'<td style="padding: {pad}; font-size: 14px; line-height: 1.42; {peso} '
                    f'border-bottom: 1px solid {BORDE}; vertical-align: top">{celda}</td>')
        trs += f"<tr>{tds}</tr>"
    # Con casi todos los anchos fijados, se respetan tal cual (sin esto, el
    # navegador los reparte a su gusto).
    fijo = " table-layout: fixed;" if sum(1 for x in anchos if x) >= 4 else ""
    return (f'  <table style="width: 100%; border-collapse: collapse; margin-top: {margen}px;{fijo}">'
            f'<thead><tr>{ths}</tr></thead><tbody>{trs}</tbody></table>\n')


def anchos_de(cabeceras):
    """Anchos de columna razonables según cuántas hay: la primera más angosta."""
    n = len(cabeceras)
    if n == 2:
        return [220, None]
    if [c.strip().lower() for c in cabeceras[:2]] == ["paso", "responsable"] and n == 5:
        # La de pasos del capítulo 3: más lugar para "Qué pasa", para que la
        # tabla y el ejemplo entren en una hoja.
        return [104, 96, None, 80, 72]
    a = [None] * n
    for k, c in enumerate(cabeceras):
        if not c.strip():
            a[k] = 34
    if n >= 3 and a[0] is None:
        a[0] = 150
    return a


def _renglones(texto, max_chars):
    """Corta un texto en renglones de a lo sumo max_chars, por palabras."""
    out, linea = [], ""
    palabras = []
    for w in texto.split():
        # Una palabra con guion que no entra se corta en el guion.
        if len(w) > max_chars and "-" in w:
            a, b = w.split("-", 1)
            palabras += [a + "-", b]
        else:
            palabras.append(w)
    for w in palabras:
        if linea and len(linea) + (0 if linea.endswith("-") else 1) + len(w) > max_chars:
            out.append(linea)
            linea = w
        else:
            linea = (linea + w) if linea.endswith("-") else f"{linea} {w}".strip()
    if linea:
        out.append(linea)
    return out


def _txt(x, y, texto, tam, peso, color, max_chars=99, salto=None, anchor="start"):
    salto = salto or round(tam * 1.25)
    tspans = "".join(f'<tspan x="{x}" dy="{0 if i == 0 else salto}">{en_linea(l)}</tspan>'
                     for i, l in enumerate(_renglones(texto, max_chars)))
    return (f'<text x="{x}" y="{y}" font-family="Barlow, sans-serif" font-size="{tam}" '
            f'font-weight="{peso}" fill="{color}" text-anchor="{anchor}">{tspans}</text>')


# Un color por área, el mismo en todos los dibujos del PGT.
COLOR_AREA = {"Ventas": ("#1836b2", "#e8ecfa"), "Ingeniería": ("#7a3fb0", "#f1e9f8"),
              "Operaciones": ("#c25a12", "#fbece2"), "Tramitación UTE": ("#127a7a", "#e0f2f2"),
              "Experiencia Solar": ("#3d6b47", "#e9f4ea"), "Finanzas": ("#8a5a10", "#fdf8ec"),
              "Gerencia": ("#10131f", "#eef0f5")}


def flujo_etapas(etapas, tramos):
    """El recorrido del capítulo 1 en carriles, con los datos del .md: una fila
    por área, cada etapa en el carril de su dueña (Logística y Obra van dentro
    de Operaciones), flechas que muestran cuándo el trabajo pasa de un área a
    otra, y abajo el carril de Experiencia Solar con sus tres tramos. Las
    flechas punteadas bajan desde el punto del flujo que dispara cada cosa en
    Experiencia Solar: son los cuatro momentos.

    Lo que se decide acá y no viene del .md: dónde cae cada tramo y cada
    momento. E1 arranca cuando se completa el onboarding (al empezar
    Pre-Ingeniería) y termina con la obra; E2 es el Trámite UTE; E3 arranca con la habilitación. La fecha
    de obra se confirma en la validación de Operaciones."""
    W, col = 650, 72
    caja_w, caja_h = 64, 66
    carril_h, sep = 88, 6
    carriles = ["Ventas", "Ingeniería", "Operaciones", "Tramitación UTE"]
    y_es = len(carriles) * (carril_h + sep) + 18
    es_h = 66
    H = y_es + es_h + 2
    flecha = "#10131f"
    p = [f'<defs><marker id="pgt-f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
         f'orient="auto"><path d="M0 0L10 5L0 10z" fill="{flecha}"/></marker></defs>']

    def carril_de(duena):
        base = duena.split("(")[0].strip()
        sub = duena[duena.find("(") + 1:duena.find(")")] if "(" in duena else ""
        return base, sub

    # Los carriles.
    for i, c in enumerate(carriles):
        y = i * (carril_h + sep)
        fuerte, claro = COLOR_AREA[c]
        p.append(f'<rect x="0" y="{y}" width="{W}" height="{carril_h}" rx="6" fill="{claro}"/>')
        p.append(_txt(10, y + 11.5, c.upper(), 9, 700, fuerte))

    # Las etapas, cada una en su carril.
    pos = []
    for k, fila in enumerate(etapas):
        num, etapa, duena = fila[:3]
        plazo = fila[3] if len(fila) > 3 else ""
        base, sub = carril_de(duena)
        i = carriles.index(base)
        x = k * col + (col - caja_w) / 2
        y = i * (carril_h + sep) + carril_h - caja_h - 6
        pos.append((x, y))
        fuerte = COLOR_AREA[base][0]
        p.append(f'<rect x="{x}" y="{y}" width="{caja_w}" height="{caja_h}" rx="6" fill="{fuerte}"/>')
        p.append(_txt(x + 6, y + 13, num, 9.5, 700, "#ffffffb3"))
        p.append(_txt(x + 6, y + 25, etapa, 9.5, 700, "#ffffff", max_chars=11, salto=10.5))
        if sub:
            p.append(_txt(x + 6, y + caja_h - 19, sub.upper(), 7.5, 600, "#ffffffcc"))
        # El plazo de la etapa, abajo: "3 días hábiles" → "3 d háb."
        m = re.match(r"(\d+) días hábiles", plazo)
        corto = f"{m.group(1)} d háb." if m else ("ver embudo" if plazo else "")
        if corto:
            p.append(f'<rect x="{x + 4}" y="{y + caja_h - 15}" width="{caja_w - 8}" height="12" rx="3" fill="#ffffff26"/>')
            p.append(_txt(x + caja_w / 2, y + caja_h - 6, corto, 8.5, 700, "#ffffff", anchor="middle"))
    # La instalación habilitada, al final del carril de Tramitación.
    xh = len(etapas) * col + (col - caja_w) / 2
    yh = pos[-1][1]
    p.append(f'<rect x="{xh}" y="{yh}" width="{caja_w}" height="{caja_h}" rx="6" fill="#3d6b47"/>'
             f'<path d="M{xh + 8} {yh + 13}l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.4" '
             f'stroke-linecap="round" stroke-linejoin="round"/>')
    p.append(_txt(xh + 6, yh + 40, "Habilitada", 10, 700, "#ffffff"))

    # El pase de trabajo entre etapas.
    puntos = pos + [(xh, yh)]
    for (x1, y1), (x2, y2) in zip(puntos, puntos[1:]):
        a = (x1 + caja_w, y1 + caja_h / 2)
        b = (x2 - 2, y2 + caja_h / 2)
        if abs(a[1] - b[1]) < 1:
            p.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{flecha}" '
                     f'stroke-width="1.3" marker-end="url(#pgt-f)"/>')
        else:
            mx = (a[0] + b[0]) / 2
            p.append(f'<path d="M{a[0]} {a[1]} C{mx} {a[1]} {mx} {b[1]} {b[0]} {b[1]}" fill="none" '
                     f'stroke="{flecha}" stroke-width="1.3" marker-end="url(#pgt-f)"/>')

    # El carril de Experiencia Solar con sus tramos (desde → hasta, del .md).
    fuerte, claro = COLOR_AREA["Experiencia Solar"]
    p.append(f'<rect x="0" y="{y_es}" width="{W}" height="{es_h}" rx="6" fill="{claro}"/>')
    p.append(_txt(10, y_es + 15, "EXPERIENCIA SOLAR · EN PARALELO", 9.5, 700, fuerte))
    lugar = {"E1": (2, 7), "E2": (7, 8), "E3": (8, 9)}
    tono = {"E1": "#3d6b47", "E2": "#5a8a63", "E3": "#6f9c77"}
    yb, hb = y_es + 24, es_h - 30
    inicio = {}
    for cod, nombre, desde, hasta in tramos:
        cod = cod.strip("*")
        a, b = lugar[cod]
        x0 = a * col + (col - caja_w) / 2
        x1 = (b - 1) * col + (col + caja_w) / 2
        inicio[cod] = x0
        p.append(f'<rect x="{x0}" y="{yb}" width="{x1 - x0}" height="{hb}" rx="6" fill="{tono[cod]}"/>')
        titulo = f"{cod} · {nombre}" if b - a > 1 else cod
        p.append(_txt(x0 + 7, yb + 15, titulo, 11, 700, "#ffffff"))
        # El desde → hasta solo entra en E1; E2 y E3 los dicen los momentos.
        if b - a > 1:
            p.append(_txt(x0 + 120, yb + 15, f"{desde} → {hasta}", 9.5, 500, "#e3f0e5"))

    # Los cuatro momentos: flechas punteadas desde lo que las dispara.
    (xv, yv), (xva, yva), (xo, yo), (xt, yt) = pos[1], pos[3], pos[6], pos[7]
    disparos = [
        (1, xv + caja_w / 2, yv + caja_h, inicio["E1"] + 4),      # se completa el onboarding → E1
        (2, xva + caja_w / 2, yva + caja_h, xva + caja_w / 2),    # fecha confirmada → aviso
        (3, xo + caja_w / 2, yo + caja_h, inicio["E2"] + 4),      # termina la obra → E2
        (4, xt + caja_w, yt + caja_h, inicio["E3"] + 4),          # UTE habilita → E3
    ]
    for n, x1, y1, x2 in disparos:
        p.append(f'<path d="M{x1} {y1} C{x1} {y1 + 30} {x2} {yb - 30} {x2} {yb - 1}" fill="none" '
                 f'stroke="{flecha}" stroke-width="1.3" stroke-dasharray="3 3" marker-end="url(#pgt-f)"/>')
        cy = y1 + 16 if n != 2 else y1 + 14
        cx = x1 + (x2 - x1) * 0.15
        p.append(f'<circle cx="{cx}" cy="{cy}" r="9" fill="{AZUL}"/>'
                 f'<text x="{cx}" y="{cy + 3.5}" font-family="Barlow, sans-serif" font-size="10.5" '
                 f'font-weight="700" fill="#ffffff" text-anchor="middle">{n}</text>')

    etiqueta = ("El recorrido en carriles por área: cada etapa en el carril de su dueña, el pase de trabajo "
                "entre áreas y los cuatro momentos que disparan los tramos de Experiencia Solar")
    return (f'  <figure style="margin: 20px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def quien_habla(filas):
    """La regla 1 dibujada: el cliente en el centro, unido solo al capataz y a
    Experiencia Solar (con de qué habla cada uno, del .md), y el resto de las
    áreas afuera, sin línea hacia el cliente."""
    W, H = 650, 176
    cx, cy = 325, 76
    verde, verde_claro = COLOR_AREA["Experiencia Solar"]
    p = []
    # Las áreas que no hablan con el cliente, en gris, abajo.
    otras = ["Ventas (después del onboarding)", "Ingeniería", "Gerente de Operaciones", "Logística", "Tramitación UTE"]
    ancho = W / len(otras)
    for i, o in enumerate(otras):
        x = i * ancho + 6
        p.append(f'<rect x="{x}" y="{H - 44}" width="{ancho - 12}" height="38" rx="6" fill="#f3f4f8" '
                 f'stroke="#d5d9e6" stroke-dasharray="4 3"/>')
        p.append(_txt(x + (ancho - 12) / 2, H - 21, o, 10, 600, GRIS, max_chars=18, salto=11, anchor="middle"))
    p.append(_txt(W / 2, H - 52, "NO HABLAN CON EL CLIENTE: LE PIDEN A UNO DE LOS DOS", 9.5, 700, GRIS_CLARO,
                  anchor="middle"))
    # El cliente.
    p.append(f'<circle cx="{cx}" cy="{cy - 30}" r="34" fill="{NEGRO}"/>')
    p.append(_txt(cx, cy - 26, "Cliente", 13, 700, "#ffffff", anchor="middle"))
    # Los dos que hablan con él.
    lados = [(0, filas[0]), (W - 210, filas[1])]
    for x, (quien, que) in lados:
        quien = quien.strip("*")
        y = cy - 70
        fuerte = COLOR_AREA["Operaciones"][0] if "capataz" in quien.lower() else verde
        claro = COLOR_AREA["Operaciones"][1] if "capataz" in quien.lower() else verde_claro
        p.append(f'<rect x="{x}" y="{y}" width="210" height="82" rx="8" fill="{claro}" stroke="{fuerte}" stroke-width="1.5"/>')
        p.append(_txt(x + 14, y + 24, quien, 14, 700, fuerte))
        p.append(_txt(x + 14, y + 44, en_linea(que), 11, 500, TEXTO, max_chars=34, salto=13))
        x_borde = x + 210 if x == 0 else x
        x_cli = cx - 34 if x == 0 else cx + 34
        p.append(f'<line x1="{x_borde}" y1="{cy - 30}" x2="{x_cli}" y2="{cy - 30}" stroke="{fuerte}" stroke-width="3"/>')
    etiqueta = "Solo el capataz y Experiencia Solar hablan con el cliente; el resto de las áreas no"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def partir_areas(crudos):
    """La tabla de las áreas se dibuja como tarjetas, y en vez de un bloque se
    arma uno por fila de tarjetas: así el corte de hoja puede caer entre filas."""
    out = []
    for t, c in crudos:
        if t == "tabla" and [x.strip().lower() for x in c[0]] == ["área", "qué hace", "dónde termina su trabajo"]:
            grupos, actual = [], []
            filas = c[1]
            for k, f in enumerate(filas):
                tiene_subs = k + 1 < len(filas) and filas[k + 1][0].startswith("↳")
                if f[0].startswith("↳"):
                    grupos[-1].append(f)
                    continue
                if tiene_subs:
                    if actual:
                        grupos.append(actual)
                    grupos.append([f])
                    actual = []
                    continue
                actual.append(f)
                if len(actual) == 2:
                    grupos.append(actual)
                    actual = []
            if actual:
                grupos.append(actual)
            for k, g in enumerate(grupos):
                out.append(("tarjetas", (g, k == 0)))
        else:
            out.append((t, c))
    return out


def tarjetas_areas(filas, primera=True):
    """La tabla de las áreas como tarjetas, una por área con su color. Las filas
    que empiezan con "↳" son sub-áreas y van como tarjetas chicas adentro de la
    anterior (Obra y Logística dentro de Operaciones)."""
    areas = []
    for nombre, hace, termina in filas:
        sub = nombre.startswith("↳")
        limpio = re.sub(r"[↳*]", "", nombre).strip()
        if sub:
            areas[-1]["subs"].append((limpio, hace, termina))
        else:
            areas.append({"nombre": limpio, "hace": hace, "termina": termina, "subs": []})

    def color(nombre):
        base = nombre.split("(")[0].strip()
        return COLOR_AREA.get(base, (NEGRO, "#eef0f5"))

    def cuerpo(nombre, hace, termina, fuerte, chica=False):
        tam = 13 if chica else 14
        titulo = 15 if chica else 17
        return (f'<div style="font-family: {SANS}; font-size: {titulo}px; font-weight: 700; color: {fuerte}">'
                f'{en_linea(nombre)}</div>'
                f'<p style="margin: 6px 0 0; font-size: {tam}px; line-height: 1.45; color: {TEXTO}">{en_linea(hace)}</p>'
                f'<div style="margin-top: 9px; padding-top: 8px; border-top: 1px solid {fuerte}33; display: flex; '
                f'gap: 6px; align-items: baseline">'
                f'<span style="font-family: {SANS}; font-size: 9.5px; font-weight: 700; letter-spacing: 1.2px; '
                f'color: {fuerte}; flex-shrink: 0">TERMINA</span>'
                f'<span style="font-size: {tam - 1}px; line-height: 1.4; color: {NEGRO}">{en_linea(termina)}</span></div>')

    margen = 18 if primera else 10
    out = f'  <div style="margin-top: {margen}px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">\n'
    for a in areas:
        fuerte, claro = color(a["nombre"])
        ancho = "grid-column: 1 / span 2; " if a["subs"] else ""
        out += (f'    <div style="{ancho}padding: 14px 16px; background: {claro}; border-radius: 8px; '
                f'border-top: 4px solid {fuerte}">')
        if a["subs"]:
            out += (f'<div style="display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px">'
                    f'<div>{cuerpo(a["nombre"], a["hace"], a["termina"], fuerte)}</div>')
            for n, h, t in a["subs"]:
                out += (f'<div style="padding: 10px 12px; background: #ffffff; border-radius: 6px">'
                        f'{cuerpo(n, h, t, fuerte, chica=True)}</div>')
            out += '</div>'
        else:
            out += cuerpo(a["nombre"], a["hace"], a["termina"], fuerte)
        out += '</div>\n'
    return out + '  </div>\n'


def proceso_ventas(pasos, tareas_onboarding):
    """Todo el proceso de Ventas en un dibujo: el embudo (de la consulta al
    cierre, con un escalón por paso del .md, cada vez más angosto), y a la
    derecha lo que pasa después del cierre: se crea el proyecto, el asesor hace
    el onboarding y, al completarlo, el proyecto pasa a Ingeniería y el cliente
    entra en E1 de Experiencia Solar."""
    W = 650
    azul, azul_claro = COLOR_AREA["Ventas"]
    violeta = COLOR_AREA["Ingeniería"][0]
    n = len(pasos)
    alto, sep = 44, 6
    y0 = 26
    ancho_max, ancho_min, x_centro = 380, 170, 196
    tonos = ["#3d56c2", "#2f4bb8", "#2440ad", "#1836b2", "#122a8f"]
    p = [f'<defs><marker id="pgt-v" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
         f'orient="auto"><path d="M0 0L10 5L0 10z" fill="{NEGRO}"/></marker></defs>']
    p.append(_txt(x_centro, 14, "100 CONSULTAS", 10, 700, GRIS, anchor="middle"))
    for k, titulo in enumerate(pasos):
        a1 = ancho_max - (ancho_max - ancho_min) * k / n
        a2 = ancho_max - (ancho_max - ancho_min) * (k + 1) / n
        y = y0 + k * (alto + sep)
        pts = (f"{x_centro - a1 / 2},{y} {x_centro + a1 / 2},{y} "
               f"{x_centro + a2 / 2},{y + alto} {x_centro - a2 / 2},{y + alto}")
        p.append(f'<polygon points="{pts}" fill="{tonos[k % len(tonos)]}"/>')
        p.append(f'<text x="{x_centro}" y="{y + alto / 2 + 5}" font-family="Barlow, sans-serif" font-size="14" '
                 f'font-weight="700" fill="#ffffff" text-anchor="middle">{k + 1} · {en_linea(titulo)}</text>')
    y_fin = y0 + n * (alto + sep)
    p.append(_txt(x_centro, y_fin + 12, "≈ 2 VENTAS", 10, 700, GRIS, anchor="middle"))

    # Después del cierre, a la derecha.
    x = 420
    w = W - x
    cajas = [
        ("LEAD GANADO", "Se crea el proyecto con todos los datos y archivos del lead", azul_claro, azul, NEGRO),
        # Sin la cantidad de tareas: cambia seguido y no aporta.
        ("ONBOARDING", "Lo hace el asesor: contrato, seña, modalidad de pago, consulta inicial a UTE…",
         azul, "#c9d1f3", "#ffffff"),
    ]
    alturas = [62, 86]
    y = y0
    centros = []
    for (rot, txt_, fondo, color_rot, color_txt), h in zip(cajas, alturas):
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fondo}"/>')
        p.append(_txt(x + 12, y + 18, rot, 10, 700, color_rot))
        p.append(_txt(x + 12, y + 35, txt_, 11.5, 500, color_txt, max_chars=36, salto=14))
        centros.append((y, h))
        y += h + 22
    (ya, ha), (yb, hb) = centros
    p.append(f'<line x1="{x + w / 2}" y1="{ya + ha}" x2="{x + w / 2}" y2="{yb - 2}" stroke="{NEGRO}" '
             f'stroke-width="1.4" marker-end="url(#pgt-v)"/>')
    # Al completar el onboarding, dos cosas a la vez: Ingeniería y E1.
    verde, verde_claro = COLOR_AREA["Experiencia Solar"]
    medio = (w - 8) / 2
    finales = [(x, "INGENIERÍA", "El proyecto pasa a la pre-ingeniería", COLOR_AREA["Ingeniería"][1], violeta),
               (x + medio + 8, "EXPERIENCIA SOLAR", "Arranca E1: el asesor le presentó a su referente",
                verde_claro, verde)]
    y_ab = yb + hb
    for xf, rot, txt_, fondo, color_rot in finales:
        p.append(f'<rect x="{xf}" y="{y}" width="{medio}" height="72" rx="8" fill="{fondo}"/>')
        p.append(_txt(xf + 10, y + 17, rot, 9.5, 700, color_rot))
        p.append(_txt(xf + 10, y + 33, txt_, 11, 500, NEGRO, max_chars=18, salto=13))
        p.append(f'<path d="M{x + w / 2} {y_ab} C{x + w / 2} {y_ab + 12} {xf + medio / 2} {y - 12} '
                 f'{xf + medio / 2} {y - 2}" fill="none" stroke="{NEGRO}" stroke-width="1.4" '
                 f'marker-end="url(#pgt-v)"/>')
    y += 72 + 22
    # Del final del embudo al lead ganado.
    yb = y0 + n * (alto + sep) - sep - alto / 2
    p.append(f'<path d="M{x_centro + ancho_min / 2 + 6} {yb} C{x - 30} {yb} {x - 40} {y0 + 31} {x - 2} {y0 + 31}" '
             f'fill="none" stroke="{NEGRO}" stroke-width="1.4" marker-end="url(#pgt-v)"/>')
    p.append(_txt(x - 60, yb - 8, "confirma", 10.5, 600, GRIS, anchor="middle"))
    H = max(y_fin + 20, y - 22 + 4)
    etiqueta = "El proceso de Ventas: el embudo de la consulta al cierre, y después el proyecto, el onboarding y el pase a Ingeniería"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def juntar_ventas(crudos):
    """En la sección de Ventas, el dibujo del proceso va antes de la lista del
    embudo (que queda como leyenda). Toma los pasos de esa lista (lo que está
    en negrita) y cuántas tareas tiene el onboarding."""
    i_emb = next((k for k, (t, c) in enumerate(crudos)
                  if t == "p" and c.startswith("**El embudo de ventas.**")), None)
    if i_emb is None or i_emb + 1 >= len(crudos) or crudos[i_emb + 1][0] != "numerada":
        return crudos
    pasos = [re.match(r"\*\*(.+?)\.?\*\*", x).group(1).rstrip(".") for x in crudos[i_emb + 1][1]]
    # Si la lista son solo los nombres de los pasos, es el dibujo y no se
    # repite como texto; si cada paso trae su explicación, queda como leyenda.
    solo_nombres = all(re.fullmatch(r"\*\*[^*]+\*\*", x.strip()) for x in crudos[i_emb + 1][1])
    i_onb = next((k for k, (t, c) in enumerate(crudos) if t == "p" and c.startswith("**El onboarding.**")), None)
    tareas = len(crudos[i_onb + 1][1]) if i_onb is not None and crudos[i_onb + 1][0] == "lista" else 0
    out = list(crudos)
    if solo_nombres:
        out[i_emb + 1] = ("ventas", (pasos, tareas))
    else:
        out.insert(i_emb + 1, ("ventas", (pasos, tareas)))
    return out


def trabajo_ingenieria(recibe, trabaja, entrega):
    """El trabajo de Ingeniería en un dibujo: qué recibe, con qué trabaja y qué
    entrega (lo que está en negrita en cada lista del .md), y abajo el camino
    de lo que entrega: Validación de Operaciones, Ingeniería Final y recién ahí
    Compras."""
    W = 650
    violeta, violeta_claro = COLOR_AREA["Ingeniería"]
    naranja, naranja_claro = COLOR_AREA["Operaciones"]
    col_w, gap = 196, 31
    cols = [("RECIBE", recibe, "#f3f4f8", GRIS), ("TRABAJA CON", trabaja, violeta_claro, violeta),
            ("ENTREGA", entrega, violeta, "#ffffff")]
    item_h, item_sep = 40, 6
    p = [f'<defs><marker id="pgt-i" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
         f'orient="auto"><path d="M0 0L10 5L0 10z" fill="{NEGRO}"/></marker></defs>']
    alto_col = 24 + max(len(c[1]) for c in cols) * (item_h + item_sep)
    for k, (rot, items, fondo, color) in enumerate(cols):
        x = k * (col_w + gap)
        p.append(f'<rect x="{x}" y="0" width="{col_w}" height="{alto_col}" rx="8" fill="{fondo}"/>')
        p.append(_txt(x + 12, 17, rot, 10, 700, color))
        for j, it in enumerate(items):
            y = 26 + j * (item_h + item_sep)
            claro = k == 2
            p.append(f'<rect x="{x + 8}" y="{y}" width="{col_w - 16}" height="{item_h}" rx="5" '
                     f'fill="{"#ffffff22" if claro else "#ffffff"}"/>')
            lineas = len(_renglones(it, 28))
            y_t = y + (24 if lineas == 1 else 17)
            p.append(_txt(x + 16, y_t, it, 11.5, 600, "#ffffff" if claro else NEGRO, max_chars=28, salto=14))
        if k < 2:
            xa = x + col_w + 3
            p.append(f'<line x1="{xa}" y1="{alto_col / 2}" x2="{xa + gap - 6}" y2="{alto_col / 2}" '
                     f'stroke="{NEGRO}" stroke-width="1.6" marker-end="url(#pgt-i)"/>')
    # De lo que entrega Ingeniería a la Validación de Operaciones.
    x_lista = 2 * (col_w + gap)
    y_m = alto_col
    # La pre-ingeniería no va a Compras: pasa por la Validación, vuelve a
    # Ingeniería para la Ingeniería Final y recién ahí llega a Compras.
    y_d = y_m + 40
    pasos = [("Validación de Operaciones", "el capataz la revisa", naranja_claro, naranja),
             ("Ingeniería Final", "ajustes del informe del capataz", violeta_claro, violeta),
             ("Compras", "compra sobre la lista final", naranja_claro, naranja)]
    ancho_p, sep_p = 196, 31
    for k, (t, d, fondo, color) in enumerate(pasos):
        x = k * (ancho_p + sep_p)
        p.append(f'<rect x="{x}" y="{y_d}" width="{ancho_p}" height="46" rx="6" fill="{fondo}" stroke="{color}"/>')
        p.append(_txt(x + 12, y_d + 19, t, 12, 700, color))
        p.append(_txt(x + 12, y_d + 35, d, 10.5, 500, NEGRO))
        if k < len(pasos) - 1:
            xa = x + ancho_p + 3
            p.append(f'<line x1="{xa}" y1="{y_d + 23}" x2="{xa + sep_p - 6}" y2="{y_d + 23}" stroke="{NEGRO}" '
                     f'stroke-width="1.4" marker-end="url(#pgt-i)"/>')
    p.append(f'<path d="M{x_lista + col_w / 2} {y_m} C{x_lista + col_w / 2} {y_m + 22} {ancho_p / 2} {y_d - 20} {ancho_p / 2} {y_d - 2}" '
             f'fill="none" stroke="{NEGRO}" stroke-width="1.4" marker-end="url(#pgt-i)"/>')
    H = y_d + 50
    etiqueta = "El trabajo de Ingeniería: qué recibe, con qué trabaja, qué entrega y a quién le llega la lista de materiales"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def juntar_ingenieria(crudos):
    """En la sección de Ingeniería, el dibujo va después de "Qué hace", armado con
    lo que está en negrita en las listas de qué recibe, con qué trabaja y qué
    entrega. Las listas quedan debajo, como detalle."""
    def lista_de(rotulo):
        k = next((i for i, (t, c) in enumerate(crudos) if t == "p" and c.startswith(rotulo)), None)
        if k is None or k + 1 >= len(crudos) or crudos[k + 1][0] != "lista":
            return None, None
        return k, [re.match(r"\*\*(.+?)\*\*", x).group(1) for x in crudos[k + 1][1]]
    k_r, recibe = lista_de("**Qué recibe.**")
    _, trabaja = lista_de("**Con qué trabaja.**")
    _, entrega = lista_de("**Qué entrega.**")
    if not (recibe and trabaja and entrega):
        return crudos
    out = list(crudos)
    out.insert(k_r, ("ingenieria", (recibe, trabaja, entrega)))
    return out


def camino_operaciones():
    """El camino de un proyecto por Operaciones: la Validación (el gerente
    agenda, el capataz revisa), la vuelta a Ingeniería Final, las Compras (con
    sus dos variantes) y la Obra, con lo que entrega cada paso. La fecha
    confirmada en la Validación le llega a Experiencia Solar."""
    W = 650
    naranja, naranja_claro = COLOR_AREA["Operaciones"]
    violeta, violeta_claro = COLOR_AREA["Ingeniería"]
    verde, verde_claro = COLOR_AREA["Experiencia Solar"]
    pasos = [
        ("VALIDACIÓN", ["El gerente agenda", "el capataz revisa"], "Fecha + informe", naranja, naranja_claro),
        ("INGENIERÍA FINAL", ["Ajusta según", "el informe"], "Lista final", violeta, violeta_claro),
        ("COMPRAS", ["Propio: todo en el local", "Tercerizado: kit y flete"], "Materiales listos", naranja, naranja_claro),
        ("OBRA", ["Instala con los", "materiales y la ingeniería"], "Obra terminada", naranja, naranja_claro),
    ]
    w, gap, h = 146, 22, 120
    p = [f'<defs><marker id="pgt-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
         f'orient="auto"><path d="M0 0L10 5L0 10z" fill="{NEGRO}"/></marker></defs>']
    for k, (rot, lineas, entrega, fuerte, claro) in enumerate(pasos):
        x = k * (w + gap)
        p.append(f'<rect x="{x}" y="0" width="{w}" height="{h}" rx="8" fill="{claro}"/>'
                 f'<rect x="{x}" y="0" width="{w}" height="4" rx="2" fill="{fuerte}"/>')
        p.append(_txt(x + 10, 22, rot, 10, 700, fuerte))
        for j, l in enumerate(lineas):
            p.append(_txt(x + 10, 44 + j * 15, l, 11, 500, NEGRO, max_chars=26))
        p.append(f'<rect x="{x + 8}" y="{h - 34}" width="{w - 16}" height="26" rx="5" fill="{fuerte}"/>')
        p.append(_txt(x + 16, h - 17, f"Entrega: {entrega}", 10.5, 700, "#ffffff"))
        if k < len(pasos) - 1:
            xa = x + w + 2
            p.append(f'<line x1="{xa}" y1="{h / 2}" x2="{xa + gap - 4}" y2="{h / 2}" stroke="{NEGRO}" '
                     f'stroke-width="1.5" marker-end="url(#pgt-o)"/>')
    # La fecha confirmada le llega a Experiencia Solar.
    y_es = h + 34
    p.append(f'<path d="M{w / 2} {h} V{y_es - 2}" stroke="{NEGRO}" stroke-width="1.3" stroke-dasharray="3 3" '
             f'marker-end="url(#pgt-o)"/>')
    p.append(f'<rect x="0" y="{y_es}" width="{3 * w + 2 * gap}" height="34" rx="6" fill="{verde_claro}" stroke="{verde}"/>')
    p.append(_txt(10, y_es + 21, "Experiencia Solar recibe la fecha confirmada y se la avisa al cliente", 11, 600, verde))
    H = y_es + 38
    etiqueta = "El camino por Operaciones: Validación, Ingeniería Final, Compras y Obra, con lo que entrega cada paso"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def hitos_ute(hitos):
    """Los pasos del trámite UTE como una línea de tiempo: en una fila si son
    pocos, en dos si son muchos."""
    W = 650
    verde_az, claro = COLOR_AREA["Tramitación UTE"]
    n = len(hitos)
    fila1 = n if n <= 6 else (n + 1) // 2
    paso = W / fila1
    p = []
    for k, h in enumerate(hitos):
        fila, i = (0, k) if k < fila1 else (1, k - fila1)
        cx = paso * i + paso / 2
        cy = 18 + fila * 82
        if i < (fila1 if fila == 0 else n - fila1) - 1:
            p.append(f'<line x1="{cx}" y1="{cy}" x2="{cx + paso}" y2="{cy}" stroke="{verde_az}" stroke-width="3"/>')
        final = k == n - 1
        p.append(f'<circle cx="{cx}" cy="{cy}" r="13" fill="{"#3d6b47" if final else verde_az}"/>')
        p.append(f'<text x="{cx}" y="{cy + 4}" font-family="Barlow, sans-serif" font-size="11" font-weight="700" '
                 f'fill="#ffffff" text-anchor="middle">{k + 1}</text>')
        p.append(_txt(cx, cy + 30, h, 10.5, 600, NEGRO, max_chars=14, salto=12, anchor="middle"))
    H = 18 + (82 if n > fila1 else 0) + 58
    etiqueta = "Los once hitos del trámite UTE, de la consulta enviada al trámite finalizado"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


def etapas_cliente(filas):
    """Las tres etapas que vive el cliente (E1/E2/E3) como tarjetas."""
    tonos = ["#3d6b47", "#5a8a63", "#6f9c77"]
    out = '  <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">\n'
    for k, (cod, nombre, desde, hasta, vive) in enumerate(filas):
        out += (f'    <div style="padding: 14px 14px 16px; background: {tonos[k % 3]}; border-radius: 8px">'
                f'<div style="font-family: {SANS}; font-size: 22px; font-weight: 700; color: #ffffff">{en_linea(cod.strip("*"))}</div>'
                f'<div style="font-family: {SANS}; font-size: 14px; font-weight: 700; color: #ffffff">{en_linea(nombre)}</div>'
                f'<div style="margin-top: 6px; font-family: {SANS}; font-size: 11px; line-height: 1.35; color: #e3f0e5">'
                f'{en_linea(desde)} → {en_linea(hasta)}</div>'
                f'<p style="margin: 10px 0 0; font-size: 13px; line-height: 1.45; color: #ffffff">{en_linea(vive)}</p></div>\n')
    return out + '  </div>\n'


def juntar_secciones(crudos):
    """Los dibujos de Operaciones, Tramitación UTE y Experiencia Solar."""
    out = []
    k = 0
    while k < len(crudos):
        t, c = crudos[k]
        if t == "p" and c.startswith("Operaciones tiene tres momentos en el recorrido"):
            out.append((t, c))
            out.append(("operaciones", None))
        elif t == "p" and c.startswith(("**Los hitos del trámite.**", "**Los pasos del trámite.**")) and k + 1 < len(crudos) \
                and crudos[k + 1][0] == "numerada":
            out.append((t, c))
            out.append(("hitos", [re.sub(r"\*", "", x) for x in crudos[k + 1][1]]))
            k += 1
        elif t == "tabla" and [x.strip().lower() for x in c[0]][:2] == ["", "etapa"] and len(c[0]) == 5:
            out.append(("etapas_cliente", c[1]))
        else:
            out.append((t, c))
        k += 1
    return out


def cliente_burbujas(items):
    """Capítulo 6: el cliente en el centro y, alrededor, una burbuja por cada
    cosa que todas las áreas tienen que saber de él (cada ítem de la lista del
    .md: el rótulo en negrita arriba, el resto debajo)."""
    W = 650
    lado_w, centro_w = 250, 150
    azul, azul_claro = COLOR_AREA["Ventas"]
    burbujas = []
    for it in items:
        m = re.match(r"\*\*(.+?)\*\*:?\s*(.*)", it)
        rot, resto = (m.group(1).rstrip(":"), m.group(2)) if m else ("", it)
        # "**Reclamos: respuesta el mismo día…**": el rótulo es lo de antes de
        # los dos puntos; lo demás pasa al texto de la burbuja.
        if ":" in rot:
            rot, extra = rot.split(":", 1)
            resto = f"{extra.strip()} {resto}".strip()
        if resto:
            resto = resto[0].upper() + resto[1:]
        resto = re.sub(r"\*\*", "", resto)
        lineas = _renglones(resto, 44)
        burbujas.append((rot, lineas, 34 + len(lineas) * 13))
    izq = burbujas[0::2]
    der = burbujas[1::2]
    gap = 12
    alto = max(sum(b[2] for b in lado) + gap * (len(lado) - 1) for lado in (izq, der))
    p = []
    cx, cy = W / 2, alto / 2
    # La persona.
    p.append(f'<circle cx="{cx}" cy="{cy - 34}" r="22" fill="{azul}"/>'
             f'<path d="M{cx - 40} {cy + 40} Q{cx - 40} {cy - 6} {cx} {cy - 6} Q{cx + 40} {cy - 6} {cx + 40} {cy + 40} Z" '
             f'fill="{azul}"/>')
    p.append(_txt(cx, cy + 62, "EL CLIENTE", 11, 700, azul, anchor="middle"))
    for lado, x in ((izq, 0), (der, W - lado_w)):
        y = (alto - (sum(b[2] for b in lado) + gap * (len(lado) - 1))) / 2
        for rot, lineas, h in lado:
            p.append(f'<rect x="{x}" y="{y}" width="{lado_w}" height="{h}" rx="20" fill="{azul_claro}"/>')
            xb = x + lado_w if x == 0 else x
            xp = cx - 44 if x == 0 else cx + 44
            p.append(f'<line x1="{xb}" y1="{y + h / 2}" x2="{xp}" y2="{cy}" stroke="#c9d1f3" stroke-width="2"/>')
            p.append(_txt(x + 16, y + 21, rot, 12, 700, azul))
            for j, l in enumerate(lineas):
                p.append(_txt(x + 16, y + 38 + j * 13, l, 10.5, 500, NEGRO))
            y += h + gap
    H = alto + 4
    etiqueta = "Lo que todas las áreas tienen que saber del cliente"
    return (f'  <figure style="margin: 18px 0 0">\n'
            f'    <svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{etiqueta}" '
            f'style="display: block; max-width: 100%; height: auto">{"".join(p)}</svg>\n'
            f'  </figure>\n')


# Las pantallas del capítulo 7, cada una con sus marcas: dónde está cada cosa,
# en porcentaje de la imagen. Se ubicaron mirando las capturas; si una
# pantalla cambia, hay que volver a sacarla (capturas.mjs) y revisar las
# posiciones. La clave es cómo empieza el párrafo del .md que la presenta.
PANTALLAS = {
    "**El proyecto.**": ("PROYECTO_PANTALLA", [
        (1, 9, 6.5, "El menú, con una sección por área"),
        (2, 12, 46, "La lista de clientes, para elegir con cuál trabajar"),
        (3, 59, 20.8, "Los botones que llevan al mismo cliente en otras secciones"),
        (4, 73.5, 15, "El plazo de la etapa en curso, en cuenta regresiva"),
        (5, 78, 72, "El recorrido del proyecto, etapa por etapa"),
    ]),
    "**La ficha del cliente.**": ("FICHA_ENCABEZADO", [
        (1, 93, 12, "Los datos del cliente y cuántos días hace que no se lo contacta"),
        (2, 58.5, 30.4, "Los botones que llevan al mismo cliente en otras secciones"),
        (3, 31, 36.5, "Sus tres etapas, con los pasos de cada una"),
        (4, 86, 60, "Para registrar un contacto; debajo, todo el historial"),
    ]),
    "**El calendario.**": ("CALENDARIO_OBRAS", [
        (1, 26, 9.8, "El mes, con flechas para ir y venir"),
        (2, 63, 14.6, "Qué mostrar: obras, mantenimientos, visitas…"),
        (3, 56.5, 21.2, "Rayado, fecha tentativa; lleno, fecha confirmada"),
        (4, 36, 59, "Cada obra agendada, del color de su equipo"),
        (5, 83, 13, "Para agendar una obra u otra cosa"),
    ]),
    "**El portal de Voltia.**": ("PORTAL_RECORTE", [
        (1, 59, 8.8, "Lo que el cliente puede abrir: proyectos, reportes, reclamos y encuestas"),
        (2, 49.5, 34.5, "En qué está su trámite"),
        (3, 26, 56, "Cada paso del trámite, con su fecha"),
    ]),
}


def pantalla_anotada(clave):
    """Una pantalla de Voltia PM con números sobre cada parte y, debajo, qué es
    cada número."""
    img, marcas_def = PANTALLAS[clave]
    marcas = "".join(
        f'<div style="position: absolute; left: {x}%; top: {y}%; transform: translate(-50%, -50%); width: 26px; '
        f'height: 26px; border-radius: 50%; background: {ROJO}; color: #ffffff; font-family: {SANS}; font-size: 13px; '
        f'font-weight: 700; line-height: 26px; text-align: center; box-shadow: 0 0 0 3px #ffffff">{n}</div>'
        for n, x, y, _ in marcas_def)
    leyenda = "".join(
        f'<div style="display: flex; gap: 10px; align-items: baseline; margin-top: 6px">'
        f'<span style="flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: {ROJO}; color: #ffffff; '
        f'font-family: {SANS}; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center">{n}</span>'
        f'<span style="font-size: 13.5px; line-height: 1.4; color: {TEXTO}">{t}</span></div>'
        for n, _, _, t in marcas_def)
    return (f'  <figure style="margin: 12px 0 0">\n'
            f'    <div style="position: relative; border: 1px solid {BORDE}; border-radius: 8px; overflow: hidden">'
            f'<img src="{getattr(IMG, img)}" alt="" style="display: block; width: 100%">{marcas}</div>\n'
            f'    <figcaption style="margin-top: 8px">{leyenda}</figcaption>\n'
            f'  </figure>\n')


def casos_tarjetas(casos):
    """Capítulo 8: cada caso en una tarjeta, el problema arriba y qué hacer
    debajo."""
    out = '  <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">\n'
    for titulo, cuerpo in casos:
        out += (f'    <div style="border-radius: 8px; overflow: hidden; border: 1px solid #f0dcb4; background: #fdf8ec">'
                f'<div style="padding: 11px 14px; background: #8a5a10; font-family: {SANS}; font-size: 14px; '
                f'font-weight: 700; color: #ffffff; display: flex; gap: 8px; align-items: center">'
                f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" '
                f'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M12 3l9 16H3z"></path>'
                f'<path d="M12 10v4M12 17h.01"></path></svg>{en_linea(titulo)}</div>'
                f'<p style="margin: 0; padding: 12px 14px 14px; font-size: 13.5px; line-height: 1.5; color: {TEXTO}; '
                f'background: #fdf8ec">{en_linea(cuerpo)}</p></div>\n')
    return out + '  </div>\n'


def juntar_cliente_pm_casos(crudos, num):
    """Los dibujos de los capítulos 6, 7 y 8."""
    out = []
    if num == 6:
        hecho = False
        for t, c in crudos:
            if t == "lista" and not hecho:
                out.append(("burbujas", c))
                hecho = True
            else:
                out.append((t, c))
        return out
    if num == 7:
        for t, c in crudos:
            out.append((t, c))
            if t == "p":
                clave = next((k for k in PANTALLAS if c.startswith(k)), None)
                if clave:
                    out.append(("pantalla", clave))
        return out
    if num == 8:
        casos = []
        for t, c in crudos:
            m = re.match(r"\*\*(.+?)\*\*\s*(.*)", c) if t == "p" else None
            if m:
                casos.append((m.group(1), m.group(2)))
            else:
                out.append((t, c))
        if casos:
            out.insert(0, ("casos", casos))
        return out
    return crudos


def juntar_recorrido(crudos):
    """Si el capítulo tiene la tabla de etapas (con su área dueña) y la de los
    tramos E1/E2/E3, las dos se dibujan juntas en el lugar de la de tramos: el
    dibujo necesita las dos para alinear cada tramo con sus etapas."""
    def es(c, cab):
        return [x.strip().lower() for x in c[0]] == cab
    i_et = next((k for k, (t, c) in enumerate(crudos) if t == "tabla" and
                 (es(c, ["", "etapa", "área dueña"]) or es(c, ["", "etapa", "área dueña", "plazo"]))), None)
    i_tr = next((k for k, (t, c) in enumerate(crudos) if t == "tabla" and es(c, ["", "tramo", "desde", "hasta"])), None)
    if i_et is None or i_tr is None:
        return crudos
    out = list(crudos)
    out[i_tr] = ("flujo", (crudos[i_et][1][1], crudos[i_tr][1][1]))
    del out[i_et]
    return out


def juntar_operaciones(crudos):
    """En el manual de Operaciones: la tabla de etapas (arranca / recibe /
    entrega / termina) se dibuja en tarjetas, y antes de la tabla de pasos va
    la línea de tiempo de los 12 días."""
    out = []
    for t, c in crudos:
        cab = [x.strip().lower() for x in c[0]] if t == "tabla" else []
        if cab == ["etapa", "arranca cuando", "recibe", "entrega", "termina cuando"]:
            # Las tres etapas juntas, en una sola hoja (pedido del 11-oct-2026).
            out.append(("etapas_io", (c[1], None)))
            continue
        if cab[:2] == ["paso", "responsable"]:
            # Al principio del capítulo, los pasos en bloques con su plazo
            # (pedido del 12-oct-2026); la línea de días va antes de la tabla.
            out.insert(0, ("vo_bloques_plazos", c[1]))
            out.append(("tiempo", None))
        out.append((t, c))
    return out


def bloques_plazos(filas):
    """Pedido del 12-oct-2026: al principio del capítulo 3, solo los tiempos,
    en números: un bloque por etapa con plazo, uno al lado del otro y con
    flechas, y al final la obra. No reemplaza a la línea de días, que va
    antes de la tabla. Los datos salen de la tabla del .md (Paso, Plazo,
    Vence)."""
    pasos = []
    for f in filas:
        nombre = f[0].partition("·")[2].strip()
        plazo = f[3].split(":")[0].strip()
        m = re.match(r"(\d+) (.+)", plazo)
        if m:
            pasos.append((nombre, m.group(1), m.group(2), f"Vence el {f[4].strip().lower()}", False))
        elif nombre == "Obra":
            m = re.search(r"\d+", f[4])
            pasos.append((nombre, m.group(0) if m else "", "desde el día hábil", "", True))
    n = len(pasos)
    ancho, hueco, h = ANCHO - 144, 30, 90
    w = (ancho - hueco * (n - 1)) / n
    s = [f'<svg viewBox="0 0 {ancho} {h + 32}" width="100%" role="img" '
         f'aria-label="Cuánto tarda cada etapa, de la Validación a la obra" style="display: block; margin-top: 16px">']
    for k, (nombre, num, unidad, nota, obra) in enumerate(pasos):
        x = k * (w + hueco)
        fondo = OP if obra else "#ffffff"
        c1, c2 = ("#ffffff", "#ffffff") if obra else (OP, NEGRO)
        s.append(f'<rect x="{x:.1f}" y="0" width="{w:.1f}" height="{h}" rx="12" fill="{fondo}" stroke="{OP}" '
                 f'stroke-width="2"/>')
        dos = len(_renglones(nombre, int((w - 12) / 6))) > 1
        s.append(_txt(x + w / 2, 15 if dos else 20, nombre, 11.5, 700, c2, anchor="middle",
                      max_chars=int((w - 12) / 6), salto=12))
        s.append(_txt(x + w / 2, 59, num, 32, 700, c1, anchor="middle"))
        s.append(_txt(x + w / 2, 72, unidad, 11, 700, c1, anchor="middle", max_chars=int((w - 14) / 5.8)))
        if nota:
            s.append(_txt(x + w / 2, 84, nota, 9.5, 600, GRIS, anchor="middle", max_chars=int((w - 14) / 4.8)))
        if k < n - 1:
            xa, xb = x + w + 4, x + w + hueco - 4
            s.append(f'<line x1="{xa:.1f}" y1="{h / 2}" x2="{xb - 8:.1f}" y2="{h / 2}" stroke="{OP}" stroke-width="3"/>'
                     f'<polygon points="{xb:.1f},{h / 2} {xb - 10:.1f},{h / 2 - 6} {xb - 10:.1f},{h / 2 + 6}" fill="{OP}"/>')
    total = sum(int(p[1]) for p in pasos if not p[4])
    x2 = (n - 1) * (w + hueco) - hueco / 2
    s.append(f'<path d="M2 {h + 6} v6 H{x2:.1f} v-6" fill="none" stroke="{NEGRO}" stroke-width="1.5"/>')
    s.append(_txt(x2 / 2, h + 28, f"{total} días hábiles como mínimo", 12, 700, NEGRO, anchor="middle"))
    s.append("</svg>")
    return "  " + "".join(s) + "\n"


def etapas_io(filas, solo=None):
    """Las etapas de Operaciones, de arriba abajo y en un solo bloque: una
    franja por etapa con cuándo arranca, qué recibe, qué entrega y cuándo
    termina, en cuatro columnas, y una flecha entre una y otra."""
    color, fondo = COLOR_AREA["Operaciones"]
    entre = {0: "Ingeniería Final (Ingeniería)"}
    rotulos = ["ARRANCA CUANDO", "RECIBE", "ENTREGA", "TERMINA CUANDO"]
    cab = "".join(f'<div style="font-family: {SANS}; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; '
                  f'color: {color}; padding: 0 9px">{r}</div>' for r in rotulos)
    html = (f'  <div style="margin-top: 14px">\n    <div style="display: grid; grid-template-columns: repeat(4, '
            f'minmax(0, 1fr)); gap: 5px; margin-bottom: 5px">{cab}</div>\n')
    for k, f in enumerate(filas):
        nombre, arranca, recibe, entrega, termina = (f + [""] * 5)[:5]
        celdas = "".join(f'<div style="padding: 7px 9px 8px; background: #ffffff; border-radius: 6px; font-size: 12.3px; '
                         f'line-height: 1.38; color: {TEXTO}">{en_linea(x)}</div>'
                         for x in (arranca, recibe, entrega, termina))
        html += (f'    <div style="border: 1.5px solid {color}; border-radius: 10px; overflow: hidden">\n'
                 f'      <div style="padding: 6px 12px; background: {color}; font-family: {SANS}; font-size: 15px; '
                 f'font-weight: 700; color: #ffffff">{en_linea(nombre)}</div>\n'
                 f'      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; '
                 f'padding: 6px; background: {fondo}">{celdas}</div>\n    </div>\n')
        if k < len(filas) - 1:
            medio = entre.get(k)
            rot = (f'<span style="font-family: {SANS}; font-size: 12px; font-weight: 600; color: {COLOR_AREA["Ingeniería"][0]}; '
                   f'padding: 1px 10px; border: 1px solid {COLOR_AREA["Ingeniería"][0]}; border-radius: 99px; '
                   f'background: {COLOR_AREA["Ingeniería"][1]}">pasa por {medio}</span>' if medio else "")
            html += (f'    <div style="display: flex; align-items: center; gap: 12px; height: 26px; padding-left: 40px">'
                     f'<svg width="14" height="26" viewBox="0 0 14 26"><line x1="7" y1="0" x2="7" y2="18" '
                     f'stroke="{color}" stroke-width="2"/><polygon points="1,16 13,16 7,25" fill="{color}"/></svg>'
                     f'{rot}</div>\n')
    return html + "  </div>\n"


def linea_tiempo():
    """Los 12 días hábiles entre la Validación y la obra, si el proyecto entra
    un lunes: tres semanas de cinco días y una fila por quien trabaja. A la
    izquierda, una columna "antes" con la pre-ingeniería, para que se vea que el
    proyecto llega de Ingeniería. En la Validación, primero se confirma la
    fecha de obra y después el capataz hace su informe (decidido el
    11-oct-2026); la fecha tentativa no es un paso obligatorio y no se dibuja."""
    izq, ancho, dias = 128, ANCHO - 144, 15
    col = (ancho - izq) / (dias + 1)
    X = lambda d: izq + (d + 1) * col  # el día d; la columna "antes" es la -1
    op, op_f = COLOR_AREA["Operaciones"]
    ing, ing_f = COLOR_AREA["Ingeniería"]
    es, es_f = COLOR_AREA["Experiencia Solar"]
    filas = [
        ("Gerente de Operaciones", [(1, 2, "Fecha confirmada", op, op_f)]),
        ("Capataz", [(3, 2, "Informe", op, op_f), (13, 2, "Obra", op, op)]),
        ("Ingeniería", [(-1, 2, "Pre-ingeniería", ing, ing_f), (5, 3, "Ingeniería Final", ing, ing_f)]),
        ("Experiencia Solar", [(3, 2, "Avisa al cliente", es, es_f)]),
        ("Logística", [(8, 5, "Compras: todo en el local", op, "#ffffff")]),
    ]
    y0, alto_f = 52, 42
    alto_total = y0 + len(filas) * alto_f + 44
    s = [f'<svg viewBox="0 0 {ancho} {alto_total}" width="100%" role="img" '
         f'aria-label="Los 12 días hábiles entre la Validación de Operaciones y la obra" '
         f'style="display: block; margin-top: 8px">']
    s.append(f'<rect x="{X(-1) + 1}" y="0" width="{col - 2}" height="22" rx="5" fill="{ing_f}"/>')
    s.append(_txt(X(-1) + col / 2, 15, "Antes", 11, 700, ing, anchor="middle"))
    for w in range(3):
        x = X(w * 5)
        s.append(f'<rect x="{x + 1}" y="0" width="{5 * col - 2}" height="22" rx="5" fill="#eef0f5"/>')
        s.append(_txt(x + 2.5 * col, 15, f"Semana {w + 1}", 12, 700, NEGRO, anchor="middle"))
        for d, letra in enumerate("LMMJV"):
            s.append(_txt(x + (d + .5) * col, 40, letra, 11, 600, GRIS_CLARO, anchor="middle"))
    for d in range(-1, dias + 1):
        x = X(d)
        s.append(f'<line x1="{x}" y1="46" x2="{x}" y2="{y0 + len(filas) * alto_f}" stroke="{BORDE}" '
                 f'stroke-width="{1.6 if d % 5 == 0 else .7}"/>')
    # Las flechas del recorrido, de un paso al que sigue: van debajo de las
    # barras, de una punta a la otra.
    pos = {}
    for i, (quien, barras) in enumerate(filas):
        y = y0 + i * alto_f
        for d, n, txt, borde, relleno in barras:
            x = X(d) + 2
            w = n * col - 4
            pos[txt] = (x, x + w, y + 7, y + alto_f - 7, y + alto_f / 2)
    def flecha(a, b):
        xa0, xa1, ta, ba, ya = pos[a]
        xb0, xb1, tb, bb, yb = pos[b]
        x = xa1 - 12
        y_ini = ba if yb > ya else ta
        return (f'<path d="M{x:.1f} {y_ini:.1f} V{yb:.1f} H{xb0 - 7:.1f}" fill="none" stroke="{GRIS}" '
                f'stroke-width="1.6"/><polygon points="{xb0:.1f},{yb:.1f} {xb0 - 8:.1f},{yb - 4.5:.1f} '
                f'{xb0 - 8:.1f},{yb + 4.5:.1f}" fill="{GRIS}"/>')
    for a, b in (("Pre-ingeniería", "Fecha confirmada"), ("Fecha confirmada", "Informe"),
                 ("Fecha confirmada", "Avisa al cliente"), ("Informe", "Ingeniería Final"),
                 ("Ingeniería Final", "Compras: todo en el local"), ("Compras: todo en el local", "Obra")):
        s.append(flecha(a, b))
    for i, (quien, barras) in enumerate(filas):
        y = y0 + i * alto_f
        s.append(_txt(0, y + 25, quien, 12, 600, NEGRO, max_chars=20, salto=13))
        for d, n, txt, borde, relleno in barras:
            x = X(d) + 2
            w = n * col - 4
            if txt == "Obra":
                # La obra arranca el día 13 y dura lo que dure: la barra sigue
                # hasta el borde y termina en punta, no en un día fijo.
                y1, y2, xp = y + 7, y + alto_f - 7, x + w + 2
                s.append(f'<path d="M{x + 6} {y1} H{xp - 14} L{xp} {(y1 + y2) / 2} L{xp - 14} {y2} H{x + 6} '
                         f'Q{x} {y2} {x} {y2 - 6} V{y1 + 6} Q{x} {y1} {x + 6} {y1} Z" fill="{relleno}"/>')
                s.append(_txt(x + w / 2 - 4, y2 + 14, "desde el día 13", 11, 700, borde, anchor="middle"))
                s.append(_txt(x + w / 2 - 6, (y1 + y2) / 2 + 5, "Obra", 13, 700, "#ffffff", anchor="middle"))
                continue
            s.append(f'<rect x="{x}" y="{y + 7}" width="{w}" height="{alto_f - 14}" rx="6" fill="{relleno}" '
                     f'stroke="{borde}" stroke-width="1.5"/>')
            tam = 11 if n < 3 else 12
            maxc = max(4, int((w - 8) / (tam * 0.52)))
            renglones = len(_renglones(txt, maxc))
            salto = 12
            y_txt = y + alto_f / 2 + 4 - (renglones - 1) * salto / 2
            s.append(_txt(x + w / 2, y_txt, txt, tam, 700, borde, max_chars=maxc, salto=salto, anchor="middle"))
    yb = y0 + len(filas) * alto_f + 14
    x1, x2 = X(1), X(13)
    s.append(f'<path d="M{x1} {yb} v8 H{x2} v-8" fill="none" stroke="{NEGRO}" stroke-width="1.5"/>')
    s.append(_txt((x1 + x2) / 2, yb + 28, "12 días hábiles como mínimo, de la Validación a la obra", 13, 700, NEGRO,
                  anchor="middle"))
    s.append("</svg>")
    return "  " + "".join(s) + "\n"


# ── Los dibujos del Manual de Operaciones ─────────────────────────────────────
#
# Pedido del 11-oct-2026: menos texto corrido y más gráficos. El texto sigue
# saliendo del .md, sin tocarlo: acá se reconocen pasajes (un párrafo que
# empieza con un rótulo en negrita, una lista con rótulos, los casos de "Cuando
# algo sale mal", frases puntuales) y se dibujan en tarjetas, esquemas y
# diagramas. Si el .md cambia una de esas frases, el pasaje vuelve a salir como
# texto: no se pierde nada, solo el dibujo.

OP, OP_F = COLOR_AREA["Operaciones"]
NARANJA_BORDE = "#efc9ad"
TINTE = "#fffaf6"
if MANUAL == "ventas":
    # Las mismas tarjetas, en el color de Ventas.
    OP, OP_F = COLOR_AREA["Ventas"]
    NARANJA_BORDE = "#c5cdef"
    TINTE = "#f6f8fe"

# Íconos de trazo, 24×24, para tarjetas y diagramas.
ICONOS = {
    "techo": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    "rayo": '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    "escudo": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    "wifi": '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    "reloj": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/>',
    "medidor": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M12 17l3-5"/><circle cx="12" cy="17" r="1"/>',
    "camara": '<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    "video": '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    "doc": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    "firma": '<path d="M6 3h8l4 4v14H6z"/><path d="M8 17c2-3 3 1 4-1s2-1 3 0"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "alerta": '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5h.01"/>',
    "calendario": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "camion": '<path d="M2 6h12v10H2z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    "caja": '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    "persona": '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    "equipo": '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c.5-3 3-5 6-5s5.5 2 6 5"/><path d="M14 15c3 0 5.5 2 6 5"/>',
    "llave": '<path d="M14 7a4 4 0 1 0-5 5L3 18v3h3l6-6a4 4 0 0 0 2-8z"/>',
    "lupa": '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
    "plata": '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v6M18 9v6"/>',
    "lluvia": '<path d="M7 15a5 5 0 1 1 2-9.6A6 6 0 0 1 20 9a4 4 0 0 1-2 6z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    "no": '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    "cruz": '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    "puerta": '<path d="M5 21V3h12v18"/><path d="M3 21h18"/><circle cx="14" cy="12" r="1"/>',
    "tierra": '<path d="M12 2v10"/><path d="M5 12h14M7 16h10M10 20h4"/>',
    "libro": '<path d="M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-6"/>',
    "mapa": '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
    "lista": '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    "engranaje": '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
}

# Qué ícono le toca a un rótulo, por la primera palabra clave que aparezca.
ICONO_DE = [
    ("techo", "techo"), ("altura", "techo"), ("eléctric", "rayo"), ("siempre", "escudo"),
    ("seguridad", "escudo"), ("protección", "escudo"), ("datalogger", "wifi"), ("180", "reloj"),
    ("reconexión", "reloj"), ("smartmeter", "medidor"), ("foto", "camara"), ("video", "video"),
    ("ensayo", "video"), ("firm", "firma"), ("document", "doc"), ("informe", "doc"),
    ("capacitación", "libro"), ("librillo", "libro"), ("manual", "libro"), ("lee", "libro"),
    ("entrega", "camion"), ("flete", "camion"), ("material", "caja"), ("stock", "caja"),
    ("estructura", "llave"), ("paneles", "caja"), ("compra", "caja"), ("import", "camion"),
    ("cliente", "persona"), ("capataz", "persona"), ("cuadrilla", "equipo"), ("tercerizad", "equipo"),
    ("gerente", "persona"), ("paga", "plata"), ("presupuesto", "plata"), ("costo", "plata"),
    ("calidad", "lupa"), ("plazo", "reloj"), ("cuándo", "calendario"), ("día", "calendario"),
    ("semana", "calendario"), ("mes", "calendario"), ("tres meses", "calendario"), ("planific", "calendario"),
    ("mantenimiento", "llave"), ("soporte", "alerta"), ("qué no es", "no"), ("qué es", "libro"),
    ("quién", "persona"), ("cómo", "engranaje"), ("dónde termina", "check"), ("dónde empieza", "mapa"),
    ("anota", "chat"), ("habla", "chat"), ("estudiar", "libro"), ("herramientas", "llave"),
    ("prepara", "caja"), ("revisa", "lupa"), ("tierra", "tierra"), ("montaje", "llave"),
    ("anclaje", "llave"), ("módulo", "caja"), ("isopanel", "techo"), ("teja", "techo"), ("chapa", "techo"),
    ("azotea", "techo"),
]


def icono(nombre, color, tam=18, grueso=2):
    return (f'<svg width="{tam}" height="{tam}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{grueso}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '
            f'style="flex-shrink: 0; display: block">{ICONOS[nombre]}</svg>')


def icono_para(texto, defecto="lista"):
    t = texto.lower()
    for clave, nombre in ICONO_DE:
        if clave in t:
            return nombre
    return defecto


def _sin_md(t):
    return re.sub(r"\*+", "", t)


def mayuscula(t):
    """El texto de un cuadro arranca con mayúscula aunque en el .md siga a un
    rótulo ('**La cuadrilla propia:** un capataz…'). Se saltean las negritas
    del principio; si arranca con un paréntesis, se deja como está."""
    i = 0
    while i < len(t) and t[i] == "*":
        i += 1
    if i < len(t) and t[i].islower():
        return t[:i] + t[i].upper() + t[i + 1:]
    return t


def partir_rotulo(texto):
    """'**Rótulo.** resto' → ('Rótulo', 'resto'). None si no empieza así."""
    m = re.match(r"^\*\*([^*]{2,70}?)([.:])?\*\*\s*(.*)$", texto.strip(), re.S)
    if not m:
        return None
    return m.group(1).strip().rstrip(".:"), mayuscula(m.group(3).strip().lstrip(":,;").strip())


def burbuja_icono(nombre, color, fondo, tam=34, icono_tam=18):
    return (f'<div style="flex-shrink: 0; width: {tam}px; height: {tam}px; border-radius: 9px; background: {fondo}; '
            f'display: flex; align-items: center; justify-content: center">{icono(nombre, color, icono_tam)}</div>')


# ── Tarjetas genéricas ────────────────────────────────────────────────────────

def tarjetas_rotulo(items, columnas=None):
    """Párrafos seguidos que arrancan con un rótulo en negrita ('**Qué es.**
    …'): una tarjeta por rótulo, con su ícono. En dos columnas si son cortos."""
    if columnas is None:
        columnas = 2 if all(len(t) <= 330 for _, t in items) and len(items) % 2 == 0 else 1
    cajas = ""
    for rot, txt in items:
        cajas += (f'<div style="display: flex; gap: 12px; padding: 13px 15px; border: 1px solid {BORDE}; '
                  f'border-radius: 10px; background: #ffffff">'
                  f'{burbuja_icono(icono_para(rot), OP, OP_F)}'
                  f'<div><div style="font-family: {SANS}; font-size: 15px; font-weight: 700; color: {NEGRO}; '
                  f'line-height: 1.25">{en_linea(rot)}</div>'
                  f'<div style="margin-top: 4px; font-size: 13.5px; line-height: 1.48; color: {TEXTO}">{en_linea(txt)}</div>'
                  f'</div></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: repeat({columnas}, minmax(0, 1fr)); '
            f'gap: 10px">{cajas}</div>\n')


def filas_rotulo(items):
    """Una lista cuyos ítems arrancan con un rótulo en negrita: cada ítem en una
    fila, el rótulo en una pastilla a la izquierda."""
    largo = max(len(_sin_md(r)) for r, _ in items)
    ancho = min(200, max(110, largo * 8))
    filas = ""
    for k, (rot, txt) in enumerate(items):
        filas += (f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 10px 0; '
                  f'{"" if k == 0 else f"border-top: 1px solid {BORDE};"}">'
                  f'<div style="flex-shrink: 0; width: {ancho}px; display: flex; gap: 8px; align-items: flex-start">'
                  f'{icono(icono_para(rot), OP, 17)}'
                  f'<span style="font-family: {SANS}; font-size: 14px; font-weight: 700; line-height: 1.25; '
                  f'color: {NEGRO}">{en_linea(rot)}</span></div>'
                  f'<div style="font-size: 14px; line-height: 1.48; color: {TEXTO}">{en_linea(txt)}</div></div>')
    return (f'  <div style="margin-top: 12px; padding: 4px 16px; border-left: 3px solid {OP}; '
            f'background: {TINTE}; border-radius: 0 10px 10px 0">{filas}</div>\n')


def tarjeta_lista(rotulo, items, marcas=None):
    """Un rótulo solo ('**En el techo** (…):') seguido de una lista: una
    tarjeta con encabezado de color y la lista adentro. Con marcas, cada ítem
    lleva el número que tiene en la captura de arriba."""
    lis, k = "", 0
    for idx, x in enumerate(items):
        m = marcas[idx] if marcas else None
        if m:
            k += 1
            vi = (f'<span style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: {ROJO}; '
                  f'color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700; line-height: 22px; '
                  f'text-align: center">{k}</span>')
        else:
            vi = (f'<span style="flex-shrink: 0; width: {22 if marcas else 6}px; display: flex; justify-content: center; '
                  f'margin-top: 8px"><span style="width: 6px; height: 6px; border-radius: 50%; background: {OP}"></span></span>')
        lis += (f'<div style="display: flex; gap: 10px; padding: 6px 0">{vi}<span style="font-size: 14px; '
                f'line-height: 1.48; color: {TEXTO}">{en_linea(mayuscula(x))}</span></div>')
    return (f'  <div style="margin-top: 14px; border: 1.5px solid {NARANJA_BORDE}; border-radius: 12px; overflow: hidden">'
            f'<div style="display: flex; gap: 10px; align-items: center; padding: 10px 16px; background: {OP_F}">'
            f'{icono(icono_para(rotulo), OP, 20)}<span style="font-family: {SANS}; font-size: 16px; font-weight: 700; '
            f'color: {NEGRO}">{en_linea(rotulo)}</span></div>'
            f'<div style="padding: 6px 16px 10px">{lis}</div></div>\n')


def baldosas(items):
    """Una lista de cosas cortas: baldosas numeradas en dos columnas."""
    cols = 3 if len(items) in (3, 6) and all(len(x) < 70 for x in items) else 2
    cajas = "".join(
        f'<div style="display: flex; gap: 10px; align-items: flex-start; padding: 12px 13px; background: {OP_F}; '
        f'border-radius: 10px"><div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; '
        f'background: {OP}; color: #ffffff; font-family: {SANS}; font-size: 13px; font-weight: 700; '
        f'text-align: center; line-height: 24px">{k}</div><div style="font-size: 13.5px; line-height: 1.42; '
        f'color: {NEGRO}">{en_linea(x)}</div></div>' for k, x in enumerate(items, 1))
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); '
            f'gap: 8px">{cajas}</div>\n')


def pasos_horizontales(items):
    """Una lista numerada corta: pasos en fila, con flechas."""
    n = len(items)
    cajas = ""
    for k, x in enumerate(items, 1):
        cajas += (f'<div style="flex: 1; min-width: 0; padding: 12px 12px 14px; border: 1.5px solid {NARANJA_BORDE}; '
                  f'border-radius: 10px; background: #ffffff"><div style="font-family: {SANS}; font-size: 24px; '
                  f'font-weight: 700; color: {OP}; line-height: 1">{k}</div><div style="margin-top: 6px; '
                  f'font-size: 13px; line-height: 1.42; color: {NEGRO}">{en_linea(x)}</div></div>')
        if k < n:
            cajas += (f'<div style="flex-shrink: 0; align-self: center; width: 14px">'
                      f'<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><polygon points="0,0 14,8 0,16" '
                      f'fill="{OP}"/></svg></div>')
    return f'  <div style="margin-top: 14px; display: flex; gap: 6px">{cajas}</div>\n'


def caso(titulo, bloques):
    """Un caso de 'Cuando algo sale mal': el problema en la franja de arriba y
    qué hacer debajo."""
    cuerpo = ""
    for t, c in bloques:
        if t == "p":
            cuerpo += f'<p style="margin: 6px 0 0; font-size: 13.8px; line-height: 1.5; color: {TEXTO}">{en_linea(c)}</p>'
        elif t in ("lista", "numerada"):
            cuerpo += "".join(f'<div style="display: flex; gap: 9px; margin-top: 6px"><span style="flex-shrink: 0; '
                              f'width: 6px; height: 6px; border-radius: 50%; background: #8a5a10; margin-top: 8px"></span>'
                              f'<span style="font-size: 13.8px; line-height: 1.48; color: {TEXTO}">{en_linea(x)}</span></div>'
                              for x in c)
        elif t == "cita":
            cuerpo += (f'<p style="margin: 8px 0 0; font-size: 13.8px; line-height: 1.5; color: {NEGRO}; '
                       f'font-weight: 600">{en_linea(" ".join(c))}</p>')
    return (f'  <div style="margin-top: 12px; border-radius: 10px; overflow: hidden; border: 1px solid #f0dcb4">'
            f'<div style="padding: 10px 14px; background: #8a5a10; display: flex; gap: 9px; align-items: center">'
            f'{icono(icono_para(titulo, "alerta"), "#ffffff", 17)}<span style="font-family: {SANS}; font-size: 15px; '
            f'font-weight: 700; color: #ffffff">{en_linea(titulo)}</span></div>'
            f'<div style="padding: 6px 14px 13px; background: #fdf8ec">{cuerpo}</div></div>\n')


def causa_efecto(cab, filas):
    """Tabla 'Si falla… | Lo que le pasa': cada fila, causa → consecuencia."""
    out = ""
    for f in filas:
        causa, efecto = f[0], f[1]
        area = causa.split(":")[0].strip()
        color, fondo = COLOR_AREA.get(area, (GRIS, "#f3f4f8"))
        resto = causa.split(":", 1)[1].strip() if ":" in causa else causa
        out += (f'<div style="display: grid; grid-template-columns: 1fr 26px 1fr; gap: 8px; align-items: stretch; '
                f'margin-top: 8px"><div style="padding: 9px 12px; border-radius: 8px; background: {fondo}; '
                f'border-left: 4px solid {color}"><div style="font-family: {SANS}; font-size: 11px; font-weight: 700; '
                f'letter-spacing: 1.2px; color: {color}">{en_linea(area).upper()}</div><div style="margin-top: 2px; '
                f'font-size: 13.5px; line-height: 1.4; color: {NEGRO}">{en_linea(resto)}</div></div>'
                f'<div style="align-self: center"><svg width="26" height="16" '
                f'viewBox="0 0 26 16" aria-hidden="true"><line x1="0" y1="8" x2="18" y2="8" stroke="{ROJO}" '
                f'stroke-width="2.5"/><polygon points="16,1 26,8 16,15" fill="{ROJO}"/></svg></div>'
                f'<div style="padding: 9px 12px; border-radius: 8px; background: {ROJO_FONDO}; display: flex; '
                f'align-items: center; font-size: 13.5px; line-height: 1.4; font-weight: 600; color: {ROJO}">'
                f'{en_linea(efecto)}</div></div>')
    return f'  <div style="margin-top: 12px">{out}</div>\n'


def preguntas(filas):
    """Tabla 'Necesita saber… | Le pregunta a…': la duda y a quién."""
    out = ""
    for f in filas:
        out += (f'<div style="display: flex; gap: 12px; align-items: center; padding: 9px 0; border-bottom: 1px solid {BORDE}">'
                f'{icono("chat", OP, 18)}<div style="flex: 1; font-size: 14px; line-height: 1.4; color: {TEXTO}">'
                f'{en_linea(f[0])}</div><div style="flex-shrink: 0; padding: 4px 12px; border-radius: 99px; '
                f'background: {OP_F}; font-family: {SANS}; font-size: 13px; font-weight: 700; color: {OP}; '
                f'max-width: 260px">{en_linea(f[1])}</div></div>')
    return f'  <div style="margin-top: 12px">{out}</div>\n'


def areas_tarjetas(filas):
    """Tabla 'Área | Qué hace | Qué le importa a Operaciones': una tarjeta por
    área, con su color."""
    cajas = ""
    for f in filas:
        area, hace, importa = (f + ["", "", ""])[:3]
        color, fondo = COLOR_AREA.get(_sin_md(area), (GRIS, "#f3f4f8"))
        cajas += (f'<div style="border-radius: 10px; overflow: hidden; border: 1px solid {fondo}">'
                  f'<div style="padding: 8px 13px; background: {color}; font-family: {SANS}; font-size: 14.5px; '
                  f'font-weight: 700; color: #ffffff">{en_linea(area)}<span style="font-weight: 500; opacity: .85"> · '
                  f'{en_linea(hace)}</span></div><div style="padding: 9px 13px 11px; background: {fondo}; '
                  f'font-size: 13.5px; line-height: 1.45; color: {NEGRO}">{en_linea(importa)}</div></div>')
    return f'  <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px">{cajas}</div>\n'


# ── Diagramas propios ─────────────────────────────────────────────────────────

def _svg(ancho, alto, etiqueta, cuerpo, margen=14):
    return (f'  <svg viewBox="0 0 {ancho} {alto}" width="100%" role="img" aria-label="{etiqueta}" '
            f'style="display: block; margin-top: {margen}px">{cuerpo}</svg>\n')


def _caja(x, y, w, h, fondo, borde, rx=10, grueso=1.5, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fondo}" stroke="{borde}" stroke-width="{grueso}" {extra}/>'


def _flecha(x1, y1, x2, y2, color, grueso=2):
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2 - 9 * math.cos(a) + 5 * math.sin(a), y2 - 9 * math.sin(a) - 5 * math.cos(a))
    p2 = (x2 - 9 * math.cos(a) - 5 * math.sin(a), y2 - 9 * math.sin(a) + 5 * math.cos(a))
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2 - 7 * math.cos(a):.1f}" y2="{y2 - 7 * math.sin(a):.1f}" '
            f'stroke="{color}" stroke-width="{grueso}"/>'
            f'<polygon points="{x2},{y2} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="{color}"/>')


def _icono_svg(nombre, x, y, color, tam=22):
    return (f'<g transform="translate({x},{y}) scale({tam / 24})" fill="none" stroke="{color}" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONOS[nombre]}</g>')


def centro_cadena():
    """Operaciones en el centro: las otras áreas alrededor, cada una con lo que
    le aporta (o le pide) a la obra."""
    W, H = 650, 330
    cx, cy = W / 2, 160
    s = []
    alrededor = [
        ("Ventas", "vende la instalación", 95, 60),
        ("Ingeniería", "la diseña", 555, 60),
        ("Logística", "compra lo que lleva", 95, 260),
        ("Tramitación UTE", "la habilita", 555, 260),
        ("Experiencia Solar", "acompaña al cliente", 325, 295),
    ]
    for area, que, x, y in alrededor:
        base = "Operaciones" if area == "Logística" else area
        color, fondo = COLOR_AREA[base]
        s.append(f'<line x1="{cx}" y1="{cy}" x2="{x}" y2="{y}" stroke="{color}" stroke-width="2" stroke-dasharray="5 4"/>')
    s.append(f'<circle cx="{cx}" cy="{cy}" r="78" fill="{OP}"/>')
    s.append(_icono_svg("llave", cx - 14, cy - 52, "#ffffff", 28))
    s.append(_txt(cx, cy + 4, "Operaciones", 19, 700, "#ffffff", anchor="middle"))
    s.append(_txt(cx, cy + 26, "la obra", 14, 600, "#ffe2cc", anchor="middle"))
    for area, que, x, y in alrededor:
        base = "Operaciones" if area == "Logística" else area
        color, fondo = COLOR_AREA[base]
        w = 168
        s.append(_caja(x - w / 2, y - 26, w, 52, fondo, color))
        s.append(_txt(x, y - 4, area, 14, 700, color, anchor="middle"))
        s.append(_txt(x, y + 15, que, 12.5, 500, NEGRO, anchor="middle"))
    return _svg(W, H, "Operaciones en el centro de la cadena: las demás áreas giran alrededor de la obra", "".join(s))


def requisitos_fecha(texto):
    """Lo que tiene que estar para confirmar una fecha de obra: cuatro casillas
    y la fecha confirmada recién cuando están todas."""
    reqs = [("doc", "La respuesta de UTE a la consulta inicial"),
            ("check", "La ingeniería hecha y validada por Operaciones"),
            ("calendario", "La fecha en el calendario"),
            ("plata", "La seña cobrada (pago directo) o el crédito aprobado (financiación del banco)")]
    W, H = 650, 248
    s = []
    for k, (ic, t) in enumerate(reqs):
        y = 6 + k * 58
        s.append(_caja(0, y, 380, 48, "#ffffff", BORDE, rx=9))
        s.append(f'<rect x="12" y="{y + 12}" width="24" height="24" rx="5" fill="{VERDE_FONDO}" stroke="{VERDE}" stroke-width="1.5"/>')
        s.append(_icono_svg("check", 15, y + 15, VERDE, 18))
        s.append(_txt(48, y + 21 if len(t) > 46 else y + 29, t, 13.5, 600, NEGRO, max_chars=46, salto=15))
        s.append(f'<path d="M380 {y + 24} H420 V122 H446" fill="none" stroke="{GRIS_CLARO}" stroke-width="1.5"/>')
    s.append(_flecha(420, 122, 458, 122, OP, 2.5))
    s.append(_caja(462, 72, 188, 100, OP, OP, rx=12))
    s.append(_icono_svg("calendario", 543, 84, "#ffffff", 26))
    s.append(_txt(556, 132, "Fecha de obra", 16, 700, "#ffffff", anchor="middle"))
    s.append(_txt(556, 152, "confirmada", 16, 700, "#ffffff", anchor="middle"))
    s.append(_txt(556, 200, "Si falta una, la fecha", 13, 700, ROJO, anchor="middle"))
    s.append(_txt(556, 217, "no se confirma.", 13, 700, ROJO, anchor="middle"))
    return _svg(W, H, "Para confirmar una fecha de obra tienen que estar las cuatro cosas", "".join(s))


def comparar_visitas(a, b):
    """Mantenimiento y soporte, lado a lado: qué los dispara y qué deja cada uno."""
    def col(rot, txt, items, ic, color, fondo):
        disparo = re.search(r"\*\*(Lo dispara[^*]+)\*\*", txt)
        resto = re.sub(r"\*\*Lo dispara[^*]+\*\*\s*", "", txt)
        filas = "".join(
            f'<div style="padding: 7px 0; border-top: 1px solid {BORDE}; font-size: 13px; line-height: 1.42; '
            f'color: {TEXTO}">{en_linea(x)}</div>' for x in items)
        return (f'<div style="border: 1.5px solid {color}; border-radius: 12px; overflow: hidden; background: #ffffff">'
                f'<div style="padding: 10px 14px; background: {color}; display: flex; gap: 10px; align-items: center">'
                f'{icono(ic, "#ffffff", 20)}<span style="font-family: {SANS}; font-size: 17px; font-weight: 700; '
                f'color: #ffffff">{en_linea(rot)}</span></div>'
                + (f'<div style="padding: 9px 14px; background: {fondo}; font-family: {SANS}; font-size: 15px; '
                   f'font-weight: 700; color: {color}">{en_linea(disparo.group(1))}</div>' if disparo else "")
                + f'<div style="padding: 8px 14px 4px; font-size: 13px; line-height: 1.48; color: {TEXTO}">'
                f'{en_linea(resto)}</div><div style="padding: 0 14px 8px">{filas}</div></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px">'
            f'{col(a[0], a[1], a[2], "calendario", VERDE, VERDE_FONDO)}'
            f'{col(b[0], b[1], b[2], "alerta", ROJO, ROJO_FONDO)}</div>\n')


def dos_fechas(items):
    """La fecha tentativa (con rayas) y la confirmada (sólida), como se ven en el
    calendario."""
    def chip(rayada):
        if rayada:
            return (f'<div style="height: 30px; border-radius: 6px; border: 1.5px dashed {OP}; background: '
                    f'repeating-linear-gradient(135deg, {OP_F} 0 7px, #f4c9a8 7px 14px)"></div>')
        return f'<div style="height: 30px; border-radius: 6px; background: {OP}"></div>'
    def caja(k, x):
        nombre = _sin_md(x.split(":")[0]).strip()
        resto = mayuscula(x.split(":", 1)[1].strip()) if ":" in x else ""
        return (f'<div style="padding: 12px 14px; border: 1px solid {BORDE}; border-radius: 12px; background: #ffffff">'
                f'{chip(k == 0)}<div style="margin-top: 9px; font-family: {SANS}; font-size: 16px; font-weight: 700; '
                f'color: {NEGRO}">{en_linea(nombre)}</div><div style="margin-top: 4px; font-size: 13.3px; '
                f'line-height: 1.48; color: {TEXTO}">{en_linea(resto)}</div></div>')
    flecha = (f'<div style="align-self: center"><svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true">'
              f'<line x1="0" y1="9" x2="21" y2="9" stroke="{OP}" stroke-width="2.5"/><polygon points="19,2 30,9 19,16" '
              f'fill="{OP}"/></svg></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 30px 1fr; gap: 8px">'
            f'{caja(0, items[0])}{flecha}{caja(1, items[1])}</div>\n')


def decision_cuadrilla(items):
    """A quién le toca la obra: la cuadrilla propia o la tercerizada de la zona."""
    propia = [x for x in items if "cuadrilla propia" in x and "grandes" in x.lower()]
    resto = [x for x in items if x not in propia and "depende" not in x]
    final = [x for x in items if "depende" in x]
    def caja(titulo, sub, cosas, color, fondo, ic):
        lis = "".join(f'<div style="display: flex; gap: 9px; padding: 6px 0; border-top: 1px solid {fondo}">'
                      f'{icono("check", color, 15)}<span style="font-size: 13.5px; line-height: 1.45; color: {NEGRO}">'
                      f'{en_linea(c)}</span></div>' for c in cosas)
        return (f'<div style="border: 1.5px solid {color}; border-radius: 12px; overflow: hidden">'
                f'<div style="padding: 10px 14px; background: {color}; display: flex; gap: 10px; align-items: center">'
                f'{icono(ic, "#ffffff", 20)}<div><div style="font-family: {SANS}; font-size: 16px; font-weight: 700; '
                f'color: #ffffff">{titulo}</div><div style="font-size: 12px; color: #ffffffcc">{sub}</div></div></div>'
                f'<div style="padding: 4px 14px 8px; background: #ffffff">{lis}</div></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px">'
            f'{caja("Cuadrilla propia", "un capataz y sus peones", propia, OP, OP_F, "equipo")}'
            f'{caja("Tercerizada de la zona", "una empresa instaladora por zona", resto, "#5b6278", "#eef0f5", "mapa")}'
            f'</div>\n'
            + (f'  <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center; padding: 10px 14px; '
               f'background: {AZUL_FONDO}; border-radius: 10px">{icono("calendario", AZUL, 18)}<span style="font-size: '
               f'14px; line-height: 1.45; color: {NEGRO}">{en_linea(final[0])}</span></div>\n' if final else ""))


def pago_50_50():
    """El pago al tercerizado: la mitad al arrancar, la mitad al terminar."""
    W, H = 650, 104
    s = [_caja(0, 22, 323, 36, OP, OP, rx=8), _caja(327, 22, 323, 36, "#f4c9a8", "#f4c9a8", rx=8),
         _txt(161, 46, "50 % al arrancar la obra", 15, 700, "#ffffff", anchor="middle"),
         _txt(488, 46, "50 % al terminarla", 15, 700, OP, anchor="middle"),
         _txt(0, 14, "EL PAGO AL INSTALADOR TERCERIZADO", 11, 700, GRIS_CLARO),
         _txt(0, 80, "La orden la da Administración y Finanzas o el CEO, con la Ejecución de obra terminada "
              "en Voltia PM.", 12.5, 500, TEXTO, max_chars=95, salto=16)]
    return _svg(W, H, "El pago al tercerizado: la mitad al arrancar y la mitad al terminar", "".join(s))


def escalera_aprobacion(items):
    """Quién aprueba una compra, de menos a más: tres escalones."""
    esc = [("En la lista de materiales de Ingeniería", "Sin aprobación", "La compra el encargado de compras", VERDE, VERDE_FONDO),
           ("Fuera de la lista, hasta USD 200 cada gasto", "Gerente de Operaciones",
            "Sin tope total. Cada gasto, en Finanzas con la obra y el motivo, y rendido en la reunión con el CEO", OP, OP_F),
           ("Fuera de la lista, más de USD 200", "Finanzas o el CEO", "", ROJO, ROJO_FONDO)]
    W, H = 650, 232
    s = []
    for k, (que, quien, nota, color, fondo) in enumerate(esc):
        x, y = k * 64, 164 - k * 74
        w = W - x
        s.append(_caja(x, y, w, 66, fondo, color, rx=9))
        s.append(_txt(x + 14, y + 22, que, 13.5, 700, NEGRO))
        s.append(_txt(x + 14, y + 42, nota, 11.8, 500, TEXTO, max_chars=int((w - 210) / 6.2), salto=13) if nota else "")
        s.append(f'<rect x="{W - 196}" y="{y + 19}" width="184" height="28" rx="14" fill="{color}"/>')
        s.append(_txt(W - 104, y + 38, quien, 13, 700, "#ffffff", anchor="middle"))
    return _svg(W, H, "Quién aprueba una compra, según si está en la lista y cuánto sale", "".join(s))


def estados_informe():
    """Los estados del informe del capataz: el camino normal y el bloqueo."""
    W, H = 650, 150
    s = []
    est = [("Pendiente", 10, "#eef0f5", GRIS), ("En progreso", 175, OP_F, OP), ("Completado", 470, VERDE_FONDO, VERDE)]
    for nombre, x, fondo, color in est:
        s.append(_caja(x, 20, 160 if nombre != "Completado" else 170, 44, fondo, color, rx=22))
        s.append(_txt(x + (80 if nombre != "Completado" else 85), 47, nombre, 15, 700, color, anchor="middle"))
    s.append(_flecha(170, 42, 175, 42, GRIS))
    s.append(_flecha(335, 42, 466, 42, OP, 2.5))
    s.append(_txt(400, 34, "el proyecto avanza", 11.5, 600, OP, anchor="middle"))
    s.append(_caja(270, 100, 170, 40, ROJO_FONDO, ROJO, rx=20))
    s.append(_txt(355, 125, "Bloqueado", 15, 700, ROJO, anchor="middle"))
    s.append(f'<path d="M255 64 Q255 120 268 120" fill="none" stroke="{ROJO}" stroke-width="1.8" stroke-dasharray="4 3"/>')
    s.append(_txt(448, 114, "falta algo del relevamiento:", 11.5, 600, ROJO))
    s.append(_txt(448, 129, "avisa a quien hizo la visita", 11.5, 500, TEXTO))
    s.append(_txt(448, 143, "y al gerente de Operaciones", 11.5, 500, TEXTO))
    return _svg(W, H, "Los estados del informe del capataz", "".join(s))


def cadena_seguridad(filas):
    """Quién responde por la seguridad: una cadena de cuatro eslabones, de
    abajo (el operario) hacia arriba (Gerencia)."""
    out = ""
    n = len(filas)
    for k, f in enumerate(reversed(filas)):
        quien, que = f[0], f[1]
        margen = (n - 1 - k) * 0
        ancho = 62 + k * 0
        out += (f'<div style="display: flex; gap: 12px; align-items: center; margin-top: {0 if k == 0 else 6}px">'
                f'<div style="flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; background: '
                f'{OP if k == n - 1 else "#ffffff"}; border: 2px solid {OP}; color: {"#ffffff" if k == n - 1 else OP}; '
                f'font-family: {SANS}; font-size: 15px; font-weight: 700; text-align: center; line-height: 30px">'
                f'{n - k}</div><div style="flex: 1; padding: 9px 13px; border-radius: 9px; background: '
                f'{OP_F if k == n - 1 else TINTE}; border: 1px solid {NARANJA_BORDE}"><span style="font-family: '
                f'{SANS}; font-size: 14.5px; font-weight: 700; color: {NEGRO}">{en_linea(quien)}</span>'
                f'<span style="font-size: 13.5px; color: {TEXTO}"> · {en_linea(que)}</span></div></div>')
        if k < n - 1:
            out += (f'<div style="margin-left: 16px; height: 10px; border-left: 2px solid {OP}"></div>')
    return (f'  <div style="margin-top: 14px">{out}<div style="margin-top: 8px; font-family: {SANS}; font-size: 12px; '
            f'color: {GRIS}">De abajo hacia arriba: cada uno responde por lo suyo y por el que tiene a cargo.</div></div>\n')


def matriz_sancion(items):
    """Si se encuentra a alguien sin las medidas de seguridad: quién lo
    encuentra y a quién se sanciona."""
    roles = ["Operario", "Capataz", "Gerente de Operaciones"]
    filas = [("El capataz", ["corrige", "", ""]),
             ("El gerente de Operaciones", ["s", "s", ""]),
             ("El CEO", ["s", "s", "s"])]
    th = "".join(f'<th style="padding: 8px 6px; font-family: {SANS}; font-size: 11.5px; font-weight: 700; '
                 f'letter-spacing: .8px; color: {GRIS}; text-align: center">{r.upper()}</th>' for r in roles)
    trs = ""
    for quien, marcas in filas:
        tds = ""
        for m in marcas:
            if m == "s":
                c = (f'<span style="display: inline-block; padding: 4px 10px; border-radius: 99px; background: {ROJO}; '
                     f'color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700">sanción</span>')
            elif m:
                c = (f'<span style="display: inline-block; padding: 4px 10px; border-radius: 99px; background: {OP_F}; '
                     f'color: {OP}; font-family: {SANS}; font-size: 12px; font-weight: 700">lo corrige en el momento</span>')
            else:
                c = f'<span style="color: {GRIS_CLARO}">—</span>'
            tds += f'<td style="padding: 10px 6px; text-align: center; border-top: 1px solid {BORDE}">{c}</td>'
        trs += (f'<tr><td style="padding: 10px 6px 10px 0; border-top: 1px solid {BORDE}; font-family: {SANS}; '
                f'font-size: 14px; font-weight: 700; color: {NEGRO}">Si lo encuentra {en_linea(quien[0].lower() + quien[1:])}</td>{tds}</tr>')
    return (f'  <table style="width: 100%; border-collapse: collapse; margin-top: 14px"><thead><tr>'
            f'<th style="text-align: left; padding: 8px 6px 8px 0; font-family: {SANS}; font-size: 11.5px; '
            f'font-weight: 700; letter-spacing: .8px; color: {GRIS}">QUIÉN LO ENCUENTRA</th>{th}</tr></thead>'
            f'<tbody>{trs}</tbody></table>\n')


def panel_montaje():
    """El montaje: la zona segura del panel donde van las grampas (nunca en la
    punta) y el panel a 25° mirando al norte. La zona es un criterio de diseño
    de Ingeniería, no una medida fija: el dibujo no lleva cotas."""
    W, H = 650, 250
    s = []
    px, py, pw, ph = 40, 20, 120, 210
    zona = 0.16
    s.append(_caja(px, py, pw, ph, "#1b2a5c", NEGRO, rx=3))
    for i in range(1, 6):
        s.append(f'<line x1="{px}" y1="{py + i * ph / 6}" x2="{px + pw}" y2="{py + i * ph / 6}" stroke="#3a4f94" stroke-width="1"/>')
    s.append(f'<line x1="{px + pw / 2}" y1="{py}" x2="{px + pw / 2}" y2="{py + ph}" stroke="#3a4f94" stroke-width="1"/>')
    for y0 in (py + ph * zona, py + ph * (1 - zona) - ph * 0.12):
        for x0 in (px - 9, px + pw - 3):
            s.append(f'<rect x="{x0}" y="{y0}" width="12" height="{ph * 0.12}" rx="3" fill="{VERDE}" opacity=".85"/>')
    for y0 in (py, py + ph - 14):
        for x0 in (px - 9, px + pw - 3):
            s.append(f'<rect x="{x0}" y="{y0}" width="12" height="14" rx="2" fill="none" stroke="{ROJO}" stroke-width="2"/>')
            s.append(f'<path d="M{x0 + 2} {y0 + 2} l8 10 M{x0 + 10} {y0 + 2} l-8 10" stroke="{ROJO}" stroke-width="1.8"/>')
    s.append(f'<rect x="200" y="30" width="14" height="14" rx="3" fill="{VERDE}"/>')
    s.append(_txt(222, 42, "Zona segura para las grampas", 13.5, 700, NEGRO))
    s.append(_txt(222, 59, "la que indica el fabricante y marcan los planos", 12, 500, TEXTO))
    s.append(f'<rect x="200" y="80" width="14" height="14" rx="2" fill="none" stroke="{ROJO}" stroke-width="2"/>')
    s.append(_txt(222, 92, "Nunca en la punta", 13.5, 700, ROJO))
    s.append(_txt(222, 109, "el vidrio se comba y se pierde la garantía", 12, 500, TEXTO))
    import math
    ox, oy, L = 420, 220, 140
    a = math.radians(25)
    s.append(_txt(ox - 10, 150, "Inclinación 25°, mirando al", 13, 600, NEGRO))
    s.append(_txt(ox - 10, 166, "norte, con los paneles en vertical", 13, 600, NEGRO))
    s.append(f'<line x1="{ox - 20}" y1="{oy}" x2="{ox + L + 30}" y2="{oy}" stroke="{GRIS_CLARO}" stroke-width="1.5"/>')
    s.append(f'<line x1="{ox}" y1="{oy}" x2="{ox + L * math.cos(a):.1f}" y2="{oy - L * math.sin(a):.1f}" '
             f'stroke="#1b2a5c" stroke-width="9" stroke-linecap="round"/>')
    s.append(f'<path d="M{ox + 55} {oy} A55 55 0 0 0 {ox + 55 * math.cos(a):.1f} {oy - 55 * math.sin(a):.1f}" '
             f'fill="none" stroke="{OP}" stroke-width="2"/>')
    s.append(_txt(ox + 62, oy - 8, "25°", 16, 700, OP))
    s.append(_flecha(ox + L + 2, oy - 22, ox + L + 52, oy - 22, VERDE, 2.5))
    s.append(_txt(ox + L + 27, oy - 32, "NORTE", 12, 700, VERDE, anchor="middle"))
    return _svg(W, H, "El montaje: las grampas en la zona segura, nunca en la punta, y el panel a 25° mirando al norte", "".join(s))


def puesta_tierra():
    """La puesta a tierra: la jabalina propia, hasta tres, a 5 m o más entre sí,
    con el cable de 6 mm² a la bornera; el objetivo, menos de 10 Ω."""
    W, H = 650, 250
    s = []
    suelo = 92
    s.append(f'<rect x="0" y="{suelo}" width="{W}" height="{H - suelo}" fill="#f3ece2"/>')
    s.append(f'<line x1="0" y1="{suelo}" x2="{W}" y2="{suelo}" stroke="#a88b63" stroke-width="2"/>')
    # Bornera / tablero
    s.append(_caja(20, 20, 96, 58, "#ffffff", NEGRO, rx=6))
    s.append(_txt(68, 44, "Tablero", 13, 700, NEGRO, anchor="middle"))
    s.append(_txt(68, 62, "bornera", 12, 500, TEXTO, anchor="middle"))
    xs = [190, 360, 530]
    for k, x in enumerate(xs):
        prof = 120 if k == 0 else 100
        s.append(_caja(x - 22, suelo - 4, 44, 18, "#d9cbb4", "#a88b63", rx=3))
        s.append(f'<line x1="{x}" y1="{suelo + 10}" x2="{x}" y2="{suelo + prof}" stroke="{OP}" stroke-width="6" stroke-linecap="round"/>')
        if k == 0:
            s.append(f'<line x1="{x}" y1="{suelo + prof - 30}" x2="{x}" y2="{suelo + prof + 26}" stroke="{OP}" '
                     f'stroke-width="6" stroke-linecap="round" stroke-dasharray="2 5"/>')
            s.append(_txt(x + 12, suelo + prof + 18, "1º: profundizar", 12, 700, OP))
            s.append(_txt(x + 12, suelo + prof + 33, "(otra encima)", 11.5, 500, TEXTO))
        if k == 0:
            s.append(_txt(x - 12, suelo + 60, "jabalina 1", 12, 700, NEGRO, anchor="end"))
        else:
            s.append(_txt(x, suelo + prof + 22, f"jabalina {k + 1}", 12, 700, NEGRO, anchor="middle"))
    s.append(f'<path d="M116 50 H{xs[0]} V{suelo - 4}" fill="none" stroke="{VERDE}" stroke-width="4"/>')
    s.append(_txt(150, 40, "6 mm² (lo exige UTE)", 12.5, 700, VERDE))
    for a, b in ((xs[0], xs[1]), (xs[1], xs[2])):
        s.append(f'<path d="M{a} {suelo + 4} H{b}" fill="none" stroke="{VERDE}" stroke-width="2.5" stroke-dasharray="6 4"/>')
        s.append(_txt((a + b) / 2, suelo - 10, "5 m o más", 12.5, 700, NEGRO, anchor="middle"))
    s.append(_caja(400, 14, 236, 54, VERDE, VERDE, rx=10))
    s.append(_txt(518, 38, "Objetivo: menos de 10 Ω", 15, 700, "#ffffff", anchor="middle"))
    s.append(_txt(518, 57, "hasta 3 jabalinas; si no baja, se anota", 11.5, 500, "#e7f3e9", anchor="middle"))
    return _svg(W, H, "La puesta a tierra: hasta tres jabalinas para bajar de 10 ohm", "".join(s))


def cuatro_cosas(items):
    """Las cuatro cosas de la puesta en marcha (o del cierre), en baldosas con
    ícono."""
    cajas = ""
    for k, x in enumerate(items, 1):
        r = partir_rotulo(x)
        rot, txt = r if r else (x, "")
        cajas += (f'<div style="padding: 13px 14px; border-radius: 12px; background: {OP_F}; border: 1px solid {NARANJA_BORDE}">'
                  f'<div style="display: flex; gap: 10px; align-items: center">'
                  f'<div style="flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; background: {OP}; display: flex; '
                  f'align-items: center; justify-content: center">{icono(icono_para(rot + " " + txt[:40]), "#ffffff", 20)}</div>'
                  f'<div style="font-family: {SANS}; font-size: 15.5px; font-weight: 700; line-height: 1.2; color: {NEGRO}">'
                  f'<span style="color: {OP}">{k} · </span>{en_linea(rot)}</div></div>'
                  f'<div style="margin-top: 8px; font-size: 13.2px; line-height: 1.45; color: {TEXTO}">{en_linea(txt)}</div></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px">{cajas}</div>\n')


def ensayo_antiisla():
    """El ensayo anti-isla en el tiempo: la llave se baja y se sube casi en el
    mismo segundo (un corte momentáneo), el inversor deja de inyectar y vuelve
    a los 180 segundos."""
    W, H = 650, 180
    s = []
    y = 100
    s.append(f'<line x1="20" y1="{y}" x2="630" y2="{y}" stroke="{BORDE}" stroke-width="2"/>')
    # La llave: abajo un instante.
    s.append(_txt(20, 22, "LLAVE DE UTE", 10.5, 700, GRIS))
    s.append(f'<path d="M20 34 H150 V46 H158 V34 H630" fill="none" stroke="{GRIS}" stroke-width="2"/>')
    s.append(_txt(154, 62, "se baja y se sube enseguida", 11, 700, GRIS, anchor="middle"))
    # La potencia del inversor.
    s.append(f'<path d="M20 74 H150 V{y} H460 V74 H630" fill="none" stroke="{OP}" stroke-width="3"/>')
    s.append(_txt(20, 70, "inyectando", 12, 700, OP))
    s.append(_txt(630, 70, "vuelve a inyectar", 12, 700, OP, anchor="end"))
    s.append(f'<path d="M158 {y + 14} v8 H460 v-8" fill="none" stroke="{VERDE}" stroke-width="2"/>')
    s.append(_txt(309, y + 38, "180 segundos, con el cronómetro en cámara", 14, 700, VERDE, anchor="middle"))
    s.append(_txt(154, y + 62, "1 · Corte momentáneo", 12, 700, NEGRO, anchor="middle"))
    s.append(_txt(460, y + 62, "2 · Vuelve a inyectar: quedó bien", 12, 700, NEGRO, anchor="middle"))
    s.append(_icono_svg("video", 560, 118, GRIS, 20))
    return _svg(W, H, "El ensayo anti-isla: un corte momentáneo de la llave y 180 segundos hasta volver a inyectar", "".join(s))


def chips_dia(items):
    """Las respuestas al '¿Qué le decimos al cliente si pregunta hoy?'."""
    chips = ""
    for x in items:
        alerta = "imprevisto" in x.lower()
        chips += (f'<div style="display: flex; gap: 8px; align-items: center; padding: 9px 14px; border-radius: 18px 18px 18px 4px; '
                  f'background: {ROJO_FONDO if alerta else VERDE_FONDO}; border: 1px solid {ROJO_BORDE if alerta else "#cfe3d2"}">'
                  f'{icono("alerta" if alerta else "chat", ROJO if alerta else VERDE, 16)}<span style="font-size: 14px; '
                  f'line-height: 1.35; color: {ROJO if alerta else VERDE_TEXTO}; font-weight: 600">{en_linea(x)}</span></div>')
    return f'  <div style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px">{chips}</div>\n'


def documentos_ute(items):
    """Los 7 documentos de UTE que firma el cliente, en el orden del PDF."""
    cajas = "".join(
        f'<div style="display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid {BORDE}; '
        f'border-radius: 10px; background: #ffffff"><div style="position: relative; flex-shrink: 0">'
        f'{icono("firma", COLOR_AREA["Tramitación UTE"][0], 26, 1.7)}</div><div><div style="font-family: {SANS}; '
        f'font-size: 11px; font-weight: 700; letter-spacing: 1px; color: {COLOR_AREA["Tramitación UTE"][0]}">'
        f'HOJA {k}</div><div style="font-size: 13.5px; line-height: 1.3; color: {NEGRO}; font-weight: 600">{en_linea(x)}'
        f'</div></div><div style="margin-left: auto; width: 18px; height: 18px; border: 1.8px solid {NEGRO}; '
        f'border-radius: 4px; flex-shrink: 0"></div></div>' for k, x in enumerate(items, 1))
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{cajas}</div>\n')


def rutina(bloques):
    """La rutina de Logística: una columna por frecuencia."""
    cajas = ""
    colores = [OP, "#9a4a0e", "#7a3a0b", "#5a2a08"]
    for k, (rot, items) in enumerate(bloques):
        lis = "".join(f'<div style="padding: 6px 0; border-top: 1px solid {NARANJA_BORDE}; font-size: 12.8px; '
                      f'line-height: 1.42; color: {NEGRO}">{en_linea(x)}</div>' for x in items)
        cajas += (f'<div style="border-radius: 12px; overflow: hidden; background: {OP_F}">'
                  f'<div style="padding: 9px 13px; background: {colores[k % 4]}; display: flex; gap: 8px; align-items: center">'
                  f'{icono("calendario", "#ffffff", 17)}<span style="font-family: {SANS}; font-size: 15px; font-weight: 700; '
                  f'color: #ffffff">{en_linea(rot)}</span></div><div style="padding: 2px 13px 8px">{lis}</div></div>')
    return (f'  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px">{cajas}</div>\n')


def visualizar_operaciones(crudos, num):
    """Recorre los bloques de un capítulo del Manual de Operaciones y cambia
    los pasajes que se pueden dibujar."""
    out = []
    i = 0
    n = len(crudos)
    casos = num in CAPITULOS_CASOS
    while i < n:
        t, c = crudos[i]
        txt = c if t == "p" else ""
        # Los casos de "Cuando algo sale mal": el título y todo lo que sigue
        # hasta el próximo título, en una tarjeta.
        if casos and t == "h3":
            j = i + 1
            while j < n and crudos[j][0] != "h3":
                j += 1
            out.append(("vo_caso", (c, crudos[i + 1:j])))
            i = j
            continue
        # Una lista seguida de su captura, si la captura tiene números: la
        # captura anotada, con la lista como leyenda.
        if t == "lista" and i + 1 < n and crudos[i + 1][0] == "captura" and marcas_de(crudos[i + 1][1][0], c):
            nombre, epigrafe = crudos[i + 1][1]
            marcas = marcas_de(nombre, c)
            # Primero la captura: si el párrafo que presenta la lista ya salió,
            # la captura va antes que él.
            intro = None
            if out and out[-1][0] == "p" and out[-1][1].rstrip().endswith(":"):
                intro = out.pop()[1]
            # Una lista larga no arrastra la captura a la hoja siguiente dejando
            # una hoja vacía (12-oct-2026): con la captura van los primeros
            # ítems y el resto sigue de a uno, con la numeración corrida.
            corte = 4 if len(c) > 5 else len(c)
            out.append(("vo_marcada_leyenda", (nombre, epigrafe, marcas, c[:corte], intro)))
            for x, m in zip(c[corte:], marcas[corte:]):
                k0 = sum(1 for mm in marcas[:c.index(x)] if mm)
                out.append(("vo_leyenda_sigue", ([x], [m], k0)))
            i += 2
            continue
        # Diagramas puntuales, por la frase que los presenta.
        if t == "p" and "el centro de la cadena" in txt:
            out.append((t, c))
            out.append(("vo_centro", None))
            i += 1
            continue
        if t == "p" and txt.startswith("Por eso, para **confirmar una fecha de obra**"):
            out.append(("vo_requisitos", c))
            i += 1
            continue
        if t == "tabla" and [x.lower() for x in c[0]][:1] == ["si falla…"]:
            out.append(("vo_causa", c))
            i += 1
            continue
        if t == "tabla" and [x.lower() for x in c[0]][:2] == ["área", "qué hace, en una línea"] \
                and c[0][2].lower().startswith("qué le importa a"):
            out.append(("vo_areas", c[1]))
            i += 1
            continue
        if t == "tabla" and [x.lower() for x in c[0]] == ["necesita saber…", "le pregunta a…"]:
            out.append(("vo_preguntas", c[1]))
            i += 1
            continue
        if t == "tabla" and [x.lower() for x in c[0]] == ["quién", "de qué responde"]:
            out.append(("vo_cadena", c[1]))
            i += 1
            continue
        # Mantenimiento y soporte, lado a lado.
        if (t == "p" and txt.startswith("**El mantenimiento.**") and i + 3 < n and crudos[i + 1][0] == "lista"
                and crudos[i + 2][0] == "p" and crudos[i + 2][1].startswith("**El soporte.**") and crudos[i + 3][0] == "lista"):
            a = partir_rotulo(txt)
            b = partir_rotulo(crudos[i + 2][1])
            out.append(("vo_visitas", ((a[0], a[1], crudos[i + 1][1]), (b[0], b[1], crudos[i + 3][1]))))
            i += 4
            continue
        if t == "lista" and c and c[0].startswith("**La fecha tentativa**"):
            out.append(("vo_fechas", c))
            i += 1
            continue
        if t == "lista" and c and c[0].startswith("**Las obras grandes o complejas**"):
            out.append(("vo_cuadrilla", c))
            i += 1
            continue
        if t == "lista" and c and c[0].startswith("**Lo que está en la lista de materiales de Ingeniería**"):
            out.append(("vo_escalera", c))
            i += 1
            continue
        if t == "lista" and c and c[0].startswith("Si **el capataz** encuentra"):
            out.append(("vo_sancion", c))
            i += 1
            continue
        if t == "lista" and c and c[0].startswith("Arrancamos, todo en orden"):
            out.append(("vo_chips", c))
            i += 1
            continue
        if t == "numerada" and c and c[0].startswith("Solicitud de Conexión IMG"):
            out.append(("vo_documentos", c))
            i += 1
            continue
        if t == "numerada" and c and (c[0].startswith("**El datalogger y la planta:**") or c[0].startswith("**La configuración:**")):
            out.append(("vo_cuatro", c))
            i += 1
            continue
        # La rutina de Logística: rótulos de frecuencia, cada uno con su lista.
        if t == "p" and re.fullmatch(r"\*\*(Todos los días)\*\*", txt.strip()):
            bloques_r, j = [], i
            while j + 1 < n and crudos[j][0] == "p" and re.fullmatch(r"\*\*[^*]+\*\*", crudos[j][1].strip()) \
                    and crudos[j + 1][0] == "lista":
                bloques_r.append((crudos[j][1].strip().strip("*"), crudos[j + 1][1]))
                j += 2
            out.append(("vo_rutina", bloques_r))
            i = j
            continue
        # Un rótulo solo ('**En el techo** (…):') seguido de una lista.
        if (t == "p" and i + 1 < n and crudos[i + 1][0] == "lista"
                and not crudos[i + 1][1][0].startswith("**Lo que está en la lista")
                and (re.fullmatch(r"\*\*[^*]{2,60}\*\*[^*]{0,60}:", txt.strip())
                     or re.fullmatch(r"\*\*[^*]{2,60}:\*\*", txt.strip()))):
            rot = _sin_md(txt.strip().rstrip(":"))
            items = crudos[i + 1][1]
            # Si después viene una captura con números, la captura va primero y
            # la tarjeta lleva los números.
            if i + 2 < n and crudos[i + 2][0] == "captura" and marcas_de(crudos[i + 2][1][0], items):
                nombre, epigrafe = crudos[i + 2][1]
                marcas = marcas_de(nombre, items)
                out.append(("vo_marcada_tarjeta", (nombre, epigrafe, marcas, rot, items)))
                i += 3
                continue
            out.append(("vo_tarjeta_lista", (rot, items)))
            i += 2
            continue
        # Párrafos seguidos que empiezan con un rótulo: tarjetas.
        if t == "p" and partir_rotulo(txt) and partir_rotulo(txt)[1] and not txt.rstrip().endswith(":"):
            grupo, j = [], i
            while (j < n and crudos[j][0] == "p" and partir_rotulo(crudos[j][1])
                   and partir_rotulo(crudos[j][1])[1] and len(crudos[j][1]) < 700
                   and not crudos[j][1].rstrip().endswith(":")):
                grupo.append(partir_rotulo(crudos[j][1]))
                j += 1
            if len(grupo) >= 2:
                # De a dos o tres por bloque, para que se puedan repartir entre hojas.
                for k in range(0, len(grupo), 2):
                    out.append(("vo_tarjetas", grupo[k:k + 2]))
                i = j
                continue
        # Una lista cuyos ítems arrancan con un rótulo en negrita.
        if t == "lista" and len(c) >= 2 and sum(1 for x in c if partir_rotulo(x) and partir_rotulo(x)[1]) >= len(c) - 0:
            out.append(("vo_filas", [partir_rotulo(x) for x in c]))
            i += 1
            continue
        # Una lista de cosas cortas: baldosas.
        if t == "lista" and 3 <= len(c) <= 6 and all(len(_sin_md(x)) <= 95 and not x.startswith("[ ]") for x in c):
            out.append(("vo_baldosas", c))
            i += 1
            continue
        # Una lista numerada corta: pasos en fila.
        if t == "numerada" and 3 <= len(c) <= 4 and all(len(_sin_md(x)) <= 120 for x in c):
            out.append(("vo_pasos", c))
            i += 1
            continue
        out.append((t, c))
        # Los dibujos que van después de un pasaje, sin reemplazarlo.
        if t == "h3" and c == "El montaje":
            pass
        if t == "lista" and c and c[0].startswith("**Inclinación 25°"):
            out.append(("vo_montaje", None))
        if t == "p" and txt.startswith("**Video 2 · El ensayo anti-isla.**"):
            out.append(("vo_antiisla", None))
        if t == "p" and txt.startswith("**Los estados del informe:**"):
            out.append(("vo_estados", None))
        i += 1
    # Dibujos que se enganchan a la lista ya transformada.
    final = []
    for t, c in out:
        final.append((t, c))
        if t == "vo_filas" and c and c[0][0].startswith("Inclinación 25°"):
            final.append(("vo_montaje", None))
        if t == "vo_filas" and c and c[0][0].startswith("Siempre"):
            pass
    tierra = []
    for t, c in final:
        tierra.append((t, c))
        if t == "h3" and c == "La puesta a tierra":
            tierra.append(("vo_tierra", None))
        if t == "vo_tarjetas" and any(r.startswith("Cómo se le paga") for r, _ in c):
            tierra.append(("vo_pago", None))
        if t == "vo_tarjetas" and any(r.startswith("Video 2") for r, _ in c):
            tierra.append(("vo_antiisla", None))
    return tierra


# Las capturas que llevan números encima: dónde va cada uno, en porcentaje de
# la imagen, en el orden de la lista del .md que la acompaña (la lista va justo
# antes de la captura). Se ubicaron mirando la captura: si la pantalla cambia
# de lugar las cosas, hay que volver a ubicarlos.
MARCAS_CAPTURA = {
    "ops-proyecto-encabezado": [(36.9, 19.5), (48.8, 19.5), (61.2, 19.5), (74.7, 46.4), (52.2, 43.3),
                                (74.7, 25.3)],
    "ops-lista-proyectos": [(23.1, 17.1), (56.9, 17.1), None, (76.6, 17.1), (20.6, 27.7), (13.4, 35.4),
                            (45.3, 40.7), (88.1, 38.7), (96.5, 17.1)],
    "ops-proyecto-documentos-ute": [(49.0, 21.3), None, None],
    "ops-pestana-compras": [(9.7, 15.0), (22.2, 15.0), (47.5, 15.0), (39.8, 15.0), (58.5, 15.0), (53.1, 15.0),
                            (31.1, 15.0)],
    # La misma captura sirve para el panel de cualquier etapa y para el de
    # Compras: se distingue por cómo empieza la lista.
    "ops-panel-compras#Las fechas": [(13.9, 24.8), (22.9, 56.9), (16.0, 14.6), None],
    "ops-panel-compras#Materiales l": [(53.0, 63.3), (34.5, 76.6), (58.0, 89.8), None],
    "ops-panel-validacion": [(37.0, 40.5), (54.0, 57.6), (41.5, 49.0), None],
    "ops-panel-obra": [(47.0, 60.6), (44.0, 71.3), (41.0, 82.2), (37.0, 93.0)],
    "ops-calendario-detalle": [(37.5, 26.4), (89.0, 35.5), (82.6, 83.6), None],
}


def marcas_de(nombre, items):
    """Los números de una captura para una lista: primero por captura y cómo
    empieza la lista, después por captura sola. None si no tiene, o si no
    coinciden con la cantidad de ítems."""
    clave = f"{nombre}#{_sin_md(items[0])[:14]}"
    for k, v in MARCAS_CAPTURA.items():
        if "#" in k and clave.startswith(k) and len(v) == len(items):
            return v
    v = MARCAS_CAPTURA.get(nombre)
    return v if v and len(v) == len(items) else None


def captura_marcada(nombre, epigrafe, marcas):
    """La captura con un número rojo sobre cada parte que explica la lista."""
    nums, k = "", 0
    for m in marcas:
        if m:
            k += 1
            nums += (f'<div style="position: absolute; left: {m[0]}%; top: {m[1]}%; transform: translate(-50%, -50%); '
                     f'width: 26px; height: 26px; border-radius: 50%; background: {ROJO}; color: #ffffff; '
                     f'font-family: {SANS}; font-size: 13px; font-weight: 700; line-height: 26px; text-align: center; '
                     f'box-shadow: 0 0 0 3px #ffffff">{k}</div>')
    return (f'  <figure style="margin: 14px 0 0">\n'
            f'    <div style="text-align: center; line-height: 0"><div style="position: relative; display: inline-block; '
            f'border: 1px solid {BORDE}; border-radius: 8px; overflow: hidden">'
            f'<img src="/_blob/{CAPTURAS[nombre]}" alt="{en_linea(epigrafe)}" style="display: block; max-width: 100%; '
            f'max-height: 360px; width: auto; height: auto">{nums}</div></div>\n'
            f'    <figcaption style="margin-top: 6px; font-family: {SANS}; font-size: 12px; color: {GRIS}; '
            f'text-align: center">{en_linea(epigrafe)}</figcaption>\n  </figure>\n')


def leyenda_marcada(items, marcas, k=0):
    """La lista del .md, con el número de la captura en cada ítem que se ve en
    ella; los que no se ven, con un punto. k: cuántos números ya salieron."""
    out = ""
    for t, m in zip(items, marcas):
        if m:
            k += 1
            marca = (f'<span style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: {ROJO}; '
                     f'color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700; line-height: 22px; '
                     f'text-align: center">{k}</span>')
        else:
            marca = ('<span style="flex-shrink: 0; width: 22px; display: flex; justify-content: center; '
                     f'padding-top: 8px"><span style="width: 6px; height: 6px; border-radius: 50%; '
                     f'background: {GRIS_CLARO}"></span></span>')
        out += (f'<div style="display: flex; gap: 11px; align-items: flex-start; margin-top: 9px">{marca}'
                f'<span style="font-size: 14.2px; line-height: 1.5; color: {TEXTO}">{en_linea(mayuscula(t))}</span></div>')
    return f'  <div style="margin-top: 6px">{out}</div>\n'


def foto_primero(bloques):
    """Pedido del 11-oct-2026: en todo el manual, primero la captura y después
    lo que explica. Una captura sola en su sección va pegada al título; si no,
    sube por encima del texto que la explica, hasta el primer párrafo con
    rótulo en negrita (donde empieza esa explicación)."""
    out = list(bloques)
    cortes = [k for k, (t, _) in enumerate(out) if t == "h3"] + [len(out)]
    for a, b in zip(cortes, cortes[1:]):
        caps = [k for k in range(a, b) if out[k][0] == "captura"]
        marcadas = [k for k in range(a, b) if out[k][0].startswith("vo_marcada")]
        if len(caps) == 1 and not marcadas and caps[0] > a + 1:
            out.insert(a + 1, out.pop(caps[0]))
    k = 0
    while k < len(out):
        if out[k][0] == "captura":
            j = k
            while j > 0:
                pt, pc = out[j - 1]
                if pt in ("vo_tarjeta_lista",):
                    j -= 1
                    break
                if pt in ("h3", "captura", "tabla") or pt.startswith("vo_"):
                    break
                j -= 1
                if pt == "p" and partir_rotulo(pc):
                    break
            if j < k:
                out.insert(j, out.pop(k))
        k += 1
    return out


# ── Los cuadros del Manual de Ventas ─────────────────────────────────────────
# Pedido del 12-oct-2026: el mismo criterio que el de Operaciones. Las tablas
# del .md que cuentan un recorrido, un reparto o una decisión se dibujan; las
# que son de consulta (Área / Qué hace, Necesita saber / Le pregunta a) ya
# salían en tarjetas.

def _flecha_html(color=None):
    return (f'<div style="flex-shrink: 0; align-self: center; width: 12px">'
            f'<svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><polygon points="0,0 12,8 0,16" '
            f'fill="{color or OP}"/></svg></div>')


def embudo_plazos(filas):
    """Paso | Plazo: el embudo en fila, con el plazo de cada tramo grande."""
    cajas = []
    for paso, plazo in filas:
        m = re.match(r"(\d+)\s*(.*)", _sin_md(plazo))
        num, unidad = (m.group(1), m.group(2)) if m else (_sin_md(plazo), "")
        cajas.append(f'<div style="flex: 1; min-width: 0; padding: 12px 10px 13px; border: 1.5px solid {NARANJA_BORDE}; '
                     f'border-radius: 10px; background: {TINTE}; text-align: center">'
                     f'<div style="font-family: {SANS}; font-size: 30px; font-weight: 700; color: {OP}; line-height: 1">{num}</div>'
                     f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 700; color: {OP}; letter-spacing: 0.3px; '
                     f'text-transform: uppercase; margin-top: 3px">{unidad}</div>'
                     f'<div style="margin-top: 9px; padding-top: 8px; border-top: 1px solid {NARANJA_BORDE}; font-size: 12.5px; '
                     f'line-height: 1.38; color: {NEGRO}">{en_linea(mayuscula(paso))}</div></div>')
    return f'  <div style="margin-top: 14px; display: flex; gap: 5px">{_flecha_html().join(cajas)}</div>\n'


def resultados_embudo(filas):
    """Paso | Qué se espera | Por qué importa: la meta grande a la izquierda y
    el porqué al lado, una fila por paso."""
    out = ""
    for paso, meta, porque in filas:
        out += (f'<div style="display: grid; grid-template-columns: 186px 1fr; gap: 14px; align-items: center; '
                f'padding: 11px 0; border-top: 1px solid {BORDE}">'
                f'<div style="padding: 9px 12px; border-radius: 10px; background: {OP_F}">'
                f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 700; color: {OP}; letter-spacing: 0.3px; '
                f'text-transform: uppercase">{en_linea(_sin_md(paso))}</div>'
                f'<div style="margin-top: 3px; font-family: {SANS}; font-size: 15px; line-height: 1.3; color: {NEGRO}">'
                f'{en_linea(meta)}</div></div>'
                f'<div style="font-size: 13.5px; line-height: 1.5; color: {TEXTO}">{en_linea(porque)}</div></div>')
    return f'  <div style="margin-top: 12px; border-bottom: 1px solid {BORDE}">{out}</div>\n'


def modalidad_pago(filas):
    """Si elige… | Tiene que…: los tres caminos, cada uno con lo que pide."""
    ic = {"financ": "doc", "directo": "plata"}
    cajas = ""
    for elige, tiene in filas:
        nombre = _sin_md(elige)
        i = next((v for k, v in ic.items() if k in nombre.lower()), "chat")
        cajas += (f'<div style="border: 1.5px solid {NARANJA_BORDE}; border-radius: 12px; overflow: hidden; background: #ffffff">'
                  f'<div style="padding: 10px 12px; background: {OP}; display: flex; gap: 9px; align-items: center">'
                  f'{icono(i, "#ffffff", 18)}<span style="font-family: {SANS}; font-size: 14.5px; font-weight: 700; '
                  f'color: #ffffff">{nombre}</span></div>'
                  f'<div style="padding: 10px 12px 12px; display: flex; gap: 8px; align-items: flex-start">'
                  f'{icono("check", OP, 16)}<span style="font-size: 14px; line-height: 1.45; color: {NEGRO}">'
                  f'{en_linea(mayuscula(tiene))}</span></div></div>')
    return (f'  <div style="margin-top: 14px"><div style="font-family: {SANS}; font-size: 11px; font-weight: 700; '
            f'color: {GRIS_CLARO}; letter-spacing: 0.4px; margin-bottom: 7px">SI EL CLIENTE ELIGE…</div>'
            f'<div style="display: grid; grid-template-columns: repeat({len(filas)}, 1fr); gap: 10px">{cajas}</div></div>\n')


def cuotas_pago(filas):
    """Cuota | Cuándo: una barra partida en proporción a cada cuota."""
    tonos = [OP, "#5d74d4", "#aab7ec"]
    barra, notas = "", ""
    for k, (cuota, cuando) in enumerate(filas):
        m = re.search(r"\d+", cuota)
        peso = int(m.group()) if m else 1
        claro = k == len(filas) - 1 and len(filas) > 2
        barra += (f'<div style="flex: {peso}; padding: 9px 0; background: {tonos[k % 3]}; text-align: center; '
                  f'font-family: {SANS}; font-size: 16px; font-weight: 700; color: {OP if claro else "#ffffff"}">'
                  f'{en_linea(cuota)}</div>')
        notas += (f'<div style="flex: {peso}; min-width: 0; padding: 7px 8px 0 0; font-size: 12.5px; line-height: 1.42; '
                  f'color: {NEGRO}">{en_linea(mayuscula(cuando))}</div>')
    return (f'  <div style="margin-top: 14px"><div style="display: flex; gap: 3px; border-radius: 8px; overflow: hidden">'
            f'{barra}</div><div style="display: flex; gap: 3px">{notas}</div></div>\n')


def pase_pasos(filas):
    """| Quién | Cuándo: los pasos en fila, con quién y cuándo."""
    cajas = []
    for num, quien, cuando in filas:
        cajas.append(f'<div style="flex: 1; min-width: 0; padding: 12px 14px; border: 1.5px solid {NARANJA_BORDE}; '
                     f'border-radius: 10px; background: #ffffff; display: flex; gap: 12px; align-items: flex-start">'
                     f'<div style="font-family: {SANS}; font-size: 26px; font-weight: 700; color: {OP}; line-height: 1">'
                     f'{_sin_md(num)}</div><div><div style="font-size: 14px; line-height: 1.42; color: {NEGRO}">'
                     f'{en_linea(quien)}</div><div style="margin-top: 6px; display: flex; gap: 6px; align-items: center">'
                     f'{icono("reloj", OP, 14)}<span style="font-family: {SANS}; font-size: 12.5px; font-weight: 700; '
                     f'color: {OP}">{en_linea(cuando)}</span></div></div></div>')
    return f'  <div style="margin-top: 14px; display: flex; gap: 6px">{_flecha_html().join(cajas)}</div>\n'


def etapas_pipeline(filas):
    """Etapa | Qué quiere decir: las abiertas en fila, y las dos cerradas al
    final, como salida."""
    abiertas = [f for f in filas if _sin_md(f[0]) not in ("Ganado", "Perdido")]
    cerradas = [f for f in filas if _sin_md(f[0]) in ("Ganado", "Perdido")]
    def caja(etapa, que, borde, fondo, color):
        return (f'<div style="flex: 1; min-width: 0; padding: 10px 9px 11px; border: 1.5px solid {borde}; '
                f'border-radius: 10px; background: {fondo}">'
                f'<div style="font-family: {SANS}; font-size: 13.5px; font-weight: 700; color: {color}; line-height: 1.2">'
                f'{_sin_md(etapa)}</div><div style="margin-top: 5px; font-size: 12px; line-height: 1.4; color: {NEGRO}">'
                f'{en_linea(mayuscula(que))}</div></div>')
    fila1 = _flecha_html().join(caja(e, q, NARANJA_BORDE, TINTE, OP) for e, q in abiertas)
    tonos = {"Ganado": (VERDE, VERDE_FONDO, VERDE_TEXTO), "Perdido": (ROJO_BORDE, ROJO_FONDO, ROJO)}
    fila2 = "".join(caja(e, q, *tonos[_sin_md(e)]) for e, q in cerradas)
    rot = (f'font-family: {SANS}; font-size: 11px; font-weight: 700; color: {GRIS_CLARO}; letter-spacing: 0.4px; '
           f'margin-bottom: 6px')
    return (f'  <div style="margin-top: 14px"><div style="{rot}">ABIERTAS · EN ESTE ORDEN</div>'
            f'<div style="display: flex; gap: 4px">{fila1}</div>'
            f'<div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; align-items: stretch">'
            f'<div style="align-self: center; {rot}; margin: 0 4px 0 0">CERRADAS →</div>'
            f'<div style="display: flex; gap: 8px; width: 60%">{fila2}</div></div></div>\n')


def embudo_dibujo(items):
    """La lista numerada del embudo (Consulta, Lead…): un embudo de verdad,
    una franja por paso que se angosta hacia abajo, y al costado lo que pasa
    en ese paso."""
    n = len(items)
    tonos = ["#0f2a8f", "#1836b2", "#3a55c4", "#5d74d4", "#8094e0", "#a3b2ea"]
    arriba, abajo = 1.0, 0.36
    filas = ""
    for k, x in enumerate(items):
        rot, resto = partir_rotulo(x) or (str(k + 1), x)
        w1 = arriba - (arriba - abajo) * k / n
        w2 = arriba - (arriba - abajo) * (k + 1) / n
        a1, a2 = (1 - w1) / 2 * 100, (1 - w2) / 2 * 100
        poli = f"{a1:.1f}% 0, {100 - a1:.1f}% 0, {100 - a2:.1f}% 100%, {a2:.1f}% 100%"
        claro = k >= 4
        filas += (f'<div style="display: grid; grid-template-columns: 236px 1fr; gap: 16px; align-items: stretch">'
                  f'<div style="clip-path: polygon({poli}); background: {tonos[k % len(tonos)]}; min-height: 58px; '
                  f'display: flex; flex-direction: column; align-items: center; justify-content: center; '
                  f'margin-bottom: 3px">'
                  f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; '
                  f'color: {OP if claro else "#ffffffcc"}">PASO {k + 1}</div>'
                  f'<div style="font-family: {SANS}; font-size: 16px; font-weight: 700; line-height: 1.15; '
                  f'color: {OP if claro else "#ffffff"}; text-align: center">{en_linea(rot)}</div></div>'
                  f'<div style="align-self: center; padding: 4px 0 7px; border-bottom: 1px solid {BORDE}; '
                  f'font-size: 13.5px; line-height: 1.5; color: {TEXTO}">{en_linea(resto)}</div></div>')
    return f'  <div style="margin-top: 14px">{filas}</div>\n'


# ── Más cuadros de Ventas (pedido del 12-oct-2026: "mirá el de Operaciones y
# compará"). Cada uno se engancha a una frase que ya está en el .md: el texto
# no cambia, se le suma el dibujo. Si se reescribe esa frase, el dibujo deja de
# salir (y no rompe nada).

def _caja_v(titulo, texto="", ic=None, color=None, fondo=None, borde=None, ancho=None):
    color, fondo, borde = color or OP, fondo or TINTE, borde or NARANJA_BORDE
    cab = (f'<div style="display: flex; gap: 7px; align-items: center">{icono(ic, color, 16) if ic else ""}'
           f'<span style="font-family: {SANS}; font-size: 13.5px; font-weight: 700; line-height: 1.2; color: {color}">'
           f'{titulo}</span></div>')
    cuerpo = (f'<div style="margin-top: 5px; font-size: 12.3px; line-height: 1.42; '
              f'color: {"#ffffffe6" if fondo == OP else NEGRO}">{texto}</div>'
              if texto else "")
    return (f'<div style="{"flex: 1; " if not ancho else f"width: {ancho}; flex-shrink: 0; "}min-width: 0; '
            f'padding: 10px 11px 11px; border: 1.5px solid {borde}; border-radius: 10px; background: {fondo}">'
            f'{cab}{cuerpo}</div>')


def _fila_v(cajas, flechas=True, gap=5):
    union = _flecha_html() if flechas else ""
    return f'<div style="display: flex; gap: {gap}px; align-items: stretch">{union.join(cajas)}</div>'


def _rotulo_v(t, margen="0 0 7px"):
    return (f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 700; color: {GRIS_CLARO}; '
            f'letter-spacing: 0.4px; margin: {margen}">{t}</div>')


def _envolver(html, mt=14):
    return f'  <div style="margin-top: {mt}px">{html}</div>\n'


def banda(frase):
    return ("cita", [f"**{frase}**"])


def fecha_obra_cadena():
    return _envolver(_rotulo_v("LA FECHA DE OBRA: VENTAS NO DA FECHAS") + _fila_v([
        _caja_v("Ventas", "Al vender, le da al cliente solo una <strong>estimación por quincena</strong> (por ejemplo, "
                "«la segunda quincena de noviembre») para que tenga una idea.", "chat"),
        _caja_v("Operaciones", "<strong>Agenda</strong> la fecha de obra.", "calendario", "#c25a12", "#fff6ef", "#efc9ad"),
        _caja_v("Experiencia Solar", "Cuando está confirmada, <strong>se la dice al cliente</strong>, una sola vez.",
                "persona", "#3d6b47", "#f1f8f2", "#bcd9c1"),
    ]))


def markup_escala():
    """Del 0 al 30 %: dónde arranca el asesor, hasta dónde baja solo y desde
    dónde necesita a la Dirección."""
    def pos(v):
        return v / 30 * 100
    zona = lambda a, b, fondo, texto, color: (
        f'<div style="position: absolute; left: {pos(a)}%; width: {pos(b) - pos(a)}%; top: 0; bottom: 0; '
        f'background: {fondo}; display: flex; align-items: center; justify-content: center; text-align: center; '
        f'padding: 0 6px; font-family: {SANS}; font-size: 11.5px; font-weight: 700; line-height: 1.2; color: {color}">'
        f'{texto}</div>')
    barra = (f'<div style="position: relative; height: 54px; border-radius: 8px; overflow: hidden">'
             + zona(0, 15, ROJO_FONDO, "Por debajo del 15 %: con autorización de la Dirección", ROJO)
             + zona(15, 25, OP_F, "El asesor lo baja solo, para cerrar", OP)
             + zona(25, 30, "#f6f8fe", "", OP)
             + f'</div>')
    marcas = "".join(
        f'<div style="position: absolute; left: {pos(v)}%; transform: translateX(-50%); text-align: center; '
        f'font-family: {SANS}; font-size: 12px; font-weight: 700; color: {c}">{t}</div>'
        for v, t, c in ((15, "15 %", ROJO), (25, "25 %", OP)))
    arranque = (f'<div style="position: absolute; left: {pos(25)}%; top: -6px; bottom: -6px; width: 3px; '
                f'margin-left: -1.5px; background: {OP}"></div>'
                f'<div style="position: absolute; left: calc({pos(25)}% + 8px); top: 8px; font-family: {SANS}; '
                f'font-size: 11.5px; font-weight: 700; line-height: 1.2; color: {OP}">Se arranca<br>acá</div>')
    return _envolver(_rotulo_v("HASTA DÓNDE SE MUEVE EL MARKUP")
                     + f'<div style="position: relative">{barra}{arranque}</div>'
                     + f'<div style="position: relative; height: 18px; margin-top: 5px">{marcas}</div>')


def _techo_svg(coplanar):
    """Un techo inclinado visto de costado, con el panel pegado o levantado."""
    techo = '<polygon points="8,72 150,36 150,42 8,78" fill="#9aa3b8"/>'
    if coplanar:
        panel = '<polygon points="40,63.9 128,41.6 128,37.6 40,59.9" fill="#1836b2"/>'
        extra = ""
    else:
        # Techo horizontal (una azotea) y el panel levantado a unos 25 grados.
        techo = '<rect x="8" y="66" width="144" height="7" fill="#9aa3b8"/>'
        panel = '<polygon points="38,58 112,23.5 114,27.5 40,62" fill="#1836b2"/>'
        extra = ('<line x1="42" y1="60" x2="42" y2="66" stroke="#5b6278" stroke-width="2.5"/>'
                 '<line x1="110" y1="27" x2="110" y2="66" stroke="#5b6278" stroke-width="2.5"/>'
                 '<line x1="42" y1="64" x2="110" y2="31" stroke="#5b6278" stroke-width="1.5"/>'
                 '<path d="M156 30 L128 30 M128 30 l7 -5 M128 30 l7 5" stroke="#5b6278" stroke-width="2" fill="none"/>'
                 '<text x="156" y="20" text-anchor="end" font-size="9" font-family="sans-serif" fill="#5b6278">viento sur</text>')
    return (f'<svg viewBox="0 0 160 84" width="150" height="79" aria-hidden="true">{techo}{panel}{extra}</svg>')


def paso_visita(n, x):
    """Un paso de la visita en su tarjeta, como los de Operaciones: el número,
    el rótulo y lo que sigue; la sublista, en filas."""
    partes = x.split("\n- ")
    cuerpo, subs = partes[0], partes[1:]
    r = partir_rotulo(cuerpo)
    rot, resto = (r[0], r[1]) if r else ("", cuerpo)
    ic = ["persona", "techo", "escudo", "rayo", "reloj", "camara", "doc"][(n - 1) % 7]
    filas = "".join(
        f'<div style="display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid {NARANJA_BORDE}">'
        f'<span style="flex-shrink: 0; width: 5px; height: 5px; margin-top: 8px; border-radius: 50%; background: {OP}"></span>'
        f'<span style="font-size: 13.3px; line-height: 1.48; color: {NEGRO}">{en_linea(sub)}</span></div>' for sub in subs)
    return (f'  <div style="margin-top: 9px; display: flex; gap: 12px; padding: 11px 14px; border: 1.5px solid {NARANJA_BORDE}; '
            f'border-radius: 12px; background: {TINTE}">'
            f'<div style="flex-shrink: 0; width: 34px; text-align: center"><div style="width: 30px; height: 30px; margin: 0 auto; '
            f'border-radius: 50%; background: {OP}; color: #ffffff; font-family: {SANS}; font-size: 15px; font-weight: 700; '
            f'line-height: 30px">{n}</div><div style="margin-top: 7px">{icono(ic, OP, 18)}</div></div>'
            f'<div style="flex: 1; min-width: 0"><div style="font-family: {SANS}; font-size: 15px; font-weight: 700; '
            f'line-height: 1.3; color: {NEGRO}">{en_linea(rot.rstrip(":"))}</div>'
            + (f'<div style="margin-top: 3px; font-size: 13.6px; line-height: 1.5; color: {TEXTO}">{en_linea(resto)}</div>' if resto else "")
            + (f'<div style="margin-top: 6px">{filas}</div>' if filas else "") + '</div></div>\n')


def pasos_de_la_visita(items):
    out = []
    for n, x in enumerate(items, 1):
        out.append(("vv_paso", (n, x)))
        if n == 4:
            out.append(("vv_coplanar", None))
        if n == 5:
            out.append(("vv_plazos_cliente", None))
    return out


def coplanar_vs_inclinado():
    def lado(titulo, sub, svg, pros, color, fondo, borde):
        lis = "".join(f'<div style="display: flex; gap: 7px; padding: 5px 0; border-top: 1px solid {borde}">'
                      f'{icono(i, c, 14)}<span style="font-size: 12.3px; line-height: 1.4; color: {NEGRO}">{t}</span></div>'
                      for i, c, t in pros)
        return (f'<div style="flex: 1; min-width: 0; border: 1.5px solid {borde}; border-radius: 12px; background: {fondo}; '
                f'padding: 11px 13px 8px"><div style="font-family: {SANS}; font-size: 14.5px; font-weight: 700; '
                f'color: {color}">{titulo}</div><div style="font-size: 11.5px; color: {GRIS}">{sub}</div>'
                f'<div style="text-align: center; margin: 4px 0 2px">{svg}</div>{lis}</div>')
    verde, rojo = "#3d6b47", ROJO
    return _envolver(_rotulo_v("LA INCLINACIÓN QUE SE OFRECE EN LA VISITA") + '<div style="display: flex; gap: 12px">'
        + lado("Inclinado", "Mirando al norte, a unos 25 grados: el diseño por defecto", _techo_svg(False),
               [("check", verde, "Genera lo máximo"), ("no", rojo, "Estructura más cara y montaje más largo"),
                ("no", rojo, "Queda como una vela contra el viento sur")], "#5b6278", "#ffffff", "#d8dce6")
        + lado("Coplanar", "Pegado al techo: se ofrece cuando es más sencillo", _techo_svg(True),
               [("no", rojo, "Pierde alrededor del 10 % de generación"),
                ("check", verde, "<strong>Voltia regala un 10 % más de paneles</strong>: genera lo mismo"),
                ("check", verde, "Casi no se ve y no hace vela")], OP, TINTE, NARANJA_BORDE)
        + '</div>')


def plazos_cliente():
    """Lo negativo que se cuenta antes de que compre: cuánto tarda en ver el ahorro."""
    hitos = [("Compra", None), ("Obra", "2 o 3 días"), ("UTE habilita", None), ("Primera factura", "con la microgeneración")]
    tramos = ["≈ 1 mes y medio", "≈ 1 mes", "hasta 1 mes más"]
    puntos, k = "", 0
    for k, (h, sub) in enumerate(hitos):
        puntos += (f'<div style="flex-shrink: 0; width: 104px; text-align: center">'
                   f'<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 50%; background: {OP}; '
                   f'box-shadow: 0 0 0 4px {OP_F}"></div><div style="margin-top: 8px; font-family: {SANS}; font-size: 13px; '
                   f'font-weight: 700; color: {NEGRO}">{h}</div>'
                   + (f'<div style="font-size: 11.5px; color: {GRIS}">{sub}</div>' if sub else "") + '</div>')
        if k < len(tramos):
            puntos += (f'<div style="flex: 1; min-width: 0; position: relative; height: 16px">'
                       f'<div style="position: absolute; left: -44px; right: -44px; top: 7px; height: 2px; background: {NARANJA_BORDE}"></div>'
                       f'<div style="position: absolute; left: 0; right: 0; top: -20px; text-align: center; font-family: {SANS}; '
                       f'font-size: 12px; font-weight: 700; color: {OP}">{tramos[k]}</div></div>')
    total = (f'<div style="margin: 12px 52px 0; border: 2px solid {ROJO_BORDE}; border-top: none; height: 10px; '
             f'border-radius: 0 0 8px 8px"></div><div style="text-align: center; margin-top: 6px; font-family: {SANS}; '
             f'font-size: 14px; font-weight: 700; color: {ROJO}">Hasta 4 meses para ver el ahorro completo</div>')
    return _envolver(_rotulo_v("LO QUE SE LE CUENTA ANTES DE QUE COMPRE", "0 0 26px")
                     + f'<div style="display: flex; align-items: flex-start">{puntos}</div>' + total)


def flujo_resumen():
    return _envolver(_rotulo_v("CÓMO SE ARMA EL RESUMEN DE LA VISITA") + _fila_v([
        _caja_v("Quien visita", "Le habla al bot: audios, textos, fotos y videos.", "persona"),
        _caja_v("Bot de minutas", "Arma el resumen con el formato de Voltia.", "chat"),
        _caja_v("/ok", "Lo sube al lead.", "check"),
        _caja_v("El lead en Voltia PM", "El PDF a los adjuntos; las fotos y los videos a la galería.", "doc"),
        _caja_v("Ese mismo día", "El cliente recibe el PDF. Ingeniería lo usa para el proyecto.", "firma",
                "#3d6b47", "#f1f8f2", "#bcd9c1"),
    ]))


def insistencias():
    return _envolver(_fila_v([
        _caja_v("No contesta", "Un lead o un cliente con propuesta.", "reloj", "#5b6278", "#ffffff", "#d8dce6"),
        _caja_v("1.ª insistencia", "Queda registrada en el lead.", "chat"),
        _caja_v("2.ª insistencia", "Queda registrada en el lead.", "chat"),
        _caja_v("Y las que hagan falta", "<strong>Por lo menos dos</strong>, siempre registradas.", "lista"),
    ]))


def referencia_2025():
    pasos = [("3.552", "consultas"), ("577", "leads"), ("516", "propuestas"), ("64", "visitas"), ("40", "ventas")]
    conv = ["16 %", "", "12 %", "62 %"]
    cajas = ""
    for k, (n, que) in enumerate(pasos):
        alto = 92 - k * 12
        cajas += (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end">'
                  f'<div style="height: {alto}px; border-radius: 8px; background: {["#0f2a8f", "#1836b2", "#3a55c4", "#5d74d4", "#8094e0"][k]}; '
                  f'display: flex; flex-direction: column; align-items: center; justify-content: center">'
                  f'<div style="font-family: {SANS}; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1">{n}</div>'
                  f'<div style="font-family: {SANS}; font-size: 11.5px; color: #ffffffdd">{que}</div></div></div>')
        if k < len(conv):
            cajas += (f'<div style="flex-shrink: 0; width: 40px; align-self: flex-end; padding-bottom: 14px; text-align: center; '
                      f'font-family: {SANS}; font-size: 11.5px; font-weight: 700; color: {OP}">{conv[k]}<br>→</div>')
    return _envolver(_rotulo_v("PARA TENER UNA REFERENCIA: EL EMBUDO DE 2025")
                     + f'<div style="display: flex; align-items: stretch">{cajas}</div>'
                     + f'<div style="margin-top: 7px; font-size: 12px; color: {GRIS}">Las ventas fueron el 7 % de los leads. '
                       f'Los porcentajes de visitas y ventas se cuentan sobre el paso anterior.</div>')


def checklist_onboarding(items):
    celdas = "".join(
        f'<div style="display: flex; gap: 9px; align-items: flex-start; padding: 8px 10px; border: 1.5px solid {NARANJA_BORDE}; '
        f'border-radius: 9px; background: #ffffff"><div style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; '
        f'background: {OP}; color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700; line-height: 22px; '
        f'text-align: center">{k}</div><div style="font-size: 13px; line-height: 1.4; color: {NEGRO}">{en_linea(x)}</div></div>'
        for k, x in enumerate(items, 1))
    chip = (f'<span style="display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px; border-radius: 99px; '
            f'background: {OP}; color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700">'
            f'{icono("reloj", "#ffffff", 13)}3 días hábiles para completar el onboarding</span>')
    return _envolver(f'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">'
                     f'<span></span>{chip}</div>'
                     f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px">{celdas}</div>')


def firma_contrato():
    return _envolver(_rotulo_v("EL CONTRATO, EN ORDEN") + _fila_v([
        _caja_v("Paga la seña", "Recién ahí se le manda el contrato.", "plata"),
        _caja_v("Firma el cliente", "Con firma digital, o a mano y escaneado.", "firma"),
        _caja_v("Voltia firma último", "Con firma digital. Lo hace el asesor que cerró la venta.", "firma",
                "#ffffff", OP, OP),
        _caja_v("Se lo devuelve", "Firmado por los dos.", "check", "#3d6b47", "#f1f8f2", "#bcd9c1"),
    ]) + f'<div style="margin-top: 7px; font-size: 12px; color: {GRIS}">Si Voltia firmara primero, la firma del cliente '
         f'encima invalidaría la digital.</div>')


def consultas_por_cuenta():
    def rama(n):
        return (f'<div style="display: flex; gap: 5px; align-items: stretch">'
                + _caja_v(f"Suministro {n}", "Su factura, su cuenta, su titular y la potencia de <strong>su</strong> inversor.",
                          "medidor")
                + _flecha_html()
                + _caja_v(f"Consulta {n}", "Una por cuenta UTE.", "doc", "#127a7a", "#eef8f8", "#b5dcdc", "150px")
                + '</div>')
    venta = (f'<div style="width: 150px; flex-shrink: 0; display: flex">'
             + _caja_v("Una venta con dos inversores", "Cada inversor es un suministro.", "rayo", "#5b6278", "#ffffff", "#d8dce6")
             + '</div>')
    return _envolver(f'<div style="display: flex; gap: 8px; align-items: center">{venta}{_flecha_html()}'
                     f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px">{rama(1)}{rama(2)}</div></div>')


def menos_potencia():
    return _envolver(_fila_v([
        _caja_v("UTE ofrece menos potencia", "«El balance del último año da para tantos kW».", "alerta", "#5b6278", "#ffffff", "#d8dce6"),
        _caja_v("El asesor no dice que sí", "No contesta por su cuenta. Le pasa lo que le contó el cliente de las cargas nuevas.", "no",
                ROJO, ROJO_FONDO, ROJO_BORDE),
        _caja_v("Contesta Ingeniería", "Con un informe que justifica la potencia pedida.", "doc", "#7a3fb0", "#f7f1fb", "#dcc8ee"),
    ]))


def asesor_entre_dos():
    lado = lambda t, s, ic: _caja_v(t, s, ic, "#5b6278", "#ffffff", "#d8dce6")
    medio = (f'<div style="flex-shrink: 0; width: 70px; align-self: center; text-align: center; font-family: {SANS}; '
             f'font-size: 11px; font-weight: 700; color: {OP}">cada semana<br><svg width="40" height="14" viewBox="0 0 40 14" aria-hidden="true" style="margin-top: 4px">'
             f'<path d="M2 7h36M2 7l6-5M2 7l6 5M38 7l-6-5M38 7l-6 5" stroke="{OP}" stroke-width="2" fill="none"/></svg></div>')
    return _envolver(_rotulo_v("CON FINANCIACIÓN BANCARIA, EL ASESOR HABLA CON LOS DOS")
                     + f'<div style="display: flex; align-items: stretch">'
                     + lado("El cliente", "Puede tener un pedido del banco que nunca vio.", "persona") + medio
                     + _caja_v("El asesor", "Ve qué está pendiente y lo destraba.", "equipo", "#ffffff", OP, OP) + medio
                     + lado("El banco", "Puede estar esperando algo del cliente.", "plata") + '</div>')


def estados_credito():
    return _envolver(_rotulo_v("LAS TRES CASILLAS DE LA FINANCIACIÓN") + _fila_v([
        _caja_v("Proforma generada", "Se marca sola cuando la proforma existe.", "doc"),
        _caja_v("Proforma enviada al banco", "<strong>Con esta, el onboarding cierra.</strong>", "check", "#ffffff", OP, OP),
        _caja_v("Crédito aprobado", "La tilda el asesor cuando sale. Sin esto no se da fecha de obra.", "calendario",
                "#3d6b47", "#f1f8f2", "#bcd9c1"),
    ]))


def granizo_resumen():
    tiles = _fila_v([
        _caja_v("USD 12 por panel por año", "IVA incluido. Si el granizo rompe paneles, Voltia los repone con todo incluido.", "lluvia"),
        _caja_v("Sin carencia", "Si se adhiere al contratar la obra: cubre desde la puesta en marcha.", "reloj"),
        _caja_v("Vandalismo, opcional", "Al mismo precio y con el mismo trámite. El robo no se cubre.", "escudo"),
    ], flechas=False, gap=8)
    chip = lambda t, c, f: (f'<span style="padding: 3px 10px; border-radius: 99px; background: {f}; color: {c}; '
                            f'font-family: {SANS}; font-size: 12.5px; font-weight: 700">{t}</span>')
    dice = (f'<div style="margin-top: 9px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center">'
            f'<span style="font-family: {SANS}; font-size: 12px; font-weight: 700; color: {GRIS}">SE DICE</span>'
            + chip("plan", "#3d6b47", "#e9f4ea") + chip("anualidad", "#3d6b47", "#e9f4ea") + chip("daño por granizo", "#3d6b47", "#e9f4ea")
            + f'<span style="margin-left: 14px; font-family: {SANS}; font-size: 12px; font-weight: 700; color: {GRIS}">NUNCA</span>'
            + chip("seguro", ROJO, ROJO_FONDO) + '</div>')
    return _envolver(tiles + dice)


def deja_cargado(items):
    ics = ["doc", "persona", "firma", "camara"]
    cajas = []
    for k, x in enumerate(items):
        r = partir_rotulo(x)
        t, resto = (r[0], r[1]) if r else (_sin_md(x), "")
        cajas.append(_caja_v(en_linea(t.rstrip(".")), en_linea(resto) if resto else "", ics[k % 4]))
    return _envolver(f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">'
                     + "".join(cajas) + '</div>')


def cae_a_la_obra():
    col = lambda t, items, color, fondo, borde, ic: (
        f'<div style="flex: 1; min-width: 0; border: 1.5px solid {borde}; border-radius: 12px; background: {fondo}; '
        f'padding: 10px 12px"><div style="display: flex; gap: 7px; align-items: center; font-family: {SANS}; font-size: 13.5px; '
        f'font-weight: 700; color: {color}">{icono(ic, color, 16)}{t}</div>'
        + "".join(f'<div style="margin-top: 6px; font-size: 12.3px; line-height: 1.4; color: {NEGRO}">· {i}</div>' for i in items)
        + '</div>')
    return _envolver(f'<div style="display: flex; gap: 5px; align-items: stretch">'
        + col("Lo que queda sin hacer", ["La seña sin cobrar", "El contrato sin firmar", "Un dato del cliente que falta"],
              OP, TINTE, NARANJA_BORDE, "lista") + _flecha_html()
        + col("La obra no arranca", ["En la fecha que estaba confirmada"], "#c25a12", "#fff6ef", "#efc9ad", "calendario") + _flecha_html()
        + col("Lo que cuesta", ["Una cuadrilla que estaba organizada", "Una vuelta más a la casa del cliente",
                                "La obra de otro cliente que no se hizo"], ROJO, ROJO_FONDO, ROJO_BORDE, "plata")
        + '</div>')


def reclamo_vs_etapa():
    tarjeta = (f'<div style="width: 210px; flex-shrink: 0; padding: 11px 13px; border-radius: 10px; background: #10162e; '
               f'font-family: {SANS}">'
               f'<div style="display: flex; justify-content: space-between; align-items: center">'
               f'<span style="font-size: 14px; font-weight: 700; color: #ffffff">Diego B.</span>'
               f'<span style="padding: 1px 7px; border-radius: 6px; background: #f08a24; color: #10162e; font-size: 12px; '
               f'font-weight: 700">3R</span></div>'
               f'<div style="margin-top: 4px; font-size: 11.5px; color: #aab3cc">6,5 kWp · USD 8.723</div>'
               f'<div style="margin-top: 8px; display: inline-block; padding: 2px 8px; border-radius: 6px; background: #22306a; '
               f'color: #c9d3ff; font-size: 11.5px; font-weight: 700">Cotizado</div></div>')
    expl = (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px">'
            + _caja_v("Cotizado: la etapa", "Dice <strong>dónde está</strong> el lead. Se mueve hacia adelante o hacia atrás.", "mapa")
            + _caja_v("3R: el contador de reclamos", "Dice <strong>cuántas veces se insistió</strong>. No cambia la etapa y no baja nunca.",
                      "chat", "#b4600a", "#fff6ec", "#f2cfa6")
            + '</div>')
    return _envolver(_rotulo_v("UN LEAD EN COTIZADO CON 3 RECLAMOS")
                     + f'<div style="display: flex; gap: 14px; align-items: center">{tarjeta}{expl}</div>')


def ganar_ventanas():
    return _envolver(_rotulo_v("LAS TRES VENTANAS, UNA DETRÁS DE LA OTRA") + _fila_v([
        _caja_v("1 · Marcar como Ganado", "Confirma el cierre y pone la fecha.", "check"),
        _caja_v("2 · Comisión del asesor", "Ya registrada: se corrige solo si el precio fue otro.", "plata"),
        _caja_v("3 · Crear proyecto desde lead", "Datos y potencia ya cargados.", "techo"),
        _caja_v("La ficha del proyecto", "Arranca en Onboarding.", "doc", "#3d6b47", "#f1f8f2", "#bcd9c1"),
    ]))


def escalera_prioridad(items):
    """A quién se atiende primero: una banda por grupo, más larga y más
    oscura cuanto más urgente, con dónde se lo ve en Voltia PM."""
    donde = ["Se trabaja en el proyecto", "Priorizada: Visitados", "Priorizada: Agendar visita, Cotizados y Reclamados",
             "Priorizada: Nuevos leads", "Todavía no es lead"]
    tonos = ["#0f2a8f", "#1836b2", "#3a55c4", "#8094e0", "#c3cdf3"]
    filas = ""
    for k, x in enumerate(items):
        claro = k >= 3
        ancho = 92 - k * 9
        filas += (f'<div style="display: flex; gap: 12px; align-items: center; margin-top: 6px">'
                  f'<div style="flex: 1; min-width: 0"><div style="width: {ancho}%; display: flex; gap: 12px; align-items: center; '
                  f'padding: 10px 14px; border-radius: 10px; background: {tonos[k]}">'
                  f'<div style="flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; background: {"#ffffff" if not claro else OP}; '
                  f'color: {tonos[k] if not claro else "#ffffff"}; font-family: {SANS}; font-size: 16px; font-weight: 700; line-height: 30px; '
                  f'text-align: center">{k + 1}</div>'
                  f'<div style="font-size: 14.5px; line-height: 1.35; color: {NEGRO if claro else "#ffffff"}">{en_linea(x)}</div></div></div>'
                  f'<div style="flex-shrink: 0; width: 170px; font-family: {SANS}; font-size: 11.5px; line-height: 1.3; '
                  f'color: {GRIS}">{donde[k] if k < len(donde) else ""}</div></div>')
    cab = (f'<div style="display: flex; justify-content: space-between; align-items: flex-end">'
           f'{_rotulo_v("DE LO MÁS URGENTE A LO QUE PUEDE ESPERAR", "0")}'
           f'<div style="width: 170px; font-family: {SANS}; font-size: 11px; font-weight: 700; color: {GRIS_CLARO}; '
           f'letter-spacing: 0.4px">DÓNDE SE VE</div></div>')
    return _envolver(cab + filas)


def comision_b2b():
    caja = lambda grande, chico, fondo, color: (
        f'<div style="flex: 1; min-width: 0; padding: 12px 14px; border-radius: 12px; background: {fondo}; text-align: center">'
        f'<div style="font-family: {SANS}; font-size: 26px; font-weight: 700; line-height: 1; color: {color}">{grande}</div>'
        f'<div style="margin-top: 6px; font-size: 12.5px; line-height: 1.4; color: {NEGRO if color != "#ffffff" else "#ffffffe6"}">{chico}</div></div>')
    signo = lambda t: (f'<div style="flex-shrink: 0; align-self: center; font-family: {SANS}; font-size: 26px; font-weight: 700; '
                       f'color: {OP}">{t}</div>')
    return _envolver(_rotulo_v("LA COMISIÓN DEL ASESOR EN UNA VENTA A EMPRESA")
                     + '<div style="display: flex; gap: 10px; align-items: stretch">'
                     + caja("4 %", "del precio sin IVA: la comisión base", OP_F, OP) + signo("+")
                     + caja("30 %", "de lo que consiga de markup <strong>por encima del 20&nbsp;%</strong>", OP, "#ffffff") + signo("=")
                     + caja("Su comisión", "escalonada: negociar un mejor precio también le conviene al asesor", "#e9f4ea", "#3d6b47")
                     + '</div>'
                     + f'<div style="margin-top: 7px; font-size: 12px; color: {GRIS}">El markup de las empresas arranca en 20 %.</div>')


def mas_cuadros_ventas(crudos):
    """Las reglas: (condición sobre el bloque, qué hacer). 'despues' suma
    bloques después; 'antes', antes; 'cambia', lo reemplaza."""
    empieza = lambda tipo, txt: (lambda t, c: t == tipo and (c if isinstance(c, str) else (c[0] if c else "")).startswith(txt))
    reglas = [
        (empieza("p", "**La fecha de obra.** Ventas no da fechas"), "cambia", lambda c: [("vv_fecha", None)]),
        (empieza("p", "**El objetivo más grande de la visita"), "despues",
         lambda c: [banda("Un técnico con habilidades de venta, no un vendedor con algo de técnica.")]),
        (empieza("lista", "Se arranca con un markup"), "cambia", lambda c: [("vv_markup", None)]),
        (empieza("numerada", "**Se presenta y le cuenta"), "cambia", pasos_de_la_visita),
        (empieza("p", "Se arma con el **bot de minutas"), "despues", lambda c: [("vv_resumen", None)]),
        (empieza("p", "Si un lead o un cliente con propuesta no contesta"), "despues", lambda c: [("vv_insistencias", None)]),
        (empieza("cita", "*Para tener una referencia:*"), "cambia", lambda c: [("vv_2025", None)]),
        (empieza("lista", "Confirmación formal por escrito"), "cambia", lambda c: [("vv_tareas", c)]),
        # El plazo ya lo dice el checklist de las tareas, arriba.
        (empieza("p", "**El plazo:** 3 días hábiles"), "cambia", lambda c: []),
        (empieza("p", "**El contrato.** Se le manda"), "despues", lambda c: [("vv_firma", None)]),
        (empieza("p", "**Se manda una consulta por cada cuenta UTE.**"), "despues", lambda c: [("vv_cuentas", None)]),
        (empieza("p", "**Si UTE contesta con menos potencia"), "despues", lambda c: [("vv_menos_potencia", None)]),
        (empieza("p", "**El trabajo del asesor es hablar con las dos partes"), "despues", lambda c: [("vv_dos_partes", None)]),
        (empieza("p", "**En Voltia PM:** en el proyecto, etapa **Onboarding** → subetapa **«Modalidad de"), "despues",
         lambda c: [("vv_credito", None)]),
        (empieza("p", "Con la propuesta se ofrece el **Plan de Protección"), "despues",
         lambda c: [("vv_granizo", None)]),
        (empieza("lista", "**La factura de UTE.**"), "cambia", lambda c: [("vv_deja", c)]),
        (empieza("p", "La fecha de obra la confirma Operaciones y, una vez confirmada"), "despues",
         lambda c: [("vv_obra", None), banda("Cada fecha que se mueve es plata.")]),
        (empieza("lista", "Un reclamo **no es una queja"), "despues", lambda c: [("vv_reclamo", None)]),
        (empieza("numerada", "**Marcar como Ganado:**"), "antes", lambda c: [("vv_ganar", None)]),
        (empieza("numerada", "Los clientes que **confirmaron la compra**"), "cambia", lambda c: [("vv_prioridad", c)]),
        (empieza("p", "Las propuestas a empresas se arman con el **Cotizador B2B**"), "despues", lambda c: [("vv_b2b", None)]),
    ]
    out = []
    for t, c in crudos:
        hecho = False
        for cond, modo, nuevos in reglas:
            if cond(t, c):
                if modo == "antes":
                    out += nuevos(c) + [(t, c)]
                elif modo == "despues":
                    out += [(t, c)] + nuevos(c)
                else:
                    out += nuevos(c)
                hecho = True
                break
        if not hecho:
            out.append((t, c))
    return out


def cuadros_ventas(crudos):
    """En el Manual de Ventas: las tablas que se dibujan, y cada captura con
    números pegada a la lista que la explica (para que salga anotada)."""
    tipos = {("paso", "plazo"): "vv_embudo",
             ("paso", "qué se espera", "por qué importa"): "vv_resultados",
             ("si elige…", "tiene que…"): "vv_modalidad",
             ("cuota", "cuándo"): "vv_cuotas",
             ("", "quién", "cuándo"): "vv_pase",
             ("etapa", "qué quiere decir"): "vv_pipeline"}
    out = []
    for t, c in mas_cuadros_ventas(crudos):
        if t == "numerada" and c and c[0].startswith("**Consulta.**"):
            out.append(("vv_embudo_dibujo", c))
            continue
        if t == "tabla":
            tipo = tipos.get(tuple(x.strip().lower() for x in c[0]))
            if tipo:
                out.append((tipo, c[1]))
                continue
        if t == "captura" and c[0] in MARCAS_CAPTURA_VENTAS:
            # Sube hasta la lista que numera, sin pasar de un subtítulo.
            j = len(out) - 1
            while j >= 0 and out[j][0] not in ("h3", "h4"):
                if out[j][0] == "lista" and marcas_de(c[0], out[j][1]):
                    out.insert(j + 1, (t, c))
                    break
                j -= 1
            else:
                out.append((t, c))
            continue
        out.append((t, c))
    return out


# Dónde va cada número sobre las capturas de Ventas (en % de la imagen), en el
# orden de la lista que la acompaña. Ubicados mirando la captura el 12-oct-2026.
MARCAS_CAPTURA_VENTAS = {
    "ventas-panel-lead#Propuestas co": [(51.8, 29.5), (51.8, 63.0), (51.8, 78.0), None, None, None],
    "ventas-armar-propuesta#el indicador d": [(19.3, 12.0), (45.0, 12.0), (88.0, 12.0), (95.5, 12.0)],
    "ventas-lista-propuestas": [(53.0, 25.2), (64.3, 61.0), (75.4, 61.0), (90.4, 61.0)],
    "ventas-consulta-ute": [(22.0, 13.0), (46.5, 21.0), (46.5, 35.0), (46.5, 63.0), (97.0, 9.0), None],
}
MARCAS_CAPTURA.update({k: v for k, v in MARCAS_CAPTURA_VENTAS.items()})
MARCAS_CAPTURA_VENTAS = {k.split("#")[0]: v for k, v in MARCAS_CAPTURA_VENTAS.items()}


VISUALES = {
    "vo_bloques_plazos": bloques_plazos,
    "vv_embudo": embudo_plazos,
    "vv_embudo_dibujo": embudo_dibujo,
    "vv_fecha": lambda c: fecha_obra_cadena(),
    "vv_paso": lambda c: paso_visita(*c),
    "vv_markup": lambda c: markup_escala(),
    "vv_coplanar": lambda c: coplanar_vs_inclinado(),
    "vv_plazos_cliente": lambda c: plazos_cliente(),
    "vv_resumen": lambda c: flujo_resumen(),
    "vv_insistencias": lambda c: insistencias(),
    "vv_2025": lambda c: referencia_2025(),
    "vv_tareas": checklist_onboarding,
    "vv_firma": lambda c: firma_contrato(),
    "vv_cuentas": lambda c: consultas_por_cuenta(),
    "vv_menos_potencia": lambda c: menos_potencia(),
    "vv_dos_partes": lambda c: asesor_entre_dos(),
    "vv_credito": lambda c: estados_credito(),
    "vv_granizo": lambda c: granizo_resumen(),
    "vv_deja": deja_cargado,
    "vv_obra": lambda c: cae_a_la_obra(),
    "vv_reclamo": lambda c: reclamo_vs_etapa(),
    "vv_ganar": lambda c: ganar_ventanas(),
    "vv_prioridad": escalera_prioridad,
    "vv_b2b": lambda c: comision_b2b(),
    "vv_resultados": resultados_embudo,
    "vv_modalidad": modalidad_pago,
    "vv_cuotas": cuotas_pago,
    "vv_pase": pase_pasos,
    "vv_pipeline": etapas_pipeline,
    # La captura y su lista numerada van en un solo bloque: nunca quedan en
    # hojas distintas.
    "vo_marcada_tarjeta": lambda c: captura_marcada(c[0], c[1], c[2]) + tarjeta_lista(c[3], c[4], c[2]),
    "vo_marcada_leyenda": lambda c: (captura_marcada(c[0], c[1], c[2])
                                     + (f'  <p style="margin: 14px 0 0; font-size: 15px; line-height: 1.6; color: {TEXTO}">'
                                        f'{en_linea(c[4])}</p>\n' if c[4] else "")
                                     + leyenda_marcada(c[3], c[2][:len(c[3])])),
    "vo_leyenda_sigue": lambda c: leyenda_marcada(c[0], c[1], c[2]),
    "vo_caso": lambda c: caso(*c),
    "vo_centro": lambda c: centro_cadena(),
    "vo_requisitos": requisitos_fecha,
    "vo_causa": lambda c: causa_efecto(*c),
    "vo_areas": areas_tarjetas,
    "vo_preguntas": preguntas,
    "vo_cadena": cadena_seguridad,
    "vo_visitas": lambda c: comparar_visitas(*c),
    "vo_fechas": dos_fechas,
    "vo_cuadrilla": decision_cuadrilla,
    "vo_escalera": escalera_aprobacion,
    "vo_sancion": matriz_sancion,
    "vo_chips": chips_dia,
    "vo_documentos": documentos_ute,
    "vo_cuatro": cuatro_cosas,
    "vo_rutina": rutina,
    "vo_tarjeta_lista": lambda c: tarjeta_lista(*c),
    "vo_tarjetas": tarjetas_rotulo,
    "vo_filas": filas_rotulo,
    "vo_baldosas": baldosas,
    "vo_pasos": pasos_horizontales,
    "vo_montaje": lambda c: panel_montaje(),
    "vo_antiisla": lambda c: ensayo_antiisla(),
    "vo_estados": lambda c: estados_informe(),
    "vo_tierra": lambda c: puesta_tierra(),
    "vo_pago": lambda c: pago_50_50(),
}


# Las capturas de Voltia PM de cada manual: nombre que usa el .md → id del asset.
CAPTURAS = {}
for _f in ("capturas-operaciones.json", "capturas-ventas.json"):
    if os.path.exists(os.path.join(AQUI, _f)):
        CAPTURAS.update(json.load(open(os.path.join(AQUI, _f))))


# Las capturas chicas (un recuadro, una tarjeta) se muestran a su tamaño de
# pantalla y no estiradas al ancho de la hoja: ancho máximo en px.
ANCHO_CAPTURA = {"ventas-tarjeta-lead": 290, "ventas-presentacion-es": 470, "ventas-lista-propuestas": 470}


def captura(nombre, epigrafe):
    """Una pantalla de Voltia PM con su epígrafe. Las altas (los paneles de
    etapa) se limitan de alto para que no ocupen una hoja entera."""
    return (f'  <figure style="margin: 16px 0 0">\n'
            f'    <img src="/_blob/{CAPTURAS[nombre]}" alt="{en_linea(epigrafe)}" style="display: block; '
            f'max-width: {str(ANCHO_CAPTURA[nombre]) + "px" if nombre in ANCHO_CAPTURA else "100%"}; max-height: 520px; width: auto; margin: 0 auto; border: 1px solid {BORDE}; '
            f'border-radius: 8px">\n'
            f'    <figcaption style="margin-top: 7px; font-family: {SANS}; font-size: 12px; line-height: 1.45; '
            f'color: {GRIS}; text-align: center">{en_linea(epigrafe)}</figcaption>\n'
            f'  </figure>\n')


def item_numerado(x):
    """Un paso de una lista numerada: puede tener más de un párrafo (separados
    por una línea en blanco en el .md) y una sublista con viñetas."""
    partes = x.split("\n- ")
    html = '<span style="display: block; height: 7px"></span>'.join(en_linea(p) for p in partes[0].split("\n\n"))
    if len(partes) > 1:
        html += "".join(f'<span style="display: flex; gap: 8px; margin-top: 5px"><span style="color: {AZUL}">•</span>'
                        f'<span>{en_linea(sv)}</span></span>' for sv in partes[1:])
    return html


def en_linea_small(t):
    """El texto de una cita en <small> (un mensaje modelo): se respetan los
    saltos de línea (<br>) y se escapa lo demás."""
    t = re.sub(r"</?small>", "", t)
    return "<br>".join(en_linea(x.strip()) for x in re.split(r"<br\s*/?>", t))


def mensaje_modelo(c):
    """Un mensaje que se le manda al cliente, citado entero en letra chica (el
    speech, la presentación de la visita, la de Experiencia Solar)."""
    texto = " ".join(c)
    color, fondo = COLOR_AREA["Ventas"]
    return (f'  <div style="margin-top: 14px; padding: 12px 16px; border-left: 3px solid {color}; '
            f'background: {fondo}; border-radius: 0 8px 8px 0">\n'
            f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; '
            f'color: {color}">MENSAJE AL CLIENTE</div>\n'
            f'    <p style="margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: {TEXTO}; font-style: italic">'
            f'{en_linea_small(texto)}</p>\n  </div>\n')


def version_registro(c):
    """Una versión del registro de cambios cuando el texto es demasiado largo
    para una fila de tabla: el número y la fecha arriba, y el texto en tramos
    que se pueden repartir entre hojas."""
    version, fecha, texto, primero = c
    cab = ""
    if primero:
        cab = (f'<div style="display: flex; gap: 12px; align-items: baseline; padding-bottom: 6px; '
               f'border-bottom: 1.5px solid {NEGRO}"><span style="font-family: {SANS}; font-size: 17px; '
               f'font-weight: 700; color: {NEGRO}">Versión {en_linea(version)}</span>'
               f'<span style="font-family: {SANS}; font-size: 13px; color: {GRIS}">{en_linea(fecha)}</span></div>')
    return (f'  <div style="margin-top: {16 if primero else 8}px">{cab}'
            f'<p style="margin: {8 if primero else 0}px 0 0; font-size: 14px; line-height: 1.5; color: {TEXTO}">'
            f'{en_linea(texto)}</p></div>\n')


def partir_registro(crudos):
    """El registro de cambios: si una versión tiene un texto tan largo que su
    fila no entra en una hoja, la tabla se pasa a bloques por versión, con el
    texto partido por oraciones en tramos de a lo sumo ~700 caracteres."""
    out = []
    for t, c in crudos:
        if t == "tabla" and [x.lower() for x in c[0]][:2] == ["versión", "fecha"] and any(len(f[2]) > 1100 for f in c[1]):
            for f in c[1]:
                oraciones = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ«¿(])", f[2])
                tramos, actual = [], ""
                for o in oraciones:
                    if actual and len(actual) + len(o) > 700:
                        tramos.append(actual)
                        actual = o
                    else:
                        actual = f"{actual} {o}".strip()
                if actual:
                    tramos.append(actual)
                for k, tr in enumerate(tramos):
                    out.append(("version", (f[0], f[1], tr, k == 0)))
            continue
        out.append((t, c))
    return out


def html_de(tipo, c):
    if tipo == "version":
        return version_registro(c)
    if tipo == "h4":
        return (f'  <h3 style="margin: 20px 0 0; font-family: {SANS}; font-size: 16.5px; font-weight: 700; '
                f'line-height: 1.25; color: {AZUL}">{en_linea(c)}</h3>\n')
    if tipo == "cita" and " ".join(c).lstrip().startswith("<small>"):
        return mensaje_modelo(c)
    if tipo in VISUALES:
        return VISUALES[tipo](c)
    if tipo == "captura":
        return captura(*c)
    if tipo == "etapas_io":
        return etapas_io(*c)
    if tipo == "tiempo":
        return linea_tiempo()
    if tipo == "lista" and all(x.startswith("[ ] ") for x in c):
        caja = (f'<span style="display: inline-block; width: 15px; height: 15px; border: 1.8px solid {NEGRO}; '
                f'border-radius: 3px; flex-shrink: 0; margin-top: 2px"></span>')
        lis = "".join(f'<div style="display: flex; gap: 12px; padding: 9px 0; border-bottom: 1px solid {BORDE}; '
                      f'font-size: 15px; line-height: 1.4; color: {TEXTO}">{caja}<span>{en_linea(x[4:])}</span></div>'
                      for x in c)
        return f'  <div style="margin-top: 12px">{lis}</div>\n'
    if tipo == "cita" and c and re.match(r"### \d+\. ", c[0]):
        m = re.match(r"### (\d+)\. (.+)", c[0])
        sub = " ".join(c[1:])
        return (f'  <div style="margin-top: 12px; display: flex; gap: 14px; padding: 14px 18px; '
                f'background: {AZUL_FONDO}; border-radius: 10px">\n'
                f'    <div style="font-family: {SANS}; font-size: 22px; font-weight: 700; color: {AZUL}; '
                f'line-height: 1.1; width: 26px; flex-shrink: 0">{m.group(1)}</div>\n'
                f'    <div><div style="font-family: {SANS}; font-size: 17px; font-weight: 700; color: {NEGRO}; '
                f'line-height: 1.3">{en_linea(m.group(2))}</div>'
                + (f'<div style="margin-top: 4px; font-size: 14px; line-height: 1.5; color: {TEXTO}">{en_linea(sub)}</div>'
                   if sub else "") + '</div>\n  </div>\n')
    if tipo == "cita" and " ".join(c).startswith("**Plantilla"):
        texto = " ".join(c)
        m = re.match(r"\*\*(Plantilla [^*]+?)\.?\*\*\s*(.*)", texto)
        return (f'  <div style="margin-top: 14px; padding: 12px 16px; border-left: 3px solid {COLOR_AREA["Experiencia Solar"][0]}; '
                f'background: {COLOR_AREA["Experiencia Solar"][1]}; border-radius: 0 8px 8px 0">\n'
                f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; '
                f'color: {COLOR_AREA["Experiencia Solar"][0]}">{en_linea(m.group(1)).upper()} · LA MANDA EXPERIENCIA SOLAR</div>\n'
                f'    <p style="margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: {TEXTO}; font-style: italic">'
                f'{en_linea(m.group(2))}</p>\n  </div>\n')
    if tipo == "flujo":
        return flujo_etapas(*c)
    if tipo == "ventas":
        return proceso_ventas(*c)
    if tipo == "ingenieria":
        return trabajo_ingenieria(*c)
    if tipo == "burbujas":
        return cliente_burbujas(c)
    if tipo == "pantalla":
        return pantalla_anotada(c)
    if tipo == "casos":
        return casos_tarjetas(c)
    if tipo == "operaciones":
        return camino_operaciones()
    if tipo == "hitos":
        return hitos_ute(c)
    if tipo == "etapas_cliente":
        return etapas_cliente(c)
    if tipo == "tarjetas":
        return tarjetas_areas(*c)
    if tipo == "tabla" and [x.strip().lower() for x in c[0]] == ["quién", "de qué habla"]:
        return quien_habla(c[1])
    if tipo == "h3":
        return (f'  <h2 style="margin: 28px 0 0; font-family: {SANS}; font-size: 21px; font-weight: 700; '
                f'letter-spacing: -.4px; line-height: 1.2; color: {NEGRO}">{en_linea(c)}</h2>\n')
    if tipo == "p":
        return (f'  <p style="margin: 12px 0 0; font-size: 15px; line-height: 1.6; color: {TEXTO}">'
                f'{en_linea(c)}</p>\n')
    if tipo == "tabla":
        cab, filas = c
        return tabla_pgt([en_linea(x).upper() for x in cab], [[en_linea(x) for x in f] for f in filas],
                         anchos_de(cab))
    if tipo == "lista" and len(c) >= 8:
        lis = "".join(f'<li style="margin: 0 0 5px; font-size: 14px; line-height: 1.45; color: {TEXTO}">'
                      f'{en_linea(x)}</li>' for x in c)
        return (f'  <ul style="margin: 12px 0 0; padding-left: 20px; columns: 2; column-gap: 28px">'
                f'{lis}</ul>\n')
    if tipo == "lista":
        lis = "".join(f'<li style="margin: 0 0 8px; font-size: 15px; line-height: 1.55; color: {TEXTO}">'
                      f'{en_linea(x)}</li>' for x in c)
        return f'  <ul style="margin: 14px 0 0; padding-left: 20px">{lis}</ul>\n'
    if tipo == "numerada":
        return numerados([item_numerado(x) for x in c], margen=14)
    if tipo == "cita":
        texto = " ".join(c)
        # Una frase corta en negrita es "la regla": va en el bloque azul. Lo
        # demás, en el recuadro de lo que importa.
        if texto.startswith("**") and texto.endswith("**") and len(texto) < 160:
            return (f'  <div style="margin-top: 18px; padding: 20px 24px; background: {AZUL}; border-radius: 12px">\n'
                    f'    <p style="margin: 0; font-family: {SANS}; font-size: 21px; font-weight: 600; '
                    f'line-height: 1.32; color: #ffffff; letter-spacing: -.3px">{en_linea(texto.strip("*"))}</p>\n'
                    f'  </div>\n')
        return (f'  <div style="margin-top: 18px; padding: 16px 20px; background: {AZUL_FONDO}; border-radius: 8px">\n'
                f'    <p style="margin: 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">{en_linea(texto)}</p>\n'
                f'  </div>\n')
    raise ValueError(tipo)


# ── La forma de las hojas ─────────────────────────────────────────────────────

def apertura(numero, titulo, rotulo=None):
    """Donde empieza un capítulo: el número grande y el título, con una regla
    azul debajo. Para los anexos, el rótulo ANEXO en lugar del número."""
    if numero is None:
        cifra = ""
        rot = rotulo or "ANEXO"
    else:
        cifra = (f'    <div style="font-family: {SANS}; font-size: 92px; font-weight: 700; line-height: .78; '
                 f'color: {AZUL}; letter-spacing: -3px">{numero}</div>\n')
        rot = f"CAPÍTULO {numero}"
    return (f'  <div style="display: flex; align-items: flex-end; gap: 20px; padding-bottom: 20px; '
            f'border-bottom: 3px solid {AZUL}">\n'
            f'{cifra}'
            f'    <div>\n'
            f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.2px; '
            f'color: {AZUL}">{rot}</div>\n'
            f'      <h1 style="margin: 8px 0 0; font-family: {SANS}; font-size: 38px; font-weight: 700; '
            f'letter-spacing: -1px; line-height: 1.08; color: {NEGRO}; text-wrap: balance">{en_linea(titulo)}</h1>\n'
            f'    </div>\n'
            f'  </div>\n')


def continua(numero, titulo, rotulo=None):
    rot = (f"CAPÍTULO {numero} · {titulo}" if numero is not None
           else (titulo if rotulo == "" else f"{rotulo or 'ANEXO'} · {titulo}"))
    return (f'  <div style="padding-bottom: 10px; border-bottom: 1px solid {BORDE}; font-family: {SANS}; '
            f'font-size: 11px; font-weight: 600; letter-spacing: 1.8px; color: {GRIS_CLARO}">'
            f'{en_linea(rot).upper()} <span style="color: {GRIS}; letter-spacing: .4px; font-weight: 500">'
            f'· continúa</span></div>\n')


def portadilla(parte, nombre, texto, capitulos, numero, foto):
    lista = ""
    for num, cap in capitulos:
        lista += (f'      <div style="display: flex; gap: 16px; padding: 13px 0; '
                  f'border-bottom: 1px solid rgba(255,255,255,.18)">\n'
                  f'        <span style="font-family: {SANS}; font-size: 15px; font-weight: 700; '
                  f'color: #8f9ad4; width: 24px; flex-shrink: 0">{num}</span>\n'
                  f'        <span style="font-family: {SANS}; font-size: 18px; font-weight: 600; '
                  f'color: #ffffff">{en_linea(cap)}</span>\n'
                  f'      </div>\n')
    cuerpo = (
        f'  <div style="font-family: {SANS}; font-size: 12px; font-weight: 600; letter-spacing: 3px; '
        f'color: #8f9ad4">PARTE {parte}</div>\n'
        f'  <h1 style="margin: 14px 0 0; font-family: {SANS}; font-size: 56px; font-weight: 700; '
        f'letter-spacing: -1.8px; line-height: 1.02; color: #ffffff; text-wrap: balance">{nombre}</h1>\n'
        f'  <p style="margin: 24px 0 0; max-width: 540px; font-size: 18px; line-height: 1.6; color: #dde3f8; '
        f'text-wrap: pretty">{texto}</p>\n'
        f'  <div style="margin-top: 44px">\n'
        f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2px; '
        f'color: #8f9ad4; margin-bottom: 6px">LOS CAPÍTULOS DE ESTA PARTE</div>\n'
        f'{lista}  </div>\n'
    )
    fondo = (f"linear-gradient(180deg, rgba(12,22,72,.86) 0%, rgba(24,54,178,.70) 55%, "
             f"rgba(12,22,72,.90) 100%), url('{foto}') center / cover no-repeat")
    return pagina(f"Parte {parte} — {nombre}", cuerpo, numero, fondo=fondo,
                  padding="80px 72px 56px", color_pie="#8f9ad4", borde_pie="#4a63c6")


def suelta(titulo_tab, raiz):
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{titulo_tab}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="{FUENTES}" rel="stylesheet">
<style>
body {{ margin: 0; font-family: {SERIF}; background: #ffffff; }}
</style>
</helmet>
{raiz}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{ANCHO},"height":{ALTO}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


def portada(version, bajada):
    return suelta(f"Portada — {CONFIG['corto']}", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
  <div style="height: 596px; position: relative; overflow: hidden; background: #dfe4f6">
    <img src="{IMG.PORTADA}" alt="" style="display: block; width: 100%; height: 100%; object-fit: cover">
    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,24,72,.12) 0%, rgba(16,24,72,0) 42%, rgba(255,255,255,.22) 100%)"></div>
  </div>
  <div style="flex-grow: 1; padding: 54px 72px 0; display: flex; flex-direction: column">
    <img src="{IMG.LOGO}" alt="Voltia" style="display: block; height: 42px; width: auto; align-self: flex-start">
    <h1 style="margin: 16px 0 0; font-family: {SANS}; font-size: 58px; font-weight: 700; line-height: 1.02; letter-spacing: -1.6px; color: {NEGRO}">{CONFIG['titulo']}</h1>
    <div style="margin-top: 10px; font-family: {SANS}; font-size: 30px; font-weight: 600; letter-spacing: -.5px; color: {AZUL}">{CONFIG['subtitulo']}</div>
    <p style="margin: 22px 0 0; max-width: 560px; font-size: 16px; line-height: 1.6; color: {TEXTO}">{bajada}</p>
    <div style="flex-grow: 1"></div>
    <div style="display: flex; align-items: center; gap: 8px; padding-bottom: 30px">
      <img src="{IMG.LOGO_ISOTIPO}" alt="" style="display: block; height: 14px; width: auto; opacity: .55">
      <span style="font-family: {SANS}; font-size: 13px; color: {GRIS_CLARO}">{version} · documento interno</span>
    </div>
  </div>
  <div style="height: 22px; background: {AZUL}"></div>
</div>""")


def cierre(version):
    return suelta(f"Cierre — {CONFIG['corto']}", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
  <div style="height: 470px; position: relative; overflow: hidden; background: #dfe4f6">
    <img src="{IMG.CIERRE}" alt="" style="display: block; width: 100%; height: 100%; object-fit: cover">
  </div>
  <div style="flex-grow: 1; padding: 62px 72px 0; display: flex; flex-direction: column">
    <!-- Sin frase por ahora: más adelante va la misión de Voltia. -->
    <img src="{IMG.LOGO}" alt="Voltia" style="display: block; height: 48px; width: auto; align-self: flex-start">
    <div style="flex-grow: 1"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 34px; font-family: {SANS}; font-size: 12px; color: {GRIS_CLARO}">
      <span style="display: flex; align-items: center; gap: 7px"><img src="{IMG.LOGO_ISOTIPO}" alt="Voltia" style="display: block; height: 13px; width: auto">{PIE}</span>
      <span>{version}</span>
    </div>
  </div>
  <div style="height: 22px; background: {AZUL}"></div>
</div>""")


def hoja_reglas(lineas, numero, titulo="Las reglas en una página", rotulo="ANEXO"):
    """El anexo de las reglas en una página, en oscuro, leído del .md: cada regla
    es una cita que empieza con '### N.' y puede tener una línea debajo."""
    reglas = []
    for tipo, c in bloques_de(lineas):
        if tipo != "cita" or not re.match(r"### \d+\. ", c[0]):
            continue
        m = re.match(r"### (\d+)\. (.+)", c[0])
        reglas.append((int(m.group(1)), m.group(2), " ".join(c[1:]) or None))
    items = ""
    for n, t, d in reglas:
        sub = (f'\n        <p style="margin: 5px 0 0 32px; font-size: 13px; line-height: 1.45; color: #b8bdd4">'
               f'{en_linea(d)}</p>' if d else "")
        items += (f'      <div style="padding: 15px 0; border-bottom: 1px solid #2a2f45">\n'
                  f'        <div style="display: flex; gap: 12px; align-items: baseline">\n'
                  f'          <span style="font-family: {SANS}; font-size: 15px; font-weight: 700; color: #7f8fd8; '
                  f'width: 20px; flex-shrink: 0">{n:02d}</span>\n'
                  f'          <span style="font-family: {SANS}; font-size: 18px; font-weight: 600; color: #ffffff; '
                  f'line-height: 1.3">{en_linea(t)}</span>\n'
                  f'        </div>{sub}\n'
                  f'      </div>\n')
    cuerpo = (
        f'  <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.4px; color: #8f9ad4">{rotulo}</div>\n'
        f'  <h1 style="margin: 10px 0 0; font-family: {SANS}; font-size: 42px; font-weight: 700; letter-spacing: -1.1px; '
        f'line-height: 1.05; color: #ffffff">{titulo}</h1>\n'
        f'  <div style="margin-top: 22px; border-top: 1px solid #2a2f45">\n{items}  </div>\n'
    )
    return pagina(titulo, cuerpo, numero, fondo=NEGRO, padding="64px 64px 52px",
                  color_pie="#8f9ad4", borde_pie="#2a2f45")


# ── Armado ────────────────────────────────────────────────────────────────────

def leer_fuente():
    lineas = open(FUENTE, encoding="utf-8").read().split("\n")
    # "Versión 0.7 · del 10/10/26": la portada lleva la versión y la fecha desde
    # la que rige, corta (pedido del 10-oct-2026).
    m = re.search(r"Versión ([\d.]+) · del (\d{2}/\d{2}/\d{2})", lineas[2])
    if m:
        version = f"Versión {m.group(1)} · del {m.group(2)}"
    else:
        # Mientras es borrador la cabecera no lleva número: "Borrador en revisión — fecha".
        b = re.search(r"· ([^·]+?) — (.+)$", lineas[2])
        version = f"{b.group(1)} · {b.group(2).split(' de ', 1)[-1]}" if b else "Borrador"
    # La presentación (la cita de arriba): su primer párrafo va a la portada y
    # el resto al principio del capítulo 0.
    intro, i = [], 4
    while i < len(lineas) and lineas[i].startswith(">"):
        intro.append(lineas[i][1:].strip())
        i += 1
    parrafos, actual = [], []
    for x in intro:
        if x:
            actual.append(x)
        elif actual:
            parrafos.append(" ".join(actual))
            actual = []
    if actual:
        parrafos.append(" ".join(actual))
    capitulos, cap = [], None
    for l in lineas[i:]:
        mm = re.match(r"^## (?:(\d+) · |Anexo · )(.+)$", l)
        ms = re.match(r"^## (?!\d+ · |Anexo · )(.+)$", l)
        if mm:
            cap = {"num": int(mm.group(1)) if mm.group(1) else None, "titulo": mm.group(2).strip(), "lineas": []}
            capitulos.append(cap)
        elif ms:
            # Una sección sin número ni "Anexo" (en Ventas, "Las reglas de
            # Ventas"): va en su lugar, entre los capítulos.
            cap = {"num": None, "titulo": ms.group(1).strip(), "lineas": [], "suelta": True}
            capitulos.append(cap)
        elif cap is not None:
            cap["lineas"].append(l)
    return version, parrafos, capitulos


def construir():
    version, parrafos, capitulos = leer_fuente()
    P, n = [], [0]

    def hoja(archivo, titulo_board, hacer):
        n[0] += 1
        P.append((archivo, f"{n[0]} · {titulo_board}", hacer(n[0])))

    hoja("Main.dc.html", "Portada", lambda p: portada(version, en_linea(parrafos[0])))

    por_num = {c["num"]: c for c in capitulos if c["num"] is not None}
    anexos = [c for c in capitulos if c["num"] is None]

    def capitulo(cap, base, cabezas=None):
        clave = ("s" if cap.get("suelta") else "a") if cap["num"] is None else str(cap["num"])
        clave += re.sub(r"[^a-z]", "", cap["titulo"].lower())[:8]
        crudos = bloques_de(cap["lineas"])
        if cap["num"] == 0 and len(parrafos) > 1:
            crudos = [("cita", [" ".join(parrafos[1:])])] + crudos
        if MANUAL == "pgt":
            crudos = juntar_secciones(juntar_ingenieria(juntar_ventas(partir_areas(juntar_recorrido(crudos)))))
            crudos = juntar_cliente_pm_casos(crudos, cap["num"])
        elif MANUAL == "ventas":
            # Las notas de armado del .md (qué falta ordenar, de qué material
            # sale) no van al manual impreso: le hablan a quien lo escribe.
            crudos = [(t, c) for t, c in crudos
                      if not (t == "p" and c.startswith("*Por ordenar"))
                      and not (t == "cita" and "`docs/" in " ".join(c))]
            # Las reglas ya salieron en su hoja oscura: acá queda lo demás.
            if cap.get("suelta"):
                crudos = [(t, c) for t, c in crudos if not (t == "cita" and re.match(r"### \d+\. ", c[0]))]
            crudos = foto_primero(visualizar_operaciones(cuadros_ventas(partir_registro(crudos)), cap["num"]))
        else:
            crudos = juntar_operaciones(crudos)
            crudos = foto_primero(visualizar_operaciones(crudos, cap["num"]))
        cabeza1, cabeza2 = cabezas or (apertura(cap["num"], cap["titulo"]), continua(cap["num"], cap["titulo"]))
        BLOQUES[f"{clave}_ap"] = cabeza1
        BLOQUES[f"{clave}_co"] = cabeza2
        items = []
        for k, (t, c) in enumerate(crudos):
            bid = f"{clave}_{k}"
            BLOQUES[bid] = html_de(t, c)
            items.append((bid, t, c))

        def alto(bid, html):
            if bid in ALTURAS:
                return ALTURAS[bid]["h"]
            return altura_estimada(html)

        # Reparto en hojas. Una tabla que no entra se parte por filas y repite
        # la cabecera; el resto de los bloques no se parte nunca.
        hojas, actual = [], []
        usado = alto(f"{clave}_ap", cabeza1) + 6
        def lo_que_sigue(k):
            """Lo que tiene que entrar junto con el bloque k: un subtítulo o una
            frase que termina en dos puntos no se queda sola al pie de la hoja."""
            if k + 1 >= len(items):
                return 0
            t, c = items[k][1], items[k][2]
            if t == "vo_marcada":
                sid = items[k + 1][0]
                return alto(sid, BLOQUES[sid])
            rotulo = t == "p" and re.fullmatch(r"\*\*[^*]{1,60}\*\*", c.strip()) is not None
            sid, st, sc = items[k + 1]
            # Un cuadro de Ventas viaja con el bloque que lo presenta.
            if st.startswith("vv_") and st != "vv_paso" and not t.startswith("vv_") and t not in ("h3", "h4"):
                return alto(sid, BLOQUES[sid])
            presenta = t == "p" and st in ("hitos", "operaciones", "ventas", "ingenieria", "flujo", "etapas_cliente",
                                           "pantalla", "etapas_io", "tiempo", "captura") or (t == "p" and st in VISUALES)
            if not (t in ("h3", "h4") or rotulo or presenta or (t == "p" and c.rstrip().rstrip("*").endswith(":"))):
                return 0
            # Un párrafo que presenta un dibujo viaja con el dibujo.
            if st == "vo_marcada" and k + 2 < len(items):
                nid = items[k + 2][0]
                return alto(sid, BLOQUES[sid]) + min(alto(nid, BLOQUES[nid]), 260)
            if st in ("hitos", "operaciones", "ventas", "ingenieria", "flujo", "etapas_cliente", "etapas_io",
                      "tiempo", "captura") or st in VISUALES:
                return alto(sid, BLOQUES[sid])
            if st == "tabla" and "cab" in ALTURAS.get(sid, {}):
                return 16 + ALTURAS[sid]["cab"] + ALTURAS[sid]["filas"][0]
            # En cadena: si lo que sigue también tiene que ir con lo suyo
            # (título → párrafo → dibujo), se suma todo.
            return alto(sid, BLOQUES[sid]) + lo_que_sigue(k + 1)

        for k_item, (bid, t, c) in enumerate(items):
            html = BLOQUES[bid]
            h = alto(bid, html)
            junto = lo_que_sigue(k_item)
            if t == "tabla" and "cab" in ALTURAS.get(bid, {}) and usado + h > CAPACIDAD:
                cab, filas = c
                med = ALTURAS[bid]
                resto = list(range(len(filas)))
                while resto:
                    lugar = CAPACIDAD - usado - 16 - med["cab"]
                    tomo = []
                    while resto and (sum(med["filas"][j] for j in tomo + [resto[0]]) <= lugar):
                        tomo.append(resto.pop(0))
                    if actual and len(tomo) < min(3, len(filas)) and resto:
                        # No se deja una tabla empezada con una o dos filas al pie:
                        # arranca en la hoja siguiente (pedido del 11-oct-2026).
                        resto = tomo + resto
                        tomo = []
                    if not tomo and actual:
                        hojas.append(actual)
                        actual, usado = [], alto(f"{clave}_co", cabeza2) + 6
                        continue
                    if not tomo:
                        tomo.append(resto.pop(0))
                    actual.append(html_de("tabla", (cab, [filas[j] for j in tomo])))
                    usado += 16 + med["cab"] + sum(med["filas"][j] for j in tomo)
                    if resto:
                        hojas.append(actual)
                        actual, usado = [], alto(f"{clave}_co", cabeza2) + 6
                continue
            if actual and usado + h + junto > CAPACIDAD:
                hojas.append(actual)
                actual, usado = [], alto(f"{clave}_co", cabeza2) + 6
            actual.append(html)
            usado += h
        hojas.append(actual)
        nombre = (f"Cap. {cap['num']} · {cap['titulo']}" if cap["num"] is not None
                  else (cap["titulo"] if cap.get("suelta") else f"Anexo · {cap['titulo']}"))
        for k, contenido in enumerate(hojas):
            cuerpo = (cabeza1 if k == 0 else cabeza2) + '  <div style="height: 6px"></div>\n' + "".join(contenido)
            titulo_board = nombre + ("" if k == 0 and not cabezas else " (sigue)")
            hoja(f"{base}{'' if k == 0 else f'_{k + 1}'}.dc.html", titulo_board,
                 lambda p, c=cuerpo, t=titulo_board: pagina(t, c, p))

    for parte, nombre, nums, texto, foto in PARTES:
        caps = [(k, por_num[k]["titulo"]) for k in nums]
        hoja(f"Parte{parte}.dc.html", f"Parte {parte} · {nombre}",
             lambda p, a=(parte, nombre, texto, caps, foto): portadilla(a[0], a[1], a[2], a[3], p, a[4]))
        for k in nums:
            capitulo(por_num[k], f"Cap{k}")

    if not PARTES:
        # Sin partes (Ventas): los capítulos y las secciones sueltas, en el
        # orden del .md. Una sección de reglas va en hoja oscura, y lo que trae
        # además de las reglas sigue en hojas comunes.
        anexos = []
        for c in capitulos:
            if c["num"] is not None:
                capitulo(c, f"Cap{c['num']}")
            elif not c.get("suelta"):
                anexos.append(c)
            else:
                base = re.sub(r"[^A-Za-z]", "", c["titulo"].title())[:24]
                if c["titulo"].startswith("Las reglas"):
                    hoja(f"{base}.dc.html", c["titulo"],
                         lambda p, l=c["lineas"], t=c["titulo"]: hoja_reglas(l, p, t, "LAS REGLAS DEL ÁREA"))
                    resto = [b for b in bloques_de(c["lineas"]) if not (b[0] == "cita" and re.match(r"### \d+\. ", b[1][0]))]
                    if resto:
                        co = continua(None, c["titulo"], "")
                        capitulo(c, f"{base}_", cabezas=(co, co))
                else:
                    capitulo(c, base, cabezas=(apertura(None, c["titulo"], " "), continua(None, c["titulo"], "")))

    for a in anexos:
        base = "Anexo" + re.sub(r"[^A-Za-z]", "", a["titulo"].title())[:24]
        if a["titulo"].startswith("Las reglas"):
            hoja(f"{base}.dc.html", f"Anexo · {a['titulo']}", lambda p, l=a["lineas"]: hoja_reglas(l, p))
        else:
            capitulo(a, base)

    hoja("Cierre.dc.html", "Cierre", lambda p: cierre(version))
    return P


if __name__ == "__main__":
    # Dos pasadas: `--bloques x.json` vuelca los bloques para medirlos;
    # `--alturas x.json` reparte las hojas con esas medidas.
    args = sys.argv[1:]
    if "--alturas" in args:
        k = args.index("--alturas")
        ALTURAS.update(json.load(open(args[k + 1])))
        del args[k:k + 2]
    if "--bloques" in args:
        construir()
        k = args.index("--bloques")
        helmet = f'<link href="{FUENTES}" rel="stylesheet"><style>body {{ margin: 0; font-family: {SERIF}; }}</style>'
        json.dump({"helmet": helmet, "ancho": ANCHO - 144, "bloques": BLOQUES},
                  open(args[k + 1], "w"), ensure_ascii=False)
        print(f"{len(BLOQUES)} bloques para medir")
        sys.exit(0)
    destino = args[0] if args else "."
    paginas = construir()
    carpeta = os.path.join(destino, "project")
    os.makedirs(carpeta, exist_ok=True)
    boards, orden = {}, []
    for i, (archivo, titulo_board, html) in enumerate(paginas):
        # Un canvas nuevo tiene sus propias copias de las imágenes, con otra
        # dirección: REMAP_ASSETS es un JSON {id viejo: url nueva}.
        if os.environ.get("REMAP_ASSETS"):
            for viejo, nuevo in json.load(open(os.environ["REMAP_ASSETS"])).items():
                html = html.replace(f"/_blob/{viejo}", nuevo)
        with open(os.path.join(carpeta, archivo), "w", encoding="utf-8") as f:
            f.write(html)
        col, fila = i % 6, i // 6
        boards[archivo] = {"x": col * (ANCHO + 80), "y": fila * (ALTO + 120),
                           "w": ANCHO, "h": ALTO, "title": titulo_board, "paper": "a4"}
        orden.append(archivo)
    indice = {
        "v": 3,
        "createdOnFiles": {"v": 1, "at": "2026-09-29T02:45:00Z"},
        "title": CONFIG["canvas"],
        "launch": {"view": "canvas"},
        "pages": [],
        "designSystems": [],
        "boards": boards,
        "order": orden,
        "notes": {"titulo": {"x": 0, "y": -300, "text": CONFIG["canvas"],
                             "kind": "title1", "maxW": 6 * ANCHO + 5 * 80}},
    }
    with open(os.path.join(carpeta, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    print(f"{len(paginas)} hojas:", ", ".join(a for a, _, _ in paginas))
