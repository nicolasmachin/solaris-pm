import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/errors.js";

// Contexto plano por namespaces que consumen las plantillas Handlebars.
export interface EmailTemplateContext {
  cliente: {
    nombre: string;
    ci: string;
    telefono: string;
    email: string;
    esEmpresa: boolean;
    // Tipo de documento en el vocabulario del formulario de UTE: CI | RUT | Otros.
    documento: string;
  };
  suministro: {
    departamento: string;
    localidad: string;
    calle: string;
    numero: string;
    cuenta: string;
    // Campos del formulario de Suministro Individual (aumento de potencia /
    // solicitud). La consulta de microgenerador no los usa.
    padron: string;
    duplicador: string;
    apartamento: string;
    avisoAcceso: string;
    notificaciones: string;
    // Dirección alternativa para las notificaciones. Solo se completa si el
    // cliente NO quiere recibirlas en la dirección del suministro.
    notifCalle: string;
    notifNumero: string;
    notifDuplicador: string;
    notifApartamento: string;
    notifDepartamento: string;
    notifLocalidad: string;
  };
  tecnica: {
    tension: string;
    potenciaGenerador: string;
    potenciaContratada: string;
    tarifa: string;
    acometida: string;
    destino: string;
    pasaLinea: string;
    certificadoCarga: string;
    cargaPerturbadora: string;
    // Campos del formulario de Suministro Individual. `potenciaSolicitada` es
    // la potencia nueva que se le pide a UTE; `fases` se deriva de la tensión.
    //
    // `tensionNivel` es la MISMA tensión que `tension` pero en el vocabulario
    // del formulario ("230 V" / "400 V"), donde el nivel y las fases son dos
    // campos separados. `tension` conserva el formato de la consulta de
    // microgenerador ("BT Monofásico 230V") y no se toca para no cambiar ese mail.
    tensionNivel: string;
    tipoSolicitud: string;
    tramite: string;
    tramiteAsociado: string;
    requerimiento: string;
    tipoMedida: string;
    actividad: string;
    potenciaSolicitada: string;
    fases: string;
    dobleContratacion: string;
    // Solo aplica con doble contratación. La potencia en valle no está: en el
    // formulario de UTE es una fórmula que se calcula sola.
    potenciaPunta: string;
    instaladaCalefaccion: string;
    observaciones: string;
    // Modo del formulario de Suministro Individual: true = aumento de potencia
    // contratada, false = solicitud de suministro. Solo cambia el asunto y el
    // encabezado; el resto del formulario es idéntico.
    esAumento: boolean;
  };
  // Firma de cortesía = datos del usuario que prepara/envía la consulta. Campos
  // crudos del User (string vacío si faltan) para que la plantilla omita líneas.
  firma: {
    nombre: string;
    cargo: string;
    telefono: string;
    email: string;
  };
}

// Resuelve la firma del remitente desde el User (crudo, sin fallback: cargo y
// teléfono vacíos si no están cargados, para que el condicional los omita).
export async function resolveFirmaContext(senderUserId?: string): Promise<EmailTemplateContext["firma"]> {
  if (!senderUserId) return { nombre: "", cargo: "", telefono: "", email: "" };
  const u = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { name: true, jobTitle: true, phone: true, email: true },
  });
  return {
    nombre: u?.name ?? "",
    cargo: u?.jobTitle ?? "",
    telefono: u?.phone ?? "",
    email: u?.email ?? "",
  };
}

export interface BuiltContext {
  context: EmailTemplateContext;
  missingVariables: string[];
}

// Deriva la tensión de los flags de UteDocumentConfig. Vacío si no hay datos.
function derivarTension(ute: { fasesMono: boolean; fasesTri: boolean } | null): string {
  if (!ute) return "";
  if (ute.fasesMono) return "BT Monofásico 230V";
  if (ute.fasesTri) return "BT Trifásico 400V";
  return "";
}

// Nivel de tensión en el vocabulario del formulario de UTE ("230 V"/"400 V").
function derivarTensionNivel(ute: { fasesMono: boolean; fasesTri: boolean } | null): string {
  if (!ute) return "";
  if (ute.fasesMono) return "230 V";
  if (ute.fasesTri) return "400 V";
  return "";
}

// Fases en el vocabulario del formulario de UTE ("Monofásica"/"Trifásica").
// Se deriva de los mismos flags que la tensión para que no puedan contradecirse.
function derivarFases(ute: { fasesMono: boolean; fasesTri: boolean } | null): string {
  if (!ute) return "";
  if (ute.fasesMono) return "Monofásica";
  if (ute.fasesTri) return "Trifásica";
  return "";
}

