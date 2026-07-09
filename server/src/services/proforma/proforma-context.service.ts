// Precarga de datos de la proforma desde el proyecto: cliente (Project) y la
// descripción del producto (compuesta desde SolarSystem / snapshot de la propuesta
// aceptada). El monto solicitado NO se precarga (se carga a mano); el resto de los
// textos tiene su default en el cliente.

import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/errors.js";

export interface ProformaContext {
  cliente?: { nombre?: string; documento?: string; direccion?: string; telefono?: string; email?: string };
  // Descripción del producto ya compuesta (texto libre, editable en el form).
  descripcion?: string;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nonEmpty(s: string | null | undefined): string | undefined {
  return s && s.trim() ? s : undefined;
}

function fmtKw(n: number | undefined): string {
  if (n == null) return "";
  const dec = n % 1 === 0 ? 0 : 2;
  return n.toLocaleString("es-UY", { maximumFractionDigits: dec });
}

export async function buildProformaContext(projectId: string): Promise<ProformaContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      calle: true,
      numCalle: true,
      locationCity: true,
      clientPhone: true,
      clientEmail: true,
      solarSystems: { where: { deletedAt: null }, orderBy: { order: "asc" }, take: 1 },
      convertedLeads: {
        select: {
          proposalV2Versions: {
            where: { status: "PUBLISHED" },
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { snapshot: true },
          },
        },
      },
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe.");

  const direccion = [
    [project.calle, project.numCalle].map((x) => x?.trim()).filter(Boolean).join(" "),
    nonEmpty(project.locationCity),
  ].filter(Boolean).join(", ");

  const cliente: ProformaContext["cliente"] = {
    nombre: nonEmpty(project.nombreCliente) ?? nonEmpty(project.clientName),
    documento: nonEmpty(project.ciCliente),
    direccion: nonEmpty(direccion),
    telefono: nonEmpty(project.clientPhone),
    email: nonEmpty(project.clientEmail),
  };

  // ── Descripción del producto (compuesta desde el sistema) ──
  const ss = project.solarSystems[0];
  const snapshot = project.convertedLeads
    .flatMap((l) => l.proposalV2Versions)
    .map((v) => v.snapshot as unknown as {
      data?: { sistema?: Record<string, unknown>; factura?: Record<string, unknown> };
    })[0];
  const snapSistema = snapshot?.data?.sistema ?? {};
  const snapFactura = snapshot?.data?.factura ?? {};

  const cantidadPaneles = ss?.panelQuantity ?? num(snapSistema.cantidadPaneles);
  const potenciaPanelW = ss?.panelPowerW ?? num(snapSistema.potenciaPanelW);
  const potenciaKw =
    cantidadPaneles != null && potenciaPanelW != null
      ? Math.round((cantidadPaneles * potenciaPanelW) / 10) / 100
      : undefined;
  const inversorCantidad = ss?.inverterQuantity ?? 1;
  const inversorPotenciaKw = num(ss?.inverterPowerKw) ?? num(snapSistema.potenciaInversorKw);
  let inversorTipo = "monofásico";
  if (ss?.inverterPhaseType) inversorTipo = ss.inverterPhaseType === "MONOFASICO" ? "monofásico" : "trifásico";
  else if (snapFactura.suministro === "trifásico") inversorTipo = "trifásico";

  const descripcion =
    `Instalación solar fotovoltaica, llave en mano, con objetos trasportables, para uso residencial, de ${fmtKw(potenciaKw)} kW de potencia.\n` +
    `Características principales:\n` +
    `• ${cantidadPaneles ?? ""} paneles solares de ${potenciaPanelW ?? ""}W.\n` +
    `• ${inversorCantidad} inversor ${inversorTipo} de ${fmtKw(inversorPotenciaKw)} kW.\n` +
    `• Instalación incluída.`;

  return { cliente, descripcion };
}
