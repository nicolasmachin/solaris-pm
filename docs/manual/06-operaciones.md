# 06 · Operaciones

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

Ejecución de obra: fotos, videos, stock, logística y agenda de instalación.

---

## El calendario: obras y otros eventos

### Para qué existe

El calendario (`/calendario`) muestra qué tiene el equipo cada día. Hasta
septiembre de 2026 solo agendaba **obras**; ahora también **mantenimientos**,
**soportes/reclamos**, **visitas técnicas** y **otros**, que antes se coordinaban
fuera de la app y no se veían en ningún lado.

**"Otro"** es el comodín deliberado: una entrega, una reunión en obra, una
capacitación. Existe para que lo que no entra en las tres categorías igual quede
en el calendario, en vez de forzarlo dentro de una que no le corresponde.

### Cómo se usa

- **"+ Nueva instalación"** agenda una obra, como siempre.
- **"+ Agendar otra cosa"** abre el alta de los otros cuatro tipos: se elige tipo,
  equipo, día, y opcionalmente cliente, ticket (solo en soporte), título y notas.
  **"Agregar otro día"** suma días que no tienen por qué ser consecutivos.
- **Al tocar un evento se abre su ficha** (`EventoDetalleModal.tsx`): ahí se
  cambia tipo, días, equipo, cliente, ticket, título y notas; se **marca como
  hecho** (y se vuelve atrás); y se **elimina**, con una confirmación en dos
  pasos dentro del mismo botón. Las obras no usan esta ficha: siguen con su
  propio panel.
- La fila **"Mostrar"** filtra por tipo. **La combinación se guarda por usuario**
  y se recupera al volver a entrar.

### Cómo funciona

Dos modelos distintos que comparten pantalla:

| | Obras | Los otros tres |
|---|---|---|
| Modelo | `InstallationSchedule` + `InstallationSegment` | `AgendaEvento` + `AgendaEventoDia` |
| Duración | tramos de varios días | **un registro por día** |
| Atadura | una por proyecto (`projectId @unique`) | proyecto opcional, varios por proyecto |
| Endpoints | `/api/calendar…` | `/api/agenda-eventos…` |

**Por qué separados**: `InstallationSchedule` tiene `projectId @unique` y campos
que solo aplican a una obra (`confirmedAt`, `actualWorkEnd`, `teamType`). Un
proyecto puede tener varios mantenimientos, así que generalizarlo obligaba a
romper ese unique y tocar todo el flujo de obra, que ya estaba probado.

**Por qué un día por registro y no un rango**: es lo que pide el negocio —un día,
con la opción de sumar días sueltos—. Con rangos habría que modelar varios tramos
para expresar lo mismo.

Los eventos **no pasan por `computeWeekPlan`**, el algoritmo que resuelve tramos,
solapamientos y el "+N más" de las obras. Como duran un día, alcanza con
agruparlos por columna: se dibujan en carriles propios **debajo** de las obras,
dentro del mismo grid de la semana. Así el drag & drop y el resize de obras
quedan intactos.

### Cómo se distingue cada tipo a simple vista

El calendario ya usaba dos señales y **ninguna se tocó**: el **color de fondo es
el equipo** y el **rayado a 45° son las fechas sin confirmar**. El tipo se marca
con una **barra vertical de 3 px a la izquierda** más un ícono.

Esa decisión salió de medir el espacio real: en la vista Mes cada carril mide
`DAY_LANE_MIN_HEIGHT` = **22 px** y cada día ronda los **48 px de ancho en
celular**. El ícono y el texto aparecen de forma escalonada según el ancho
disponible (`EventoBloque.tsx`), igual que ya hacía el nombre del cliente en las
obras:

Los cuatro colores de barra —verde mantenimiento, ámbar soporte, violeta visita,
rosa otros— se eligieron para no confundirse entre sí **ni con el gris de
"completado"** en una franja de 3 px.

| Ancho del día | Qué se ve |
|---|---|
| ≥ 56 px | barra + ícono + nombre |
| ≥ 26 px | barra + ícono |
| menos | solo la barra de color |

