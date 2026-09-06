# Voltia PM — Manual completo de Experiencia del Cliente (Posventa)

> **Qué es este documento.** Una descripción exhaustiva y autocontenida de cómo
> funciona **hoy** el acompañamiento al cliente en Voltia, desde que se cierra la
> venta hasta la vida útil de la instalación, y de qué herramientas ofrece el
> sistema Voltia PM para hacerlo.
>
> **Para qué se escribió.** Para poder discutir y rediseñar el proceso en una
> conversación aparte, sin acceso al código. Todo lo necesario está acá adentro.
>
> **Estado de la información.** Todo lo que dice "verificado" fue leído del código
> o consultado contra la base de datos de **producción** en **agosto de 2026**.
> Donde algo es una suposición, se aclara.

---

## Índice

1. Contexto: qué hace Voltia y quién es el cliente
2. El recorrido del cliente: las tres etapas (E1, E2, E3)
3. Etapa E1 — De la venta a la obra
4. Etapa E2 — De la obra a la habilitación
5. Etapa E3 — De la habilitación al uso continuo
6. Las herramientas de Voltia PM, una por una
7. Qué hace el sistema solo (automatismos y horarios)
8. Comunicación con el cliente: canales, límites y por qué
9. Roles y permisos
10. Datos reales de producción (agosto 2026)
11. Problemas conocidos, errores y agujeros
12. Decisiones de procedimiento ya tomadas
13. Preguntas abiertas para trabajar

---

# 1. Contexto: qué hace Voltia y quién es el cliente

Voltia es una empresa uruguaya que instala sistemas de generación fotovoltaica
(paneles solares) para clientes residenciales y empresas. El cliente compra una
instalación que le permite generar su propia energía y volcar el excedente a la
red eléctrica nacional (UTE).

**El ciclo completo tarda meses.** Entre que el cliente firma y el día en que
puede efectivamente encender su sistema pasan, en promedio, varios meses: primero
la ingeniería y la compra de materiales, después la obra física, y finalmente un
trámite de habilitación ante UTE que **depende de un tercero** y es el tramo más
largo e impredecible.

**Al cliente se le llama "Generador"** dentro del sistema, porque una vez
habilitado pasa a ser un generador de energía registrado ante UTE.

**El área que lo acompaña se llama "Experiencia Solar"** (antes "Postventa" o
"Atención al Cliente"). Hoy **la integra una sola persona**, que es la referente
de todos los clientes.

**Las áreas internas que tocan un proyecto son:**

| Área | Qué hace |
|---|---|
| Comercial (Asesor comercial) | Consigue el cliente, cotiza, cierra la venta |
| Ingeniería | Diseña el sistema, arma la lista de materiales, hace la ingeniería final |
| Operaciones | Compra materiales, coordina logística y ejecuta la obra (el **capataz** lidera en el lugar) |
| Tramitación UTE | Gestiona el trámite de habilitación ante UTE |
| **Experiencia Solar** | Acompaña al cliente durante todo el recorrido y después de habilitado |
| Finanzas | Cobros, pagos, facturación |
| Logística | Stock y materiales |

---

# 2. El recorrido del cliente: las tres etapas

El sistema clasifica a cada cliente en una de tres etapas del recorrido. **No se
guarda como un dato fijo: se deduce** de en qué etapa del pipeline técnico está su
proyecto (aunque se puede forzar a mano, algo que se usa para clientes viejos
importados de una planilla que no tienen pipeline).

| Etapa | Nombre | Qué significa |
|---|---|---|
| **E1** | Pre-obra | *De la venta a la obra.* El cliente firmó y espera que le instalen. |
| **E2** | Habilitación | *De la obra a la habilitación.* Ya tiene los paneles puestos, pero no puede encenderlos hasta que UTE habilite. |
| **E3** | Post-Habilitación | *De la habilitación al uso continuo.* Ya genera su propia energía. |

**El pipeline técnico tiene 8 etapas**, y cada una determina en qué etapa del
recorrido está el cliente:

| # | Etapa del pipeline | Recorrido |
|---|---|---|
| 1 | Onboarding | E1 |
| 2 | Pre-Ingeniería | E1 |
| 3 | Revisión del capataz | E1 |
| 4 | Validación de Operaciones | E1 |
| 5 | Ingeniería Final | E1 |
| 6 | Compras | E1 |
| 7 | Ejecución de Obra | E1 |
| 8 | Tramitación UTE | E2 |
| 9 | Post-Habilitación | E3 |

**Además existen dos "carriles paralelos" que son específicamente de Experiencia
Solar.** Corren al costado del pipeline técnico: no tienen fechas, no afectan el
avance del proyecto y no lo bloquean. Son la definición formal de qué tiene que
hacer el área:

**Carril "Seguimiento pre-obra" (durante E1):**
1. Mensaje de bienvenida al Generador — *casilla: "Bienvenida enviada"*
2. Seguimiento semanal (preobra) — *casilla: "Contacto semanal al día"*
3. Registro en bitácora — *casilla: "Interacciones registradas"*

**Carril "Seguimiento habilitación" (durante E2):**
1. Aviso de inicio de trámite UTE al Generador
2. Seguimiento semanal (habilitación)
3. Aviso de habilitación otorgada — *"Regla de Oro 24-48h"*, marcada como
   bloqueante

**Y la etapa 9, Post-Habilitación**, con tres sub-tareas asignadas al "Equipo
Postventa":
1. Capacitación al cliente
2. Alta en plataforma de monitoreo
3. Garantías y documentación final

> **Observación importante:** estas tres sub-tareas de Post-Habilitación **no
> tienen ninguna casilla de verificación, ni plazo, ni responsable asignado al rol
> de Experiencia Solar** (dicen genéricamente "Equipo Postventa"). No bloquean
> nada y el proyecto se puede dar por terminado sin completarlas. Además **no
> existe ningún carril de seguimiento para E3**: los dos carriles cubren pre-obra
> y habilitación; después de que el cliente enciende, no hay estructura definida.

