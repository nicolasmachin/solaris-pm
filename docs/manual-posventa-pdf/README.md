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
  de un paso, los avisos, la burbuja de mensaje, la figura con epígrafe, la hoja
  de captura del Anexo F, las portadillas de etapa). Cambiar la tipografía o el
  pie de todas las páginas es cambiar una función acá.
- `contenido.py` — qué dice cada página y en qué orden van.
- `imagenes.py` — las fotos y capturas, por la URL con que quedaron subidas al
  canvas.
- `paginas-a-mano/` — las hojas con diseño propio que `contenido.py` no escribe
  (hoy la portada y el cierre). Se publican junto a las generadas.

## Antes de publicar: medir

**Lo que se pasa del borde de la hoja se recorta sin aviso**, y el texto tapa el
pie. Por eso cada cambio se mide dibujando las hojas de verdad, con el mismo
motor de los PDF de propuestas y las fuentes reales:

```bash
python3 docs/manual-posventa-pdf/contenido.py docs/manual-posventa-pdf/paginas
docker compose cp docs/manual-posventa-pdf/paginas server:/app/paginas
docker compose cp docs/manual-posventa-pdf/imagenes server:/app/imagenes
docker compose cp docs/manual-posventa-pdf/espacio.mjs server:/app/espacio.mjs
docker compose cp docs/manual-posventa-pdf/assets-locales.json server:/app/assets-locales.json
docker compose exec -T -w /app server node espacio.mjs paginas/project
```

`espacio.mjs` dice el alto de cada hoja **y cuánto aire le queda**, que es lo que
se puede gastar en una imagen. Reemplaza a `medir.mjs`, que solo daba el alto y
además pedía las fuentes locales: el contenedor sí llega a Google Fonts, así que
esa vuelta no hacía falta.

**No alcanza con el alto del marco.** El marco tiene los 1123 px fijos, así que
su `scrollHeight` sigue diciendo 1123 aunque el contenido se salga por abajo: una
hoja rota pasaba la medición y recién en el PDF aparecía partida en dos. Por eso
`espacio.mjs` mide además **hasta dónde llega el contenido** y avisa cuando un
archivo tiene los `<div>` **desbalanceados**, que fue la causa: al pegar una
captura a mano sobró un `</div>`, el navegador lo corrigió a su manera y la
página salió con tres columnas.

**Las imágenes hay que mapearlas para medir.** En el canvas viven como
`/_blob/<id>`, que fuera del artifact no resuelve: sin el archivo real la imagen
mide cero y la hoja parece entrar cuando no entra. `assets-locales.json` apunta
cada id a su archivo de `imagenes/`, y `espacio.mjs` hace el cambio al vuelo.

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

## Las fotos y las capturas

Ya están puestas: la portada, las tres portadillas de etapa (la foto va de fondo,
bajo un velo azul, así que no mueve ninguna altura), el cierre, y las ocho hojas
del **Anexo F** con las pantallas de la app.

Las capturas **se sacan solas** contra el entorno local:

```bash
IP=$(docker compose exec -T client hostname -i)
docker compose cp docs/manual-posventa-pdf/capturas.mjs server:/app/capturas.mjs
docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas.mjs /tmp/capturas
```

Dos cosas que cuestan de adivinar y están resueltas ahí adentro: al front **no se
le puede pegar por su IP** (Vite rechaza el Host y el CORS del server solo admite
localhost y 127.0.0.1, así que el script levanta un proxy TCP y entra por
127.0.0.1), y fuerza el **modo oscuro** en el localStorage antes de navegar.
Las capturas de los manuales van en modo oscuro desde el 11-oct-2026 (decisión
de Nicolás: así se ve Voltia PM en el día a día), aunque gasten más tinta al
imprimir.

Después se las lleva a la medida con `preparar-imagenes.mjs` (usa sharp, que está
en el contenedor) y se suben como assets del canvas. **La subida devuelve una URL
nueva por archivo**: hay que copiarla tal cual a `imagenes.py` y a
`assets-locales.json`. No sirve un `data:` ni el nombre del archivo.

Para mirar una hoja antes de publicarla, sin abrir el canvas:

```bash
docker compose exec -T -w /app server node vista-previa.mjs paginas/project /tmp/vistas Main.dc.html,Cierre.dc.html
```

## Ojo con `docker compose cp` a `/app`

