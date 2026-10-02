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
FUENTE = os.path.join(AQUI, "..", "Procedimiento-General-de-Trabajo-Voltia.md")
sys.path.insert(0, AQUI)
sys.path.insert(1, POSVENTA)

import imagenes as IMG  # noqa: E402
import generar  # noqa: E402
from generar import (  # noqa: E402
    AZUL, AZUL_FONDO, BORDE, GRIS, GRIS_CLARO, NEGRO, ROJO, SANS, SERIF, TEXTO,
    ANCHO, ALTO, FUENTES, altura_estimada, numerados, pagina,
)

PIE = "Procedimiento General de Trabajo · Voltia"
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
    return t


def bloques_de(lineas):
    """Parte las líneas de un capítulo en bloques: (tipo, contenido)."""
    out, i = [], 0
    while i < len(lineas):
        l = lineas[i]
        if not l.strip() or l.strip() == "---":
            i += 1
            continue
        if l.startswith("### "):
            out.append(("h3", l[4:].strip()))
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
            while i < len(lineas) and (re.match(r"^\d+\. ", lineas[i]) or lineas[i].startswith("   ")):
                if re.match(r"^\d+\. ", lineas[i]):
                    items.append(re.sub(r"^\d+\. ", "", lineas[i]).strip())
                else:
                    items[-1] += " " + lineas[i].strip()
                i += 1
            out.append(("numerada", items))
        else:
            par = []
            while i < len(lineas) and lineas[i].strip() and not re.match(r"^(\||>|- |\d+\. |### |---)", lineas[i]):
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
    return (f'  <table style="width: 100%; border-collapse: collapse; margin-top: {margen}px">'
            f'<thead><tr>{ths}</tr></thead><tbody>{trs}</tbody></table>\n')


