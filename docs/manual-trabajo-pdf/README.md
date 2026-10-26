# Manual de Trabajo, maquetado

El manual de `docs/Manual-de-Trabajo-Voltia.md` puesto en páginas A4 para leer e
imprimir. Vive como canvas de Claude Design, igual que el de Posventa:

**https://claude.ai/artifact/AQc6JnCMKB4hZoL9A1W4i5** (hoy es el canvas del
Procedimiento General de Trabajo, `MANUAL=pgt`)

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

**Y en Documentación de Voltia PM:** con el PDF exportado,
`node docs/publicar-manual.mjs <slug> <pdf>` (slugs: `procedimiento-general`,
`manual-ventas`, `manual-operaciones`; la lista está en
`server/manuales/manuales.json`). Lo copia a `server/manuales/` con la versión y
qué cambió; el próximo deploy lo publica (sin avisarle a nadie). Un manual
nuevo se suma primero como entrada de `manuales.json`. Ver
`docs/manual/16-documentacion.md`.

## Manual de Ventas (`MANUAL=ventas`)

Sin partes ni portadillas: los capítulos van seguidos. La sección sin número
"## Las reglas de Ventas" sale en hoja oscura (como "Las reglas en una página")
y lo que trae además de las reglas sigue en hojas comunes. Los mensajes al
cliente en `<small>` van como cita en letra chica; el registro de cambios, si
una versión no entra en una fila, se pasa a bloques por versión. Las notas de
armado del .md (*Por ordenar…*, la cita con la ruta del material de base) no van
al maquetado. Capturas: `capturas-ventas.mjs` + `preparar-capturas-ventas.mjs`,
registradas en `capturas-ventas.json` (ids = md5 del archivo).

Canvas: **https://claude.ai/artifact/UjhgT77p9FM673J787WFc2** (46 hojas, creado
el 12-oct-2026). Sus imágenes tienen otra dirección que las del PGT:
`assets-ventas.json` dice cuál es cada una, y se generan las hojas con
`MANUAL=ventas REMAP_ASSETS=docs/manual-trabajo-pdf/assets-ventas.json`. Una
imagen nueva hay que subirla a este canvas y sumarla a ese archivo.

**La portada de Ventas es propia** (`portada-ventas.jpg`, una casa con paneles en
la azotea, de `docs/Fotos/4d27a792…`): se cambia en `contenido.py` con
`IMG.PORTADA` cuando `MANUAL=ventas`, para que no salga igual que el PGT. El cierre también es
propio (`cierre-ventas.jpg`, techo de chapa). Operaciones tiene su portada
(`portada-operaciones.jpg`, estructura a suelo en obra), puesta directo con la
dirección de su canvas.

Canvas de Operaciones (`MANUAL=operaciones`): **https://claude.ai/artifact/ET8z2nwZrceyWVcHNWGbgi**
(95 hojas al 26-oct-2026). Sus imágenes ya salen con las direcciones de ese canvas
(`assets-operaciones.json`), así que no lleva `REMAP_ASSETS`. Fotos de `docs/Fotos/` que no usa ningún manual: ninguna.

**Los cuadros siguen el criterio del de Operaciones** (pedido del 12-oct-2026):
primero la captura y después lo que la explica (`foto_primero`), las capturas
con números rojos sobre lo que describe la lista que las acompaña
(`MARCAS_CAPTURA_VENTAS`, ubicados mirando la imagen: si cambia la pantalla,
hay que volver a ubicarlos) y las tablas que cuentan un recorrido o un reparto
dibujadas (`cuadros_ventas`: el embudo con sus plazos, los resultados
esperados, la modalidad de pago, las cuotas, el pase a Experiencia Solar y las
etapas del pipeline). Las reconoce por la cabecera de la tabla: si se cambia
una cabecera en el .md, vuelve a salir como tabla común.

Además, `mas_cuadros_ventas` engancha dibujos a frases del .md, sin cambiar
el texto: el embudo dibujado, la cadena de la fecha de obra, la escala del
markup, los pasos de la visita en tarjetas (con coplanar contra inclinado y la
línea de tiempo hasta el ahorro), el resumen de la visita, las insistencias,
el embudo de 2025, el checklist del onboarding, el orden de firma del
contrato, una consulta por cuenta UTE, la potencia menor, el asesor entre
cliente y banco, las casillas de la financiación, el Plan de Protección, lo que
deja cargado, lo que le cae a la obra, la etapa contra el contador de reclamos
y las tres ventanas de ganar la venta. Cada regla busca cómo **empieza** un
párrafo o una lista: si se reescribe ese comienzo, el dibujo deja de salir sin
romper nada, y hay que ajustar la regla.

## Imágenes

- `capturas.mjs` saca las pantallas que este manual usa y el de Posventa no (el
  proyecto, el Recorrido, el gabinete). Las demás se copiaron del canvas de
  Posventa.
- `preparar-capturas-oscuras.mjs` deja las capturas del PGT y de Operaciones
  (en modo oscuro) con el recorte y la medida de la maqueta. Si se cambia un
  recorte del capítulo 7 del PGT, hay que revisar dónde caen sus números
  (`PANTALLAS` en `contenido.py`).
- `preparar-imagenes.mjs` lleva fotos y capturas a su medida. Usa fotos
  distintas a las del de Posventa (portada, portadillas y cierre) para que no
  se vean iguales.

## De dónde sale el texto

De `docs/Manual-de-Trabajo-Voltia.md`, **la fuente de verdad**. Si el manual
cambia, se corrige el `.md` primero y después `contenido.py`.

Dos diferencias a propósito con el `.md`: donde el `.md` dice *"En la app"*, el
canvas dice *"En Voltia PM"*, y el capítulo 11 se llama *"Voltia PM, pantalla por
pantalla"*. Es la regla de nombres de CLAUDE.md (nunca "la app" a secas).

## Manual del Instalador Tercerizado (`MANUAL=tercerizado`)

De `docs/Manual-del-Instalador-Tercerizado.md`. Tres partes con portadilla:
**A** Voltia y la relación (caps. 0–4), **B** La obra, de punta a punta (5–10),
**C** La evaluación y las herramientas (11–15); los casos del cap. 14 van en
tarjetas. Canvas: **https://claude.ai/artifact/SvYyLuDvQZJZrGiiHBQtJv** (54 hojas,
creado el 19-oct-2026).

Se arma con las imágenes del canvas de **Operaciones** (las capturas son las
mismas) y `assets-tercerizado.json` las pasa a las de su canvas:
`MANUAL=tercerizado bash docs/manual-trabajo-pdf/armar.sh <carpeta>` para medir
(con las direcciones de Operaciones, que `assets-locales.json` resuelve a
archivos), y después la pasada final con
`REMAP_ASSETS=docs/manual-trabajo-pdf/assets-tercerizado.json` y
`--alturas <carpeta>/alturas.json`. Una imagen nueva de Operaciones que use este
manual hay que copiarla a su canvas y sumarla a ese archivo.

Las fotos que el .md pone por nombre de archivo (`![…](archivo.png)`) salen de
`capturas-tercerizado.json` (nombre sin extensión → id, ya en el canvas
nuevo). La de la chapa pisada es un recorte de las dos fotos de una captura de
WhatsApp, sin los nombres ni los audios (`imagenes/tercerizado-chapa-pisada.jpg`).
La portada es el techo rojo; la portadilla B, la estructura a suelo de
Operaciones.
