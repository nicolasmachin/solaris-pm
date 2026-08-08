// Contenido del manual de uso de la herramienta de Reportes Fotovoltaicos.
//
// CONTROL DE VERSIONES: al actualizar el manual, subí MANUAL_VERSION y agregá
// una entrada al tope de MANUAL_CAMBIOS. La versión y el changelog salen impresos
// en el PDF. El nombre del archivo descargado incluye la versión.

export const MANUAL_VERSION = "1.2";
export const MANUAL_ACTUALIZADO = "8 de agosto de 2026";

export interface CambioManual {
  version: string;
  fecha: string;
  cambios: string[];
}

// Más reciente arriba.
export const MANUAL_CAMBIOS: CambioManual[] = [
  {
    version: "1.2",
    fecha: "8 de agosto de 2026",
    cambios: [
      "Monitoreo diario de plantas: qué revisa, qué significa cada estado y cómo gestionar un problema.",
      "Generación día a día en el portal del cliente.",
      "Ver el portal como lo ve el cliente, desde el listado de Generadores.",
    ],
  },
  {
    version: "1.1",
    fecha: "3 de agosto de 2026",
    cambios: [
      "Nueva sección sobre el día de corte del medidor: alinear el reporte al ciclo de facturación de UTE, desde el panel o desde el portal del cliente.",
    ],
  },
  {
    version: "1.0",
    fecha: "3 de agosto de 2026",
    cambios: ["Primera versión del manual: ciclo completo, Growatt, envío, portal y automatización."],
  },
];

