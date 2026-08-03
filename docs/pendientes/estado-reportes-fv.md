# Estado — Reportes fotovoltaicos mensuales

Migración del sistema Python standalone (`~/Dev/Reporte_Fotovoltaico`) a Voltia PM.
Última actualización: **2 de agosto de 2026 (tarde)**.

## Fase 4 — Ingesta Growatt ✅ verificada contra la API real

`server/src/services/reportesFv/growatt/`:
- `metricas.ts` — lógica pura (port de growatt_clientes.py): `resumirHistorialDiario`
  (suma del máximo diario de cada día), `diasConMuestras`, `contarDiasEsperados`,
  `derivarMetricas` (consumo = generación + importación − exportación; descarta el
  mes si la cobertura < 90%). **7 unit tests** (`test:reportes-fv-growatt`).
- `client.ts` — cliente HTTP fetch de la Open API v1. Token **obligatorio por env**
  (`GROWATT_API_TOKEN`), sin default. Retry con backoff, pausa entre llamadas
  (rate limit 10012). Endpoints: `plant/list` (paginado perpage=100), `plant/energy`
  (generación mensual), `device/list` (dataloggers type===3), `device/ammeter/meter_list`,
  `device/ammeter/meter_data` (día por día — la API devuelve sólo el último día de
  un rango).
- `plantas.service.ts` — `sincronizarPlantas` (catálogo → GrowattPlant),
  `listarPlantasConSugerencias` (matching por nombre sólo como sugerencia),
  `vincularPlanta`.
- `ingesta.service.ts` — `ingerirPeriodo` (in-process, devuelve id + polling) /
  `ejecutarIngesta`. Resumible: cada planta se persiste apenas termina, y una
  corrida saltea las que ya tienen lectura completa (salvo force). Concurrencia
  entre plantas (env `REPORTES_FV_GROWATT_CONCURRENCIA`, default 3). Merge que
  respeta MANUAL (Growatt no pisa un valor cargado a mano salvo force). Al final
  recalcula las series tocadas.

Endpoints: `GET /growatt/plantas`, `POST /growatt/sincronizar`, `POST
/growatt/plantas/:id/vincular`, `POST /ingesta`, `GET /ingesta/:id`.

Frontend: botón **"Traer datos de Growatt"** en el panel (dispara + polling del
progreso) y modal **Plantas Growatt** (`PlantasGrowattModal.tsx`: sincronizar,
vincular con sugerencias, ignorar).

**Verificado contra la API real (3 ago 2026)**: con `GROWATT_API_TOKEN` seteado
en el `.env` local (copiado del proyecto Python; `.env` está gitignoreado):
- `POST /growatt/sincronizar` → 152 plantas en 4s (trajo 4 nuevas vs las 148 de
  la migración).
- Ingesta de un generador (Germán Fernández, junio, force) → **33 requests**
  (1 generación + 1 device_list + 1 meter_list + 30 días de meter_data), ~38s,
  estado OK. La lectura quedó con fuente GROWATT, cobertura 30/30, consumo derivado
  correcto, y disparó el recálculo. Una corrida de las 44 plantas serían ~28 min.
- 7 tests de la lógica pura; tsc server+client en 0.

**Para prod**: setear `GROWATT_API_TOKEN` en `docker-compose.prod.yml`. El token
NO está en el repo (era el hardcodeado del script Python; vive sólo en los `.env`
locales, ignorados por git).

**Futuro — multi-marca (Huawei, Fronius)**: hay clientes con esas marcas. El
diseño ya separa la lógica pura (`metricas.ts`, reusable) del cliente HTTP
(`client.ts`, específico de Growatt). Para agregar una marca: nuevo `client` por
proveedor + extender `origenDatos` y el selector de proveedor en la ingesta.

## Fase 7 — Envío por email + portal del cliente ✅ (verificado por API)

**Email** (`server/src/services/email.service.ts`): `sendEmail` extendido con
`attachments`, `cc`, `bcc` y destinatarios múltiples, sin tocar el guardrail
`client_facing`. El reporte se manda con `type: "client_facing"` (guardrail
exige el flag para externos).

