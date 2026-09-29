# Manual de Trabajo, maquetado

El manual de `docs/Manual-de-Trabajo-Voltia.md` puesto en páginas A4 para leer e
imprimir. Vive como canvas de Claude Design, igual que el de Posventa:

**https://claude.ai/artifact/AQc6JnCMKB4hZoL9A1W4i5**

Son 40 artboards A4 (794×1123 px) en orden de lectura; el PDF sale del menú de
exportar del canvas ("All artboards") o con `pdf.mjs` (abajo). El canvas es
**privado**: para que lo vea alguien más hay que compartirlo desde su menú Share.

## Cómo está armado

- **Reusa los bloques del de Posventa.** `contenido.py` importa
  `docs/manual-posventa-pdf/generar.py` (la ficha, los avisos, las tablas, la
  burbuja de mensaje, la figura) y le cambia el pie con `generar.configurar()`.
  Así los dos manuales se ven como una colección, y cambiar la tipografía de un
  bloque la cambia en los dos.
- **Lo propio de este manual** está en `contenido.py`: la tarjeta de apertura de
  cada rol (*Qué hacés / Dónde termina tu trabajo*), el recuadro *En Voltia PM*,
  las portadillas de las tres partes, la grilla del recorrido (cap. 1) y la hoja
  oscura de las reglas. A diferencia del de Posventa, **no hay páginas a mano**:
  la portada y el cierre también las escribe `contenido.py`.
- **Las plantillas** se leen del `contenido.py` de Posventa (`PLANTILLAS`), que a
  su vez las copió de `client/src/modules/clientes/plantillas.ts`. Una sola
  copia para los dos manuales.
- **Las imágenes** tienen otras URLs que en el de Posventa aunque sean las
  mismas: cada artifact tiene su propio almacén. `imagenes.py` y
  `assets-locales.json` son los de **este** canvas.

## Cómo se regenera y se mide

```bash
python3 docs/manual-trabajo-pdf/contenido.py <carpeta>          # escribe <carpeta>/project/
docker compose exec -T server sh -c 'rm -rf /tmp/mt && mkdir -p /tmp/mt'
docker compose cp <carpeta>/project server:/tmp/mt/paginas
docker compose cp docs/manual-trabajo-pdf/imagenes server:/tmp/mt/imagenes
docker compose cp docs/manual-trabajo-pdf/assets-locales.json server:/tmp/mt/assets-locales.json
docker compose cp docs/manual-posventa-pdf/espacio.mjs server:/app/espacio-mt.mjs
docker compose exec -T -w /app -e DIR_IMAGENES=/tmp/mt/imagenes \
  -e MAPA_ASSETS=/tmp/mt/assets-locales.json server node espacio-mt.mjs /tmp/mt/paginas
```

Los scripts de medir, previsualizar y armar el PDF (`espacio.mjs`,
`vista-previa.mjs`, `pdf.mjs`) son los de `docs/manual-posventa-pdf/`: toman las
rutas por variable de entorno. **Cada hoja tiene que dar 1123 y "ok"**; lo que se
pasa del borde se recorta sin aviso. Las razones están en el README del de
Posventa.

Se copian a `/tmp` del contenedor y no a `/app`, porque `/app` es la carpeta
`server/` del repo montada y todo lo que cae ahí se commitea. Al terminar:
`docker compose exec -T server sh -c 'rm -f /app/*-mt.mjs; rm -rf /tmp/mt'`.

Para publicar: las 40 hojas y `canvas.json` en una sola llamada de la
herramienta de Artifacts, con `root` en la carpeta generada.

## Imágenes

- `capturas.mjs` saca las pantallas que este manual usa y el de Posventa no (el
  proyecto, el Recorrido, el gabinete). Las demás se copiaron del canvas de
  Posventa.
- `preparar-imagenes.mjs` lleva fotos y capturas a su medida. Usa fotos
  distintas a las del de Posventa (portada, portadillas y cierre) para que no
  se vean iguales.

## De dónde sale el texto

De `docs/Manual-de-Trabajo-Voltia.md`, **la fuente de verdad**. Si el manual
cambia, se corrige el `.md` primero y después `contenido.py`.

Dos diferencias a propósito con el `.md`: donde el `.md` dice *"En la app"*, el
canvas dice *"En Voltia PM"*, y el capítulo 11 se llama *"Voltia PM, pantalla por
pantalla"*. Es la regla de nombres de CLAUDE.md (nunca "la app" a secas).
