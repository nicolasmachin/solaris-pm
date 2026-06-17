#!/usr/bin/env python3
"""Generador headless de propuesta comercial Voltia.

Adaptación del script original (script_Propuesta_2026.py) para correr
sin interfaz gráfica desde el backend de Voltia PM. NO usa tkinter ni
abre el PDF al finalizar.

Uso:
    python3 generate_proposal.py <ruta_excel> <ruta_salida_pdf>

Lee la hoja "CALCULADORA" del Excel, genera los gráficos con matplotlib
y sobreescribe Original.pdf con los datos del cliente, escribiendo el
resultado en <ruta_salida_pdf>.
"""

import io
import os
import sys
import tempfile
import traceback

import matplotlib
matplotlib.use("Agg")  # backend sin display (headless)
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import pandas as pd
from openpyxl.utils import coordinate_to_tuple
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


BASE_PATH = os.path.dirname(os.path.abspath(__file__))


def _log(msg: str) -> None:
    print(msg, flush=True)


def _fail(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)


# ─── Helpers de lectura ──────────────────────────────────────────────────────

def leer_celda(df, coord):
    fila, columna = coordinate_to_tuple(coord)
    fila -= 1
    columna -= 1
    try:
        return df.iloc[fila, columna]
    except IndexError:
        _log(f"Celda fuera de rango: {coord}")
        return "N/A"


def convertir_a_float(valor, default=0.0):
    if valor is None:
        return default
    texto = str(valor).strip()
    if not texto:
        return default
    texto = texto.replace("USD", "").replace("usd", "")
    texto = texto.replace("kWh", "").replace("kwh", "")
    texto = texto.replace(" ", "")
    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return default


def convertir_a_entero(valor, default=0):
    return int(round(convertir_a_float(valor, default)))


# ─── Gráficos ────────────────────────────────────────────────────────────────

def generar_grafico_energia(potencia_kwp, energia_anual, ruta_salida):
    meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
             'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    factores_mensuales = [0.105, 0.095, 0.092, 0.080, 0.070, 0.062,
                          0.066, 0.074, 0.082, 0.090, 0.092, 0.092]

    if energia_anual is None or energia_anual <= 0:
        energia_anual = potencia_kwp * 1500

    energia_mensual = [round(energia_anual * factor) for factor in factores_mensuales]

    fig, ax = plt.subplots(figsize=(10, 4.8))
    barras = ax.bar(meses, energia_mensual, color='#336699')

    ax.set_title('Generación estimada de energía mensual', fontsize=14, color='#336699', weight='bold')
    ax.set_xlabel('Meses', fontsize=11, color='#1a1a1a')
    ax.set_ylabel('Energía (kWh)', fontsize=11, color='#1a1a1a')
    ax.tick_params(axis='x', colors='#1a1a1a', labelsize=10)
    ax.tick_params(axis='y', colors='#1a1a1a', labelsize=10)

    for spine in ['top', 'right']:
        ax.spines[spine].set_visible(False)
    ax.spines['left'].set_color('lightgray')
    ax.spines['bottom'].set_color('lightgray')

    for rect, valor in zip(barras, energia_mensual):
        ax.text(
            rect.get_x() + rect.get_width() / 2.0,
            rect.get_height(),
            f'{valor}',
            ha='center',
            va='bottom',
            fontsize=9,
            color='#1a1a1a',
        )

    ax.grid(False)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    plt.tight_layout()
    plt.savefig(ruta_salida, dpi=150)
    plt.close(fig)
    return ruta_salida


def generar_grafico_retorno(precio_total, ahorro_anual, ruta_salida):
    años = list(range(0, 16))
    retorno = [-precio_total + año * ahorro_anual for año in años]
    colores = ['#A7C7E7' if valor < 0 else '#336699' for valor in retorno]

    fig, ax = plt.subplots(figsize=(10, 5))
    barras = ax.bar(años, retorno, color=colores)

    ax.set_title('Retorno de Inversión en USD', fontsize=14, color='#336699', weight='bold')
    ax.set_xlabel('Años', fontsize=12, weight='medium', color='#1a1a1a')
    ax.set_ylabel('USD', fontsize=12, weight='medium', color='#1a1a1a')
    ax.tick_params(axis='x', colors='#1a1a1a', labelsize=11)
    ax.tick_params(axis='y', colors='#1a1a1a', labelsize=11)

    # Sin notación científica ni offset; ticks con separador de miles uruguayo (.)
    ax.ticklabel_format(useOffset=False, style='plain', axis='y')
    ax.yaxis.set_major_formatter(
        FuncFormatter(lambda x, _: f"{int(x):,}".replace(",", "."))
    )

    for spine in ['top', 'right']:
        ax.spines[spine].set_visible(False)
    ax.spines['left'].set_color('lightgray')
    ax.spines['bottom'].set_color('lightgray')
    ax.axhline(0, color='gray', linewidth=0.8, linestyle='--')

    for i, rect in enumerate(barras):
        valor = retorno[i]
        ax.text(
            rect.get_x() + rect.get_width() / 2.0,
            rect.get_height(),
            f"{int(valor):,}".replace(",", "."),
            ha='center',
            va='bottom' if valor >= 0 else 'top',
            fontsize=10,
            color='#1a1a1a',
            weight='medium',
        )

    ax.grid(False)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    plt.tight_layout()
    plt.savefig(ruta_salida, dpi=150)
    plt.close(fig)
    return ruta_salida


