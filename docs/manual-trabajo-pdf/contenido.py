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


def html_de(tipo, c):
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
            if st == "tabla" and sid in ALTURAS:
                return 16 + ALTURAS[sid]["cab"] + ALTURAS[sid]["filas"][0]
            return alto(sid, BLOQUES[sid])

        for k_item, (bid, t, c) in enumerate(items):
            html = BLOQUES[bid]
            h = alto(bid, html)
            junto = lo_que_sigue(k_item)
            if t == "tabla" and bid in ALTURAS and usado + h > CAPACIDAD:
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
