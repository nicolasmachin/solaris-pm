# 07 · Habilitación UTE

> **Capítulo parcial.** Está documentada la **solicitud de suministro individual
> / aumento de potencia contratada**. El resto del módulo (proceso de
> habilitación, subetapas dinámicas, formularios PDF, documentos firmados)
> sigue pendiente de escribir: la funcionalidad existe y está en producción,
> lo que falta es la documentación.

---

# Solicitud de suministro individual / aumento de potencia

## Para qué existe

Antes de conectar un generador fotovoltaico, a veces hay que pedirle a UTE que
le **suba la potencia contratada** al cliente: si el suministro está contratado
en 3,7 kW y se va a instalar un sistema de 5 kW, la instalación no entra. Ese
pedido se hacía fuera de la app —alguien completaba el formulario a mano y lo
mandaba por correo— y no quedaba rastro de si se había pedido, cuándo, ni por
cuánto.

Es un trámite **opcional**: solo lo necesitan algunos proyectos. Por eso no es
una subetapa nueva del pipeline (que habría que marcar "No aplica" en la
mayoría de los proyectos), sino un botón dentro de la subetapa que ya existe.

El mismo formulario sirve para pedir un **suministro nuevo**; cambia el tipo de
trámite y el asunto del correo, no el resto.

## Cómo se usa

1. En la ficha del proyecto, abrir la subetapa **"Consulta inicial UTE"** de
   Onboarding. Debajo del botón de consulta aparece **"Solicitar aumento de
   potencia"**.
2. La pantalla llega con todo precargado desde el proyecto: dirección, datos del
   cliente, cuenta, tarifa, tensión y fases. **Todos los campos son editables**,
   salvo los datos de la firma instaladora y del técnico instalador, que son
   fijos por obligación ante UTE y viven en el texto de la plantilla.
3. Si falta la cuenta o la tarifa, se puede **subir la factura de UTE** ahí
   mismo: la IA la lee y completa esos campos (es el mismo extractor que usa la
   consulta inicial).
4. Elegir la **potencia solicitada**. No es texto libre: es la lista cerrada de
   escalones que acepta UTE, y cambia según el suministro sea monofásico o
   trifásico. Debajo se muestra el salto que se está pidiendo.
5. **"Ver formulario"** descarga el archivo Excel ya completo, para revisarlo
   antes de mandarlo.
6. **"Enviar a UTE"** manda el correo desde la casilla del propio usuario, con
   el formulario adjunto.

Después de enviar, el botón de la subetapa pasa a decir cuándo se pidió el
aumento y por cuánto.

**El formulario se autoguarda mientras se completa.** Si se cierra la ventana,
al volver aparece un aviso con lo recuperado y un enlace para descartarlo y
volver a los datos del proyecto. El borrador se borra al enviar.

## Cómo funciona

**El correo** usa el sistema de plantillas (`EmailTemplate`, clave
`suministro_individual_ute`, sembrada por `seed-templates.ts` →
`seedSuministroIndividualTemplate()`). Como toda plantilla, un ADMIN puede
editar destinatarios, asunto y cuerpo desde Configuración sin tocar código. Va
a `comercial@ute.com.uy` con copia a Voltia, y sale por el SMTP del usuario
(`user_smtp_configs`), no por la casilla del sistema.

**Los datos** se arman en `email/context.service.ts` → `buildEmailContext()`,
que junta `Project` con `UteDocumentConfig`. Este trámite le agregó al contexto
los campos propios del formulario de UTE.

**El formulario adjunto** es el libro Excel que publica UTE, guardado en
`server/src/assets/ute-templates/Solicitud_Suministro_UTE.xlsx`, completado por
`ute-suministro/xlsx.service.ts` → `completarFormularioSuministro()`. El mapa
de qué dato va en qué celda está en `ute-suministro/cells.ts`, y la traducción
desde el contexto del mail en `ute-suministro/mapping.ts`.

**Los endpoints** están en `routes/ute-suministro.routes.ts`:

| Endpoint | Qué hace |
|---|---|
| `GET .../suministro-individual/estado` | Si ya se pidió, cuándo y por cuánto |
| `POST .../suministro-individual/preview.xlsx` | Devuelve el formulario completo para revisarlo |
| `POST .../suministro-individual/enviar` | Completa, adjunta, envía y registra |

**Al enviar** se guarda la potencia en `UteDocumentConfig.potSolicitada`, la
fecha en `aumentoPotenciaSentAt`, una copia del archivo en los documentos del
proyecto (`FileAttachment` con `toolSource: "ute-suministro-individual"`) y una
entrada de auditoría.

## Permisos

