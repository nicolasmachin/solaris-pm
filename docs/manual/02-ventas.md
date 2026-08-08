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

**Sólo se aplica si la etapa realmente cambia.** Reconfirmar la misma etapa no es
un hito nuevo: mover un lead de Visitado a Visitado no significa que se lo haya
visitado hoy otra vez, y estampar la fecha de hoy sobre un hito de hace semanas
queda peor que el campo vacío.

### Qué significa cada fecha de visita

Son dos cosas distintas y se confunden fácil:

- **Visita agendada**: el día en que se **acordó** la visita con el cliente, no el
  día en que se va a hacer. Si hoy 8 se coordina para el 9, queda el 8.
- **Visita realizada**: el día en que efectivamente se visitó.

### El bot de minutas

Cargar la minuta **es** el hito de visita realizada: si hay minuta, la visita se
hizo. Por eso, al publicar una minuta en un lead, el bot de Telegram
(`minutas-bot`, repo aparte) hace dos cosas contra la API:

1. `PATCH /api/leads/:id` con `visitCompletedAt` = **la fecha que figura en la
   minuta**, no la de hoy. La minuta puede subirse días después de la visita.
2. `PATCH /api/leads/:id/stage` con `VISITADO`, si el lead no está ya ahí.

En ese orden: si la fecha se setea primero, el autocompletado de la etapa no la
pisa (sólo actúa sobre campos vacíos). Un lead **ya cerrado no se toca**: una
minuta que llega tarde no lo devuelve a Visitado. Ambos pasos son no bloqueantes
— si fallan, la minuta igual quedó subida y el bot lo reporta como advertencia.

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
