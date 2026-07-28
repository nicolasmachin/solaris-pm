# Estado — Reportes fotovoltaicos mensuales

Migración del sistema Python standalone (`~/Dev/Reporte_Fotovoltaico`) a Voltia PM.
Última actualización: **28 de julio de 2026, 00:15**.

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
| 5 — PDF (port del template Jinja) | pendiente |
| 4 — Ingesta Growatt (+ spike de rango) | pendiente |
| 6 — API + panel y dashboard en Experiencia Solar | pendiente |
| 7 — Envío por email + portal del cliente | pendiente |
| 8 — Crons mensuales | pendiente |

Con las fases 1, 2, 3 y 9 hechas ya hay **datos reales calculados en la base**:
falta la cara visible (PDF y panel) y la ingesta automática.

### Pendientes concretos

- **Spike Growatt (media jornada, antes de escribir la ingesta):** el script
  original pide `meter_data` día por día (~30 requests/planta/mes), pero el
  endpoint recibe `start_date` y `end_date`. Si acepta rango mensual, el costo
  baja de ~1.500 a ~150 requests/mes.
- **Precios reales de UTE** para las tarifas simple (hoy 5/8/11) y doble (12/6):
  son placeholders. Se migran tal cual para no desalinear el histórico y se
  corrigen después desde la UI de admin, con vigencia nueva.
- **2 nombres ambiguos** a resolver al revisar el dry-run de la migración:
  `suarez - dalmas` (¿Alejandro o Sofía Dalmas?) y `fernando` (parece gemelo de
  `raij`: misma inversión, misma fecha, misma potencia).
- **7 clientes sin proyecto en Voltia PM** se crean como generadores livianos
  (`importedFromCsv`).
- `sendEmail()` **no soporta adjuntos**: hay que extenderlo con `attachments` y
  `bcc` (~6 líneas, sin tocar el guardrail `client_facing`).
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