**`envio.service.ts`**: `enviarEmision(emisionId, {dryRun, userId})` y
`enviarLote(periodo, {...})`. Flujo: valida guardas duras → dry-run registra sin
mandar → **claim transaccional** sobre `enviadoEn` (idempotencia; dos clicks o
dos crons no mandan dos veces) → `sendEmail` con PDF adjunto + BCC interno →
`EmailLog` + `ReporteFvEnvio` + `publicadoEnPortal=true` + auditoría. Si el SMTP
falla, revierte el claim para reintentar. Guardas: habilitado, sin bloqueos de
envío, ≥1 destinatario, emisión LISTO, PDF >20KB, y un **sanity check** del
ahorro (fuera de [0.2×,5×] del promedio con ≥3 meses → OMITIDO, no se manda en
lote). Cuerpo del mail en `emailBody.ts` (port del Python, marca Voltia).

**Endpoints**: `POST /emisiones/:id/enviar` (dryRun opcional) y `POST /envios/lote`,
ambos `authorize(EXPERIENCIA_CLIENTES, COMPLETE)`. **Permiso nuevo**: se agregó
`COMPLETE` a EXPERIENCIA_SOLAR con `prisma/scripts/seed-reportes-fv-permissions.ts`
(idempotente; **correr en prod** + reiniciar server). ADMIN ya lo tenía.

**Portal del cliente** (`portal.routes.ts`): `GET /client/reportes` (los
publicados de mis proyectos, agrupados por año) y `GET /client/reportes/:id/pdf`
(ownership por `clients: { some: { userId } }`). Frontend: `PortalReportes.tsx`
en `/portal/reportes` + item "Reportes" en el nav del portal.

**Frontend del envío**: botón Enviar + Prueba (dry-run) en la tab PDF del
`ReporteFvDetalle`, con confirmación. Sólo visible con permiso COMPLETE.

**Verificación**: envío real de prueba de punta a punta (Vanoli → redirigido a
`nfmj@hotmail.com`, guardrail client_facing OK, PDF adjunto, asunto correcto);
idempotencia (reenviar → OMITIDO); dry-run; portal (ownership + aislamiento entre
clientes verificado; residuo revertido). tsc server+client en 0, golden verde.
Falta validación visual de Nicolás (el screenshot del navegador no anda por el
polling de la SPA). En local todo mail va redirigido a `nfmj@hotmail.com`.

Nuevo env: `REPORTES_FV_BCC` (BCC interno de cada envío; vacío = sin copia).

## Fase 6 — Panel de gestión en Experiencia Solar ✅ (verificado por API)

Pestaña **Reportes FV** en Experiencia Solar (`/clientes/reportes`).

**Backend** (`server/src/services/reportesFv/` + `reportes-fv.routes.ts`):
- `panel.service.ts` — `getPanel(periodo)` lista TODOS los generadores (dados de
  alta y no) con estado semáforo + KPIs; `getDetalleGenerador(projectId)`;
  `periodosConDatos()`. El universo son los proyectos con config, los livianos
  (`importedFromCsv`) o los que llegaron a habilitación UTE.
- `lecturas.service.ts` — `upsertLecturaManual` (fuente MANUAL, no la pisa Growatt).
- `config.service.ts` — `upsertConfig` (dar de alta / editar + destinatarios).
- Endpoints (todos `authorize(EXPERIENCIA_CLIENTES, ...)`): `GET /panel`,
  `GET /periodos`, `GET /generadores/:id`, `PUT .../config`, `PUT .../lecturas/:periodo`,
  `POST .../recalcular`, `POST .../emitir`, `GET /emisiones/:id/pdf`. Editar
  config o lectura dispara recálculo. El PDF se sirve por stream (o se regenera
  desde el snapshot si falta el archivo).

**Frontend** (`client/src/modules/clientes/`):
- `pages/ReportesFvPanel.tsx` — selector de periodo, 7 KPIs, tabla con semáforo,
  búsqueda y filtro "solo con pendientes".
- `components/ReporteFvDetalle.tsx` — modal con 3 tabs: Configuración (alta/edición
  + destinatarios), Lectura del mes (carga manual), Reporte/PDF (generar + preview
  en iframe + descargar). Reusa `useAuthBlobUrl`.
