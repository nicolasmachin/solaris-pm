// Precarga de datos del contrato desde el proyecto: cliente (Project), inmueble
// (ubicación del proyecto), sistema (SolarSystem) y precio/energía (snapshot de la
// propuesta aceptada). Lo que no exista queda sin setear → se completa a mano.

import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/errors.js";

// Espeja (parcial) la forma de ContractDataPublish; el cliente mergea esto sobre
// los defaults del form.
export interface ContractContext {
  cliente?: { nombre?: string; documento?: string };
  instalacion?: { direccion?: string; ciudad?: string; departamento?: string };
  sistema?: {
    cantidadPaneles?: number;
    potenciaUnitariaWp?: number;
    potenciaTotalKwp?: number;
    marcaPaneles?: string;
    cantidadInversores?: number;
    potenciaInversorKw?: number;
    marcaInversor?: string;
    tipoTecho?: string;
    generacionAnualKwh?: number;
  };
  comercial?: { precioTotalUsd?: number };
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nonEmpty(s: string | null | undefined): string | undefined {
  return s && s.trim() ? s : undefined;
}

export async function buildContractContext(projectId: string): Promise<ContractContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      calle: true,
      numCalle: true,
      locationCity: true,
      locationProvince: true,
      estimatedMwhYear: true,
      budgetUsd: true,
      solarSystems: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        take: 1,
      },
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

  const cliente: ContractContext["cliente"] = {
    nombre: nonEmpty(project.nombreCliente) ?? nonEmpty(project.clientName),
    documento: nonEmpty(project.ciCliente),
  };

  const direccion = [project.calle, project.numCalle].map((x) => x?.trim()).filter(Boolean).join(" ");
  const instalacion: ContractContext["instalacion"] = {
    direccion: nonEmpty(direccion),
    ciudad: nonEmpty(project.locationCity),
    departamento: nonEmpty(project.locationProvince),
  };

  // Sistema: SolarSystem si existe; si no, el snapshot de la propuesta aceptada.
  const ss = project.solarSystems[0];
  const snapshot = project.convertedLeads
    .flatMap((l) => l.proposalV2Versions)
    .map((v) => v.snapshot as unknown as {
      data?: { sistema?: Record<string, unknown>; techo?: Record<string, unknown> };
      calc?: Record<string, unknown>;
    })[0];
  const snapSistema = snapshot?.data?.sistema ?? {};
  const snapTecho = snapshot?.data?.techo ?? {};
  const snapCalc = snapshot?.calc ?? {};

  const cantidadPaneles = ss?.panelQuantity ?? num(snapSistema.cantidadPaneles);
  const potenciaUnitariaWp = ss?.panelPowerW ?? num(snapSistema.potenciaPanelW);
  const potenciaTotalKwp =
    cantidadPaneles != null && potenciaUnitariaWp != null
      ? Math.round((cantidadPaneles * potenciaUnitariaWp) / 10) / 100
      : undefined;

  const generacionAnualKwh =
    num(snapCalc.energiaAnualKwh) ??
    (num(project.estimatedMwhYear) != null ? Math.round(num(project.estimatedMwhYear)! * 1000) : undefined);

  const sistema: ContractContext["sistema"] = {
    cantidadPaneles,
    potenciaUnitariaWp,
    potenciaTotalKwp,
    marcaPaneles: nonEmpty(ss?.panelBrand) ?? nonEmpty(snapSistema.marcaPaneles as string),
    cantidadInversores: ss?.inverterQuantity ?? undefined,
    potenciaInversorKw: num(ss?.inverterPowerKw) ?? num(snapSistema.potenciaInversorKw),
    marcaInversor: nonEmpty(ss?.inverterBrand) ?? nonEmpty(snapSistema.marcaInversor as string),
    tipoTecho: nonEmpty(snapTecho.descripcion as string) ?? nonEmpty(snapSistema.tipoMontaje as string),
    generacionAnualKwh,
  };

  const precio = num(snapCalc.totalFinalConIva) ?? num(snapCalc.totalConIva) ?? num(project.budgetUsd);
  const comercial: ContractContext["comercial"] = {
    precioTotalUsd: precio != null ? Math.round(precio) : undefined,
  };

  return { cliente, instalacion, sistema, comercial };
}