// Construye el contexto del mail joineando Project + UteDocumentConfig (los datos
// están repartidos entre ambos). Los campos derivables con default no se marcan
// como faltantes; sí los datos de fuente directa que salgan vacíos.
export async function buildEmailContext(projectId: string, senderUserId?: string): Promise<BuiltContext> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      clientPhone: true,
      clientEmail: true,
      empresa: true,
      locationProvince: true,
      locationCity: true,
      calle: true,
      numCalle: true,
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const ute = await prisma.uteDocumentConfig.findUnique({
    where: { projectId },
    select: {
      cuentaUte: true,
      potContratada: true,
      potSolicitada: true,
      tarifa: true,
      fasesMono: true,
      fasesTri: true,
    },
  });

  const esEmpresa = project.empresa;
  const nombre = project.nombreCliente.trim() || project.clientName;

  const context: EmailTemplateContext = {
    cliente: {
      nombre,
      ci: project.ciCliente,
      telefono: project.clientPhone ?? "",
      email: project.clientEmail ?? "",
      esEmpresa,
      documento: esEmpresa ? "RUT" : "CI",
    },
    suministro: {
      departamento: project.locationProvince,
      localidad: project.locationCity,
      calle: project.calle,
      numero: project.numCalle,
      cuenta: ute?.cuentaUte ?? "",
      padron: "",
      duplicador: "",
      apartamento: "",
      avisoAcceso: "",
      notificaciones: "Si",
      notifCalle: "",
      notifNumero: "",
      notifDuplicador: "",
      notifApartamento: "",
      notifDepartamento: "",
      notifLocalidad: "",
    },
    tecnica: {
      tension: derivarTension(ute),
      // potenciaGenerador: best-effort, sin fuente fiable hoy → vacío editable.
      potenciaGenerador: "",
      potenciaContratada: ute?.potContratada ?? "",
      tarifa: ute?.tarifa ?? "",
      acometida: "Aérea",
      destino: esEmpresa ? "Comercial." : "Residencial.",
      pasaLinea: "No corresponde",
      certificadoCarga: "No",
      cargaPerturbadora: "No",
      tensionNivel: derivarTensionNivel(ute),
      tipoSolicitud: "Definitiva",
      // "Aumento" es el trámite que corresponde a subir la potencia contratada.
      // El otro valor habitual es "Nuevo Servicio" (ver lista completa en la
      // hoja `check` del formulario de UTE).
      tramite: "Aumento",
      tramiteAsociado: "",
      requerimiento: "",
      tipoMedida: "Centralizado",
      // En el formulario de UTE la actividad es Residencial o General (no
      // "Comercial", que es el vocabulario de la consulta de microgenerador).
      actividad: esEmpresa ? "General" : "Residencial",
      potenciaSolicitada: ute?.potSolicitada ?? "",
      fases: derivarFases(ute),
      dobleContratacion: "No",
      potenciaPunta: "",
      instaladaCalefaccion: "No",
      // El formulario de UTE no tiene campo para el número de cuenta: se espera
      // dentro de Observaciones. Se precarga y queda editable.
      observaciones: ute?.cuentaUte
        ? `El número de cuenta del cliente es ${ute.cuentaUte}`
        : "",
      esAumento: true,
    },
    firma: await resolveFirmaContext(senderUserId),
  };

  // Faltantes = datos de fuente directa vacíos (no los que tienen default).
  const checks: Array<[string, string]> = [
    ["nombre del cliente", context.cliente.nombre],
    ["C.I./RUT", context.cliente.ci],
    ["email del cliente", context.cliente.email],
    ["departamento", context.suministro.departamento],
    ["localidad", context.suministro.localidad],
    ["calle", context.suministro.calle],
    ["número", context.suministro.numero],
    ["cuenta", context.suministro.cuenta],
    ["tensión", context.tecnica.tension],
    ["potencia contratada", context.tecnica.potenciaContratada],
    ["tarifa", context.tecnica.tarifa],
  ];
  const missingVariables = checks.filter(([, v]) => !v.trim()).map(([label]) => label);

  return { context, missingVariables };
}

// Contexto vacío (cuando no hay proyecto): todo en blanco, todo "faltante".
export function emptyContext(): EmailTemplateContext {
  return {
    cliente: { nombre: "", ci: "", telefono: "", email: "", esEmpresa: false, documento: "CI" },
    suministro: {
      departamento: "",
      localidad: "",
      calle: "",
      numero: "",
      cuenta: "",
      padron: "",
      duplicador: "",
      apartamento: "",
      avisoAcceso: "",
      notificaciones: "Si",
      notifCalle: "",
      notifNumero: "",
      notifDuplicador: "",
      notifApartamento: "",
      notifDepartamento: "",
      notifLocalidad: "",
    },
    tecnica: {
      tension: "",
      potenciaGenerador: "",
      potenciaContratada: "",
      tarifa: "",
      acometida: "Aérea",
      destino: "Residencial.",
      pasaLinea: "No corresponde",
      certificadoCarga: "No",
      cargaPerturbadora: "No",
      tensionNivel: "",
      tipoSolicitud: "Definitiva",
      tramite: "Aumento",
      tramiteAsociado: "",
      requerimiento: "",
      tipoMedida: "Centralizado",
      actividad: "Residencial",
      potenciaSolicitada: "",
      fases: "",
      dobleContratacion: "No",
      potenciaPunta: "",
      instaladaCalefaccion: "No",
      observaciones: "",
      esAumento: true,
    },
    firma: { nombre: "", cargo: "", telefono: "", email: "" },
  };
}