def anchos_de(cabeceras):
    """Anchos de columna razonables según cuántas hay: la primera más angosta."""
    n = len(cabeceras)
    if n == 2:
        return [220, None]
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
        (1, 46, 2.5, "El menú, con una sección por área"),
        (2, 7, 45, "La lista de clientes, para elegir con cuál trabajar"),
        (3, 57, 21, "Los botones que llevan al mismo cliente en otras secciones"),
        (4, 69.5, 10, "El plazo de la etapa en curso, en cuenta regresiva"),
        (5, 56, 66, "El recorrido del proyecto, etapa por etapa"),
    ]),
    "**La ficha del cliente.**": ("FICHA_ENCABEZADO", [
        (1, 56, 17, "Los datos del cliente y cuántos días hace que no se lo contacta"),
        (2, 59, 30.5, "Los botones que llevan al mismo cliente en otras secciones"),
        (3, 37, 50, "Sus tres etapas, con los pasos de cada una"),
        (4, 77, 55, "Para registrar un contacto; debajo, todo el historial"),
    ]),
    "**El calendario.**": ("CALENDARIO_OBRAS", [
        (1, 13, 10.6, "El mes, con flechas para ir y venir"),
        (2, 63, 14.7, "Qué mostrar: obras, mantenimientos, visitas…"),
        (3, 53, 21, "Rayado, fecha tentativa; lleno, fecha confirmada"),
        (4, 36, 59, "Cada obra agendada, del color de su equipo"),
        (5, 70, 7.8, "Para agendar una obra u otra cosa"),
    ]),
    "**El portal de Voltia.**": ("PORTAL_RECORTE", [
        (1, 57, 9.4, "Lo que el cliente puede abrir: proyectos, reportes, reclamos y encuestas"),
        (2, 49, 35, "En qué está su trámite"),
        (3, 26.5, 55, "Cada paso del trámite, con su fecha"),
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


def html_de(tipo, c):
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
        return numerados([en_linea(x) for x in c], margen=14)
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

def apertura(numero, titulo):
    """Donde empieza un capítulo: el número grande y el título, con una regla
    azul debajo. Para los anexos, el rótulo ANEXO en lugar del número."""
    if numero is None:
        cifra = ""
        rot = "ANEXO"
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


def continua(numero, titulo):
    rot = f"CAPÍTULO {numero} · {titulo}" if numero is not None else f"ANEXO · {titulo}"
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
    return suelta("Portada — PGT", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
  <div style="height: 596px; position: relative; overflow: hidden; background: #dfe4f6">
    <img src="{IMG.PORTADA}" alt="" style="display: block; width: 100%; height: 100%; object-fit: cover">
    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,24,72,.12) 0%, rgba(16,24,72,0) 42%, rgba(255,255,255,.22) 100%)"></div>
  </div>
  <div style="flex-grow: 1; padding: 54px 72px 0; display: flex; flex-direction: column">
    <img src="{IMG.LOGO}" alt="Voltia" style="display: block; height: 42px; width: auto; align-self: flex-start">
    <h1 style="margin: 16px 0 0; font-family: {SANS}; font-size: 58px; font-weight: 700; line-height: 1.02; letter-spacing: -1.6px; color: {NEGRO}">Procedimiento General de Trabajo</h1>
    <div style="margin-top: 10px; font-family: {SANS}; font-size: 30px; font-weight: 600; letter-spacing: -.5px; color: {AZUL}">PGT de Voltia</div>
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
    return suelta("Cierre — PGT", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
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


def hoja_reglas(lineas, numero):
    """El anexo de las reglas en una página, en oscuro, leído del .md: cada regla
    es una cita que empieza con '### N.' y puede tener una línea debajo."""
    reglas = []
    for tipo, c in bloques_de(lineas):
        if tipo != "cita":
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
        f'  <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.4px; color: #8f9ad4">ANEXO</div>\n'
        f'  <h1 style="margin: 10px 0 0; font-family: {SANS}; font-size: 42px; font-weight: 700; letter-spacing: -1.1px; '
        f'line-height: 1.05; color: #ffffff">Las reglas en una página</h1>\n'
        f'  <div style="margin-top: 22px; border-top: 1px solid #2a2f45">\n{items}  </div>\n'
    )
    return pagina("Las reglas en una página", cuerpo, numero, fondo=NEGRO, padding="64px 64px 52px",
                  color_pie="#8f9ad4", borde_pie="#2a2f45")


# ── Armado ────────────────────────────────────────────────────────────────────

def leer_fuente():
    lineas = open(FUENTE, encoding="utf-8").read().split("\n")
    m = re.search(r"Versión ([\d.]+) — (.+)$", lineas[2])
    if m:
        version = f"Versión {m.group(1)} · {m.group(2).split(' de ', 1)[-1]}"
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
        if mm:
            cap = {"num": int(mm.group(1)) if mm.group(1) else None, "titulo": mm.group(2).strip(), "lineas": []}
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

    def capitulo(cap, base):
        clave = "a" if cap["num"] is None else str(cap["num"])
        clave += re.sub(r"[^a-z]", "", cap["titulo"].lower())[:8]
        crudos = bloques_de(cap["lineas"])
        if cap["num"] == 0 and len(parrafos) > 1:
            crudos = [("cita", [" ".join(parrafos[1:])])] + crudos
        crudos = juntar_secciones(juntar_ingenieria(juntar_ventas(partir_areas(juntar_recorrido(crudos)))))
        crudos = juntar_cliente_pm_casos(crudos, cap["num"])
        cabeza1 = apertura(cap["num"], cap["titulo"])
        cabeza2 = continua(cap["num"], cap["titulo"])
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
            rotulo = t == "p" and re.fullmatch(r"\*\*[^*]{1,60}\*\*", c.strip()) is not None
            sid, st, sc = items[k + 1]
            presenta = t == "p" and st in ("hitos", "operaciones", "ventas", "ingenieria", "flujo", "etapas_cliente",
                                           "pantalla")
            if not (t == "h3" or rotulo or presenta or (t == "p" and c.rstrip().rstrip("*").endswith(":"))):
                return 0
            # Un párrafo que presenta un dibujo viaja con el dibujo.
            if st in ("hitos", "operaciones", "ventas", "ingenieria", "flujo", "etapas_cliente"):
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
                  else f"Anexo · {cap['titulo']}")
        for k, contenido in enumerate(hojas):
            cuerpo = (cabeza1 if k == 0 else cabeza2) + '  <div style="height: 6px"></div>\n' + "".join(contenido)
            titulo_board = nombre + ("" if k == 0 else " (sigue)")
            hoja(f"{base}{'' if k == 0 else f'_{k + 1}'}.dc.html", titulo_board,
                 lambda p, c=cuerpo, t=titulo_board: pagina(t, c, p))

    for parte, nombre, nums, texto, foto in PARTES:
        caps = [(k, por_num[k]["titulo"]) for k in nums]
        hoja(f"Parte{parte}.dc.html", f"Parte {parte} · {nombre}",
             lambda p, a=(parte, nombre, texto, caps, foto): portadilla(a[0], a[1], a[2], a[3], p, a[4]))
        for k in nums:
            capitulo(por_num[k], f"Cap{k}")

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
        with open(os.path.join(carpeta, archivo), "w", encoding="utf-8") as f:
            f.write(html)
        col, fila = i % 6, i // 6
        boards[archivo] = {"x": col * (ANCHO + 80), "y": fila * (ALTO + 120),
                           "w": ANCHO, "h": ALTO, "title": titulo_board, "paper": "a4"}
        orden.append(archivo)
    indice = {
        "v": 3,
        "createdOnFiles": {"v": 1, "at": "2026-09-29T02:45:00Z"},
        "title": "Procedimiento General de Trabajo (PGT) de Voltia",
        "launch": {"view": "canvas"},
        "pages": [],
        "designSystems": [],
        "boards": boards,
        "order": orden,
        "notes": {"titulo": {"x": 0, "y": -300, "text": "Procedimiento General de Trabajo (PGT) de Voltia",
                             "kind": "title1", "maxW": 6 * ANCHO + 5 * 80}},
    }
    with open(os.path.join(carpeta, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    print(f"{len(paginas)} hojas:", ", ".join(a for a, _, _ in paginas))
