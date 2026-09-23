# 02 · Ventas

> **Capítulo parcial.** Están escritas las secciones "Fechas del proceso",
> "Cotizador de propuestas: precargas y saludo de la carta", "Varias
> instalaciones en una misma propuesta", "Costeo a medida de una cotización",
> "Cotizador B2B: propuestas a empresas" y "Comisión del asesor: cómo se
> registra al ganar". El resto del módulo funciona en producción pero
> todavía no está documentado.

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

También se pueden corregir desde el chat de Claude con `editar_lead` (cap. 13):
un día (`AAAA-MM-DD`) o `"borrar"` por fecha. Es para casos especiales: lo
normal sigue siendo que se completen solas.

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
fechas) y acepta `null` para vaciar cualquiera de ellas. El chat usa el mismo
servicio, `editarLead()`.

### Cómo se guarda un día cargado a mano

Las cinco fechas son columnas **con hora**. Un día cargado a mano se guarda como
las **00:00 de Uruguay** (03:00 UTC): en la app, `inicioDiaUruguayIso()` de
`client/src/utils/date.ts`; en el chat, `diaManualUruguay()` de
`server/src/utils/uruguay.ts`. Para mostrarlas y editarlas, el panel toma el día
de Uruguay (`diaUruguay()`), igual que el listado y las métricas.

