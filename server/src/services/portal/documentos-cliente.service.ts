// "Mis documentos" del portal: lo que el cliente firmó con Voltia y para UTE, y
// su Plan de Protección contra Granizo con los plazos. Todo filtrado por los
// proyectos del cliente (`clients.some.userId`), así que también funciona en la
// vista como cliente (el hook del portal reemplaza al usuario).
//
// Los archivos son FileAttachment ya existentes; se reconocen por `toolSource`.
// Solo se sirven los de la lista de abajo: nada interno (fotos de obra,
// presupuestos, notas) puede salir por acá aunque sea del mismo proyecto.

import { prisma } from "../../lib/prisma.js";
import { toDateOnlyString } from "../../utils/dates.js";
import { notFound } from "../../utils/errors.js";
import { TOOL_SOURCE_CONTRATO_FIRMADO, TOOL_SOURCE_PLAN_GRANIZO } from "../documentos-generados.service.js";
import { estadoDePoliza, polizaInclude, TOOL_SOURCE_ANEXO } from "../seguro-granizo/polizas.service.js";
import { SUMINISTRO_PRINCIPAL } from "../suministros.service.js";

const TOOL_SOURCE_UTE_FIRMADOS = "ute-docs-firmados";

/** Lo único que el portal puede descargar. */
const PERMITIDOS = [TOOL_SOURCE_CONTRATO_FIRMADO, TOOL_SOURCE_UTE_FIRMADOS, TOOL_SOURCE_ANEXO, TOOL_SOURCE_PLAN_GRANIZO];

type Archivo = { id: string; nombre: string; cargadoEl: string };

const archivo = (f: { id: string; filename: string; createdAt: Date }): Archivo => ({
  id: f.id,
  nombre: f.filename,
  cargadoEl: f.createdAt.toISOString(),
});

export async function documentosDelCliente(userId: string) {
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, clients: { some: { userId } } },
    select: { id: true, clientName: true, capacityKwp: true },
    orderBy: { createdAt: "asc" },
  });
  const ids = proyectos.map((p) => p.id);

  const [archivos, polizas] = await Promise.all([
    prisma.fileAttachment.findMany({
      where: { projectId: { in: ids }, deletedAt: null, toolSource: { in: PERMITIDOS } },
      select: { id: true, projectId: true, filename: true, createdAt: true, toolSource: true, suministro: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.seguroGranizoPoliza.findMany({ where: { projectId: { in: ids }, deletedAt: null }, include: polizaInclude }),
  ]);

  return proyectos.map((p) => {
    const delProyecto = archivos.filter((a) => a.projectId === p.id);
    const de = (src: string) => delProyecto.filter((a) => a.toolSource === src);

    // Papeles de UTE: uno o varios archivos por cuenta (suministro). El número
    // de cuenta se muestra solo si el proyecto tiene más de una.
    const porSuministro = new Map<number, Archivo[]>();
    for (const a of de(TOOL_SOURCE_UTE_FIRMADOS)) {
      const n = a.suministro ?? SUMINISTRO_PRINCIPAL;
      porSuministro.set(n, [...(porSuministro.get(n) ?? []), archivo(a)]);
    }

    const poliza = polizas.find((x) => x.projectId === p.id) ?? null;
    let plan = null;
    if (poliza) {
      const e = estadoDePoliza(poliza);
      const anexo = poliza.anexoFileId ? delProyecto.find((a) => a.id === poliza.anexoFileId) ?? null : null;
      const condiciones = de(TOOL_SOURCE_PLAN_GRANIZO).at(-1) ?? null;
      plan = {
        estado: e.estado,
        faltaFirma: e.faltaFirma,
        faltaPago: e.faltaPago,
        coberturaActiva: e.coberturaActiva,
        sinCarencia: poliza.sinCarencia,
        coberturaDesde: toDateOnlyString(e.coberturaDesde),
        vencimiento: toDateOnlyString(e.vencimiento),
        diasParaVencer: e.diasParaVencer,
        proximoCobro: e.proximoCobro
          ? { fecha: toDateOnlyString(e.proximoCobro.fecha), montoUsd: e.proximoCobro.montoUsd }
          : null,
        deudaUsd: e.deudaUsd,
        cantidadPaneles: poliza.cantidadPaneles,
        montoAnualUsd: Number(poliza.montoAnualUsd),
        anexo: anexo ? { ...archivo(anexo), firmadoEl: toDateOnlyString(poliza.anexoFirmadoEn) } : null,
        condiciones: condiciones ? archivo(condiciones) : null,
      };
    }

    return {
      projectId: p.id,
      nombre: p.clientName,
      capacityKwp: Number(p.capacityKwp),
      // Uno solo vigente: subir otro reemplaza al anterior.
      contrato: de(TOOL_SOURCE_CONTRATO_FIRMADO).at(-1) ? archivo(de(TOOL_SOURCE_CONTRATO_FIRMADO).at(-1)!) : null,
      ute: [...porSuministro.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([suministro, archivos]) => ({ suministro, archivos })),
      plan,
    };
  });
}

/** Un archivo de "Mis documentos", solo si es de un proyecto del cliente y de la lista permitida. */
export async function archivoDelCliente(userId: string, fileId: string) {
  const f = await prisma.fileAttachment.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
      toolSource: { in: PERMITIDOS },
      project: { deletedAt: null, clients: { some: { userId } } },
    },
    select: { filename: true, mimeType: true, url: true },
  });
  if (!f) throw notFound("DOCUMENTO_NO_ENCONTRADO", "El documento no existe o no es tuyo");
  return f;
}
