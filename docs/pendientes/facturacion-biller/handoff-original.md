# Integración de facturación electrónica Biller → Voltia PM

## Objetivo
Emitir CFE desde Voltia PM (botón "Facturar" en la ficha de obra/cliente y registro de cobros) y desde Claude vía el MCP de Voltia PM. Biller es solo el motor fiscal. La gestión, las cuentas corrientes y los cobros viven en Voltia PM.

Regla para el MCP: la herramienta de emitir arma primero un borrador, lo muestra y pide confirmación antes de mandar nada a Biller.

## Proveedor elegido: Biller (Chokora SRL)
- Plan Grande: $1.310 + IVA por mes. Incluye API, 1.000 comprobantes por mes y bloques extra de 1.000 a $99 + IVA. Integración sin costo. Posible beneficio fiscal DGI de hasta 80 UI por mes.
- Volumen de Voltia: 20 a 30 comprobantes por mes.
- Contacto: soporte@biller.uy · 2626 0591 · L-V 9-20, sáb 14-19.
- Descartados: Fixed (sin recibos por API, notas de crédito solo totales) y GNS+ de Rafael Sánchez (sin API hecha, US$ 65 + IVA de conexión más un mensual todavía sin cotizar).

## Documentación
- Nueva: https://biller-labs.github.io/api-docs/#description/introduction (página dinámica; menciona idempotencia y webhooks, falta confirmar el detalle y buscar el OpenAPI).
- Anterior (v2, Postman): https://documenter.getpostman.com/view/16327979/UUy1eSan
- Comercial: https://l.biller.uy/api/
- Test: https://test.biller.uy (cuenta separada de producción)

**Primer paso en Claude Code:** leer la documentación nueva y bajar su OpenAPI. Si hay diferencias con lo que sigue (tomado de la v2), manda la nueva.

## API v2 (según la documentación de Postman)
- URL: `https://{test|www}.biller.uy/v2/...`
- Autenticación: `Authorization: Bearer <token>`. El token es por empresa y se genera en `{ambiente}.biller.uy/api/tokens`. Test y producción son cuentas separadas; test emite contra homologación de DGI.
- Límites: 1 pedido por segundo al emitir o consultar DGI, 30 por segundo el resto. Error 429 si se pasa.
- Errores: 400, 403, 404, 422 (datos inválidos), 429, 500.

### Emitir comprobante: `POST /v2/comprobantes/crear`
- `tipo_comprobante`: 101 e-Ticket, 102 NC e-Ticket, 103 ND e-Ticket, 111 e-Factura, 112 NC e-Factura, 113 ND e-Factura.
- `forma_pago`: 1 contado, 2 crédito.
- `fecha_emision` en formato dd/mm/aaaa: mínimo 01/10/2011, máximo dos meses a futuro. Esto cubre la facturación con fecha anterior.
- `fecha_vencimiento` en formato dd/mm/aaaa.
- `sucursal`: ID de sucursal (Ajustes > Sucursales).
- `moneda` (UYU, USD…). `tasa_cambio` es opcional; si no se manda, toma la del cierre anterior a la fecha de emisión.
- `montos_brutos`: 1 si los precios incluyen IVA, 0 si no.
- `numero_interno`: string único. Usarlo con el ID de obra de Voltia PM para evitar duplicados.
- `cliente`: `tipo_documento` (2 RUT, 3 CI, 4 otro, 5 pasaporte, 6 DNI), `documento`, `razon_social` o `nombre_fantasia`, y `sucursal` con dirección, ciudad, departamento, país y `emails`. Para consumidor final sin datos va `"-"`.
- `items[]`: `codigo`, `cantidad`, `concepto` (hasta 80 caracteres), `precio`, `indicador_facturacion` (1 exento, 2 tasa mínima, 3 tasa básica), descuento o recargo opcional.
- `adenda`, `emails_notificacion[]` (el PDF se envía solo por mail).
- Notas de crédito o débito: `referencias: [idBiller]` o `[{tipo, serie, numero}]`. Los ítems que se mandan definen el monto, así que pueden ser parciales.
- Respuesta: `{id, serie, numero, hash}`.

### Anular: `POST /v2/comprobantes/anular`
Genera una nota de crédito por el total. Recibe `id` (o tipo, serie y número) y `fecha_emision_hoy` (1 hoy, 0 la fecha del original). Solo sirve si el comprobante no tiene otros asociados.

### Recibos: `POST /v2/recibos/crear`
- Pueden ser parciales o totales, cubrir varias facturas o ninguna (en ese caso son un adelanto).
- `referencias: [{padre: idFactura, total}]` y `pago: {fecha, monto, referencia}`. El `monto` tiene que ser mayor o igual a la suma de los totales; el sobrante queda como adelanto.
- Llevan además `tipo_comprobante`, `sucursal`, `moneda` y `cliente`, igual que la factura.
- Ojo: la documentación dice fecha dd/mm/aaaa pero el ejemplo usa aaaa-mm-dd. Probar ambos.
- Cancelar: `POST /v2/recibos/cancelar?id=`.

### Consultar: `GET /v2/comprobantes/obtener`
- Parámetros: `id`, `sucursal`, `desde`/`hasta` (aaaa-mm-dd hh:mm:ss), `tipo_comprobante`+`serie`+`numero`, `numero_interno`, `recibidos`.
- Devuelve `estado` ("Aceptado DGI", "Pendiente DGI"…), totales, fechas, CAE, y los ítems cuando se consulta por `id`.
- Los recibos se identifican con `indicador_cobranza_propia = 1`.
- Si no se manda `id` ni `desde`, toma desde hoy a las 00:00.

### Otros
- PDF: `GET /v2/comprobantes/pdf?id=` devuelve el PDF en base64. `template` opcional.
- `POST /v2/clientes/crear`, `POST /v2/productos/cargar`.

## Lo que falta en la v2 y cómo resolverlo del lado de Voltia PM
1. Sin webhooks: consultar el estado cada tanto hasta que quede aceptado. Confirmar si la documentación nueva los trae.
2. Sin idempotency key: antes de reintentar una emisión, buscar por `numero_interno`. Confirmar si la nueva la trae.
3. Límite de 1 pedido por segundo al emitir: usar una cola simple.

## Estado actual
- Alta en electrónica de VOLTIA SAS (RUT 221075240012) en curso en Biller, en el paso del certificado de firma digital. El certificado de la unipersonal (cargado en Memory) no sirve porque está atado a otro RUT; hay que generar uno nuevo para la SAS, preferentemente de 2 años.
- Falta la cuenta en test.biller.uy: empresa de prueba, ID de sucursal y token.
- Script de prueba listo en `prueba_biller.py`: emite una e-Factura a crédito con fecha de hace 10 días, consulta el estado, cuelga un recibo parcial y baja el PDF. Variables: `BILLER_TOKEN` y `BILLER_SUCURSAL`.

## Próximos pasos
1. Leer la documentación nueva y el OpenAPI, y ajustar el script si cambió algo.
2. Crear la cuenta de test y correr el script.
3. Criterios de aceptación: e-Factura contado y crédito con fecha anterior aceptadas; dos recibos parciales que dejen la factura cobrada; nota de crédito parcial; PDF descargado; pedido duplicado que no genere un segundo comprobante.
4. Integrar en Voltia PM: cliente de Biller, cola de emisión, polling de estado, botón Facturar, registro de cobros que genere el recibo y herramientas MCP con confirmación previa.