---

# 3. Etapa E1 — De la venta a la obra

## 3.1 Cómo llega el cliente a Experiencia Solar

El comercial marca el lead como **ganado** y lo convierte en proyecto. Al momento
de la conversión se copian al proyecto los adjuntos del lead (la propuesta
comercial en PDF), sus comentarios, y se precargan la potencia y la cotización.

**Cuándo se entera Experiencia Solar:** cuando se completa la etapa de
**Onboarding** se dispara un aviso interno llamado **traspaso T1**, que notifica a
Ingeniería y a Experiencia Solar.

> **Problema conocido:** ese aviso llega **cuando termina Onboarding**, no cuando
> se gana la venta. Entre ambos momentos puede pasar bastante tiempo, y en ese
> hueco el cliente ya está esperando noticias sin saber quién lo acompaña.

## 3.2 Qué pasa en esta etapa (lado interno)

1. **Onboarding** — se firma el contrato, se define la modalidad de pago, se emite
   la proforma y se hace la consulta inicial a UTE.
2. **Pre-Ingeniería** — se hace un **relevamiento técnico** (una visita a la
   propiedad del cliente), y con eso se arma el documento de pre-ingeniería,
   el diagrama unifilar, memorias, planos y una lista preliminar de materiales.
3. **Revisión del capataz** — el capataz revisa la propuesta técnica.
4. **Validación de Operaciones** — se confirma la **fecha de obra**.
5. **Ingeniería Final** — se cierra la lista de materiales definitiva.
6. **Compras** — se compran los materiales, llegan al depósito y se preparan.
7. **Ejecución de Obra** — se instala físicamente el sistema.

## 3.3 Qué tiene que hacer Experiencia Solar en E1

Según el carril formal: mandar la **bienvenida**, hacer **seguimiento semanal** y
**registrar** todo en la bitácora.

**Cuánto dura esta espera (medido en producción):**
- Entre la venta y la fecha de obra pasan **33 días en promedio**, con casos de
  hasta **89 días**.
- **Al día de hoy hay 13 clientes vendidos esperando sin fecha de obra**, en
  promedio hace **30 días**; el que más espera lleva **51 días**.

> **Este es el hueco más grande del proceso.** El cliente firmó, normalmente pagó
> una seña, y pasa alrededor de un mes sin ningún hito que comunicar. El siguiente
> evento natural sería la fecha de obra, que es justamente lo que todavía no
> existe.

## 3.4 La fecha de obra

El sistema tiene un **calendario de instalaciones**. Cada obra se agenda con uno o
más tramos (una obra puede partirse en varios días), se le asigna un equipo, y
tiene dos estados:

- **Tentativa** — agendada pero sin confirmar.
- **Confirmada** — alguien apretó "Confirmar", quedando registrado quién y cuándo.

> **Problema verificado:** de 33 obras agendadas en producción, **6 quedaron como
> tentativa y nunca se confirmaron**, y sus fechas ya pasaron hace 18, 72, 106,
> 120, 121 y 144 días. La obra se hizo, pero nadie apretó confirmar. Como la
> confirmación debería ser el momento en que el cliente recibe su fecha firme,
> esos clientes nunca tuvieron una confirmación formal.

> **Problema verificado:** al agendar, confirmar o reprogramar una obra **el
> sistema no emite ninguna notificación ni correo**. Solo queda registrado en la
> auditoría interna. Nadie le avisa al cliente automáticamente.

## 3.5 La obra

La ejecuta Operaciones, con el **capataz** liderando en el lugar. Durante la obra
suele haber movimientos que el cliente percibe: entrega de materiales, visitas del
equipo, jornadas parciales.

> **Problema conocido:** las entregas de materiales y las visitas intermedias **no
> se agendan como eventos**. Existen solo como casillas internas de checklist
> ("Materiales recibidos en depósito", "Materiales físicos entregados"). Si no
> están agendadas, nadie puede avisarle al cliente que van a ir a su casa.

## 3.6 Fin de la obra

Al completarse la etapa de Ejecución de Obra se disparan dos cosas
automáticamente:
1. El **traspaso T7** hacia Experiencia Solar y Tramitación UTE.
2. Una **encuesta de satisfacción de obra** para el cliente.

> **Observación:** el primer contacto automático que recibe el cliente al terminar
> la obra es un **pedido de opinión**, no un aviso de que terminó y de qué sigue.
> Y ese pedido llega como notificación **dentro del portal**, no por correo.

---

# 4. Etapa E2 — De la obra a la habilitación

## 4.1 Qué pasa

Terminada la obra, arranca el **trámite ante UTE** para que autoricen la conexión.
Es el tramo **más largo y menos controlable**, porque la demora depende de UTE.

**Durante todo este tiempo el cliente ya tiene los paneles instalados y no puede
usarlos.** Es una situación incómoda: pagó, ve el equipo en su techo, y no genera.

## 4.2 El trámite y sus hitos

El sistema modela el trámite con una secuencia de hitos, que son los que el
cliente puede ver en su portal:

1. Consulta enviada
2. Caso abierto
3. Consulta aprobada
4. Solicitud presentada
5. Proyecto aprobado
6. Documentos de obra enviados
7. Documentos de obra aprobados
8. Ensayos enviados
9. Ensayos aprobados
10. Documentación final
11. Trámite finalizado

Cada hito tiene una fecha o está vacío. El portal los muestra como una línea de
tiempo: verde si tiene fecha, gris si no.