# ─── Sobreescritura del PDF ──────────────────────────────────────────────────

def sobrescribir_pdf(pdf_file, datos, output_file, coordenadas, font_size=12, formatos=None, imagenes_en_paginas=None):
    reader = PdfReader(pdf_file)
    writer = PdfWriter()

    total_coordenadas = sum(len(page_coords) for page_coords in coordenadas if page_coords is not None)
    if len(datos) < total_coordenadas:
        raise ValueError(
            f"El archivo de datos tiene {len(datos)} líneas, se necesitan al menos {total_coordenadas}."
        )

    datos_por_pagina = []
    inicio = 0
    for page_coords in coordenadas:
        if page_coords is not None:
            fin = inicio + len(page_coords)
            datos_por_pagina.append(datos[inicio:fin])
            inicio = fin
        else:
            datos_por_pagina.append(None)

    for page_num, page in enumerate(reader.pages):
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)

        if page_num < len(coordenadas) and coordenadas[page_num] is not None:
            for i, (x, y) in enumerate(coordenadas[page_num]):
                if i < len(datos_por_pagina[page_num]):
                    dato = datos_por_pagina[page_num][i]

                    if formatos and page_num < len(formatos) and i < len(formatos[page_num]):
                        fmt = formatos[page_num][i]
                        fuente = fmt.get("font", "Calibri")
                        tamano = fmt.get("size", font_size)
                        color = fmt.get("color", (0, 0, 0))
                        can.setFont(fuente, tamano)
                        can.setFillColorRGB(*color)
                    else:
                        can.setFont("Calibri", font_size)
                        can.setFillColorRGB(0, 0, 0)

                    can.drawString(x, y, dato)

        if imagenes_en_paginas and page_num in imagenes_en_paginas:
            try:
                img_info = imagenes_en_paginas[page_num]
                img = ImageReader(img_info['path'])
                can.drawImage(
                    img,
                    x=img_info.get('x', 100),
                    y=img_info.get('y', 400),
                    width=img_info.get('width', 300),
                    height=img_info.get('height', 200),
                    preserveAspectRatio=True,
                )
            except Exception as e:
                _log(f"Error al insertar imagen en página {page_num + 1}: {e}")

        can.save()
        packet.seek(0)
        new_pdf = PdfReader(packet)
        if len(new_pdf.pages) > 0:
            page.merge_page(new_pdf.pages[0])

        writer.add_page(page)

    with open(output_file, "wb") as output_pdf:
        writer.write(output_pdf)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        _fail(
            "Uso: generate_proposal.py <ruta_excel> <ruta_salida_pdf>\n"
            f"Argumentos recibidos: {sys.argv[1:]}"
        )

    excel_path = sys.argv[1]
    output_path = sys.argv[2]

    pdf_original = os.path.join(BASE_PATH, "Original.pdf")
    calibri_path = os.path.join(BASE_PATH, "calibri.ttf")
    calibrib_path = os.path.join(BASE_PATH, "calibrib.ttf")

    for required in (pdf_original, calibri_path, calibrib_path):
        if not os.path.exists(required):
            _fail(f"Archivo requerido faltante: {required}")

    if not os.path.exists(excel_path):
        _fail(f"No se encontró el Excel: {excel_path}")

    pdfmetrics.registerFont(TTFont('Calibri', calibri_path))
    pdfmetrics.registerFont(TTFont('Calibri-Bold', calibrib_path))

    _log("[1/5] Leyendo Excel (hoja CALCULADORA)...")
    try:
        df = pd.read_excel(excel_path, sheet_name="CALCULADORA", engine="openpyxl", header=None)
    except ValueError as e:
        _fail(f"El Excel no tiene una hoja llamada 'CALCULADORA': {e}")
    except Exception as e:
        _fail(f"No se pudo leer el Excel: {e}")

    celdas = {
        "Cliente": "C35", "Fecha_tapa": "C36", "Fecha": "C37", "Dirigido": "C38",
        "Lugar": "C39", "Paneles": "C40", "Pot_paneles": "C41", "Techo": "C42",
        "Tamaño": "C43", "Pot_IMG": "C44", "Energia": "C45", "Marca_panel": "C46",
        "Marca_inversor": "C47", "Pot_inversor": "C48", "Pot_IMG2": "C49", "Red": "C50",
        "Precio_siniva": "C51", "Precio_coniva": "C52", "Tarifa": "C53", "Paga_UTE": "C54",
        "Paga_nuevo": "C55", "Ahorra": "C56", "Ahorro_mes": "C57", "Ahorro_año": "C58",
        "TIR": "C59", "PRI": "C60", "Dolar": "C61", "PRI2": "C62",
        "24cuotas": "C63", "36cuotas": "C64", "60cuotas": "C65", "Energia_grafica": "C67",
    }

    variables = {clave: str(leer_celda(df, celda)) for clave, celda in celdas.items()}
    variables["Dirigido"] = f"{variables['Dirigido']},"

    datos_propuesta = [
        variables.get('Cliente', ''),
        variables.get('Fecha_tapa', ''),
        variables.get('Fecha', ''),
        variables.get('Dirigido', ''),
        variables.get('Cliente', '') + '.',
        variables.get('Lugar', ''),
        variables.get('Paneles', ''),
        variables.get('Pot_paneles', ''),
        variables.get('Techo', ''),
        variables.get('Tamaño', ''),
        variables.get('Pot_IMG', ''),
        variables.get('Energia', ''),
        variables.get('Marca_panel', ''),
        variables.get('Pot_paneles', '') + ' W',
        variables.get('Paneles', ''),
        variables.get('Marca_inversor', ''),
        variables.get('Pot_inversor', '') + ',0 kW',
        variables.get('Paneles', ''),
        variables.get('Pot_paneles', ''),
        variables.get('Marca_panel', '') + '.',
        variables.get('Red', ''),
        variables.get('Pot_inversor', ''),
        variables.get('Marca_inversor', '') + '.',
        variables.get('Pot_IMG2', ''),
        variables.get('Precio_siniva', ''),
        variables.get('Precio_coniva', ''),
        variables.get('24cuotas', ''),
        variables.get('36cuotas', ''),
        variables.get('60cuotas', ''),
        variables.get('Tarifa', ''),
        variables.get('Paga_UTE', ''),
        variables.get('Tarifa', ''),
        variables.get('Paga_nuevo', ''),
        variables.get('Ahorra', ''),
        variables.get('Precio_coniva', ''),
        variables.get('Ahorro_mes', ''),
        variables.get('Ahorro_año', ''),
        variables.get('TIR', ''),
        variables.get('PRI', ''),
        variables.get('Dolar', ''),
        variables.get('PRI2', ''),
    ]

    coordenadas_propuesta = [
        [(328, 472), (328, 437)],
        [(420, 723.5), (72, 665)],
        [(132, 663.7), (286, 649)],
        [(200, 248), (310.5, 248), (158, 233), (433, 184), (494, 129.5)],
        [(231, 723.5), (165, 395), (200, 380), (177, 365), (166, 315), (218, 300)],
        [(104, 467), (223, 467), (424, 467), (157, 451.5), (230, 451.5), (362, 451.5)],
        [(280, 237), (355, 237), (463, 237)],
        [(480, 498), (480, 482), (480, 466)],
        [(275, 341), (380, 341), (275, 326), (380, 326), (463, 326)],
        [(85, 706.5), (160, 706.5), (280, 706.5), (395, 706.5), (475, 706.5), (266, 675.7), (184, 600)],
    ]

    formatos_personalizados = [
        [{"font": "Calibri-Bold", "size": 22, "color": (1, 1, 1)},
         {"font": "Calibri", "size": 19, "color": (1, 1, 1)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri-Bold", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)}],
        [{"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 12, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 11, "color": (0, 0, 0)},
         {"font": "Calibri", "size": 11, "color": (0, 0, 0)}],
    ]

    pot_img = convertir_a_float(variables.get('Pot_IMG', '0'))
    energia_anual = convertir_a_float(variables.get('Energia_grafica', '0'))
    precio_coniva = convertir_a_entero(variables.get('Precio_coniva', '0'))
    ahorro_anual = convertir_a_entero(variables.get('Ahorro_año', '0'))

    # Tempdir aislado para los assets temporales — evita race conditions si dos
    # ejecuciones corren en paralelo y dejan archivos en BASE_PATH.
    with tempfile.TemporaryDirectory(prefix="voltia-proposal-") as tmpdir:
        _log("[2/5] Generando gráfico de energía mensual...")
        ruta_grafico_energia = generar_grafico_energia(
            pot_img, energia_anual, os.path.join(tmpdir, "grafico_energia.png")
        )

        _log("[3/5] Generando gráfico de retorno de inversión...")
        ruta_grafico_retorno = generar_grafico_retorno(
            precio_coniva, ahorro_anual, os.path.join(tmpdir, "grafico_retorno.png")
        )

        imagenes_en_paginas = {
            4: {"path": ruta_grafico_energia, "x": 80, "y": 420, "width": 450, "height": 300},
            9: {"path": ruta_grafico_retorno, "x": 80, "y": 280, "width": 450, "height": 300},
        }

        _log("[4/5] Sobreescribiendo PDF base con datos del cliente...")
        # Asegurar que el directorio del output exista.
        output_dir = os.path.dirname(os.path.abspath(output_path))
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        sobrescribir_pdf(
            pdf_original,
            datos_propuesta,
            output_path,
            coordenadas_propuesta,
            font_size=11,
            formatos=formatos_personalizados,
            imagenes_en_paginas=imagenes_en_paginas,
        )

    _log(f"[5/5] PDF generado correctamente: {output_path}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
