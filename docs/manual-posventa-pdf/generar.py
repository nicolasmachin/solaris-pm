#!/usr/bin/env python3
"""
Genera las páginas del Manual de Posventa como artboards de Claude Design.

Cada página del manual es un archivo `.dc.html` de una hoja A4 exacta
(794×1123 px) que se publica en el canvas
https://claude.ai/artifact/4YBDjiLXYwPWSkwJQ8sNyw, y de ahí sale el PDF.

Por qué un generador y no 40 archivos escritos a mano: el armazón de cada
página —el <head>, el <helmet>, el pie con el número, el bloque de lógica— es
idéntico y ocupa el 80% del archivo. Acá se escribe una vez y cada página queda
siendo solo su contenido. Cambiar la tipografía o el pie de las 40 páginas es
cambiar una función.

Uso:
    python3 docs/manual-posventa-pdf/generar.py <carpeta-destino>

Escribe <carpeta-destino>/project/<Nombre>.dc.html por cada página definida en
PAGINAS, más el índice canvas.json con su posición en el canvas.
"""

import json
import os
import sys

# ── La paleta es la de la propuesta comercial de Voltia: es lo que el cliente ya
#    ve, así que el manual interno no inventa una propia. ──────────────────────
AZUL = "#1836b2"
NEGRO = "#10131f"
TEXTO = "#3a3e50"
GRIS = "#6b7188"
GRIS_CLARO = "#767676"   # el gris más claro que la guía de impresión permite
BORDE = "#e6e8f2"
AZUL_FONDO = "#f4f6fd"
ROJO = "#8f1d1d"
ROJO_FONDO = "#fdf0ee"
ROJO_BORDE = "#f0cfcb"
AMBAR = "#8a5a10"
AMBAR_FONDO = "#fdf8ec"
VERDE = "#3d6b47"
VERDE_FONDO = "#e9f4ea"
VERDE_TEXTO = "#24402a"

SANS = "'Barlow', sans-serif"
SERIF = "'Source Serif 4', Georgia, serif"

FUENTES = (
    "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700"
    "&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&amp;display=swap"
)

ANCHO, ALTO = 794, 1123


def pagina(titulo_tab, cuerpo, numero, fondo="#ffffff", padding="72px 72px 56px",
           color_pie=GRIS_CLARO, borde_pie=BORDE):
    """El armazón de una hoja: head, helmet, marco A4, pie y bloque de lógica."""
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
<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; padding: {padding}; background: {fondo}; display: flex; flex-direction: column">
{cuerpo}
  <div style="flex-grow: 1"></div>
  <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 11px; border-top: 1px solid {borde_pie}; font-family: {SANS}; font-size: 11px; color: {color_pie}">
    <span>Manual de Posventa · Experiencia Solar · Voltia</span>
    <span>{numero}</span>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{ANCHO},"height":{ALTO}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


# ── Bloques que se repiten en varias páginas ──────────────────────────────────

def kicker(texto, color=AZUL):
    return (f'  <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; '
            f'letter-spacing: 2.2px; color: {color}">{texto}</div>\n')


def titulo(texto, tamano=40, color=NEGRO):
    return (f'  <h1 style="margin: 10px 0 0; font-family: {SANS}; font-size: {tamano}px; '
            f'font-weight: 700; letter-spacing: -1px; line-height: 1.1; color: {color}; '
            f'text-wrap: balance">{texto}</h1>\n')


def bajada(texto, color=TEXTO):
    return (f'  <p style="margin: 12px 0 0; max-width: 610px; font-size: 16px; line-height: 1.6; '
            f'color: {color}; text-wrap: pretty">{texto}</p>\n')


def parrafo(texto, margen=16, tamano=15):
    return (f'  <p style="margin: {margen}px 0 0; font-size: {tamano}px; line-height: 1.6; '
            f'color: {TEXTO}">{texto}</p>\n')


def subtitulo(texto, margen=30, tamano=22):
    return (f'  <h2 style="margin: {margen}px 0 0; font-family: {SANS}; font-size: {tamano}px; '
            f'font-weight: 700; letter-spacing: -.4px; color: {NEGRO}">{texto}</h2>\n')


