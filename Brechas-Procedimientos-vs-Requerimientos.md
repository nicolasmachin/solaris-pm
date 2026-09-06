# Experiencia Solar — Qué quedó afuera

> **Qué es esto.** Cruce entre los **procedimientos E1/E2/E3** (definidos hace
> meses) y la **tabla de requerimientos** actual, para ver qué se está desviando y
> qué cosas ya definidas no quedaron recogidas.
>
> **Las definiciones vigentes son las de la tabla.** Los procedimientos entran como
> contexto: lo que sigue no propone volver atrás, sino marcar lo que se perdió en
> el camino y conviene decidir a conciencia.

---

## Resumen

De los procedimientos salen **8 desvíos que importan**. Tres son desarrollo real
que no está en la tabla, dos son contradicciones a resolver, y tres son material
ya escrito que se está dando por inexistente.

| # | Qué | Tipo | Gravedad |
|---|---|---|---|
| B-01 | El modelo de encuestas del sistema no se parece al definido | Desarrollo faltante | **Alta** |
| B-02 | Falta el check de "confirmación de encendido", que es el cierre real de E2 | Desarrollo faltante | **Alta** |
| B-03 | El OK previo de UTE (el que habilita la obra) no está considerado | Desarrollo faltante | **Alta** |
| B-04 | La preferencia de canal del cliente no existe como dato | Desarrollo faltante | Media |
| B-05 | La cadencia se endureció de semanal a 3/5/10 días | Contradicción | **Alta** |
| B-06 | El alta en la app del fabricante: ¿Ingeniería o Experiencia? | Contradicción | Media |
| B-07 | E3 figura como "pendiente" pero tiene procedimiento completo | Material ignorado | **Alta** |
| B-08 | Falta el indicador de resultado: la satisfacción | Enfoque | Media |

---

## B-01 · El modelo de encuestas no coincide con lo definido

**Lo definido en los procedimientos:** tres encuestas, cada una con **tres
preguntas en escala 0-10**, con contenido distinto:

| | Cuándo | Qué mide | Preguntas |
|---|---|---|---|
| Encuesta 1 | Post-obra | La experiencia de E1 | Conformidad general · claridad del proceso · qué mejorar |
| Encuesta 2 | Al confirmar el encendido | La espera de E2 | Conformidad general · cuán acompañado se sintió · qué mejorar |
| Encuesta 3 | Cada aniversario | La operación | Conformidad · **NPS (¿nos recomendarías?)** · en qué ayudar |

**Lo que hay en el sistema (verificado en producción):** una sola columna `nota`
(entero) y un `comentario`. **Una pregunta, escala 1-5, igual para las tres.**

**Consecuencia:** no se puede medir NPS, no se puede separar "conformidad general"
de "cuán acompañado se sintió" —que es justo lo que mide el trabajo del área— y la
escala 1-5 no es comparable con el 0-10 de los procedimientos.

**No está en la tabla de requerimientos.** Es desarrollo real: cambio de modelo,
migración del dato existente y rediseño del formulario del portal.

> **Ojo con la secuencia:** arreglar la entrega de las encuestas (E1-09, E2-05)
> antes de arreglar el instrumento significa mandar a escala una encuesta que no
> mide lo que se quiere medir. Conviene decidir esto primero.

---

## B-02 · Falta el cierre real de E2: la confirmación de encendido

**Lo definido (E2 §3):** *"El cierre de esta etapa no es 'UTE habilitó', es **el
cliente lo encendió y está generando**. No des por terminado tu trabajo hasta que
el cliente te confirme."* Y en §8: se le pide al cliente que avise cuando encienda.

**Lo que hay:** los checks de E2 en la tabla son dos — aviso de habilitación y
aviso de la encuesta. **No existe el check de confirmación de encendido.**

**Por qué importa, y bastante:**
1. Es el único punto donde se verifica que el cliente **efectivamente pudo
   encender**. Hoy se avisa y se asume.
2. **La Encuesta 2 se dispara en el momento equivocado.** Los procedimientos la
   atan a la confirmación de encendido; el sistema la dispara al cerrar el trámite
   UTE. Entre un momento y otro puede pasar bastante, y se le pregunta al cliente
   por su experiencia antes de que haya vivido el desenlace.
