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
  };
  suministro: {
    departamento: string;
    localidad: string;
    calle: string;
    numero: string;
    cuenta: string;
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

// Construye el contexto del mail joineando Project + UteDocumentConfig (los datos
// están repartidos entre ambos). Los campos derivables con default no se marcan
// como faltantes; sí los datos de fuente directa que salgan vacíos.
export async function buildEmailContext(projectId: string): Promise<BuiltContext> {
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
    select: { cuentaUte: true, potContratada: true, tarifa: true, fasesMono: true, fasesTri: true },
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
    },
    suministro: {
      departamento: project.locationProvince,
      localidad: project.locationCity,
      calle: project.calle,
      numero: project.numCalle,
      cuenta: ute?.cuentaUte ?? "",
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
    },
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
    cliente: { nombre: "", ci: "", telefono: "", email: "", esEmpresa: false },
    suministro: { departamento: "", localidad: "", calle: "", numero: "", cuenta: "" },
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
    },
  };
}