def ficha(filas, margen=24):
    """La tabla de dos columnas de la cabecera de un paso: Cuándo / Quién / Plazo…"""
    celdas = ""
    for i, (k, v) in enumerate(filas):
        borde = f"border-bottom: 1px solid {BORDE};" if i < len(filas) - 1 else ""
        celdas += (
            f'<tr><td style="padding: 9px 14px 9px 0; {borde} font-family: {SANS}; font-size: 11px; '
            f'font-weight: 600; letter-spacing: 1.2px; color: {GRIS_CLARO}; vertical-align: top; '
            f'width: 104px">{k}</td>'
            f'<td style="padding: 9px 0; {borde} font-size: 14px; line-height: 1.45; color: {TEXTO}; '
            f'vertical-align: top">{v}</td></tr>'
        )
    return (f'  <table style="width: 100%; border-collapse: collapse; margin-top: {margen}px; '
            f'background: {AZUL_FONDO}; border-radius: 10px; padding: 4px"><tbody>{celdas}</tbody></table>\n')


def aviso(texto, clase="ojo", margen=22):
    """Los tres recuadros de aviso: ojo (ámbar), clave (azul), duro (rojo)."""
    estilos = {
        "ojo":   (AMBAR_FONDO, AMBAR, "#5c4210", "#3d2d08", "OJO"),
        "clave": (AZUL_FONDO, AZUL, TEXTO, NEGRO, "LO QUE IMPORTA"),
        "duro":  (ROJO_FONDO, ROJO, "#5e2626", "#3d1616", "REGLA DURA"),
    }
    fondo, color_rotulo, color_texto, _, rotulo = estilos[clase]
    return (f'  <div style="margin-top: {margen}px; padding: 18px 20px; background: {fondo}; border-radius: 8px">\n'
            f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.6px; '
            f'color: {color_rotulo}; margin-bottom: 7px">{rotulo}</div>\n'
            f'    <p style="margin: 0; font-size: 14.5px; line-height: 1.55; color: {color_texto}">{texto}</p>\n'
            f'  </div>\n')


def mensaje(rotulo, texto, margen=22):
    """La burbuja verde con el mensaje modelo que se le manda al cliente."""
    return (f'  <div style="margin-top: {margen}px; padding: 18px 20px; background: {VERDE_FONDO}; '
            f'border-radius: 12px 12px 12px 4px">\n'
            f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.6px; '
            f'color: {VERDE}; margin-bottom: 9px">{rotulo}</div>\n'
            f'    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: {VERDE_TEXTO}">{texto}</p>\n'
            f'  </div>\n')


def plantilla(nombre, texto, margen=20):
    """
    La plantilla citada entera, como se ve en la app.

    Va en letra más chica que el cuerpo y con la barra verde a la izquierda para
    que se lea como cita y no se confunda con el texto del manual. Existe porque
    quien lee el manual sin la app abierta no tiene forma de saber a qué mensaje
    se refiere "la plantilla de bienvenida".
    """
    parrafos = "".join(
        f'<p style="margin: {0 if i == 0 else 8}px 0 0; font-size: 12.5px; line-height: 1.5; '
        f'color: {VERDE_TEXTO}">{linea}</p>'
        for i, linea in enumerate(texto.split("\n\n")))
    return (f'  <div style="margin-top: {margen}px; padding: 14px 16px; background: {VERDE_FONDO}; '
            f'border-radius: 4px 10px 10px 4px; border-left: 3px solid {VERDE}">\n'
            f'    <div style="font-family: {SANS}; font-size: 10px; font-weight: 600; letter-spacing: 1.4px; '
            f'color: {VERDE}; margin-bottom: 8px">PLANTILLA · {nombre.upper()}</div>\n'
            f'    {parrafos}\n'
            f'  </div>\n')


def hueco(que, detalle, alto=190, margen=22):
    """El recuadro reservado para una captura de pantalla que todavía no está."""
    return (f'  <div style="margin-top: {margen}px; min-height: {alto}px; border: 2px dashed #c3cbe4; '
            f'border-radius: 10px; background: #fafbfe; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; text-align: center; padding: 20px">\n'
            f'    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#9aa0b4" stroke-width="1.4" '
            f'stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 11px">'
            f'<rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>\n'
            f'    <div style="font-family: {SANS}; font-size: 12px; font-weight: 600; color: {GRIS}; '
            f'letter-spacing: .3px">{que}</div>\n'
            f'    <div style="font-family: {SANS}; font-size: 12px; color: {GRIS_CLARO}; margin-top: 5px; '
            f'line-height: 1.45">{detalle}</div>\n'
            f'  </div>\n')


