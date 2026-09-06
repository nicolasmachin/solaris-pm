# Experiencia Solar — Addendum a la tabla de requerimientos

> Resolución de las 8 brechas detectadas al cruzar los procedimientos E1/E2/E3 con
> la tabla vigente. **Se agregan a la tabla; no la reemplazan.**
> Decisiones tomadas el 4 de septiembre de 2026.

---

## Resumen de las decisiones

| Brecha | Decisión | Resultado |
|---|---|---|
| B-01 Encuestas | **Arreglar el instrumento para que sirva de verdad** | Requerimiento nuevo **ENC-01** |
| B-02 Confirmación de encendido | **Sí, y es la que dispara la Encuesta 2** | Requerimiento nuevo **E2-07** |
| B-03 OK previo de UTE | **Descartado.** Lo consulta Luna en el trámite; solo importa que el hito quede registrado | Sin desarrollo |
| B-05 Cadencia | **Mandan los tiempos nuevos (3/5/10)** y los tiempos van configurables en Administración | **Ya existe** en parte · **TIE-01** por lo que falta |
| B-06 Alta en la app del fabricante | **La hace Ingeniería**, por ahora. Pero la información tiene que llegar a posventa | Requerimiento nuevo **ING-01** |
| B-07 Etapa 3 | **Sigue lo ya definido**; no se rediseñó en esta vuelta | Sin cambios |
| B-08 Indicador de satisfacción | **Sin decidir** | Ver al final |

---

## ENC-01 · Rediseñar el modelo de encuestas

| | |
|---|---|
| **Procedimiento definido** | Tres encuestas, cada una con **tres preguntas en escala 0-10**. Encuesta 1 (post-obra): conformidad general · claridad del proceso · qué mejorar. Encuesta 2 (al confirmar encendido): conformidad · **cuán acompañado se sintió durante la espera** · qué mejorar. Encuesta 3 (anual): conformidad · **NPS: ¿nos recomendarías?** · en qué ayudar |
| **Qué hay hoy** | Una sola columna de nota (entero, escala 1-5) y un comentario. **Una pregunta, igual para las tres.** No se puede medir NPS ni separar conformidad de acompañamiento |
| **Qué implementar** | Modelo de respuestas múltiples por encuesta · escala 0-10 · set de preguntas por tipo · **migrar la respuesta existente** (hay 1) · rediseñar el formulario del portal |
| **Prioridad** | **P1 — y antes de escalar la entrega** |

> **Secuencia obligada:** arreglar la entrega (E1-09, E2-05) antes que el
> instrumento significa mandar a escala una encuesta que no mide lo que queremos
> medir. **ENC-01 va primero.**

---

## E2-07 · Check de confirmación de encendido

| | |
|---|---|
| **Procedimiento definido** | El cierre de E2 **no es "UTE habilitó", es que el cliente encendió y está generando**. Se le pide al cliente que avise cuando encienda, y no se cierra el caso hasta que confirme |
| **Qué hay hoy** | No existe el check. La Encuesta 2 se dispara **al cerrar la etapa de Trámite UTE**, o sea antes de que el cliente viva el desenlace |
| **Qué implementar** | Check nuevo en E2, posterior al aviso de habilitación · **es el que dispara la Encuesta 2** (se mueve el disparador) · el cierre de E2 pasa a ser este check |
| **Prioridad** | **P1** |

**Cómo queda la secuencia completa de la habilitación:**

| # | Quién | Qué |
|---|---|---|
| 1 | **Tramitación UTE** | Recibe el mail de UTE y **marca el trámite terminado** en el módulo de Trámites |
| 2 | *Sistema* | **Ese acto escribe la fecha de habilitación** y arranca el reloj de la Regla de Oro |
| 3 | **Alejandra** | Avisa al cliente dentro de 24-48 h y marca el check de aviso |
| 4 | **Cliente** | Enciende y avisa |
| 5 | **Alejandra** | Marca el **check de confirmación de encendido** → **dispara la Encuesta 2** y cierra E2 |

Son **tres actos distintos, cada uno en su lugar**: la fecha la escribe Tramitación,
el aviso lo registra Alejandra, y el encendido lo confirma el cliente.

---

## TIE-01 · Los tiempos de Experiencia Solar, configurables

| | |
|---|---|
| **Definición** | Los tiempos del área tienen que poder configurarse en Administración, igual que los plazos de las etapas del proyecto |
| **Qué hay hoy** | **La cadencia YA es configurable**: existe la pestaña **"Cadencia de contacto"** en Administración, junto a "Plazos por etapa" y "Plazos del embudo", cargada con E1: 3 · E2: 5 · E3: 10 días y activa. **Nada que hacer acá** |
| **Qué falta** | **Los plazos de los hitos están fijos en el código:** el recordatorio de 24 h y la escalación de 48 h de la Regla de Oro son constantes. Y **el plazo de 2 días hábiles para avisar la fecha de obra no existe** |
| **Qué implementar** | Llevar esos plazos a la misma pantalla de configuración: **aviso de habilitación (recordatorio y escalación)** y **aviso de fecha de obra** |
| **Prioridad** | P2 |

