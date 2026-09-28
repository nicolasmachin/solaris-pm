#!/usr/bin/env python3
"""
El contenido del Manual de Posventa, página por página.

El texto sale de `docs/Manual-Posventa-Experiencia-Solar.md`, que es la fuente de
verdad: acá solo se decide cómo se reparte en hojas y qué forma toma cada cosa.
Si el manual cambia, se corrige el .md primero y después esto.

Uso:
    python3 docs/manual-posventa-pdf/contenido.py <carpeta-destino>
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar import (  # noqa: E402
    AZUL, AZUL_FONDO, BORDE, GRIS, GRIS_CLARO, NEGRO, ROJO, ROJO_FONDO, SANS, TEXTO,
    VERDE, VERDE_FONDO, VERDE_TEXTO, ANCHO, ALTO,
    aviso, bajada, ficha, figura, hueco, kicker, mensaje, numerados, pagina,
    pagina_captura, parrafo, paso, plantilla, portadilla, subtitulo, tabla, tema,
    titulo,
)
import imagenes as IMG  # noqa: E402

# Los mensajes modelo, tal como salen en la app (client/src/modules/clientes/
# plantillas.ts). Se citan enteros en el paso donde se usan: quien lee el manual
# sin la app abierta no tiene forma de saber a qué se refiere "la plantilla de
# bienvenida". Si se vuelven a mencionar más adelante, va sólo el nombre.
PLANTILLAS = {
    "bienvenida": (
        "Bienvenida y presentación",
        "Hola [nombre], soy [referente] de Voltia. Voy a ser tu contacto durante todo el proceso, "
        "así que cualquier cosa escribime directo a mí.\n\n"
        "Te cuento cómo sigue: primero preparamos la ingeniería y los materiales, después hacemos la "
        "instalación (te aviso la fecha apenas la tengamos), y cuando la obra está pronta arranca el "
        "trámite con UTE, que es el paso más largo y depende de ellos — suele llevar [plazo UTE]. "
        "Cuando UTE habilita, te aviso enseguida para que puedas encender.\n\n"
        "No te voy a escribir todas las semanas porque muchas veces no hay novedades, pero cada vez "
        "que pase algo te aviso. Y si querés saber cómo viene, me preguntás cuando quieras."),
    "portal": (
        "Acceso al portal",
        "Hola [nombre], te dejo el acceso al portal de Voltia para que veas el avance de tu "
        "instalación, la documentación y tus reportes de generación.\n\n"
        "[usuario y contraseña] · Link: [link del portal]\n\n"
        "Te va a pedir cambiar la contraseña al entrar. Cualquier duda, escribime."),
    "capataz": (
        "Presentación del capataz",
        "Hola [nombre], durante la obra te va a coordinar [capataz] para horarios y accesos — te paso "
        "su contacto: [teléfono].\n\n"
        "Cualquier otra cosa seguí conmigo, como hasta ahora."),
    "tentativa": (
        "Fecha de obra tentativa",
        "Hola [nombre], ya tenemos fecha tentativa para tu instalación: [fecha].\n\n"
        "Todavía depende del clima y de la logística, así que te la confirmo en cuanto esté cerrada."),
    "confirmada": (
        "Fecha de obra confirmada",
        "Hola [nombre], te confirmo la instalación para el [fecha]. El equipo llega cerca de las "
        "[hora].\n\n"
        "Durante la obra te va a coordinar [capataz] para horarios y accesos, te paso su contacto: "
        "[teléfono]. Cualquier otra cosa seguí conmigo."),
    "reagenda": (
        "Reprogramación de la obra",
        "Hola [nombre], te aviso que tenemos que mover la fecha del [fecha] por [motivo].\n\n"
        "Apenas tengamos la nueva te la confirmo — calculamos [estimación]. Perdón por el cambio."),
    "visita": (
        "Visita a la propiedad",
        "Hola [nombre], te aviso que el [día] entre [franja horaria] pasa el equipo por tu casa a "
        "[motivo de la visita].\n\n"
        "No hace falta que estés, pero necesitamos [acceso requerido]. ¿Te queda bien ese día?"),
    "obra_terminada": (
        "Obra terminada y qué sigue",
        "Hola [nombre], terminamos la instalación.\n\n"
        "Ahora arranca el trámite con UTE para que te habiliten la conexión: es el paso más largo y "
        "depende de ellos, suele llevar [plazo UTE].\n\n"
        "Todavía no podés encender el sistema hasta que UTE habilite — apenas lo hagan te aviso el "
        "mismo día."),
    "encuesta_obra": (
        "Aviso de la encuesta de instalación",
        "Hola [nombre], te dejamos una encuesta cortita en el portal sobre cómo te fue con la "
        "instalación. Son tres preguntas y solo la primera es obligatoria.\n\n"
        "Nos sirve mucho para saber qué mejorar. Gracias."),
    "encuesta_habilitacion": (
        "Aviso de la encuesta de habilitación",
        "Hola [nombre], ahora que ya estás generando te dejamos una encuesta cortita en el portal "
        "sobre cómo viviste la espera del trámite y el acompañamiento.\n\nSon tres preguntas. Gracias."),
    "capacitacion": (
        "Material de capacitación",
        "Hola [nombre], te paso el material para que le saques el jugo a tu instalación: "
        "[videos y material]\n\n"
        "En el portal tenés además tus reportes de generación, la documentación de la obra y un lugar "
        "para abrirnos un reclamo o una consulta cuando lo necesites. Si querés lo recorremos juntos "
        "por teléfono."),
    "acceso_inversor": (
        "Acceso a la plataforma del inversor",
        "Hola [nombre], te paso el acceso a la plataforma del inversor, que es donde ves la generación "
        "en vivo: [usuario y contraseña] · [app o link]\n\n"
        "Cualquier duda para entrar, escribime."),
    "alta_reportes": (
        "Alta en los reportes mensuales",
        "Hola [nombre], te dimos de alta en los reportes mensuales: todos los meses te va a llegar por "
        "correo un resumen de cuánto generó tu instalación y cuánto ahorraste.\n\n"
        "También los vas a tener siempre en el portal. Es el único correo automático que vas a recibir "
        "de nosotros."),
}


# El Anexo E: una sola fuente para el manual (.md) y para las páginas. Cada tema:
# (número, etapa, título, cómo lo pregunta, qué explicar [...], política, escalar).
# Las políticas son las del documento que armó Nicolás el 27-09-2026; lo que se
# agregó al extenderlo es el porqué y dónde mirar, no reglas nuevas.
TEMAS_FAQ = [
    (1, "E1", "Novedades del proyecto",
     "\"¿en qué anda lo mío?\", \"¿hay novedades?\", \"¿cómo va el trámite?\", \"hace mucho que no sé nada\"",
     ["<strong>Qué está preguntando en realidad:</strong> si alguien lo tiene presente. Casi nunca necesita "
      "una novedad; necesita saber en qué parte del recorrido está y que no se olvidaron de él.",
      "Contale <strong>en qué etapa está, qué sigue y cuándo, aproximadamente</strong>. Si la etapa depende de "
      "UTE, decíselo, y con qué rango de tiempo (tema 7).",
      "Mostrale que eso mismo lo puede ver <strong>en el portal de Voltia</strong>, en el avance de su trámite. "
      "Es la forma de que la próxima vez no tenga que preguntar."],
     "antes de contestar, mirá su ficha: la etapa en la que está, el trámite UTE y qué fue lo último que se le "
     "contó. <strong>Nunca \"no hay novedades\" a secas</strong>: aunque no haya novedad, siempre hay una etapa "
     "y un próximo paso que se pueden decir.",
     "si con la ficha no se puede saber en qué está, al responsable de esa etapa. No se le contesta hasta saberlo."),

    (2, "E1", "Fecha de instalación",
     "\"¿cuándo me instalan?\", \"¿ya tienen fecha?\", \"¿para cuándo sería la obra?\"",
     ["La fecha se da <strong>cuando se cumplen las condiciones</strong> (ver la política), y se le avisa con "
      "tiempo para que se organice.",
      "Si lo que falta <strong>depende de él</strong> —la seña o el crédito—, decíselo claro y sin vueltas: "
      "es la forma más rápida de destrabar la obra.",
      "Si lo que falta depende de nosotros (ingeniería, la agenda), no se inventa una fecha: se le dice qué "
      "falta y que apenas esté se le confirma."],
     "para dar fecha tiene que estar <strong>todo</strong> esto: el OK de UTE a la consulta inicial, la "
     "ingeniería hecha, la ingeniería validada por Operaciones, la fecha en la agenda, y <strong>la seña paga "
     "(50 %)</strong> si el pago es directo, o <strong>el crédito aprobado</strong> si es con financiación "
     "bancaria. Los materiales no son condición: son tema interno. No hay un plazo de anticipación definido: "
     "\"te avisamos con tiempo\".",
     "si todas las condiciones están cumplidas y todavía no hay fecha, a Operaciones."),

    (3, "E1", "Las dos aprobaciones de UTE",
     "\"¿por qué hay que esperar a UTE para instalar?\", \"¿no me instalaron ya?, ¿por qué no anda?\", "
     "\"¿cuántas veces tiene que aprobar UTE?\"",
     ["Son <strong>dos aprobaciones distintas</strong>: la <strong>consulta</strong>, antes de la obra, y la "
      "<strong>habilitación</strong> final, después. Casi todas las dudas sobre UTE vienen de creer que es una sola.",
      "En la consulta, UTE hace dos análisis: el <strong>consumo histórico</strong>, para definir la potencia "
      "(sale casi en el día), y el <strong>análisis de la red</strong>, que hace su área de proyectos y puede "
      "pedir obras en la red, a cargo de UTE o del cliente. En residenciales casi nunca pasa; en industriales sí.",
      "<strong>Por eso se espera:</strong> para no instalar y descubrir después un costo que haga desistir. "
      "Es una protección para el cliente, no una traba.",
      "Entre la obra y la habilitación, el sistema queda <strong>instalado pero apagado, con precinto</strong>. "
      "Si nadie se lo explicó, va a creer que algo anda mal."],
     "la obra se hace <strong>después de la consulta aprobada</strong>. Hacerla antes, preferentemente no; "
     "excepcionalmente, por logística, y es más viable en residenciales chicas. <strong>Encender antes de la "
     "habilitación, nunca.</strong>",
     "si el cliente pide hacer la obra antes de la consulta, al asesor comercial y a Operaciones."),

    (4, "E1", "El día de la obra",
     "\"¿cuánto dura?\", \"¿tengo que estar en casa?\", \"¿entran a la casa?\", \"¿tengo que preparar algo?\"",
     ["Una residencial típica lleva <strong>de 2 a 4 días</strong>, según la dificultad del montaje (el techo, "
      "el acceso, la distancia al tablero).",
      "Hace falta <strong>alguien que reciba al equipo al principio</strong>, para abrir y mostrar dónde van las "
      "cosas. Que esté durante la obra es recomendable, no obligatorio.",
      "<strong>No se trabaja adentro de la casa</strong>: puede dejarla cerrada, siempre que haya acceso por "
      "afuera al techo y al tablero.",
      "Se recomienda dejar acceso a un baño para el equipo: son varios días de trabajo."],
     "lo que se le pide tiene que ser concreto: qué acceso hace falta y a qué hora llega el equipo. Un \"no hace "
     "falta que estés\" sin decir qué tiene que dejar resuelto termina con la cuadrilla en la puerta.",
     "necesidades de acceso especiales (llaves, portería, horarios restringidos), a Operaciones."),

    (5, "E1", "Pago y financiación",
     "\"¿cuándo pago?\", \"¿cuánto falta pagar?\", \"¿cómo es con el banco?\", \"¿cuánto es la seña?\"",
     ["<strong>Pago directo:</strong> una seña al confirmar, y se completa el <strong>50 %</strong> entre 10 y "
      "15 días antes de la obra. Después, el <strong>30 %</strong> con la obra terminada y el <strong>20 "
      "%</strong> cuando UTE habilita.",
      "<strong>Financiación bancaria:</strong> se firma el contrato para presentar al banco, y la obra se agenda "
      "<strong>recién con el crédito aprobado</strong>. Por eso conviene que vaya adelantando lo que le pide el "
      "banco: es lo que más atrasa estas obras.",
      "Para decirle cuánto le falta, mirá la pestaña <strong>Cobros</strong> de su ficha: ahí está qué pagó y "
      "qué queda previsto."],
     "los montos y las fechas se sacan del <strong>plan de pagos</strong> del proyecto, no de memoria. Si no "
     "está cargado, no se contesta: se le pregunta al asesor. Un número mal dicho sobre plata es de lo que más "
     "cuesta arreglar.",
     "cualquier duda de montos, al asesor comercial."),

    (6, "E1", "El portal y la aplicación del inversor",
     "\"¿dónde veo cómo va?\", \"¿cómo entro?\", \"no tengo usuario\", \"¿qué es la app?\"",
     ["Son <strong>dos cosas distintas</strong>, y conviene explicarlo así desde el principio, con esos dos "
      "nombres siempre:",
      "<strong>El portal de Voltia:</strong> el seguimiento del trámite, las encuestas, los tickets, y donde "
      "carga su fecha de corte y su tarifa.",
      "<strong>La aplicación de tu inversor:</strong> la generación en tiempo real, el histórico y el consumo. "
      "Es de la marca del inversor, no de Voltia."],
     "el usuario del portal se genera con un clic desde su ficha, se copia y se le manda por WhatsApp; el "
     "cliente cambia la contraseña al entrar. Para la aplicación del inversor se le manda el link de descarga "
     "y las credenciales; si no tiene usuario, lo creás siguiendo el video instructivo.",
     "problemas técnicos de la plataforma del inversor, a Operaciones."),

    (7, "E2", "Cuánto demora UTE",
     "\"¿cuánto falta?\", \"¿por qué tarda tanto?\", \"¿cuándo me habilitan?\", \"ya pasó un mes\"",
     ["La <strong>consulta</strong> suele llevar alrededor de <strong>mes y medio</strong>.",
      "La <strong>habilitación</strong>, contada desde que termina la obra, habitualmente <strong>entre 2 y 4 "
      "semanas</strong>.",
      "Son <strong>rangos</strong>: UTE no da fechas. Si le damos un día y UTE no lo cumple, la promesa rota es "
      "nuestra, y el cliente no distingue quién falló."],
     "<strong>nunca fechas exactas.</strong> Si pasó más de un mes, antes de contestar mirá <strong>quién tiene "
     "la pelota</strong> en el trámite. <strong>Nunca digas \"estamos esperando a UTE\" sin verificarlo</strong>: "
     "una parte de los trámites abiertos está esperando algo de Voltia, no de UTE.",
     "si el trámite está trabado del lado de Voltia, al responsable de tramitación UTE."),

    (8, "E2", "Mensajes de UTE",
     "\"me llegó un mensaje de UTE, ¿tengo que hacer algo?\", \"me dicen que aumenté la potencia\", \"¿esto es "
     "normal?\"",
     ["Son <strong>informativos</strong>: no tiene que hacer nada.",
      "Al aprobar la consulta, UTE manda una notificación que <strong>parece un pedido de aumento de "
      "potencia</strong>. Es normal y es la que más asusta. Por eso se le manda un ejemplo antes, en uno de los "
      "mensajes que siguen a la bienvenida: si ya la vio, cuando le llega no pregunta.",
      "Al habilitar al final, <strong>UTE no manda nada</strong>: la habilitación se la avisa Voltia."],
     "pedí captura del mensaje para identificar cuál es antes de contestar. No se le explica el trámite: se le "
     "dice si tiene que hacer algo o no.",
     "si el mensaje no es ninguno de los conocidos, al responsable de tramitación UTE."),

    (9, "E2", "Habilitación y encendido",
     "\"¿ya me habilitaron?\", \"¿cómo lo prendo?\", \"¿viene alguien a prenderlo?\"",
     ["<strong>El encendido lo hace el cliente</strong>: cortar el precinto y subir la llave de "
      "microgeneración. <strong>No se toca el inversor.</strong> Es una maniobra de un minuto, y conviene "
      "explicarla paso a paso.",
      "Después se confirma con él que <strong>quedó generando</strong>: en la aplicación del inversor tiene que "
      "verse la generación subiendo."],
     "Voltia avisa dentro de las <strong>24 a 48 horas</strong> de otorgada la habilitación, sin esperar que "
     "pregunte. <strong>Si pregunta él, el aviso llegó tarde.</strong> Al confirmar que genera, se le recuerda "
     "el <strong>20 % final</strong>. Que vaya alguien de Voltia a encender es excepción, no la regla.",
     "si no logra encender o no genera, a Operaciones."),

    (10, "E3", "\"Genera poco\"",
     "\"genera menos de lo que me dijeron\", \"tengo 6 kWp y no paso de 3 kW\", \"con sol no llega\"",
     ["Se compara la generación <strong>real</strong> (la aplicación del inversor) contra la "
      "<strong>esperada</strong> (el gráfico de la propuesta), <strong>por mes y no por día</strong>. Un día "
      "nublado aislado no dice nada.",
      "El pico de potencia depende de la altura del sol, la orientación y la temperatura. <strong>En invierno, "
      "con sol, es normal no llegar a la potencia nominal</strong>: los 6 kWp son en condiciones ideales, no un "
      "piso de cada día.",
      "Lo que más convence es mostrarle <strong>la curva de potencia de un día soleado de ese mes</strong>: ve "
      "que el sistema anda y entiende por qué no llega al número."],
     "se contesta <strong>con números, no con opiniones</strong>. Un \"está bien, es normal\" sin datos se lee "
     "como que no lo miraste.",
     "si el mes está <strong>más de 20 % por debajo</strong> de lo esperado, a Operaciones."),

    (11, "E3", "\"No veo el ahorro\"",
     "\"la factura sigue alta\", \"no noto la diferencia\", \"no sé si vale la pena\"",
     ["Casi nunca es la generación: <strong>es percepción</strong>. Antes de discutirlo, mirá los números del "
      "reporte.",
      "<strong>Efecto rebote:</strong> con paneles, sin darse cuenta, se consume más —se prende más el aire, "
      "se usa más el calefón—.",
      "El reporte mensual muestra <strong>qué pagaría hoy sin paneles</strong>: esa es la comparación que "
      "importa, no la factura del año pasado.",
      "Aparece sobre todo <strong>en invierno</strong> o al terminarlo, cuando se juntan más consumo y menos "
      "generación, y un año con más días nublados lo acentúa. Un sistema no se evalúa por el peor mes —igual que "
      "no se vende mostrando enero—: se mira <strong>el promedio anual</strong>."],
     None,
     "si los números muestran de verdad un problema de generación, pasa al tema 10."),

    (12, "E3", "Factura de UTE y reporte mensual",
     "\"el reporte no coincide con la factura\", \"no entiendo la factura\"",
     ["UTE factura <strong>por fecha de corte</strong>, no por mes calendario. Si el reporte y la factura no "
      "coinciden, casi siempre es porque se están comparando períodos distintos.",
      "El cliente <strong>carga su fecha de corte en el portal de Voltia</strong>, y con eso el reporte cubre "
      "exactamente el mismo período que su factura."],
     "si no coincide, <strong>primero verificá si cargó la fecha de corte</strong>. La fecha de corte se enseña "
     "a cargar en la puesta en marcha, y la factura se le explica <strong>al mes del encendido, con su factura "
     "real en la mano</strong>: antes no hay nada que comparar.",
     None),

    (13, "E3", "Tarifa",
     "\"¿me conviene cambiar de tarifa?\", \"¿doble horario o simple?\"",
     ["Puede cambiar la tarifa en el portal para que el reporte calcule bien. El reporte muestra <strong>los tres "
      "escenarios a propósito</strong>, para que vea la diferencia con sus propios números.",
      "<strong>Con paneles suele convenir la simple.</strong> En la doble horario la generación cae siempre en el "
      "horario barato, así que siempre vende barato. En la simple, como baja el consumo, se pasa menos de los "
      "escalones y vende un poco más caro."],
     "<strong>no cambiar en caliente</strong>: esperar varios meses de datos reales antes de recomendar un "
     "cambio.",
     None),

    (14, "E3", "Auto eléctrico",
     "\"compré un auto eléctrico, ¿cuándo lo cargo?\", \"¿lo cargo con los paneles?\"",
     ["Conviene <strong>tarifa triple horario y cargar de madrugada</strong>.",
      "No conviene cargarlo de día con el excedente, aunque parezca lo lógico: esa energía vale más "
      "<strong>vendida a UTE</strong>, con el descuento de IVA e IRPF, que lo que cuesta comprarla de "
      "madrugada. <strong>De día se vende, de madrugada se carga.</strong>"],
     None,
     "si quiere ampliar el sistema por el auto, tema 20."),

    (15, "E3", "Corte de luz",
     "\"se cortó la luz y los paneles no andan\", \"¿no me daba luz igual?\"",
     ["Un sistema conectado a la red <strong>sin baterías se apaga solo por seguridad</strong>, para no "
      "energizar una línea donde puede haber alguien trabajando.",
      "Vuelve solo cuando vuelve la luz. <strong>No es una falla</strong>, y no hay que hacer nada."],
     "hoy todos los sistemas son conectados a red. Cuando entren sistemas híbridos con baterías, hay que "
     "verificar en la ficha el tipo de sistema antes de contestar, y actualizar este tema.",
     None),

    (16, "E3", "La aplicación no muestra la generación",
     "\"no me aparece nada\", \"la aplicación está en cero\", \"dejó de mostrar datos\"",
     ["Casi siempre es <strong>conectividad</strong>, no generación. Preguntale qué luz tiene el inversor: "
      "<strong>si está verde, genera bien</strong>; sólo perdió internet, y no perdió generación.",
      "Preguntale si <strong>cambió la contraseña del wifi o el router</strong>: es la causa más común.",
      "Cuando se resuelve, enseñale a hacerlo solo: es de las consultas que más se repiten y que menos hace "
      "falta que pasen por Voltia."],
     "mandale el <strong>video de reconexión de su marca</strong> para que lo haga solo, si se anima. Si no, que "
     "abra un ticket de soporte desde el portal de Voltia.",
     "si la luz no está verde, pasa al tema 17."),

    (17, "E3", "Falla del inversor (luz roja)",
     "\"el inversor tiene una luz roja\", \"me sale un error\", \"se apagó el inversor\"",
     ["Que <strong>se registra el caso y se le da seguimiento</strong>, y cuándo va a tener novedades.",
      "Cómo <strong>abrir el ticket desde el portal de Voltia</strong>, para la próxima."],
     "es raro que lo reporte el cliente primero: con falla, el inversor sigue conectado y la reporta, así que "
     "<strong>Voltia debería enterarse antes y contactarlo</strong>. Si llama él primero, algo falló en el "
     "monitoreo. Se registra como caso técnico. Si el cliente no abre el ticket, lo abre Experiencia Solar, pero "
     "la meta es que lo haga solo.",
     "a Operaciones [A CONFIRMAR]"),

    (18, "E3", "Limpieza y mantenimiento",
     "\"¿cada cuánto los limpio?\", \"¿con qué los limpio?\", \"¿hacen mantenimiento?\", \"¿cuánto sale?\"",
     ["<strong>Limpieza por el cliente:</strong> sólo con agua, sin ningún producto. Puede usar hidrolavadora, "
      "cepillo, lampazo o trapo. Recomendado cada 6 meses. <strong>Si subir al techo no es seguro, que no "
      "suba.</strong>",
      "<strong>Mantenimiento de Voltia:</strong> recomendado una vez por año. Incluye limpieza, revisión "
      "estructural con reajuste de toda la tornillería —se afloja con el viento y el tiempo— y revisión "
      "preventiva de la parte eléctrica y del funcionamiento del inversor.",
      "<strong>Los dos primeros son gratis</strong>, al primer y al segundo año de la obra. Desde el tercero se "
      "cobran, del orden de USD 100 por visita según la distancia, y quedan a criterio del cliente.",
      "<strong>Si se vuelan paneles, Voltia se hace cargo</strong>, siempre que haya hecho un mantenimiento en "
      "el último año."],
     "la condición de la voladura existe porque, sin revisar la tornillería, no se puede responder años "
     "después. Los dos gratis <strong>los propone Voltia</strong>, sin esperar a que el cliente los pida, y la "
     "fecha se confirma con él. La condición se comunica al entregar el sistema y antes de que venza el "
     "segundo año.",
     "para agendar o cotizar, a Operaciones."),

    (19, "E3", "Granizo",
     "\"¿qué pasa si cae granizo?\", \"¿tienen seguro?\", \"¿cubren los paneles?\"",
     ["Voltia tiene el <strong>Plan de Protección contra Granizo</strong>: si el granizo le rompe paneles, "
      "se los repone con todo incluido (panel, traslado, mano de obra y puesta en marcha), sin deducible.",
      "Cuesta <strong>USD 12 por panel por año, IVA incluido</strong>, por adelantado y siempre por todos los paneles.",
      "Cubre <strong>sólo los paneles y sólo por granizo</strong>: no el inversor, la estructura ni el cableado, "
      "y no el viento, el rayo, los golpes ni el robo.",
      "Con la obra, cubre desde la puesta en marcha. Si ya tiene la instalación, 30 días después del primer pago.",
      "Si graniza: que no toque los paneles ni suba al techo, y que avise dentro de los 10 días hábiles con fotos."],
     "<strong>no es un seguro y no se le dice así</strong>: decís plan, condiciones, anualidad y daño por granizo. "
     "Se activa con el Anexo A firmado y la primera anualidad paga. Con más de 15 días de atraso queda suspendido "
     "y al pagar corre una nueva carencia. Un aviso de daño se registra en Voltia PM y se responde el mismo día hábil; "
     "inspección en 10 días hábiles y reposición en 30 días (60 si la tormenta pegó en muchas obras).",
     "quién inspecciona y repone está por definir; mientras tanto, a Operaciones."),

    (20, "E3", "Ampliación",
     "\"¿puedo agregar más paneles?\", \"compré un auto eléctrico, ¿me da para más?\", \"quiero ampliar\"",
     ["Que lo va a <strong>contactar el equipo de ventas</strong> para cotizarle.",
      "No hace falta explicarle nada técnico: si hay lugar, si el inversor da o si hay que tramitar con UTE, "
      "lo ve el vendedor con él."],
     "<strong>Experiencia Solar no evalúa ni promete nada técnico.</strong> Lo pasa a ventas cargándolo como "
     "cliente potencial en Voltia PM.",
     "directo a ventas."),
]

ETAPA_FAQ = {"E1": "E1 · DE LA VENTA A LA OBRA", "E2": "E2 · DE LA OBRA A LA HABILITACIÓN", "E3": "E3 · USO CONTINUO"}

def cita(clave, margen=20):
    """La plantilla `clave` citada entera, en su paso."""
    nombre, texto = PLANTILLAS[clave]
    return plantilla(nombre, texto, margen=margen)

# Las once páginas ya maquetadas a mano, en su lugar del orden final. El
# generador no las reescribe: solo les corrige el número de pie.
EXISTENTES = {
    "Main.dc.html": "1 · Portada",
    "PrincipioRector.dc.html": "4 · El principio rector",
    "QueSePromete.dc.html": "5 · Qué se promete y qué no",
    "Recorrido.dc.html": "6 · El recorrido del cliente",
    "QuienHabla.dc.html": "7 · Quién habla con el cliente",
    "ReglaAgenda.dc.html": "15 · Regla dura: si no está agendado",
    "PasoEncender.dc.html": "19 · Ya podés encender",
    "MediaHora.dc.html": "25 · La media hora de la mañana",
    "Senales.dc.html": "27 · Las dos señales",
    "ReglasDuras.dc.html": "33 · Las once reglas duras",
    "SaleMal.dc.html": "34 · Cuando algo sale mal",
}


def construir():
    """Devuelve la lista completa del manual: (archivo, título, html o None)."""
    P = []          # (archivo, titulo_board, html | None para las existentes)
    n = [0]         # número de página corriente

    def sig():
        n[0] += 1
        return n[0]

    def existente(archivo, titulo_board):
        sig()
        P.append((archivo, titulo_board, None))

    def nueva(archivo, titulo_board, hacer):
        P.append((archivo, titulo_board, hacer(sig())))

    # ── Apertura ─────────────────────────────────────────────────────────────
    existente("Main.dc.html", "1 · Portada")

    nueva("ComoUsar.dc.html", "2 · Cómo usar este manual", lambda p: pagina(
        "Cómo usar este manual",
        kicker("CAPÍTULO 0")
        + titulo("Cómo usar este manual")
        + bajada("No todo el manual es para todos. Cada rol tiene lo suyo, y dos capítulos son "
                 "para todos sin excepción.")
        + tabla(
            ["SI SOS…", "LEÉ SÍ O SÍ", "CONSULTÁ CUANDO LO NECESITES"],
            [["Experiencia Solar", "Todo", "—"],
             ["Capataz / Operaciones", "1, 4, 5 (obra), 13", "12 (Voltia PM)"],
             ["Comercial", "1, 4, 5.1 (bienvenida), 13", "—"],
             ["Ingeniería", "4, 13", "12"],
             ["Tramitación UTE", "4, 6, 13", "—"],
             ["Gerencia / Administración", "1, 8, 13, 14", "Todo"]],
            anchos=[None, 180, 210], margen=26)
        + aviso("Las secciones <strong>13 (Las reglas duras)</strong> y <strong>14 (Cuando algo "
                "sale mal)</strong> son las que hay que saber de memoria. El resto se consulta.",
                "clave", margen=26)
        + subtitulo("Qué es este documento", margen=34)
        + parrafo("Es <strong>el procedimiento y el manual de uso de Voltia PM, juntos</strong>. Cada paso "
                  "dice qué hay que hacer, quién lo hace, en qué plazo, y en qué pantalla de Voltia PM "
                  "se hace.")
        + parrafo("No hay un documento aparte para \"el proceso\" y otro para \"el sistema\": el sistema "
                  "existe para sostener el proceso, y separarlos es lo que hace que ninguno de los dos "
                  "se cumpla.")
        + aviso("<strong>Describe cómo se trabaja, no cómo está la cartera hoy.</strong> Acá no van "
                "cuántos clientes están en tal situación en tal momento: eso envejece en una semana. "
                "Los números del momento van a los informes.", "ojo", margen=24),
        p))

    nueva("PorQueExiste.dc.html", "3 · Por qué existe Experiencia Solar", lambda p: pagina(
        "Por qué existe Experiencia Solar",
        kicker("CAPÍTULO 1")
        + titulo("Por qué existe Experiencia Solar")
        + parrafo("Un cliente que compra energía solar entra en un proceso de varios meses donde la mayor "
                  "parte del tiempo <strong>no pasa nada visible para él</strong>. La obra dura un día o "
                  "dos; el trámite con UTE dura semanas y no depende de nosotros.", margen=20, tamano=16)
        + f'  <div style="margin-top: 26px; padding: 26px 28px; background: {AZUL}; border-radius: 12px">\n'
          f'    <p style="margin: 0; font-family: {SANS}; font-size: 25px; font-weight: 600; line-height: 1.35; '
          f'color: #ffffff; letter-spacing: -.3px">En ese silencio, el cliente no piensa "están trabajando": '
          f'piensa que se olvidaron de él.</p>\n  </div>\n'
        + parrafo("Experiencia Solar existe para que eso no pase. <strong>No es atención al cliente "
                  "reactiva</strong> —esperar a que llame— sino el acompañamiento activo de toda la "
                  "relación, desde que firma hasta años después de encender.", margen=24, tamano=16)
        + subtitulo("Qué cambia en la práctica", margen=32)
        + f'  <div style="display: flex; gap: 16px; margin-top: 16px">\n'
          f'    <div style="flex-grow: 1; flex-basis: 0; padding: 20px; background: #f7f8fb; border-radius: 10px">\n'
          f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.4px; '
          f'color: {GRIS_CLARO}">ANTES</div>\n'
          f'      <p style="margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">'
          f'Cada área hablaba de lo suyo. Nadie miraba el conjunto. El cliente llamaba para saber en qué '
          f'andaba lo suyo y cada uno le contaba su pedazo.</p>\n'
          f'    </div>\n'
          f'    <div style="flex-grow: 1; flex-basis: 0; padding: 20px; background: {AZUL_FONDO}; border-radius: 10px">\n'
          f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.4px; '
          f'color: {AZUL}">AHORA</div>\n'
          f'      <p style="margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">'
          f'Hay alguien que tiene la película completa y responde por cómo va todo. El cliente no tiene que '
          f'saber cómo estamos organizados por dentro.</p>\n'
          f'    </div>\n  </div>\n'
        + aviso("Todo esto arrancó por una queja concreta: una visita a la propiedad de un cliente que no "
                "estaba en el calendario y de la que nadie le avisó. Falló primero como registro, y por "
                "eso falló el aviso.", "ojo", margen=30),
        p))

    existente("PrincipioRector.dc.html", "4 · El principio rector")
    existente("QueSePromete.dc.html", "5 · Qué se promete y qué no")
    existente("Recorrido.dc.html", "6 · El recorrido del cliente")
    existente("QuienHabla.dc.html", "7 · Quién habla con el cliente")

    nueva("QueRegistra.dc.html", "8 · Qué registra cada área", lambda p: pagina(
        "Qué registra cada área",
        kicker("CAPÍTULO 4")
        + titulo("Qué registra cada área, y dónde")
        + bajada("La ficha del cliente es <strong>su historia clínica</strong>: quien la abre tiene que "
                 "poder entender qué pasó sin preguntarle a nadie.")
        + aviso("El registro se hace <strong>donde cada uno ya está trabajando</strong>; la lectura se "
                "consolida en la ficha del cliente. Nadie tiene que entrar a un módulo que no usa para "
                "dejar una nota.", "clave", margen=24)
        + tabla(
            ["ÁREA", "QUÉ REGISTRA", "DÓNDE"],
            [["Comercial", "Lo que le prometió al cliente en la venta: plazos, alcance, condiciones especiales",
              "Comentarios del lead y del proyecto"],
             ["Ingeniería", "Cambios de alcance o de diseño que el cliente tiene que saber",
              "Comentarios del proyecto"],
             ["Capataz / Operaciones", "<strong>Todo intercambio con el cliente en la obra</strong> y cualquier "
              "incidente: algo que se rompió, un pedido, una queja al pasar",
              "Comentario en la etapa, <strong>desde el celular</strong>"],
             ["Tramitación UTE", "Novedades del trámite que cambian el plazo prometido",
              "Comentarios del proyecto"],
             ["Experiencia Solar", "Cada contacto con el cliente: el canal y qué se dijo",
              "El formulario del historial"],
             ["Finanzas", "Los cobros que entran y las facturas que se emiten",
              "Finanzas — <strong>aparecen solos</strong>"]],
            anchos=[150, None, 190], margen=22)
        + aviso("<strong>Si registrar cuesta, no se registra.</strong> Un comentario de dos líneas desde el "
                "celular en la obra vale infinitamente más que un informe prolijo que nadie escribe.",
                "ojo", margen=22)
        + subtitulo("Lo que aparece solo, sin que nadie lo escriba", margen=18, tamano=19)
        + numerados([
            "<strong>Los avances de etapa</strong> y los hitos del trámite UTE.",
            "<strong>Los documentos emitidos</strong>: propuestas, contratos, reportes.",
            "<strong>Los pagos del cliente</strong>, con la etiqueta Cobros. Solo los efectivos, no los "
            "previstos: un cobro planificado es trabajo nuestro, no algo que el cliente hizo. Los gastos "
            "de la obra no aparecen porque no son suyos.",
        ], margen=14),
        p))

    # ── Etapa 1 ──────────────────────────────────────────────────────────────
    nueva("PortadillaE1.dc.html", "9 · Etapa 1", lambda p: portadilla(
        "1", "De la venta a la obra", "la firma", "la obra terminada",
        "Expectativa y ansiedad. Compró algo que todavía no existe, y todo lo que ve es una promesa.",
        "3",
        ["Bienvenida y presentación", "Conversación de expectativa inicial", "Envío del acceso al portal",
         "Presentación del capataz", "Aviso de fecha de obra", "Aviso de reprogramación",
         "Aviso de visita a la propiedad", "Aviso de obra terminada", "Aviso de la encuesta de obra"],
        p, foto=IMG.PORTADILLA_E1))

    nueva("E1Bienvenida.dc.html", "10 · Bienvenida", lambda p: paso(
        "ETAPA 1 · PASO 1", "SIN PLAZO FORMAL", "Bienvenida y presentación",
        "El primer mensaje después de firmar. Presenta a Experiencia Solar y explica el recorrido.",
        [ficha([("CUÁNDO", "Al cerrar la venta, apenas se convierte el cliente potencial en proyecto"),
                ("QUIÉN", "<strong>El vendedor que cerró</strong> — es quien tiene la relación"),
                ("PLAZO", "Sin plazo formal, pero <strong>antes de cualquier otro contacto</strong>"),
                ("EN LA APP", "Ficha del cliente → Pasos → E1 → \"Bienvenida y presentación\""),
                ("QUÉ DECIR", "Plantilla <strong>\"Bienvenida y presentación\"</strong>")]),
         aviso("<strong>Por qué la manda el vendedor y no Experiencia Solar:</strong> el cliente ya lo "
               "conoce. Si el primer mensaje después de firmar viene de alguien que nunca vio, arranca en "
               "frío. La bienvenida <strong>presenta</strong> a Experiencia Solar; no la reemplaza.",
               "clave"),
         cita("bienvenida"),
         aviso("<strong>Sin este paso, todo lo demás arranca mal.</strong> Es la que explica que no va a "
               "haber contacto semanal y por qué. Si no se manda, el cliente espera un ritmo que nunca va "
               "a llegar.", "ojo")],
        p, plazo_rojo=False))

    nueva("E1Expectativa.dc.html", "11 · Conversación de expectativa", lambda p: paso(
        "ETAPA 1 · PASO 2", "OBLIGATORIA", "Conversación de expectativa inicial",
        "El paso más importante de toda la etapa, y el que más se saltea.",
        [ficha([("CUÁNDO", "Junto con la bienvenida o inmediatamente después"),
                ("QUIÉN", "Experiencia Solar"),
                ("PLAZO", "Sin plazo formal — pero es <strong>obligatoria</strong>"),
                ("EN LA APP", "Ficha del cliente → E1 → \"Conversación de expectativa inicial\"")]),
         subtitulo("Hay que cubrir, explícitamente:", margen=20, tamano=18),
         numerados(["<strong>El recorrido completo</strong>, etapa por etapa.",
                    "<strong>Cuánto demora cada una</strong>, con números reales, no optimistas.",
                    "<strong>El trámite UTE y su plazo</strong>: son <strong>dos aprobaciones</strong>, la "
                    "consulta antes de la obra y la habilitación después. Entre las dos, el sistema queda "
                    "<strong>instalado pero apagado, con precinto</strong>.",
                    "<strong>Que no va a haber contacto de rutina, pero sí en cada hito.</strong>"],
                   margen=14),
         aviso("<strong>Es una conversación, no un mensaje.</strong> Idealmente por teléfono: que el "
               "cliente pueda <strong>repetir con sus palabras</strong> cuánto va a demorar y por qué.",
               "clave", margen=18),
         aviso("<strong>En uno de los mensajes que siguen</strong>, mandale un ejemplo de la notificación "
               "que UTE le manda al aprobar la consulta: <strong>parece un pedido de aumento de "
               "potencia</strong> y, si no la espera, lo asusta.", "ojo", margen=18),
         aviso("Después se registra en el historial qué se le dijo: si meses después reclama que \"nadie "
               "le avisó\", la ficha tiene que poder responderlo.", "clave", margen=14)],
        p, plazo_rojo=False))

    nueva("E1Portal.dc.html", "12 · Acceso al portal", lambda p: paso(
        "ETAPA 1 · PASO 3", "SIN PLAZO", "Envío del acceso al portal",
        "El paso que más rinde hacer temprano y el que más cuesta recuperar después.",
        [ficha([("CUÁNDO", "Apenas se crea el proyecto"),
                ("QUIÉN", "Experiencia Solar"),
                ("PLAZO", "Sin plazo, pero queda pendiente hasta que se haga"),
                ("EN LA APP", "El ícono de crear usuario en el propio paso, o la columna de acceso del listado"),
                ("QUÉ DECIR", "Plantilla <strong>\"Acceso al portal\"</strong>, que sale con el usuario y la "
                              "contraseña reales")]),
         parrafo("<strong>Cómo se crea:</strong> con el ícono del propio paso. La contraseña por defecto es "
                 "<strong>12345678</strong> y el sistema pide cambiarla al entrar; la plantilla sale con el "
                 "usuario y la contraseña ya adentro.", margen=18),
         aviso("Si el cliente <strong>ya tenía acceso</strong>, la plantilla trae su usuario pero deja la "
               "contraseña en blanco: no se puede recuperar. Para mandársela hay que resetearla con el "
               "botón de reenviar.", "ojo", margen=16),
         parrafo("<strong>Si no tiene mail, igual se le crea el acceso</strong>: se usa su cédula o un usuario "
                 "con su nombre (<em>maria.fernandez</em>), que la pantalla muestra para dictárselo. Sin mail "
                 "no puede recuperar la contraseña solo.", margen=14, tamano=14),
         parrafo("<strong>Qué gana el cliente:</strong> ve el avance, la documentación y sus reportes, y "
                 "<strong>puede abrirnos un reclamo por ahí</strong> en vez de por WhatsApp.",
                 margen=16, tamano=14),
         cita("portal"),
         aviso("<strong>Este paso arrastra a varios más.</strong> Sin acceso al portal el cliente no puede "
               "abrir tickets ni responder encuestas. Al que se le pasó, nadie se lo crea seis meses "
               "más tarde.", "duro", margen=18)],
        p, plazo_rojo=False))

    nueva("E1Capataz.dc.html", "13 · Capataz y reprogramación", lambda p: pagina(
        "Presentación del capataz · Reprogramación",
        kicker("ETAPA 1 · PASOS 4 Y 6")
        + titulo("Presentación del capataz", tamano=34)
        + ficha([("CUÁNDO", "Al arrancar la obra, o junto con la fecha confirmada"),
                 ("QUIÉN", "Experiencia Solar"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Presentación del capataz\"</strong>")], margen=20)
        + cita("capataz", margen=16)
        + aviso("<strong>Con el alcance explícito</strong>: obra con él, todo lo demás conmigo. Sin esa "
                "frase, el cliente asume que el capataz reemplazó a Experiencia Solar.", "clave", margen=16)
        + f'  <div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Aviso de reprogramación", tamano=34)
        + ficha([("CUÁNDO", "<strong>El mismo día</strong> en que se mueve la fecha"),
                 ("QUIÉN", "Experiencia Solar"),
                 ("PLAZO", "<strong>1 día hábil</strong>"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Reprogramación de la obra\"</strong>")], margen=20)
        + parrafo("<strong>Mover una obra ya confirmada exige el motivo en el sistema</strong>: quien le "
                  "avisa al cliente necesita saber qué decirle. Si era tentativa no se pide motivo — nadie "
                  "prometió nada.", margen=16)
        + cita("reagenda", margen=16)
        + aviso("<strong>Cada reprogramación genera su propio pendiente</strong>, con el motivo adentro. Si "
                "a un cliente le mueven la fecha tres veces, quedan tres avisos, no uno.", "ojo", margen=16),
        p))

    nueva("E1Fecha.dc.html", "14 · Fecha de obra", lambda p: paso(
        "ETAPA 1 · PASO 5", "2 DÍAS HÁBILES", "Aviso de fecha de obra",
        "Van dos mensajes distintos: primero la tentativa, después la confirmada.",
        [f'  <div style="display: flex; gap: 16px; margin-top: 26px">\n'
         f'    <div style="flex-grow: 1; flex-basis: 0; padding: 20px; background: #f7f8fb; border-radius: 10px">\n'
         f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.4px; '
         f'color: {GRIS_CLARO}">A · TENTATIVA</div>\n'
         f'      <p style="margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">'
         f'Apenas hay una fecha, aunque no esté cerrada. Se avisa <strong>que es tentativa y de qué '
         f'depende</strong>.</p>\n'
         f'      <div style="margin-top: 12px; font-family: {SANS}; font-size: 12px; color: {GRIS}">'
         f'Plantilla "Fecha de obra tentativa"</div>\n'
         f'    </div>\n'
         f'    <div style="flex-grow: 1; flex-basis: 0; padding: 20px; background: {AZUL_FONDO}; border-radius: 10px">\n'
         f'      <div style="font-family: {SANS}; font-size: 11px; font-weight: 600; letter-spacing: 1.4px; '
         f'color: {AZUL}">B · CONFIRMADA</div>\n'
         f'      <p style="margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: {TEXTO}">'
         f'Al confirmarse la fecha en el calendario. <strong>2 días hábiles</strong>: el sistema abre el '
         f'pendiente solo.</p>\n'
         f'      <div style="margin-top: 12px; font-family: {SANS}; font-size: 12px; color: {GRIS}">'
         f'Plantilla "Fecha de obra confirmada"</div>\n'
         f'    </div>\n  </div>\n',
         aviso("<strong>Cómo arranca el plazo.</strong> El reloj <strong>no</strong> empieza cuando se crea "
               "el proyecto, sino cuando alguien <strong>confirma la fecha en el calendario de obra</strong>. "
               "Ahí el paso pasa a tener vencimiento y aparece en el correo de la mañana si se pasa.",
               "clave", margen=24),
         aviso("Los dos días hábiles cuentan desde esa confirmación, <strong>no desde que se cerró la "
               "venta</strong>: entre una cosa y la otra pasan onboarding, pre-ingeniería y la "
               "validación de Operaciones.", "ojo", margen=16),
         cita("tentativa", margen=18),
         cita("confirmada", margen=14)],
        p))

    existente("ReglaAgenda.dc.html", "15 · Regla dura: si no está agendado")

    nueva("E1Visita.dc.html", "16 · Visita y encuesta de obra", lambda p: pagina(
        "Visita a la propiedad · Aviso de encuesta",
        kicker("ETAPA 1 · PASOS 7 Y 9")
        + titulo("Aviso de visita a la propiedad", tamano=34)
        + ficha([("CUÁNDO", "<strong>Antes de cualquier visita</strong>: materiales, relevamiento o equipo"),
                 ("QUIÉN", "Quien agenda la visita, coordinado con Experiencia Solar"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Visita a la propiedad\"</strong>")], margen=20)
        + aviso("La queja que originó todo este proceso empezó acá: una visita que no estaba en el "
                "calendario. <strong>Falló primero como registro</strong>, y por eso falló el aviso.",
                "duro", margen=16)
        + parrafo("<strong>Se pide confirmación del cliente</strong>, no se le informa y punto: hay que "
                  "saber si va a haber alguien y si el acceso está disponible.", margen=16)
        + cita("visita", margen=16)
        + f'  <div style="margin-top: 32px; padding-top: 28px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Aviso de la encuesta de obra", tamano=30)
        + ficha([("CUÁNDO", "Después del aviso de obra terminada, como <strong>contacto propio</strong>"),
                 ("QUIÉN", "Experiencia Solar")], margen=16)
        + parrafo("<strong>La encuesta la genera el sistema solo</strong>, pero <strong>no le avisa al "
                  "cliente que la tiene</strong>. Por eso el paso no es \"encuesta enviada\" sino "
                  "\"le avisé al cliente que la tiene\".", margen=14)
        + cita("encuesta_obra", margen=16)
        + aviso("<strong>Nunca pegado a otro mensaje.</strong> Un pedido de encuesta al final de un mensaje "
                "sobre otra cosa se ignora.", "ojo", margen=16),
        p))

    nueva("E1ObraTerminada.dc.html", "17 · Obra terminada", lambda p: paso(
        "ETAPA 1 · PASO 8", "EL MISMO DÍA", "Aviso de obra terminada y qué sigue",
        "El mensaje que cierra la obra y abre la espera. Va antes que la encuesta.",
        [ficha([("CUÁNDO", "El mismo día que termina la instalación"),
                ("QUIÉN", "Experiencia Solar"),
                ("EN LA APP", "Ficha del cliente → E1 → \"Aviso de obra terminada y qué sigue\""),
                ("QUÉ DECIR", "Plantilla <strong>\"Obra terminada y qué sigue\"</strong>")]),
         subtitulo("Tres cosas que no pueden faltar", margen=26, tamano=19),
         numerados(["Que <strong>terminó</strong> la instalación.",
                    "Que <strong>ahora arranca el trámite con UTE</strong>, con su plazo real.",
                    "Que <strong>todavía no puede encender</strong> hasta que UTE habilite."], margen=14),
         parrafo("El punto 3 es de seguridad y de expectativa a la vez.", margen=14),
         cita("obra_terminada", margen=18),
         aviso("<strong>Va antes que la encuesta.</strong> Primero se le cuenta cómo sigue, después se le "
               "pide que evalúe. Al revés parece que le pedimos una nota antes de terminar de explicarle "
               "qué pasó.", "ojo", margen=20)],
        p))

    # ── Etapa 2 ──────────────────────────────────────────────────────────────
    nueva("PortadillaE2.dc.html", "18 · Etapa 2", lambda p: portadilla(
        "2", "De la obra a la habilitación", "la obra terminada", "que UTE habilita",
        "La etapa más difícil de todo el recorrido: tiene los paneles instalados en su techo, ya pagó "
        "buena parte, y no puede usarlos. Todos los días los ve y no generan nada.",
        "5",
        ["Aviso de habilitación otorgada — la Regla de Oro", "Aviso de la encuesta de habilitación"],
        p, foto=IMG.PORTADILLA_E2))

    existente("PasoEncender.dc.html", "19 · Ya podés encender")

    nueva("E2Espera.dc.html", "20 · La espera de UTE", lambda p: pagina(
        "La espera de UTE",
        kicker("ETAPA 2")
        + titulo("La espera de UTE")
        + bajada("Semanas en las que no pasa nada que el cliente pueda ver, sobre una oficina que no "
                 "controlamos. Es donde se pierde la paciencia.")
        + aviso("<strong>Lo único que sostiene esta etapa es la expectativa que se fijó en la conversación "
                "inicial.</strong> Si al cliente se le explicó al principio que esto iba a llevar semanas, "
                "la espera es tolerable. Si no, cada día es una traición.", "clave", margen=24)
        + subtitulo("Qué se hace durante la espera", margen=30)
        + parrafo("No hay pasos con plazo entre la obra y la habilitación, pero <strong>la cadencia de 5 "
                  "días sigue corriendo</strong>. Un cliente de E2 que pasa más de cinco días sin contacto "
                  "aparece marcado, y eso es a propósito: es la etapa donde el silencio más se nota.",
                  margen=12)
        + parrafo("<strong>No hace falta una novedad para escribir.</strong> Un \"te escribo para contarte "
                  "que tu trámite sigue en curso, sin novedades todavía; apenas haya algo te aviso\" vale "
                  "más que el silencio. Lo que no se puede es inventar un avance que no existe.", margen=14)
        + f'  <div style="margin-top: 32px; padding-top: 28px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Aviso de la encuesta de habilitación", tamano=32)
        + parrafo("Contacto propio, unos días después de que encendió. Misma regla que la de obra: "
                  "<strong>nunca pegada a otro mensaje</strong>.", margen=16)
        + cita("encuesta_habilitacion", margen=16)
        + parrafo("En la ficha, el <strong>trámite UTE</strong> se despliega con todos sus hitos, y es "
                  "<strong>la misma vista que el cliente ve en su portal</strong>: si pregunta en qué anda, "
                  "se le lee de ahí sin pedirle nada a Tramitación.", margen=16),
        p))

    # ── Etapa 3 ──────────────────────────────────────────────────────────────
    nueva("PortadillaE3.dc.html", "21 · Etapa 3", lambda p: portadilla(
        "3", "Post-habilitación", "que UTE habilita", "siempre",
        "El cliente ya está generando. Cambió lo que necesita: antes quería saber cuándo; ahora quiere "
        "entender lo que ve y saber que si algo falla nos enteramos.",
        "10",
        ["Capacitación: material y videos", "Acceso a la plataforma del inversor",
         "Alta en reportes mensuales", "Recorrido por el portal"],
        p, foto=IMG.PORTADILLA_E3))

    nueva("E3Capacitacion.dc.html", "22 · Capacitación y acceso al inversor", lambda p: pagina(
        "Capacitación · Acceso al inversor",
        kicker("ETAPA 3 · PASOS 1 Y 2")
        + titulo("Capacitación: material y videos", tamano=34)
        + ficha([("PLAZO", "15 días hábiles"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Material de capacitación\"</strong>")], margen=20)
        + cita("capacitacion", margen=16)
        + aviso("<strong>No es una llamada: es el envío del material.</strong> El paso se tilda cuando se "
                "mandó, no cuando el cliente lo miró.", "clave", margen=16)
        + f'  <div style="margin-top: 34px; padding-top: 30px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Acceso a la plataforma del inversor", tamano=34)
        + ficha([("PLAZO", "15 días hábiles"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Acceso a la plataforma del inversor\"</strong>")],
                margen=20)
        + parrafo("<strong>El usuario y la contraseña los deja registrados el técnico</strong> durante la "
                  "instalación. Acá solo se le entregan al cliente.", margen=20)
        + aviso("Si no están registrados, <strong>el problema es anterior</strong> y hay que ir a buscarlo a "
                "Operaciones. No es algo que Experiencia Solar pueda resolver sola, y tampoco algo que "
                "deba quedar trabado esperando.", "ojo", margen=20)
        + cita("acceso_inversor", margen=16),
        p))

    nueva("E3Reportes.dc.html", "23 · Alta en reportes mensuales", lambda p: paso(
        "ETAPA 3 · PASO 3", "15 DÍAS HÁBILES", "Alta en reportes mensuales",
        "El único correo automático que el cliente va a recibir de nosotros en 25 años. Vale la pena "
        "decírselo así: no es spam, es su resumen mensual.",
        [ficha([("PLAZO", "15 días hábiles"),
                ("QUIÉN", "Experiencia Solar"),
                ("QUÉ DECIR", "Plantilla <strong>\"Alta en los reportes mensuales\"</strong>")]),
         subtitulo("Cuándo le llega", margen=20, tamano=19),
         parrafo("No es a fin de mes: <strong>cada generador tiene su fecha de corte</strong>, el día en que "
                 "UTE le cierra la factura, y su reporte sale cuando le toca a él. En la pantalla de "
                 "Reportes, el botón <strong>Enviar pendientes</strong> manda los que están en fecha. Por "
                 "eso no hay un día del mes en que salgan todos juntos.", margen=10),
         subtitulo("El reporte dice qué días cubre", margen=22, tamano=19),
         parrafo("Arriba de todo aparece el período exacto —del tal al tal, tantos días—, porque un ciclo de "
                 "UTE no arranca el 1 ni termina el 30. Es lo que le permite al cliente comparar contra su "
                 "factura y que los números le cierren.", margen=10),
         aviso("Si pregunta por qué un mes tiene 28 días y otro 33, la respuesta es esa: "
               "<strong>es el ciclo de su medidor, no un error</strong>.", "ojo", margen=16),
         aviso("<strong>La factura se le explica al mes del encendido</strong>, con su factura real en la "
               "mano. Antes no hay nada que comparar.", "clave", margen=14),
         cita("alta_reportes", margen=18)],
        p, plazo_rojo=False))

    nueva("E3Portal.dc.html", "24 · Recorrido por el portal", lambda p: paso(
        "ETAPA 3 · PASO 4", "15 DÍAS HÁBILES", "Recorrido por el portal",
        "El paso que convierte el portal de \"una cosa que me mandaron\" en una herramienta que va a usar.",
        [ficha([("PLAZO", "15 días hábiles"),
                ("QUIÉN", "Experiencia Solar"),
                ("QUÉ MOSTRAR", "Tickets, encuestas, reportes y documentación")]),
         subtitulo("Qué conviene que sepa usar", margen=26, tamano=19),
         numerados(["<strong>Abrir un reclamo</strong> desde el portal, en vez de mandarlo por WhatsApp a "
                    "quien tenga a mano.",
                    "<strong>Ver sus reportes</strong> de generación, todos, sin depender del correo.",
                    "<strong>Responder las encuestas</strong> que le van a ir llegando.",
                    "<strong>Buscar su documentación</strong>: contrato, planos, constancias del trámite."],
                   margen=14),
         aviso("El reclamo por el portal es el que más nos conviene a los dos: <strong>queda registrado, se "
               "mide y nadie tiene que acordarse</strong>. Un reclamo por WhatsApp le llega a una persona; "
               "si esa persona está de licencia, el reclamo no existe.", "clave", margen=22),
         aviso("<strong>Tres cosas que tiene que aprender a hacer solo:</strong> cargar su <strong>fecha de "
               "corte</strong> (sin eso el reporte no coincide con la factura), cargar su <strong>tarifa</strong> "
               "y <strong>abrir un ticket</strong>.", "clave", margen=18),
         aviso("<strong>Al entregarle el sistema</strong>, contale la condición de la cobertura de voladura: "
               "Voltia se hace cargo si se vuelan paneles, siempre que haya hecho un mantenimiento en el "
               "último año.", "ojo", margen=14)],
        p, plazo_rojo=False))

    # ── La rutina ────────────────────────────────────────────────────────────
    existente("MediaHora.dc.html", "25 · La media hora de la mañana")

    nueva("CorreoManana.dc.html", "26 · El correo de la mañana", lambda p: pagina(
        "El correo de la mañana",
        kicker("CAPÍTULO 8 · HERRAMIENTA 1")
        + titulo("El correo de la mañana")
        + bajada("Llega un correo diario con lo que está pendiente, con la misma estructura que la pantalla "
                 "del Recorrido. <strong>Si no hay nada pendiente, no llega</strong>: un correo vacío todos "
                 "los días enseña a ignorarlo.")
        + f'  <div style="margin-top: 26px; display: flex; flex-direction: column; gap: 12px">\n'
          f'    <div style="padding: 18px 20px; background: {ROJO_FONDO}; border-radius: 10px">\n'
          f'      <div style="display: flex; justify-content: space-between; align-items: baseline">\n'
          f'        <span style="font-family: {SANS}; font-size: 18px; font-weight: 700; color: {ROJO}">'
          f'1 · Pendientes</span>\n'
          f'        <span style="font-family: {SANS}; font-size: 12px; color: {ROJO}">tienen plazo y ya venció</span>\n'
          f'      </div>\n'
          f'      <p style="margin: 8px 0 0; font-size: 14.5px; line-height: 1.5; color: #5e2626">'
          f'Avisos de habilitación sin dar, pasos con el plazo pasado y reclamos del cliente sin responder. '
          f'Lo más arrastrado primero.</p>\n'
          f'    </div>\n'
          f'    <div style="padding: 18px 20px; background: {AZUL_FONDO}; border-radius: 10px">\n'
          f'      <div style="display: flex; justify-content: space-between; align-items: baseline">\n'
          f'        <span style="font-family: {SANS}; font-size: 18px; font-weight: 700; color: {AZUL}">'
          f'2 · Novedades</span>\n'
          f'        <span style="font-family: {SANS}; font-size: 12px; color: {AZUL}">por etapa</span>\n'
          f'      </div>\n'
          f'      <p style="margin: 8px 0 0; font-size: 14.5px; line-height: 1.5; color: {TEXTO}">'
          f'Pasó algo en el proyecto después de la última vez que le hablamos, así que hay algo que '
          f'contarle.</p>\n'
          f'    </div>\n'
          f'    <div style="padding: 18px 20px; background: #f7f8fb; border-radius: 10px">\n'
          f'      <div style="display: flex; justify-content: space-between; align-items: baseline">\n'
          f'        <span style="font-family: {SANS}; font-size: 18px; font-weight: 700; color: {NEGRO}">'
          f'3 · Fuera de cadencia</span>\n'
          f'        <span style="font-family: {SANS}; font-size: 12px; color: {GRIS_CLARO}">por etapa</span>\n'
          f'      </div>\n'
          f'      <p style="margin: 8px 0 0; font-size: 14.5px; line-height: 1.5; color: {TEXTO}">'
          f'Les debemos el contacto del período de su etapa.</p>\n'
          f'    </div>\n  </div>\n'
        + aviso("<strong>Los tres números no se suman.</strong> El asunto dice \"2 pendientes · 12 novedades · "
                "85 fuera de cadencia\". Antes venía un total único que asustaba y, peor, escondía las dos o "
                "tres cosas que de verdad hay que hacer hoy entre setenta que pueden esperar.", "clave",
                margen=22)
        + aviso("<strong>Un cliente aparece una sola vez.</strong> Si tiene novedad va en Novedades aunque "
                "además esté fuera de cadencia: llamarlo por la novedad salda las dos cosas, y ahí mismo se "
                "le marcan los días sin contacto.", "ojo", margen=18)
        + parrafo("Quién lo recibe se configura por rol en <strong>Administración → Resumen diario</strong>, "
                  "opción \"Recorrido de Experiencia Solar\". Si alguien no lo recibe, es porque su rol no "
                  "lo tiene tildado.", margen=22, tamano=14),
        p))

    existente("Senales.dc.html", "27 · Las dos señales")

    nueva("FichaCliente.dc.html", "28 · La ficha del cliente", lambda p: pagina(
        "La ficha del cliente",
        kicker("CAPÍTULO 8 · HERRAMIENTA 3")
        + titulo("La ficha del cliente")
        + bajada("Es <strong>una sola pantalla</strong>, no cuatro pestañas: el recorrido arriba a la "
                 "izquierda, los pasos de la etapa elegida abajo, y todo el historial a la derecha.")
        + figura(IMG.FICHA_ENCABEZADO,
                 "Arriba de la ficha: los datos del cliente, el recorrido en tres etapas y los pasos de la "
                 "etapa abierta. La pantalla entera está en el <strong>Anexo F</strong>.", margen=22)
        + subtitulo("Qué hacés acá, en orden", margen=26)
        + numerados(["<strong>Leés</strong> el historial de arriba, que es lo que pasó desde la última vez.",
                     "<strong>Escribís</strong>, con la plantilla de la etapa si hay una que sirva.",
                     "<strong>Registrás el contacto.</strong> Si copiaste una plantilla ya viene tildado; si "
                     "hablaste por teléfono, lo cargás a mano. <strong>Esto es lo que mueve las "
                     "señales</strong>: sin registro, para el sistema no pasó nada.",
                     "<strong>Tildás el paso</strong> que acabás de hacer."], margen=14)
        + aviso("<strong>\"Completar los N\" es para ponerse al día con lo que realmente se hizo</strong>, no "
                "para limpiar la lista. Un paso tildado dice \"esto se hizo\", y si no se hizo, el tilde "
                "miente a todos los que miren ese cliente después — incluido quien tenga que retomarlo "
                "cuando vos no estés. Si un paso nunca se va a hacer, no se tilda: se plantea sacarlo del "
                "recorrido.", "duro", margen=22)
        + parrafo("La fila de enlaces del encabezado —Ventas · Proyecto · Ingeniería · Trámite UTE · "
                  "Experiencia Solar— lleva al <strong>mismo cliente</strong> en el otro módulo, y solo "
                  "muestra los módulos que podés abrir.", margen=20, tamano=14),
        p))

    nueva("MensajesModelo.dc.html", "29 · Los mensajes modelo", lambda p: pagina(
        "Los mensajes modelo",
        kicker("CAPÍTULO 9")
        + titulo("Los mensajes modelo")
        + bajada("Están en Voltia PM: ficha del cliente → una etapa → botón <strong>Plantillas</strong>. Son "
                 "catorce, y cada paso que tiene mensaje propio también lo abre directo.")
        + subtitulo("Tres cosas para saber", margen=28)
        + numerados(["<strong>Vienen con el nombre del cliente y el tuyo ya puestos.</strong> Lo que el "
                     "sistema no puede saber —la fecha, el motivo, el plazo, el nombre del capataz— queda "
                     "marcado a la vista, y abajo dice qué falta completar. Un hueco sin llenar se nota al "
                     "leer; uno inventado por el sistema se manda mal.",
                     "<strong>El texto se edita antes de copiar.</strong> Son un piso de tono y de "
                     "información, no un molde. Lo que no se puede perder es lo que el hito exige.",
                     "<strong>Al copiar queda registrado el contacto</strong> en el historial (se puede "
                     "destildar). Es la diferencia entre que el historial refleje la relación o quede vacío."],
                    margen=16)
        + subtitulo("Los catorce", margen=28, tamano=20)
        + f'  <p style="margin: 12px 0 0; font-size: 14.5px; line-height: 1.8; color: {TEXTO}">'
          f'bienvenida · acceso al portal · presentación del capataz · fecha tentativa · fecha confirmada · '
          f'reprogramación · visita a la propiedad · obra terminada · encuesta de instalación · ya podés '
          f'encender + capacitación · encuesta de habilitación · material de capacitación · acceso al '
          f'inversor · alta en reportes</p>\n'
        + aviso("<strong>Lo que todavía no hay:</strong> una plantilla para \"no hay novedad\", que es "
                "justamente el contacto que más se repite en la espera de UTE. Mientras tanto se escribe a "
                "mano, y lo importante es que salga igual: el trámite sigue en curso, sin novedades, y "
                "apenas haya algo se avisa.", "ojo", margen=26),
        p))

    nueva("Reclamos.dc.html", "30 · Reclamos", lambda p: pagina(
        "Reclamos",
        kicker("CAPÍTULO 10")
        + titulo("Reclamos")
        + f'  <div style="margin-top: 24px; padding: 26px 28px; background: {ROJO}; border-radius: 12px">\n'
          f'    <p style="margin: 0; font-family: {SANS}; font-size: 30px; font-weight: 700; line-height: 1.2; '
          f'color: #ffffff; letter-spacing: -.6px">Respuesta el mismo día hábil, siempre.</p>\n'
          f'    <p style="margin: 12px 0 0; font-size: 16px; line-height: 1.55; color: #f6dad6">'
          f'Aunque sea "lo estoy viendo, te confirmo mañana". <strong style="color: #ffffff; font-weight: 600">'
          f'La solución puede demorar; el cliente nunca queda sin respuesta.</strong></p>\n  </div>\n'
        + subtitulo("Por dónde entran", margen=30)
        + tabla(["VÍA", "QUÉ PASA"],
                [["Portal del cliente", "Queda registrado, notifica a Experiencia Solar y "
                  "<strong>aparece en el correo de la mañana</strong> si no se respondió"],
                 ["WhatsApp", "Es por donde entra la mayoría hoy. <strong>No queda registrado solo</strong>: "
                  "hay que abrirlo como ticket o al menos registrarlo en el historial"]],
                anchos=[170, None], margen=16)
        + aviso("<strong>Un reclamo cuenta como sin responder</strong> cuando está abierto, lo abrió el "
                "cliente desde el portal y no tiene ningún comentario de alguien de Voltia. Eso es lo que "
                "mide el compromiso del mismo día — y por eso <strong>el reclamo que entra por WhatsApp y "
                "no se abre como ticket no se mide en ningún lado</strong>.", "ojo", margen=22)
        + subtitulo("Estados de un ticket", margen=26, tamano=20)
        + f'  <div style="display: flex; gap: 8px; align-items: center; margin-top: 14px; flex-wrap: wrap">\n'
        + "".join(
            f'    <span style="font-family: {SANS}; font-size: 13px; font-weight: 600; color: {NEGRO}; '
            f'background: {AZUL_FONDO}; padding: 8px 14px; border-radius: 6px">{e}</span>'
            f'{"<span style=\"color: " + GRIS_CLARO + "\">→</span>" if i < 4 else ""}\n'
            for i, e in enumerate(["Abierto", "Derivado", "En progreso", "Resuelto", "Cerrado"]))
        + "  </div>\n"
        + aviso("<strong>Derivar no es responder.</strong> Si un reclamo se deriva a Ingeniería, el cliente "
                "igual tiene que recibir una respuesta ese día: \"ya lo estamos viendo con el equipo "
                "técnico\".", "duro", margen=22),
        p))

    nueva("Encuestas.dc.html", "31 · Encuestas de satisfacción", lambda p: pagina(
        "Encuestas de satisfacción",
        kicker("CAPÍTULO 11")
        + titulo("Encuestas de satisfacción")
        + bajada("Las genera el sistema solo y aparecen en el portal del cliente. Tres preguntas cada una, "
                 "y <strong>solo la primera es obligatoria</strong>: con una tasa de respuesta baja, sumar "
                 "fricción sería contraproducente.")
        + tabla(["ENCUESTA", "CUÁNDO SE DISPARA"],
                [["Instalación", "Al cerrarse la etapa de obra"],
                 ["Habilitación", "Al finalizar el trámite UTE"],
                 ["Aniversario", "En cada aniversario de la puesta en marcha"]],
                anchos=[170, None], margen=24)
        + subtitulo("Qué pregunta cada una", margen=26, tamano=20)
        + tabla(["", "INSTALACIÓN", "HABILITACIÓN", "ANIVERSARIO"],
                [["1", "Conformidad general", "Experiencia general", "Conformidad del año"],
                 ["2", "Claridad del proceso", "Acompañamiento en la espera", "Si nos recomendaría"],
                 ["3", "El equipo el día de la obra", "Claridad al encender", "Respuesta cuando necesitó algo"]],
                anchos=[26, None, None, None], margen=14)
        + aviso("La <strong>pregunta 2 de habilitación</strong> es la única de las nueve que evalúa el "
                "acompañamiento, o sea el trabajo de Experiencia Solar. Las otras evalúan a la empresa y al "
                "servicio.", "clave", margen=20)
        + subtitulo("Nota baja", margen=24, tamano=20)
        + parrafo("Es <strong>cualquiera</strong> de las tres en el umbral o por debajo (por defecto 3 "
                  "estrellas o menos, configurable). Genera un aviso a Experiencia Solar, y <strong>cada "
                  "nota baja genera el suyo</strong>: un cliente reiteradamente disconforme no se silencia "
                  "después del primero.", margen=10)
        + aviso("<strong>El sistema no le avisa al cliente que tiene una encuesta.</strong> Por eso hay un "
                "paso del recorrido para eso. Sin ese aviso, la encuesta se queda en el portal sin que "
                "nadie la vea — y si además no tiene el acceso creado, no puede ni entrar.", "duro",
                margen=22),
        p))

    nueva("Mantenimientos.dc.html", "32 · Mantenimientos", lambda p: pagina(
        "Mantenimientos y el acompañamiento largo",
        kicker("CAPÍTULO 12")
        + titulo("Mantenimientos y el acompañamiento largo")
        + bajada("El contrato incluye <strong>mantenimiento anual sin cargo los primeros 2 años</strong>.")
        + aviso("<strong>Los dos gratis los propone Voltia</strong>, sin esperar a que el cliente los pida: "
                "se le ofrece una fecha y se confirma con él, como cualquier visita. Y antes de que venza el "
                "segundo año se le recuerda la condición de la voladura: sin un mantenimiento en el último "
                "año, no hay cobertura.", "clave", margen=22)
        + subtitulo("Cómo funciona hoy", margen=26)
        + parrafo("El sistema calcula y muestra <strong>cuándo cumple años</strong> cada instalación (en la "
                  "ficha, \"Próximo mantenimiento\"), pero <strong>no agenda solo ni avisa cuando se "
                  "vence</strong>. Es una decisión: que agende solo visitas sin que nadie las confirme choca "
                  "con <strong>si no está agendado, no vamos</strong>. La iniciativa es de Voltia; la "
                  "confirmación, del cliente.", margen=10)
        + subtitulo("Monitoreo diario", margen=26)
        + parrafo("El sistema revisa todos los días que las plantas estén generando. Es lo que permite "
                  "prometerle al cliente que <strong>si su planta deja de generar nos enteramos "
                  "nosotros</strong>.", margen=10)
        + aviso("Y la promesa tiene una consecuencia: <strong>cuando el monitoreo detecta una falla, se "
                "contacta al cliente antes de que llame él</strong>. Si el primero en enterarse de la luz "
                "roja es el cliente, el monitoreo no sirvió.", "duro", margen=18)
        + aviso("<strong>Este es el capítulo más corto y el que cubre más tiempo.</strong> Las etapas 1 a 3 "
                "cubren unos meses; esto cubre los 25 años que siguen. Es donde hay más para construir.",
                "clave", margen=16),
        p))

    nueva("PlanGranizo.dc.html", "32b · Plan de Protección contra Granizo", lambda p: pagina(
        "Plan de Protección contra Granizo",
        kicker("CAPÍTULO 12.1")
        + titulo("El Plan de Protección contra Granizo", tamano=34)
        + bajada("USD 12 por panel por año, IVA incluido. Si el granizo le rompe paneles, Voltia se los repone "
                 "con todo incluido. Sólo paneles, sólo por granizo, siempre todos los paneles.")
        + aviso("<strong>No es un seguro, y no se le dice así.</strong> Decís plan, condiciones del plan, "
                "anualidad y daño por granizo. Nunca seguro, póliza, prima, siniestro ni asegurado.", "duro",
                margen=18)
        + subtitulo("Cómo se adhiere", margen=22, tamano=20)
        + numerados([
            "Con <strong>Condiciones y Anexo A</strong> (ficha del cliente, o subetapa Contrato del Onboarding) "
            "sale un solo PDF con el Anexo A completo. Revisás los datos, generás y se lo mandás.",
            "Das de alta el plan: <strong>nueva</strong> si se adhiere con la obra (sin carencia) o "
            "<strong>existente</strong> (cubre 30 días después del primer pago).",
            "Se activa con <strong>el Anexo A firmado y la primera anualidad paga</strong>. Subís la hoja firmada "
            "y marcás el cobro con la fecha real del pago.",
            "Instalación existente: pedile <strong>fotos actuales de los paneles</strong> y subilas. Son la única "
            "prueba si aparece un daño previo.",
        ], margen=12)
        + subtitulo("Cómo se sigue", margen=22, tamano=20)
        + parrafo("<strong>El nombre en rojo es tu aviso:</strong> falta un mes o menos para vencer, venció sin "
                  "pago o quedó suspendido. La anualidad siguiente se genera sola 30 días antes; cuando se pone "
                  "en rojo, le avisás el vencimiento. Con más de <strong>15 días</strong> de atraso queda "
                  "suspendido, y si paga después corre una nueva carencia. Voltia PM te avisa por la campana y en el "
                  "correo de la mañana, pero <strong>al cliente le escribís vos</strong>: en la ficha está "
                  "<strong>Avisar al cliente</strong>, con el mensaje listo.", margen=8, tamano=14)
        + parrafo("Las ampliaciones de Voltia se suman desde su puesta en marcha, con cobro proporcional. Si se "
                  "cambia el inversor, actualizás el número de serie. La baja no reintegra la anualidad en curso "
                  "y cubre hasta el fin del período pago.", margen=8, tamano=14),
        p))

    nueva("PlanGranizoDanio.dc.html", "32c · Cuando graniza", lambda p: pagina(
        "Cuando graniza",
        kicker("CAPÍTULO 12.1 · PLAN DE GRANIZO")
        + titulo("Cuando graniza", tamano=34)
        + bajada("El cliente avisa por WhatsApp o correo con el formulario del Anexo B y fotos.")
        + numerados([
            "<strong>Registrás el daño el mismo día</strong> (Registrar daño, en el plan) y le respondés ese "
            "mismo día hábil. Si la tormenta pegó en muchas obras, marcás <strong>evento masivo</strong>.",
            "<strong>Chequeo:</strong> Voltia PM te dice si ese día el plan cubría y si el aviso llegó fuera de "
            "plazo (más de 10 días hábiles).",
            "<strong>Inspección en sitio</strong> dentro de 10 días hábiles del aviso: fecha y lo que se vio.",
            "<strong>Confirmación por escrito</strong> al cliente: cuántos paneles se reponen y la fecha.",
            "<strong>Reposición</strong> dentro de 30 días de la inspección (60 si es evento masivo): fecha, "
            "paneles y costo real. Cada panel se repone una vez por año como máximo.",
            "<strong>Si algo no se repone</strong>, elegís la causal: cada una cita la sección de las "
            "condiciones, que es lo que le decís al cliente.",
        ], margen=16)
        + aviso("Cada daño muestra cuánto queda para inspeccionar o reponer, y se pone en rojo si se pasó el "
                "plazo.", "clave", margen=22)
        + aviso("<strong>La plata del plan no es ganancia:</strong> es la reserva para reponer cuando una tormenta "
                "pega en varias obras el mismo día. En Finanzas va en una línea propia.", "ojo", margen=16)
        + parrafo("<strong>Cuándo escalar:</strong> quién inspecciona y repone está por definir; mientras tanto, "
                  "a Operaciones.", margen=18, tamano=14),
        p))

    existente("ReglasDuras.dc.html", "33 · Las once reglas duras")
    existente("SaleMal.dc.html", "34 · Cuando algo sale mal")

    # ── Anexos ───────────────────────────────────────────────────────────────
    nueva("AnexoReferentes.dc.html", "35 · Anexo B · La tabla de referentes", lambda p: pagina(
        "Anexo B · La tabla de referentes",
        kicker("ANEXO B")
        + titulo("La tabla de referentes que ve el cliente")
        + bajada("Se entrega en la bienvenida. Se presenta como <strong>\"este es tu equipo\"</strong>, nunca "
                 "como \"estas son nuestras áreas\".")
        + f'  <div style="margin-top: 28px; padding: 28px 30px; border: 2px solid {AZUL}; border-radius: 12px">\n'
          f'    <div style="font-family: {SANS}; font-size: 22px; font-weight: 700; color: {NEGRO}; '
          f'margin-bottom: 18px">Tu equipo en Voltia</div>\n'
          f'    <table style="width: 100%; border-collapse: collapse">\n'
          f'      <tr><td style="padding: 12px 14px 12px 0; border-bottom: 1px solid {BORDE}; font-size: 15px; '
          f'line-height: 1.45; color: {TEXTO}">Horarios y accesos el día de la obra</td>'
          f'<td style="padding: 12px 0; border-bottom: 1px solid {BORDE}; font-size: 15px; font-weight: 600; '
          f'color: {NEGRO}; width: 230px">[capataz] — [teléfono]</td></tr>\n'
          f'      <tr><td style="padding: 12px 14px 12px 0; font-size: 15px; line-height: 1.45; color: {TEXTO}">'
          f'Todo lo demás: cómo viene tu instalación, fechas, el trámite, cualquier duda</td>'
          f'<td style="padding: 12px 0; font-size: 15px; font-weight: 600; color: {NEGRO}">'
          f'[referente] — [teléfono]</td></tr>\n'
          f'    </table>\n'
          f'    <p style="margin: 18px 0 0; font-size: 16px; font-weight: 600; color: {AZUL}">'
          f'Si no sabés a quién, escribile a [referente].</p>\n  </div>\n'
        + aviso("<strong>Esta tabla no puede usarse jamás para rebotar</strong> a un cliente que preguntó en "
                "el lugar equivocado. Si le escribe al capataz algo que no es de obra, el capataz lo "
                "resuelve internamente: no lo manda a otro lado.", "duro", margen=28)
        + parrafo("La tabla <strong>orienta</strong>, no reparte responsabilidades. Por eso cierra con \"ante "
                  "la duda, escribime a mí\": el cliente nunca tiene que adivinar de quién es su problema.",
                  margen=22),
        p))

    nueva("AnexoGlosario.dc.html", "36 · Anexo C · Glosario", lambda p: pagina(
        "Anexo C · Glosario",
        kicker("ANEXO C")
        + titulo("Glosario")
        + bajada("Las palabras que se usan en Voltia PM y en este manual, y que no siempre significan lo que "
                 "parece.")
        + tabla(["TÉRMINO", "QUÉ ES"],
                [["Generador", "El cliente, una vez que su instalación existe. Es como lo llama UTE y como "
                  "lo llama Voltia PM."],
                 ["E1 / E2 / E3", "Las tres etapas del recorrido del cliente. <strong>No son las etapas del "
                  "proyecto.</strong>"],
                 ["Cadencia", "Los días sin contacto a partir de los cuales un cliente se marca. E1: 3 · "
                  "E2: 5 · E3: 10. <strong>Es una alarma interna, no una promesa al cliente.</strong>"],
                 ["Paso", "Un hito de acompañamiento del recorrido. Algunos tienen plazo. "
                  "<strong>Vencer no bloquea.</strong>"],
                 ["Novedad", "Pasó algo en el proyecto después del último contacto registrado: hay algo "
                  "que contarle. No quiere decir que el cliente haya hecho algo."],
                 ["Pendiente", "En el correo de la mañana: tiene plazo y ya se venció. Lo único obligatorio "
                  "del día."],
                 ["Fuera de cadencia", "Más días sin contacto que los de su etapa. Puede tener novedad o no: "
                  "son cosas independientes."],
                 ["\"Ya lo vi\"", "Apaga el punto de novedad cuando al cliente no le importa lo que pasó. "
                  "<strong>No cuenta como contacto.</strong>"],
                 ["Regla de Oro", "El aviso de habilitación dentro de 24-48 horas."],
                 ["Traspaso", "El pase formal de trabajo entre áreas dentro del sistema."],
                 ["Ticket", "Un reclamo o consulta registrado, con estado y responsable."],
                 ["Portal", "La vista que tiene el cliente: avance, documentación, reportes, tickets y "
                  "encuestas."]],
                anchos=[160, None], margen=26),
        p))

    nueva("AnexoDecisiones.dc.html", "37 · Anexo D · Qué se decidió no hacer", lambda p: pagina(
        "Anexo D · Qué se decidió no hacer",
        kicker("ANEXO D")
        + titulo("Qué se decidió no hacer")
        + bajada("Es la parte que más se consulta cuando algo no aparece donde uno lo busca: antes de pensar que falta, conviene ver si no se decidió así a propósito.")
                + numerados(["<strong>El sistema no le escribe al cliente por su cuenta.</strong> Toda comunicación "
                     "saliente la hace una persona; el sistema arma el mensaje y recuerda cuándo. La única "
                     "excepción es el reporte mensual de generación.",
                     "<strong>El sistema no agenda los mantenimientos solo.</strong> La iniciativa es de "
                     "Voltia, pero la fecha la confirma una persona con el cliente.",
                     "<strong>No hay check de \"contacto semanal\".</strong> El cumplimiento se calcula "
                     "desde las interacciones registradas, no se declara tildando una casilla.",
                     "<strong>El acompañamiento salió del pipeline del proyecto.</strong> Nadie lo usaba: "
                     "eran casillas que se tildaban una vez y quedaban tildadas para siempre.",
                     "<strong>\"Ya lo vi\" no cuenta como contacto.</strong> Apaga el punto pero los días sin "
                     "contacto siguen corriendo: \"lo miré\" no es \"le hablé\".",
                     "<strong>Las señales son de todos.</strong> Si alguien apaga el punto, se apaga para "
                     "todos; quién hizo qué, está en el historial.",
                     "<strong>Se retiró el paso \"Repaso de garantías\" de E3.</strong> No se hacía: la "
                     "garantía ya está en el contrato firmado. Primero que funcione bien lo que ya está "
                     "definido."], margen=14),
        p))

    nueva("AnexoQueFalta.dc.html", "38 · Anexo D · Qué falta", lambda p: pagina(
        "Anexo D · Qué falta",
        kicker("ANEXO D, SEGUNDA PARTE")
        + titulo("Qué falta")
        + bajada("Lo que se sabe que no está, y que no se decidió dejar afuera: está pendiente.")
        + numerados(["<strong>Los accesos al portal no se crean solos.</strong> Mientras falten son el techo "
                     "de las encuestas y de los reclamos.",
                     "<strong>Los mails que se le mandan al cliente no cuentan como contacto</strong> en el "
                     "historial: hay que registrarlos aparte.",
                     "<strong>Los mantenimientos no tienen alerta de vencido</strong>, solo la cuenta de "
                     "cuánto falta.",
                     "<strong>No hay métricas de satisfacción</strong> consolidadas ni antigüedad de reclamos.",
                     "<strong>El portal no muestra el estado ni la fecha de obra</strong>, que es lo primero "
                     "que el cliente querría ver ahí.",
                     "<strong>Ingeniería y Tramitación no tienen dónde comentar</strong>, y sólo la ficha del "
                     "cliente muestra el historial completo."], margen=14),
        p))


    # ── Anexo E · las preguntas de los clientes ──────────────────────────────
    nueva("AnexoFAQ.dc.html", "Anexo E · Preguntas frecuentes", lambda p: pagina(
        "Anexo E · Las preguntas que hacen los clientes",
        kicker("ANEXO E")
        + titulo("Las preguntas que hacen los clientes")
        + bajada("La respuesta oficial de Voltia a los temas que los clientes preguntan de verdad, para que "
                 "armes el mensaje <strong>sin inventar política</strong>. Si aparece un tema nuevo, se agrega.")
        + subtitulo("Cada tema tiene cuatro partes", margen=20, tamano=18)
        + numerados(["<strong>Cómo lo puede preguntar el cliente</strong> — las variantes, para reconocer el tema.",
                     "<strong>Qué explicar</strong> — los puntos clave. No hay mensaje armado.",
                     "<strong>Política</strong> — lo que Voltia hace y no hace. Es lo que manda.",
                     "<strong>Escalar</strong> — si no se resuelve en Experiencia Solar, a quién va."], margen=12)
        + aviso("<strong>Si el cliente pregunta, el proceso falló en avisarle a tiempo.</strong> Cada consulta se "
                "registra en su historial con el motivo <strong>Consulta</strong>, aunque se resuelva en el "
                "momento. La meta es que las consultas por instalación tiendan a cero.", "duro", margen=18)
        + subtitulo("Reglas generales", margen=20, tamano=18)
        + numerados(["Antes de contestar, mirá la ficha: etapa, trámite UTE, último contacto.",
                     "Si podría haberlo resuelto solo, <strong>enseñale el camino</strong>. Educar sin retar.",
                     "<strong>Nombres fijos:</strong> \"el portal de Voltia\" y \"la aplicación de tu inversor\". "
                     "Nunca \"la app\" a secas.",
                     "Con UTE, <strong>rangos, nunca fechas exactas</strong>. Canal por defecto: WhatsApp.",
                     "Si el caso no está acá, <strong>no se improvisa</strong>: se consulta y se agrega. Lo "
                     "marcado <strong>A CONFIRMAR</strong> todavía no es política cerrada."], margen=12),
        p))

    # Los veinte temas se reparten en hojas según lo que MIDE cada uno, dibujado
    # con las fuentes reales (alturas-temas.json, lo produce medir-temas.mjs). La
    # primera versión estimaba la altura y se equivocó: los temas desbordaron la
    # hoja y taparon el pie. Si se cambia el texto de un tema, hay que volver a
    # medir antes de regenerar.
    alturas = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "alturas-temas.json")))
    # Lo que queda libre en la hoja: 1123 menos los márgenes (72 + 56), el pie
    # (~34), el rótulo de arriba y su aire (~35), y un margen de seguridad.
    DISPONIBLE = 1123 - 72 - 56 - 34 - 35 - 30
    SEPARADOR = 37      # la línea y el aire entre dos temas de la misma hoja
    hojas, actual, usado = [], [], 0
    for t in TEMAS_FAQ:
        alto = alturas[str(t[0])] + (SEPARADOR if actual else 0)
        if actual and usado + alto > DISPONIBLE:
            hojas.append(actual)
            actual, usado = [], 0
            alto = alturas[str(t[0])]
        actual.append(t)
        usado += alto
    if actual:
        hojas.append(actual)

    for nro_hoja, grupo in enumerate(hojas, 1):
        etapas = sorted({g[1] for g in grupo})
        rotulo = "ANEXO E · " + " / ".join(ETAPA_FAQ[e] for e in etapas)
        def hacer(p, grupo=grupo, rotulo=rotulo):
            cuerpo = kicker(rotulo) + '  <div style="margin-top: 16px"></div>\n' + "".join(
                tema(x[0], x[2], x[3], x[4], x[5], x[6], primero=(k == 0)) for k, x in enumerate(grupo))
            return pagina(f"Anexo E · temas {grupo[0][0]} a {grupo[-1][0]}", cuerpo, p)
        rango = f"tema {grupo[0][0]}" if len(grupo) == 1 else f"temas {grupo[0][0]}–{grupo[-1][0]}"
        nueva(f"AnexoFAQ{nro_hoja}.dc.html", f"Anexo E · {rango}", hacer)

    # ── Anexo F · Las pantallas ──────────────────────────────────────────────
    # El manual se lee lejos de la computadora, así que las pantallas van todas
    # juntas al final: el que nunca entró a la app ve de qué se le está
    # hablando, y el que ya trabaja en ella puede saltearlo entero.
    for archivo, titulo_board, args in [
        ("AnexoPantallaFicha.dc.html", "Anexo F · La ficha del cliente", dict(
            titulo="La ficha del cliente",
            bajada="La pantalla donde pasa casi todo el trabajo de Experiencia Solar. Es <strong>una "
                   "sola</strong>: a la izquierda el recorrido y los pasos, a la derecha el historial y el "
                   "cuadro para registrar el contacto.",
            url=IMG.FICHA_CLIENTE,
            epigrafe="Se entra desde <strong>Experiencia Solar → Generadores</strong>, haciendo clic en el "
                     "nombre del cliente.")),
        ("AnexoPantallaPasos.dc.html", "Anexo F · Los pasos de la etapa", dict(
            titulo="Los pasos de la etapa",
            bajada="Cada etapa trae su lista de pasos. Los <strong>resaltados</strong> son los que tienen "
                   "plazo y mueven el semáforo; el resto se tildan igual, pero no vencen.",
            url=IMG.RECORRIDO_ETAPAS,
            epigrafe="El botón <strong>Plantillas</strong>, arriba a la derecha, abre los mensajes modelo de "
                     "esa etapa. <strong>Completar los N</strong> sirve para ponerse al día, no para saltear "
                     "trabajo.",
            ancho="88%")),
        ("AnexoPantallaReglaOro.dc.html", "Anexo F · La Regla de Oro", dict(
            titulo="El paso de la Regla de Oro",
            bajada="Así se ve la etapa 2 en la ficha de alguien que ya tiene la obra hecha y espera a UTE. "
                   "El paso resaltado es el que tiene <strong>plazo en horas</strong>.",
            url=IMG.PASOS_E2,
            epigrafe="La alerta se apaga <strong>tildando el paso</strong>. Destildarlo la vuelve a encender, y "
                     "queda registrado quién lo marcó y cuándo.")),
        ("AnexoPantallaPlantillas.dc.html", "Anexo F · Los mensajes modelo", dict(
            titulo="Los mensajes modelo",
            bajada="El texto ya escrito para cada paso. Se elige a la izquierda, se lee a la derecha y se "
                   "copia con el botón: <strong>es un piso de tono, no un texto obligatorio</strong>.",
            url=IMG.PLANTILLAS,
            epigrafe="Lo que está entre corchetes hay que completarlo antes de mandar. El tilde de "
                     "<strong>registrar el contacto en la bitácora</strong> viene marcado: si se deja, el "
                     "contacto queda anotado solo.")),
        ("AnexoPantallaUte.dc.html", "Anexo F · El trámite de UTE", dict(
            titulo="El trámite de UTE, hito por hito",
            bajada="Dentro de la ficha, el trámite se despliega con todos sus hitos y sus fechas. "
                   "<strong>Es exactamente lo que el cliente ve en su portal</strong>.",
            url=IMG.TRAMITE_UTE,
            epigrafe="Si el cliente pregunta en qué anda su trámite, se le lee de acá. No hace falta "
                     "consultarle nada a Tramitación.",
            ancho="86%")),
        ("AnexoPantallaPortal.dc.html", "Anexo F · El portal del cliente", dict(
            titulo="El portal, como lo ve el cliente",
            bajada="Conviene conocerlo de memoria: es lo que el cliente tiene abierto cuando escribe. Desde "
                   "el listado se puede abrir <strong>en modo cliente</strong> para ver su pantalla tal cual.",
            url=IMG.PORTAL_CLIENTE,
            epigrafe="El cliente ve el avance del trámite, sus reportes, sus tickets y las encuestas. "
                     "<strong>No ve</strong> el historial interno ni los comentarios del equipo.")),
        ("AnexoPantallaReportes.dc.html", "Anexo F · Los reportes mensuales", dict(
            titulo="Los reportes mensuales",
            bajada="El tablero desde donde salen los reportes de generación. Cada generador tiene su fecha de "
                   "corte, así que no salen todos el mismo día: <strong>Enviar pendientes</strong> manda los "
                   "que están en fecha.",
            url=IMG.REPORTES_FV,
            epigrafe="Los tres botones numerados marcan el orden: traer los datos, generar el PDF y recién "
                     "ahí enviar.")),
        ("AnexoPantallaListado.dc.html", "Anexo F · El listado de clientes", dict(
            titulo="El listado de clientes",
            bajada="La pantalla de la media hora de la mañana. Los clientes vienen <strong>agrupados por "
                   "etapa y ordenados por prioridad de contacto</strong>, no alfabéticamente.",
            url=IMG.LISTADO_CLIENTES,
            epigrafe="El triángulo de la izquierda marca al que tiene algo pendiente. La columna "
                     "<strong>último contacto</strong> dice hace cuántos días que nadie le escribe.")),
        ("AnexoPantallaCalendario.dc.html", "Anexo F · El calendario de obra", dict(
            titulo="El calendario de obra",
            bajada="Donde se agenda la instalación. Importa para el manual por una sola razón: "
                   "<strong>el plazo de avisar la fecha empieza a correr cuando la fecha se confirma acá</strong>.",
            url=IMG.CALENDARIO,
            epigrafe="La leyenda distingue la <strong>fecha tentativa</strong> de la <strong>confirmada</strong>. "
                     "Hasta que no está confirmada, al cliente se le avisa como tentativa.")),
    ]:
        nueva(archivo, titulo_board, lambda p, a=args: pagina_captura(numero=p, **a))

    # La hoja de cierre está maquetada a mano, como la portada: la foto va a
    # sangre y no lleva el pie de las páginas de contenido.
    existente("Cierre.dc.html", "Cierre")

    return P


if __name__ == "__main__":
    destino = sys.argv[1] if len(sys.argv) > 1 else "."
    paginas = construir()
    carpeta = os.path.join(destino, "project")
    os.makedirs(carpeta, exist_ok=True)

    boards, orden, escritas = {}, [], 0
    for i, (archivo, titulo_board, html) in enumerate(paginas):
        if html is not None:
            with open(os.path.join(carpeta, archivo), "w", encoding="utf-8") as f:
                f.write(html)
            escritas += 1
        col, fila = i % 6, i // 6
        boards[archivo] = {"x": col * (ANCHO + 80), "y": fila * (ALTO + 120),
                           "w": ANCHO, "h": ALTO, "title": titulo_board, "paper": "a4"}
        orden.append(archivo)

    indice = {
        "v": 3,
        "createdOnFiles": {"v": 1, "at": "2026-09-25T02:40:00Z"},
        "title": "Manual de Posventa — Experiencia Solar",
        "launch": {"view": "canvas"},
        "pages": [],
        "designSystems": [],
        "boards": boards,
        "order": orden,
        "notes": {"muestra": {"x": 0, "y": -300,
                              "text": "Manual de Posventa — Experiencia Solar",
                              "kind": "title1", "maxW": 5164}},
    }
    with open(os.path.join(carpeta, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)

    print(f"{len(paginas)} páginas en el orden final · {escritas} generadas · "
          f"{len(paginas) - escritas} ya maquetadas a mano (solo se renumeran)")