def numerados(items, margen=18):
    """Lista con círculos numerados, para los pasos de una instrucción."""
    out = f'  <div style="margin-top: {margen}px; display: flex; flex-direction: column; gap: 11px">\n'
    for i, texto in enumerate(items, 1):
        out += (f'    <div style="display: flex; gap: 12px">\n'
                f'      <div style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; '
                f'background: {AZUL}; color: #ffffff; font-family: {SANS}; font-size: 12px; font-weight: 700; '
                f'text-align: center; line-height: 22px">{i}</div>\n'
                f'      <p style="margin: 0; font-size: 14.5px; line-height: 1.5; color: {TEXTO}">{texto}</p>\n'
                f'    </div>\n')
    return out + "  </div>\n"


def tabla(cabeceras, filas, anchos=None, margen=20):
    """Tabla de contenido con cabecera en versalitas y filas con regla fina."""
    anchos = anchos or [None] * len(cabeceras)
    ths = ""
    for i, (c, a) in enumerate(zip(cabeceras, anchos)):
        pad = "9px 12px 9px 0" if i == 0 else ("9px 0 9px 12px" if i == len(cabeceras) - 1 else "9px 12px")
        ancho = f" width: {a}px;" if a else ""
        ths += (f'<th style="padding: {pad}; text-align: left; font-family: {SANS}; font-size: 11px; '
                f'font-weight: 600; letter-spacing: 1.2px; color: {GRIS_CLARO}; '
                f'border-bottom: 1.5px solid {NEGRO};{ancho}">{c}</th>')
    trs = ""
    for fila in filas:
        tds = ""
        for i, celda in enumerate(fila):
            pad = "12px 12px 12px 0" if i == 0 else ("12px 0 12px 12px" if i == len(fila) - 1 else "12px 12px")
            peso = f"font-weight: 600; color: {NEGRO};" if i == 0 else f"color: {TEXTO};"
            tds += (f'<td style="padding: {pad}; font-size: 13.5px; line-height: 1.45; {peso} '
                    f'border-bottom: 1px solid {BORDE}; vertical-align: top">{celda}</td>')
        trs += f"<tr>{tds}</tr>"
    return (f'  <table style="width: 100%; border-collapse: collapse; margin-top: {margen}px">'
            f'<thead><tr>{ths}</tr></thead><tbody>{trs}</tbody></table>\n')


def portadilla(etapa, nombre, desde, hasta, vive, semaforo, pasos, numero):
    """Las tres páginas que abren cada etapa del recorrido."""
    lista = ""
    for i, p in enumerate(pasos, 1):
        lista += (f'      <div style="display: flex; gap: 14px; padding: 11px 0; '
                  f'border-bottom: 1px solid rgba(255,255,255,.18)">\n'
                  f'        <span style="font-family: {SANS}; font-size: 13px; font-weight: 700; '
                  f'color: #8f9ad4; width: 20px">{i}</span>\n'
                  f'        <span style="font-family: {SANS}; font-size: 16px; font-weight: 500; '
                  f'color: #ffffff">{p}</span>\n'
                  f'      </div>\n')
    cuerpo = (
        f'  <div style="font-family: {SANS}; font-size: 12px; font-weight: 600; letter-spacing: 3px; '
        f'color: #8f9ad4">ETAPA {etapa}</div>\n'
        f'  <h1 style="margin: 14px 0 0; font-family: {SANS}; font-size: 56px; font-weight: 700; '
        f'letter-spacing: -1.8px; line-height: 1.02; color: #ffffff; text-wrap: balance">{nombre}</h1>\n'
        f'  <div style="margin-top: 18px; font-family: {SANS}; font-size: 15px; color: #b8bdd4">'
        f'Desde <strong style="color: #ffffff; font-weight: 600">{desde}</strong> '
        f'hasta <strong style="color: #ffffff; font-weight: 600">{hasta}</strong></div>\n'
        f'  <p style="margin: 26px 0 0; max-width: 540px; font-size: 18px; line-height: 1.6; color: #dde3f8; '
        f'text-wrap: pretty">{vive}</p>\n'
        f'  <div style="margin-top: 30px; padding: 16px 20px; background: rgba(255,255,255,.1); '
        f'border-radius: 8px; display: inline-block; align-self: flex-start">\n'
        f'    <span style="font-family: {SANS}; font-size: 13px; color: #b8bdd4">Semáforo interno</span> '
        f'<span style="font-family: {SANS}; font-size: 20px; font-weight: 700; color: #ffffff; '
        f'margin-left: 8px">{semaforo} días</span>\n'
        f'  </div>\n'
        f'  <div style="margin-top: 40px">\n'
        f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2px; '
        f'color: #8f9ad4; margin-bottom: 8px">LOS PASOS DE ESTA ETAPA</div>\n'
        f'{lista}  </div>\n'
    )
    return pagina(f"Etapa {etapa} — {nombre}", cuerpo, numero, fondo=AZUL,
                  padding="80px 72px 56px", color_pie="#8f9ad4", borde_pie="#4a63c6")


