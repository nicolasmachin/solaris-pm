#!/usr/bin/env python3
"""
El contenido del Manual de Trabajo ("Cómo trabajamos en Voltia"), página por página.

El texto sale de `docs/Manual-de-Trabajo-Voltia.md`, que es la fuente de verdad:
acá solo se decide cómo se reparte en hojas y qué forma toma cada cosa. Si el
manual cambia, se corrige el .md primero y después esto.

Los bloques (la ficha, los avisos, las tablas, la portadilla) son los del
Manual de Posventa: se importan de `docs/manual-posventa-pdf/generar.py` para
que los dos manuales se vean como una sola colección. Lo que es propio de este
—la tarjeta de cada rol, el recuadro "En Voltia PM", la portadilla de parte—
está acá abajo.

Uso:
    python3 docs/manual-trabajo-pdf/contenido.py <carpeta-destino>
"""

import importlib.util
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
POSVENTA = os.path.join(AQUI, "..", "manual-posventa-pdf")
# Este directorio primero: `imagenes` tiene que ser el de este manual (otro
# canvas, otras URLs), no el de Posventa.
sys.path.insert(0, AQUI)
sys.path.insert(1, POSVENTA)

import imagenes as IMG  # noqa: E402
import generar  # noqa: E402
from generar import (  # noqa: E402
    AMBAR, AZUL, AZUL_FONDO, BORDE, GRIS, GRIS_CLARO, NEGRO, ROJO, SANS, SERIF, TEXTO,
    VERDE, VERDE_FONDO, VERDE_TEXTO, ANCHO, ALTO, FUENTES,
    aviso, bajada, figura, kicker, mensaje, numerados, pagina, parrafo, plantilla,
    subtitulo, tabla, titulo,
)

PIE = "Manual de Trabajo · Cómo trabajamos en Voltia"
VERSION = "Versión 2.1 · septiembre de 2026"
generar.configurar(PIE, IMG.LOGO_ISOTIPO, IMG.LOGO_ISOTIPO_BLANCO)

# Las plantillas son las mismas que cita el de Posventa (copiadas de la app,
# client/src/modules/clientes/plantillas.ts): se leen de ahí para no tener dos
# copias que se desincronicen.
_spec = importlib.util.spec_from_file_location("contenido_posventa", os.path.join(POSVENTA, "contenido.py"))
_posventa = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_posventa)
PLANTILLAS = _posventa.PLANTILLAS


def cita(clave, margen=20):
    nombre, texto = PLANTILLAS[clave]
    return plantilla(nombre, texto, margen=margen)


# ── Bloques propios de este manual ────────────────────────────────────────────

def rotulo(texto, color=GRIS_CLARO):
    return (f'<div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.6px; '
            f'color: {color}">{texto}</div>')


def rol(capitulo, nombre, haces, termina, margen=22):
    """La apertura del capítulo de un rol: qué hacés y dónde termina lo tuyo.

    Son las dos preguntas con las que arranca cada capítulo del .md, y las que
    más se consultan: por eso van juntas y a la vista, antes que el detalle.
    """
    return (
        kicker(f"CAPÍTULO {capitulo}")
        + titulo(nombre)
        + f'  <div style="margin-top: {margen}px; display: flex; background: {AZUL_FONDO}; border-radius: 10px">\n'
          f'    <div style="flex-grow: 1.4; flex-basis: 0; padding: 18px 20px">\n'
          f'      {rotulo("QUÉ HACÉS", AZUL)}\n'
          f'      <p style="margin: 8px 0 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">{haces}</p>\n'
          f'    </div>\n'
          f'    <div style="width: 1px; background: #d6dcf0; margin: 16px 0"></div>\n'
          f'    <div style="flex-grow: 1; flex-basis: 0; padding: 18px 20px">\n'
          f'      {rotulo("DÓNDE TERMINA TU TRABAJO", AZUL)}\n'
          f'      <p style="margin: 8px 0 0; font-size: 14.5px; line-height: 1.55; color: {NEGRO}; '
          f'font-weight: 600">{termina}</p>\n'
          f'    </div>\n'
          f'  </div>\n'
    )


def en_pm(texto, margen=18):
    """Dónde se hace en Voltia PM. Recuadro con borde, sin fondo, para que no
    compita con los avisos: es una indicación, no una advertencia."""
    return (f'  <div style="margin-top: {margen}px; padding: 14px 18px; border: 1.5px solid {BORDE}; '
            f'border-radius: 8px; display: flex; gap: 14px; align-items: flex-start">\n'
            f'    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{AZUL}" stroke-width="1.7" '
            f'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px">'
            f'<rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>\n'
            f'    <div>\n'
            f'      {rotulo("EN VOLTIA PM", AZUL)}\n'
            f'      <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.55; color: {TEXTO}">{texto}</p>\n'
            f'    </div>\n'
            f'  </div>\n')


def preguntale(filas, margen=18, titulo_tabla="A quién le preguntás qué"):
    return (subtitulo(titulo_tabla, margen=margen + 8, tamano=19)
            + tabla(["NECESITÁS SABER…", "PREGUNTALE A…"], filas, anchos=[None, 250], margen=10))


def frase(texto, margen=24, tamano=24):
    """La frase que resume una regla, en bloque azul."""
    return (f'  <div style="margin-top: {margen}px; padding: 22px 26px; background: {AZUL}; border-radius: 12px">\n'
            f'    <p style="margin: 0; font-family: {SANS}; font-size: {tamano}px; font-weight: 600; '
            f'line-height: 1.32; color: #ffffff; letter-spacing: -.3px">{texto}</p>\n'
            f'  </div>\n')


def dicho(texto, margen=18, rotulo_txt="ASÍ SE DICE"):
    return mensaje(rotulo_txt, texto, margen=margen)


def vinetas(items, margen=12, tamano=14.5):
    lis = "".join(f'<li style="margin: 0 0 6px; font-size: {tamano}px; line-height: 1.5; color: {TEXTO}">{x}</li>'
                  for x in items)
    return f'  <ul style="margin: {margen}px 0 0; padding-left: 20px">{lis}</ul>\n'


def separador(margen=26):
    return f'  <div style="margin-top: {margen}px; border-top: 2px solid {BORDE}"></div>\n'


def dos_columnas(izq, der, margen=16, fondo_izq="#f7f8fb", fondo_der=AZUL_FONDO):
    """Dos tarjetas lado a lado. `izq`/`der` = (rótulo, color del rótulo, texto)."""
    def tarjeta(r, color, texto, fondo):
        return (f'    <div style="flex-grow: 1; flex-basis: 0; padding: 18px 20px; background: {fondo}; border-radius: 10px">\n'
                f'      {rotulo(r, color)}\n'
                f'      <p style="margin: 9px 0 0; font-size: 14px; line-height: 1.55; color: {TEXTO}">{texto}</p>\n'
                f'    </div>\n')
    return (f'  <div style="display: flex; gap: 14px; margin-top: {margen}px">\n'
            + tarjeta(*izq, fondo_izq) + tarjeta(*der, fondo_der) + '  </div>\n')


def portadilla_parte(parte, nombre, texto, capitulos, numero, foto):
    """La hoja que abre cada una de las tres partes del manual.

    Mismo lenguaje que las portadillas de etapa del de Posventa: la foto a
    sangre bajo un velo azul opaco (el texto va en blanco encima) y la lista de
    lo que viene.
    """
    lista = ""
    for num, cap, desc in capitulos:
        lista += (f'      <div style="display: flex; gap: 16px; padding: 12px 0; '
                  f'border-bottom: 1px solid rgba(255,255,255,.18)">\n'
                  f'        <span style="font-family: {SANS}; font-size: 14px; font-weight: 700; '
                  f'color: #8f9ad4; width: 24px; flex-shrink: 0">{num}</span>\n'
                  f'        <div>\n'
                  f'          <div style="font-family: {SANS}; font-size: 17px; font-weight: 600; color: #ffffff">{cap}</div>\n'
                  f'          <div style="margin-top: 3px; font-family: {SANS}; font-size: 13px; color: #b8bdd4">{desc}</div>\n'
                  f'        </div>\n'
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


def pagina_suelta(titulo_tab, raiz):
    """Una hoja con diseño propio (portada, cierre): sin el pie de las demás."""
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


# ── Hojas con diseño propio ───────────────────────────────────────────────────

def portada():
    return pagina_suelta("Portada — Manual de Trabajo", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
  <div style="height: 596px; position: relative; overflow: hidden; background: #dfe4f6">
    <img src="{IMG.PORTADA}" alt="" style="display: block; width: 100%; height: 100%; object-fit: cover">
    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,24,72,.12) 0%, rgba(16,24,72,0) 42%, rgba(255,255,255,.22) 100%)"></div>
  </div>
  <div style="flex-grow: 1; padding: 54px 72px 0; display: flex; flex-direction: column">
    <img src="{IMG.LOGO}" alt="Voltia" style="display: block; height: 42px; width: auto; align-self: flex-start">
    <h1 style="margin: 16px 0 0; font-family: {SANS}; font-size: 62px; font-weight: 700; line-height: 1; letter-spacing: -1.6px; color: {NEGRO}">Cómo trabajamos en Voltia</h1>
    <div style="margin-top: 10px; font-family: {SANS}; font-size: 34px; font-weight: 600; letter-spacing: -.5px; color: {AZUL}">Manual de trabajo</div>
    <p style="margin: 26px 0 0; max-width: 540px; font-size: 16px; line-height: 1.6; color: {TEXTO}">Qué tiene que hacer cada uno y cómo hacerlo en Voltia PM. No hay dos documentos: el procedimiento y la herramienta van juntos, porque separarlos es lo que hace que ninguno de los dos se cumpla.</p>
    <div style="flex-grow: 1"></div>
    <div style="display: flex; align-items: center; gap: 8px; padding-bottom: 30px">
      <img src="{IMG.LOGO_ISOTIPO}" alt="" style="display: block; height: 14px; width: auto; opacity: .55">
      <span style="font-family: {SANS}; font-size: 13px; color: {GRIS_CLARO}">{VERSION} · documento interno</span>
    </div>
  </div>
  <div style="height: 22px; background: {AZUL}"></div>
