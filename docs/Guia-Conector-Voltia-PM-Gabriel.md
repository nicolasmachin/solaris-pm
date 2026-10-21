# Cómo usar Voltia PM desde Claude

**Para:** Gabriel Vera, gerente de Operaciones · **Octubre 2026**

> Con el conector de Voltia PM, Claude puede leer y analizar lo que hay en Voltia PM: las obras, sus etapas, los pagos a instaladores y, ahora, **las plantas de los clientes**: la generación, el inversor y el medidor en vivo, y las incidencias del monitoreo. Se le pregunta en lenguaje común y responde con los datos reales.

## 1. Conectarlo (una sola vez, desde la computadora)

Se hace **desde la computadora**, en la web de Claude. Desde el celular no se puede agregar, pero una vez agregado se usa también desde el celular.

1. Entrá a **claude.ai** con tu cuenta.
2. Andá a **Configuración → Conectores**.
3. Tocá **Agregar conector personalizado**.
4. Completá:
    - **Nombre:** Voltia PM
    - **URL:** `https://app.voltia.com.uy/mcp`
5. Tocá **Agregar** y después **Conectar**.
6. Se abre una pantalla de **Voltia PM**: entrá con **tu mail y tu contraseña de Voltia PM**, los mismos de siempre, y tocá **Autorizar**.

Listo: queda conectado y no hay que volver a hacerlo.

> Si en Configuración no aparece la opción de agregar un conector, o la pantalla de Voltia PM no te deja entrar, avisale a Nicolás.

## 2. Usarlo

1. Abrí una **conversación nueva** en Claude.
2. Fijate que el conector **Voltia PM** esté activado, en el botón de herramientas, abajo del cuadro donde se escribe.
3. Preguntá como le preguntarías a una persona.

**Algunos ejemplos** (la lista completa está en el punto 3):

**Plantas de los clientes**
- «¿Cómo viene generando la planta de Rodolfo Sosa en las últimas dos semanas, comparada con las demás?»
- «Mostrame la curva hora por hora de ayer de la planta de Estilo.»
- «¿Qué está midiendo ahora el inversor y el medidor de Álvaro García, fase por fase?»
- «¿Qué incidencias abiertas hay en el monitoreo de plantas?»
- «¿Alguna planta está exportando más de lo que genera?»

**Obras y operaciones**
- «¿Qué obras están vencidas o por vencer en Operaciones?»
- «¿Qué obras vendidas no tienen fecha de instalación?»
- «¿Cómo viene la obra de Barrella? ¿En qué etapa está y quién la tiene?»
- «¿Qué pagos a instaladores tercerizados están pendientes?»
- «¿Qué documentos tiene cargados la obra de Pereyra? Leeme la memoria.»

## 3. Todo lo que podés hacer

Esto es lo que el conector te deja hacer con tu usuario. No hace falta saber el nombre de cada función: se pide con palabras comunes y Claude elige.

**Obras**

| Qué | Ejemplo |
|---|---|
| Buscar una obra por cliente o código | «Buscame la obra de Maurán» |
| Ver cómo viene una obra: etapa, plazo, atraso, potencia, fechas, cuadrilla y trámite de UTE | «¿Cómo viene Barenof?» |
| Ver las etapas y subetapas, con responsable y estado, o solo lo que falta | «¿Qué le falta a la obra de Suárez?» |
| **Marcar una subetapa** (por ejemplo, completada o no aplica). Primero te muestra qué va a cambiar y te pide confirmar; sigue las mismas reglas que Voltia PM | «Marcá como completada la fecha de obra confirmada de Maurán» |
| Ver los datos técnicos: paneles, inversor, red, techo y si va coplanar o inclinado, y el presupuesto de mano de obra al tercerizado | «¿Qué datos técnicos tiene la obra de Rodríguez?» |
| Leer el **informe del capataz** completo: el informe, las notas y lo que dijo en los audios | «Leeme el informe del capataz de Barrella» |
| Revisar los **entregables** para el control de obra: cuántas fotos de la lista hay, los videos de los ensayos y el final, los documentos de UTE firmados y el retiro de sobrantes | «¿Está todo cargado en la obra de Suárez para cerrarla?» |
| Ver los materiales con su estado de compra, y las fotos y videos de la obra | «¿Están comprados los materiales de Rodríguez?» |
| Listar los documentos de la obra y **leerlos**: memorias, listas de materiales, planillas; los planos (unifilar, gabinete) los ve como imagen | «Leeme la lista de materiales de Pereyra» |
| Ver la historia completa: etapas, comentarios, contactos, traspasos y tickets | «¿Qué pasó esta semana con la obra de Michelena?» |
| Ver los pendientes de la obra de todo el equipo | «¿Qué pendientes hay en la obra de Ferrari?» |
| **Dejar un comentario** en la obra | «Anotá en la obra de Barrella que el cliente pidió mover el inversor» |

