# 16 · Documentación (intranet)

## Para qué existe

Es el lugar donde el equipo encuentra **siempre la última versión** de los
documentos de trabajo de Voltia: el Procedimiento General de Trabajo (PGT), los
manuales de trabajo de cada área, reglamentos y formularios. Antes vivían como
PDF sueltos que se mandaban por WhatsApp, y nadie sabía cuál era el vigente.

Tres cosas lo distinguen de una carpeta compartida:

1. **Versiones.** Cada documento muestra la vigente, desde cuándo rige y qué
   cambió; las anteriores quedan en el historial.
2. **Publicación automática de los manuales.** Los manuales del equipo se
   publican solos con cada deploy (ver *Cómo funciona*).
3. **Confirmación de lectura.** Un documento puede pedir que cada persona de sus
   roles confirme que leyó la versión vigente, y quien gestiona ve quién lo hizo.

No reemplaza a **Capacitación** (capítulo 14), que queda para videos y cursos.

## Cómo se usa

- **Entrada:** menú del usuario (arriba a la derecha) → *Documentación* (`/documentacion`).
- **Listado:** documentos agrupados por categoría (*Procedimientos*, *Manuales de
  trabajo*…), cada uno con su versión vigente. Los que piden lectura y la
  persona no confirmó llevan la marca *Pendiente de leer*; arriba se ve cuántos son.
- **Ficha** (`/documentacion/:id`): el PDF en pantalla (en el celular, un botón
  para abrirlo), *Qué cambió* y el historial de versiones. Si pide lectura, el
  botón *Confirmo que leí la versión X*.
- **Gestión** (DOCUMENTACION:EDIT): *Nuevo documento* (archivo, título,
  categoría, versión, roles que lo ven, si pide lectura); en la ficha, *Subir
  versión nueva*, *Editar* y el panel *Quién leyó la versión vigente*. Los
  documentos inactivos solo los ve quien gestiona.

## Cómo funciona

### Modelo

| Tabla | Qué guarda |
|---|---|
| `documentos` | Título, categoría, origen (`MANUAL_SINCRONIZADO` o `SUBIDO`), `slug` (solo los sincronizados), si pide lectura, activo, soft delete |
| `documento_roles` | Qué roles ven cada documento. Sin filas: solo quien gestiona |
| `documento_versiones` | Cada archivo publicado: versión (texto: hay "0.20" y "3.0"), vigente desde, notas, `sha256`, quién la publicó (`null` = el deploy) |
| `documento_lecturas` | "Leí esta versión": una por persona y versión |

La vigente es **la versión más nueva por `createdAt`**, no la de número más
alto. Las versiones no se editan ni se borran: un error se corrige subiendo otra.

Código: `services/documentacion/documentacion.service.ts`, rutas en
`routes/documentacion.routes.ts`, pantallas en `client/src/modules/documentacion/`.

### Publicación automática de los manuales

Los PDF de los manuales del equipo viven en **`server/manuales/`**, dentro de la
imagen del server, junto con `manuales.json`, que dice qué es cada uno (slug,
título, categoría, archivo, `.md` de origen, roles, si pide lectura y las notas
de cada versión).

Al arrancar el server (`index.ts` → `sincronizarManuales()`), por cada entrada:

1. Calcula el `sha256` del PDF. Si es igual al de la última versión publicada,
   no hace nada: arrancar varias veces no duplica.
2. Si cambió, lee la **portada del PDF** (`pdf-parse`, primeras dos páginas) y
   saca la versión y la fecha de «Versión 1.4 · del 22/10/26». Si no la
   encuentra, usa `version` del manifiesto. La portada manda porque es lo que el
   lector ve impreso.
3. Guarda el PDF en el storage (`documentacion/`) y crea la versión con las
   notas del manifiesto para ese número.

