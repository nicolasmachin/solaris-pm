# 17 · Recursos Humanos

## Para qué existe

Un **legajo por persona** del equipo, con dos miradas sobre los mismos datos:

- **Mi legajo**: cada persona ve y mantiene lo suyo. Carga sus datos (contacto,
  emergencia, mutualista, cuenta para el sueldo, talles) y sus documentos (carné
  de salud, licencia de conducir, cursos, constancias), y descarga sus recibos
  de sueldo.
- **Recursos Humanos** (gerencia y finanzas): el legajo completo de todos, con
  lo que solo ve la empresa (contrato, categoría, sueldo, notas internas), la
  validación de lo que carga cada uno, el tablero de vencimientos y la carga de
  recibos en lote.

El objetivo práctico es que nadie trabaje con el carné de salud vencido sin que
se sepa, y que pedir un papel no dependa de acordarse.

## Cómo se usa

- **Mi legajo** (`/mi-legajo`, menú del usuario): arriba, lo que falta y lo que
  vence; *Mis recibos*; *Mis documentos* con *Cargar documento* (tipo, archivo
  —foto del celular o PDF—, vencimiento); y *Mis datos*. Lo de la empresa
  (vínculo, ingreso, cargo, tipo de contrato) se ve pero no se edita.
- **Recursos Humanos** (`/rrhh`, menú del usuario): pestañas *Personas* (todos
  los internos con sus alertas), *Vencimientos* y *Cargar recibos* (se elige el
  mes y todos los PDF; a cada archivo se le asigna la persona, preseleccionada
  si el nombre del archivo la menciona).
- **Legajo de una persona** (`/rrhh/legajos/:userId`): datos de la empresa y
  personales (editables), todos los documentos con *Validar* / *Rechazar* (pide
  motivo) y *Subir documento*, con la opción *Solo administración*.

## Cómo funciona

### Modelo

| Tabla | Qué guarda |
|---|---|
| `legajos` | Uno por usuario (`userId` único). Vínculo (`DEPENDIENTE` / `TERCERIZADO`), datos personales y datos de la empresa |
| `legajo_documentos` | Tipo, título, período (recibos, `AAAA-MM`), vencimiento, estado (`PENDIENTE` / `VALIDADO` / `RECHAZADO`), motivo de rechazo, `soloInterno`, archivo, quién subió y validó, cuándo lo vio la persona (`vistoAt`), soft delete |

El legajo **se crea vacío la primera vez que se lo busca** (al entrar a Mi
legajo o al abrirlo desde RRHH). El vínculo inicial sale del rol:
`INSTALADOR_TERCERIZADO` → `TERCERIZADO`; el resto, `DEPENDIENTE`. Se corrige
desde el legajo.

Código: `services/rrhh/rrhh.service.ts`, `services/rrhh/vencimientos.job.ts`,
`routes/rrhh.routes.ts`, pantallas en `client/src/modules/rrhh/`.

### Quién carga qué

- **La persona** carga lo de `TIPOS_AUTOCARGA`: carné de salud, licencia,
  cédula, cursos (altura, primeros auxilios), habilitación eléctrica,
  antecedentes, constancia de domicilio, BPS, BSE y otros. Entra `PENDIENTE` y
  se avisa a quienes tienen `RRHH:EDIT` (`legajo_documento`). Puede borrarlo
  mientras no esté validado.
- **RRHH** carga cualquier tipo, también recibos, contratos, entrega de equipos
  de protección y amonestaciones. Entra `VALIDADO`. Si no es `soloInterno`, a la
  persona le llega un aviso ("Tu recibo de sueldo 2026-10").
- Al **rechazar** el motivo es obligatorio y le llega a la persona.

### Faltantes y vencimientos

`REQUERIDOS` define lo que tiene que estar en cada legajo: cédula y carné de
salud para todos; además BPS, BSE y curso de altura para los tercerizados. **De
cada tipo cuenta el documento más nuevo** (no rechazado): un carné viejo vencido
que ya se reemplazó no alarma. *Por vencer* = 30 días o menos
(`DIAS_AVISO_VENCIMIENTO`).

El job diario (`startVencimientosLegajoJob`, 07:00, `CRON_VENCIMIENTOS_LEGAJO`)
avisa a la persona y a quienes gestionan RRHH dos veces por documento: al entrar
en los 30 días y al vencer (`legajo_vencimiento`, con `uniqueKey` por documento,
hito y destinatario). No avisa por gente con fecha de egreso.

### Licencias

`services/rrhh/licencias.service.ts`. Solo para el vínculo `DEPENDIENTE`.

| Tabla | Qué guarda |
|---|---|
| `licencia_contingentes` | Días de licencia anual generados por año (`anio` = el año en que se generan; se gozan al siguiente). Uno por persona y año. Los carga RRHH |
| `licencias` | Tipo, desde, hasta, **días que cuenta**, nota, estado (`SOLICITADA`, `APROBADA`, `RECHAZADA`, `CANCELADA`), quién pidió y quién resolvió |

**Saldo** (`calcularSaldo()`): generados = suma de contingentes; tomados =
licencias `ANUAL` aprobadas; pedidos = `ANUAL` sin responder; **disponibles =
generados − tomados − pedidos**. Lo pedido se descuenta enseguida, para que no
se pida dos veces lo mismo. Las demás licencias (enfermedad, estudio, duelo…)
no descuentan: quedan registradas.