**Control de Operaciones**

| Qué | Ejemplo |
|---|---|
| Obras con la etapa vencida o por vencer, de la más atrasada a la menos | «¿Qué obras de Operaciones están vencidas?» |
| Obras vendidas sin fecha de instalación | «¿Qué obras no tienen fecha?» |
| **El calendario de obras**: las próximas semanas por cuadrilla y por tercerizado, fechas tentativas y confirmadas, y los días libres | «¿Cómo viene el calendario de las próximas tres semanas?» |
| **Tickets y mantenimientos**: los reclamos abiertos y los mantenimientos que vienen | «¿Qué tickets hay abiertos y qué mantenimientos vienen?» |
| Cuánto dura de verdad cada etapa y cuánto se cumple el plazo | «¿Cuánto está tardando Validación de Operaciones?» |
| Los trámites de UTE sin habilitar: a quién le toca y cuánto tarda cada paso | «¿Qué trámites de UTE están esperando por nosotros?» |
| El trámite de UTE de una obra, hito por hito | «¿En qué está el trámite de Correa?» |
| Los pagos a instaladores tercerizados: pagado, saldo, vencidos y obras sin instalador | «¿Qué le debemos a Fernando?» |

**Plantas de los clientes**

| Qué | Ejemplo |
|---|---|
| Buscar un cliente ya instalado y ver su ficha | «Mostrame la ficha de Álvaro García» |
| Generación día por día, comparada con las demás plantas | «¿Cómo genera Rodolfo Sosa este mes?» |
| La curva de un día, hora por hora | «La curva de ayer de Estilo» |
| El inversor y el medidor ahora mismo, fase por fase y string por string | «¿Qué marca ahora el medidor de Rodolfo?» |
| Las incidencias del monitoreo de toda la cartera o de una planta | «¿Qué plantas tienen incidencias abiertas?» |
| El último reporte mensual de un cliente | «¿Qué dice el último reporte de Calleros?» |

**Tus pendientes**

| Qué | Ejemplo |
|---|---|
| Ver tus pendientes, crear uno atado a una obra, completarlo o ponerlo en espera | «Recordame el jueves llamar al proveedor por la obra de Saravia» |

Si algo falla, pedile **«¿estás conectado a Voltia PM?»**: te muestra con qué usuario estás y qué podés ver.

## 4. Lo que tenés que saber

- **Son los datos reales de Voltia PM.** Lo que se lee es lo de producción, al momento.
- **Si le pedís que escriba algo** (un comentario, un pendiente o marcar una subetapa), **se hace de verdad y queda a tu nombre**, igual que si lo hicieras desde Voltia PM. Antes de que escriba, leé lo que te propone.
- **Ves lo mismo que ves en Voltia PM:** el conector respeta tus permisos.
- **Las fotos se cuentan, no se identifican:** Voltia PM sabe cuántas fotos hay contra las 23 de la lista, pero no cuál falta. Para eso hay que mirarlas.
- **Claude analiza, pero puede equivocarse.** Si un diagnóstico es importante (por ejemplo, mandar a alguien a una obra), confirmalo antes.
- **Las plantas Huawei a veces no responden** a la primera. Si una consulta falla, pedile que lo intente de nuevo. De Huawei hay datos **hora por hora**, no minuto a minuto.
- **Los datos de los clientes son confidenciales.** No compartas capturas de estas conversaciones fuera de Voltia.
- **No sirve para cambiar Voltia PM** (pantallas, funciones, permisos). Si ves algo que habría que mejorar, pasáselo a Nicolás.

## 5. Si algo no anda

- **No aparece Voltia PM en las herramientas:** fijate que esté activado, o abrí una conversación nueva.
- **Dice que no tenés permiso:** avisale a Nicolás qué estabas consultando.
- **Te pide volver a entrar:** repetí el paso 6, con tu mail y tu contraseña de Voltia PM.
