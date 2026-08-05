// Ampliaciones: obra nueva sobre una instalación que ya existe y ya está
// cargada en la app (se agregan paneles, se suma un inversor).
//
// Es un proyecto de verdad —su propio pipeline, su propia plata, su propio
// trámite UTE, y cuenta como una obra más en las métricas— pero nace heredando
// los datos del original en vez de retipearlos, y queda linkeado a él.
//
// El árbol es PLANO: una ampliación de una ampliación se cuelga de la misma
// raíz. Así los códigos nunca pasan de un sufijo y "las ampliaciones de esta
// obra" es una consulta de un solo nivel.

import { Prisma, UteStage, UteStatus } from "@prisma/client";
import path from "node:path";
import { promises as fsPromises } from "node:fs";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { getStoredFilePath } from "./file-storage.service.js";

/** Sufijo de ampliación sobre el código del padre: `PRY-2026-045-A1`. */
const SUFIJO_AMPLIACION = /-A(\d+)$/;

/**
 * La raíz del árbol: el proyecto original del que cuelgan todas las
 * ampliaciones. Si se pide una ampliación parada sobre una ampliación, el padre
 * que se guarda es este, no el hermano.
 */
export async function resolveRootProject(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, code: true, parentProjectId: true },
  });
  if (!project) return null;
  if (!project.parentProjectId) return project;

  const root = await prisma.project.findFirst({
    where: { id: project.parentProjectId, deletedAt: null },
    select: { id: true, code: true, parentProjectId: true },
  });
  // Si la raíz fue borrada, la ampliación pasa a ser su propia raíz: el árbol se
  // corta ahí en vez de colgar de un proyecto que ya no existe.
  return root ?? project;
}

/**
 * Siguiente código de ampliación para una raíz: `PRY-2026-045-A1`, `-A2`, …
 *
 * Mira TODOS los hijos, incluidos los borrados: reusar el sufijo de una
 * ampliación eliminada daría dos proyectos con el mismo código en el historial.
 *
 * `generateProjectCode` no se ve afectado por estos códigos: parsea
 * `code.split("-")[2]`, que acá da el mismo número que ya aporta el padre.
 */
