# Facturación electrónica con Biller — estado de la prueba

Handoff original (decisión de proveedor, costos, objetivo): `handoff-original.md`.
Documentación oficial bajada el 30-sep-2026: `openapi-biller.yaml`
(fuente: https://biller-labs.github.io/api-docs/openapi.yaml). **Manda sobre el handoff.**
Guía técnica para integradores (preguntas y respuestas, 22 págs.): `guia-tecnica-integradores.pdf`
(fuente: https://l.biller.uy/assets/guia-tecnica-integradores.pdf). biller.uy/api/documentacion
redirige a la misma documentación de biller-labs.

## Qué cambia respecto del handoff (que estaba armado sobre la v2 de Postman)

| Tema | Handoff (v2) | Documentación nueva |
|---|---|---|
| Emitir | `POST /v2/comprobantes/crear` | `POST /v3/comprobantes/emitir` (la v2 ya no figura). Misma forma de body, respuesta `{id, serie, numero, hash}` |
| URL de producción | `www.biller.uy` | `https://biller.uy` |
| Webhooks | "falta confirmar" | **No existen.** El estado se consulta con polling |
| Idempotency key | "falta confirmar" | **No existe** (revisados el OpenAPI, la página comercial y la guía técnica). La guía le pasa el problema al integrador: "evitar emitir dos veces la misma operación". `numero_interno` "debería ser único" pero nada dice que Biller rechace uno repetido → lo prueba el paso C del script |
| Consultar un comprobante | `GET /v2/comprobantes/obtener?id=` | Mejor `GET /v3/comprobantes/detalle?id=`: trae `estado`, CAE, ítems, `tasa_cambio` y `referencias` / `referenciado_por` (NC, recibos asociados) |
| Fechas en recibos | dd/mm/aaaa o aaaa-mm-dd (dudoso) | **aaaa-mm-dd** en `fecha_emision`, `fecha_vencimiento` y `pago.fecha`. En facturas sigue siendo dd/mm/aaaa |
| `tasa_cambio` en recibos | opcional | **Obligatoria si la moneda no es UYU.** Voltia factura en USD → hay que mandarla (el script usa la de la factura) |
| Anular | `fecha_emision_hoy` 1/0 | Booleano; se puede cambiar la sucursal emisora de la NC |
| Pagos sin recibo | — | Nuevo `POST /v2/pagos/crear`: registra un pago contra comprobantes **sin emitir un CFE de cobranza**. Monto = suma exacta; admite negativos para revertir |
| Mails del PDF | se manda solo | `GET/POST /v3/comprobantes/notificaciones/…`: ver si se envió y reenviar (hasta 10 mails; solo con la empresa ya habilitada) |
| Datos del cliente | — | Servicios DGI por RUT (`/v2/dgi/empresas/nombre-entidad`, `datos-entidad`, `certificado-unico`): autocompletar razón social y domicilio fiscal |

## Cosas del negocio que salen de la documentación

- **e-Ticket a consumidor final por encima de 5.000 UI exige receptor** (error 422
  "Debe especificar receptor por ser mayor a 5000 UI"). Toda instalación supera ese
  tope, así que a las personas físicas hay que facturarles siempre con CI y dirección.
- `razon_social` es el nombre para RUT; `nombre_fantasia` (máx. 30 caracteres) para CI.
  Nombres largos de personas se cortan a 30.
- `concepto` máx. 80 caracteres por ítem; `descripcion` admite texto más largo.
- Sin `tasa_cambio` en la factura, Biller toma el cierre del día anterior a la fecha de emisión.

## Lo que agrega la guía técnica

- **La emisión no confirma la aceptación de DGI.** El 201 dice que Biller firmó, guardó y
  mandó el CFE; DGI acepta o rechaza después. El estado intermedio se llama
  "Esperando aceptación"; cualquier otro es final. Sin webhooks: consultar por `id`.
- Emisión + PDF: en condiciones normales menos de 5 segundos entre los dos.
- **Sin contingencia por API** y sin emisión offline: si Biller o la red caen, se encola
  y se reintenta. La guía recomienda guardar localmente, encolar, reintentar, registrar el
  `id` devuelto y evitar la doble emisión.
- Devolución parcial = nota de crédito 112 con solo lo devuelto, por `/v3/comprobantes/emitir`.
  `/v2/comprobantes/anular` es solo para anulación total.
- Revertir un pago: montos negativos en `pagos/crear` (la guía misma marca la respuesta
  como "pendiente de unificación"). Recibos: `recibos/cancelar`.
- Para que Biller **no** mande el PDF por mail: no mandar `emails_notificacion` ni
  `cliente.sucursal.emails`, y que la sucursal del cliente no tenga mails guardados de antes.
- En test hay un generador de RUT de prueba. Serie y número los asigna siempre Biller.
- PDF propio: posible si cumple DGI. Código de seguridad = primeros 6 caracteres del `hash`;
  QR = `https://www.efactura.dgi.gub.uy/consultaQR/cfe?{RUT},{TIPO},{SERIE},{NUMERO},{TOTAL},{FECHA},{HASH}`.

## Cómo evitar la doble emisión del lado de Voltia PM

Como Biller no la garantiza, la integración tiene que hacerlo sola:

1. Antes de llamar a Biller, crear la factura en Voltia PM en estado `EMITIENDO`, con un
   `numero_interno` propio y único (restricción `@unique` en la base).
2. Llamar a emitir. Si vuelve el `id`, guardarlo y pasar a `ESPERANDO_DGI`.
3. Si el llamado se corta (timeout, 5xx, caída de red) **no reintentar a ciegas**: buscar
   primero con `GET /v2/comprobantes/obtener?numero_interno=…`. Si existe, adoptar ese `id`;
   si no, recién ahí reintentar.
4. Un solo emisor a la vez (cola con 1 pedido por segundo), así no hay dos intentos en paralelo.

**Confirmado en test (30-sep):** Biller rechaza un `numero_interno` repetido con 422
`"Número interno no puede estar repetido"` y no crea un segundo comprobante. Es una red de
seguridad real: ante un reintento dudoso, un 422 por ese motivo significa "ya se emitió",
y se adopta el `id` buscándolo por `numero_interno`.

## Resultado de la primera corrida (30-sep-2026, empresa de test "DGI RUC PRUEBA CEDE", sucursal 889)

| Paso | Resultado |
|---|---|
| A) e-Factura crédito fechada 20/09 | 201, MF-640358, total USD 1.220, tasa 40,142 tomada sola del cierre anterior |
| B) e-Factura contado fechada 25/09 | 201, MF-640359, tasa 40,214 |
| C) mismo `numero_interno` que A | **422 "Número interno no puede estar repetido"**; sigue habiendo 1 solo |
| D) recibos 488 + 732 sobre A | 201 los dos (MF-640360/61). Fechas aaaa-mm-dd y `tasa_cambio` aceptadas. `detalle` de A los lista en `referenciado_por` |
| E) NC parcial 200 + IVA sobre B | 201, **serie A**-197354 (otra serie que las facturas), total 244 |
| F) PDF | OK, base64 → PDF válido con CAE, código de seguridad y adenda |
| G) notificaciones | `[]` (no se mandaron mails, como se esperaba) |

