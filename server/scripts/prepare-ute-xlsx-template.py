#!/usr/bin/env python3
"""Prepara la plantilla XLSX de "Solicitud de suministro" de UTE.

UTE publica el formulario como un libro Excel con varias hojas (Individual,
Colectiva, Reconexión…), imágenes, objetos OLE, listas desplegables y fórmulas
de validación. El archivo que circula viene **con un cliente de ejemplo ya
cargado**, así que antes de guardarlo en el repo hay que dejarlo en blanco: no
queremos datos personales de un tercero versionados, ni que un campo que el
generador no complete arrastre el dato del ejemplo al formulario de otro cliente.

Este script:
  1. Vacía todas las celdas de datos de la hoja "Individual" (respetando las
     que contienen fórmulas, que son parte de la validación de UTE).
  2. Borra del diccionario de textos las cadenas que solo usaba el ejemplo.
     OJO: los textos son COMPARTIDOS entre hojas — "Montevideo" aparece tanto en
     el ejemplo como en la lista de departamentos. Solo se borran las cadenas
     que no se usan en ninguna otra celda del libro.
  3. Elimina el hipervínculo mailto: que quedaba apuntando al mail del ejemplo.

Todo lo demás (imágenes, validaciones, formato, el resto de las hojas) se copia
byte a byte: se reescribe únicamente el XML de la hoja Individual.

Uso:
    python3 prepare-ute-xlsx-template.py <formulario_de_ute.xlsx> <salida.xlsx>
"""

import re
import sys
import zipfile

# Hoja "Individual" del libro de UTE. Si UTE reordena las hojas hay que
# recalcularlo leyendo xl/workbook.xml (mapea nombre -> archivo por r:id).
SHEET = "xl/worksheets/sheet3.xml"
SHEET_RELS = "xl/worksheets/_rels/sheet3.xml.rels"

# Celdas de DATOS de la hoja Individual (las que se completan). No incluye
# rótulos ni celdas con fórmula.
DATA_CELLS = [
    # Datos del suministro
    "B8", "E8", "H8", "B10", "E10", "H10", "K10", "B13", "L12",
    # Datos del cliente
    "B18", "E18", "B20", "E20", "H20",
    # Dirección de envío de notificaciones
    "B26", "E26", "H26", "K26", "B28", "E28",
    # Datos técnicos
    "B33", "E33", "H33", "B35", "E35", "H35", "B37", "E37",
    "B39", "E39", "H39", "B41", "E44", "E46",
    "B49", "E49", "H49",
    # Observaciones
    "B54",
]


def _blank_cell(xml: str, coord: str) -> tuple[str, bool]:
    """Vacía una celda conservando su estilo. No toca celdas con fórmula."""
    pat = re.compile(r'<c r="%s"(?P<attrs>[^>]*?)(?:/>|>.*?</c>)' % coord, re.S)
    m = pat.search(xml)
    if not m:
        return xml, False
    if "<f" in m.group(0):
        return xml, False
    style = re.search(r'\ss="\d+"', m.group("attrs"))
    style = style.group(0) if style else ""
    return xml[: m.start()] + f'<c r="{coord}"{style}/>' + xml[m.end():], True


def _shared_string_texts(shared: str) -> list[str]:
    return [
        "".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
        for si in re.findall(r"<si>(.*?)</si>", shared, re.S)
    ]


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    origen, destino = sys.argv[1], sys.argv[2]

    zin = zipfile.ZipFile(origen)
    xml = zin.read(SHEET).decode("utf8")

    vaciadas = []
    for c in DATA_CELLS:
        xml, ok = _blank_cell(xml, c)
        if ok:
            vaciadas.append(c)

    # Hipervínculo del mail de ejemplo.
    xml = re.sub(r"<hyperlinks>.*?</hyperlinks>", "", xml, flags=re.S)

    rels = zin.read(SHEET_RELS).decode("utf8")
    rels = re.sub(
        r'<Relationship [^>]*Type="[^"]*/hyperlink"[^>]*/>', "", rels
    )

    # Textos que quedaron huérfanos (solo los usaba el ejemplo). Se comparan
    # contra TODAS las hojas del libro para no romper listas compartidas.
    shared = zin.read("xl/sharedStrings.xml").decode("utf8")
    hojas = [
        zin.read(n).decode("utf8")
        for n in zin.namelist()
        if re.match(r"xl/worksheets/sheet\d+\.xml$", n) and n != SHEET
    ] + [xml]
    huerfanos = []
    for i, _texto in enumerate(_shared_string_texts(shared)):
        usado = any(re.search(r't="s"[^>]*><v>%d</v>' % i, h) for h in hojas)
        if not usado:
            huerfanos.append(i)

    partes = re.split(r"(<si>.*?</si>)", shared, flags=re.S)
    idx = -1
    for j, parte in enumerate(partes):
        if parte.startswith("<si>"):
            idx += 1
            if idx in huerfanos:
                partes[j] = "<si><t/></si>"
    shared = "".join(partes)

    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == SHEET:
                data = xml.encode("utf8")
            elif item.filename == SHEET_RELS:
                data = rels.encode("utf8")
            elif item.filename == "xl/sharedStrings.xml":
                data = shared.encode("utf8")
            zout.writestr(item, data)

    print(f"✅ {destino}")
    print(f"   celdas vaciadas: {len(vaciadas)}")
    print(f"   textos huérfanos borrados: {len(huerfanos)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
