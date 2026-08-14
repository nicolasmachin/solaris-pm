# Manual de Voltia PM

Este es el documento de referencia de **cómo funciona la aplicación**: qué hace
cada módulo, cómo se usa desde la pantalla, qué pasa por debajo, quién tiene
permiso de qué y por qué cada cosa está resuelta como está.

Es el lugar donde consultar cuando algo no se entiende, cuando hay que retomar
una funcionalidad después de meses, o cuando hace falta saber si un
comportamiento raro es un error o una decisión.

---

## Cómo se relaciona con el resto de la documentación

| Documento | Responde a | Vive |
|---|---|---|
| **Este manual** | *¿Cómo funciona hoy?* | `docs/manual/` |
| `CHANGELOG.md` | *¿Qué cambió y cuándo, para el usuario?* | raíz (symlink a `client/public/`) |
| `CLAUDE.md` | *¿Cómo se trabaja en este repo?* | raíz |
| `docs/features/*/SPEC.md` | *¿Qué se planeó construir en su momento?* | histórico, **no** fuente de verdad |
| `docs/pendientes/` | *¿Qué falta hacer?* | tablero de trabajo |
| `docs/DEPLOY.md`, `ROLLBACK.md` | *¿Cómo se pone en producción?* | operación |

**Los SPEC no mandan.** Son documentos de diseño escritos *antes* de construir, y
varios ya contradicen al código (el de tareas sueltas, por ejemplo, describe
campos que nunca se implementaron así). Sirven para entender por qué se decidió
algo, no para saber cómo funciona. Ante una diferencia, manda este manual; y si
el manual difiere del código, manda el código y **el manual se corrige**.

---

## Capítulos

| # | Capítulo | Cubre | Estado |
|---|---|---|---|
| 01 | [Fundamentos](01-fundamentos.md) | Autenticación, permisos, auditoría, archivos, versionado de documentos, arranque del servidor | ✅ Completo |
| 02 | [Ventas](02-ventas.md) | Leads, pipeline, reclamos, propuestas comerciales, conversión a proyecto, comisiones | 🟡 Parcial (fechas del proceso · cotizador: precargas y saludo · cotizador B2B) |
| 03 | [Proyectos](03-proyectos.md) | Pipeline de obra, etapas, subetapas, checklists, ampliaciones, traspasos | ⬜ Pendiente |
| 04 | [Tareas y tickets](04-tareas.md) | Tareas de proyecto, tareas sueltas, estado en espera, Mis tareas, tickets | ✅ Completo |
| 05 | [Ingeniería](05-ingenieria.md) | Unifilar, materiales, triángulos, pre-ingeniería, visitas técnicas, proyecto final | 🟡 Parcial (consolidador de materiales) |
| 06 | [Operaciones](06-operaciones.md) | Obra, fotos, videos, stock, logística, agenda de instalación | ⬜ Pendiente |
| 07 | [Habilitación UTE](07-ute.md) | Trámite, subetapas dinámicas, formularios, documentos firmados | ⬜ Pendiente |
| 08 | [Finanzas](08-finanzas.md) | Movimientos, cobros, pagos a proveedores, facturación, flujo de fondos, estado de resultados | ⬜ Pendiente |
| 09 | [Experiencia del cliente](09-experiencia-cliente.md) | Interacciones, encuestas, mantenimientos, reportes fotovoltaicos, monitoreo diario de plantas | 🟡 Parcial (monitoreo diario) |
| 10 | [Portal del cliente](10-portal-cliente.md) | Acceso, proyectos, tickets, encuestas, reportes, notificaciones | 🟡 Parcial (generación diaria, vista como cliente) |
| 11 | [Métricas](11-metricas.md) | Dashboard, metas, reporte semanal, indicadores | ⬜ Pendiente |
| 12 | [Infraestructura](12-infraestructura.md) | Docker, base de datos, storage, jobs, correo, IA, respaldos | ⬜ Pendiente |
| 13 | [Conector MCP](13-conector-mcp.md) | Voltia PM dentro del chat de Claude: autorización, herramientas, permisos | ✅ Completo |

Los capítulos pendientes existen con su esqueleto y se completan a medida que se
trabaja sobre cada módulo. Un capítulo marcado ⬜ **no significa que la
funcionalidad no exista**: significa que todavía no está documentada acá. 🟡
marca lo que está a medio documentar porque la funcionalidad misma está a medio
construir.

---

## Cómo se escribe un capítulo

Todos siguen la misma plantilla, para que buscar sea previsible:

```
# Módulo

## Para qué existe        ← el problema real que resuelve, en dos párrafos
## Cómo se usa            ← el recorrido del usuario, pantalla por pantalla
## Cómo funciona          ← modelo de datos, endpoints, servicios, archivos
## Permisos               ← quién puede qué, y qué pasa si no puede
## Reglas y decisiones    ← por qué es así y no de otra forma
## Casos borde            ← lo que sorprende, lo que rompe, lo que no cubre
```

Dos reglas de estilo que evitan que envejezca mal:

1. **Se referencian archivos y funciones, no números de línea.** `version.service.ts`
   → `publishVersion()` sigue siendo cierto dentro de un año; `version.service.ts:151`
   deja de serlo con el primer cambio arriba.
2. **Lo que no se verificó, no se afirma.** Si algo se supone pero no se leyó del
   código, se dice que es una suposición o no se escribe.

---

## Cuándo se actualiza

Al cerrar cada funcionalidad, junto con el CHANGELOG y antes de dar el trabajo
por terminado. La regla completa está en `CLAUDE.md`.

Si una funcionalidad ya documentada se modifica, **se corrige el capítulo
existente**; no se agrega una sección nueva que conviva con la vieja diciendo lo
contrario. El manual describe el presente, no acumula historia: para eso está el
CHANGELOG.
