# 02 · Ventas

> **Capítulo parcial.** Está escrita la sección "Fechas del proceso". El resto
> del módulo funciona en producción pero todavía no está documentado.

Leads, pipeline comercial, reclamos, propuestas, conversión a proyecto y comisiones.

---

# Fechas del proceso

## Para qué existen

Son las que miden cuánto tarda el ciclo comercial: de la propuesta a la visita, y
de la visita al cierre. Alimentan los indicadores de Métricas y el reporte
semanal. Si quedan vacías, esos promedios no se calculan.

## Cómo se usa

En el panel del cliente potencial, sección **"Fechas del proceso"**: creación,
propuesta enviada, visita agendada, visita realizada y cierre. Todas se editan a
mano con "Guardar fechas". Las que el sistema completó solo llevan la etiqueta
**Auto**.

## Cómo funciona

`cambiarEtapaLead()` en `server/src/services/sales/leads.service.ts` arma un
objeto `dateAutoFills` según la etapa de destino:

| Etapa de destino | Fecha que completa | ¿Pisa lo que ya había? |
|---|---|---|
| `AGENDAR_VISITA` | visita agendada | no |
| `VISITADO` | visita realizada | no |
| `CERRADO_GANADO` / `CERRADO_PERDIDO` | fecha de cierre | **sí, siempre** |

La edición manual va por `PATCH /api/leads/:id` (no hay endpoint aparte de
fechas) y acepta `null` para vaciar cualquiera de ellas.

## Reglas y decisiones

- **Las fechas de visita no se pisan si ya tienen valor.** La visita pudo hacerse
  el martes y el lead moverse el viernes; esa fecha real vale más que la de hoy.
  Si se vacía el campo y se vuelve a mover a la etapa, se completa de nuevo.
- **La fecha de cierre sí se pisa siempre.** Un lead que se reabre y se vuelve a
  cerrar tiene que quedar con la fecha del último cierre real.
- **Ninguna otra etapa toca fechas**, y volver hacia atrás en el pipeline nunca
  borra una fecha ya cargada.

## Casos borde

- **`VISITADO` no completaba la fecha de visita realizada** hasta el 8/8/2026: la
  regla directamente no existía y el campo quedaba vacío salvo carga manual, lo
  que rompía el indicador de "días entre visita y cierre". El frontend incluso
  tenía la etiqueta "Auto" apagada a mano en ese campo, reflejando el hueco.
- Un lead puede llegar a `CERRADO_GANADO` sin pasar por `VISITADO`, y en ese caso
  no hay fecha de visita: el promedio de "visita a cierre" lo ignora en vez de
  contarlo como cero.

---

## Qué falta cubrir en este capítulo

- El pipeline de 7 etapas y qué significa cada una
- Reclamos: el contador transversal y su diferencia con la etapa RECLAMADO
- Propuestas v2: borrador, cálculo, viabilidad, publicación y versionado
- Propuestas v1 (generador viejo por Excel) y la lista unificada
- Conversión de lead a proyecto: precondiciones y qué se copia
- Comisiones del asesor: congelamiento al ganar y pago
- Adjuntos, fotos y videos de la visita comercial

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