**Los tiempos del área, todos juntos:**

| Tiempo | Valor | ¿Configurable hoy? |
|---|---|---|
| Cadencia E1 | 3 días | ✅ Sí |
| Cadencia E2 | 5 días | ✅ Sí |
| Cadencia E3 | 10 días | ✅ Sí |
| Aviso de habilitación — recordatorio | 24 h | ❌ Fijo en código |
| Aviso de habilitación — escalación | 48 h | ❌ Fijo en código |
| Aviso de fecha de obra | 2 días hábiles | ❌ No existe |

---

## ING-01 · El alta en la app del fabricante pasa a Ingeniería

| | |
|---|---|
| **Decisión** | **La hace Ingeniería**, por ahora, hasta que se defina lo contrario. El rol de Experiencia Solar no es configurar la app, es enseñar a usarla. **Pero la información tiene que llegar a posventa para poder informarle al cliente** |
| **Qué hay hoy** | La subetapa **"Alta en plataforma de monitoreo"** está dentro de Post-Habilitación, asignada al *"Equipo Postventa"* — y sin casilla, sin plazo y sin responsable nominal |
| **Qué implementar** | **Mover la subetapa a Ingeniería** · al completarla, que **genere novedad hacia Experiencia Solar con los datos del acceso** (usuario creado, marca del inversor), para que Alejandra pueda pasárselos al cliente en la puesta en marcha |
| **Prioridad** | P2 |

> Sin la parte de integración esto empeora la situación actual: la tarea se va a
> otra área y Experiencia Solar deja de enterarse. **El traspaso de la información
> es lo que hace que la decisión funcione.**

---

## B-03 · El OK previo de UTE — descartado

**No se desarrolla nada.** El seguimiento de ese hito lo hace Luna de forma
recurrente dentro del proceso de habilitación de UTE.

**Lo único que importa:** que el hito **quede registrado en el módulo de Trámites
UTE**. Eso ya existe (es uno de los 11 hitos del trámite), así que no hay
requerimiento nuevo.

*(Queda como contenido opcional, no como desarrollo: la notificación de UTE que
parece hablar de un "aumento de potencia" confunde a los clientes, y conviene
tenerlo previsto en la plantilla de bienvenida.)*

---

## B-07 · Etapa 3 — sin cambios por ahora

Se mantiene **lo ya definido en el procedimiento de la Etapa 3** (los cinco
sub-procesos: puesta en marcha, soporte reactivo, consultas de rendimiento, reporte
mensual y encuestas, mantenimientos). **No se rediseñó en esta vuelta**, así que la
tabla no incorpora requerimientos de E3 todavía.

Lo que sí queda enganchado: la **Encuesta 3 (anual, con NPS)** entra en ENC-01, y
la **puesta en marcha** depende de ING-01 para tener los datos del acceso.

---

## Lo que quedó sin decidir

**B-08 — El indicador de resultado del área.**

Los tres procedimientos insisten en que **la satisfacción manda sobre los plazos**:

> *"Se puede cumplir todos los tiempos y aun así tener un cliente insatisfecho. El
> número que define si el área cumple su objetivo es la satisfacción, no los plazos."*

La tabla de requerimientos mide **proceso** (cadencia, avisos en plazo, checks). El
indicador de resultado no aparece, y **hoy no se puede calcular**: no hay ninguna
métrica agregada de encuestas.

Con ENC-01 el dato va a existir. **Falta decidir si se construye la métrica**
—promedio por etapa, evolución, NPS, tasa de respuesta— y si ese es el número que
define el objetivo del área.

---

## Cómo queda el orden de trabajo

| Orden | Qué | Por qué antes |
|---|---|---|
| 1 | **P0 de la tabla** (alertas por correo, nota baja, cartel filtrable) | Horas de trabajo, destraba lo inmediato |
| 2 | **E2-03** (la fecha de habilitación la escribe Tramitación) | Punto único de falla; dejó 20 clientes fuera del radar |
| 3 | **ENC-01** (modelo de encuestas) | **Antes** de arreglar la entrega, o se escala un instrumento que no mide |
| 4 | **E2-07** (check de encendido) | Depende de ENC-01: mueve el disparador de la Encuesta 2 |
| 5 | Resto del P1 de la tabla | |
| 6 | **TIE-01**, **ING-01** y el P2 | |