**La vista Año solo muestra obras.** Ahí los bloques miden entre 6 y 18 px
(`miniSlotHeight`) y sumar eventos no se leería. Es una decisión, no un olvido.

### Dónde más aparecen

- **Ficha del proyecto**: bloque "Agendado para esta obra" con los eventos de ese
  proyecto (`AgendaDelProyecto.tsx`).
- **Novedades del cliente**: cada alta, cancelación y marcado como hecho deja una
  entrada de auditoría con `projectId`, clasificada como **novedad** en
  `services/clientes/eventos.ts`. **Reprogramar no** es novedad: mover una fecha
  tres veces antes de que pase algo solo le llenaría el historial al cliente.

### Permisos

Los mismos que las obras, sobre `OPERACIONES`: `VIEW` para ver, `CREATE` para
agendar, `EDIT` para editar y mover días, `DELETE` para eliminar. No se creó un
módulo nuevo: es el mismo calendario y la misma gente.

En la ficha del evento los controles se gatean con `usePermission`: sin `EDIT` los
campos quedan deshabilitados y se muestra un aviso de solo lectura; sin `DELETE`
no aparece el botón de eliminar. **No hay ningún guard hardcodeado por rol** — todo
se resuelve contra la matriz.

### Reglas y decisiones

- **El ticket solo se puede enganchar a un evento de SOPORTE**
  (`TICKET_SOLO_EN_SOPORTE`). Un reclamo colgando de un mantenimiento aparecería
  donde no corresponde.
- **Sin título se usa el nombre del cliente**; sin cliente, el nombre del tipo.
- **En "Otro" el título es obligatorio** (`OTRO_SIN_DESCRIPCION`), en el alta y en
  la edición. Sin él el bloque del calendario diría solo "Otro", que no le sirve a
  nadie; los otros tres tipos se explican por sí mismos.
- **Cambiar el tipo de un evento de soporte a otra cosa desengancha el ticket
  solo**, en vez de fallar: quien cambia el tipo no tiene por qué acordarse de
  limpiar el ticket a mano.
- **Los días de la ficha se sincronizan recién al guardar.** El backend tiene un
  endpoint por día (agregar / mover / quitar), pero dispararlos con cada tecla del
  input de fecha llenaría la auditoría de reprogramaciones fantasma:
  `EventoDetalleModal.tsx` calcula la diferencia contra lo guardado y manda solo
  los cambios reales, en orden bajas → movimientos → altas.
- **No se puede quitar el último día** (`ULTIMO_DIA`): un evento sin días no se
  vería en ningún lado. Para sacarlo del calendario se elimina el evento.
- **Agregar un día que ya existe no falla**: es idempotente.
- **La preferencia de filtros se guarda con debounce.** Cada cambio de preferencia
  deja una entrada de auditoría, y sin esperar un poco tildar tres filtros
  generaría tres entradas.
- **Destildar todos los filtros vuelve a mostrar todo.** Un calendario en blanco
  sin explicación se lee como que la app se rompió.

### Equipos dados de baja

Un equipo se da de baja en **suave** (`deletedAt`): desaparece del selector y de
los filtros, pero **las obras que hizo siguen mostrando su nombre**. El nombre y
el color están desnormalizados en cada `InstallationSchedule` (`teamName`,
`teamColor`) justamente para eso: el histórico tiene que seguir diciendo quién
hizo cada obra.

En la UI esas obras muestran **"<nombre> (ex equipo)"**. Antes decía
"(eliminado)", que se leía como si la obra fuera lo eliminado.

Caso hecho: el equipo **Leo** (septiembre de 2026), con
`scripts/baja-equipo-leo.ts`.

---

## Ejecución de Obra: subetapas (10-oct-2026)

