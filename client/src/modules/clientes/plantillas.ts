/**
 * Los mensajes modelo de Experiencia Solar, listos para copiar y mandar.
 *
 * Por qué viven acá y no en el manual solamente: el procedimiento define siete
 * hitos que se avisan sí o sí, pero el texto estaba en un documento que nadie
 * abre mientras trabaja. Si copiar cuesta, no se copia — y el aviso sale
 * improvisado o no sale.
 *
 * **No son textos obligatorios.** Son un piso de tono y de información: se
 * adaptan el nombre, las fechas y el detalle. Lo que no se puede perder es lo que
 * el procedimiento exige de cada hito (ver `docs/manual/09-experiencia-cliente.md`).
 *
 * Los `{marcadores}` que el sistema conoce se rellenan solos; los que dependen
 * de la situación (la fecha, el motivo, el plazo) quedan a la vista para que
 * quien manda los complete. Que se vean es a propósito: un hueco sin llenar se
 * nota al leer, uno inventado por el sistema no.
 */

import type { ClienteRecorrido } from "../../api/clientes.api";

export type PlantillaMotivo = "BIENVENIDA" | "SEGUIMIENTO" | "AVISO_HABILITACION" | "OTRO";

export type Plantilla = {
  id: string;
  recorrido: ClienteRecorrido;
  titulo: string;
  /** Cuándo se manda. Se muestra arriba del texto. */
  cuando: string;
  /** Códigos de checks del recorrido que este mensaje resuelve. */
  checks: string[];
  /** Motivo con el que se registra en la bitácora al copiarlo. */
  motivo: PlantillaMotivo;
  cuerpo: string;
};

