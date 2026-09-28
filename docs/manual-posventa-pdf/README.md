# Manual de Posventa, maquetado

El manual de `docs/Manual-Posventa-Experiencia-Solar.md` puesto en páginas A4
para leer e imprimir. Vive como canvas de Claude Design:

**https://claude.ai/artifact/4YBDjiLXYwPWSkwJQ8sNyw**

Cada página del manual es un artboard A4 (794×1123 px) en orden de lectura; el
PDF completo sale del menú de exportar del canvas ("All artboards"). El canvas es
**privado**: para que lo vea alguien más hay que compartirlo desde su menú Share.

## Cómo se regenera

```bash
python3 docs/manual-posventa-pdf/contenido.py <carpeta-destino>
```

Escribe `<carpeta-destino>/project/*.dc.html` y el índice `canvas.json`, que
después se publican al canvas con la herramienta de Artifacts.

- `generar.py` — el armazón de una página y los bloques que se repiten (la ficha
  de un paso, los avisos, la burbuja de mensaje, el hueco de captura, las
  portadillas de etapa). Cambiar la tipografía o el pie de las 37 páginas es
  cambiar una función acá.
- `contenido.py` — qué dice cada página y en qué orden van.

## Antes de publicar: medir

**Lo que se pasa del borde de la hoja se recorta sin aviso**, y el texto tapa el
pie. Por eso cada cambio se mide dibujando las hojas de verdad, con el mismo
motor de los PDF de propuestas y las fuentes reales:

```bash
# las fuentes locales (el contenedor no llega a Google Fonts)
# van en <dir-fuentes>/fonts-local.css + los .woff2
docker compose exec -T -w /app server node medir.mjs <dir-paginas> <dir-fuentes>
```

Cada hoja tiene que dar **1123** (entra justo, con el pie abajo). Más que eso, se
pasa. La estimación de `altura_estimada()` sirve para una primera pasada, pero
**no reemplaza la medición**: la primera versión no contaba las listas y dio por
buenas ocho hojas que desbordaban.

**El Anexo E se reparte con medidas reales**: `medir-temas.mjs` mide cada tema y
deja `alturas-temas.json`, que `contenido.py` usa para decidir cuántos temas
entran por hoja. Si se cambia el texto de un tema, hay que volver a medir.

## De dónde sale el texto

De `docs/Manual-Posventa-Experiencia-Solar.md`, que es **la fuente de verdad**.
Acá solo se decide cómo se reparte en hojas. Si el manual cambia, se corrige el
`.md` primero y después esto.

## Lo que falta

**Las capturas de pantalla.** Hay huecos dibujados, con el texto de qué va en
cada uno, en: fecha de obra (el calendario), la espera de UTE (el trámite en la
ficha), alta en reportes (un reporte mensual) y la ficha del cliente (la pantalla
completa). Pegar una captura no mueve nada de la maqueta.

**La foto de portada.** La portada tiene reservado el espacio a sangre.

## Por qué once páginas están escritas a mano

Las que tienen diseño propio —la portada, las reglas duras, el recorrido en tres
etapas, las dos señales— no salen de una plantilla y se escribieron sueltas.
`contenido.py` las conoce (`EXISTENTES`), no las reescribe, y solo las cuenta
para el orden y la numeración.