export async function generateAmpliacionCode(rootId: string, rootCode: string) {
  const hijos = await prisma.project.findMany({
    where: { parentProjectId: rootId },
    select: { code: true },
  });

  const maxSufijo = hijos.reduce((max, hijo) => {
    const match = SUFIJO_AMPLIACION.exec(hijo.code);
    const n = match ? Number(match[1]) : NaN;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  return `${rootCode}-A${maxSufijo + 1}`;
}

/**
 * Copia un documento UTE (cédula, factura) al storage de la ampliación.
 *
 * Se copia el ARCHIVO, no la ruta: dos proyectos apuntando al mismo path
 * significa que borrar uno le rompe el documento al otro. Devuelve la ruta
 * relativa nueva, o null si el original no está en disco — un documento faltante
 * no puede hacer fallar la creación del proyecto.
 */
async function copiarDocumentoUte(
  relativePath: string | null,
  nuevoProjectId: string,
): Promise<string | null> {
  if (!relativePath) return null;

  const origen = getStoredFilePath(relativePath);
  const destinoRelativo = path.join(
    "projects",
    nuevoProjectId,
    "ute-docs",
    path.basename(relativePath),
  );
  const destino = path.resolve(process.cwd(), "..", env.storagePath, destinoRelativo);

  try {
    await fsPromises.mkdir(path.dirname(destino), { recursive: true });
    await fsPromises.copyFile(origen, destino);
    return destinoRelativo;
  } catch {
    return null;
  }
}

/** Campos del padre que se heredan tal cual. Todo lo demás arranca de cero. */
const CAMPOS_HEREDADOS = {
  tenantId: true,
  clientName: true,
  locationCity: true,
  locationProvince: true,
  clientEmail: true,
  clientPhone: true,
  clientAddress: true,
  nombreCliente: true,
  ciCliente: true,
  calle: true,
  numCalle: true,
  personaFisica: true,
  empresa: true,
  uteCodigoPS: true,
  uteCodigoAS: true,
  salespersonId: true,
  clientUserId: true,
  modalidadPago: true,
  llevaFactura: true,
  facturaNota: true,
  cedulaPath: true,
  facturaUtePath: true,
} as const;

export type AmpliacionInput = {
  capacityKwp: number;
  startDate: Date;
  plannedEndDate: Date | null;
  saleDate: Date;
  budgetUsd?: number | null;
  estimatedMwhYear?: number | null;
  solarSystemData?: Prisma.SolarSystemCreateWithoutProjectInput;
};

/**
 * Crea el registro del proyecto hijo + lo que cuelga de él en la misma
 * transacción (sistema fotovoltaico, clientes del portal, proceso UTE).
 *
 * El pipeline, los deadlines y las subetapas de UTE los arma el llamador con las
 * mismas funciones que usa `POST /projects`: hacen sus propias escrituras y no
 * entran en esta transacción.
 */
export async function crearAmpliacion(params: {
  root: { id: string; code: string };
  input: AmpliacionInput;
  userId: string;
}) {
  const { root, input, userId } = params;

  const padre = await prisma.project.findUniqueOrThrow({
    where: { id: root.id },
    select: { ...CAMPOS_HEREDADOS, id: true },
  });

  const code = await generateAmpliacionCode(root.id, root.code);

  const clientesDelPadre = await prisma.projectClient.findMany({
    where: { projectId: root.id, user: { deletedAt: null } },
    select: { userId: true },
  });

  const { id: _padreId, cedulaPath, facturaUtePath, ...heredados } = padre;

  const ampliacion = await prisma.$transaction(async (tx) => {
    const creado = await tx.project.create({
      data: {
        ...heredados,
        code,
        parentProjectId: root.id,
        capacityKwp: new Prisma.Decimal(input.capacityKwp),
        status: "ACTIVE",
        startDate: input.startDate,
        saleDate: input.saleDate,
        plannedEndDate: input.plannedEndDate,
        budgetUsd: input.budgetUsd != null ? new Prisma.Decimal(input.budgetUsd) : null,
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear:
          input.estimatedMwhYear != null ? new Prisma.Decimal(input.estimatedMwhYear) : null,
        co2TonsAvoided:
          input.estimatedMwhYear != null
            ? new Prisma.Decimal((input.estimatedMwhYear * 0.5).toFixed(2))
            : null,
        createdById: userId,
        ...(input.solarSystemData ? { solarSystems: { create: input.solarSystemData } } : {}),
      },
    });

    // Acceso al portal: los mismos clientes ven la ampliación como un segundo
    // proyecto. El portal ya soporta varios proyectos por cliente.
    if (clientesDelPadre.length > 0) {
      await tx.projectClient.createMany({
        data: clientesDelPadre.map((c) => ({
          projectId: creado.id,
          userId: c.userId,
          createdById: userId,
        })),
        skipDuplicates: true,
      });
    }

    return creado;
  });

  // Los documentos UTE se copian después de tener el id del hijo. Si el archivo
  // no está en disco queda en null y se vuelve a subir desde la ficha.
  const [nuevaCedula, nuevaFactura] = await Promise.all([
    copiarDocumentoUte(cedulaPath, ampliacion.id),
    copiarDocumentoUte(facturaUtePath, ampliacion.id),
  ]);
  if (nuevaCedula || nuevaFactura) {
    await prisma.project.update({
      where: { id: ampliacion.id },
      data: { cedulaPath: nuevaCedula, facturaUtePath: nuevaFactura },
    });
  }

  const uteProcess = await prisma.uteProcess.create({
    data: {
      projectId: ampliacion.id,
      currentStage: UteStage.CONSULTA,
      currentStatus: UteStatus.PENDIENTE,
      createdById: userId,
    },
  });

  return { ampliacion, uteProcess, clientesCopiados: clientesDelPadre.length };
}
