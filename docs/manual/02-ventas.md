# 02 · Ventas

> **Capítulo parcial.** Están escritas las secciones "Fechas del proceso" y
> "Cotizador de propuestas: precargas y saludo de la carta". El resto del módulo
> funciona en producción pero todavía no está documentado.

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

# Cotizador de propuestas: precargas y saludo de la carta

## Para qué existe

Lo que el asesor escribe en el cotizador debería ser solo lo que cambia de un
cliente a otro. Todo lo demás —la marca y la potencia de los paneles que se
venden hoy, la cotización del dólar, el markup— sale del singleton
`ProposalDefaults`, editable en **Admin → Defaults de propuestas**. Cada variable
es `{ value, asesorCanOverride }`: el flag decide si el asesor la puede pisar en
el cotizador o si el campo aparece deshabilitado con "Fijado por administración".

## Cómo se usa

En Admin, la sección **"Equipos por defecto"** agrupa marca de paneles, **potencia
por panel (W)** y marca de inversor. Al abrir el cotizador de un lead nuevo, esos
tres valores vienen precargados.

El **saludo de la carta** no se escribe: se arma solo con el nombre del cliente y
se muestra en el formulario como texto de solo lectura, debajo del nombre.

## Cómo funciona

- `client/src/lib/proposalDraft.ts` → `buildInitialDraftData()` lee las claves del
  singleton (`potenciaPanelWDefault`, `marcaPanelesDefault`, `cotizacionDolarDefault`…)
  y arma el borrador inicial. `mergeDraft()` superpone el borrador guardado.
- La clave `potenciaPanelWDefault` se siembra en
  `server/prisma/scripts/seed-proposal-defaults.ts` (valor inicial **590 W**,
  `asesorCanOverride: true`). El seed es idempotente: agrega solo las claves que
  faltan y no pisa lo que ya se editó desde Admin. **Al agregar una variable nueva
  hay que correrlo de nuevo en cada ambiente**, porque el formulario de Admin solo
  renderiza las claves que existen en el JSON `data`.
- El saludo lo calcula `client/src/lib/salutation.ts` → `saludoPara(nombre)`, y se
  escribe en `cliente.dirigidoA` del borrador en tres momentos: al armar el
  borrador inicial, al mergear uno guardado, y cada vez que cambia el nombre en el
  formulario. La plantilla del PDF (`carta.hbs`) sigue leyendo `dirigidoA`, así que
  el backend no cambió.

### Cómo infiere el género

`saludoPara()` mira el **primer nombre**: primero dos listas explícitas (femeninos
que no terminan en -a como Beatriz o Nair; masculinos frecuentes que terminan en
consonante como Miguel o Daniel, y los que terminan en -a como Luca), después la
terminación (-a → femenino, -o → masculino). **Si no hay señal confiable escribe
"Estimado/a Nombre,"** — un tratamiento neutro es preferible a errarle al género
en la primera línea de la propuesta. Los ambiguos en Uruguay (Ariel, Noel, Cruz)
quedan a propósito fuera de las listas para que caigan ahí.

Casos especiales: nombre vacío → "Estimado/a cliente,"; razón social (SRL, S.A.,
Ltda., cooperativa…) → "Estimados,"; nombre todo en mayúsculas o todo en
minúsculas → se capitaliza ("SOFÍA" → "Estimada Sofía,").

## Reglas y decisiones

- **El saludo dejó de ser editable a mano.** Era un campo que repetía un dato ya
  ingresado y la falla típica era dejar el nombre de otro cliente al reutilizar un
  borrador.
- **La lógica del saludo vive solo en el cliente**, que es quien arma el borrador,
  para no duplicar las listas de nombres en el servidor. El fallback del backend
  ("Estimado/a cliente,") queda como red por si llegara un `dirigidoA` vacío.
- **Los borradores viejos se normalizan al abrirse**: `mergeDraft()` recalcula el
  saludo aunque el guardado traiga uno tipeado a mano. Las versiones ya publicadas
  no se tocan (su PDF ya está generado).

## Casos borde

- Un nombre extranjero fuera de las listas y terminado en consonante (Kevin ya
  está; Bjorn no) sale como "Estimado/a". Se corrige agregándolo a la lista de
  `salutation.ts`, no desde la interfaz.
- Un nombre con apellido primero ("Vanoli Daniel") saluda al apellido: la función
  siempre toma la primera palabra.

---

## Qué falta cubrir en este capítulo

- El pipeline de 7 etapas y qué significa cada una
- Reclamos: el contador transversal y su diferencia con la etapa RECLAMADO
- Propuestas v2: borrador, cálculo, viabilidad, publicación y versionado
  (los defaults del cotizador y el saludo ya están documentados arriba)
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