Los dos roles que hacen este trámite tienen permisos **complementarios**:
`ASESOR_COMERCIAL` edita Onboarding pero solo mira Trámites UTE, y
`TRAMITACION_UTE` es exactamente al revés. Por eso los endpoints usan
`authorizeAny`, que deja pasar con **cualquiera de los dos** módulos:

- **Ver el formulario**: Onboarding *o* Trámites UTE, permiso de ver.
- **Enviar**: Onboarding *o* Trámites UTE, permiso de editar.
- **La pantalla**: Trámites UTE, ver (igual que la consulta a UTE).

Quedan afuera de enviar: Finanzas, Experiencia Solar (pueden ver), Logística y
los clientes del portal.

## Reglas y decisiones

- **El formulario se completa con lo que el asesor vio, no con lo que hay en la
  base.** Los datos viajan en el pedido de envío, no se releen del proyecto. Si
  se releyeran, las correcciones hechas en pantalla no llegarían al adjunto.
- **Si el correo falla, no se guarda nada**: ni la fecha, ni el archivo, ni la
  marca de trámite pedido. Lo contrario dejaría el proyecto afirmando que se
  solicitó algo que nunca salió.
- **La fecha del primer pedido no se pisa**, pero la potencia sí se actualiza al
  reenviar: si se corrige el valor y se manda de nuevo, lo guardado tiene que
  ser lo último que se envió.
- **La potencia es una lista cerrada** porque UTE valida el formulario con sus
  propias fórmulas: un valor fuera de los escalones se rechaza. Al cambiar las
  fases, si la potencia elegida no existe en la lista nueva, se limpia.
- **El número de cuenta va en Observaciones.** El formulario de UTE no tiene un
  campo propio para la cuenta; se precarga la frase y queda editable.
- **La plantilla del repo está en blanco a propósito.** El archivo que circula
  viene con un cliente de ejemplo cargado; se limpia con
  `server/scripts/prepare-ute-xlsx-template.py` antes de versionarlo, para no
  guardar datos personales de un tercero ni arrastrarlos al formulario de otro
  cliente.

## Casos borde

- **El libro de UTE no se puede abrir con una librería de Excel.** `exceljs`
  —que está en el proyecto— falla al leerlo: tiene imágenes, objetos
  incrustados, listas desplegables con extensiones y fórmulas de validación
  entre hojas. Por eso el relleno se hace editando el XML de la hoja y copiando
  el resto del archivo tal cual. Un archivo "equivalente" no sirve: UTE valida
  con sus propias fórmulas, así que tiene que ser **su** archivo completado.
- **Si UTE publica una versión nueva del formulario**, hay que volver a correr
  el script de preparación y revisar `cells.ts`. La hoja se busca por nombre
  ("Individual"), así que reordenar hojas no rompe nada; mover un campo de
  celda, sí. Si una celda del mapa no existe, ese dato se pierde **en silencio**.
- **El teléfono se escribe como texto a propósito**: como número perdería el
  cero inicial.
- **"Pasa línea" se normaliza al abrir la pantalla.** El dato viene con el valor
  por defecto de la consulta de microgenerador ("No corresponde"), que no es una
  opción válida del formulario de UTE; se cambia a "No Declara".
- **La tarifa guardada en el proyecto puede no estar en la lista de UTE** (por
  ejemplo "BT1", que viene de la factura). En ese caso se muestra igual como
  opción, pero conviene elegir la equivalente de la lista antes de enviar.
- **El borrador vive en el navegador** (`localStorage`, clave
  `voltia:suministro-individual:<projectId>`), no en el servidor: queda en esa
  computadora y ese navegador. Desde otra máquina el formulario arranca con los
  datos del proyecto. En modo incógnito o con el almacenamiento bloqueado no se
  guarda nada y la pantalla funciona igual.
- **Al releer la factura de UTE el borrador NO se reaplica**: gana el dato que
  acaba de extraer la IA. Reaplicarlo pisaría justamente lo que se fue a buscar.
- **El borrador se fusiona campo por campo sobre los datos del proyecto.** Si el
  formulario gana un campo nuevo, un borrador viejo no lo deja vacío: toma el
  valor del proyecto y conserva lo escrito en el resto. Si cambia la forma del
  borrador (`BORRADOR_VERSION`), se descarta entero en vez de recuperarse a
  medias.
- **Enviar dos veces no está bloqueado**: se puede corregir y reenviar. Solo
  queda la última copia del formulario en los documentos del proyecto.

---

## Lo que falta documentar de este capítulo

- El proceso de habilitación y sus estados
- Subetapas dinámicas: cómo se regeneran
- Los formularios PDF generados y la regla de los checkboxes
- Documentos firmados y su almacenamiento
- Fechas del trámite y qué se autocompleta
- Avance automático del pipeline al finalizar
