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
**soportes/reclamos** y **visitas técnicas**, que antes se coordinaban fuera de la
app y no se veían en ningún lado.

### Cómo se usa

- **"+ Nueva instalación"** agenda una obra, como siempre.
- **"+ Agendar otra cosa"** abre el alta de los otros tres tipos: se elige tipo,
  equipo, día, y opcionalmente cliente, ticket (solo en soporte), título y notas.
  **"Agregar otro día"** suma días que no tienen por qué ser consecutivos.
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

### Reglas y decisiones

- **El ticket solo se puede enganchar a un evento de SOPORTE**
  (`TICKET_SOLO_EN_SOPORTE`). Un reclamo colgando de un mantenimiento aparecería
  donde no corresponde.
- **Sin título se usa el nombre del cliente**; sin cliente, el nombre del tipo.
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
