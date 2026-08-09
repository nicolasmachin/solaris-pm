// Guía de operación mensual: el paso a paso para emitir y enviar los reportes.
//
// Es un documento SEPARADO del manual de uso a propósito. El manual explica cómo
// funciona cada cosa; esto es la receta que se sigue una vez por mes, con los
// clics en orden. Quien la usa no quiere leer treinta páginas: quiere saber qué
// apretar hoy.
//
// CONTROL DE VERSIONES: al actualizarla, subí OPERACION_VERSION y agregá una
// entrada al tope de OPERACION_CAMBIOS.

export const OPERACION_VERSION = "1.1";
export const OPERACION_ACTUALIZADO = "8 de agosto de 2026";

export interface CambioOperacion {
  version: string;
  fecha: string;
  cambios: string[];
}

export const OPERACION_CAMBIOS: CambioOperacion[] = [
  {
    version: "1.1",
    fecha: "8 de agosto de 2026",
    cambios: [
      "El botón ahora se llama \"Traer datos de las plantas\" y trae Growatt y Huawei juntos.",
    ],
  },
  {
    version: "1.0",
    fecha: "8 de agosto de 2026",
    cambios: [
      "Primera versión: el paso a paso mensual, qué hace el sistema solo y cómo activar un generador apagado.",
    ],
  },
];

export const OPERACION_MARKDOWN = String.raw`
## Lo primero: nada se le manda al cliente sin que vos lo apretés

El sistema prepara todo solo, pero **el envío al cliente es siempre manual**. No
hay ningún automatismo que le mande un reporte a nadie. Podés equivocarte en
cualquier paso previo y corregirlo: mientras no aprietes enviar, el cliente no ve
nada.

---

## Qué hace el sistema solo, y cuándo

| Cuándo | Qué hace | ¿Sale algo al cliente? |
|---|---|---|
| Todos los días, 8:00 | Revisa que cada planta esté funcionando | No |
| Días 2, 4 y 6, 6:00 | Trae de Growatt y de Huawei los datos del mes anterior | No |
| Día 7, 8:00 | Arma los PDF de los que tienen todos los datos y te avisa por mail | No |
| — | **Enviar al cliente** | **Sólo si lo hacés vos** |

Que la preparación corra sola no tiene riesgo: junta datos y arma borradores. Lo
único que llega al cliente es lo que enviás a mano.

---

## El paso a paso de cada mes

### 1. Esperá al día 7 (o adelantalo vos)

Para el día 7 el sistema ya trajo los datos y armó los PDF. Te llega un mail con
el resumen: cuántos quedaron listos, cuántos esperando datos y cuántos trabados.

Si querés adelantarte, entrá a **Experiencia Solar → Reportes FV**, elegí el mes
arriba a la izquierda y apretá **"Traer datos de las plantas"**. Ese botón
consulta **las dos marcas, Growatt y Huawei**: no hay que traerlas por separado.
Tarda unos minutos y podés seguir trabajando mientras corre.

Si querés generar los PDF de todos de una vez en lugar de uno por uno, usá
**"Generar PDF de todos"**: arma los de todos los generadores que tengan los
datos completos y te dice qué pasó con el resto.

### 2. Mirá el semáforo

En el listado, cada generador tiene un estado:

- **PDF listo** — tiene todo, se puede enviar.
- **Calculado** — los números están, falta generar el PDF.
- **Sin lectura** / **Datos incompletos** — le faltan datos del mes.
- **Bloqueado** — le falta un dato de configuración y los números saldrían mal.
- **Enviado** — ya se le mandó.

Filtrá con **"Solo con pendientes"** para ver de una los que necesitan atención.

### 3. Resolvé los que están incompletos

Hacé clic en el generador para abrir su ficha:

- Si falta el **consumo o la exportación**, cargalos a mano en *Lectura del mes*.
  Es lo normal en los generadores que no tienen medidor inteligente.
- Lo que cargues a mano **no se pisa** cuando se vuelven a traer los datos, así
  que podés corregir tranquilo.
- Si está **bloqueado**, andá a la pestaña *Configuración*: casi siempre es que
  las franjas horarias no suman 100% o que a una empresa le falta la tarifa.
- Si la planta estuvo **sin comunicación** parte del mes, el dato va a estar
  incompleto o en cero. Revisá la pestaña **Monitoreo** antes de emitir: un
  reporte que dice "generó 0 kWh" cuando la planta funciona bien es peor que no
  mandar nada.

### 4. Generá y revisá el PDF

Con **"Generar PDF"** se arma el reporte. Abrilo y miralo antes de enviar,
sobre todo el ahorro del mes y el acumulado.

### 5. Enviá

Desde la ficha, **"Enviar al cliente"**. También podés seleccionar varios y usar
el envío en lote. Cada envío queda registrado con fecha y destinatario, y el
sistema **no deja mandar dos veces el mismo reporte**.

Una vez enviado, el cliente lo ve en su portal, en la sección *Reportes*.

---

## Activar un generador que está apagado

Algunos generadores están dados de alta pero con el envío **apagado**: aparecen
como *Deshabilitado* y el sistema los saltea. Para activarlos:

1. **Experiencia Solar → Reportes FV**, buscá el generador y abrí su ficha.
2. Entrá a la pestaña **Configuración**.
3. Prendé el interruptor **"Enviar reporte"**.
4. Revisá que estén cargados, porque sin esto los números salen mal o no salen:
   - **Potencia contratada** (kW). Si falta, se estima en 5 kW y el reporte lo
     aclara.
   - **Tarifa contratada**, obligatoria si es una empresa.
   - **Reparto de franjas horarias** (punta / llano / valle): tiene que sumar 100%.
   - **Inversión** en dólares, si querés que el reporte muestre el retorno.
   - **Mes de inicio**: desde qué mes se le hacen reportes.
   - **Destinatarios**: a qué correo se le manda. Si no ponés ninguno, hereda el
     del proyecto.
5. Guardá y volvé al listado: el generador deja de estar *Deshabilitado*.

A partir de ahí entra en la preparación mensual como el resto.

---

## Preguntas que aparecen siempre

**¿Puedo emitir un mes viejo?** Sí. Elegí el mes en el selector de arriba y
seguí el mismo procedimiento.

**Me equivoqué en un dato y ya generé el PDF.** Corregí el dato y volvé a
generar: el PDF se rehace con los números nuevos. Mientras no lo hayas enviado,
no pasó nada.

**Ya lo envié y estaba mal.** El envío no se puede deshacer, pero podés corregir
y volver a enviar: el cliente recibe el corregido y en su portal queda la última
versión.

**Un cliente no ve su reporte.** Se ve en el portal recién cuando se lo enviás.
Antes de eso queda sólo del lado interno.

**¿Y si no quiero que prepare nada automáticamente?** Se puede apagar la
preparación automática, pero no hace falta: no tiene efecto hacia afuera. Si aun
así lo preferís, se configura del lado del servidor.
`;
