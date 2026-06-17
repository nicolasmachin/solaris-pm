from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import tkinter as tk
import pandas as pd
from openpyxl.utils import coordinate_to_tuple

from tkinter import filedialog
import io
import os
import sys
import subprocess


BASE_PATH = os.path.dirname(os.path.abspath(__file__))

# Registrar fuentes usando la carpeta del script
pdfmetrics.registerFont(TTFont('Calibri', os.path.join(BASE_PATH, 'calibri.ttf')))
pdfmetrics.registerFont(TTFont('Calibri-Bold', os.path.join(BASE_PATH, 'calibrib.ttf')))


def leer_celda(df, coord):
    fila, columna = coordinate_to_tuple(coord)
    fila -= 1
    columna -= 1
    try:
        return df.iloc[fila, columna]
    except IndexError:
        print(f"⚠️ Celda fuera de rango: {coord}")
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


def generar_grafico_energia(potencia_kwp, energia_anual=None):
    meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
             'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    # Distribución mensual aproximada para Uruguay
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
            color='#1a1a1a'
        )

    ax.grid(False)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    ruta_salida = os.path.join(BASE_PATH, "grafico_energia.png")
    plt.tight_layout()
    plt.savefig(ruta_salida, dpi=150)
    plt.close()
    return ruta_salida


def generar_grafico_retorno(precio_total, ahorro_anual):
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
            weight='medium'
        )

    ax.grid(False)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    ruta_salida = os.path.join(BASE_PATH, "grafico_retorno.png")
    plt.tight_layout()
    plt.savefig(ruta_salida, dpi=150)
    plt.close()
    return ruta_salida


def seleccionar_imagen():
    root = tk.Tk()
    root.withdraw()
    root.update_idletasks()
    root.lift()
    root.attributes('-topmost', 1)
    archivo_imagen = filedialog.askopenfilename(
        title="Seleccionar imagen",
        filetypes=[("Archivos de imagen", "*.png;*.jpg;*.jpeg;*.bmp")]
    )
    root.attributes('-topmost', 0)
    root.destroy()
    return archivo_imagen


def leer_datos(txt_file):
    with open(txt_file, 'r', encoding='utf-8') as file:
        datos = file.readlines()
    return [d.strip() for d in datos]


def leer_variables(ruta_archivo_variables):
    variables = {}
    with open(ruta_archivo_variables, 'r', encoding='utf-8') as archivo:
        for linea in archivo:
            if '=' in linea:
                nombre, valor = linea.strip().split('=', 1)
                variables[nombre.strip()] = valor.strip()
    return variables


def escribir_archivo_salida(ruta_archivo_salida, datos):
    with open(ruta_archivo_salida, 'w', encoding='utf-8') as archivo:
        for dato in datos:
            archivo.write(dato + '\n')


def sobrescribir_pdf(pdf_file, datos, output_file, coordenadas, font_size=12, formatos=None, imagenes_en_paginas=None):
    reader = PdfReader(pdf_file)
    writer = PdfWriter()

    total_coordenadas = sum(len(page_coords) for page_coords in coordenadas if page_coords is not None)
    if len(datos) < total_coordenadas:
        print(f"Error: El archivo de texto debe contener al menos {total_coordenadas} líneas de datos.")
        return

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
                img_path = img_info['path']
                x = img_info.get('x', 100)
                y = img_info.get('y', 400)
                width = img_info.get('width', 300)
                height = img_info.get('height', 200)
                img = ImageReader(img_path)
                can.drawImage(img, x=x, y=y, width=width, height=height, preserveAspectRatio=True)
            except Exception as e:
                print(f"Error al insertar imagen en página {page_num + 1}: {e}")

        can.save()
        packet.seek(0)
        new_pdf = PdfReader(packet)
        if len(new_pdf.pages) > 0:
            page.merge_page(new_pdf.pages[0])

        writer.add_page(page)

    with open(output_file, "wb") as output_pdf:
        writer.write(output_pdf)