> **Problema:** cuando un hito avanza, **el timeline cambia en silencio**. No se
> emite ningún aviso al cliente. Si quiere saber si avanzó algo, tiene que entrar
> al portal y mirar — y como se verá más adelante, el 76% de los clientes ni
> siquiera tiene acceso al portal creado.

## 4.3 Qué tiene que hacer Experiencia Solar en E2

Según el carril formal: avisar el **inicio del trámite**, hacer **seguimiento
semanal**, y dar el **aviso de habilitación** cuando UTE autoriza.

## 4.4 El fin del trámite: el momento más crítico del proceso

Cuando el trámite termina, alguien de Tramitación UTE cierra la etapa y el sistema
genera el **traspaso T8** hacia Experiencia Solar.

**Ese traspaso hay que confirmarlo manualmente.** Cuando alguien lo confirma,
recién ahí el sistema:
- marca el proyecto como habilitado y lo pasa a la etapa E3,
- guarda la **fecha de habilitación**, que es el ancla de todo lo que viene
  después (aniversarios, mantenimientos, encuestas anuales, reportes),
- y **arranca el reloj de la "Regla de Oro"**.

> **Problema grave verificado:** la fecha de habilitación **se escribe en un solo
> lugar del sistema: al confirmar manualmente ese traspaso**. Si la persona que lo
> originó no entra a confirmarlo, **nada de lo anterior ocurre**: no arranca la
> Regla de Oro, no hay ancla para aniversarios ni mantenimientos, y el proyecto no
> pasa a E3. Además, **solo puede confirmarlo la misma persona que lo originó**;
> si está de licencia o ya no trabaja, queda trabado. La única red de seguridad es
> que a los 5 días hábiles el traspaso se marca como "escalado" y se avisa a los
> administradores.

## 4.5 La "Regla de Oro" (aviso de que ya puede encender)

Es el compromiso interno de avisarle al cliente dentro de las **24 a 48 horas** de
que UTE habilitó, para que empiece a generar cuanto antes. **Cada día que pasa es
dinero que el cliente deja de ahorrar.**

**Cómo funciona el sistema:**
- Un proceso automático corre **cada 3 horas**.
- Busca proyectos que ya estén habilitados pero donde todavía **no se registró el
  aviso al cliente**.
- **A las 24 horas** manda una notificación interna a Experiencia Solar:
  *"Avisá al Generador que puede encender: {cliente}"*.
- **A las 48 horas** escala a los administradores: *"Aviso al Generador VENCIDO…
  Regla de Oro incumplida"*.
- En el listado de clientes aparece un cartel **"⚠ Aviso pendiente"**.

**Cómo se apaga la alarma:** cuando alguien registra en la bitácora del cliente
una interacción con el motivo **"Aviso de habilitación"**. Hay un botón directo
en la ficha del cliente: **"Marcar avisado al Generador"**.

> **El sistema NO le avisa al cliente.** Solo alerta internamente. El aviso real lo
> hace una persona, normalmente por WhatsApp.

> **Problema:** las notificaciones tienen "deduplicación de por vida": el aviso de
> 24h se emite **una sola vez** y el de 48h **una sola vez**. Después de eso, el
> sistema **no vuelve a insistir nunca más**. Queda solo el cartel en el listado,
> que además no se puede filtrar ni ordenar.

> **Dato de producción: hay 6 clientes con el aviso de habilitación pendiente en
> este momento.** Son clientes que podrían estar habilitados sin saberlo.

---

# 5. Etapa E3 — De la habilitación al uso continuo

## 5.1 Lo que debería pasar

Según el pipeline, tres tareas: **capacitación al cliente**, **alta en la
plataforma de monitoreo** y **garantías y documentación final**. Ninguna tiene
casilla de verificación ni plazo, y no bloquean nada.

## 5.2 Lo que sí funciona automáticamente en E3

### Monitoreo diario de plantas (funciona muy bien)

Todos los días a las **08:00** el sistema revisa **el día anterior completo** de
todas las plantas conectadas y detecta si alguna dejó de generar.

Clasifica cada planta en: `OK`, `SIN_GENERACION`, `SIN_COMUNICACION`,
`ERROR_DISPOSITIVO`, `SIN_DATOS_API`, `ESPERANDO_HABILITACION` o `SILENCIADA`.
Cuando detecta un problema abre una **incidencia**, y la cierra sola cuando la
planta vuelve a generar.

Sale un **correo diario** con lo nuevo (solo lo que empieza, para no repetir todos
los días lo mismo).

Detalles de diseño que importan:
- Si el **40% o más** de la flota aparece sin generar el mismo día, se asume que
  es un temporal y **no se abren incidencias individuales** (evita mandar 60
  alertas de pánico un día de tormenta).
- Si más del **30%** de las plantas no se pudo consultar, la corrida se marca como
  errónea y **no se toca ninguna incidencia**.
- La falta de comunicación se mide en **36 horas**, no 24, para no dar falsos
  positivos en días nublados.

> **Limitación:** ese correo diario va a **una sola casilla configurada**, no al
> equipo de Experiencia Solar por defecto.

### Reportes fotovoltaicos mensuales

Cada mes el sistema:
- **Días 2, 4 y 6:** trae automáticamente las lecturas de generación de los
  inversores (dos marcas soportadas).
- **Día 7:** calcula y genera los PDF de cada cliente.
- **Día 9:** los enviaría por correo — pero **este envío está desactivado por
  defecto**. En la práctica, **alguien tiene que apretar "Enviar" a mano**.

Ese reporte es **el único correo que el sistema le manda al cliente**.

### Encuestas de satisfacción

Se generan solas en tres momentos:
- Al cerrar la **obra**
- Al terminar el **trámite UTE**
- En cada **aniversario** de la habilitación (cron diario a las 06:00, con tope de
  2 años)