</div>""")


def cierre():
    return pagina_suelta("Cierre — Manual de Trabajo", f"""<div style="width: {ANCHO}px; height: {ALTO}px; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff">
  <div style="height: 470px; position: relative; overflow: hidden; background: #dfe4f6">
    <img src="{IMG.CIERRE}" alt="" style="display: block; width: 100%; height: 100%; object-fit: cover">
  </div>
  <div style="flex-grow: 1; padding: 62px 72px 0; display: flex; flex-direction: column">
    <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.4px; color: {AZUL}">LA REGLA QUE SOSTIENE A LAS DEMÁS</div>
    <p style="margin: 20px 0 0; max-width: 580px; font-size: 27px; line-height: 1.32; letter-spacing: -.4px; color: {NEGRO}; font-weight: 600">Si tenés que preguntarle a alguien en qué anda algo, <span style="color: {AZUL}">es porque falta un registro</span>.</p>
    <p style="margin: 26px 0 0; max-width: 560px; font-size: 16px; line-height: 1.62; color: {TEXTO}">Cada uno anota en su etapa, desde donde ya trabaja, y eso llega solo al historial del cliente. Así Experiencia Solar le contesta algo cierto sin salir a preguntar, y el cliente nunca es el mensajero de Voltia.</p>
    <div style="flex-grow: 1"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 34px; font-family: {SANS}; font-size: 12px; color: {GRIS_CLARO}">
      <span style="display: flex; align-items: center; gap: 7px"><img src="{IMG.LOGO_ISOTIPO}" alt="Voltia" style="display: block; height: 13px; width: auto">{PIE}</span>
      <span>{VERSION}</span>
    </div>
  </div>
  <div style="height: 22px; background: {AZUL}"></div>