Rediseñada por decisión de Nicolás. `PIPELINE_DEFINITIONS` (etapa
`EJECUCION_OBRA`) tiene cuatro subetapas: **Planificación y logística**,
**Realización de la obra** y **Retiro de sobrantes** (responsable: capataz) y
**Control de obra** (gerente de Operaciones). La etapa se completa sola cuando
las cuatro están resueltas, así que en la práctica la cierra el gerente al
completar el control. "Ensayo anti-isla realizado y grabado" y "Videos de
ensayos subidos" siguen con `evidenceKind: "ensayo-video"`. La planilla de
materiales usados es un ítem **no obligatorio**.

- **Solo proyectos nuevos.** Las obras existentes conservan su mezcla de
  subetapas viejas (O2P/O2T inactivas, Control de Costos, "Validación de Obra
  terminada", etc.); no se migraron. Ningún código depende de los nombres de
  estas subetapas (verificado con grep), salvo comentarios.
- **La plantilla guardada en settings le gana al código**: en prod hay que
  correr `prisma/scripts/sync-plantilla-ejecucion-obra.ts --apply`, que
  reemplaza las subetapas de Ejecución de Obra de `PIPELINE_TEMPLATE` por las
  del código.
- En Compras, "Logística de envío" se marca **No aplica** con cuadrilla propia
  (el estado `NO_APLICA` se ofrece en el cliente desde el mismo día).

## Vales de obra: salida, devolución y consumo (10-oct-2026)

Desarrollado pero **no exigido** ("lo que se viene"). En la pestaña
**Materiales** del proyecto (`MaterialesTab` en `ProjectDetail.tsx`) está
`ValesObraPanel`: una tabla por material con planificado (lista de materiales,
`ProjectMaterial.quantity > 0`), lo que salió, lo que volvió y el consumo
(salió − volvió), y los botones **Vale de salida** y **Vale de devolución**.

- Backend: `services/stock/vales-obra.service.ts` → `registrarValeObra()` y
  `consumoDeObra()`; rutas en `routes/vales-obra.routes.ts`:
  `POST /projects/:projectId/vales-obra` (**STOCK:CREATE**) y
  `GET /projects/:projectId/consumo-obra` (**STOCK:VIEW**).
- **Sin modelo nuevo**: cada renglón es un `StockMovement` con el `projectId`.
  Salida = EGRESO; devolución = INGRESO con `causaIngreso = OTRO`. Lo que los
  identifica es la `referencia`, que empieza con `VALE_SALIDA` o
  `VALE_DEVOLUCION` + fecha y hora de Uruguay (todos los renglones de un vale
  comparten la referencia). El consumo solo cuenta movimientos de vales, no los
  egresos sueltos de la pantalla Stock ni ingresos por factura imputados a la
  obra.
- **Diferencias deliberadas con `POST /stock/movements`**: acepta materiales con
  `gestionaStock=false` (registra el movimiento para el consumo pero no toca
  `stockActual`), acepta decimales y **no bloquea** si el stock no alcanza
  (puede quedar negativo). Hoy el stock del local no está al día y bloquear
  sería burocracia.
- **Limitación conocida:** el "real" de la pestaña Costos
  (`GET /projects/:id/cost-summary`) cuenta los EGRESO del proyecto y no resta
  las devoluciones. Si los vales se empiezan a usar en serio, hay que restar
  los INGRESO con referencia `VALE_DEVOLUCION`.

## Qué tiene que cubrir este capítulo

- Fotos de obra y el checklist de 23 fotos obligatorias
- Videos de ensayos: compresión, streaming por token y borrado
- Stock: productos, movimientos y su relación con la obra
- Agenda de instalación y equipos
- Los checklists de obra y qué se marca solo

---

## Plantilla

Al escribirlo, seguir la estructura común (ver `README.md`):

```
## Para qué existe
## Cómo se usa
## Cómo funciona
## Permisos
## Reglas y decisiones
## Casos borde
```

## Mientras tanto

Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad
sobre cómo funciona hoy**:

- El código, que es lo único que no miente.
- `CHANGELOG.md` para saber qué cambió y cuándo.
- `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede
  contradecir a la implementación.
- `docs/pendientes/` para saber qué falta.