**No se avisa a nadie** cuando sale una versión nueva, ni de un manual
sincronizado ni de un documento subido a mano (decisión de Nicolás del
26/10/2026): los manuales cambian casi a diario y un aviso por cada cambio sería
ruido. Cada uno sabe dónde están y los consulta cuando los necesita. El tipo de
notificación `documento_nueva_version` quedó en la base sin uso.

La primera vez que aparece un slug crea el documento con el título, la categoría
y los roles del manifiesto. **Después mandan los que se ajusten desde la app**:
cambiar los roles en `manuales.json` no toca un documento que ya existe.

**El paso de publicar.** Después de regenerar el canvas de un manual y exportar
su PDF:

```bash
node docs/publicar-manual.mjs <slug> <pdf-exportado>
```

Copia el PDF a `server/manuales/` y anota en el manifiesto la versión (de la
cabecera del `.md`) y la fila de esa versión del anexo «Registro de cambios».
Con el commit y el próximo `./deploy.sh`, queda publicado. `--version X.Y`
fuerza el número, para un PDF que no coincide con el `.md` de hoy.

### Descargas

El PDF se sirve desde Voltia PM, nunca con un enlace directo al storage. Como un
`<iframe>` o un enlace no mandan el header `Authorization`, el permiso viaja en
`?t=`: un token firmado de 2 horas **atado a esa versión**
(`utils/token-descarga.ts`), que emiten los endpoints autenticados. La ruta de
descarga vuelve a chequear que el documento sea visible para el rol del token.

## Permisos

| Permiso | Qué habilita |
|---|---|
| `DOCUMENTACION:VIEW` | Ver los documentos de su rol y confirmar la lectura. Lo tienen todos los roles internos, incluido el instalador tercerizado (no el portal de clientes) |
| `DOCUMENTACION:EDIT` | Ver todos (también inactivos), publicar, editar, subir versiones y ver quién leyó. Al crear el módulo: solo `ADMIN` |

Sembrados por la migración `20261026163700_documentacion_rrhh_permisos`; se
ajustan desde la matriz de permisos.

## Reglas y decisiones

- **Un manual sincronizado no se borra** desde la app (el próximo deploy lo
  volvería a crear): se desactiva, o se lo saca de `manuales.json`. Sí se le
  puede subir una versión a mano para una corrección urgente; el próximo deploy
  no la pisa mientras el PDF de `server/manuales/` no cambie.
- **Los manuales sincronizados no piden confirmación de lectura** (en el
  manifiesto, `requiereLectura: false`): con cambios casi diarios, quedarían
  pendientes todos los días. La opción queda para documentos que lo ameriten,
  como un reglamento, y se prende desde *Editar*.
- **Un PDF que ya se publicó alguna vez no se republica**, aunque después se haya
  subido otra versión a mano: el deploy compara contra todas las versiones, no
  solo la última.
- **La confirmación de lectura vale solo para la vigente.** Con cada versión
  nueva, todos vuelven a quedar pendientes.
- **Los PDF están en el repo** (`server/manuales/`, ~18 MB al crear el módulo),
  porque tienen que viajar dentro de la imagen del server. Cada versión nueva
  suma su peso al historial de git.
- El `Manual-de-Trabajo-Voltia-v2.2.pdf` (el manual único anterior al PGT y los
  manuales por área) **no** se publicó: quedó superado.

## Casos borde

- **Falta un PDF del manifiesto:** se loguea y se saltea; los demás siguen.
- **El PDF no tiene texto en la portada** (una imagen escaneada): se publica con
  la versión del manifiesto o `s/n`.
- **Un rol del manifiesto no existe:** se omite con un aviso en el log.
- **Usuario sin rol en ningún documento:** ve la sección vacía.

## Archivos

- `server/src/services/documentacion/documentacion.service.ts`
- `server/src/services/documentacion/sincronizar-manuales.ts`
- `server/src/routes/documentacion.routes.ts`
- `server/src/utils/token-descarga.ts`
- `server/manuales/` (PDF + `manuales.json`)
- `docs/publicar-manual.mjs`
- `client/src/modules/documentacion/`, `client/src/api/documentacion.api.ts`
