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

**Ejemplos de lo que le podés preguntar:**

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

## 3. Lo que tenés que saber

- **Son los datos reales de Voltia PM.** Lo que se lee es lo de producción, al momento.
- **Si le pedís que escriba algo** (un comentario, un pendiente, mover una etapa), **se hace de verdad y queda a tu nombre**, igual que si lo hicieras desde Voltia PM. Antes de que escriba, leé lo que te propone.
- **Ves lo mismo que ves en Voltia PM:** el conector respeta tus permisos.
- **Claude analiza, pero puede equivocarse.** Si un diagnóstico es importante (por ejemplo, mandar a alguien a una obra), confirmalo antes.
- **Las plantas Huawei a veces no responden** a la primera. Si una consulta falla, pedile que lo intente de nuevo. De Huawei hay datos **hora por hora**, no minuto a minuto.
- **Los datos de los clientes son confidenciales.** No compartas capturas de estas conversaciones fuera de Voltia.
- **No sirve para cambiar Voltia PM** (pantallas, funciones, permisos). Si ves algo que habría que mejorar, pasáselo a Nicolás.

## 4. Si algo no anda

- **No aparece Voltia PM en las herramientas:** fijate que esté activado, o abrí una conversación nueva.
- **Dice que no tenés permiso:** avisale a Nicolás qué estabas consultando.
- **Te pide volver a entrar:** repetí el paso 6, con tu mail y tu contraseña de Voltia PM.