def paso(etapa_chip, plazo_chip, nombre, resumen, bloques, numero, plazo_rojo=True):
    """La página de un paso del recorrido: el modelo que se repite en el manual."""
    if plazo_chip:
        fondo_chip = ROJO if plazo_rojo else "#eceff7"
        color_chip = "#ffffff" if plazo_rojo else GRIS
        chip = (f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; '
                f'color: {color_chip}; background: {fondo_chip}; padding: 6px 13px; border-radius: 4px">'
                f'{plazo_chip}</div>')
    else:
        chip = "<div></div>"
    cuerpo = (
        f'  <div style="display: flex; justify-content: space-between; align-items: center">\n'
        f'    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.2px; '
        f'color: {AZUL}">{etapa_chip}</div>\n'
        f'    {chip}\n'
        f'  </div>\n'
        f'  <h1 style="margin: 16px 0 0; font-family: {SANS}; font-size: 40px; font-weight: 700; '
        f'letter-spacing: -1px; line-height: 1.08; color: {NEGRO}; text-wrap: balance">{nombre}</h1>\n'
        f'  <p style="margin: 12px 0 0; max-width: 610px; font-size: 16px; line-height: 1.6; color: {TEXTO}; '
        f'text-wrap: pretty">{resumen}</p>\n'
        + "".join(bloques)
    )
    return pagina(nombre, cuerpo, numero)


def escribir(destino, paginas):
    """Escribe cada página y el índice del canvas, en filas de 6 artboards."""
    carpeta = os.path.join(destino, "project")
    os.makedirs(carpeta, exist_ok=True)
    boards, orden = {}, []
    for i, (nombre_archivo, titulo_board, html) in enumerate(paginas):
        with open(os.path.join(carpeta, nombre_archivo), "w", encoding="utf-8") as f:
            f.write(html)
        col, fila = i % 6, i // 6
        boards[nombre_archivo] = {
            "x": col * (ANCHO + 80), "y": fila * (ALTO + 120),
            "w": ANCHO, "h": ALTO, "title": titulo_board, "paper": "a4",
        }
        orden.append(nombre_archivo)
    return boards, orden


if __name__ == "__main__":
    print(__doc__)


# ── Control de desborde ──────────────────────────────────────────────────────
# Lo que se pasa del borde de la hoja se RECORTA en el PDF, sin aviso ninguno.
# Como no hay forma de renderizar acá para medir, se estima la altura sumando lo
# que ocupa cada bloque. No es exacta: sirve para detectar la página que se fue
# de largo, no para ajustar al píxel.

ANCHO_UTIL = 650          # 794 menos los 72 px de margen de cada lado
ALTO_UTIL = ALTO - 72 - 56 - 34   # menos padding y el pie con su línea


def altura_estimada(cuerpo: str) -> int:
    """Alto aproximado del contenido de una página, en píxeles."""
    import re as _re

    total = 0
    for bloque in _re.finditer(
        r'<(h1|h2|p|div|table)\b[^>]*style="([^"]*)"[^>]*>(.*?)</\1>', cuerpo, _re.S
    ):
        etiqueta, estilo, texto = bloque.groups()
        plano = _re.sub(r"<[^>]+>", "", texto)
        fs = float((_re.search(r"font-size:\s*([\d.]+)px", estilo) or [0, 15])[1])
        lh = float((_re.search(r"line-height:\s*([\d.]+)", estilo) or [0, 1.5])[1])
        mt = float((_re.search(r"margin(?:-top)?:\s*([\d.]+)px", estilo) or [0, 0])[1])
        pad = float((_re.search(r"padding:\s*([\d.]+)px", estilo) or [0, 0])[1]) * 2
        # ~2 caracteres por píxel de ancho a tamaño de cuerpo: aproximación burda
        # pero estable para comparar páginas entre sí.
        por_linea = max(1, int(ANCHO_UTIL / (fs * 0.5)))
        lineas = max(1, -(-len(plano) // por_linea))
        total += int(lineas * fs * lh + mt + pad)
    return total


def revisar(paginas):
    """Devuelve las páginas cuya altura estimada supera la hoja."""
    largas = []
    for archivo, titulo_board, html in paginas:
        if html is None:
            continue
        cuerpo = html.split('flex-direction: column">', 1)[-1]
        alto = altura_estimada(cuerpo)
        if alto > ALTO_UTIL:
            largas.append((titulo_board, alto))
    return largas