// El contenido en Markdown. Se convierte a HTML y se envuelve con la portada y
// los estilos en manual.pdf.ts.
export const MANUAL_MARKDOWN = `
## 1. Qué es esta herramienta

La herramienta de **Reportes Fotovoltaicos** arma y envía el reporte mensual de
cada generador: cuánto generó, cuánto consumió, cuánto le ahorró la instalación y
cómo avanza el retorno de su inversión. Reemplaza el sistema de planillas que se
usaba antes: ahora los datos salen de los proyectos que ya están en el sistema y
de la conexión con Growatt, y el reporte se genera, se envía y queda disponible
para el cliente en su portal.

Vivís todo desde **Experiencia Solar → Reportes FV**.

---

## 2. El ciclo de cada mes, de un vistazo

Cada mes el reporte pasa por estos pasos:

1. **Traer los datos** de generación, consumo y exportación (de Growatt, o
   cargados a mano si el generador es de otra marca).
2. **Calcular** el ahorro y el retorno con las tarifas de UTE.
3. **Generar el PDF** del reporte.
4. **Revisar y enviar** al cliente por email, con tu aprobación.
5. El cliente lo **ve y descarga** desde su portal.

Buena parte de esto el sistema lo hace **solo** (ver la sección de automatización).
Tu trabajo principal es revisar y apretar *Enviar*.

---

## 3. Dar de alta un generador

Para que un generador reciba reportes, primero hay que darlo de alta. En el panel
de Reportes FV vas a ver **todos los generadores**: los que ya están dados de alta
y los que no (marcados con la etiqueta *sin alta*).

Hacé clic en un generador y andá a la pestaña **Configuración**. Lo mínimo para
darlo de alta:

- **Potencia contratada a UTE** (kW): la que figura en la factura del cliente. Si
  no la tenés, el reporte igual se calcula con un valor estimado de 5 kW y lo
  aclara, pero conviene cargar la real.
- **Reparto de consumo por franja horaria** (punta / llano / valle, en %): tiene
  que sumar 100. Es una estimación; se usa para comparar las tarifas inteligentes.

Lo demás **se hereda del proyecto** si lo dejás vacío:

- **Inversión (USD)** → del presupuesto del proyecto.
- **Potencia instalada (kWp)** → de la capacidad del proyecto.
- **Mes de inicio** → de la fecha de habilitación UTE.
- **Destinatarios** → del email del cliente cargado en el proyecto.

Si querés otros destinatarios (o agregar copias), cargalos en la sección
**Destinatarios** de esa misma pestaña.

Para clientes **empresa**, marcá el tipo y elegí la **tarifa contratada** (la
única que se muestra). Para **residenciales** se muestran las tres tarifas
comparadas y el retorno se calcula con la simple.

Cuando guardás, el generador queda dado de alta y el sistema recalcula sus
números al instante.

### Día de corte del medidor (opcional)

Por defecto el reporte cubre el **mes calendario** (del día 1 al último). Pero
UTE no factura así: factura el período entre dos lecturas del medidor, que suele
ir de mitad de mes a mitad del mes siguiente. Por eso los montos del reporte y
los de la factura casi nunca coinciden exactamente.

Si cargás el **día de corte del medidor** (el día en que UTE lee el medidor, que
figura en la factura), el reporte pasa a cubrir **ese ciclo** en vez del mes
calendario (por ejemplo, del 24 de mayo al 23 de junio). Así los kWh se parecen
mucho más a los de la factura. Cuando usás el ciclo, el sistema le pide a Growatt
los datos **día por día** y controla que la suma cierre con el total del mes.

Hay dos formas de cargarlo:

- **Desde el panel**, en la configuración del generador (campo *Día de corte del
  medidor*). Dejalo vacío para volver al mes calendario.
- **Desde el portal del cliente**: en "Mis reportes solares" el cliente tiene un
  lugar para ingresar su propio día de corte. Es lo ideal, porque él tiene la
  factura a mano. La nota del PDF ya lo invita a hacerlo.

---

## 4. Plantas de Growatt

Para que los datos vengan solos, cada generador con inversor **Growatt** tiene que
estar vinculado a su planta. Entrá a **Plantas Growatt** (botón del panel):

- **Sincronizar con Growatt** trae el listado actualizado de plantas de la cuenta.
- Cada planta sin vincular muestra **sugerencias** por nombre: hacé clic en la
  sugerencia correcta para vincularla al generador.
- Si una planta **no es de un cliente** (una demo, una instalación propia),
  marcala como **Ignorar** para que no aparezca como pendiente.

Una planta bien vinculada es lo que permite traer sus datos automáticamente.

---

## 5. Traer los datos de Growatt

Con las plantas vinculadas, el botón **Traer datos de Growatt** del panel trae la
generación, el consumo y la exportación del mes seleccionado, para todos los
generadores con planta. Vas a ver el progreso mientras corre (puede tardar varios
minutos si son muchas plantas).

**Cobertura de datos**: si a un mes le faltan días de datos del medidor (menos del
90% de los días), el sistema **descarta** ese mes en lugar de mostrar un total
incompleto que engañaría al cliente. Ese generador queda como *datos incompletos*,
esperando que completes el dato a mano.

Los datos que hayas **cargado a mano no se pisan** con los de Growatt: si corregiste
un valor, queda.

---

## 6. Cargar datos a mano

Para los generadores de **otras marcas** (sin conexión automática) o para
**completar un mes** que Growatt trajo incompleto, cargá los datos a mano: en el
detalle del generador, pestaña **Lectura del mes**, poné la generación, el consumo
y la exportación del mes, y guardá. El sistema recalcula solo.

Los valores cargados a mano quedan marcados como manuales y la ingesta automática
no los reemplaza.

---

## 7. Generar y revisar el PDF

En el detalle del generador, pestaña **Reporte / PDF**:

- **Generar PDF** arma el reporte del mes con los datos actuales. Podés verlo en
  pantalla ahí mismo y **descargarlo**.
- Si regenerás (porque corregiste un dato), se crea una **versión nueva**; la
  anterior queda guardada.
- Si el generador tiene algún dato que impide calcular (por ejemplo, las franjas
  no suman 100%), el botón te avisa y no deja generar hasta resolverlo.

---

## 8. Enviar al cliente

Con el PDF listo, en la misma pestaña aparece **Enviar al cliente**:

- **Prueba (dry-run)**: simula el envío sin mandar nada y te dice a qué
  direcciones iría. Útil para chequear los destinatarios antes.
- **Enviar**: manda el email con el PDF adjunto. Pide confirmación, porque es un
  correo real al cliente.

Un reporte enviado **no se puede mandar dos veces** por error: queda marcado como
enviado y el botón se bloquea. Si el envío falla, podés reintentarlo.

Al enviarlo, el reporte queda **publicado en el portal** del cliente.

---

## 9. Lo que ve el cliente

El cliente entra a su portal y encuentra una sección **Reportes**, con todos sus
reportes agrupados por año. De cada uno ve el ahorro del mes y puede abrirlo en
pantalla o descargarlo. Cada cliente ve **solo los suyos**.

Además, en su pantalla de energía ve **cuánta energía generó cada día del mes**,
con el total del mes, el promedio por día y su mejor día. Puede moverse a meses
anteriores con las flechas. Los datos llegan **hasta el día anterior**: lo de cada
día se procesa a la mañana siguiente, y la pantalla lo aclara.

Ese gráfico diario se muestra aunque todavía no se le haya enviado el reporte del
mes. Son kilovatios crudos del inversor, sin interpretación económica —el mismo
dato que vería en la aplicación de Growatt—, así que no necesita revisión previa.
Si a un generador le apagás el switch **"Enviar reporte"** en Configuración,
tampoco ve el detalle diario.

### Ver su pantalla, sin pedirle capturas

En el listado de **Generadores** hay un botón con forma de ojo, al lado del de
borrar. Entra al portal de ese cliente y muestra **exactamente lo que ve él**.

Mientras estás ahí, una franja arriba lo aclara en todo momento, y salís con un
clic. Es **solo lectura**: no se puede abrir un ticket ni responder una encuesta
en su nombre. El botón aparece únicamente si ese generador ya tiene usuario de
portal creado.

---

## 10. Qué hace el sistema solo cada mes

El sistema prepara los reportes automáticamente, sobre el **mes anterior**:

- **Principios de mes**: trae los datos de Growatt (y reintenta los días
  siguientes lo que haya quedado incompleto).
- **Alrededor del día 7**: calcula y **genera los PDF** de los generadores que
  están completos, y te **avisa por email** con el resumen: cuántos quedaron
  listos, cuántos esperan datos, cuántos necesitan atención.
- **El envío al cliente sigue siendo manual**: vos revisás el panel y apretás
  *Enviar*. (El envío automático está previsto pero apagado hasta que el
  proceso lleve unos meses probado.)

Así, cuando entrás a principios de mes, la mayoría de los reportes ya están
armados esperándote.

---

## 11. Tarifas de UTE

El cálculo usa el pliego tarifario de UTE, que se administra en **Administración →
Configuración del negocio → Tarifas UTE**. Cuando UTE actualiza las tarifas:

1. **Duplicá** el cuadro vigente.
2. Cargá los precios nuevos.
3. **Publicá** con la fecha desde la que rigen.

Los reportes viejos se siguen viendo con los precios que tenían: cada reporte
recuerda con qué tarifa se calculó.

---

## 12. Los estados del semáforo

En el panel, cada generador tiene un estado del mes:

- **Sin alta**: todavía no está configurado en la herramienta.
- **Deshabilitado**: dado de alta pero con el reporte apagado.
- **Sin lectura**: no hay datos del mes.
- **Datos incompletos**: hay datos pero falta consumo o exportación (o la
  cobertura de Growatt fue baja).
- **Bloqueado**: le falta un dato que haría salir mal los números (por ejemplo,
  una empresa sin tarifa contratada).
- **Calculado**: los números están listos, falta generar el PDF.
- **PDF listo**: el reporte está generado, listo para enviar.
- **Enviado**: ya se le mandó al cliente.

El filtro **Solo con pendientes** te deja ver de un saque los que necesitan tu
atención.

---

## 13. Problemas frecuentes

- **"Potencia estimada"** (triángulo amarillo): el generador no tiene la potencia
  contratada cargada y se usó 5 kW. Cargá la real en Configuración.
- **Un mes quedó incompleto tras traer de Growatt**: el medidor no reportó
  suficientes días. Completá los valores a mano en *Lectura del mes*.
- **No puedo generar el PDF**: revisá la pestaña Configuración; suele ser que las
  franjas no suman 100% o falta la tarifa de una empresa.
- **El cliente no ve un reporte**: se ve en el portal recién cuando lo **enviás**
  (o lo publicás). Antes de eso queda solo del lado interno.

---

## 14. Monitoreo diario de las plantas

Hasta ahora, que la planta de un cliente dejara de funcionar se descubría cuando
el cliente llamaba, o al armar el reporte del mes siguiente. Podía pasar un mes
entero apagada, con el cliente perdiendo plata.

**Todas las mañanas a las 8** el sistema revisa que cada planta haya generado el
día anterior. Si no generó, busca la causa. Vive en la pestaña **Monitoreo**.

### Qué significa cada estado

- **Funcionando**: generó con normalidad. No hay nada que hacer.
- **No genera**: el equipo está comunicando —o sea, prendido y con internet— pero
  no produjo energía. Suele ser una falla del inversor o un corte del lado de
  alterna. Es el caso más urgente: el equipo está vivo y aun así no genera.
- **Falla del equipo**: además, el inversor está reportando un código de error
  concreto (por ejemplo una falla de aislación). El detalle muestra el código y
  el texto que devuelve el equipo.
- **Sin comunicación**: el equipo dejó de reportar. Casi siempre es el wifi de la
  casa: cambiaron el router o la clave. También puede ser que la planta esté
  apagada. El detalle dice desde cuándo no reporta.
- **Esperando habilitación**: el generador todavía no completó el trámite de UTE,
  o se habilitó hace menos de tres días. **No genera alerta**: es lo esperable.
- **Silenciada**: alguien pidió no vigilarla por un tiempo.
- **Sin datos**: Growatt no respondió. Es un problema nuestro, no del cliente, y
  solo llama la atención si se repite tres días seguidos.

### Cómo se gestiona un problema

Al hacer clic en una planta se abre el detalle, con el gráfico de los últimos 30
días y el historial de esa planta. Desde ahí:

- **Marcar revisada** deja constancia de que ya lo viste, con una nota de lo que
  hiciste o con quién hablaste. **No cierra el problema**: la incidencia sigue
  abierta hasta que la planta vuelva a generar sola. Ver y resolver son cosas
  distintas.
- **Descartar** es para una falsa alarma. Pide un motivo obligatorio: sin él,
  descartar sería indistinguible de esconder el problema.
- **Silenciar** deja de vigilar la planta **hasta una fecha**, con un motivo
  (mantenimiento programado, por ejemplo). Nunca es para siempre: un silencio
  permanente se olvida y la planta queda sin vigilar sin que nadie se entere.

El botón **Revisar ahora** fuerza una revisión en el momento, sin esperar a la
mañana siguiente. Tarda unos minutos.

### El mail diario

Llega un correo con lo que pasó, pero **solo cuando algo cambia**: un problema
que empieza, uno que se resuelve, o plantas que no se pudieron consultar. Si el
estado es el mismo de ayer, no llega nada. Un correo diario que repite siempre lo
mismo deja de leerse en una semana.

La excepción son los lunes: si hay problemas abiertos, el correo sale igual, para
que ninguno se pudra en silencio durante semanas.

### Dos protecciones que conviene conocer

- **Si un día no genera casi ninguna planta** —un temporal, un corte general—, el
  sistema no abre decenas de alertas: avisa una sola vez que pasó algo general.
- **Si Growatt no responde** para buena parte de la flota, la revisión se marca
  como fallida y **no abre ni cierra nada**. Las pocas plantas que sí
  contestaron no alcanzan para sacar conclusiones, y una caída de la API no puede
  "arreglar" por omisión las plantas que estaban rotas.

### Preguntas frecuentes

- **¿Por qué avisa recién al día siguiente?** Porque el equipo transmite solo con
  luz solar, así que el día en curso está incompleto hasta la tarde. Se evalúa
  siempre el día anterior completo.
- **¿Un día nublado dispara alertas?** No. El umbral es de medio kilovatio hora:
  una planta sana supera eso incluso el peor día de invierno. Cero kWh es
  siempre señal de que algo está roto.
- **¿Por qué una planta aparece como "Esperando habilitación" si ya funciona?**
  Porque no tiene fecha de habilitación ni mes de inicio de reportes cargado. Con
  cargar el mes de inicio en Configuración empieza a vigilarse.
`;
