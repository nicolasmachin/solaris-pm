# Lector del banco + conciliación diaria — estado al 20-oct-2026 21:00

Handoff de la sesión que armó el robot de eBROU y la comparación banco ↔ Voltia PM,
para unificar con la sesión de Biller / conciliación de facturas.

## Lo pedido por Nicolás (20-oct)

- Un robot entra todos los días a una hora fija a eBROU Empresas, lee los movimientos
  y los compara con los de Voltia PM. En Movimientos, un cuadro con lo que falta cargar.
- Margen para considerarlo el mismo movimiento: **USD 5** en la cuenta en dólares,
  **$10** en la de pesos. La cuenta "BROU Pesos" está cargada **en pesos** en Voltia PM
  (11 movimientos en prod, con tipo de cambio guardado), así que se compara pesos con
  pesos, sin convertir.
- Modelo de tres puntas: **factura ↔ movimiento de Voltia PM ↔ movimiento del banco**.
  Todo movimiento del banco tiene que tener su movimiento en Voltia PM (factura puede
  no haber: un servicio que no está a nombre de la empresa). La factura se une al
  banco *a través* del movimiento de Voltia PM. Re-chequeo regular (pidió cada 30 min).
- Una sección "Movimientos del banco" como registro, igual que el de facturas.
- Después: todos los bancos, no solo el BROU.

## Hecho (en el repo, verificado en local por API)

- **Schema** (migración `*_lector_banco_movimientos`, aditiva):
  - `Account.numeroCuentaBanco` (único), `bancoLeidoEn` y `bancoSaldo`.
  - Modelo `BankMovement` (`bank_movements`) con `claveUnica` sha256 para no repetir
    al releer: cuenta+fecha+descripción+documento+tipo+monto+ordinal entre iguales del día.
  - Campos `ignoradoAt`, `ignoradoMotivo` e `ignoradoPorId` para el "No va".
  - Valor `bank_movement` en `AuditEntityType`.
- **Servicio** `server/src/services/finance/bank-reconciliation.service.ts`:
  - `registrarLectura()` guarda los movimientos que manda el robot.
  - `emparejar()` arma parejas una a una por mismo sentido, |monto| ≤ margen y fecha a 3 días o menos.
    Del lado de Voltia PM toma lo mismo que `computeAccountBalance`: ingresos cobrados,
    gastos pagados sin Payment, y los Payments.
  - `pendientesPorCuenta()` devuelve lo que falta cargar.
  - `registroBanco()` devuelve todo lo leído, con estado COINCIDE / FALTA_CARGAR / NO_VA / NO_SE_COMPARA y la pareja.
  - **La pareja no se guarda, se recalcula en cada consulta**: lo que se carga o borra
    se refleja al instante, así que el "cada 30 min" del lado banco se cumple solo.
    Si la otra sesión necesita guardar el vínculo (por ejemplo, para la factura), hay que decidir
    si se persiste. Hoy no hay ningún id de banco en `FinanceMovement`.
  - `CONCILIAR_DESDE` = 2026-10-01 (env `BANCO_CONCILIAR_DESDE`).
- **Rutas** `server/src/routes/conciliacion-banco.routes.ts`:
  - `POST /api/banco/lectura`: la usa el robot, con `Authorization: Bearer BANCO_LECTOR_TOKEN`.
    Sin la variable responde 404.
  - `GET /api/finance/banco/pendientes` (FINANZAS:VIEW).
  - `GET /api/finance/banco/movimientos?accountId&desde&hasta` (FINANZAS:VIEW), el registro.
  - `POST /api/finance/banco/movimientos/:id/no-va` {motivo} y `/deshacer-no-va` (FINANZAS:EDIT), con auditoría.
- `BANCO_LECTOR_TOKEN` está en los dos compose y en `.env` local.
- **Frontend**:
  - `FaltaCargarBanco.tsx` arriba de la tabla de Movimientos: por cuenta muestra la última lectura, el saldo del banco y cuántos coinciden.
    "Cargar" abre `NewMovementModal` con tipo, cuenta, fecha, descripción y monto ya completados; "No va" pide motivo.
  - En Admin → Cuentas, campo "Número de cuenta en el banco".
  - Cliente de API en `client/src/api/bancoConciliacion.api.ts`.
- tsc server 0 y client 0. No se probó la UI en el navegador.

## Falta

1. **Pantalla del registro** "Movimientos del banco": el endpoint `GET /finance/banco/movimientos` existe, falta la pestaña.
   Habría que incluir "deshacer No va".
2. **Robot que lee los movimientos** (`~/Dev/lector-banco`):
   - Hoy entra, despliega Cuentas, entra a la cuenta y ve la tabla de movimientos.
   - Falta paginar o filtrar por fecha ("Más filtros") los últimos 7 días, parsear (fecha, descripción, documento, dependencia, débito, crédito) y mandarlo a `/api/banco/lectura`.
   - Los números de cuenta son `110875272-00001` ($) y `-00002` (U$S).
3. **Programación**: por defecto, 8:00 y 18:00 de lunes a viernes, entrar → leer → salir.
   El banco corta la sesión a ~5 min sin actividad; Nicolás pidió no salir, pero se le explicó que para mantenerla habría que tocar algo cada 4 min día y noche, y eso es más raro.
   Falta decidir dónde corre: dev VPS o prod. Hoy las claves están solo en la dev VPS.
4. Unir con facturas de la otra sesión.
5. CHANGELOG, manual técnico (`08-finanzas.md`) y manual de Finanzas: no se tocaron todavía.
6. Deploy: migración aditiva, `BANCO_LECTOR_TOKEN` en el `.env` de prod y cargar `numeroCuentaBanco` en las dos cuentas BROU de prod.

## Robot (`~/Dev/lector-banco`, fuera del repo)

- Claves en `~/.config/voltia-banco/brou-empresa.env` (600): `BROU_EMPRESA_TIPO_DOCUMENTO` = "Otros Casos", `BROU_EMPRESA_NUMERO_DOCUMENTO` y `BROU_EMPRESA_CLAVE`.
  La URL y el token de Voltia PM están en `voltia-pm.env`.
- El operador "Voltia Machin" es de solo consulta. Menú Consultar: Cuentas y Operaciones realizadas.
  Tiene además el menú "Administrar", que no se revisó.
- eBROU rechaza el navegador headless por user agent: hay que usar el UA de Chrome de escritorio.
- `ingresar.mjs` hace un solo intento de ingreso y frena si cambia el formulario. Cierra la sesión con el botón de salir.
  `sesion.mjs` deja una sesión abierta con CDP en 127.0.0.1:9333; `explorar.mjs` se conecta a esa sesión.