`/app` en el contenedor **es la carpeta `server/` del repo**, montada. Todo lo que
se copia ahí aparece como archivo del repo, y un `save.sh` lo commitea: así se
colaron 32 MB de copias de las fotos y las hojas. Están en el `.gitignore` de
`server/`, pero conviene igual **borrar lo copiado al terminar**:

```bash
docker compose exec -T server rm -rf /app/paginas /app/imagenes /app/*.mjs
```

## El PDF

El canvas exporta el PDF desde su menú ("All artboards"), pero eso hay que
hacerlo a mano. Para sacarlo desde acá:

```bash
docker compose cp docs/manual-posventa-pdf/pdf.mjs server:/app/pdf.mjs
docker compose exec -T -w /app server node pdf.mjs paginas/project /tmp/manual.pdf
docker compose cp server:/tmp/manual.pdf /tmp/manual-posventa.pdf
node docs/publicar-manual.mjs manual-posventa /tmp/manual-posventa.pdf
```

El último paso lo publica en **Documentación** (la intranet de Voltia PM): copia
el PDF a `server/manuales/` y anota qué cambió, sacado del registro de cambios
del `.md`. Con el commit y el próximo deploy queda vigente (no se le avisa a
nadie: la gente lo busca ahí cuando lo necesita). Ver
`docs/manual/16-documentacion.md`.

El título del PDF (el que muestran los visores) es el del canvas; `TITULO=...`
lo fuerza.

**Chromium en la VPS de desarrollo:** todos los `.mjs` que lanzan Chromium
llevan `--no-zygote`, `--disable-crash-reporter` y `--disable-breakpad`. Sin eso, en el contenedor `server` de la VPS de desarrollo
Chromium se cuelga al arrancar y puppeteer corta a los 30 s con *"Timed out …
waiting for the WS endpoint"* (verificado el 26-oct-2026).

Toma el orden de `canvas.json` y saltea (avisando) las hojas que no estén en la
carpeta.

## Por qué doce páginas están escritas a mano

`contenido.py` las copia de `paginas-a-mano/` a la carpeta de salida con **el
número del pie corregido** según su lugar en el orden (desde el 26-oct-2026; antes
había que copiarlas a mano y el número quedaba fijo, así que una hoja nueva
corría todos los de después). No hace falta copiarlas aparte.

**El registro de cambios sale del `.md`** (`registro_del_md()`), repartido en
las hojas que hagan falta: ya no se copia a mano.

**El texto de las demás hojas sí está transcripto en `contenido.py`**, resumido
para la página. Cuando el `.md` cambia hay que trasladar el cambio acá a mano:
el 26-oct-2026 se pasaron de la 1.19 a la 1.32 (la bienvenida la manda
Experiencia Solar, los plazos de cada paso, el código por mail del portal, los
videos con enlace del portal, los reportes que salen solos, Abrir en WhatsApp,
el día de margen de la cadencia, el monitoreo del medidor y el análisis desde el
chat, las cuotas por momento de la obra, Generación y consumo, General Simple).
Para encontrar qué falta: `git diff <commit de la última regeneración> --
docs/Manual-Posventa-Experiencia-Solar.md`.

**Medir los temas del Anexo E**: `medir-temas.mjs` pide un JSON de temas y una
carpeta con `fonts-local.css` que no están en el repo. Lo que se usó el
26-oct-2026: volcar `tema(..., primero=True)` de cada uno de `TEMAS_FAQ` con el
`<link>` de Google Fonts de `generar.FUENTES` y medir cada uno en una columna de
794 px con 72 px de margen; da exactamente lo mismo que las alturas viejas en los
temas que no cambiaron.

Las que tienen diseño propio —la portada, el cierre, las reglas duras, el
recorrido en tres etapas, las dos señales— no salen de una plantilla y se
escribieron sueltas. `contenido.py` las conoce (`EXISTENTES`), no las reescribe,
y solo las cuenta para el orden y la numeración.

Las doce viven en `paginas-a-mano/` y se publican desde ahí, igual que las
generadas: antes estaban solo en el canvas y eso obligaba a bajarlas cada vez que
había que armar el PDF completo. **Si alguien las edita en el canvas, hay que
volver a bajarlas** antes de publicar, o el archivo del repo las pisa:

```bash
# bajarlas de nuevo (se guardan bajo <carpeta>/project/)
# action "read" del artifact, con los paths de paginas-a-mano/
```