El cliente responde con una nota de **1 a 5** y un comentario opcional.
Si la nota es **3 o menos**, se dispara automáticamente el **traspaso T11** hacia
Experiencia Solar, para que alguien se ocupe.

> **Problema:** el aviso de que hay una encuesta nueva es **solo una notificación
> dentro del portal**. Nunca sale un correo. Si el cliente no entra al portal, no
> se entera. Y si el proyecto **no tiene usuario de portal creado**, la encuesta se
> genera igual y **nadie la ve nunca**.

> **Dato de producción: 18 encuestas pendientes contra 1 respondida.**

### Mantenimientos

El contrato promete **mantenimiento anual sin cargo los primeros 2 años**.

> **No existe ninguna maquinaria para cumplirlo.** No hay una entidad de
> mantenimiento en el sistema. Lo único que hay es una **columna calculada al
> vuelo** en el listado de clientes ("Próximo mantenimiento"), que muestra qué
> aniversario cumple y cuántos días faltan, y se pinta de ámbar si faltan menos de
> 30 días. **No hay alerta, ni recordatorio, ni forma de registrar que se hizo.**
> Los avisos T12 (cliente agendó mantenimiento) y T13 (mantenimiento ejecutado)
> están definidos en el sistema pero **nunca se disparan**.

---

# 6. Las herramientas de Voltia PM, una por una

El área de Experiencia Solar tiene su propio menú, con estas solapas:
**Generadores · Reportes FV · Monitoreo · Cobros · Encuestas**.
(Los tickets viven fuera, en "Mis tareas".)

## 6.1 Listado de Generadores

La pantalla principal. Una fila por cliente, con **edición directa sobre la
tabla** (se hace clic en la celda y se edita).

**Columnas:** Nombre · Estado · Etapa (E1/E2/E3) · Último contacto · Asesor ·
Departamento · Potencia · Fecha de entrega · Próximo mantenimiento · Teléfono ·
Mail · Usuario (si tiene acceso al portal).

**Señales visuales:**
- **Último contacto** se pinta de ámbar si pasaron **más de 7 días**.
- Cartel **"⚠ Aviso pendiente"** si está habilitado pero no se le avisó.
- **Próximo mantenimiento** en ámbar si faltan menos de 30 días.
- Etiqueta verde **"Con acceso"** o botón **"Crear usuario"** según tenga o no
  portal.

**Acciones:** filtrar (texto, estado, asesor, departamento, etapa), ordenar,
**exportar a CSV**, **importar desde CSV** (para cargar clientes viejos de una
planilla) y **crear el usuario de portal** del cliente.

> **Inconsistencia:** el umbral de "más de 7 días" está fijo en la pantalla,
> mientras que el sistema tiene una configuración de cadencia por etapa
> (E1: 3 días, E2: 5, E3: 10). Son dos criterios distintos conviviendo.

> **Faltante:** no se puede filtrar por "aviso pendiente" ni por "sin contacto".

## 6.2 Ficha del cliente

Se abre al hacer clic en una fila. Tiene:

- **Datos del cliente:** nombre, mail, teléfono, dirección, departamento,
  potencia, fecha de venta, fecha de entrega, estado, etapa, asesor.
- **Estado del trámite UTE** (en qué etapa está y desde cuándo).
- **Bitácora de interacciones** — el registro de contactos.
- **Historial (timeline)** — un hilo único con todo lo que pasó.
- Enlace al proyecto técnico.

### La bitácora de interacciones

Es donde se registra cada contacto con el cliente. Cada registro tiene:

- **Canal:** WhatsApp · Email · Llamada · Visita · Otro
- **Dirección:** Entrante · Saliente
- **Motivo:** Bienvenida · Seguimiento · Aviso de habilitación · Consulta · Otro
- **Texto libre** (hasta 2000 caracteres)

Hay un botón directo **"Marcar avisado al Generador"** que crea la interacción con
motivo "Aviso de habilitación" y apaga la alarma de la Regla de Oro.

**Es 100% manual.** Lo que no se escribe a mano, no existe para el sistema.
La última interacción registrada es la que alimenta la columna "Último contacto".

### El historial (timeline)

Junta en un solo hilo ordenado por fecha:
- Actividad del lead original (etapa comercial)
- **Comentarios del proyecto** (incluidos los dejados dentro de una etapa,
  subetapa o tarea, indicando de dónde salieron)
- Interacciones de la bitácora (con su canal, dirección y motivo)
- Avances de etapa del proyecto
- Traspasos entre áreas
- Tickets (apertura y resolución)
- Documentos publicados (contrato, proforma, propuesta)
- Encuestas respondidas

> Esta es la pieza que permite que Experiencia Solar vea qué pasó **sin tener que
> preguntarle a cada área**.

## 6.3 Tickets (reclamos)

Un ticket es un reclamo o consulta. Puede abrirlo alguien de adentro o **el propio
cliente desde el portal**.

**Estados:** Abierto → Derivado / En progreso → Resuelto → Cerrado.
**Prioridad:** Baja · Media · Alta.

**Acciones:** comentar (con opción de **comentario interno**, que el cliente no
ve), **derivar** a Ingeniería u Operaciones, marcar en progreso, resolver, cerrar,
editar y eliminar (solo administrador).

Cuando se **deriva** se dispara el traspaso T9; cuando se **resuelve**, el T10
hacia Experiencia Solar, y el cliente recibe una notificación en el portal.

> **Problemas verificados:**
> - **Cuando un cliente abre un ticket desde el portal, no se notifica a nadie
>   internamente.** No se crea notificación ni traspaso ni correo. La única forma
>   de enterarse es entrar a la pantalla de tickets y mirar. No hay contador ni
>   aviso.
> - **No hay plazos ni escalación de tickets.** Un ticket abierto puede quedar
>   meses sin que nada lo señale.
> - **No existe la asignación.** El campo "asignado a" está en el sistema pero
>   **nunca se completa**: no hay forma de saber quién es el dueño de un reclamo.
> - No se pueden adjuntar archivos (ni una foto del problema).
> - No hay métrica de tiempo de respuesta ni de resolución.