export const PLANTILLAS: Plantilla[] = [
  {
    id: "bienvenida",
    recorrido: "E1",
    titulo: "Bienvenida y presentación",
    cuando: "Al cerrar la venta. Es la que sostiene todo: sin ella, el silencio se lee como abandono.",
    checks: ["e1_bienvenida", "e1_expectativa"],
    motivo: "BIENVENIDA",
    cuerpo: `Hola {nombre}, soy {referente} de Voltia. Voy a ser tu contacto durante todo el proceso, así que cualquier cosa escribime directo a mí.

Te cuento cómo sigue: primero preparamos la ingeniería y los materiales, después hacemos la instalación (te aviso la fecha apenas la tengamos), y cuando la obra está pronta arranca el trámite con UTE, que es el paso más largo y depende de ellos — suele llevar {plazo UTE}. Cuando UTE habilita, te aviso enseguida para que puedas encender.

No te voy a escribir todas las semanas porque muchas veces no hay novedades, pero cada vez que pase algo te aviso. Y si querés saber cómo viene, me preguntás cuando quieras.`,
  },
  {
    id: "portal",
    recorrido: "E1",
    titulo: "Acceso al portal",
    cuando: "Junto con la bienvenida o apenas se le crea el usuario.",
    checks: ["e1_portal"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te dejo el acceso al portal de Voltia para que veas el avance de tu instalación, la documentación y tus reportes de generación.

{usuario y contraseña}
Link: {link del portal}

Te va a pedir cambiar la contraseña al entrar. Cualquier duda, escribime.`,
  },
  {
    id: "capataz",
    recorrido: "E1",
    titulo: "Presentación del capataz",
    cuando: "Al arrancar la obra. Se presenta, no se deriva: el cliente sigue conmigo para todo lo demás.",
    checks: ["e1_capataz"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, durante la obra te va a coordinar {capataz} para horarios y accesos — te paso su contacto: {teléfono}.

Cualquier otra cosa seguí conmigo, como hasta ahora.`,
  },
  {
    id: "fecha_tentativa",
    recorrido: "E1",
    titulo: "Fecha de obra tentativa",
    cuando: "Apenas hay una fecha, aunque no esté cerrada.",
    checks: [],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, ya tenemos fecha tentativa para tu instalación: {fecha}.

Todavía depende del clima y de la logística, así que te la confirmo en cuanto esté cerrada.`,
  },
  {
    id: "fecha_confirmada",
    recorrido: "E1",
    titulo: "Fecha de obra confirmada",
    cuando: "Dentro de 2 días hábiles de que se confirma en el calendario.",
    checks: ["e1_fecha_obra"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te confirmo la instalación para el {fecha}. El equipo llega cerca de las {hora}.

Durante la obra te va a coordinar {capataz} para horarios y accesos, te paso su contacto: {teléfono}. Cualquier otra cosa seguí conmigo.`,
  },
  {
    id: "reagenda",
    recorrido: "E1",
    titulo: "Reprogramación de la obra",
    cuando: "El mismo día en que se mueve la fecha. Antes de que el cliente pregunte.",
    checks: ["e1_reagenda"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te aviso que tenemos que mover la fecha del {fecha} por {motivo}.

Apenas tengamos la nueva te la confirmo — calculamos {estimación}. Perdón por el cambio.`,
  },
  {
    id: "visita",
    recorrido: "E1",
    titulo: "Visita a la propiedad",
    cuando: "Antes de cualquier visita: materiales, relevamiento o equipo. Si no está agendado, no se va.",
    checks: [],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te aviso que el {día} entre {franja horaria} pasa el equipo por tu casa a {motivo de la visita}.

No hace falta que estés, pero necesitamos {acceso requerido}. ¿Te queda bien ese día?`,
  },
  {
    id: "obra_terminada",
    recorrido: "E1",
    titulo: "Obra terminada y qué sigue",
    cuando: "Al terminar la instalación. Va antes que la encuesta.",
    checks: ["e1_obra_terminada"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, terminamos la instalación.

Ahora arranca el trámite con UTE para que te habiliten la conexión: es el paso más largo y depende de ellos, suele llevar {plazo UTE}.

Todavía no podés encender el sistema hasta que UTE habilite — apenas lo hagan te aviso el mismo día.`,
  },
  {
    id: "encuesta_obra",
    recorrido: "E1",
    titulo: "Aviso de la encuesta de instalación",
    cuando: "Contacto propio, nunca pegado a otro mensaje.",
    checks: ["e1_encuesta_obra"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te dejamos una encuesta cortita en el portal sobre cómo te fue con la instalación. Son tres preguntas y solo la primera es obligatoria.

Nos sirve mucho para saber qué mejorar. Gracias.`,
  },
  {
    id: "habilitacion",
    recorrido: "E2",
    titulo: "Ya podés encender + capacitación",
    cuando: "Dentro de 24-48 h de la habilitación. Cada día que pasa el cliente deja de ahorrar.",
    checks: ["e2_habilitacion"],
    motivo: "AVISO_HABILITACION",
    cuerpo: `Hola {nombre}, UTE ya habilitó tu instalación: ya podés encenderla. Te explico cómo:

{pasos para encender}

Te dejo también el acceso a la app para que veas cuánto estás generando: {accesos e instrucciones}. En un día soleado como hoy deberías ver unos {generación esperable}. Los primeros días conviene mirarla seguido para acostumbrarte.

Cualquier duda con la app o con lo que ves, escribime.`,
  },
  {
    id: "encuesta_habilitacion",
    recorrido: "E2",
    titulo: "Aviso de la encuesta de habilitación",
    cuando: "Contacto propio, unos días después de que encendió.",
    checks: ["e2_encuesta_habilitacion"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, ahora que ya estás generando te dejamos una encuesta cortita en el portal sobre cómo viviste la espera del trámite y el acompañamiento.

Son tres preguntas. Gracias.`,
  },
  {
    id: "capacitacion",
    recorrido: "E3",
    titulo: "Material de capacitación",
    cuando: "Dentro de los 15 días hábiles de la habilitación.",
    checks: ["e3_capacitacion", "e3_portal_recorrido"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te paso el material para que le saques el jugo a tu instalación:

{videos y material}

En el portal tenés además tus reportes de generación, la documentación de la obra y un lugar para abrirnos un reclamo o una consulta cuando lo necesites. Si querés lo recorremos juntos por teléfono.`,
  },
  {
    id: "acceso_inversor",
    recorrido: "E3",
    titulo: "Acceso a la plataforma del inversor",
    cuando: "Dentro de los 15 días hábiles. El usuario y la contraseña los deja el técnico.",
    checks: ["e3_acceso_inversor"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te paso el acceso a la plataforma del inversor, que es donde ves la generación en vivo:

{usuario y contraseña}
{app o link}

Cualquier duda para entrar, escribime.`,
  },
  {
    id: "alta_reportes",
    recorrido: "E3",
    titulo: "Alta en los reportes mensuales",
    cuando: "Dentro de los 15 días hábiles.",
    checks: ["e3_alta_reportes"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te dimos de alta en los reportes mensuales: todos los meses te va a llegar por correo un resumen de cuánto generó tu instalación y cuánto ahorraste.

También los vas a tener siempre en el portal. Es el único correo automático que vas a recibir de nosotros.`,
  },
  {
    id: "garantias",
    recorrido: "E3",
    titulo: "Garantías y cierre",
    cuando: "Dentro de los 15 días hábiles. Cierra el acompañamiento de la puesta en marcha.",
    checks: ["e3_garantias"],
    motivo: "SEGUIMIENTO",
    cuerpo: `Hola {nombre}, te paso la documentación final de tu instalación: {documentos}.

Un par de cosas para que tengas presentes: la garantía cubre {alcance} por {plazo}, y tenés mantenimiento anual sin cargo los primeros 2 años — yo te voy a estar contactando cuando corresponda.

Nosotros seguimos monitoreando tu planta todos los días, así que si algo deja de generar nos enteramos y te avisamos.`,
  },
];

/** Las plantillas de una etapa del recorrido, en el orden en que se usan. */
export function plantillasDe(recorrido: ClienteRecorrido): Plantilla[] {
  return PLANTILLAS.filter((p) => p.recorrido === recorrido);
}

/**
 * La plantilla que resuelve un check. Los checks de reagenda son dinámicos
 * (`e1_reagenda_1`, `_2`…), así que se matchea por prefijo.
 */
export function plantillaDeCheck(codigo: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.checks.some((c) => codigo === c || codigo.startsWith(`${c}_`)));
}

export type CredencialesPortal = {
  /** Mail o alias con el que entra el Generador. */
  identificador: string;
  /** Solo se conoce en el momento de crearla o resetearla: no se guarda en claro. */
  password?: string | null;
};

/**
 * Rellena solo los marcadores que el sistema conoce de verdad. El resto quedan
 * como están: un hueco a la vista se completa, uno inventado se manda mal.
 *
 * Las credenciales del portal son la excepción interesante: el identificador se
 * sabe siempre que el Generador tenga acceso, pero **la contraseña sólo existe en
 * el momento en que se crea o se resetea** (después queda hasheada). Por eso, si
 * viene sin contraseña, se pone el usuario y se deja el hueco de la contraseña
 * a la vista en vez de inventar una.
 */
export function renderPlantilla(
  cuerpo: string,
  datos: {
    nombre?: string | null;
    referente?: string | null;
    portal?: CredencialesPortal | null;
  },
): string {
  const primerNombre = (datos.nombre ?? "").trim().split(/\s+/)[0] ?? "";
  let out = cuerpo;
  if (primerNombre) out = out.replaceAll("{nombre}", primerNombre);
  if (datos.referente?.trim()) out = out.replaceAll("{referente}", datos.referente.trim());

  if (datos.portal?.identificador) {
    const { identificador, password } = datos.portal;
    const esMail = identificador.includes("@");
    const credenciales = password
      ? `${esMail ? "Email" : "Usuario"}: ${identificador}\nContraseña: ${password}`
      : `${esMail ? "Email" : "Usuario"}: ${identificador}\nContraseña: {contraseña}`;
    out = out.replaceAll("{usuario y contraseña}", credenciales);
  }
  out = out.replaceAll("{link del portal}", `${window.location.origin}/portal`);
  return out;
}

/** Marcadores que quedaron sin completar, para avisar antes de mandar. */
export function marcadoresPendientes(texto: string): string[] {
  return [...new Set(texto.match(/\{[^}]+\}/g) ?? [])];
}

/**
 * El mensaje de acceso al portal, listo para mandar.
 *
 * Vive acá y no en un helper aparte porque antes había **dos textos distintos
 * para lo mismo**: el que armaba el modal de crear usuario y el de la plantilla.
 * Decían cosas parecidas con palabras distintas, y el cliente recibía uno u otro
 * según por dónde se hubiera pasado. Ahora hay un solo texto: el de la plantilla
 * `portal`, y este helper es la forma corta de renderizarlo.
 */
export function buildPortalWelcomeMessage(params: {
  name: string;
  /** El mail o el alias: lo que el cliente tiene que escribir para entrar. */
  identificador: string;
  password?: string | null;
  /** Quién firma. Opcional: sin esto queda el marcador a la vista. */
  referente?: string | null;
}): string {
  const plantilla = PLANTILLAS.find((p) => p.id === "portal");
  if (!plantilla) return "";
  return renderPlantilla(plantilla.cuerpo, {
    nombre: params.name,
    referente: params.referente,
    portal: { identificador: params.identificador, password: params.password },
  });
}