</div>""")


def recorrido(numero):
    """Capítulo 1: las ocho etapas en fila y, debajo, los tres tramos de
    Experiencia Solar alineados a las etapas que abarcan. Se dibuja en una
    grilla de nueve columnas: las ocho etapas y la instalación habilitada, que
    es donde vive E3."""
    etapas = ["Venta", "Onboarding", "Pre-Ingeniería", "Validación de Operaciones", "Ingeniería Final",
              "Compras", "Obra", "Trámite UTE"]
    celdas = ""
    for i, e in enumerate(etapas, 1):
        celdas += (f'    <div style="padding: 10px 8px 12px; background: {AZUL_FONDO}; border-radius: 6px; '
                   f'border-top: 3px solid {AZUL}">\n'
                   f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 700; color: {AZUL}">{i}</div>\n'
                   f'      <div style="margin-top: 4px; font-family: {SANS}; font-size: 12px; font-weight: 600; '
                   f'line-height: 1.25; color: {NEGRO}">{e}</div>\n'
                   f'    </div>\n')
    celdas += (f'    <div style="padding: 10px 8px 12px; background: #eaf3ec; border-radius: 6px; '
               f'border-top: 3px solid {VERDE}">\n'
               f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 700; color: {VERDE}; height: 13px">'
               f'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{VERDE}" stroke-width="3" '
               f'stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"></path></svg></div>\n'
               f'      <div style="margin-top: 4px; font-family: {SANS}; font-size: 12px; font-weight: 600; '
               f'line-height: 1.25; color: {VERDE_TEXTO}">Habilitada</div>\n'
               f'    </div>\n')

    def tramo(col, cod, nombre, hasta, fondo, color):
        nombre = f' <span style="font-weight: 500">· {nombre}</span>' if nombre else ""
        return (f'    <div style="grid-column: {col}; padding: 9px 10px; background: {fondo}; border-radius: 6px">\n'
                f'      <div style="font-family: {SANS}; font-size: 12px; font-weight: 700; color: #ffffff">{cod}{nombre}</div>\n'
                f'      <div style="margin-top: 2px; font-family: {SANS}; font-size: 10.5px; line-height: 1.3; '
                f'color: {color}">{hasta}</div>\n'
                f'    </div>\n')

    grilla = (
        f'  <div style="margin-top: 26px; display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 5px">\n'
        + celdas
        + f'    <div style="grid-column: 1 / span 9; margin-top: 12px; font-family: {SANS}; font-size: 11px; '
          f'font-weight: 600; letter-spacing: 1.6px; color: {GRIS_CLARO}">EN PARALELO · EXPERIENCIA SOLAR ACOMPAÑA AL CLIENTE</div>\n'
        + tramo("2 / span 6", "E1", "Pre-obra", "Se cierra la venta → la obra termina", AZUL, "#c9d1f3")
        + tramo("8 / span 1", "E2", "", "Obra → UTE", "#2f4bb8", "#c9d1f3")
        + tramo("9 / span 1", "E3", "", "Para siempre", VERDE, "#d3ead7")
        + '  </div>\n'
    )
    tabla_tramos = tabla(
        ["", "TRAMO", "DESDE", "HASTA"],
        [["E1", "Pre-obra", "Se cierra la venta", "La obra termina"],
         ["E2", "Habilitación", "La obra termina", "UTE habilita"],
         ["E3", "Post-habilitación", "UTE habilita", "Para siempre"]],
        anchos=[44, 170, 190, None], margen=18)
    cuerpo = (
        kicker("CAPÍTULO 1")
        + titulo("El recorrido completo")
        + bajada("Un cliente pasa por <strong>ocho etapas</strong>, desde que firma hasta que su instalación queda "
                 "habilitada. En paralelo, y desde el primer día, <strong>Experiencia Solar acompaña al cliente</strong> "
                 "en tres tramos.")
        + grilla
        + tabla_tramos
        + subtitulo("Cuatro momentos conectan las dos líneas", margen=26, tamano=19)
        + numerados(["<strong>Se cierra la venta</strong> → arranca E1.",
                     "<strong>Se confirma la fecha de obra</strong> → Experiencia Solar se la comunica al cliente.",
                     "<strong>Termina la obra</strong> → arranca E2.",
                     "<strong>UTE habilita</strong> → arranca E3."], margen=12)
        + aviso("<strong>Cómo cambia de etapa un proyecto.</strong> Cuando un área termina lo suyo, <strong>completa "
                "su etapa en el sistema y el trabajo pasa solo al área siguiente</strong>, que recibe un aviso. No hay "
                "que mandar un mensaje avisando: eso ya lo hace Voltia PM.", "clave", margen=22)
    )
    return pagina("El recorrido completo", cuerpo, numero)


def anexo_reglas(numero):
    """Las diez reglas en una página, en oscuro: la hoja para pegar en la pared.
    Mismo tratamiento que "Las once reglas duras" del de Posventa."""
    reglas = [
        ("Solo el capataz y Experiencia Solar hablan con el cliente.", None),
        ("Nunca se le devuelve el organigrama al cliente.", "Él contrató a Voltia, no a un área."),
        ("El cliente nunca es el mensajero de Voltia.", "«Te averiguo y te confirmo», y se resuelve puertas adentro."),
        ("El que se demora avisa. Nadie pide explicaciones.", None),
        ("Si tenés que preguntar en qué anda algo, falta un registro.", None),
        ("Si no está agendado, no vamos. Y si está agendado, vamos: si no vamos, avisamos.", None),
        ("Toda reprogramación se avisa el mismo día, con el motivo.", None),
        ("Habilitación: 24 a 48 horas.", "Cada día que pasa el cliente deja de ahorrar."),
        ("Reclamos: respuesta el mismo día hábil, siempre.", None),
        ("Todo mensaje al cliente cierra con el próximo paso.", None),
    ]

    def item(n, t, d):
        sub = (f'\n        <p style="margin: 5px 0 0 32px; font-size: 13px; line-height: 1.45; color: #b8bdd4">{d}</p>'
               if d else "")
        return (f'      <div style="padding: 15px 0; border-bottom: 1px solid #2a2f45">\n'
                f'        <div style="display: flex; gap: 12px; align-items: baseline">\n'
                f'          <span style="font-family: {SANS}; font-size: 15px; font-weight: 700; color: #7f8fd8; '
                f'width: 20px; flex-shrink: 0">{n:02d}</span>\n'
                f'          <span style="font-family: {SANS}; font-size: 18px; font-weight: 600; color: #ffffff; '
                f'line-height: 1.3">{t}</span>\n'
                f'        </div>{sub}\n'
                f'      </div>\n')
    lista = "".join(item(i, t, d) for i, (t, d) in enumerate(reglas, 1))
    cuerpo = (
        f'  <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 2.4px; color: #8f9ad4">ANEXO</div>\n'
        f'  <h1 style="margin: 10px 0 0; font-family: {SANS}; font-size: 42px; font-weight: 700; letter-spacing: -1.1px; '
        f'line-height: 1.05; color: #ffffff">Las reglas en una página</h1>\n'
        f'  <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: #b8bdd4">Valen para todos, '
        f'en todas las áreas.</p>\n'
        f'  <div style="margin-top: 22px; border-top: 1px solid #2a2f45">\n{lista}  </div>\n'
    )
    return pagina("Las reglas en una página", cuerpo, numero, fondo=NEGRO, padding="64px 64px 52px",
                  color_pie="#8f9ad4", borde_pie="#2a2f45")


def pagina_captura(titulo_c, bajada_c, url, epigrafe, numero, rotulo_c, ancho="100%", alto_max=700):
    """Una pantalla grande con qué mirar en ella (como el Anexo F del de Posventa)."""
    cuerpo = (
        kicker(rotulo_c)
        + f'  <h1 style="margin: 10px 0 0; font-family: {SANS}; font-size: 30px; font-weight: 700; '
          f'letter-spacing: -.8px; line-height: 1.1; color: {NEGRO}; text-wrap: balance">{titulo_c}</h1>\n'
        + f'  <p style="margin: 10px 0 0; max-width: 610px; font-size: 14.5px; line-height: 1.55; '
          f'color: {TEXTO}; text-wrap: pretty">{bajada_c}</p>\n'
        + f'  <figure style="margin: 20px 0 0">\n'
          f'    <img src="{url}" alt="" style="display: block; width: {ancho}; max-height: {alto_max}px; '
          f'object-fit: contain; object-position: top; margin: 0 auto; border: 1px solid {BORDE}; '
          f'border-radius: 8px">\n'
          f'    <figcaption style="margin-top: 9px; font-family: {SANS}; font-size: 11.5px; '
          f'line-height: 1.45; color: {GRIS}">{epigrafe}</figcaption>\n'
          f'  </figure>\n'
    )
    return pagina(titulo_c, cuerpo, numero)


# ── El manual, en orden ──────────────────────────────────────────────────────

def construir():
    P = []
    n = [0]

    def nueva(archivo, titulo_board, hacer):
        n[0] += 1
        P.append((archivo, f"{n[0]} · {titulo_board}", hacer(n[0])))

    nueva("Main.dc.html", "Portada", lambda p: portada())

    # ── Capítulo 0 ───────────────────────────────────────────────────────────
    nueva("QueLeer.dc.html", "Qué leer según tu rol", lambda p: pagina(
        "Qué leer según tu rol",
        kicker("CAPÍTULO 0")
        + titulo("Qué leer según tu rol")
        + bajada("Este manual explica <strong>qué tiene que hacer cada uno y cómo hacerlo en Voltia PM</strong>. "
                 "Está escrito para leerlo de a pedazos: buscá tu área y leé lo tuyo.")
        + tabla(
            ["SI SOS…", "LEÉ", "CONSULTÁ CUANDO LO NECESITES"],
            [["Asesor comercial", "1, 2, 3", "9, 12"],
             ["Ingeniería", "1, 2, 4", "11"],
             ["Gerente de Operaciones", "1, 2, 5", "11, 12"],
             ["Capataz", "2, 5.4", "—"],
             ["Logística", "1, 2, 6", "—"],
             ["Tramitación UTE", "1, 2, 7", "—"],
             ["Experiencia Solar", "Todo", "—"],
             ["Gerencia", "1, 2, 12", "Todo"]],
            anchos=[None, 150, 230], margen=26)
        + aviso("<strong>El capítulo 2 lo lee todo el mundo.</strong> Son cinco reglas que valen para todos y son "
                "las que hacen que el resto funcione.", "clave", margen=26)
        + subtitulo("Qué es este documento", margen=32)
        + parrafo("No hay dos documentos: <strong>el procedimiento y la herramienta van juntos</strong>, porque "
                  "separarlos es lo que hace que ninguno de los dos se cumpla. Cada capítulo dice qué hacés, dónde "
                  "termina tu trabajo, qué registrás y en qué pantalla de Voltia PM se hace.")
        + parrafo("El trato con el cliente de posventa —los avisos, los plazos, los mensajes modelo— está "
                  "desarrollado a fondo en el <strong>Manual de Posventa</strong>. Acá queda lo que el resto del "
                  "equipo necesita saber de eso."),
        p))

    # ── Parte 1 ──────────────────────────────────────────────────────────────
    nueva("Parte1.dc.html", "Parte 1 · Para todos", lambda p: portadilla_parte(
        "1", "Para todos",
        "Cómo se mueve un proyecto de punta a punta y las cinco reglas que valen para todas las áreas.",
        [("1", "El recorrido completo", "Las ocho etapas del proyecto y los tres tramos de Experiencia Solar"),
         ("2", "Las cinco reglas que valen para todos", "Quién habla con el cliente, quién avisa, dónde se registra")],
        p, IMG.PORTADILLA_PARTE1))

    nueva("Recorrido.dc.html", "El recorrido completo", recorrido)

    nueva("Reglas1.dc.html", "Reglas 1 y 2", lambda p: pagina(
        "Las cinco reglas · 1 y 2",
        kicker("CAPÍTULO 2 · LAS CINCO REGLAS QUE VALEN PARA TODOS")
        + titulo("Regla 1 — Solo dos personas hablan con el cliente", tamano=34)
        + frase("El capataz asignado a la obra y Experiencia Solar. Nadie más.", margen=20, tamano=22)
        + tabla(["QUIÉN", "DE QUÉ HABLA"],
                [["El capataz", "Horarios, accesos y materiales del día de obra"],
                 ["Experiencia Solar", "Todo lo demás"]], anchos=[190, None], margen=18)
        + parrafo("El vendedor deja de ser el contacto cuando termina el onboarding. Ni el gerente de Operaciones, ni "
                  "Logística, ni Ingeniería, ni Tramitación contactan al cliente. <strong>Si necesitás coordinar algo "
                  "con él, se lo pedís a una de esas dos personas.</strong>", margen=16)
        + separador(30)
        + titulo("Regla 2 — Nunca se le devuelve el organigrama al cliente", tamano=34)
        + parrafo("Decirle <em>«eso lo tenés que hablar con el capataz»</em> o <em>«ese tema es de Ingeniería»</em> es "
                  "explicarle cómo estamos organizados por dentro. <strong>No le sirve: él contrató a Voltia, no a un "
                  "área.</strong>", margen=16)
        + dicho("Si te pregunta algo que no es tuyo: <strong>«te averiguo y te confirmo»</strong>, y lo resolvés "
                "puertas adentro.", margen=18)
        + aviso("<strong>El cliente nunca es el mensajero de Voltia.</strong>", "duro", margen=16),
        p))

    nueva("Reglas2.dc.html", "Reglas 3, 4 y 5", lambda p: pagina(
        "Las cinco reglas · 3 a 5",
        kicker("CAPÍTULO 2 · LAS CINCO REGLAS QUE VALEN PARA TODOS")
        + titulo("Regla 3 — El que se demora avisa. Nadie pide explicaciones.", tamano=30)
        + parrafo("Si tu etapa se está demorando, <strong>dejás un comentario diciendo por qué</strong>. No esperás a "
                  "que te vengan a preguntar.", margen=14)
        + parrafo("Y al revés: <strong>no le pedís explicaciones a otra área</strong> porque su etapa lleva mucho "
                  "tiempo. Si hay una fecha comprometida con el cliente y no se va a cumplir, lo que corresponde es "
                  "<strong>reprogramarla en el calendario</strong>: eso le avisa solo a Experiencia Solar.", margen=10)
        + aviso("Lo que está fuera de plazo se trata en la <strong>reunión de coordinación</strong>, no entre dos "
                "áreas por mensaje.", "ojo", margen=14)
        + separador(26)
        + titulo("Regla 4 — Todo se registra donde ya estás trabajando", tamano=30)
        + frase("Si tenés que preguntarle a alguien en qué anda algo, es porque falta un registro.", margen=16, tamano=20)
        + parrafo("Cada uno anota en <strong>su</strong> etapa del proyecto, desde donde ya trabaja. No hay que entrar "
                  "a otro módulo ni aprender otra pantalla. Eso aparece solo en el historial del cliente, con el "
                  "nombre de tu área.", margen=14)
        + separador(26)
        + titulo("Regla 5 — Si no está agendado, no vamos", tamano=30)
        + parrafo("<strong>Ninguna visita a la propiedad del cliente sin que esté en el calendario y avisada.</strong> "
                  "Vale para el relevamiento, para la visita técnica de coordinación, para dejar materiales y para "
                  "la obra.", margen=14),
        p))

    # ── Parte 2 ──────────────────────────────────────────────────────────────
    nueva("Parte2.dc.html", "Parte 2 · Cada área", lambda p: portadilla_parte(
        "2", "Cada área, lo suyo",
        "Qué hace cada rol, dónde termina su trabajo, qué deja registrado y a quién le pregunta qué.",
        [("3", "Asesor comercial", "La modalidad de pago, el pasaje a Experiencia Solar, el cotizador"),
         ("4", "Ingeniería", "El paquete técnico y el gabinete metálico"),
         ("5", "Operaciones", "La validación, la fecha de obra y el capataz"),
         ("6", "Logística", "Compras y depósito"),
         ("7", "Tramitación UTE", "Los hitos del trámite"),
         ("8", "Experiencia Solar", "El acompañamiento del cliente de punta a punta")],
        p, IMG.PORTADILLA_PARTE2))

    # Capítulo 3 · Asesor comercial
    nueva("Comercial1.dc.html", "Comercial · modalidad de pago", lambda p: pagina(
        "Asesor comercial",
        rol("3", "Asesor comercial",
            "Vendés, cerrás, cobrás la seña, firmás el contrato, juntás los datos administrativos y armás la "
            "carpeta. Presentás la consulta inicial a UTE y das la fecha tentativa.",
            "Cuando el onboarding está completo y el cliente sabe cómo sigue.")
        + subtitulo("3.1 · La modalidad de pago — lo que más se nos está cayendo", margen=30, tamano=21)
        + parrafo("<strong>En el onboarding definís cómo paga el cliente.</strong> Lo primero que te pregunta la "
                  "subetapa es eso, con tres opciones, y <strong>cada una te deja una tarea que no podés "
                  "saltear</strong>: hasta que no la hagas, la subetapa no se puede dar por completada.", margen=12)
        + tabla(["SI ELEGÍS…", "TENÉS QUE…"],
                [["Financiación bancaria", "Generar la <strong>proforma</strong>"],
                 ["Pago directo", "Crear el <strong>plan de pagos</strong>"],
                 ["Otro", "<strong>Explicar qué se acordó</strong>, en el campo que aparece"]],
                anchos=[220, None], margen=16)
        + aviso("Esas casillas <strong>no se pueden tildar a mano</strong>: se marcan solas cuando el documento existe. "
                "Y si no elegís ninguna de las tres, la subetapa no cierra.", "ojo", margen=18)
        + subtitulo("Si paga directo con nosotros", margen=26, tamano=18)
        + parrafo("Armás el <strong>calendario de pagos</strong>: la seña más tres cuotas.", margen=8, tamano=14.5)
        + tabla(["CUOTA", "CUÁNDO"],
                [["50 %", "Una seña al confirmar, y se completa el 50 % entre 10 y 15 días antes de la obra"],
                 ["30 %", "Con la obra terminada"],
                 ["20 %", "Cuando UTE habilita"]], anchos=[90, None], margen=12),
        p))

    nueva("Comercial2.dc.html", "Comercial · plan de pagos y banco", lambda p: pagina(
        "Asesor comercial · plan de pagos y financiación",
        kicker("CAPÍTULO 3 · ASESOR COMERCIAL")
        + aviso("<strong>Sin el 50 % pago no se da fecha de obra.</strong> Con financiación bancaria, la condición es "
                "el crédito aprobado.", "duro", margen=14)
        + en_pm("El botón <strong>«Crear o editar el plan de pagos»</strong>, en esa misma subetapa. Antes esto vivía "
                "solo en Finanzas —vos no lo veías y Experiencia Solar no lo podía crear—, y así <strong>el proyecto "
                "llegaba a la etapa de cobrar sin que nadie supiera qué cobrar</strong>. Ahora lo hacés vos, que sos "
                "quien lo acordó con el cliente, y lo podés editar después si cambia.")
        + subtitulo("Si es un caso particular", margen=28, tamano=18)
        + parrafo("Un canje, un pago adelantado, una condición negociada. Elegís <strong>Otro</strong> y escribís qué "
                  "se acordó. No es burocracia: <strong>dentro de seis meses, cuando haya que cobrar, esa línea va a "
                  "ser lo único que exista</strong> sobre lo que hablaste con el cliente.", margen=10)
        + subtitulo("Si va con financiación bancaria", margen=28, tamano=18)
        + parrafo("Armás la proforma y <strong>le hacés seguimiento todas las semanas hasta que salga</strong>.", margen=10)
        + aviso("<strong>Este es el problema que más nos está pasando.</strong> Llega el día de la obra, está todo "
                "planificado, y el cliente no quiere que empecemos porque el banco todavía no le contestó.<br><br>"
                "Lo que pasa siempre es lo mismo: el banco le pide algo al cliente, el cliente nunca vio el pedido, "
                "y <strong>los dos quedan esperando algo que no va a pasar solo</strong>.", "ojo", margen=16)
        + parrafo("<strong>Tu trabajo es hablar con las dos partes cada semana</strong> y ver qué está pendiente. No "
                  "alcanza con mandar la proforma.", margen=16)
        + en_pm("En el proyecto, etapa <strong>Onboarding</strong> → subetapa <strong>«Modalidad de pago "
                "definida»</strong>. Al elegir financiación bancaria aparecen dos casillas más: <em>Proforma enviada "
                "al banco</em> y <em>Crédito aprobado</em>. <strong>La segunda es bloqueante: sin eso tildado, el "
                "proyecto no debería avanzar a la obra.</strong>", margen=16),
        p))

    nueva("Comercial3.dc.html", "Comercial · granizo y pasaje", lambda p: pagina(
        "Asesor comercial · granizo y pasaje a Experiencia Solar",
        kicker("CAPÍTULO 3 · ASESOR COMERCIAL")
        + subtitulo("3.1 bis · El Plan de Protección contra Granizo en la venta", margen=12, tamano=21)
        + parrafo("Con la propuesta se ofrece el <strong>Plan de Protección contra Granizo</strong>: USD 12 por panel "
                  "por año, IVA incluido, y si el granizo le rompe paneles, Voltia se los repone con todo incluido.",
                  margen=10)
        + aviso("<strong>No es un seguro y no se le dice así</strong>: decís <em>plan</em>, <em>anualidad</em> y "
                "<em>daño por granizo</em>.", "duro", margen=14)
        + parrafo("Si se adhiere al contratar la obra, <strong>no tiene carencia</strong>: cubre desde la puesta en "
                  "marcha. Por eso conviene ofrecerlo en la venta.", margen=14)
        + en_pm("En el onboarding, subetapa <strong>Contrato</strong>, abajo del contrato, está <strong>Condiciones y "
                "Anexo A</strong>. Genera un solo PDF con las condiciones y el Anexo A ya completo con los datos del "
                "cliente. Revisás los datos, lo generás y se lo mandás con el contrato. El plan lo sigue Experiencia "
                "Solar.", margen=14)
        + separador(26)
        + subtitulo("3.2 · El pasaje del cliente a Experiencia Solar", margen=22, tamano=21)
        + parrafo("<strong>Antes de irte, presentás a Alejandra.</strong> No basta con que ella escriba: el cliente "
                  "tiene que saber quién es antes de recibir su primer mensaje. <strong>Van en este orden, y no al "
                  "revés:</strong>", margen=10)
        + tabla(["", "QUIÉN", "CUÁNDO"],
                [["1", "Vos le presentás a Alejandra al cliente", "Al cerrar el onboarding"],
                 ["2", "Alejandra le escribe", "Al día siguiente, máximo"]], anchos=[30, None, 210], margen=12)
        + dicho("«De acá en adelante vas a seguir en contacto con Alejandra, te paso su contacto.»", margen=16,
                rotulo_txt="ALGO ASÍ")
        + parrafo("<strong>Por qué importa el orden:</strong> si Alejandra escribe primero, el cliente recibe un "
                  "mensaje de alguien que no conoce y desconfía. La presentación previa convierte ese mensaje en la "
                  "continuación de una relación, no en un contacto frío.", margen=14, tamano=14.5),
        p))

    nueva("Comercial4.dc.html", "Comercial · bienvenida", lambda p: pagina(
        "Asesor comercial · la bienvenida",
        kicker("CAPÍTULO 3 · ASESOR COMERCIAL")
        + en_pm("En la ficha del cliente, etapa <strong>E1</strong> → paso <strong>«Bienvenida y presentación»</strong>. "
                "Tiene el mensaje modelo listo para copiar: es este.", margen=12)
        + cita("bienvenida", margen=16)
        + separador(26)
        + subtitulo("3.3 · Lo que dejás cargado para los que siguen", margen=22, tamano=21)
        + parrafo("Todo lo que juntaste en la visita —<strong>el resumen, la minuta, las fotos, los videos</strong>— "
                  "tiene que estar cargado en el proyecto. <strong>Con eso trabaja Pre-Ingeniería.</strong> Si falta, "
                  "arrancan a ciegas.", margen=10)
        + preguntale([["Si entró la seña, cómo se le cobra", "Finanzas"],
                      ["Qué fecha tentativa podés prometer", "Operaciones"]], margen=18)
        + subtitulo("Y a vos, ¿quién te pregunta?", margen=26, tamano=19)
        + parrafo("<strong>No tenemos un responsable de ventas.</strong> Cada proyecto tiene su asesor asignado, así "
                  "que <strong>cualquier duda de cualquier área sobre esa venta te la preguntan a vos</strong>: qué se "
                  "prometió, qué alcance, qué condiciones especiales.", margen=10),
        p))

    nueva("Comercial5.dc.html", "Comercial · el cotizador", lambda p: pagina(
        "Asesor comercial · el cotizador",
        kicker("CAPÍTULO 3 · ASESOR COMERCIAL")
        + titulo("3.4 · El cotizador", tamano=34)
        + bajada("<strong>Ventas → el lead → Armar propuesta.</strong> Cargás los datos y el precio se calcula solo. "
                 "Tres cosas que conviene saber:")
        + subtitulo("Podés cotizar varias instalaciones juntas", margen=26, tamano=18)
        + parrafo("Si el cliente quiere dos techos o dos padrones, poné más de uno en <strong>Cantidad de "
                  "inversores</strong>. La potencia que cargás es la de <strong>un</strong> inversor y los paneles van "
                  "<strong>sumados</strong> entre las dos. Se multiplican el inversor y la instalación eléctrica; el "
                  "resto no.", margen=8)
        + subtitulo("Podés ajustar los costos de esa cotización", margen=24, tamano=18)
        + parrafo("El <strong>ícono de calculadora</strong> del encabezado abre el costeo: el precio de cada ítem, la "
                  "mano de obra, los costos fijos y variables. Sirve cuando el caso se sale de la norma —un proveedor "
                  "que cambió el precio, una obra con acceso difícil—.", margen=8)
        + aviso("<strong>Lo que cambiás vale solo para esa cotización</strong>, no toca las demás ni la configuración "
                "general, y se guarda solo. Un campo en blanco usa el valor de siempre.", "clave", margen=14)
        + subtitulo("La comisión se registra sola", margen=24, tamano=18)
        + parrafo("Cuando ganás la venta, el sistema toma el precio de la última propuesta publicada y congela tu "
                  "comisión con ese número. Ya no hay que cargarla a mano; el modal que aparece es para corregirla si "
                  "el precio cerrado fue otro.", margen=8),
        p))

    # Capítulo 4 · Ingeniería
    nueva("Ingenieria1.dc.html", "Ingeniería", lambda p: pagina(
        "Ingeniería",
        rol("4", "Ingeniería",
            "Relevamiento, pre-ingeniería, unifilar, memorias, planos y la lista de materiales. Después de la "
            "validación de Operaciones, cerrás el paquete definitivo.",
            "Cuando la lista de materiales está cerrada y no se toca más. A partir de ahí Logística compra sobre esa "
            "lista.")
        + subtitulo("Con qué trabajás", margen=28, tamano=19)
        + parrafo("Con lo que el vendedor dejó cargado en el proyecto: el resumen de la visita, la minuta, las fotos y "
                  "los videos. <strong>Si falta algo, se lo pedís al asesor comercial de ese proyecto</strong>: está "
                  "indicado en el proyecto.", margen=8)
        + subtitulo("Cuándo entra Operaciones", margen=22, tamano=19)
        + parrafo("<strong>Todavía no.</strong> Cuando arrancás la pre-ingeniería, Operaciones no sabe nada de esta "
                  "obra. Entran recién en la validación, cuando vos terminás.", margen=8)
        + subtitulo("La visita de relevamiento", margen=22, tamano=19)
        + parrafo("Hay que ir a la propiedad. <strong>Se agenda y se avisa antes</strong> (regla 5). Coordinás con "
                  "Experiencia Solar quién le avisa al cliente.", margen=8)
        + preguntale([["Cuándo pueden ir a relevar", "Gerente de Operaciones"],
                      ["Si lo relevado no coincide con lo vendido", "Asesor comercial del proyecto"],
                      ["Qué hay que ajustar del paquete", "Gerente de Operaciones (después de la validación)"],
                      ["Que se corrija algo de la instalación", "<strong>Gerente de Operaciones — nunca al capataz</strong>"]],
                     margen=14)
        + aviso("<strong>Qué registrás:</strong> cualquier <strong>cambio de alcance o de diseño</strong> que el "
                "cliente tenga que saber. Lo dejás como comentario en tu etapa y le llega solo a Experiencia Solar.",
                "clave", margen=22),
        p))

    nueva("Ingenieria2.dc.html", "Ingeniería · gabinete metálico", lambda p: pagina(
        "Ingeniería · el gabinete metálico",
        kicker("CAPÍTULO 4 · INGENIERÍA")
        + titulo("4.1 · El gabinete metálico que se manda a fabricar", tamano=32)
        + bajada("Cuando la obra necesita un gabinete a medida, <strong>no lo dibujás a mano ni reenviás el plano del "
                 "pedido anterior</strong>: lo armás en el proyecto y Voltia PM te da la lámina para mandarle al "
                 "fabricante.")
        + numerados([
            "Entrás al proyecto en Ingeniería, abrís <strong>Gabinete metálico</strong> y le das <strong>Nuevo "
            "gabinete</strong>. Viene precargado el que más pedimos —50 × 85 × 26 cm, chapa galvanizada de 1,5 mm, "
            "fondo abierto y pestaña de 3 cm para amurar—, así que muchas veces solo cambiás lo que difiere.",
            "Mientras cargás las medidas, <strong>el plano de la derecha se va dibujando solo</strong>. Con "
            "<strong>Ampliar</strong> lo ves a pantalla completa, sin tener que bajar el PDF.",
            "Cuando está, <strong>Emitir lámina</strong>: sale un PDF que queda guardado en los documentos del "
            "proyecto y es el que le mandás al fabricante."], margen=18)
        + figura(IMG.GABINETE, "El gabinete abierto: las medidas a la izquierda y la lámina que se va dibujando a la "
                 "derecha.", margen=20)
        + aviso("<strong>Es el gabinete de siempre: todo chapa plegada, sin herrajes y sin perforar.</strong> La tapa se "
                "pide suelta —sin bisagras y sin cierre— y los agujeros para amurar los hacés vos en obra. La lámina "
                "se lo dice al fabricante con todas las letras, así no te cotiza ni te hace cosas que no le pediste.",
                "clave", margen=18),
        p))

    nueva("Ingenieria3.dc.html", "Ingeniería · la lámina", lambda p: pagina(
        "Ingeniería · la lámina del gabinete",
        kicker("CAPÍTULO 4 · INGENIERÍA")
        + subtitulo("Ninguna medida queda sin definir", margen=12, tamano=21)
        + parrafo("Todas vienen con un valor cargado —el espesor de la chapa, el ancho de la pestaña, cuánto solapan "
                  "las dos piezas en L, cada cuánto van los tornillos, el reborde del frente del cuerpo, el de la "
                  "tapa, cuánto montan entre sí y qué holgura queda—. Repasalas y corregí las que no correspondan: "
                  "lo que no cambies <strong>sale impreso igual</strong>, así el taller nunca tiene que resolver "
                  "nada por su cuenta.", margen=10)
        + subtitulo("Qué trae la lámina", margen=26, tamano=19)
        + parrafo("Es <strong>una sola hoja</strong>: el gabinete dibujado de frente, de costado, de atrás y en "
                  "perspectiva, <strong>el plano de la tapa</strong> aparte —de frente y de canto, donde se ve cuánto "
                  "dobla su reborde—, con <strong>cada medida acotada sobre el dibujo</strong>, más las "
                  "especificaciones y las notas.", margen=8)
        + parrafo("Si el fabricante pide un dato que no tiene casillero, lo agregás abajo en <strong>Especificaciones "
                  "adicionales</strong> y sale impreso igual.", margen=12)
        + subtitulo("Más de un gabinete, o una corrección", margen=26, tamano=19)
        + parrafo("Si la obra lleva <strong>más de un gabinete</strong> (el del medidor y el de protecciones, por "
                  "ejemplo), hacés uno por cada uno.", margen=8)
        + aviso("Si hay que corregir algo después de haber mandado el pedido, corregís y volvés a emitir: la lámina "
                "nueva sale como v2 y <strong>la anterior no se borra</strong>, porque puede ser la que el "
                "fabricante tiene sobre la mesa.", "ojo", margen=16),
        p))

    # Capítulo 5 · Operaciones
    nueva("Operaciones1.dc.html", "Operaciones · validación y fecha", lambda p: pagina(
        "Operaciones",
        rol("5", "Operaciones",
            "Validás lo que proyectó Ingeniería, <strong>confirmás la fecha de obra</strong>, planificás, ejecutás "
            "la instalación y controlás los costos.",
            "Cuando la obra está terminada y toda la documentación está cargada.")
        + subtitulo("5.1 · La validación", margen=28, tamano=21)
        + parrafo("Cuando Ingeniería termina, el proyecto pasa a vos. En esta etapa hacés <strong>cuatro "
                  "cosas</strong>:", margen=8)
        + numerados(["<strong>Marcás la fecha de obra en el calendario.</strong>",
                     "Revisás la pre-ingeniería, sobre todo <strong>la lista de materiales</strong>.",
                     "Hacés la <strong>visita técnica de coordinación</strong> (se agenda y se avisa).",
                     "Devolvés a Ingeniería lo que haya que corregir."], margen=12)
        + subtitulo("5.2 · La fecha de obra", margen=28, tamano=21)
        + frase("Vos la marcás en el calendario. Vos no se la comunicás al cliente.", margen=12, tamano=20)
        + parrafo("Al confirmarla, <strong>el sistema le avisa solo a Experiencia Solar</strong> y le abre el pendiente "
                  "de comunicarla, con dos días hábiles de plazo <strong>desde que la confirmás vos</strong>, no desde "
                  "que se vendió. No hace falta que le mandes un mensaje.", margen=14)
        + parrafo("<strong>Si después hay que moverla:</strong> la reprogramás en el calendario y <strong>el sistema te "
                  "pide el motivo</strong>. Eso genera un aviso propio para que Experiencia Solar se lo explique al "
                  "cliente el mismo día. Si a un cliente le movés la fecha tres veces, quedan tres avisos, no uno.",
                  margen=10)
        + aviso("<strong>Reprogramar es el mecanismo.</strong> Que Experiencia Solar te venga a pedir explicaciones es "
                "la señal de que no se usó.", "clave", margen=16),
        p))

    nueva("Operaciones2.dc.html", "Operaciones · avance de obra", lambda p: pagina(
        "Operaciones · el registro del avance de obra",
        kicker("CAPÍTULO 5 · OPERACIONES")
        + titulo("5.3 · El registro del avance de obra", tamano=34)
        + bajada("Al <strong>cerrar cada día de obra</strong>, el sistema hace una sola pregunta:")
        + frase("«¿Qué le decimos al cliente si pregunta hoy?»", margen=20, tamano=28)
        + parrafo("Y se contesta <strong>de un toque</strong>:", margen=20)
        + f'  <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px">\n'
        + "".join(
            f'    <div style="padding: 12px 16px; border-radius: 8px; background: {fondo}; font-family: {SANS}; '
            f'font-size: 15px; font-weight: {peso}; color: {color}">{t}</div>\n'
            for t, fondo, color, peso in [
                ("Arrancamos, todo en orden", "#f4f6fd", NEGRO, 500),
                ("Vamos según lo previsto", "#f4f6fd", NEGRO, 500),
                ("Avanzamos, seguimos mañana", "#f4f6fd", NEGRO, 500),
                ("Terminamos la obra, falta cargar la documentación", "#f4f6fd", NEGRO, 500),
                ("Hubo un imprevisto → y ahí sí, dos líneas", "#fdf0ee", ROJO, 700)])
        + '  </div>\n'
        + parrafo("<strong>No es un reporte de avance técnico.</strong> No hace falta decir cuántos paneles se subieron "
                  "ni si se cambió un cable. Es lo que hay que poder contestarle al cliente si llama.", margen=20)
        + aviso("<strong>La última opción es la que más importa:</strong> es la que tiene que llegarle a Experiencia "
                "Solar <strong>antes</strong> de que el cliente pregunte.", "clave", margen=16),
        p))

    nueva("Operaciones3.dc.html", "Operaciones · el capataz", lambda p: pagina(
        "Operaciones · el capataz",
        kicker("CAPÍTULO 5 · OPERACIONES")
        + titulo("5.4 · El capataz", tamano=34)
        + subtitulo("Con el cliente", margen=20, tamano=19)
        + parrafo("<strong>Hablás directo</strong> de horarios, accesos, llegada y levantada de materiales. Todo lo demás "
                  "va por Experiencia Solar.", margen=8)
        + parrafo("Si el cliente te pregunta algo que no es de obra: <strong>no lo mandes a otro lado</strong>. Le decís "
                  "que se lo averiguás, y se lo pasás a Experiencia Solar.", margen=10)
        + subtitulo("Lo que anotás", margen=24, tamano=19)
        + parrafo("<strong>Todo intercambio con el cliente y cualquier incidente.</strong> Algo que se rompió, un pedido "
                  "que hizo, una queja al pasar. <strong>Se anota desde el celular, en la etapa de obra del proyecto, "
                  "en diez segundos.</strong> No entrás a ningún otro módulo. Eso aparece solo en el historial del "
                  "cliente.", margen=8)
        + aviso("Si registrar cuesta, no se registra. Dos líneas valen infinitamente más que un informe prolijo que "
                "nadie escribe.", "ojo", margen=14)
        + subtitulo("Lo que dejás para cerrar la obra", margen=24, tamano=19)
        + parrafo("<strong>Sin esto completo la obra no se cierra, y es tu responsabilidad que esté:</strong>", margen=8)
        + vinetas(["Llevarle al cliente <strong>los documentos de habilitación</strong> y traerlos firmados",
                   "<strong>Fotos</strong>: generales, del tablero y protecciones, de la puesta a tierra",
                   "<strong>Videos de los ensayos</strong>",
                   "<strong>El checklist firmado</strong> por el cliente",
                   "<strong>La documentación UTE firmada</strong>",
                   "El recorrido y la explicación al cliente"], margen=10, tamano=14)
        + parrafo("Todo eso <strong>se carga en el proyecto</strong>. Si después Tramitación descubre que faltó una "
                  "firma, el reclamo le llega a tu gerente.", margen=8, tamano=14.5),
        p))

    nueva("Operaciones4.dc.html", "Operaciones · a quién preguntar", lambda p: pagina(
        "Operaciones · a quién le preguntás",
        kicker("CAPÍTULO 5 · OPERACIONES")
        + preguntale([["Si hay stock o hay que comprar", "Logística"],
                      ["Si está todo el material en depósito", "Logística"],
                      ["Algo del plano que no cierra en obra", "Ingeniería"],
                      ["Algo del cliente que no es de obra", "Experiencia Solar"]], margen=0)
        + separador(34)
        + rol("6", "Logística",
              "Comprás los materiales de la lista definitiva, seguís los pedidos y los recibís en depósito.",
              "Cuando el material está en depósito y la obra se puede planificar.", margen=18)
        + subtitulo("Con el cliente", margen=24, tamano=19)
        + parrafo("<strong>No lo contactás.</strong> Si hay que coordinar una entrega en su propiedad, se coordina con "
                  "el capataz o con Experiencia Solar.", margen=8)
        + preguntale([["Si la lista está cerrada de verdad", "Ingeniería"],
                      ["Si tenés aprobación para el gasto", "Finanzas"],
                      ["Qué hacer si un material demora", "Gerente de Operaciones"]], margen=10)
        + aviso("<strong>Qué registrás:</strong> si algo demora y puede mover la fecha de obra, lo avisás. Es de las "
                "pocas cosas de tu área que cambian lo que el cliente ya sabe.", "clave", margen=22),
        p))

    # Capítulo 7 · Tramitación UTE
    nueva("Tramitacion.dc.html", "Tramitación UTE", lambda p: pagina(
        "Tramitación UTE",
        rol("7", "Tramitación UTE",
            "Los hitos del trámite: consulta, apertura del caso, aprobación de la consulta, solicitud, aprobación "
            "del proyecto, documentos de obra, ensayos, documentos finales y habilitación.",
            "Cuando UTE habilita.")
        + subtitulo("Lo más importante de tu etapa", margen=26, tamano=19)
        + parrafo("Es la etapa donde <strong>el cliente ya tiene los paneles en el techo y no puede usarlos</strong>, y "
                  "donde la demora no depende de nosotros. Lo único que se mueve mientras él espera <strong>son tus "
                  "hitos</strong>.", margen=8)
        + aviso("<strong>Cada hito que marcás aparece en el historial del cliente</strong>, con el mismo nombre que él "
                "ve en su portal. Es lo que le permite a Experiencia Solar responderle algo cierto sin preguntarte. "
                "Marcarlos no es burocracia: es la única información que existe durante semanas.", "clave", margen=14)
        + subtitulo("Cuando falta documentación", margen=24, tamano=19)
        + parrafo("Si descubrís que faltó una firma o un documento de la obra, <strong>se lo reclamás al Gerente de "
                  "Operaciones</strong>. Nunca directo al capataz.", margen=8)
        + preguntale([["Cómo responder una observación de UTE", "Ingeniería"],
                      ["Que se corrija algo de la instalación", "<strong>Gerente de Operaciones</strong>"],
                      ["Documentación de obra que falta", "<strong>Gerente de Operaciones</strong>"]], margen=12)
        + subtitulo("Cuando habilita", margen=24, tamano=19)
        + parrafo("Al cerrar el trámite, <strong>el sistema le avisa solo a Experiencia Solar</strong> y arranca un "
                  "reloj de 24 a 48 horas. No hace falta que mandes un mensaje.", margen=8),
        p))

    # Capítulo 8 · Experiencia Solar
    nueva("ES1.dc.html", "Experiencia Solar · qué sos", lambda p: pagina(
        "Experiencia Solar",
        rol("8", "Experiencia Solar",
            "Acompañás al cliente <strong>de punta a punta</strong>, desde que firma hasta años después de que "
            "enciende. No sos el último eslabón: estás en toda la cadena.",
            "No termina. Sos la dueña del caso.")
        + subtitulo("8.1 · Lo que sos y lo que no", margen=26, tamano=21)
        + frase("Sos la dueña del caso, no el canal por donde pasa todo.", margen=12, tamano=21)
        + parrafo("No sos una ventanilla única —si todo tuviera que pasar por vos sería teléfono descompuesto y más "
                  "lento—: sos la responsable de que el cliente esté bien informado <strong>aunque otros hablen con "
                  "él</strong>. Como el médico de cabecera: el especialista te habla directo, pero él tiene tu "
                  "historia completa y responde por cómo va todo.", margen=14)
        + subtitulo("8.2 · El primer contacto", margen=26, tamano=21)
        + parrafo("<strong>Después de que te presentó el vendedor, y al día siguiente como máximo.</strong> En esas "
                  "primeras comunicaciones hacés tres cosas:", margen=8)
        + numerados(["<strong>La conversación de expectativa inicial</strong>: el recorrido completo con plazos reales, "
                     "<strong>incluido UTE</strong>. Es una conversación, idealmente por teléfono. Lo que se busca es "
                     "que el cliente pueda repetir con sus palabras cuánto va a demorar y por qué. <strong>Sin esto, "
                     "todo el silencio posterior se lee como abandono.</strong>",
                     "<strong>La tabla de referentes</strong>: a quién escribirle para qué (en la hoja siguiente).",
                     "<strong>El acceso al portal.</strong>"], margen=12),
        p))

    nueva("ES2.dc.html", "Experiencia Solar · referentes y ritmo", lambda p: pagina(
        "Experiencia Solar · la tabla de referentes",
        kicker("CAPÍTULO 8 · EXPERIENCIA SOLAR")
        + subtitulo("8.3 · La tabla que le entregás al cliente", margen=12, tamano=21)
        + tabla(["PARA…", "ESCRIBILE A…"],
                [["Horarios, accesos y materiales del día de obra", "<strong>[capataz]</strong> — [teléfono]"],
                 ["Todo lo demás", "<strong>Alejandra</strong> — [teléfono]"]], anchos=[None, 240], margen=14)
        + dicho("«Si alguna vez sentís que no te estamos respondiendo, escribime a mí» — y le pasás el contacto de "
                "Nicolás. Para lo de obra, el de Gabriel.", margen=16, rotulo_txt="Y DESPUÉS, COMO CIERRE")
        + subtitulo("Dos cuidados", margen=22, tamano=18)
        + numerados(["Se presenta como <strong>«este es tu equipo»</strong>, nunca como «estas son nuestras áreas».",
                     "<strong>El escalamiento va como excepción</strong>, no como una columna más de la tabla. Si se "
                     "presenta al mismo nivel que el contacto habitual, el cliente aprende que por ahí lo atienden "
                     "más rápido."], margen=10)
        + separador(26)
        + subtitulo("8.4 · Cada cuánto hablás con el cliente", margen=22, tamano=21)
        + frase("Como máximo una semana sin que el cliente sepa algo. Aunque no haya novedades.", margen=12, tamano=19)
        + dicho("«Te escribo para contarte que tu trámite sigue en curso, sin novedades todavía; apenas haya algo te "
                "aviso.»", margen=14)
        + parrafo("Eso vale más que el silencio. Lo que no se puede es <strong>inventar un avance que no "
                  "existe</strong>.", margen=12)
        + en_pm("El listado y la vista <strong>Recorrido</strong> te marcan a quién hace más que no se le habla. Los "
                "que nunca tuvieron contacto van primero.", margen=14),
        p))

    nueva("ES3.dc.html", "Experiencia Solar · los cuatro avisos", lambda p: pagina(
        "Experiencia Solar · los cuatro avisos",
        kicker("CAPÍTULO 8 · EXPERIENCIA SOLAR")
        + titulo("8.5 · Los cuatro avisos que no se pueden fallar", tamano=32)
        + tabla(["AVISO", "PLAZO"],
                [["Bienvenida y presentación", "Al cerrar la venta (lo manda el vendedor)"],
                 ["Fecha de obra confirmada", "2 días hábiles"],
                 ["Obra terminada y qué sigue", "El mismo día"],
                 ["Ya podés encender", "<strong style=\"color: #8f1d1d\">24 a 48 horas</strong>"]],
                anchos=[260, None], margen=22)
        + parrafo("<strong>Los tres primeros y el de habilitación se abren solos</strong> cuando pasa el hecho que los "
                  "dispara. No hace falta que nadie te avise: aparecen en tu pantalla, en el correo de la mañana, y "
                  "pintan la ficha del cliente de rojo.", margen=18)
        + aviso("<strong>El de habilitación es el más urgente de todos.</strong> Cada día que pasa <strong>el cliente "
                "deja de ahorrar plata</strong>: no es una demora administrativa, es dinero suyo que se pierde y no se "
                "recupera. A las 48 horas escala a Administración.", "duro", margen=16)
        + parrafo("<strong>En el mismo contacto va la capacitación:</strong> cómo encender, el acceso a la aplicación del "
                  "inversor, y qué generación esperar hoy. Sin ese último dato el cliente no sabe si lo que ve está "
                  "bien o mal.", margen=16)
        + separador(26)
        + subtitulo("8.9 · Los otros avisos del acompañamiento", margen=20, tamano=19)
        + parrafo("Además de los cuatro críticos:", margen=6, tamano=14.5)
        + vinetas(["<strong>Acceso al portal</strong> — apenas se crea el proyecto",
                   "<strong>Presentación del capataz</strong> — al arrancar la obra, con el alcance explícito",
                   "<strong>Cualquier visita a la propiedad</strong> — antes de que vayan. Y si está agendada y no se "
                   "puede ir, <strong>se avisa antes de la hora</strong>: el cliente confirmó, se quedó en la casa y "
                   "está esperando",
                   "<strong>Reprogramaciones</strong> — el mismo día, con el motivo",
                   "<strong>Avisos de encuesta</strong> — como contacto propio, nunca pegados a otro mensaje",
                   "<strong>Al cerrar la puesta en marcha</strong> — capacitación, acceso al inversor, alta en "
                   "reportes y recorrido por el portal"], margen=8, tamano=13.5),
        p))

    nueva("ES4.dc.html", "Experiencia Solar · reportes, pagos, granizo", lambda p: pagina(
        "Experiencia Solar · reportes, pagos y granizo",
        kicker("CAPÍTULO 8 · EXPERIENCIA SOLAR")
        + subtitulo("8.6 · Los reportes de generación", margen=12, tamano=20)
        + parrafo("<strong>Experiencia Solar → Reportes.</strong> Cada cliente recibe un reporte mensual con lo que "
                  "generó su sistema. <strong>El envío es por fecha de corte</strong>, no por mes calendario: cada "
                  "generador tiene el día en que UTE le cierra la factura, y el reporte sale cuando le toca a cada "
                  "uno. <strong>Enviar pendientes</strong> manda los que están en fecha.", margen=8, tamano=14.5)
        + parrafo("<strong>El reporte dice qué días cubre.</strong> Arriba de todo aparece el período exacto —del tal al "
                  "tal, tantos días— porque un ciclo de UTE no arranca el día 1. Sin eso, el cliente comparaba contra "
                  "su factura y los números no le cerraban.", margen=10, tamano=14.5)
        + subtitulo("8.7 · Los pagos del cliente", margen=24, tamano=20)
        + parrafo("En el <strong>historial de su ficha</strong> aparecen los cobros con la etiqueta "
                  "<strong>Cobros</strong>: qué pagó, cuánto y cuándo. Se muestran <strong>solo los cobros "
                  "efectivos</strong>, no los previstos: un cobro planificado es trabajo nuestro, no algo que el "
                  "cliente hizo. Los gastos de la obra tampoco aparecen, porque no son del cliente.", margen=8, tamano=14.5)
        + subtitulo("8.7 bis · El Plan de Protección contra Granizo", margen=24, tamano=20)
        + parrafo("Lo manejás en <strong>Experiencia Solar → Plan granizo</strong> y en la tarjeta del plan de la ficha "
                  "del cliente. <strong>No es un seguro</strong>: decís plan, anualidad y daño por granizo.",
                  margen=8, tamano=14.5)
        + vinetas(["<strong>Para activarlo</strong> hacen falta el <strong>Anexo A firmado</strong> (alcanza una foto) y "
                   "la <strong>primera anualidad paga</strong>. Subís la hoja y marcás el cobro con la fecha real del "
                   "pago. Si la instalación ya existía, pedís <strong>fotos de los paneles</strong> y las subís.",
                   "<strong>El nombre del cliente en rojo</strong> quiere decir que falta un mes o menos para vencer, "
                   "que venció sin pago o que quedó suspendido. Te llega el aviso por la campana y, si ya venció, "
                   "aparece en los pendientes del correo de la mañana. <strong>Le escribís vos</strong>: en la ficha "
                   "está <strong>Avisar al cliente</strong>, con el mensaje listo. Voltia PM no le escribe solo.",
                   "<strong>Si avisa un daño por granizo</strong>, lo registrás en el plan el mismo día y le respondés "
                   "ese día. Voltia PM te marca los plazos de inspección y reposición."], margen=10, tamano=13.5)
        + parrafo("El procedimiento completo está en el Manual de Posventa, capítulo 12.1.", margen=4, tamano=13),
        p))

    nueva("ES5.dc.html", "Experiencia Solar · cuando necesitás saber algo", lambda p: pagina(
        "Experiencia Solar · cuando necesitás saber algo",
        kicker("CAPÍTULO 8 · EXPERIENCIA SOLAR")
        + titulo("8.8 · Cuando necesitás saber algo", tamano=34)
        + frase("No deberías tener que preguntarle a nadie.", margen=20, tamano=24)
        + parrafo("La información está en el <strong>historial del cliente</strong>: los avances de etapa, los "
                  "comentarios de obra, los hitos del trámite, los documentos emitidos, los contactos anteriores. "
                  "Todo con el nombre del área de donde salió.", margen=20, tamano=16)
        + aviso("<strong>Lo único que te llega por mensaje de Operaciones es la fecha de obra.</strong> El resto lo "
                "mirás.", "clave", margen=20)
        + parrafo("<strong>Si algo no está, pedilo — pero al gerente del área, no a la persona.</strong> Y si es una "
                  "demora, lo que corresponde es que el área haya dejado el motivo.", margen=20, tamano=16)
        + figura(IMG.FICHA_ENCABEZADO, "La ficha del cliente: arriba sus datos, a la izquierda el recorrido en tres "
                 "etapas y a la derecha todo el historial.", margen=26),
        p))

    # ── Parte 3 ──────────────────────────────────────────────────────────────
    nueva("Parte3.dc.html", "Parte 3 · El cliente y Voltia PM", lambda p: portadilla_parte(
        "3", "El cliente y Voltia PM",
        "Lo que cruza a todas las áreas: los reclamos, las encuestas, cada pantalla de Voltia PM y qué hacer "
        "cuando algo sale mal.",
        [("9", "Reclamos", "Respuesta el mismo día hábil, siempre"),
         ("10", "Las encuestas", "Las genera el sistema; el aviso al cliente, no"),
         ("11", "Voltia PM, pantalla por pantalla", "El menú, el proyecto, la ficha, el calendario, el portal"),
         ("12", "Cuando algo sale mal", "Los casos que más se repiten y cómo se resuelven"),
         ("—", "Anexos", "Las reglas en una página y el glosario")],
        p, IMG.PORTADILLA_PARTE3))

    nueva("Reclamos.dc.html", "Reclamos", lambda p: pagina(
        "Reclamos",
        kicker("CAPÍTULO 9")
        + titulo("Reclamos")
        + frase("Respuesta el mismo día hábil, siempre.", margen=20, tamano=30)
        + parrafo("Aunque sea <em>«lo estoy viendo, te confirmo mañana»</em>. <strong>La solución puede demorar; el "
                  "cliente nunca queda sin respuesta.</strong>", margen=18, tamano=16)
        + subtitulo("Por dónde entran", margen=28, tamano=19)
        + tabla(["VÍA", "QUÉ PASA"],
                [["El portal de Voltia", "Queda registrado, avisa a Experiencia Solar y aparece en el correo de la "
                  "mañana si no se respondió"],
                 ["WhatsApp", "Es por donde entra la mayoría. <strong>No queda registrado solo</strong>: hay que "
                  "abrirlo como ticket o al menos anotarlo"]], anchos=[170, None], margen=10)
        + subtitulo("Derivar no es responder", margen=28, tamano=19)
        + parrafo("Si un reclamo pasa a un área técnica, <strong>el cliente igual tiene que escuchar algo ese "
                  "día</strong>:", margen=8)
        + dicho("«Ya lo estamos viendo con el equipo técnico.»", margen=12)
        + subtitulo("Por qué conviene que entren por el portal", margen=28, tamano=19)
        + parrafo("Un reclamo por WhatsApp le llega a <strong>una persona</strong>. Si esa persona está de licencia, el "
                  "reclamo no existe. Por el portal queda registrado, se mide, y nadie tiene que acordarse.", margen=8),
        p))

    nueva("Encuestas.dc.html", "Las encuestas", lambda p: pagina(
        "Las encuestas",
        kicker("CAPÍTULO 10")
        + titulo("Las encuestas")
        + bajada("<strong>Las genera el sistema solo</strong> y aparecen en el portal del cliente.")
        + tabla(["ENCUESTA", "CUÁNDO"],
                [["Instalación", "Al cerrarse la obra"],
                 ["Habilitación", "Al finalizar el trámite"],
                 ["Aniversario", "Cada año de la puesta en marcha"]], anchos=[200, None], margen=22)
        + parrafo("Tres preguntas cada una y <strong>solo la primera es obligatoria</strong>. El puntaje es el "
                  "promedio.", margen=18)
        + parrafo("<strong>Si alguna respuesta es baja</strong>, Experiencia Solar recibe un aviso para hacer "
                  "seguimiento. Cada nota baja genera el suyo: un cliente reiteradamente disconforme no se silencia "
                  "después del primero.", margen=12)
        + aviso("<strong>Lo que el sistema no hace es avisarle al cliente que tiene una encuesta.</strong> Por eso hay "
                "un paso para eso. Sin ese aviso, la encuesta se queda en el portal sin que nadie la vea.", "ojo",
                margen=22)
        + cita("encuesta_obra", margen=22),
        p))

    # Capítulo 11 · Voltia PM, pantalla por pantalla
    nueva("App1.dc.html", "Voltia PM · cómo se entra y el menú", lambda p: pagina(
        "Voltia PM · cómo se entra y el menú",
        kicker("CAPÍTULO 11")
        + titulo("Voltia PM, pantalla por pantalla")
        + subtitulo("Cómo se entra", margen=26, tamano=19)
        + parrafo("Con tu <strong>mail o con tu usuario corto</strong> —«nicolas» en vez del mail completo—, las dos "
                  "formas sirven igual. Si no sabés cuál es el tuyo, te lo dice Administración.", margen=8)
        + subtitulo("El menú", margen=26, tamano=19)
        + tabla(["MENÚ", "PARA QUÉ"],
                [["Mis tareas", "Lo que tenés pendiente vos: tareas, traspasos por confirmar, tickets"],
                 ["Dashboard", "El panorama general"],
                 ["Proyectos", "El pipeline de cada obra, sus etapas y sus comentarios"],
                 ["Ingeniería", "Las herramientas del proyectista"],
                 ["Calendario", "La agenda de instalaciones"],
                 ["Ventas", "Los leads y las propuestas"],
                 ["Experiencia Solar", "Los Generadores, el Recorrido, encuestas, reportes y el Plan de Protección "
                  "contra Granizo"],
                 ["Trámites UTE", "Los trámites y sus hitos"]], anchos=[170, None], margen=10)
        + aviso("En el <strong>menú de tu usuario</strong>, arriba a la derecha, está <strong>Capacitación</strong>: "
                "videos y documentos para aprender a usar Voltia PM, divididos por área. Cada uno ve los de su rol. "
                "Los videos se miran adentro, con una lista al costado que marca cuáles ya viste y recuerda por dónde "
                "ibas.", "clave", margen=22),
        p))

    nueva("App2.dc.html", "Voltia PM · el proyecto", lambda p: pagina(
        "Voltia PM · el proyecto",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("El proyecto", tamano=34)
        + parrafo("Entrás desde <strong>Proyectos</strong> y elegís el cliente en la lista de la izquierda (se puede "
                  "plegar con el botón de arriba).", margen=12)
        + figura(IMG.PROYECTO, "Arriba la fila de botones que lleva al mismo cliente en los otros módulos; abajo el "
                 "pipeline con las ocho etapas y sus subetapas.", margen=18)
        + vinetas(["<strong>El pipeline</strong> muestra las ocho etapas con su avance. Se hace clic en una y se abre con "
                   "sus subetapas y su checklist.",
                   "<strong>Para comentar</strong>, entrás a la etapa donde estás trabajando y escribís ahí. <strong>Eso es "
                   "lo que llega al historial del cliente.</strong>",
                   "<strong>Para subir fotos, videos o documentos</strong>, también dentro de su etapa.",
                   "Arriba hay una fila de botones —<strong>Proyecto · Ingeniería · Trámite UTE · Experiencia "
                   "Solar</strong>— que te lleva <strong>al mismo cliente</strong> en el otro módulo."], margen=18),
        p))

    nueva("App3.dc.html", "Voltia PM · la ficha del cliente", lambda p: pagina(
        "Voltia PM · la ficha del cliente",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("La ficha del cliente", tamano=34)
        + parrafo("Entrás desde <strong>Experiencia Solar</strong> y elegís el cliente. Es <strong>una sola "
                  "pantalla</strong>:", margen=12)
        + vinetas(["<strong>Arriba</strong>: todos sus datos —mail, teléfono, dirección, asesor, potencia, fechas— y "
                   "cuántos días hace que no se lo contacta.",
                   "<strong>A la izquierda</strong>: el recorrido en tres etapas. Se hace clic en una y aparecen sus "
                   "pasos, con el botón de <strong>Plantillas</strong> de esa etapa y el de <strong>Completar los "
                   "N</strong> si quedan pendientes.",
                   "<strong>A la derecha</strong>: <strong>todo el historial</strong>, lo más nuevo arriba, con el nombre "
                   "del área de donde salió cada cosa. Arriba de todo, el cuadro para registrar un contacto nuevo.",
                   "<strong>Más abajo</strong>: el <strong>trámite UTE</strong> desplegado con todos sus hitos: es lo "
                   "mismo que el cliente ve en su portal.",
                   "<strong>Debajo del trámite</strong>: la tarjeta del <strong>Plan de Protección contra "
                   "Granizo</strong>, para darlo de alta, abrirlo y generar las condiciones con el Anexo A. Si el plan "
                   "necesita atención, el nombre del cliente sale en rojo arriba de todo."], margen=12, tamano=14)
        + figura(IMG.TRAMITE_UTE, "El trámite UTE dentro de la ficha, hito por hito.", margen=16, ancho="72%"),
        p))

    nueva("App4.dc.html", "Voltia PM · el calendario", lambda p: pagina(
        "Voltia PM · el calendario",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("El calendario", tamano=34)
        + parrafo("<strong>Ya no es solo de obras.</strong> Además de las instalaciones se agenda <strong>cualquier cosa "
                  "que ocupe a alguien</strong>: visitas de relevamiento, trámites, mantenimientos, y una categoría "
                  "<strong>Otros</strong> para lo que no entre en las demás.", margen=12)
        + vinetas(["Cada evento se asigna a un <strong>equipo</strong>, y el color del calendario es el del equipo.",
                   "Lo agendado <strong>se puede editar y eliminar</strong>, no solo crear.",
                   "Las instalaciones siguen funcionando igual que siempre: al confirmar la fecha se avisa solo a "
                   "Experiencia Solar, y al reprogramar se pide el motivo."], margen=12)
        + figura(IMG.CALENDARIO, "El calendario: la leyenda distingue la fecha tentativa de la confirmada.", margen=18),
        p))

    nueva("App5.dc.html", "Voltia PM · la media hora de la mañana", lambda p: pagina(
        "Voltia PM · la media hora de la mañana",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("La media hora de la mañana", tamano=34)
        + bajada("La rutina de Experiencia Solar, en cinco pasos. Está desarrollada en el Manual de Posventa (8.0); acá "
                 "queda para que el resto del equipo sepa cómo se trabaja la cartera.")
        + numerados([
            "<strong>Se abre el correo del recorrido.</strong> Si no llegó, no hay nada vencido ni nada nuevo.",
            "<strong>Se vacían los Pendientes, todos, hoy.</strong> Son los únicos con plazo vencido.",
            "<strong>Se mira cada Novedad y se decide una cosa: ¿esto le importa al cliente?</strong> Si le importa, "
            "se le avisa; si no, no se lo molesta y se aprieta <strong>«Ya lo vi»</strong>, que apaga el punto sin "
            "inventar un contacto. Nunca se registra un contacto que no existió para limpiar la lista.",
            "<strong>Se ataca Fuera de cadencia de arriba hacia abajo</strong>, hasta donde se llegue. Acá no hace "
            "falta tener novedad para escribir: el contacto es el punto. Son clientes de E1 y E2: los ya habilitados "
            "no entran en esta lista.",
            "<strong>Todo contacto se registra</strong>, aunque haya sido corto. Sin registro, para el sistema no pasó "
            "nada y el cliente sigue apareciendo como olvidado."], margen=22)
        + aviso("Los <strong>reclamos nuevos no esperan a la mañana siguiente</strong>: respuesta el mismo día hábil, "
                "siempre.", "duro", margen=22)
        + subtitulo("El correo de la mañana", margen=28, tamano=19)
        + parrafo("Llega un correo diario con lo pendiente: <strong>arriba lo vencido</strong> —avisos sin dar, pasos con "
                  "el plazo pasado, reclamos sin responder— y abajo, por etapa, quiénes están fuera de cadencia (solo "
                  "E1 y E2). <strong>Si no hay nada pendiente, no llega.</strong>", margen=8),
        p))

    nueva("App6.dc.html", "Voltia PM · el Recorrido", lambda p: pagina(
        "Voltia PM · el Recorrido",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("El Recorrido", tamano=34)
        + parrafo("<strong>Experiencia Solar → Recorrido.</strong> La cartera partida en las tres etapas, una columna "
                  "cada una, ordenada por días sin contacto.", margen=12)
        + figura(IMG.RECORRIDO, "Una columna por etapa. El triángulo marca el aviso pendiente; el punto naranja, la "
                 "novedad sin contar.", margen=16, ancho="84%")
        + subtitulo("Dos señales, y significan cosas distintas", margen=22, tamano=18)
        + tabla(["SEÑAL", "QUÉ DICE"],
                [["Triángulo rojo", "Falta uno de los avisos clave <strong>y hay plazo</strong>"],
                 ["Punto", "Pasó algo después de la última vez que le hablamos. Se apaga al registrar el contacto, o "
                  "con <strong>«Ya lo vi»</strong> (arriba del historial, en la ficha)"]], anchos=[150, None], margen=8)
        + aviso("<strong>El punto no cambia el orden a propósito.</strong> Es un «no leído», no una tarea: si "
                "reordenara, un cliente con novedad pero contactado ayer taparía al que lleva quince días sin que nadie "
                "le hable.", "ojo", margen=16),
        p))

    nueva("App7.dc.html", "Voltia PM · mensajes modelo y portal", lambda p: pagina(
        "Voltia PM · los mensajes modelo y el portal",
        kicker("CAPÍTULO 11 · VOLTIA PM, PANTALLA POR PANTALLA")
        + titulo("Los mensajes modelo", tamano=30)
        + parrafo("En la ficha del cliente, dentro de cada etapa, el botón <strong>Plantillas</strong>. Hay quince "
                  "mensajes listos.", margen=10)
        + vinetas(["<strong>Vienen con el nombre del cliente y el tuyo ya puestos.</strong> Lo que el sistema no puede "
                   "saber —una fecha, un motivo, un plazo— queda marcado a la vista y abajo te dice <strong>qué falta "
                   "completar</strong>.",
                   "<strong>Se editan antes de copiar.</strong> Son un piso de tono, no un molde.",
                   "<strong>Al copiar queda registrado el contacto.</strong>"], margen=10, tamano=14)
        + figura(IMG.PLANTILLAS, "Se elige el mensaje a la izquierda, se lee y se copia a la derecha.", margen=12,
                 ancho="86%")
        + separador(22)
        + titulo("El portal de Voltia", tamano=30)
        + parrafo("El cliente ve <strong>el avance de su trámite con todos los hitos, su documentación, sus reportes de "
                  "generación</strong>, y puede <strong>abrir un reclamo</strong> desde ahí.", margen=10, tamano=14.5)
        + parrafo("<strong>Se le crea el acceso desde el paso «Envío del acceso al portal»</strong>, con el ícono que está "
                  "en el propio paso. <strong>No hace falta que tenga mail</strong>: si no lo hay, el sistema usa su "
                  "cédula o le arma un usuario con su nombre. Al terminar, la plantilla del mensaje sale con el "
                  "usuario y la contraseña adentro.", margen=8, tamano=14.5)
        + aviso("Si el cliente <strong>ya tenía acceso</strong>, la contraseña no se puede recuperar. Para mandársela "
                "hay que resetearla con el botón de reenviar.", "ojo", margen=14),
        p))

    # Capítulo 12 · Cuando algo sale mal
    def caso(t, cuerpo_caso, margen=24):
        return subtitulo(t, margen=margen, tamano=19) + cuerpo_caso

    nueva("SaleMal1.dc.html", "Cuando algo sale mal · 1", lambda p: pagina(
        "Cuando algo sale mal",
        kicker("CAPÍTULO 12")
        + titulo("Cuando algo sale mal")
        + caso("El cliente reclama que nadie le avisó de algo", numerados([
            "<strong>Mirá el historial de su ficha antes de responder.</strong> Ahí está todo.",
            "Si <strong>efectivamente no se le avisó</strong>: se reconoce y se avisa ahora. <em>«Tenés razón, esto se "
            "nos pasó»</em> cierra una conversación que una excusa mantiene abierta.",
            "Si <strong>sí se le avisó</strong> y no lo recuerda: se le reenvía lo que se le mandó, sin señalarle que "
            "ya se lo habíamos dicho."], margen=10), margen=26)
        + caso("Se pasó un plazo y el paso está en rojo", parrafo(
            "<strong>Vencer no bloquea nada.</strong> No frena la obra ni el trámite: se ve, se hace, y listo. Lo que no "
            "hay que hacer es <strong>tildarlo sin haberlo hecho</strong>: ahí el tablero pasa a mentir y perdemos la "
            "única señal que tenemos.", margen=8))
        + caso("El cliente te pregunta algo que no sabés", parrafo(
            "<em>«Te averiguo y te confirmo»</em>, con un plazo concreto: <em>«antes de fin del día»</em>. Después lo "
            "averiguás internamente. <strong>Nunca lo mandás a preguntar a otro.</strong>", margen=8))
        + caso("Otra área tuvo un intercambio con el cliente y no te enteraste", parrafo(
            "Se resuelve con la regla 4: cada uno anota en su etapa y llega solo. <strong>Si alguien no lo está "
            "haciendo, el problema no es de la persona: es que registrar le cuesta.</strong> Hay que mirar desde dónde "
            "tendría que hacerlo.", margen=8)),
        p))

    nueva("SaleMal2.dc.html", "Cuando algo sale mal · 2", lambda p: pagina(
        "Cuando algo sale mal · 2",
        kicker("CAPÍTULO 12 · CUANDO ALGO SALE MAL")
        + caso("Una etapa lleva mucho tiempo", parrafo(
            "<strong>No pidas explicaciones.</strong> Fijate si el área dejó el motivo en su etapa. Si no está y la "
            "demora afecta algo que ya le prometimos al cliente, se plantea en la reunión de coordinación.", margen=8),
            margen=12)
        + aviso("<strong>La excepción:</strong> si el cliente te está pidiendo explicaciones a vos y necesitás algo "
                "cierto que decirle, preguntá — <strong>al gerente del área</strong>, no a la persona que está "
                "ejecutando.", "clave", margen=14)
        + caso("El cliente no tiene mail", parrafo(
            "<strong>No es un impedimento</strong> para darle acceso al portal. Se le crea igual con la cédula o con un "
            "usuario armado con su nombre.", margen=8), margen=28)
        + figura(IMG.PORTAL_CLIENTE, "El portal, como lo ve el cliente: el avance del trámite, sus reportes, sus "
                 "tickets y las encuestas.", margen=26, ancho="80%"),
        p))

    # ── Anexos ───────────────────────────────────────────────────────────────
    nueva("AnexoReglas.dc.html", "Anexo · Las reglas en una página", anexo_reglas)

    nueva("AnexoGlosario.dc.html", "Anexo · Glosario", lambda p: pagina(
        "Glosario",
        kicker("ANEXO")
        + titulo("Glosario")
        + tabla(["PALABRA", "QUÉ ES"],
                [["Generador", "El cliente, una vez que su instalación existe. Es como lo llama UTE y como lo llama "
                  "Voltia PM."],
                 ["E1 / E2 / E3", "Los tres tramos del acompañamiento al cliente. <strong>No son las etapas del "
                  "proyecto.</strong>"],
                 ["Etapa", "Cada uno de los ocho tramos del proyecto, de Onboarding a Trámite UTE."],
                 ["Subetapa", "Las tareas dentro de una etapa, con su checklist."],
                 ["Traspaso", "El pase de trabajo de un área a la siguiente. Lo genera el sistema al completarse una "
                  "etapa."],
                 ["Paso", "Un aviso al cliente dentro del recorrido de Experiencia Solar. Algunos tienen plazo; "
                  "<strong>vencer no bloquea</strong>."],
                 ["Cadencia", "Los <strong>días hábiles</strong> sin contacto a partir de los cuales un cliente se "
                  "marca: 5 en E1 y E2. <strong>E3 no tiene</strong>, porque no termina nunca y marcaría a todos para "
                  "siempre."],
                 ["Novedad", "Pasó algo en el proyecto después del último contacto: el cliente todavía no lo sabe."],
                 ["Ticket", "Un reclamo o consulta registrado, con estado y responsable."],
                 ["Portal", "Lo que ve el cliente: avance, documentación, reportes, tickets y encuestas."]],
                anchos=[150, None], margen=24),
        p))

    nueva("Cierre.dc.html", "Cierre", lambda p: cierre())
    return P


if __name__ == "__main__":
    destino = sys.argv[1] if len(sys.argv) > 1 else "."
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
        "title": "Manual de Trabajo — Cómo trabajamos en Voltia",
        "launch": {"view": "canvas"},
        "pages": [],
        "designSystems": [],
        "boards": boards,
        "order": orden,
        "notes": {"titulo": {"x": 0, "y": -300, "text": "Manual de Trabajo — Cómo trabajamos en Voltia",
                             "kind": "title1", "maxW": 6 * ANCHO + 5 * 80}},
    }
    with open(os.path.join(carpeta, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    print(f"{len(paginas)} páginas")