## 6.4 Encuestas

Pantalla de **solo lectura** con todas las encuestas, filtrables por tipo
(instalación / habilitación / aniversario), estado (pendiente / respondida) y
**"solo nota baja"**. Al hacer clic se abre la respuesta completa: estrellas,
comentario, quién respondió y cuándo, y un aviso si fue nota baja.

> **Faltantes:** no se puede registrar una respuesta que el cliente dio por
> teléfono, ni reenviar la encuesta, ni anularla. **No hay ninguna métrica
> agregada** — ni promedio, ni tasa de respuesta, ni evolución.

## 6.5 Monitoreo de plantas

Tres vistas: **Estado de las plantas** (con su diagnóstico de ayer y cuántos días
lleva sin generar), **Historial de incidencias** y **Revisiones** (las últimas
corridas del proceso automático).

Al hacer clic en una planta se abre su detalle con el gráfico de los últimos 30
días y las acciones: **marcar revisada**, **descartar** (exige un motivo) y
**silenciar** (siempre hasta una fecha, nunca para siempre).

Hay un botón **"Revisar ahora"** para forzar una corrida manual.

## 6.6 Reportes fotovoltaicos

Panel del ciclo mensual: traer lecturas, recalcular, emitir los PDF y enviarlos.
El envío puede ser individual o en lote. El cliente los ve en su portal y los
recibe por correo cuando se le envían.

## 6.7 Cobros

Solapa para ver y gestionar los pagos de los clientes **sin entrar a Finanzas**
(no se ven gastos ni el resto de la parte financiera). Permite registrar un cobro,
marcarlo como pagado, editar el monto y **copiar un resumen listo para WhatsApp**.

## 6.8 Traspasos ("Pendientes")

El sistema de avisos entre áreas. Cuando una etapa se completa, se genera un
traspaso hacia el área que sigue. Quien lo recibe lo **confirma**, y ahí se
notifica a los destinatarios.

Los que involucran a Experiencia Solar:

| Traspaso | Cuándo | Hacia |
|---|---|---|
| **T1** | Onboarding completado | Ingeniería + **Experiencia Solar** |
| **T4** | Validación de Operaciones (fecha de obra) | **Experiencia Solar** |
| **T7** | Obra terminada | **Experiencia Solar** + Tramitación UTE |
| **T8** | Trámite UTE finalizado | **Experiencia Solar** (dispara E3) |
| **T9** | Ticket derivado | Área técnica |
| **T10** | Ticket resuelto | **Experiencia Solar** |
| **T11** | Encuesta con nota baja | **Experiencia Solar** |
| T12 / T13 | Mantenimiento agendado / ejecutado | *definidos pero nunca se disparan* |

Si un traspaso queda sin confirmar **5 días hábiles**, se marca como escalado y se
avisa a los administradores. Se puede posponer 6 horas.

## 6.9 El portal del cliente

El cliente entra con usuario y contraseña. Ve **cuatro secciones**:

1. **Mis proyectos** — nombre, potencia, ubicación, número de caso UTE y un cartel
   "Trámite finalizado" o "En curso". Al entrar, la línea de tiempo de los 11
   hitos del trámite.
2. **Reportes** — sus reportes mensuales en PDF y un panel de energía. Puede
   cargar su día de corte de medidor, su tarifa y su potencia contratada.
3. **Mis tickets** — sus reclamos, y puede abrir nuevos.
4. **Encuestas** — las que tiene pendientes y las ya respondidas.

Más una **campana de notificaciones**.

> **Lo que el cliente NO ve, verificado:**
> - **Ninguna fecha de obra**, ni tentativa ni confirmada.
> - **En qué etapa está su proyecto.** Durante toda la obra el portal le muestra la
>   línea de tiempo del trámite UTE **entera en gris**, sin una sola fecha.
> - **Ningún documento**: ni contrato, ni propuesta, ni informe de visita técnica.
>   Solo los PDF de los reportes mensuales.
> - **Ningún nombre, teléfono o mail de contacto de Voltia.** Los únicos datos de
>   contacto que muestra el portal son **los de UTE**.
> - Calendario de obra, entregas de materiales o visitas agendadas.

---

# 7. Qué hace el sistema solo (automatismos y horarios)

Todos los procesos automáticos que existen, con su horario:

| Proceso | Cuándo corre | Qué hace | ¿Toca posventa? |
|---|---|---|---|
| Monitoreo de plantas | Todos los días 08:00 | Revisa generación del día anterior, abre/cierra incidencias, manda correo | **Sí** |
| Encuestas de aniversario | Todos los días 06:00 | Genera la encuesta anual (tope 2 años) | **Sí** |
| Regla de Oro | **Cada 3 horas** | Recuerda a las 24h, escala a las 48h | **Sí** |
| Reportes FV — traer lecturas | Días 2, 4 y 6 del mes 06:00 | Ingesta automática de generación | **Sí** |
| Reportes FV — emitir | Día 7 del mes 08:00 | Calcula y genera los PDF | **Sí** |
| Reportes FV — enviar | Día 9 del mes 12:00 | **Desactivado por defecto** | Sí (manual) |
| **Resumen diario por correo** | Cada hora, envía a la hora configurada | Junta las notificaciones del día y manda **un** correo por persona | **Sí, crítico** |
| Escalación de traspasos | Lunes a viernes 07:00 | Traspasos sin confirmar 5+ días hábiles → escalado | Sí |
| Avisos de vencimiento | Todos los días 09:00 | Subetapas por vencer | No (pipeline) |
| Reporte semanal de traspasos | Lunes 08:00 | Métricas a administradores | Parcial |
| Reporte semanal de indicadores | Lunes 00:01 | Indicadores del negocio | No |
| Cotización del dólar | Todos los días 17:00 | Trae la cotización | No |
| Novedades del sistema | Lunes y jueves 07:00 | Changelog al equipo | No |