- Tab agregada en `ExperienciaSolarLayout.tsx` + ruta en `App.tsx`.

Permisos: el rol `EXPERIENCIA_SOLAR` ya tiene VIEW/CREATE/EDIT/DELETE en
`EXPERIENCIA_CLIENTES` — no hizo falta seed nuevo.

**Bug corregido de la Fase 3**: `reportesFv.api.ts` llamaba a `/reportes-fv/...`
sin el prefijo `/api` (el backend monta con `/api`), así que la pantalla de
tarifas estaba rota. Corregido; ahora todo usa `/api/reportes-fv/...`.

**Verificación**: todos los endpoints probados por API (panel 69 generadores /
55 alta / 14 sin alta; alta de un generador; carga de lectura → recálculo →
CALCULADO; PDF por stream 200). tsc server+client en 0. El screenshot automático
del navegador no funcionó por el polling de la SPA (limitación del extension, no
del código) — **queda validación visual pendiente por Nicolás**.

Falta del panel (menor): mostrar la cobertura de días en la tab de lectura;
disparo masivo (recalcular/generar todos); dashboard de métricas agregadas del
parque. El envío queda para la Fase 7.

## Fase 5 — Generación del PDF ✅

`server/src/services/reportesFv/pdf/` — port del template Jinja (1129 líneas) a
un template literal de TS, renderizado con el Puppeteer de `efpPdf/v2` (misma
instancia de Chromium). Archivos:

- `styles.ts` — el `<style>` del Jinja extraído **literal** (`String.raw`).
- `template.html.ts` — cuerpo portado: `{% for %}`→`.map().join`, `{% if %}`→
  ternarios, filtros Jinja a mano. `esc()` en todo texto libre.
- `types.ts` / `viewModel.ts` — view-model plano (todo strings ya formateados) +
  el traductor `ResultadoPeriodo → ReporteFvPdfInput`.
- `logo.ts` — logo Voltia como constante base64 (NO un .png: `tsc` no copia
  assets a `dist/`, así el logo viaja con el código en prod).
- `index.ts` — `generarReporteFvPdf(input) → Buffer`.
- `format.ts` (en la raíz del módulo) — `fmtInt`/`fmtDecimal`/`mesEs`/
  `duracionMeses`, verificados contra el Python (incluido el half-even: `1234.5 → 1.234`).

**Persistencia** — `emision.service.ts`: `generarEmision(projectId, periodo,
userId)` recalcula la serie, genera el PDF, lo guarda con `saveBufferAsAttachment`
como `FileAttachment` (`tipo: REPORTE_FOTOVOLTAICO`, `toolSource: "reporte-fv"`,
`toolVersion`, `toolEntityId`) y crea una `ReporteFvEmision` versionada con el
view-model como snapshot. Regenerar crea versión nueva (v1, v2, …).
`regenerarPdfDesdeSnapshot(emisionId)` reproduce el PDF desde el snapshot.

**Verificación visual contra los PDFs ya enviados** (3 escenarios, todos fieles):
- **Residencial** (Daniel Vanoli): las 4 páginas coinciden con el PDF Python.
- **Empresa** (BARENOF, zafral): 1 sola columna de tarifa, header condicional.
- **Potencia estimada** (Hotel LAMAS): la nota "se estimaron con 5,0 kW" aparece.

Dos diferencias respecto del PDF Python, ambas correctas:
1. **`irpf_acumulado` ahora aparece** (ej. $1.113) — el Python lo dejaba vacío
   por un bug (nunca lo pasaba al template).