Observaciones:
- **DGI sí responde en test.** Al terminar la corrida los 5 estaban en "Pendiente DGI" (después
  de 60 s de consultar); un rato más tarde estaban los 5 en **"Aceptado DGI"**, incluidos
  recibos y NC. Nombres reales de estado: "Pendiente DGI" → "Aceptado DGI" (la guía dice
  "Esperando aceptación", no es lo que devuelve). Hay que suponer minutos, no segundos:
  el polling de Voltia PM tiene que ser en segundo plano (job), no esperando en el pedido.
  Falta ver cómo se llama un rechazo.
- **Los recibos son CFE tipo 111** de la misma serie que las facturas, marcados con
  `indicador_cobranza_propia = 1`. Consumen numeración y cuentan en el cupo mensual.
- El recibo se emitió con la tasa de la factura (40,142). Si contablemente corresponde la del
  día del cobro, hay que mandar esa: pregunta para el contador.
- El PDF de test muestra el RUT real de Voltia (221075240012) con la razón social de prueba.
- Detalle crudo de cada llamado: `biller_salida_<ts>.json` (no versionado).
- En el Mac, el Python de python.org no trae los certificados: correr con
  `SSL_CERT_FILE=/etc/ssl/cert.pem`.

## Respuesta de Biller (Mateo, contacto@biller.uy, 30-sep-2026)