## El resumen diario por correo — la pieza clave

Es **el único mecanismo que convierte las notificaciones de la campana en un
correo**. Junta lo de las últimas 24 horas por persona, agrupado por proyecto, y
manda un solo mail a la hora configurada (por defecto 08:00).

**Es opt-in por rol.** Hay una pantalla de administración donde se elige qué tipo
de aviso recibe cada rol.

> **Problema grave verificado en producción:** la tabla de configuración tiene
> **10 filas y todas son del rol Administrador**. **El rol de Experiencia Solar no
> tiene ninguna.** Como sin configuración un rol no recibe nada, **la responsable
> de Experiencia Solar no recibe ni un solo correo de alerta**: ni avisos de
> habilitación pendientes, ni traspasos asignados, ni tickets, ni encuestas.
> **Todo depende de que abra la aplicación y mire la campana.**
>
> Es un arreglo trivial (cargar filas en una tabla) con impacto inmediato.

## Los tipos de aviso que existen

`goals_not_configured` · `deadline_warning` · `prev_substage_completed` ·
`engineering_completed` · `traspaso_asignado` · `traspaso_escalado` ·
`traspaso_por_confirmar` · `aviso_habilitacion_pendiente` · `ticket_actualizado` ·
`encuesta_disponible`

**De estos, solo dos llegan al cliente:** `ticket_actualizado` (comentaron o
resolvieron su ticket) y `encuesta_disponible`. Los otros ocho son internos.

---

# 8. Comunicación con el cliente: canales, límites y por qué

## Qué recibe el cliente hoy

| Canal | Qué |
|---|---|
| **Correo** | **Solo el reporte fotovoltaico mensual** — y su envío automático está apagado, lo dispara una persona |
| **Notificación en el portal** | Que su ticket se movió · que tiene una encuesta |
| **WhatsApp / llamada** | Todo lo demás — **lo hace una persona a mano** |

## Los bloqueos de seguridad y por qué existen

En **mayo de 2026 hubo un incidente**: 27 clientes recibieron información interna
por correo. A partir de ahí se pusieron tres bloqueos:

1. **Correo:** por defecto **solo se puede enviar a direcciones que existan como
   usuarios internos**. Para escribirle a un cliente hay que marcar el envío
   explícitamente como "dirigido al cliente".
2. **WhatsApp:** el mismo bloqueo, y **hoy no hay ni un solo uso habilitado hacia
   clientes**. En la práctica, **el sistema no puede escribirle por WhatsApp a un
   cliente**.
3. **Tickets:** los avisos al cliente son siempre dentro del portal, **nunca por
   correo**, por decisión explícita.

**Consecuencia:** el sistema **no tiene ningún canal automático de salida hacia el
cliente durante la obra y el trámite**. Todo depende de que una persona escriba.

## Plantillas de correo

Existen **dos plantillas**, y las dos van **a UTE**, no al cliente: "Consulta UTE"
y "Suministro individual".

> **No existe ninguna plantilla de correo dirigida al cliente.** Ni de bienvenida,
> ni de habilitación, ni de encuesta, ni de mantenimiento.

## El alta al portal

Cuando se le crea el usuario al cliente, **el sistema no manda ningún correo**. Se
genera un texto de bienvenida que **se copia al portapapeles** para que alguien lo
pegue a mano en WhatsApp o en un mail.

---

# 9. Roles y permisos

El sistema controla todo con una matriz de **rol × módulo × acción**. Las acciones
son: Ver, Crear, Editar, Eliminar, Completar, Comentar, Acceder, Confirmar.

## Qué puede el rol "Experiencia Solar" (verificado en producción)

| Módulo | Acciones |
|---|---|
| Experiencia de clientes | Ver, Crear, Editar, Eliminar |
| **Operaciones** | Ver, Crear, Editar, Completar, Comentar |
| Portal del cliente | Ver, Crear, Editar |
| Postventa | Ver, Comentar |
| Trámites UTE | Ver |
| Métricas | Ver |
| Traspasos | Ver, Confirmar |
| Tickets | Ver, Crear, Editar |
| Encuestas | Ver |
| Ventas | Ver |

## Quién puede registrar en la bitácora del cliente

**Pueden:** Administrador · Asesor comercial · Gerente Comercial · Postventa ·
Experiencia Solar.

**No pueden: Operaciones ni Ingeniería.** O sea, **el capataz no puede cargar en
la bitácora**.

> **Matiz importante:** el capataz **sí puede comentar el proyecto** (el endpoint
> de comentarios no exige permiso de módulo), y **esos comentarios aparecen en el
> historial de la ficha del cliente**, indicando de dónde salieron. Así que el
> canal de registro existe — lo que no puede es cargar una "interacción" formal,
> que es lo que mueve la columna "Último contacto".

> **Dato de producción:** de **67 interacciones registradas en 180 días, 65 las
> cargó la responsable de Experiencia Solar**. El registro compartido, en la
> práctica, no está ocurriendo.

---

# 10. Datos reales de producción (agosto 2026)