2. Se corrigió un **bug del port en el motor** que el PDF destapó (el golden test
   no cubría el acumulado USD): el crédito por exportación usa lo exportado el
   mes anterior; si ese mes EXISTE como lectura pero con exportación vacía, el
   Python propaga NaN (ahorro del mes NaN, excluido del acumulado), mientras que
   el port lo tomaba como 0 y calculaba un ahorro espurio. Corregido en
   `serie.ts` (distinguir "no hay lectura previa"→0 de "hay lectura con export
   null"→NaN). Con el fix, el ROI de Vanoli pasó de 10% (erróneo) a 8% (= Python).
   Los 3 suites de tests siguen verdes.

Nuevo helper reusable: `computarSerieDeProyecto(config)` en `calculo.service.ts`
(calcula la serie sin persistir; lo usan el recálculo y la emisión).

Falta para exponerlo: endpoint de descarga/preview (Fase 6) y el disparo desde
el panel.

## Puesta al día (bitácora 31/07) ✅

El 31/07 Nicolás envió los reportes de junio 2026 con el sistema Python y en esa
sesión corrigió datos, actualizó precios y ajustó el cálculo
(`~/Dev/Reporte_Fotovoltaico/.../BITACORA_2026-07-31.md`). Se incorporó todo a
Voltia PM para que reproduzca exactamente lo que se envió:

- **Motor — hora punta por días hábiles.** UTE cobra la punta cara sólo de lunes
  a viernes; el fin de semana cae a fuera de punta (doble) o llano (triple/zafral).
  `fraccionDiasHabiles` en `periodo.ts` + `franjasHabiles` en `serie.ts`. La simple
  no cambia (va por tramos, no por franjas). Cubierto por `diasHabiles.test.ts`
  (la doble no tenía cliente en el golden) y por BARENOF (zafral) en el golden.
- **Pliego UTE 2026** cargado como cuadro "UTE 2026" (reemplaza "Legacy Excel"),
  vigente desde 2024-01-01 — los precios pre-2026 eran placeholders, nunca reales.
  El script de migración ahora es idempotente sobre el cuadro (lo actualiza por
  `vigenteDesde`, no crea duplicados).
- **Potencia contratada faltante → 5 kW estimado.** `config.service.ts` ya no la
  bloquea: se calcula con 5 kW, se marca `potenciaEstimada` y va como advertencia
  (el panel/envío lo tratan como "requiere confirmación"). Afecta a 8 generadores.
- **Cobertura de datos** en el schema: `diasConDatos` / `diasEsperados` en
  `ReporteFvLectura` (migración `20260801031941_reporte_fv_cobertura`, aditiva).
  Los llena la ingesta (Fase 4); null en las lecturas migradas.
- **Datos corregidos re-migrados**: Vanoli (cons 718,3 / exp 293 / pct_punta 18%),
  Tello, Henderson, Pons + potencias/inversiones de Cabrera y González. Verificado
  contra la base: Vanoli quedó exacto.

**Re-verificación (todo verde):**
- `test:reportes-fv-golden` → equivalencia con el Python actual **211 filas × 10
  campos sin diferencias**; histórico emitido **205 filas, 0 diferencias de fondo**
  (3 de redondeo < $0,10 por kWh imputados con 13 decimales). El histórico se
  reconstruyó de una corrida coherente, así que se **vaciaron las excepciones**
  que arrastraba el test.
- `test:reportes-fv` (11) + `test:reportes-fv-habiles` (3) pasan. tsc server+client en 0.
- La migración ahora vincula **44 generadores por `plant_id`** (antes por nombre).

**Nota para la ingesta (Fase 4)** — la bitácora resolvió el spike pendiente:
`meter_data` de Growatt **devuelve sólo el último día de un rango** → hay que
iterar día por día; usar `perpage=100` (devuelve 20 por página); rate limit
`error_code=10012`, pausa ~0,7s con backoff. Regla de cobertura: si <90% de los
días del mes reportaron, se descartan consumo y exportación (quedan null).

## Qué se hizo

### Fase 1 — Modelo de datos ✅

Migración `20260727233428_add_reportes_fv`. **100% aditiva**: 14 tablas nuevas y
`ADD VALUE` en dos enums. Ninguna operación destructiva, segura para producción.

Capas separadas a propósito (la planilla original mezclaba dato crudo con
resultado calculado y por eso no se podía recalcular nada):

| Capa | Tablas | Regenerable |
|---|---|---|
| Maestros | `ReporteFvConfig`, `ReporteFvDestinatario` | no |
| Tarifas | `TarifaUteVersion` + `Cargo`/`Tramo`/`Franja` | no, versionadas por vigencia |
| Crudo | `ReporteFvLectura` | no |
| Ingesta | `ReporteFvIngesta`, `ReporteFvIngestaItem` | — |
| Calculado | `ReporteFvCalculo`, `ReporteFvCalculoTarifa` | **sí, siempre** |
| Emitido | `ReporteFvEmision` (snapshot + PDF) | no, inmutable |
| Enviado | `ReporteFvEnvio` | no |
| Catálogo | `GrowattPlant` | — |

Decisiones que conviene no revertir sin leer el motivo en el schema:

- **`GrowattPlant.plantId` es la entidad canónica.** La planilla unía sus 4
  fuentes por nombre de persona y ya tenía ~17 vínculos rotos. El matching por
  nombre queda como sugerencia en la UI, nunca en runtime.
- **Fuente por campo en `ReporteFvLectura`** (`generacionFuente`,
  `consumoFuente`, `exportacionFuente`): un valor `MANUAL` no lo pisa Growatt.
  Históricamente el 63% de las lecturas llegó sin consumo/exportación.
- **`ReporteFvConfig` con campos nullable = "usar el del proyecto"**:
  `potenciaInstaladaKwp`→`capacityKwp`, `inversionUsd`→`budgetUsd`,
  `mesInicio`→`postHabilitacionInicioEn ?? actualUteEnd`, destinatarios vacíos →
  `clientEmail`. Sólo se persiste el override. Una sola fuente de verdad.
- **`origenDatos`** (`GROWATT` | `MANUAL`): los generadores de otras marcas, sin
  API, se cargan a mano. La ingesta los saltea y el panel los agrupa aparte.
- **Idempotencia del envío por claim transaccional** sobre
  `ReporteFvEmision.enviadoEn` (`updateMany` con `where enviadoEn: null`), no por
  índice único: los envíos fallidos tienen que poder reintentarse.

### Fase 2 — Motor de cálculo ✅

`server/src/services/reportesFv/motor/` — port literal de `src/metrics.py` y del
loop de `main.py`, todo puro (sin Prisma, sin I/O, sin fechas del sistema).

**Verificación en dos niveles, ambos pasando:**

1. `npm run test:reportes-fv-golden` → **equivalencia con el motor Python**.
   Se corrió `generar_historico.py` original con los datos de hoy y se comparó
   contra el port con los mismos inputs: **201 filas × 10 campos, 0 diferencias.**
2. El mismo comando → **golden contra el histórico emitido**: las 282 filas de
   `historico_clientes.xlsx`, o sea lo que los clientes vieron.
3. `npm run test:reportes-fv` → 11 unit tests de casos borde.

**Los dos bugs del port que costaron encontrar** (están comentados en el código;
no los "arregles"):

- **`min`/`max` de Python no propagan NaN, los de JS sí.** `min(0, nan)` en
  Python devuelve `0`; `Math.min(0, NaN)` devuelve `NaN`. De esa asimetría
  depende que el saldo de cuenta corriente arranque en 0 en los meses previos a
  la instalación (que vienen con consumo vacío) en vez de quedar NaN para
  siempre. Ver `pyMin`/`pyMax` en `metrics.ts`.
- **`round()` de Python es half-to-even sobre el valor decimal exacto.**
  `Math.round(x*100)/100` difiere en los empates. Ver `round2()`.

### Fase 3 — Tarifas UTE versionadas ✅

`server/src/services/reportesFv/tarifas/tarifas.service.ts` + rutas en
`reportes-fv.routes.ts` (bajo `CONFIGURACION`) + UI en **Admin → Configuración
del negocio → Tarifas UTE** (`client/src/components/admin/TabTarifasUte.tsx`).

Ciclo: se crea un BORRADOR (normalmente duplicando el vigente), se edita, y al
PUBLICAR queda inmutable y cierra la vigencia del anterior. Un borrador nunca
resuelve vigencia, así que se puede preparar el cuadro nuevo sin afectar los
cálculos en curso. `validarCuadroCompleto()` chequea al publicar que los tramos
de la simple no tengan huecos ni solapes.

### Fase 9 — Migración de datos legacy ✅ (aplicada en local)

`server/scripts/reportes-fv/import-legacy-excel.ts`. **Dry-run por default**;
`--commit` aplica y `--crear-faltantes` da de alta los generadores sin proyecto.
Idempotente: se puede volver a correr.

Estado resultante en la base local:

```
Cuadros tarifarios     1  ("Legacy Excel", publicado, vigente desde 2024-01-01)
Plantas Growatt      148  (44 vinculadas a un proyecto)
Configuraciones       55  (35 con reporte activo, 11 de carga manual)
Destinatarios         40
Lecturas             645  (293 completas, 352 a completar a mano)
Periodos calculados  279  (2024-09 → 2026-06)
```

**Verificación contra el histórico emitido: 259 filas comparadas, 8 diferencias**
— exactamente las mismas que ya estaban documentadas en el golden test. Más 2 de
redondeo por debajo de $0,10 (la planilla tenía kWh imputados con 13 decimales;
la base los guarda con 2, que es la precisión real de un medidor).

**Falsos positivos de matching que atrapó el dry-run** (por eso el dry-run):

- `Antonio Costa Vital` → `Alicia Grunwald`: compartían el mail pero el nombre no
  se parecía en nada. Regla nueva: el match por email exige además que los
  nombres compartan un token de ≥4 letras. El usuario confirmó que **sí** es el
  mismo suministro, así que quedó como alias explícito.
- `Fernando` → `Fernando Ciaran`: `Fernando` tiene inversión, potencia y fecha
  **idénticas a `Raij`** — es una fila duplicada de la planilla, no el proyecto de
  Fernando Ciaran (6,38 kWp vs 4,25). Regla nueva: el match por prefijo exige 2
  tokens. Quedó en `DESCARTAR` con su motivo.

**Bloqueos vs advertencias** (`config.service.ts`): sólo impide CALCULAR lo que
haría salir mal los números (potencia contratada, franjas que no suman 100%,
empresa sin tarifa). Faltar el mail impide ENVIAR pero no calcular; faltar la
inversión sólo degrada la sección de retorno. Antes estaba todo junto y dejaba
19 generadores sin calcular; ahora son 11, todos por la misma causa.

**Lo que falta cargar a mano** (lo va a mostrar el panel de la Fase 6):

- **11 generadores sin potencia contratada a UTE** → no se pueden calcular:
  Daniel Cabrera, Martín González, Hotel LAMAS 1 y 2, Gonzalo Gil, Carlos Barba,
  German Fernandez, Rafael Figueroa, Alejandro Ramirez, José Percovich, Roberto
  Mezquita.
- **6 sin destinatario** → se calculan pero no se les puede enviar: Alberto Mora,
  Robert de Souza, Susana Guerrico, Edgar Valdés, Diego Trias, Daniel Trias.
- **2 sin monto invertido** → el reporte sale sin retorno de la inversión:
  Santiago Riverol, Sebastián de Rienzo.
- **352 lecturas incompletas** (falta consumo y/o exportación).

## Hallazgos sobre los datos (importantes para la migración)

1. **El histórico Excel es la única copia de 134 valores de consumo/exportación**
   que ya no están en la hoja `datos`. Se cargaban a mano cuando el smart meter
   fallaba, se emitía el reporte, y una corrida posterior de Growatt los volvía a
   dejar vacíos. **La migración tiene que importar lecturas desde
   `historico_clientes.xlsx` además de `datos`.**
2. **El histórico no es internamente consistente.** Se armó con una corrida por
   mes y cada fila quedó calculada con el estado que tenía la planilla en SU
   momento. Por eso hay filas que no se pueden reproducir con los datos actuales:
   están listadas una por una en `serie.golden.test.ts` (`EXCEPCIONES` y
   `DESVIO_SALDO_DESDE`, 8 clientes, todo el desvío es del saldo acumulado — los
   campos de energía y ahorro coinciden).
3. **Las columnas de saldo del histórico están normalizadas por `storage.py`**,
   que las recalculaba desde cero ignorando los meses omitidos. No son las que
   produjo el cálculo. El test aplica la misma normalización para comparar.
4. La fila `Antonio Costa Vital 2026-03` del histórico está corrupta (todo NaN
   salvo generación).

## Qué falta

| Fase | Estado |
|---|---|
| 8 — Crons mensuales | pendiente |

Con 1, 2, 3, 5, 6, 7 y 9 hechas, el ciclo manual está completo: dar de alta,
cargar datos, calcular, generar PDF, **enviar al cliente** y que lo **vea en el
portal**. Falta automatizar la ingesta (Growatt) y el cron mensual.

**Pendiente de deploy a prod**: correr `seed-reportes-fv-permissions.ts` (permiso
COMPLETE) tras el próximo deploy, y las migraciones `add_reportes_fv` +
`reporte_fv_cobertura`. Setear env `GROWATT_API_TOKEN` y (opcional)
`REPORTES_FV_BCC` en `docker-compose.prod.yml`.

Con las fases 1, 2, 3, 5 y 9 hechas ya hay **datos reales calculados y PDFs
generables** desde la base. Falta el panel (disparar/ver desde la UI), la
ingesta automática de Growatt, el envío y los crons.

### Pendientes concretos

- **Ingesta multi-marca (Fase 4 y más allá): Huawei y Fronius.** Hay clientes con
  inversores Huawei y Fronius, además de los Growatt. La ingesta hay que
  diseñarla con la marca como estrategia intercambiable (una interfaz de
  "proveedor de generación" por marca), no acoplada a Growatt. El modelo ya lo
  contempla en parte: `ReporteFvConfig.origenDatos` (hoy GROWATT | MANUAL) se
  extiende a HUAWEI | FRONIUS, y `SolarSystem.inverterBrand` ya tiene la marca.
  El plant/planta-id por marca vive hoy en `growattPlantId` (BigInt); al agregar
  marcas conviene un identificador de monitoreo genérico (string) o una tabla de
  vínculo por proveedor. Growatt primero; Huawei/Fronius después, reusando el
  mismo pipeline de cobertura/lecturas/cálculo.
- **Growatt — spike ya resuelto por la bitácora del 31/07**: `meter_data` NO
  acepta rango (devuelve solo el último día) → iterar día por día, `perpage=100`,
  pausa ~0,7s, backoff en `error_code=10012`. Regla de cobertura: <90% de días →
  se descartan consumo/exportación del mes.
- **Precios UTE** (RESUELTO 1/8): se cargó el pliego 2026 real como cuadro "UTE
  2026". Ya no son placeholders.
- **Nombres ambiguos** (RESUELTO): `fernando` descartado (duplicado de Raij),
  `antonio costa vital`→`alicia grunwald` y `suarez-dalmas`→`alejandro dalmas`
  confirmados por el usuario. `Fernando` queda descartado en `matching.ts`.
- `sendEmail()` **no soporta adjuntos**: hay que extenderlo con `attachments` y
  `bcc` (~6 líneas, sin tocar el guardrail `client_facing`). Pendiente Fase 7.
- `EmailLog.sentById` es obligatorio con `onDelete: Restrict` — no hay usuario de
  sistema. Es otra razón por la que el envío arranca con aprobación humana.

## Entornos

- **Emails en local**: `DEV_EMAIL_REDIRECT_TO` ya viene con default
  `nfmj@hotmail.com` en `docker-compose.yml`. Todo mail (to/cc/bcc) se redirige
  ahí con un banner rojo de "correo de prueba". En producción se ignora aunque
  esté seteada.
- **Growatt en local**: apunta a la API real, igual que en producción. Token por
  `GROWATT_API_TOKEN`, sin default en el código (en el script original estaba
  hardcodeado, igual que `SMTP_PASSWORD="Voltia123"` — no migrar ninguno).

## Cómo regenerar los fixtures

Los dos fixtures de `motor/__fixtures__/` se generan desde las planillas del
proyecto Python. El script vive fuera del repo (se corrió una sola vez); si hace
falta rehacerlos, están documentados en este archivo y el procedimiento fue:

1. `golden-historico.json` — mergea `historico_clientes.xlsx` (esperado + los
   134 valores rescatados) con `datos_clientes.xlsx` (lecturas) y
   `tarifas.xlsx` (cuadro embebido).
2. `verificacion-port.json` — corre `generar_historico.py` sobre una COPIA del
   proyecto Python con los datos actuales y usa esa salida como esperado, con las
   lecturas sólo de `datos`.