3. Sin esa confirmación no hay forma de saber si un cliente habilitado está
   realmente generando — más allá del monitoreo, que solo lo detecta después.

**Faltan también las instrucciones de encendido** (interruptor de microgeneración,
cortar precinto, subir llave) como material — está en C-05 solo de refilón.

---

## B-03 · El OK previo de UTE no está en el mapa

**Lo definido (E1 §5 y glosario):** hay **dos hitos de UTE**, no uno:

| Hito | Cuándo | ¿Notifica al cliente? |
|---|---|---|
| **OK para avanzar con la obra** | *Antes* de la obra | **Sí**, UTE le escribe |
| **Habilitación final** | *Después* de la obra | **No**, avisamos nosotros |

**El primero está completamente ausente de la tabla de requerimientos**, y sin
embargo:

- **La fecha de obra depende de él.** El procedimiento dice que el seguimiento
  semanal de E1 consiste en informar el estado de ese OK y confirmar o reagendar
  la fecha en función de él. Esto explica los **13 clientes esperando fecha**: no
  es desprolijidad, es que están esperando a UTE.
- **Genera una notificación confusa.** UTE le manda al cliente un aviso que
  *parece* hablar de un "aumento de potencia" pero en realidad es la autorización.
  El procedimiento pide preguntarle activamente si le llegó, porque **a veces el
  cliente se entera del OK antes que nosotros**.

**Qué falta:** que ese hito genere novedad informativa (igual que E2-02 pide para
los 11 hitos), y la plantilla que explica la notificación confusa.

---

## B-04 · La preferencia de canal no existe como dato

**Lo definido (E1 §4):** antes incluso de la bienvenida se le pregunta al cliente
si prefiere WhatsApp o mail, **y su preferencia queda registrada en la ficha**.
Razón: que el que elige mail no reciba el mensaje largo de bienvenida por WhatsApp.

**Lo que hay:** no existe el campo. El canal se registra por interacción (con qué
canal se habló *esa vez*), pero no la preferencia del cliente.

Es un campo simple, y ordena el primer contacto —que es el más importante de todo
el recorrido—.

---

## B-05 · La cadencia se endureció y conviene mirarlo

| | E1 | E2 |
|---|---|---|
| **Procedimientos** | 1 contacto por **semana** | 1 contacto por **semana** |
| **Definición vigente** | **3 días** | **5 días** |

En E1 la exigencia se **más que duplicó**. Con el dato de que hoy **63 de 63
clientes están fuera de cadencia**, arrancar con el umbral más duro que el que los
procedimientos consideraban razonable puede volver el indicador inalcanzable —y un
indicador que nunca se cumple deja de mirarse.

**No es una objeción, es una advertencia de calibración.** Los procedimientos
además daban un argumento para el semanal: *"siempre hay algo concreto que decir"*
— y a 3 días, en E1, muchas veces no lo hay.

---

## B-06 · El alta en la app del fabricante: contradicción de responsable

**Lo definido (E3 §4):** *"las tareas técnicas —crear el usuario en la app del
fabricante y limitar la inyección— las hace **Ingeniería**, no Experiencia de
Cliente. Cuando el cliente llega a la puesta en marcha, su usuario ya está creado.
El rol del área no es configurar la app, es **enseñar a usarla**."*

**Lo que hay en el sistema:** la subetapa **"Alta en plataforma de monitoreo"**
está dentro de Post-Habilitación, asignada al *"Equipo Postventa"*.

Hay que decidir cuál manda. El procedimiento parece más sensato (es una tarea
técnica), pero entonces esa subetapa está en el lugar equivocado.

---

## B-07 · E3 no está en cero: hay un procedimiento completo

La tabla dice *"E3 pendiente, no se trabajó"*. **Pero el procedimiento de la Etapa
3 está escrito y es el más detallado de los tres**, con cinco sub-procesos:

| Sub-proceso | Qué cubre | ¿Está en el sistema? |
|---|---|---|
| **3a Puesta en marcha** | Onboarding a la operación, en **dos momentos**: al encender (app, rendimiento esperable, garantías, canales) y **al mes con la primera factura** | No existe como proceso |
| **3b Soporte reactivo** | Triage en 3 ramas: duda de uso · rendimiento · falla técnica. **Todo termina como ticket**, entre por donde entre | Tickets existen, sin triage ni plazos |
| **3c Consultas de rendimiento** | "Genera poco" (real vs. esperado) y **"no veo el ahorro"** (efecto rebote → contrafáctico) | El contrafáctico **ya está** en el reporte mensual |
| **3d Reporte + encuestas** | **Revisión previa del reporte** para adelantarse a desvíos | El reporte existe; la revisión previa no es un paso |
| **3e Mantenimientos** | **Dos** (año 1 y 2), en toque combinado con la Encuesta 3, con **autoagenda por link** | No existe nada |

**Tres definiciones de E3 que vale rescatar porque no están en ningún lado:**

1. **Los mantenimientos son dos y van junto con la encuesta anual**, en un solo
   mensaje que celebra el aniversario. No son dos contactos separados.
2. **Las encuestas no se condicionan a beneficios.** El link para agendar el
   mantenimiento va siempre, responda o no la encuesta. *"Atarlo ensucia el dato:
   deja de medir satisfacción y mide otra cosa."*
3. **El área resuelve, no deriva.** Los dos motivos más frecuentes (rendimiento y
   dudas de uso) los resuelve Experiencia Solar sin escalar. Escalar es solo para
   lo técnico de verdad.

Además queda pendiente algo concreto del reporte: **comparar la generación real
contra la esperada en la propuesta** (cierra la rama A de 3c). Hoy el reporte tiene
el contrafáctico económico pero no la comparación técnica.

---

## B-08 · Falta el indicador que los procedimientos ponen por encima de todo

Los tres procedimientos insisten en lo mismo:

> *"Los indicadores de proceso son medios, no fines. Se puede cumplir todos los
> tiempos y aun así tener un cliente insatisfecho. El número que define si el área
> cumple su objetivo es **la satisfacción**, no los plazos."*

La tabla de requerimientos mide **proceso**: cadencia, avisos en plazo, checks. El
indicador de resultado —la satisfacción, vía encuestas— **no aparece**, y de hecho
hoy no se puede calcular: no hay ninguna métrica agregada de encuestas.

Con 18 pendientes contra 1 respondida, el área **hoy no tiene forma de saber si lo
que hace mejora la satisfacción**. Todo el tablero mide esfuerzo, no resultado.

---

## Qué agregaría a la tabla

| Nuevo | Qué | Pri sugerida |
|---|---|---|
| **B-01** | Rediseñar el modelo de encuestas: 3 preguntas por encuesta, escala 0-10, NPS en la anual | P1 — **decidir antes de escalar la entrega** |
| **B-02** | Check de confirmación de encendido + mover el disparo de la Encuesta 2 a ese momento | P1 |
| **B-03** | Novedad informativa del OK previo de UTE + plantilla de la notificación confusa | P2 |
| **B-04** | Campo de preferencia de canal en la ficha | P2 |
| **B-08** | Métrica de satisfacción (promedio por etapa, evolución, NPS, tasa de respuesta) | P2 |
| **B-06** | Mover "Alta en plataforma de monitoreo" a Ingeniería | P3 |
| — | **Revisar la calibración de la cadencia de E1** (3 días vs. semanal) | Decisión |
| — | **Volcar el procedimiento de E3 a la tabla** en vez de tratarlo como pendiente en blanco | Decisión |

---

## Lo que NO cambió y conviene decir

Buena parte de los procedimientos **sigue vigente y está bien recogida**: el
contacto lo inicia siempre Voltia, nunca un "hola, ¿todo bien?" vacío, no se
prometen plazos que no se controlan, honestidad con la demora, y el manejo del
cliente enojado (validar la emoción antes de explicar). Nada de eso se perdió.

Y hay una idea de los procedimientos que la tabla mejora: los procedimientos
asumían que Experiencia Solar seguía el trámite mirando el portal; las
definiciones nuevas hacen que **el sistema le avise**, que es mejor.