| Medición | Valor | Qué significa |
|---|---|---|
| Clientes **sin acceso al portal** | **72 de 95 (76%)** | El único canal por donde el sistema avisa algo no lo tiene la mayoría |
| Encuestas pendientes / respondidas | **18 / 1** | Tasa de respuesta ~5% |
| Tickets totales | **5** (ninguno abierto) | El canal está vacío: el reclamo real ocurre por WhatsApp |
| **Avisos de habilitación pendientes** | **6** | Clientes que podrían no saber que ya pueden encender |
| Proyectos activos **sin ningún contacto registrado** | **8** | Varios con 35-38 días |
| Interacciones registradas en 90 días | 67 | Para toda la cartera |
| Quién registra | **65 de 67 una sola persona** | El registro compartido no ocurre |
| Roles que reciben alertas por correo | **solo Administrador** | Experiencia Solar no recibe ninguna |
| Cadencia configurada | E1: 3 días · E2: 5 · E3: 10 | La regla existe y está activa |
| Días entre venta y obra | **33 promedio**, hasta 89 | |
| **Clientes esperando fecha de obra hoy** | **13**, hace 30 días promedio (máx. 51) | |
| Obras agendadas sin confirmar | **6 de 33** | Fechas ya pasadas hace 18 a 144 días |
| Personas en el área | **1** | |

---

# 11. Problemas conocidos, errores y agujeros

## Errores del sistema (están rotos, no son faltantes)

1. **Un reclamo abierto por el cliente no avisa a nadie.** Se crea la fila y nada
   más: sin notificación, sin traspaso, sin correo. Ni siquiera existe el tipo de
   aviso "ticket nuevo".
2. **La segunda nota baja del mismo cliente se silencia.** El sistema evita
   duplicar traspasos, pero no distingue los ya resueltos: si un cliente puso 2/5
   en la encuesta de obra y ese aviso se confirmó, **su nota baja de habilitación
   o de aniversario no genera un aviso nuevo**. Un cliente crónicamente
   insatisfecho genera **una sola alerta en toda su vida**.
3. **La alerta de nota baja puede no llegar a nadie.** Los destinatarios se
   calculan como "el rol Experiencia Solar **menos quien lo originó**". Como el
   área tiene **una sola persona**, y el sistema la elige a ella como originadora,
   **los destinatarios quedan en cero**. Solo llega a los administradores en copia.
4. **Los correos al cliente no cuentan como contacto.** Quedan registrados como
   correo enviado, pero **no crean una interacción**: no mueven "Último contacto"
   ni aparecen en el historial. Se le pueden mandar 5 mails a un cliente y el
   sistema lo sigue mostrando como "sin contacto hace 90 días".
5. **El panel de "clientes sin comunicación" excluye la cartera post-habilitación.**
   Filtra solo proyectos activos y descarta los importados por planilla → **los
   proyectos ya terminados (donde vive E3) desaparecen del listado**.
6. **Todo E3 depende de un clic.** La fecha de habilitación se escribe únicamente
   al confirmar manualmente el traspaso T8, y solo puede confirmarlo quien lo
   originó.

## Agujeros estructurales

7. **Post-habilitación es una etapa hueca**: sus tres tareas no tienen casillas,
   ni plazos, ni responsable del área, no cierran nada, y **están excluidas del
   análisis de "dónde se rompe el proceso"**.
8. **No hay carril de seguimiento para E3.** Los carriles cubren pre-obra y
   habilitación. Después de que el cliente enciende, no hay estructura.
9. **El mantenimiento anual del contrato no tiene maquinaria.**
10. **No hay ninguna métrica de satisfacción** (ni promedio, ni tasa de respuesta,
    ni evolución) ni **panel de indicadores del área**.
11. **No hay una vista de "mi día"** para Experiencia Solar: hay que recorrer
    cuatro pantallas distintas y acordarse de las cuatro.
12. **El "seguimiento semanal" es una casilla de una sola vez**: se tilda y queda
    tildada para siempre. No es recurrente ni vence.
13. **Hay una función de "completar todo"** que marca todas las casillas de una
    etapa **sin validarlas**, salteando los controles.
14. **Dos criterios distintos de "sin contacto"** conviviendo: 7 días fijos en la
    pantalla vs. la cadencia configurable (3/5/10).
15. **Las entregas de materiales y visitas intermedias no se agendan**, así que no
    hay forma de avisarle al cliente que van a ir.
16. **Al agendar, confirmar o reprogramar una obra no se emite ningún aviso.**

---

# 12. Decisiones de procedimiento ya tomadas

Acordadas en la conversación que originó este documento.

## Principio rector

> **Experiencia Solar es la dueña del caso, no el canal por donde pasa todo.**

No es intermediaria obligatoria (eso sería un teléfono descompuesto que no
escala). Es la responsable de que el cliente esté informado, aunque otros hablen
con él. La analogía es el **médico de cabecera**: el especialista atiende directo,
pero él es el referente y tiene la historia clínica completa.

**Dos reglas:**
1. **Nunca se le devuelve el organigrama al cliente.** Decirle *"mi función es
   coordinar la primera fecha"* o *"eso lo tenés que hablar con el capataz"* es
   explicarle cómo está organizada la empresa por dentro. Él contrató a Voltia, no
   a un área.
2. **La pelota circula internamente, nunca a través del cliente.** Si preguntan
   algo que no es de uno, se responde *"te averiguo y te confirmo"* y se resuelve
   puertas adentro. **El cliente no es el mensajero.**

## Quién habla con el cliente

| Tipo de mensaje | Quién |
|---|---|
| Operativo del día en obra (horarios, accesos) | **El capataz, directo** |
| Compromisos y fechas | **Experiencia Solar** |
| Estado general | **Experiencia Solar** |
| Malas noticias y reclamos | **Experiencia Solar** |

## Entrada del cliente al área

El **comercial presenta a Experiencia Solar y comparte su contacto**, avisando que
**ella lo va a contactar a la brevedad**. El cliente **nunca tiene que escribir
primero**. Razón: si aparece alguien desconocido, el cliente desconfía de si es
realmente de la empresa.

Experiencia Solar debe recibir ese aviso **por correo, en el resumen diario de la
mañana**, además de en la campana.

## Cadencia

