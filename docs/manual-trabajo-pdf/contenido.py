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
    AZUL, AZUL_FONDO, BORDE, GRIS, GRIS_CLARO, NEGRO, SANS, SERIF, TEXTO,
    ANCHO, ALTO, FUENTES, altura_estimada, numerados, pagina,
)

PIE = "Procedimiento General de Trabajo · Voltia"
generar.configurar(PIE, IMG.LOGO_ISOTIPO, IMG.LOGO_ISOTIPO_BLANCO)

# Las partes agrupan capítulos (por número de capítulo del .md). Los anexos van
# después de la última parte, sin portadilla propia.
PARTES = [
    ("1", "Cómo se conecta Voltia", [0, 1, 2],
     "Los documentos de trabajo, el recorrido de un proyecto y las cinco reglas que valen para todas "
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
    momento. E1 arranca al cerrar la venta (al empezar Onboarding) y termina
    con la obra; E2 es el Trámite UTE; E3 arranca con la habilitación. La fecha
    de obra se confirma en la validación de Operaciones."""
    W, col = 650, 72
    caja_w, caja_h = 64, 54
    carril_h, sep = 80, 6
    carriles = ["Ventas", "Ingeniería", "Operaciones", "Tramitación UTE"]
    y_es = len(carriles) * (carril_h + sep) + 18
    es_h = 104
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
        p.append(_txt(10, y + 15, c.upper(), 9.5, 700, fuerte))

    # Las etapas, cada una en su carril.
    pos = []
    for k, (num, etapa, duena) in enumerate(etapas):
        base, sub = carril_de(duena)
        i = carriles.index(base)
        x = k * col + (col - caja_w) / 2
        y = i * (carril_h + sep) + carril_h - caja_h - 6
        pos.append((x, y))
        fuerte = COLOR_AREA[base][0]
        p.append(f'<rect x="{x}" y="{y}" width="{caja_w}" height="{caja_h}" rx="6" fill="{fuerte}"/>')
        p.append(_txt(x + 6, y + 13, num, 9.5, 700, "#ffffffb3"))
        p.append(_txt(x + 6, y + 26, etapa, 10, 700, "#ffffff", max_chars=11, salto=11))
        if sub:
            p.append(_txt(x + 6, y + caja_h - 6, sub.upper(), 7.5, 600, "#ffffffcc"))
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
    lugar = {"E1": (1, 7), "E2": (7, 8), "E3": (8, 9)}
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
        ancho = max(10, int((x1 - x0 - 12) / 5.2))
        p.append(_txt(x0 + 7, yb + 28, f"{desde} → {hasta}", 9, 500, "#e3f0e5", max_chars=ancho, salto=10))

    # Los cuatro momentos: flechas punteadas desde lo que las dispara.
    (xv, yv), (xva, yva), (xo, yo), (xt, yt) = pos[0], pos[3], pos[6], pos[7]
    disparos = [
        (1, xv + caja_w, yv + caja_h, inicio["E1"] + 4),          # se cierra la venta → E1
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
    el onboarding y el proyecto pasa a Ingeniería."""
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
        ("ONBOARDING", f"{tareas_onboarding} tareas, las hace el asesor: contrato, seña, modalidad de pago, "
                       "consulta inicial a UTE…", azul, "#c9d1f3", "#ffffff"),
        ("PASA A INGENIERÍA", "La etapa deja de ser de Ventas", COLOR_AREA["Ingeniería"][1], violeta, NEGRO),
    ]
    alturas = [62, 86, 54]
    y = y0
    centros = []
    for (rot, txt_, fondo, color_rot, color_txt), h in zip(cajas, alturas):
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fondo}"/>')
        p.append(_txt(x + 12, y + 18, rot, 10, 700, color_rot))
        p.append(_txt(x + 12, y + 35, txt_, 11.5, 500, color_txt, max_chars=36, salto=14))
        centros.append((y, h))
        y += h + 22
    for (ya, ha), (yb, hb) in zip(centros, centros[1:]):
        p.append(f'<line x1="{x + w / 2}" y1="{ya + ha}" x2="{x + w / 2}" y2="{yb - 2}" stroke="{NEGRO}" '
                 f'stroke-width="1.4" marker-end="url(#pgt-v)"/>')
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
    i_onb = next((k for k, (t, c) in enumerate(crudos) if t == "p" and c.startswith("**El onboarding.**")), None)
    tareas = len(crudos[i_onb + 1][1]) if i_onb is not None and crudos[i_onb + 1][0] == "lista" else 0
    out = list(crudos)
    out.insert(i_emb + 1, ("ventas", (pasos, tareas)))
    return out


def juntar_recorrido(crudos):
    """Si el capítulo tiene la tabla de etapas (con su área dueña) y la de los
    tramos E1/E2/E3, las dos se dibujan juntas en el lugar de la de tramos: el
    dibujo necesita las dos para alinear cada tramo con sus etapas."""
    def es(c, cab):
        return [x.strip().lower() for x in c[0]] == cab
    i_et = next((k for k, (t, c) in enumerate(crudos) if t == "tabla" and es(c, ["", "etapa", "área dueña"])), None)
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
    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.4px; color: {AZUL}">REGLA 4</div>
    <p style="margin: 20px 0 0; max-width: 580px; font-size: 27px; line-height: 1.32; letter-spacing: -.4px; color: {NEGRO}; font-weight: 600">Si hay que preguntarle a alguien en qué anda algo, <span style="color: {AZUL}">es porque falta un registro</span>.</p>
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
    version = f"Versión {m.group(1)} · {m.group(2).split(' de ', 1)[-1]}"
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
        crudos = juntar_ventas(partir_areas(juntar_recorrido(crudos)))
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
            if not (t == "h3" or (t == "p" and c.rstrip().rstrip("*").endswith(":"))):
                return 0
            sid, st, sc = items[k + 1]
            if st == "tabla" and "cab" in ALTURAS.get(sid, {}):
                return 16 + ALTURAS[sid]["cab"] + ALTURAS[sid]["filas"][0]
            return alto(sid, BLOQUES[sid])

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