**Días.** Al pedir, se cuentan solos de lunes a viernes sin feriados
(`contarDiasHabiles()`, con `esFeriado()` de `utils/business-days.ts`, que
incluye Carnaval y Turismo porque Voltia no trabaja esos días). La persona no
elige el número; RRHH lo puede corregir al aprobar o después. **Cómo se cuentan
legalmente los días de licencia no está verificado**: el número que manda es el
que confirma administración.

**Contingente sugerido** (`contingenteSugerido()`): 20 días por año; si entró
ese año, proporcional a los meses; desde el 5.º año de antigüedad, un día más
cada 4 años (5 → 21, 9 → 22, 13 → 23). Es una ayuda para cargar, no un cálculo
legal cerrado: la pantalla pide confirmarlo con la contadora.

Flujo: la persona pide (aviso a RRHH) → RRHH aprueba (puede corregir días) o
rechaza con motivo obligatorio (aviso a la persona). RRHH también registra
licencias ya acordadas, que entran aprobadas, y puede corregir o anular
cualquiera (anular = `CANCELADA`, no se borra). El tablero (`tableroLicencias()`)
muestra pedidos sin responder, quién está de licencia o sale en 30 días y el
saldo de cada uno.

### Entregas de materiales con firma

`services/rrhh/entregas.service.ts`, tabla `entregas_materiales`: fecha,
`items` (JSON: descripción, cantidad, detalle), observaciones, estado
(`PENDIENTE_FIRMA`, `FIRMADA`, `ANULADA`), quién entregó, firma y constancia.

1. RRHH registra la entrega (aviso a la persona).
2. Firma **la persona desde su Mi legajo**, o **quien gestiona RRHH en su
   dispositivo con la persona delante** (`firmaPresencial`). La firma se dibuja
   en pantalla y llega como PNG en base64 (se valida que sea PNG y pese menos de
   1 MB; la ruta acepta hasta 2 MB de cuerpo).
3. Al firmar se guarda el PNG, se arma la **constancia en PDF** con PDFKit (logo,
   tabla de materiales, «Declaro haber recibido los materiales detallados en
   esta constancia.», la firma, y al pie cuándo y cómo se firmó) y entra al
   legajo como documento `ENTREGA_EPP` validado (`documentoId`).

Una entrega firmada no se edita: si hubo un error se anula y se registra otra;
la constancia ya emitida queda en el legajo.

### Privacidad

Son datos sensibles (salud, sueldo, cuenta bancaria; la ley 18.331 de
protección de datos personales trata como sensibles los de salud). Por eso:

- **Mi legajo nunca devuelve** sueldo, categoría, fecha de egreso ni notas
  internas, ni los documentos `soloInterno`. El `PATCH /mi-legajo` rechaza
  cualquier campo que no sea personal (esquema `strict`).
- **Descargas** con token de **15 minutos atado al documento**
  (`utils/token-descarga.ts`), y la ruta vuelve a chequear que quien lo abre sea
  la persona dueña o tenga `RRHH:EDIT`. Sin caché del navegador (`no-store`).
- **Cada vez que alguien abre un documento de otra persona** queda en la
  auditoría (`file_downloaded`, entidad `legajo`).
- La auditoría de ediciones guarda **los nombres de los campos, no los
  valores**: el sueldo no se copia al historial.
- `legajos`, `legajo_documentos`, `licencias`, `licencia_contingentes` y `entregas_materiales` están en la lista de tablas prohibidas del
  asistente de IA (`ai-sql-validator.ts`), y el usuario de Postgres del
  asistente no recibe permisos sobre tablas nuevas.

## Permisos

| Permiso | Qué habilita |
|---|---|
| `RRHH:VIEW` | Mi legajo: solo lo propio. Todos los roles internos, incluido el tercerizado |
| `RRHH:EDIT` | Los legajos de todos, con sueldos, contratos y datos de salud; validar, subir, borrar; vencimientos y recibos en lote. Al crear el módulo: `ADMIN`, `GERENTE_FINANZAS` y `FINANZAS` (decisión de Nicolás del 26/10/2026) |

Sembrados por la migración `20261026163700_documentacion_rrhh_permisos`.

## Reglas y decisiones

- **Los recibos los sube administración**, no la persona.
- **Lo que carga la persona necesita validación** para contar como presentado
  en el tablero de quien gestiona; igual cuenta para el faltante mientras está
  pendiente (ya lo subió).
- **El tercerizado tiene legajo reducido:** sin recibos ni cobro del sueldo, y
  con lo que se le pide antes de subir a un techo.
- **El sueldo es un solo número vigente.** El historial de cambios de sueldo no
  se guarda con sus valores (ver Privacidad); si hace falta, se agrega aparte.

## Casos borde

- **Un usuario dado de baja** (`deletedAt`) no aparece en la lista ni recibe
  avisos; su legajo queda en la base.
- **Fecha de egreso cargada:** aparece atenuado y sin avisos de vencimiento.
- **Recibo en lote con un archivo que no coincide con nadie:** queda sin persona
  y no se sube hasta que se elija.
- **Licencia que cruza dos años:** cuenta entera contra el saldo total; el
  saldo no se separa por año.
- **Tercerizado:** no tiene licencias (el servidor rechaza el pedido); sí puede
  recibir entregas de materiales.

## Archivos

- `server/src/services/rrhh/rrhh.service.ts`
- `server/src/services/rrhh/vencimientos.job.ts`
- `server/src/services/rrhh/licencias.service.ts`
- `server/src/services/rrhh/entregas.service.ts`
- `server/src/routes/rrhh.routes.ts`
- `server/src/utils/token-descarga.ts`
- `client/src/modules/rrhh/`, `client/src/api/rrhh.api.ts`