Los cambios de fecha quedan en la auditoría ("Actualizó la fecha de visita
agendada del lead … de 22/07/2026 a 22/09/2026"), con `source: "mcp"` si vinieron
del chat.

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
- **Hasta v10.9 un día cargado a mano se guardaba a las 00:00 UTC**, que en
  Uruguay son las 21:00 del día anterior. El panel lo mostraba bien (recortaba la
  fecha UTC) pero el listado de leads lo mostraba un día antes, y las métricas,
  que cortan a medianoche de Uruguay, lo habrían contado en el día anterior.
  `scripts/backfill-fechas-lead-uruguay.ts` corre esos valores (exactamente
  00:00:00.000 UTC) a las 03:00 UTC. Además, hasta v10.9 los cambios de fecha
  no quedaban auditados: `editarLead()` no las comparaba.
- El filtro por rango de fechas del listado de leads corta en días de Uruguay.
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

### La fecha del documento

La fecha que sale en la portada es la de **emisión**, no la del día en que se
abrió el cotizador por primera vez. El borrador es uno por lead y sobrevive
entre versiones, así que su `fecha` quedaba clavada en la de la V1: una V2
emitida una semana después salía con la fecha vieja impresa.

`initial-draft.ts` → `fechaVigente()` la corrige **solo hacia adelante**: si
quedó en el pasado la lleva al día de hoy; si es de hoy o futura la respeta
(fechar una propuesta para más adelante es intencional). Se aplica en tres
puntos, porque publicar no pasa necesariamente por el formulario: al armar el
borrador (`mergeDraftData`), en el preview y en `publishVersion`, que además
persiste la corrección en el borrador. El conector entra por el mismo camino.

`todayIso()` calcula el día en **America/Montevideo** y no en UTC: el servidor
corre en UTC y un `toISOString()` pelado fecha el documento al día siguiente
desde las 21:00 hora local.

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

# Varias instalaciones en una misma propuesta

## Para qué existe

A veces un cliente quiere dos instalaciones a la vez: dos techos, dos padrones,
dos casas. El cotizador asumía **un solo inversor**, así que había que cotizar
una sola y ajustar el precio a mano, o emitir dos propuestas separadas.

## Cómo se usa

En "Datos técnicos del sistema", campo **Cantidad de inversores**. Con más de uno:

- La **potencia del inversor** es la de **uno solo**, no la suma.
- Los **paneles** se cargan **sumados** entre todas las instalaciones.
- El costo del **inversor** y el de la **instalación eléctrica** se multiplican
  por la cantidad. Nada más se multiplica.

También se puede cotizar así desde el chat, con el argumento
`cantidad_inversores` de `preparar_propuesta`.

## Cómo funciona

El campo es `sistema.cantidadInversores` en el borrador, entero ≥ 1 y **con
`.default(1)`**: los snapshots publicados antes de esto no lo traen y, si fuera
obligatorio, quedarían no regenerables (mismo motivo que `variante` y `costos`).

La clave del cálculo es **`panelesPorInstalacion`** en `calculator.ts` §2:

```
panelesPorInstalacion = ceil(cantidadPaneles / cantidadInversores)
```

Ese número —y no el total— alimenta las dos reglas que escalan con el tamaño:

- **El escalón de la instalación eléctrica** (`getMultiplicadorElectrica`).
- **El precio del inversor** (`obtenerPrecioInversor`), que usa la cantidad de
  paneles para el caso especial trifásico de sistemas de menos de 13 paneles.

Sin ese reparto se contaría dos veces el tamaño: el escalón subiría por los
paneles sumados y después se multiplicaría otra vez por la cantidad. Dos
instalaciones de 12 paneles le costarían al cliente un 50% más de eléctrica que
cotizarlas por separado.

Las cantidades efectivas del costeo salen de ahí:

```ts
const inversorCantidad  = ajustes.inversorCantidad  ?? cantidadInversores;
const electricaCantidad = ajustes.electricaCantidad ?? cantidadInversores;
```

Un ajuste manual del panel de costeo **sigue ganando**: si alguien pisó la
cantidad a mano, sabe algo que el cálculo no. Cuando difieren, el panel lo avisa
en rojo.

En el documento, el helper `{{#if (varios ...)}}` de `template.ts` hace que los
bloques del inversor hablen en plural **solo** cuando hay más de uno. Toca
`carta.hbs` (las dos variantes), `resumen.hbs`, `resumen-ejecutivo.hbs` y
`cotizacion.hbs`.

## Reglas y decisiones

- **Todos los inversores son iguales.** Es una cantidad, no una lista de
  inversores distintos. Eso es lo que mantiene el cambio acotado:
  `potenciaInversorKw` sigue siendo un número y no se tocó nada aguas abajo
  (contrato, proforma, documentos UTE, conector del chat). Cotizar inversores de
  potencias distintas sería un cambio de modelo de datos.
- **Los paneles por instalación se redondean para arriba**: con 25 paneles en 2
  instalaciones, una lleva 13 y otra 12; se cotiza sobre la más grande.
- **Con un inversor el documento sale idéntico al de siempre.** Es el criterio
  con el que se construyó: nada de lo ya emitido cambia.

## Casos borde

- **La mano de obra no se duplica.** La cuadrilla se calcula por cantidad total
  de paneles. Dos obras separadas llevan más trabajo que una sola del doble de
  tamaño; si queda corta, se ajusta en el panel de costeo.
- **El medidor queda en 1**, aunque dos instalaciones con dos conexiones a UTE
  llevarían dos. No se multiplica porque no se pidió.
- **El documento no separa las dos instalaciones**: muestra un sistema con dos
  inversores, no "instalación 1" e "instalación 2".
- **La potencia pico, la generación y el ahorro no cambian**: dependen de los
  paneles, que ya se cargan sumados.
- **La conversión a proyecto sigue siendo manual.** Nada crea hoy el
  `SolarSystem` del proyecto desde la propuesta, así que la cantidad se vuelve a
  cargar a mano al abrir la obra. El modelo del proyecto ya tiene
  `inverterQuantity`, así que el día que se automatice, encaja.

---

# Costeo a medida de una cotización

## Para qué existe

El cotizador calcula el costo del sistema con precios de lista: el panel a tanto,
la estructura a tanto, la eléctrica según el suministro y el escalón de paneles,
el inversor según una tabla por potencia. Eso sirve para el 90% de los casos,
pero no para el que se sale de la norma: un proveedor que cambió el precio esta
semana, una obra con acceso difícil que dispara la mano de obra, un cliente que
pone su propio medidor.

Antes, cualquiera de esos casos se costeaba en una planilla aparte y el número
se metía a mano moviendo el markup hasta que el total diera. Esta sección trae
esa planilla adentro del cotizador.

## Cómo se usa

En el cotizador, con el **ícono de calculadora** del encabezado, al lado del
botón de publicar. Es a propósito discreto: son los costos del negocio, no un
dato de la propuesta, y no tienen por qué estar a la vista de todo el que
cotiza. Abre un panel lateral que replica la planilla original en tres bloques:

- **Costeo** (editable): los cinco ítems con su costo unitario y su cantidad,
  más los costos fijos y los variables.
- **Pricing**: costos, mano de obra (editable), markup, comisiones, IVA y total.
- **Flujo de caja**: cobros, pagos, ganancia final, margen y USD por watt.

Un campo en blanco usa el valor de lista; el placeholder muestra cuál es. Al
escribir un número, el campo queda resaltado y aparece una flecha para volver al
original. Arriba hay un botón que devuelve todo de una.

Todo lo demás se recalcula al instante, porque el cálculo lo hace el servidor y
la consulta se refresca con cada autosave.

## Cómo funciona

Los ajustes viven en `data.costos` del borrador (`ProposalV2Draft`), no en
`ProposalDefaults`. Son **por cotización**: no tocan los precios de lista ni
ninguna otra propuesta. Se autoguardan con el resto del formulario y viajan
dentro del snapshot al publicar, así la versión emitida se regenera con los
mismos números con que se cotizó.

- Schema: `costosOverrideSchema` en `schemas/draft.schema.ts`, presente en las
  dos variantes (la lenient del autosave y la strict de publicación).
- Cálculo: `calculator.ts` §2 y §3 resuelven primero el valor de lista y recién
  después lo pisan con el ajuste.
- Endpoint: `GET /api/proposals-v2/leads/:leadId/draft/costeo`, en
  `draft.service.ts` → `computeDraftCosteo()`.
- Pantalla: `components/proposals-v2/CosteoDrawer.tsx` (el panel lateral y su
  botón) + `CosteoPanel.tsx` (las tablas) + `hooks/useDraftCosteo.ts`.

Va en un drawer **aparte del de debug de calculadora**, aunque se parezcan: ese
es de solo lectura y de administración (`VENTAS:DEBUG_CALCULADORA`), este edita
el borrador y lo usa quien cotiza. Comparten la forma, no el permiso.

Los valores "de fábrica" que se muestran como referencia **no se recalculan a
mano**: el servicio corre el motor una segunda vez con los ajustes vaciados. Así
las reglas de precio (el multiplicador de la eléctrica, la tabla de inversores)
viven en un solo lugar.

## Permisos

`VENTAS:EDIT`, o sea quien cotiza. Se eligió así —y no el permiso del drawer de
debug, que es de administración— porque el asesor ajusta los costos de su propia
propuesta.

**Consecuencia asumida:** el asesor ve el costo real del negocio y, como ya
editaba el markup, también la ganancia. Fue una decisión tomada al construirlo,
no un descuido.

## Reglas y decisiones

- **Un campo vacío es "usar el valor de lista"**, no "cero". Borrar el ajuste es
  la forma de volver al original; la clave se elimina del objeto en vez de
  quedar como `undefined`, que el autosave mandaría igual y el backend rechaza.
- **Un cero sí vale**: un ítem bonificado o que aporta el cliente cuesta 0. Por
  eso el cálculo usa `??` y no `||`.
- **Paneles y estructuras arrastran la cantidad del sistema** salvo que se la
  pise. La eléctrica, el inversor y el meter van en cantidad 1 porque su precio
  de lista ya es el total de la línea.
- **Subir un costo sube el precio final, no la ganancia relativa**: el markup es
  un porcentaje sobre costo + mano de obra, así que se mueven juntos. El
  invariante del motor (`gananciaFinal ≡ markupUsdSinIva`) se mantiene.

## Casos borde

- **La cantidad de paneles queda en dos lugares**: el sistema cotizado y la
  línea del costeo. Se puede costear 11 y vender 12 — es legítimo, pero pasa
  desapercibido, así que la pantalla lo avisa en rojo cuando no coinciden.
- **Si el borrador está incompleto no hay costeo**: el cálculo necesita paneles,
  suministro, dólar y markup. La sección muestra qué falta en vez de una tabla
  vacía.
- **Las propuestas publicadas antes de esta funcionalidad no traen `costos`.**
  El campo es opcional a propósito: si fuera obligatorio, todas esas versiones
  quedarían no regenerables (mismo motivo que `variante`).
- **Cambiar un precio de lista en Admin no mueve las cotizaciones ya ajustadas**
  en esa línea: el ajuste gana. Sí mueve las líneas sin ajustar.

---

# Cotizador B2B: propuestas a empresas

## Para qué existe

Una propuesta a una empresa no es la misma que a una casa. El documento
residencial tutea, habla de "tu hogar" y menciona el 12% de IRPF —un impuesto de
persona física que a una empresa no le aplica—, y no tiene dónde poner razón
social ni RUT. Además, en B2B cada negociación es particular: el asesor discute
el precio caso por caso, y con la comisión fija del 4% le daba casi lo mismo
cerrar con markup 20% que con 30%.

## Cómo se usa

En la ficha del cliente potencial hay **dos botones**: "Armar propuesta" (el de
siempre) y **"Cotizador B2B"**. Abren el mismo constructor con **borradores
separados**: se puede tener a la vez una cotización residencial y una de empresa
sobre el mismo lead, sin que una pise a la otra.

El lead se clasifica con **Tipo de cliente: Residencial / Empresa (B2B)**. Eso
**precarga y resalta**, pero no restringe: desde cualquier lead se puede abrir
cualquiera de los dos cotizadores.

En el cotizador B2B aparecen, además de lo habitual:

- Un chip **B2B** en el encabezado.
- La sección **"Datos de la empresa"** (razón social, RUT, contacto y cargo).
  Razón social y RUT son obligatorios para publicar; el resto es opcional.
- El markup arranca en el valor propio de B2B, no en el residencial.
- Un panel plegable **"Tu comisión"** debajo del markup, con el desglose en vivo.

## Cómo funciona

### La variante

`variante: RESIDENCIAL | EMPRESA` vive en **dos lugares con roles distintos**:
como **columna** de `ProposalV2Draft` (rutea el borrador; la unicidad es
`@@unique([leadId, variante])`) y dentro de **`data`** (viaja al snapshot al
publicar, y de ahí la leen el calculador y las plantillas).

En el schema Zod es `.default("RESIDENCIAL")` **a propósito**: los snapshots
publicados antes de esta función no la traen, y si fuera obligatoria todos
quedarían no-regenerables. Lo mismo con `empresa`, que es opcional y solo se
exige (vía `superRefine`) cuando la variante es EMPRESA.

Las rutas de borrador aceptan `?variante=EMPRESA`; sin el parámetro asumen
residencial, así que cualquier cliente anterior sigue funcionando.

### La comisión variable

En `calculator.ts` (§4 Pricing):

```
markup excedente = max(0, markup% − referencia%) × (costo + mano de obra)   ← 0 si no es EMPRESA
comisión         = base% × (costo + mano de obra + markup)
                 + tajada% × markup excedente                                ← 0 si no es EMPRESA
```

Los tres parámetros viven en el subobjeto `b2b` del singleton
(`markupReferenciaPorcentaje` **en porcentaje**, `comisionBasePorcentaje` y
`comisionExcedentePorcentaje` **en fracción** — la mezcla de unidades es la del
resto del archivo) y se editan en **Admin → Defaults de propuestas → Propuestas a
empresas (B2B)**.

`resolveDefaults` los aplana a `b2bMarkupReferenciaPorcentaje`,
`b2bComisionBasePorcentaje` y `b2bComisionExcedentePorcentaje`, **con fallback a
los valores semilla** en vez de tirar como el resto de las claves: un ambiente
sin el seed corrido tumbaría también las propuestas residenciales, que son el
grueso de la operación.

La comisión sigue siendo un **costo dentro del precio**: la paga el cliente y la
ganancia de la empresa sigue siendo exactamente el markup (`gananciaFinal ≡
markupUsdSinIva`, con test que lo fija).

El cálculo emite cuatro campos nuevos —`markupExcedenteUsdSinIva`,
`comisionVentasBaseUsdSinIva`, `comisionVentasExcedenteUsdSinIva` y
`comisionVentasPctEfectivo`— que alimentan el panel del cotizador
(`GET /draft/comision`, gateado por **VENTAS:EDIT**, no VIEW: la comisión no la
tiene que ver cualquiera que pueda mirar Ventas) y el congelamiento de la
comisión al ganar el lead.

### El documento

`server/src/templates/proposal-v2-empresa/` contiene **solo los partials que
cambian de fondo** (`carta.hbs` y `como-funciona.hbs`); el resto se hereda de la
carpeta residencial por fallback. Las frases sueltas se resuelven con el helper
`{{t "tu inversión" "la inversión"}}`, y el layout (`full.hbs`) es **uno solo**
para las dos variantes gracias al partial dinámico `{{> (p "carta")}}`.

Los partials se registran namespaceados (`EMPRESA/carta`) porque **el registro de
Handlebars es global al proceso**: con nombres planos, dos `carta.hbs`
competirían y ganaría el último leído.

Sobre el IRPF: el documento B2B **no afirma ninguna tasa**. Dice "con los
descuentos impositivos que correspondan según la situación fiscal de la empresa"
porque no está verificado qué régimen aplica. Es una decisión consciente, no un
olvido.

### La tapa

`ProposalDefaults` tiene un segundo par de columnas
(`coverEmpresaPdfAttachmentId`, `coverEmpresaOverlay`). Si están vacías, el
cotizador B2B **usa la tapa residencial**, así funciona desde el día uno. En la
tapa B2B se imprime la **razón social**, no el nombre del contacto.

`publishVersion` snapshotea la tapa **ya resuelta** por variante, así que
regenerar el PDF años después no depende de qué tapa esté cargada en ese momento.

`coverOverlay.ts` → `acomodarTexto()`: las coordenadas se configuran una vez
pensando en un nombre de persona, y una razón social larga se salía de la
página. El orden es **dejarlo → encogerlo un poco → partirlo en dos líneas →
recortarlo con "…"**. Recortar es el último recurso.

## Permisos

| Acción | Permiso |
|---|---|
| Abrir cualquiera de los dos cotizadores, ver borrador y preview | `VENTAS:VIEW` |
| Guardar el borrador y ver el desglose de comisión | `VENTAS:EDIT` |
| Publicar una versión | `VENTAS:CREATE` |
| Editar los parámetros B2B y subir la tapa de empresa | ADMIN (chequeo por rol dentro del handler) |

**No se agregó ningún permiso nuevo**: la variante no es un eje de la matriz.
Quien puede cotizar, puede cotizar B2B.

## Reglas y decisiones

- **Dos cotizadores, no un selector adentro.** Es lo que se pidió y además evita
  que un mismo borrador cambie de naturaleza a mitad de camino.
- **Un lead puede tener las dos propuestas.** Las versiones publicadas comparten
  la numeración del lead (V1 residencial y V2 de empresa conviven en la lista) y
  cada una congela su variante.
- **La lógica de comisión no se duplica en el front.** El panel del cotizador
  pide el desglose al servidor; si cambian los parámetros, el panel los refleja
  sin tocar código.
- **El rediseño gráfico del documento B2B es una etapa aparte**, todavía
  pendiente. Esta fase corrigió lo que estaba *mal* (tratamiento, IRPF, datos
  fiscales) manteniendo la identidad visual actual; la carpeta propia de
  plantillas está lista para rediseñarse sin tocar la residencial.

## Casos borde

- **Una versión publicada antes de julio no se puede regenerar**
  (`VERSION_SNAPSHOT_OUTDATED`), pero no por la variante: a esos snapshots les
  faltan `plazoEntrega` y `tipoMontaje`, obligatorios desde antes. Deuda previa.
- **El saludo de la carta** en B2B sale "Estimados," cuando la razón social trae
  un sufijo societario (S.A., SRL, cooperativa…), por la misma función que
  resuelve el saludo residencial.
- **Cambiar los parámetros B2B no afecta a las propuestas ya publicadas**: cada
  una congeló su comisión y su porcentaje efectivo en el snapshot.
- Al abrir el constructor sobre una versión publicada **antes** de este cambio,
  el aviso "sin cambios" del modal de publicación puede decir que hay cambios
  (el snapshot viejo no tiene `variante`). Es cosmético: no afecta cálculo ni PDF.

---

## Comisión del asesor: cómo se registra al ganar

### Para qué existe

Cerrar una venta tiene que dejar dos cosas registradas solas: cuánto se vendió y
cuánto se le debe al asesor. El precio es un dato de la **propuesta**, así que la
comisión se deriva de ahí y no al revés.

### Cómo funciona

- Al pasar el lead a **CERRADO_GANADO** (por la app o por el conector MCP: los
  dos entran por `moverEtapaLead`), se llama a `congelarComisionAlGanar`
  (`commission.service.ts`), que toma la **última propuesta publicada no
  descartada** y congela la comisión con el monto de su snapshot
  (`comisionVentasUsdSinIva`), más el pendiente en Finanzas (`FinanceMovement`
  PREVISTO, subcategoría "Comisiones ventas").
- Es **best-effort**: si algo falla, el cambio de etapa no se cae. La venta queda
  ganada y la comisión se puede cargar después.
- Es **idempotente**: si el lead ya tiene comisión, no la toca.
- El modal "Comisión del asesor" (`CommissionCaptureModal`) sigue abriéndose al
  ganar, pero ya **no es lo que hace que la comisión exista**: muestra cuál
  propuesta quedó tomada y sirve para **cambiarla**. Al elegir otra versión,
  `confirmCommission` re-congela sobre la misma comisión (`recongelarDesdePropuesta`):
  recalcula el monto y arrastra el movimiento de Finanzas.
- El **monto de la venta** que leen los informes sale de la propuesta: la
  congelada en la comisión, si no la última publicada del lead, y como último
  recurso el presupuesto estimado del lead (ver `montoDeVenta` en el reporte
  semanal).

### Reglas y decisiones

- Se congela aunque nadie confirme nada. La decisión es de negocio: es preferible
  una comisión de más (que después no se paga) a una venta sin monto.
- Una comisión **ya pagada** no se re-congela desde el modal
  (`COMISION_PAGADA`): su movimiento puede tener pagos aplicados, así que se
  edita desde Finanzas, que deja nota de edición.
- Cambiar la propuesta elegida requiere `VENTAS:EDIT` (el mismo permiso que
  congelarla). Editar montos/fechas de una comisión sigue siendo solo ADMIN.

### Casos borde

- **Venta sin ninguna propuesta publicada**: no hay monto que leer, así que no se
  congela nada y hay que cargarlo a mano (ADMIN/FINANZAS, monto manual). Pasa con
  ventas cerradas sin haber emitido propuesta desde la app.
- **Propuestas viejas (v1, sin snapshot)**: tampoco tienen comisión calculada;
  mismo camino manual.
- Ventas cerradas **antes** de este cambio quedaron sin comisión: se arreglan con
  `server/scripts/backfill-comisiones-ganados.ts` (dry-run por defecto,
  `--execute` aplica; `--lead <id> --precio-sin-iva <USD> --precio-con-iva <USD>`
  para las que no tienen propuesta).

---

## Qué falta cubrir en este capítulo

- El pipeline de 7 etapas y qué significa cada una
- Reclamos: el contador transversal y su diferencia con la etapa RECLAMADO
- Propuestas v2: borrador, cálculo, viabilidad, publicación y versionado
  (los defaults del cotizador y el saludo ya están documentados arriba)
- Propuestas v1 (generador viejo por Excel) y la lista unificada
- Conversión de lead a proyecto: precondiciones y qué se copia
- Comisiones del asesor: el pago y el circuito en Finanzas (el congelamiento al
  ganar ya está documentado arriba)
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
