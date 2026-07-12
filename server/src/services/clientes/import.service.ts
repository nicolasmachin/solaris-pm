// Importación de clientes (Generadores) desde CSV. Crea Projects "livianos"
// (sin pipeline) a partir de la MISMA estructura que produce el export.
// Flujo en 2 pasos: preview (parsea + valida + marca duplicados, no persiste) y
// confirm (crea los Projects seleccionados).

import { parse } from "csv-parse/sync";
import { AuditAction, AuditEntityType, Prisma, ProjectStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { generateProjectCode } from "../project.service.js";

// Estructura esperada = headers del export (ver CSV_HEADERS en index.ts).
export const IMPORT_EXPECTED_HEADERS = [
  "Nombre",
  "Estado",
  "Recorrido",
  "Etapa",
  "Asesor",
  "Departamento",
  "Potencia kWp",
  "Fecha entrega",
  "Teléfono",
  "Mail",
];
// Columnas que el import USA (el resto se ignora / es derivado).
export const IMPORT_USABLE_HEADERS = [
  "Nombre",
  "Estado",
  "Asesor",
  "Departamento",
  "Potencia kWp",
  "Fecha entrega",
  "Teléfono",
  "Mail",
];
export const IMPORT_IGNORED_HEADERS = ["Recorrido", "Etapa"]; // derivados del pipeline

const ESTADO_LABEL_TO_STATUS: Record<string, ProjectStatus> = {
  Activo: ProjectStatus.ACTIVE,
  Finalizado: ProjectStatus.COMPLETED,
  Archivado: ProjectStatus.ARCHIVED,
  "En cotización": ProjectStatus.PROSPECT,
};

export type ImportRow = {
  nombre: string;
  mail: string | null;
  telefono: string | null;
  departamento: string | null;
  potenciaKwp: number | null;
  status: ProjectStatus;
  fechaEntrega: string | null; // YYYY-MM-DD
  asesorId: string | null;
  asesorNombre: string | null;
  warnings: string[];
  duplicado: boolean;
};

function normDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

function normNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function previewImport(csvText: string) {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch {
    return { error: "No se pudo parsear el CSV. Verificá el formato." as const };
  }

  const headersPresentes = records.length ? Object.keys(records[0]) : [];
  const headersFaltantes = IMPORT_USABLE_HEADERS.filter((h) => !headersPresentes.includes(h));

  const existing = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { clientName: true, clientEmail: true },
  });
  const existingKeys = new Set(
    existing.map((p) => `${(p.clientName ?? "").toLowerCase().trim()}|${(p.clientEmail ?? "").toLowerCase().trim()}`),
  );
  const asesores = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  const rows: ImportRow[] = records.map((r) => {
    const warnings: string[] = [];
    const get = (h: string) => (r[h] ?? "").trim();

    const nombre = get("Nombre");
    if (!nombre) warnings.push("Falta el nombre (fila no importable)");

    const mail = get("Mail") || null;
    const telefono = get("Teléfono") || null;
    const departamento = get("Departamento") || null;
    const potenciaKwp = normNumber(get("Potencia kWp"));
    if (get("Potencia kWp") && potenciaKwp === null) warnings.push("Potencia inválida → se deja en blanco");

    const estadoLabel = get("Estado");
    const status = ESTADO_LABEL_TO_STATUS[estadoLabel] ?? ProjectStatus.ACTIVE;

    const fechaEntrega = normDate(get("Fecha entrega"));
    if (get("Fecha entrega") && !fechaEntrega) warnings.push("Fecha de entrega ilegible → se deja en blanco");

    const asesorNombre = get("Asesor") || null;
    let asesorId: string | null = null;
    if (asesorNombre) {
      const match = asesores.find((a) => a.name.toLowerCase().trim() === asesorNombre.toLowerCase().trim());
      if (match) asesorId = match.id;
      else warnings.push(`Asesor "${asesorNombre}" no encontrado → sin asignar`);
    }

    const dupKey = `${nombre.toLowerCase().trim()}|${(mail ?? "").toLowerCase().trim()}`;
    const duplicado = nombre !== "" && existingKeys.has(dupKey);

    return { nombre, mail, telefono, departamento, potenciaKwp, status, fechaEntrega, asesorId, asesorNombre, warnings, duplicado };
  });

  return {
    headersEsperados: IMPORT_EXPECTED_HEADERS,
    headersUsables: IMPORT_USABLE_HEADERS,
    headersIgnorados: IMPORT_IGNORED_HEADERS,
    headersFaltantes,
    rows,
    resumen: {
      total: rows.length,
      importables: rows.filter((r) => r.nombre).length,
      duplicados: rows.filter((r) => r.duplicado).length,
      sinNombre: rows.filter((r) => !r.nombre).length,
    },
  };
}

export type ConfirmImportRow = {
  nombre: string;
  mail?: string | null;
  telefono?: string | null;
  departamento?: string | null;
  potenciaKwp?: number | null;
  status?: ProjectStatus;
  fechaEntrega?: string | null;
  asesorId?: string | null;
};

export async function confirmImport(rows: ConfirmImportRow[], userId: string) {
  const now = new Date();
  let creados = 0;
  const errores: string[] = [];

  for (const row of rows) {
    const nombre = (row.nombre ?? "").trim();
    if (!nombre) {
      errores.push("Fila sin nombre omitida");
      continue;
    }
    try {
      // Código secuencial: se genera de a uno (await serializa, sin colisiones).
      const code = await generateProjectCode();
      const project = await prisma.project.create({
        data: {
          code,
          clientName: nombre,
          capacityKwp: new Prisma.Decimal(row.potenciaKwp ?? 0),
          locationCity: row.departamento || "Sin especificar",
          locationProvince: row.departamento || "Sin especificar",
          status: row.status ?? ProjectStatus.ACTIVE,
          startDate: now,
          saleDate: now,
          executedUsd: new Prisma.Decimal(0),
          plannedEndDate: row.fechaEntrega ? new Date(`${row.fechaEntrega}T00:00:00.000Z`) : null,
          clientEmail: row.mail || null,
          clientPhone: row.telefono || null,
          salespersonId: row.asesorId || null,
          createdById: userId,
          importedFromCsv: true, // liviano: no aparece en la lista de Proyectos
        },
        select: { id: true, code: true },
      });
      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.created,
        description: `Importó el cliente "${nombre}" desde CSV (proyecto ${project.code}, sin pipeline)`,
        metadata: { source: "import_csv" },
      });
      creados++;
    } catch (err) {
      console.error("[import] fallo creando cliente:", err);
      errores.push(`No se pudo crear "${nombre}"`);
    }
  }

  return { creados, errores };
}
