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
    aviso, bajada, ficha, hueco, kicker, mensaje, numerados, pagina, parrafo,
    paso, portadilla, subtitulo, tabla, titulo,
)

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
    "ReglasDuras.dc.html": "33 · Las diez reglas duras",
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
             ["Capataz / Operaciones", "1, 4, 5 (obra), 13", "12 (la app)"],
             ["Comercial", "1, 4, 5.1 (bienvenida), 13", "—"],
             ["Ingeniería", "4, 13", "12"],
             ["Tramitación UTE", "4, 6, 13", "—"],
             ["Gerencia / Administración", "1, 8, 13, 14", "Todo"]],
            anchos=[None, 180, 210], margen=26)
        + aviso("Las secciones <strong>13 (Las reglas duras)</strong> y <strong>14 (Cuando algo "
                "sale mal)</strong> son las que hay que saber de memoria. El resto se consulta.",
                "clave", margen=26)
        + subtitulo("Qué es este documento", margen=34)
        + parrafo("Es <strong>el procedimiento y el manual de uso de la app, juntos</strong>. Cada paso "
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
        + subtitulo("Lo que aparece solo, sin que nadie lo escriba", margen=26, tamano=20)
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
        p))

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
         mensaje("PLANTILLA · BIENVENIDA",
                 "Hola <span style=\"color: " + VERDE + "; font-weight: 600\">[nombre]</span>, soy "
                 "<span style=\"color: " + VERDE + "; font-weight: 600\">[referente]</span> de Voltia. Voy a ser tu "
                 "contacto durante todo el proceso, así que cualquier cosa escribime directo a mí.<br><br>"
                 "Te cuento cómo sigue: primero preparamos la ingeniería y los materiales, después hacemos "
                 "la instalación (te aviso la fecha apenas la tengamos), y cuando la obra está pronta "
                 "arranca el trámite con UTE, que es el paso más largo y depende de ellos.<br><br>"
                 "<strong>No te voy a escribir todas las semanas porque muchas veces no hay novedades, "
                 "pero cada vez que pase algo te aviso.</strong> Y si querés saber cómo viene, me "
                 "preguntás cuando quieras."),
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
         subtitulo("Hay que cubrir, explícitamente:", margen=26, tamano=19),
         numerados(["<strong>El recorrido completo</strong>, etapa por etapa.",
                    "<strong>Cuánto demora cada una</strong>, con números reales, no optimistas.",
                    "<strong>El trámite UTE y su plazo</strong> — es el que genera la ansiedad, y el que "
                    "no depende de nosotros.",
                    "<strong>Que no va a haber contacto de rutina, pero sí en cada hito.</strong>"],
                   margen=14),
         aviso("<strong>Es una conversación, no un mensaje.</strong> Idealmente por teléfono. Lo que se "
               "busca es que el cliente pueda <strong>repetir con sus palabras</strong> cuánto va a "
               "demorar y por qué.", "clave"),
         aviso("Después se registra en el historial qué se le dijo. Esto no es burocracia: si cuatro meses "
               "después el cliente reclama que \"nadie le avisó que iba a demorar tanto\", la ficha tiene "
               "que poder responder esa pregunta.", "ojo")],
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
         parrafo("<strong>Cómo se crea:</strong> desde el propio paso, con el ícono a la derecha. El mail y "
                 "el teléfono se toman de los datos del cliente y la contraseña por defecto es "
                 "<strong>12345678</strong>, que el sistema le pide cambiar al entrar. Al terminar, la "
                 "plantilla sale con el usuario y la contraseña ya adentro.", margen=22),
         aviso("Si el cliente <strong>ya tenía acceso</strong>, la plantilla trae su usuario pero deja la "
               "contraseña en blanco: no se puede recuperar. Para mandársela hay que resetearla con el "
               "botón de reenviar.", "ojo", margen=20),
         subtitulo("Qué gana el cliente con el portal", margen=26, tamano=19),
         parrafo("Ve el avance de su trámite, la documentación, sus reportes de generación cuando "
                 "arranquen, y <strong>puede abrirnos un reclamo por ahí</strong> en vez de por WhatsApp.",
                 margen=10),
         aviso("<strong>Este paso arrastra a varios más.</strong> Sin acceso al portal el cliente no puede "
               "abrir tickets ni responder encuestas, así que las encuestas quedan sin responder y los "
               "reclamos siguen entrando por WhatsApp a cualquiera. Al que se le pasó, nadie se lo crea "
               "seis meses más tarde.", "duro", margen=22)],
        p, plazo_rojo=False))

    nueva("E1Capataz.dc.html", "13 · Capataz y reprogramación", lambda p: pagina(
        "Presentación del capataz · Reprogramación",
        kicker("ETAPA 1 · PASOS 4 Y 6")
        + titulo("Presentación del capataz", tamano=34)
        + ficha([("CUÁNDO", "Al arrancar la obra, o junto con la fecha confirmada"),
                 ("QUIÉN", "Experiencia Solar"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Presentación del capataz\"</strong>")], margen=20)
        + aviso("<strong>Con el alcance explícito</strong>: obra con él, todo lo demás conmigo. Sin esa "
                "frase, el cliente asume que el capataz reemplazó a Experiencia Solar y deja de "
                "escribirle — y ahí perdemos la vista de la relación.", "clave", margen=20)
        + f'  <div style="margin-top: 34px; padding-top: 30px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Aviso de reprogramación", tamano=34)
        + ficha([("CUÁNDO", "<strong>El mismo día</strong> en que se mueve la fecha"),
                 ("QUIÉN", "Experiencia Solar"),
                 ("PLAZO", "<strong>1 día hábil</strong>"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Reprogramación de la obra\"</strong>")], margen=20)
        + parrafo("<strong>Mover una obra ya confirmada exige el motivo en el sistema.</strong> No es un "
                  "trámite: quien tiene que avisarle al cliente necesita saber qué decirle. Si la obra "
                  "todavía era tentativa no se pide motivo — nadie prometió nada.", margen=20)
        + aviso("<strong>Cada reprogramación genera su propio pendiente</strong>, con el motivo adentro. Si "
                "a un cliente le mueven la fecha tres veces, quedan tres avisos, no uno. Antes era una "
                "sola casilla que se tildaba una vez y quedaba tildada para siempre, y por eso la segunda "
                "reagenda no se avisaba.", "ojo", margen=20),
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
         aviso("Entre la venta y esa confirmación pasa bastante: primero va onboarding, después "
               "pre-ingeniería, y recién en la validación de Operaciones queda la fecha. Los dos días "
               "hábiles cuentan desde ahí, no desde que se cerró la venta.", "ojo", margen=20),
         hueco("CAPTURA DE PANTALLA", "El calendario de obra con una fecha confirmada", alto=200, margen=24)],
        p))

    existente("ReglaAgenda.dc.html", "15 · Regla dura: si no está agendado")

    nueva("E1Visita.dc.html", "16 · Visita y encuesta de obra", lambda p: pagina(
        "Visita a la propiedad · Aviso de encuesta",
        kicker("ETAPA 1 · PASOS 7 Y 9")
        + titulo("Aviso de visita a la propiedad", tamano=34)
        + ficha([("CUÁNDO", "<strong>Antes de cualquier visita</strong>: materiales, relevamiento o equipo"),
                 ("QUIÉN", "Quien agenda la visita, coordinado con Experiencia Solar"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Visita a la propiedad\"</strong>")], margen=20)
        + aviso("La queja que originó la revisión de todo este proceso empezó acá: una visita que no estaba "
                "en el calendario oficial. <strong>Falló primero como registro</strong> — y por eso falló "
                "el aviso. No se puede avisar de algo que el sistema no sabe que va a pasar.", "duro",
                margen=20)
        + parrafo("<strong>Se pide confirmación del cliente</strong>, no se le informa y punto: hay que "
                  "saber si va a haber alguien y si el acceso está disponible.", margen=18)
        + f'  <div style="margin-top: 32px; padding-top: 28px; border-top: 2px solid {BORDE}"></div>\n'
        + titulo("Aviso de la encuesta de obra", tamano=34)
        + ficha([("CUÁNDO", "Después del aviso de obra terminada, como <strong>contacto propio</strong>"),
                 ("QUIÉN", "Experiencia Solar"),
                 ("EN LA APP", "Ficha del cliente → E1 → \"Aviso de la encuesta de obra\"")], margen=20)
        + parrafo("<strong>La encuesta la genera el sistema solo</strong> al completarse la etapa de obra: "
                  "aparece en el portal del cliente. Lo que <strong>no</strong> hace el sistema es avisarle "
                  "que la tiene. Por eso el paso no es \"encuesta enviada\" sino "
                  "<strong>\"le avisé al cliente que la tiene\"</strong>.", margen=18)
        + aviso("<strong>Nunca pegado a otro mensaje.</strong> Un pedido de encuesta al final de un mensaje "
                "sobre otra cosa se ignora.", "ojo", margen=20),
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
         mensaje("PLANTILLA · OBRA TERMINADA",
                 "Hola <span style=\"color: " + VERDE + "; font-weight: 600\">[nombre]</span>, terminamos la "
                 "instalación.<br><br>Ahora arranca el trámite con UTE para que te habiliten la conexión: es "
                 "el paso más largo y depende de ellos, suele llevar "
                 "<span style=\"color: " + VERDE + "; font-weight: 600\">[plazo UTE]</span>.<br><br>"
                 "<strong>Todavía no podés encender el sistema hasta que UTE habilite</strong> — apenas lo "
                 "hagan te aviso el mismo día.", margen=20),
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
        p))

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
        + hueco("CAPTURA DE PANTALLA", "El trámite UTE en la ficha, con sus hitos desplegados",
                alto=190, margen=26)
        + parrafo("Esa vista es <strong>la misma que el cliente ve en su portal</strong>: si pregunta en qué "
                  "anda el trámite, se le puede leer de ahí sin pedirle nada a Tramitación.", margen=16),
        p))

    # ── Etapa 3 ──────────────────────────────────────────────────────────────
    nueva("PortadillaE3.dc.html", "21 · Etapa 3", lambda p: portadilla(
        "3", "Post-habilitación", "que UTE habilita", "siempre",
        "El cliente ya está generando. Cambió lo que necesita: antes quería saber cuándo; ahora quiere "
        "entender lo que ve y saber que si algo falla nos enteramos.",
        "10",
        ["Capacitación: material y videos", "Acceso a la plataforma del inversor",
         "Alta en reportes mensuales", "Recorrido por el portal"],
        p))

    nueva("E3Capacitacion.dc.html", "22 · Capacitación y acceso al inversor", lambda p: pagina(
        "Capacitación · Acceso al inversor",
        kicker("ETAPA 3 · PASOS 1 Y 2")
        + titulo("Capacitación: material y videos", tamano=34)
        + ficha([("PLAZO", "15 días hábiles"),
                 ("QUÉ DECIR", "Plantilla <strong>\"Material de capacitación\"</strong>")], margen=20)
        + aviso("<strong>No es una llamada: es el envío del material.</strong> El paso se tilda cuando se "
                "mandó, no cuando el cliente lo miró. Si quiere recorrerlo por teléfono, mejor, pero no es "
                "condición.", "clave", margen=20)
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
        + parrafo("Este paso y el anterior se hacen <strong>en el mismo contacto que el aviso de "
                  "habilitación</strong> siempre que se pueda: el cliente está en su momento de mayor "
                  "atención.", margen=20),
        p))

    nueva("E3Reportes.dc.html", "23 · Alta en reportes mensuales", lambda p: paso(
        "ETAPA 3 · PASO 3", "15 DÍAS HÁBILES", "Alta en reportes mensuales",
        "El único correo automático que el cliente va a recibir de nosotros en 25 años. Vale la pena "
        "decírselo así: no es spam, es su resumen mensual.",
        [ficha([("PLAZO", "15 días hábiles"),
                ("QUIÉN", "Experiencia Solar"),
                ("QUÉ DECIR", "Plantilla <strong>\"Alta en los reportes mensuales\"</strong>")]),
         subtitulo("Cuándo le llega", margen=26, tamano=19),
         parrafo("No es a fin de mes: <strong>cada generador tiene su fecha de corte</strong>, el día en que "
                 "UTE le cierra la factura, y su reporte sale cuando le toca a él. En la pantalla de "
                 "Reportes, el botón <strong>Enviar pendientes</strong> manda los que están en fecha. Por "
                 "eso no hay un día del mes en que salgan todos juntos.", margen=10),
         subtitulo("El reporte dice qué días cubre", margen=22, tamano=19),
         parrafo("Arriba de todo aparece el período exacto —del tal al tal, tantos días—, porque un ciclo de "
                 "UTE no arranca el 1 ni termina el 30. Es lo que le permite al cliente comparar contra su "
                 "factura y que los números le cierren.", margen=10),
         aviso("Si pregunta por qué un mes tiene 28 días y otro 33, la respuesta es esa: "
               "<strong>es el ciclo de su medidor, no un error</strong>.", "ojo", margen=20),
         hueco("CAPTURA DE PANTALLA", "Un reporte mensual, con el período arriba", alto=175, margen=22)],
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
         aviso("<strong>Cerrar con el mantenimiento.</strong> El contrato incluye mantenimiento anual sin "
               "cargo los primeros 2 años y la mayoría de los clientes no lo recuerda. No se produce ningún "
               "documento nuevo: se le recuerda lo que ya firmó, ahora que tiene el sistema andando y le "
               "importa.", "ojo", margen=20)],
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
        + hueco("CAPTURA DE PANTALLA", "La ficha completa, con el recorrido y el historial", alto=230,
                margen=24)
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
        + bajada("Están en la app: ficha del cliente → una etapa → botón <strong>Plantillas</strong>. Son "
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
        + subtitulo("Cómo funciona hoy", margen=28)
        + parrafo("El sistema calcula y muestra <strong>cuándo cumple años</strong> cada instalación (en la "
                  "ficha, \"Próximo mantenimiento\"), pero <strong>no hay agendamiento automático ni alerta "
                  "de vencido</strong>. Los mantenimientos se agendan a mano.", margen=12)
        + aviso("Es una decisión, no un olvido: auto-agendar visitas a la propiedad de un cliente sin que "
                "nadie las confirme choca con la regla de que <strong>si no está agendado, no se va</strong>. "
                "Primero el listado, después la agenda manual.", "clave", margen=20)
        + subtitulo("Monitoreo diario", margen=28)
        + parrafo("El sistema revisa todos los días que las plantas estén generando. Es lo que permite "
                  "prometerle al cliente que <strong>si su planta deja de generar nos enteramos "
                  "nosotros</strong>.", margen=12)
        + aviso("Es <strong>la promesa más fuerte que hacemos</strong>, y depende de que el monitoreo cubra "
                "efectivamente a todas las plantas. Antes de hacérsela a un cliente conviene saber si la "
                "suya está cubierta: no todas las marcas de inversor entraron al monitoreo al mismo tiempo.",
                "ojo", margen=20)
        + aviso("<strong>Este es el capítulo más corto y el que cubre más tiempo.</strong> Las etapas 1 a 3 "
                "cubren unos tres meses de relación; esto cubre los 25 años que siguen. Es donde el modelo "
                "hoy se termina, y donde hay más para construir.", "clave", margen=20),
        p))

    existente("ReglasDuras.dc.html", "33 · Las diez reglas duras")
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
        + bajada("Las palabras que se usan en la app y en este manual, y que no siempre significan lo que "
                 "parece.")
        + tabla(["TÉRMINO", "QUÉ ES"],
                [["Generador", "El cliente, una vez que su instalación existe. Es como lo llama UTE y como "
                  "lo llama la app."],
                 ["E1 / E2 / E3", "Las tres etapas del recorrido del cliente. <strong>No son las etapas del "
                  "proyecto.</strong>"],
                 ["Cadencia", "Los días sin contacto a partir de los cuales un cliente se marca. E1: 3 · "
                  "E2: 5 · E3: 10. <strong>Es una alarma interna, no una promesa al cliente.</strong>"],
                 ["Paso", "Un hito de acompañamiento del recorrido. Algunos tienen plazo. "
                  "<strong>Vencer no bloquea.</strong>"],
                 ["Novedad", "Pasó algo en el proyecto posterior al último contacto registrado: el cliente "
                  "todavía no lo sabe."],
                 ["Regla de Oro", "El aviso de habilitación dentro de 24-48 horas."],
                 ["Traspaso", "El pase formal de trabajo entre áreas dentro del sistema."],
                 ["Ticket", "Un reclamo o consulta registrado, con estado y responsable."],
                 ["Portal", "La vista que tiene el cliente: avance, documentación, reportes, tickets y "
                  "encuestas."]],
                anchos=[160, None], margen=26),
        p))

    nueva("AnexoQueFalta.dc.html", "37 · Anexo D · Qué falta", lambda p: pagina(
        "Anexo D · Qué falta y qué se decidió no hacer",
        kicker("ANEXO D")
        + titulo("Qué falta y qué se decidió no hacer")
        + bajada("Es la parte que más se consulta cuando algo no aparece donde uno lo busca.")
        + subtitulo("Decisiones tomadas a propósito", margen=26, tamano=20)
        + numerados(["<strong>El sistema no le escribe al cliente por su cuenta.</strong> Toda comunicación "
                     "saliente la hace una persona; el sistema arma el mensaje y recuerda cuándo. La única "
                     "excepción es el reporte mensual de generación.",
                     "<strong>Los mantenimientos no se auto-agendan.</strong> Choca con \"si no está "
                     "agendado, no se va\".",
                     "<strong>No hay check de \"contacto semanal\".</strong> El cumplimiento se calcula "
                     "desde las interacciones registradas, no se declara tildando una casilla.",
                     "<strong>El acompañamiento salió del pipeline del proyecto.</strong> Al equipo de obra "
                     "no le aportaba y le ensuciaba la vista.",
                     "<strong>Se retiró el paso \"Repaso de garantías\" de E3.</strong> No se hacía: la "
                     "garantía ya está en el contrato firmado. Primero que funcione bien lo que ya está "
                     "definido."], margen=14)
        + subtitulo("Lo que falta", margen=26, tamano=20)
        + numerados(["<strong>Los accesos al portal no se crean solos.</strong> Mientras falten son el techo "
                     "de las encuestas y de los reclamos.",
                     "<strong>Los mails que se le mandan al cliente no cuentan como contacto</strong> en el "
                     "historial: hay que registrarlos aparte.",
                     "<strong>Los mantenimientos no tienen alerta de vencido</strong>, solo la cuenta de "
                     "cuánto falta.",
                     "<strong>No hay métricas de satisfacción</strong> consolidadas ni antigüedad de reclamos.",
                     "<strong>El portal no muestra el estado ni la fecha de obra</strong>, que es lo primero "
                     "que el cliente querría ver ahí."], margen=14),
        p))

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
