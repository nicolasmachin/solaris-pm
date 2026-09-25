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
