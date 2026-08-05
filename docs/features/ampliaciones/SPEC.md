# Ampliaciones

Obra nueva sobre una instalación que **ya existe y ya está cargada en la app**:
se agregan paneles, se suma un inversor. Nace como un proyecto hijo que hereda
los datos del original en vez de retipearlos.

## Por qué existe

Hasta ahora la única salida era cargar un proyecto nuevo desde cero. Eso obliga a
volver a escribir el cliente, la ubicación, la cédula y los códigos UTE —que son
exactamente los mismos— y, peor, **pierde el vínculo**: parado en la obra original
no había forma de ver que después se le hizo una ampliación.

## La decisión de fondo: es un proyecto de verdad

Una ampliación **no** es un apéndice del proyecto original. Tiene su propio
pipeline, su propia plata, sus propios materiales y su propio trámite UTE, y
**cuenta como una obra más** en las métricas y las metas. Si alguna resulta chica
para el conteo, se le baja el `pesoObra` a mano (campo ya existente, admin-only).

Esa decisión es lo que hace que el alcance sea chico: métricas, dashboard, reporte
semanal y Experiencia Solar **no se tocaron**. La ampliación ya cuenta sola.

## Modelo: una sola columna

`Project.parentProjectId` con auto-relación. "Es una ampliación" se deriva de que
ese campo tenga valor — **no hay un enum aparte** que pueda quedar desincronizado
con el vínculo. Si algún día aparece otro tipo de proyecto hijo (una reparación,
una repotenciación), ahí conviene sumar un `tipoProyecto`; hoy sería una
invariante extra que mantener a cambio de nada.

`onDelete: SetNull` y no `Cascade`: borrar la obra original **no** puede arrastrar
la ampliación.

### El árbol es plano

Una ampliación parada sobre una ampliación se cuelga de la **raíz**, no del
hermano (`resolveRootProject` en `ampliacion.service.ts`). Así los códigos nunca
pasan de un sufijo y "las ampliaciones de esta obra" es una consulta de un nivel.

Si la raíz fue borrada, la ampliación pasa a ser su propia raíz: el árbol se corta
ahí en vez de colgar de un proyecto que ya no existe.

## Código

`PRY-2026-045-A1`, `-A2`, … (`generateAmpliacionCode`). Se miran **todos** los
hijos, incluidos los borrados: reusar el sufijo de una ampliación eliminada daría
dos proyectos con el mismo código en el historial.

**`generateProjectCode` no se tocó.** Parsea `code.split("-")[2]`, que en
`PRY-2026-045-A1` da `"045"` — el mismo número que ya aporta el padre. No hay
colisión ni salto en el correlativo de obras nuevas. Es el único lugar del repo
que parsea códigos de proyecto.

## Qué se hereda

| Se copia | No se copia |
|---|---|
| Cliente, ciudad, departamento, dirección | `capacityKwp` — la de la ampliación |
| Email y teléfono | Presupuesto, ejecutado, MWh/año, CO₂ |
| Titular UTE (`nombreCliente`, `ciCliente`, calle, número, física/empresa) | Fechas — las pide el form |
| `uteCodigoPS` / `uteCodigoAS` — es la misma conexión | Estado de facturación |
| Vendedor, modalidad de pago, tenant | Pipeline, materiales, movimientos, videos, fotos |
| "Lleva factura" + nota | `pesoObra` (arranca en 1), overrides de etapa |
| Clientes del portal (filas `ProjectClient`) | Sistema fotovoltaico del original |
| Cédula y factura de UTE — **el archivo, no la ruta** | |

La cédula se copia como archivo: dos proyectos apuntando al mismo path significa
que borrar uno le rompe el documento al otro. Si el archivo no está en disco queda
en `null` y se vuelve a subir desde la ficha — un documento faltante no puede hacer
fallar la creación del proyecto.

## Permisos

| Acción | Permiso |
|---|---|
| Crear una ampliación (`POST /api/projects/:id/ampliaciones`) | `OPERACIONES:VIEW` |

Es **el mismo que `POST /projects`**, para que quien puede crear un proyecto pueda
crear una ampliación. Vale decir que crear un proyecto pide `VIEW` y no `CREATE`:
es raro, no lo introduce esta feature, y corregir las dos rutas cambiaría quién
puede crear proyectos hoy — decisión aparte.

## Archivos

| | |
|---|---|
| Schema | `Project.parentProjectId` + relación `ProjectAmpliacion` |
| Backend | `services/ampliacion.service.ts`, `POST /projects/:id/ampliaciones` en `routes/api.routes.ts`, `serializeProject` |
| Frontend | `components/project/AmpliacionModal.tsx`, botón y badge en `ProjectHeader.tsx`, fila de ampliaciones en `pages/ProjectDetail.tsx`, chip en `pages/Projects.tsx`, `createAmpliacion` en `api/projects.api.ts` |

## Deuda / pendientes

- **El pipeline es el mismo que el de una obra nueva.** Se decidió así para
  arrancar. Cuando se sepa qué etapas sobran en una ampliación, el gancho está
  puesto: `buildInitialStages` ya acepta un template alternativo
  (`project.service.ts:375`) y el endpoint puede elegirlo según `parentProjectId`.
- ~20 líneas de orquestación duplicadas con `POST /projects` (pipeline, deadlines,
  subetapas UTE). Deliberado: extraer un `provisionProject()` compartido tocaría el
  camino de creación que hoy funciona. Si aparece un tercer creador de proyectos,
  ahí conviene unificar.
- El botón no está gateado por estado: se puede crear una ampliación de una obra
  que todavía no arrancó. El caso raro es válido y un gate agrega una regla que
  después hay que explicar.
- La copia de documentos UTE y el armado del pipeline quedan **fuera** de la
  transacción que crea el proyecto — mismo compromiso que ya asume `POST /projects`.