**No se le promete al cliente ninguna frecuencia de contacto** (prometer y no
cumplir es peor que no prometer). Se le garantiza que **en cada hito se entera**.

**Excepción como estándar interno de trabajo:** durante la espera pre-obra
(~30 días), **contacto semanal**, aunque no haya novedades. No se le promete por
escrito; es el estándar del área.

**Como no hay contacto de rutina, la conversación de expectativa inicial es
obligatoria.**

## Los 7 hitos que se avisan sí o sí

1. **Bienvenida** — quién es su referente, el recorrido completo y cuánto demora
   cada etapa, incluido el trámite de UTE.
2. **Fecha de obra** — primero tentativa, después **confirmada**. Toda
   reprogramación se comunica **el mismo día**.
3. **Cualquier visita a su propiedad** — incluido el relevamiento técnico y la
   entrega de materiales. **Regla: si no está agendado, no se va.**
4. **Obra terminada** — y qué sigue ahora, con el plazo del trámite.
5. **Ya podés encender** — dentro de 24-48 h de la habilitación.
6. **Capacitación** — en el mismo contacto que el hito 5: cómo usar la app, qué
   generación esperar, accesos.
7. **Garantías y cierre** — documentación final, alcance de la garantía y el
   mantenimiento anual sin cargo de los primeros 2 años.

Decisiones asociadas:
- **"Confirmar" la fecha en el sistema debería significar que el cliente ya tiene
  su fecha firme** — un solo acto, no dos, para que nadie suponga que el otro
  avisó.
- **Las reprogramaciones se avisan el mismo día**, aunque todavía no haya fecha
  nueva.

## La tabla de referentes que se le entrega al cliente

| Si querés saber… | Escribile a |
|---|---|
| Horarios, accesos, el día a día de la obra | El capataz asignado |
| Cuándo arranca / termina / si se reprogramó | Experiencia Solar |
| Cómo viene el trámite de UTE | Experiencia Solar |
| Facturación y pagos | Experiencia Solar |
| **Cualquier otra cosa, o no sabés a quién** | **Experiencia Solar** |

**Salvaguarda:** se presenta como *"este es tu equipo"*, nunca como *"estas son
nuestras áreas"*, y **no puede usarse para rebotar** a un cliente que preguntó en
el lugar equivocado.

## Rol del comercial después de la venta

Queda **disponible en segundo plano**: no lleva el seguimiento, pero si el cliente
le escribe le responde y le avisa a Experiencia Solar (y lo registra).

## La ficha como historia clínica

**Todas las áreas registran sus intercambios con el cliente**, para que Experiencia
Solar tenga la película completa sin preguntar.

**Regla de diseño:** *el registro se hace donde cada uno ya está trabajando; la
lectura se consolida en la ficha del cliente.* Si al capataz se lo obliga a entrar
al módulo de Experiencia Solar, no lo va a hacer. **Si registrar cuesta, no se
registra.**

## Las tres vistas no se unifican

Un cliente aparece en tres lugares y **eso es correcto**:

| Vista | Pregunta que responde | Quién |
|---|---|---|
| Lead | *¿Vamos a vender esto?* | Comercial |
| Proyecto | *¿Cómo ejecuto esto?* | Ingeniería, Operaciones |
| Ficha del cliente | *¿Cómo está la relación?* | Experiencia Solar |

Se unifican **los datos y el historial**, no las pantallas. Regla: **cada vista
muestra en primer plano lo suyo y en segundo plano un resumen de lo demás**.

## Reclamos

**Respuesta el mismo día hábil, siempre**, aunque sea *"lo estoy viendo, mañana te
confirmo"*.

## Tono

Principios: no explicar el organigrama · no dejar sin respuesta · **cerrar siempre
con el próximo paso** · las malas noticias se dan **antes** de que el cliente
pregunte.

## Canal

**El sistema no le escribe al cliente por su cuenta.** Le arma a la persona el
mensaje listo para copiar y le recuerda cuándo. No se levanta el bloqueo de
WhatsApp.

---

# 13. Preguntas abiertas para trabajar

1. **El hueco de E2.** El trámite de UTE puede durar meses y se decidió no darle
   aviso de inicio propio (se cubre en la bienvenida). ¿Alcanza? ¿O hace falta
   algún punto de contacto intermedio, como en pre-obra?
2. **Qué pasa después del hito 7.** No hay carril de seguimiento para E3. Un
   cliente habilitado hace 8 meses, ¿qué contacto debería tener? Hoy: nada, salvo
   el reporte mensual y la encuesta anual.
3. **El mantenimiento anual.** Está prometido en el contrato y no existe en el
   sistema. ¿Quién lo agenda, con cuánta anticipación se avisa, y qué pasa si el
   cliente no responde?
4. **El portal.** El 76% no tiene acceso. ¿Se masifica (y se vuelve un canal real)
   o se asume que es marginal y todo pasa por WhatsApp?
5. **Las encuestas.** Con 18/1 de respuesta, ¿tiene sentido el mecanismo actual?
   ¿Se pregunta por otro canal, o se registra la respuesta que el cliente da
   informalmente?
6. **Medición.** No hay ninguna métrica del área. ¿Qué habría que poder medir para
   saber si esto mejora? (tiempo de respuesta, clientes fuera de cadencia,
   satisfacción, avisos cumplidos en plazo)
7. **Escala.** Todo esto lo sostiene una persona con ~95 clientes. ¿Qué pasa
   cuando sean 200? ¿Qué tiene que estar automatizado antes de ese punto?
8. **Los 6 avisos de habilitación pendientes y los 13 clientes esperando fecha.**
   Son situaciones abiertas hoy, no hipótesis.

---

*Documento generado a partir de la lectura del código de Voltia PM y de consultas
a la base de datos de producción, en agosto de 2026.*