Confirmó que **es el comportamiento esperado**:

1. **Los recibos son Comprobantes de Cobranza y siguen la numeración del tipo de
   comprobante al que se asocian.** Un recibo de una e-Factura usa la secuencia de
   e-Factura: por eso salieron MF-640360/61 después de la MF-640358. No es un registro
   interno de pago: se emite el comprobante de cobranza.
2. **Cuentan en el cupo mensual.** Una factura + dos recibos parciales = 3 comprobantes;
   si además se documenta una seña, suma otro. Pasados los 1.000 del Plan Grande, cada
   bloque de 1.000 cuesta $99 + IVA. (Voltia emite 20-30 por mes, así que no es problema.)
3. **Un recibo no se anula con nota de crédito**, se cancela con `recibos/cancelar`, y la
   cancelación es **total**: no hay cancelación parcial. Son dos flujos distintos:
   factura mal emitida → NC; recibo mal emitido → cancelación del recibo.

Ofreció seguir respondiendo dudas a medida que avance la integración.

Quedan abiertas, para el contador o para probar: tasa de cambio del recibo (la de la factura
o la del cobro), `recibos/crear` vs `pagos/crear`, y cómo se llama el estado de un rechazo DGI.

## Regla de diseño: nada fiscal se emite sin confirmación (decidido 30-sep-2026)

Vale para **todo lo que llegue a DGI**, no solo los recibos: facturas, notas de crédito,
notas de débito, recibos y anulaciones.

- Antes de cada emisión, Voltia PM arma un **borrador** con los datos exactos que va a
  mandar (cliente, ítems, moneda, tasa, fecha, referencias), lo muestra y **espera el OK
  explícito** de una persona. Recién ahí llama a Biller.
- **Ningún job, cambio de etapa ni automatismo emite por su cuenta.** Un automatismo puede
  dejar el borrador armado y avisar, nunca emitir.
- Lo mismo para las herramientas del MCP: arman el borrador, lo muestran y piden
  confirmación (ya estaba en el handoff original, ahora aplica a todos los comprobantes).
- El motivo: lo emitido no se edita. Una factura mal emitida se corrige con una nota de
  crédito y un recibo mal emitido se cancela entero; en los dos casos queda el error
  registrado ante DGI y consume comprobantes del cupo. Es más barato confirmar antes.

## Decisión pendiente: recibo (CFE) o pago (registro)

Para registrar cobros hay dos caminos: `recibos/crear` emite un comprobante de
cobranza (queda ante DGI y le llega al cliente por mail) y `pagos/crear` solo marca
la factura como pagada dentro de Biller. Es una decisión contable, para ver con el
contador. El script prueba el recibo, que era lo del handoff.

## Cómo correr la prueba

1. Crear usuario y empresa de prueba en https://test.biller.uy, tomar el ID de sucursal
   (Ajustes / Sucursales) y generar el token en https://test.biller.uy/api/tokens.
2. Agregar al `.env` de la raíz: `BILLER_TOKEN=…` y `BILLER_SUCURSAL=…`.
3. `set -a; source .env; set +a; python3 docs/pendientes/facturacion-biller/prueba_biller.py`

El script se niega a correr contra producción. Deja `biller_salida_<ts>.json` y el PDF
al lado (ignorados en git).