if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()

    archivo_excel = filedialog.askopenfilename(
        title="Selecciona el archivo Excel",
        filetypes=[("Archivos Excel", "*.xlsx *.xls")]
    )

    if not archivo_excel:
        print("No se seleccionó ningún archivo. Saliendo.")
        sys.exit()

    df = pd.read_excel(archivo_excel, sheet_name="CALCULADORA", engine="openpyxl", header=None)

    celdas = {
        "Cliente": "C35",
        "Fecha_tapa": "C36",
        "Fecha": "C37",
        "Dirigido": "C38",
        "Lugar": "C39",
        "Paneles": "C40",
        "Pot_paneles": "C41",
        "Techo": "C42",
        "Tamaño": "C43",
        "Pot_IMG": "C44",
        "Energia": "C45",
        "Marca_panel": "C46",
        "Marca_inversor": "C47",
        "Pot_inversor": "C48",
        "Pot_IMG2": "C49",
        "Red": "C50",
        "Precio_siniva": "C51",
        "Precio_coniva": "C52",
        "Tarifa": "C53",
        "Paga_UTE": "C54",
        "Paga_nuevo": "C55",
        "Ahorra": "C56",
        "Ahorro_mes": "C57",
        "Ahorro_año": "C58",
        "TIR": "C59",
        "PRI": "C60",
        "Dolar": "C61",
        "PRI2": "C62",
        "24cuotas": "C63",
        "36cuotas": "C64",
        "60cuotas": "C65",
        "Energia_grafica": "C67"
    }

    valores = {clave: leer_celda(df, celda) for clave, celda in celdas.items()}
    valores["Dirigido"] = f"{valores['Dirigido']},"

    ruta_variables = os.path.join(BASE_PATH, "variables.txt")
    with open(ruta_variables, "w", encoding="utf-8") as f:
        for clave, valor in valores.items():
            f.write(f"{clave}= {valor}\n")

    print("✅ Archivo 'variables.txt' generado.")

    ruta_archivo_variables = ruta_variables
    variables = leer_variables(ruta_archivo_variables)

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
        variables.get('PRI2', '')
    ]

    ruta_datos_propuesta = os.path.join(BASE_PATH, "datos_propuesta.txt")
    escribir_archivo_salida(ruta_datos_propuesta, datos_propuesta)
    print("Archivo 'datos_propuesta.txt' generado correctamente.")

    pdf_original = os.path.join(BASE_PATH, "Original.pdf")
    cliente = variables.get('Cliente', 'Cliente')
    pdf_modificado = os.path.join(BASE_PATH, f"Propuesta Comercial Voltia - {cliente}.pdf")
    archivo_datos = ruta_datos_propuesta

    if not os.path.exists(pdf_original):
        print(f"Error: No se encontró el archivo PDF base: {pdf_original}")
        sys.exit(1)

    if not os.path.exists(archivo_datos):
        print(f"Error: No se encontró el archivo de datos: {archivo_datos}")
        sys.exit(1)

    coordenadas_Propuesta = [
        [(328, 472), (328, 437)],
        [(420, 723.5), (72, 665)],
        [(132, 663.7), (286, 649)],
        [(200, 248), (310.5, 248), (158, 233), (433, 184), (494, 129.5)],
        [(231, 723.5), (165, 395), (200, 380), (177, 365), (166, 315), (218, 300)],
        [(104, 467), (223, 467), (424, 467), (157, 451.5), (230, 451.5), (362, 451.5)],
        [(280, 237), (355, 237), (463, 237)],
        [(480, 498), (480, 482), (480, 466)],
        [(275, 341), (380, 341), (275, 326), (380, 326), (463, 326)],
        [(85, 706.5), (160, 706.5), (280, 706.5), (395, 706.5), (475, 706.5), (266, 675.7), (184, 600)]
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
         {"font": "Calibri", "size": 11, "color": (0, 0, 0)}]
    ]

    datos = leer_datos(archivo_datos)

    try:
        pot_img = convertir_a_float(variables.get('Pot_IMG', '0'))
        energia_anual = convertir_a_float(variables.get('Energia_grafica', '0'))
        ruta_imagen = generar_grafico_energia(pot_img, energia_anual)

        precio_coniva = convertir_a_entero(variables.get('Precio_coniva', '0'))
        ahorro_anual = convertir_a_entero(variables.get('Ahorro_año', '0'))

        print(precio_coniva)
        print(ahorro_anual)

        ruta_imagen2 = generar_grafico_retorno(precio_coniva, ahorro_anual)

        imagenes_en_paginas = {
            4: {"path": ruta_imagen, "x": 80, "y": 420, "width": 450, "height": 300},
            9: {"path": ruta_imagen2, "x": 80, "y": 280, "width": 450, "height": 300},
        }

        sobrescribir_pdf(
            pdf_original,
            datos,
            pdf_modificado,
            coordenadas_Propuesta,
            font_size=11,
            formatos=formatos_personalizados,
            imagenes_en_paginas=imagenes_en_paginas
        )

        print(f"PDF modificado creado exitosamente como '{pdf_modificado}'")

        if sys.platform.startswith('darwin'):
            subprocess.call(('open', pdf_modificado))
        elif os.name == 'nt':
            os.startfile(pdf_modificado)
        elif os.name == 'posix':
            subprocess.call(('xdg-open', pdf_modificado))

    except Exception as e:
        print(f"Error al procesar el PDF: {str(e)}")