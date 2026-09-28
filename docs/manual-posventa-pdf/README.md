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
cp docs/manual-posventa-pdf/paginas-a-mano/*.dc.html docs/manual-posventa-pdf/paginas/project/
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
127.0.0.1), y la app **arranca en modo oscuro**, que en papel es ilegible, así
que fuerza el tema claro en el localStorage antes de navegar.

Después se las lleva a la medida con `preparar-imagenes.mjs` (usa sharp, que está
en el contenedor) y se suben como assets del canvas. **La subida devuelve una URL
nueva por archivo**: hay que copiarla tal cual a `imagenes.py` y a
`assets-locales.json`. No sirve un `data:` ni el nombre del archivo.

Para mirar una hoja antes de publicarla, sin abrir el canvas:

```bash
docker compose exec -T -w /app server node vista-previa.mjs paginas/project /tmp/vistas Main.dc.html,Cierre.dc.html
```

## Por qué doce páginas están escritas a mano

Las que tienen diseño propio —la portada, el cierre, las reglas duras, el
recorrido en tres etapas, las dos señales— no salen de una plantilla y se
escribieron sueltas. `contenido.py` las conoce (`EXISTENTES`), no las reescribe,
y solo las cuenta para el orden y la numeración.

De esas doce, **la portada y el cierre viven en el repo**, en `paginas-a-mano/`,
porque llevan foto y se tocan. Las otras diez viven solo en el canvas: si hay que
cambiarlas, se editan ahí y no se publican desde acá, para no pisarlas con un
archivo viejo.
