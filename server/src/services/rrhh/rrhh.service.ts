// Módulo Recursos Humanos: un legajo por persona.
//
// Dos miradas sobre los mismos datos:
//   - "Mi legajo" (RRHH:VIEW): la persona ve y carga lo suyo. Sus datos
//     personales los edita ella; los documentos que sube quedan PENDIENTES
//     hasta que RRHH los valida. No ve sueldo, notas internas ni lo marcado
//     `soloInterno`.
//   - Gestión (RRHH:EDIT): gerencia y finanzas ven todos los legajos completos,
//     suben recibos y contratos, validan lo cargado y siguen los vencimientos.
//
// Datos sensibles (salud, sueldo, cuenta bancaria). Por eso: las descargas van
// con token atado al archivo y de vida corta, y cada vez que alguien abre un
// archivo de otra persona queda en la auditoría (`file_downloaded`).

import type { MultipartFile } from "@fastify/multipart";
import {
  Action,
  AuditAction,
  AuditEntityType,
  LegajoDocumentoEstado,
  LegajoDocumentoTipo,
  Module,
  NotificationType,
  Prisma,
  VinculoLaboral,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { hasPermission } from "../../middleware/authorize.middleware.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { firmarTokenDescarga } from "../../utils/token-descarga.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { createAuditEntry } from "../audit.service.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../file-storage.service.js";
import { createNotification } from "../notification.service.js";

export type RrhhUser = { id: string; role: string; name?: string };

export const TOKEN_DESCARGA = "legajo-documento";
const ROL_TERCERIZADO = "INSTALADOR_TERCERIZADO";
const ROL_CLIENTE = "CLIENT";
export const DIAS_AVISO_VENCIMIENTO = 30;

export const TIPO_LABEL: Record<LegajoDocumentoTipo, string> = {
  RECIBO_SUELDO: "Recibo de sueldo",
  CONTRATO: "Contrato",
  CARNE_SALUD: "Carné de salud",
  LICENCIA_CONDUCIR: "Licencia de conducir",
  CEDULA: "Cédula de identidad",
  CURSO_ALTURA: "Curso de trabajo en altura",
  PRIMEROS_AUXILIOS: "Curso de primeros auxilios",
  HABILITACION_ELECTRICA: "Habilitación eléctrica",
  ANTECEDENTES: "Certificado de antecedentes",
  CONSTANCIA_DOMICILIO: "Constancia de domicilio",
  BPS: "Constancia de BPS al día",
  BSE: "Constancia de BSE al día",
  ENTREGA_EPP: "Entrega de equipos de protección",
  AMONESTACION: "Amonestación",
  OTRO: "Otro",
};

/** Lo que la persona puede subir ella misma. Recibos, contratos y lo disciplinario los sube RRHH. */
export const TIPOS_AUTOCARGA: LegajoDocumentoTipo[] = [
  "CARNE_SALUD",
  "LICENCIA_CONDUCIR",
  "CEDULA",
  "CURSO_ALTURA",
  "PRIMEROS_AUXILIOS",
  "HABILITACION_ELECTRICA",
  "ANTECEDENTES",
  "CONSTANCIA_DOMICILIO",
  "BPS",
  "BSE",
  "OTRO",
];

/**
 * Lo que tiene que estar en el legajo de cada vínculo. A un tercerizado se le
 * pide lo necesario antes de subir a un techo; no tiene recibos ni contrato
 * de trabajo.
 */
export const REQUERIDOS: Record<VinculoLaboral, LegajoDocumentoTipo[]> = {
  DEPENDIENTE: ["CEDULA", "CARNE_SALUD"],
  TERCERIZADO: ["CEDULA", "CARNE_SALUD", "BPS", "BSE", "CURSO_ALTURA"],
};

// Campos que carga la persona.
const CAMPOS_PERSONALES = [
  "cedula",
  "fechaNacimiento",
  "direccion",
  "telefonoPersonal",
  "emailPersonal",
  "emergenciaNombre",
  "emergenciaTelefono",
  "emergenciaVinculo",
  "mutualista",
  "emergenciaMovil",
  "grupoSanguineo",
  "alergias",
  "banco",
  "cuentaBancaria",
  "talleRopa",
  "talleCalzado",
  "licenciaConducirCategoria",
] as const;

// Campos de la empresa: solo RRHH:EDIT.
const CAMPOS_EMPRESA = [
  "vinculo",
  "fechaIngreso",
  "fechaEgreso",
  "cargo",
  "tipoContrato",
  "categoria",
  "sueldoNominal",
  "sueldoMoneda",
  "notasInternas",
] as const;

// De los de la empresa, lo que la persona ve de sí misma (solo lectura).
const CAMPOS_EMPRESA_VISIBLES = ["vinculo", "fechaIngreso", "cargo", "tipoContrato"] as const;

const CAMPOS_FECHA = new Set(["fechaNacimiento", "fechaIngreso", "fechaEgreso"]);

export type DatosPersonales = Partial<Record<(typeof CAMPOS_PERSONALES)[number], string | null>>;
export type DatosEmpresa = Partial<{
  vinculo: VinculoLaboral;
  fechaIngreso: string | null;
  fechaEgreso: string | null;
  cargo: string | null;
  tipoContrato: string | null;
  categoria: string | null;
  sueldoNominal: number | null;
  sueldoMoneda: "UYU" | "USD";
  notasInternas: string | null;
}>;

export async function esGestor(user: RrhhUser) {
  return hasPermission(user.role, Module.RRHH, Action.EDIT);
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

function isoDia(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function aFechaDb(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest("FECHA_INVALIDA", "Fecha inválida (AAAA-MM-DD)");
  return new Date(`${v}T00:00:00.000Z`);
}

function limpiarTexto(v: string | null | undefined) {
  if (v === undefined) return undefined;
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Días que faltan para una fecha (negativo = ya venció), contados en días de Uruguay. */
export function diasHasta(vencimiento: Date, hoyIso: string = hoyUruguay().iso) {
  const hoy = Date.parse(`${hoyIso}T00:00:00.000Z`);
  return Math.round((vencimiento.getTime() - hoy) / 86_400_000);
}

export function estadoVencimiento(vencimiento: Date | null, hoyIso?: string) {
  if (!vencimiento) return null;
  const dias = diasHasta(vencimiento, hoyIso);
  if (dias < 0) return "VENCIDO" as const;
  if (dias <= DIAS_AVISO_VENCIMIENTO) return "POR_VENCER" as const;
  return "VIGENTE" as const;
}

export async function usuariosGestores() {
  const permisos = await prisma.permission.findMany({
    where: { module: Module.RRHH, action: Action.EDIT },
    select: { roleId: true },
  });
  return prisma.user.findMany({
    where: { deletedAt: null, roleId: { in: permisos.map((p) => p.roleId) } },
    select: { id: true },
  });
}

/** El legajo de una persona; se crea vacío la primera vez que se lo busca. */
export async function asegurarLegajo(userId: string) {
  const existente = await prisma.legajo.findUnique({ where: { userId } });
  if (existente) return existente;
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { role: { select: { name: true } } },
  });
  if (!user || user.role.name === ROL_CLIENTE) throw notFound("LEGAJO_NOT_FOUND", "Esa persona no tiene legajo");
  return prisma.legajo.upsert({
    where: { userId },
    create: {
      userId,
      vinculo: user.role.name === ROL_TERCERIZADO ? VinculoLaboral.TERCERIZADO : VinculoLaboral.DEPENDIENTE,
    },
    update: {},
  });
}

type LegajoRow = Prisma.LegajoGetPayload<object>;

function serializarLegajo(l: LegajoRow, completo: boolean) {
  const out: Record<string, unknown> = { id: l.id, userId: l.userId };
  for (const c of CAMPOS_PERSONALES) {
    const v = l[c];
    out[c] = v instanceof Date ? isoDia(v) : v;
  }
  const empresa = completo ? CAMPOS_EMPRESA : CAMPOS_EMPRESA_VISIBLES;
  for (const c of empresa) {
    const v = l[c];
    out[c] = v instanceof Date ? isoDia(v) : v instanceof Prisma.Decimal ? Number(v) : v;
  }
  return out;
}

// ─── Documentos ─────────────────────────────────────────────────────────────

const documentoSelect = {
  id: true,
  legajoId: true,
  tipo: true,
  titulo: true,
  periodo: true,
  vencimiento: true,
  estado: true,
  motivoRechazo: true,
  soloInterno: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  vistoAt: true,
  createdAt: true,
  validadoAt: true,
  subidoPor: { select: { id: true, name: true } },
  validadoPor: { select: { name: true } },
} satisfies Prisma.LegajoDocumentoSelect;

type DocumentoRow = Prisma.LegajoDocumentoGetPayload<{ select: typeof documentoSelect }>;

function serializarDocumento(d: DocumentoRow, user: RrhhUser) {
  // Corto: son datos sensibles y el enlace se usa en el momento.
  const t = firmarTokenDescarga(user, TOKEN_DESCARGA, d.id, "15m");
  return {
    id: d.id,
    tipo: d.tipo,
    tipoLabel: TIPO_LABEL[d.tipo],
    titulo: d.titulo,
    periodo: d.periodo,
    vencimiento: isoDia(d.vencimiento),
    estadoVencimiento: estadoVencimiento(d.vencimiento),
    estado: d.estado,
    motivoRechazo: d.motivoRechazo,
    soloInterno: d.soloInterno,
    filename: d.filename,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    vistoAt: d.vistoAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    validadoAt: d.validadoAt?.toISOString() ?? null,
    subidoPor: d.subidoPor.name,
    subidoPorUserId: d.subidoPor.id,
    validadoPor: d.validadoPor?.name ?? null,
    downloadUrl: `/api/rrhh/documentos/${d.id}/download?t=${encodeURIComponent(t)}`,
    previewUrl: `/api/rrhh/documentos/${d.id}/preview?t=${encodeURIComponent(t)}`,
  };
}

/**
 * Lo que falta y lo que vence, sobre los documentos de un legajo. De cada tipo
 * cuenta el más nuevo: un carné viejo vencido que ya se reemplazó no alarma.
 */
function resumenVencimientos(vinculo: VinculoLaboral, docs: Array<Pick<DocumentoRow, "tipo" | "vencimiento" | "estado" | "createdAt">>) {
  const ultimoPorTipo = new Map<LegajoDocumentoTipo, (typeof docs)[number]>();
  for (const d of docs) {
    if (d.estado === LegajoDocumentoEstado.RECHAZADO) continue;
    const prev = ultimoPorTipo.get(d.tipo);
    if (!prev || d.createdAt > prev.createdAt) ultimoPorTipo.set(d.tipo, d);
  }
  const faltantes = REQUERIDOS[vinculo].filter((t) => !ultimoPorTipo.has(t));
  const vencidos: LegajoDocumentoTipo[] = [];
  const porVencer: LegajoDocumentoTipo[] = [];
  for (const [tipo, d] of ultimoPorTipo) {
    const e = estadoVencimiento(d.vencimiento);
    if (e === "VENCIDO") vencidos.push(tipo);
    if (e === "POR_VENCER") porVencer.push(tipo);
  }
  return { faltantes, vencidos, porVencer };
}

async function documentosDeLegajo(legajoId: string, incluirInternos: boolean) {
  return prisma.legajoDocumento.findMany({
    where: { legajoId, deletedAt: null, ...(incluirInternos ? {} : { soloInterno: false }) },
    orderBy: [{ createdAt: "desc" }],
    select: documentoSelect,
  });
}

// ─── Mi legajo ──────────────────────────────────────────────────────────────

export async function miLegajo(user: RrhhUser) {
  const legajo = await asegurarLegajo(user.id);
  const docs = await documentosDeLegajo(legajo.id, false);
  return {
    legajo: serializarLegajo(legajo, false),
    documentos: docs.map((d) => serializarDocumento(d, user)),
    resumen: resumenVencimientos(legajo.vinculo, docs),
    tiposAutocarga: TIPOS_AUTOCARGA.map((t) => ({ tipo: t, label: TIPO_LABEL[t] })),
    requeridos: REQUERIDOS[legajo.vinculo],
  };
}

function datosPersonalesParaDb(datos: DatosPersonales) {
  const data: Prisma.LegajoUpdateInput = {};
  for (const c of CAMPOS_PERSONALES) {
    if (!(c in datos)) continue;
    const v = datos[c];
    (data as Record<string, unknown>)[c] = CAMPOS_FECHA.has(c) ? aFechaDb(v) : limpiarTexto(v);
  }
  return data;
}

export async function actualizarMisDatos(user: RrhhUser, datos: DatosPersonales) {
  const legajo = await asegurarLegajo(user.id);
  const data = datosPersonalesParaDb(datos);
  const actualizado = await prisma.legajo.update({ where: { id: legajo.id }, data });
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: legajo.id,
    userId: user.id,
    action: AuditAction.updated,
    description: `Actualizó sus datos personales (${Object.keys(data).join(", ")})`,
  });
  return serializarLegajo(actualizado, false);
}

type DatosDocumento = {
  tipo: LegajoDocumentoTipo;
  titulo?: string | null;
  periodo?: string | null;
  vencimiento?: string | null;
  soloInterno?: boolean;
};

async function guardarDocumento(
  legajoId: string,
  file: MultipartFile,
  datos: DatosDocumento,
  estado: LegajoDocumentoEstado,
  subidoPorId: string,
) {
  if (datos.periodo && !/^\d{4}-\d{2}$/.test(datos.periodo)) {
    throw badRequest("PERIODO_INVALIDO", "El período va como AAAA-MM");
  }
  const saved = await saveUploadedFile(file, `rrhh/${legajoId}`);
  const titulo =
    limpiarTexto(datos.titulo) ??
    (datos.tipo === "RECIBO_SUELDO" && datos.periodo ? `Recibo ${datos.periodo}` : TIPO_LABEL[datos.tipo]);
  return prisma.legajoDocumento.create({
    data: {
      legajoId,
      tipo: datos.tipo,
      titulo,
      periodo: datos.periodo ?? null,
      vencimiento: aFechaDb(datos.vencimiento) ?? null,
      estado,
      soloInterno: datos.soloInterno ?? false,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      subidoPorId,
      ...(estado === LegajoDocumentoEstado.VALIDADO ? { validadoPorId: subidoPorId, validadoAt: new Date() } : {}),
    },
    select: documentoSelect,
  });
}

/** La persona sube un documento suyo: queda pendiente y se avisa a RRHH. */
export async function subirMiDocumento(user: RrhhUser, file: MultipartFile, datos: DatosDocumento) {
  if (!TIPOS_AUTOCARGA.includes(datos.tipo)) {
    throw badRequest("TIPO_NO_PERMITIDO", "Ese tipo de documento lo carga administración");
  }
  const legajo = await asegurarLegajo(user.id);
  const doc = await guardarDocumento(legajo.id, file, { ...datos, soloInterno: false }, LegajoDocumentoEstado.PENDIENTE, user.id);
  const autor = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  for (const g of await usuariosGestores()) {
    if (g.id === user.id) continue;
    await createNotification({
      userId: g.id,
      type: NotificationType.legajo_documento,
      title: `${autor?.name ?? "Alguien"} cargó: ${TIPO_LABEL[doc.tipo]}`,
      message: "Está pendiente de validar en Recursos Humanos.",
      link: `/rrhh/legajos/${user.id}`,
    }).catch(() => undefined);
  }
  return serializarDocumento(doc, user);
}

/** La persona puede borrar lo que subió mientras RRHH no lo validó. */
export async function borrarMiDocumento(user: RrhhUser, documentoId: string) {
  const legajo = await asegurarLegajo(user.id);
  const doc = await prisma.legajoDocumento.findFirst({
    where: { id: documentoId, legajoId: legajo.id, deletedAt: null },
    select: { id: true, estado: true, subidoPorId: true, url: true, titulo: true },
  });
  if (!doc) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  if (doc.subidoPorId !== user.id || doc.estado === LegajoDocumentoEstado.VALIDADO) {
    throw forbidden("Un documento ya validado solo lo puede quitar administración");
  }
  await prisma.legajoDocumento.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
  await deleteStoredFile(doc.url);
  return doc;
}

/**
 * Descarga. La puede hacer la persona dueña (si no es `soloInterno`) o quien
 * tiene RRHH:EDIT. Si la abre alguien que no es la dueña, queda auditado.
 */
export async function documentoParaDescarga(documentoId: string, user: RrhhUser) {
  const doc = await prisma.legajoDocumento.findFirst({
    where: { id: documentoId, deletedAt: null },
    select: {
      id: true,
      tipo: true,
      filename: true,
      mimeType: true,
      url: true,
      soloInterno: true,
      vistoAt: true,
      legajo: { select: { id: true, userId: true, user: { select: { name: true } } } },
    },
  });
  if (!doc) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  const esDueno = doc.legajo.userId === user.id;
  if (!(esDueno && !doc.soloInterno) && !(await esGestor(user))) {
    throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  }
  if (esDueno && !doc.vistoAt) {
    await prisma.legajoDocumento.update({ where: { id: doc.id }, data: { vistoAt: new Date() } });
  }
  if (!esDueno) {
    await createAuditEntry({
      entityType: AuditEntityType.legajo,
      entityId: doc.legajo.id,
      userId: user.id,
      action: AuditAction.file_downloaded,
      description: `Abrió «${TIPO_LABEL[doc.tipo]}» del legajo de ${doc.legajo.user.name}`,
      metadata: { documentoId: doc.id },
    });
  }
  return { filename: doc.filename, mimeType: doc.mimeType, absolutePath: getStoredFilePath(doc.url) };
}

// ─── Gestión ────────────────────────────────────────────────────────────────

/** Todas las personas internas, con o sin legajo cargado, y lo que tienen pendiente. */
export async function listarLegajos() {
  const usuarios = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: { not: ROL_CLIENTE } } },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      role: { select: { name: true, label: true } },
      legajo: {
        select: {
          id: true,
          vinculo: true,
          cargo: true,
          fechaIngreso: true,
          fechaEgreso: true,
          documentos: {
            where: { deletedAt: null },
            select: { tipo: true, vencimiento: true, estado: true, createdAt: true, periodo: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return usuarios.map((u) => {
    const vinculo = u.legajo?.vinculo ?? (u.role.name === ROL_TERCERIZADO ? VinculoLaboral.TERCERIZADO : VinculoLaboral.DEPENDIENTE);
    const docs = u.legajo?.documentos ?? [];
    const recibos = docs.filter((d) => d.tipo === "RECIBO_SUELDO" && d.periodo).map((d) => d.periodo!).sort();
    return {
      userId: u.id,
      nombre: u.name,
      email: u.email,
      rol: u.role.label,
      vinculo,
      cargo: u.legajo?.cargo ?? u.jobTitle ?? null,
      fechaIngreso: isoDia(u.legajo?.fechaIngreso),
      fechaEgreso: isoDia(u.legajo?.fechaEgreso),
      pendientesValidar: docs.filter((d) => d.estado === LegajoDocumentoEstado.PENDIENTE).length,
      ultimoRecibo: recibos.at(-1) ?? null,
      ...resumenVencimientos(vinculo, docs),
    };
  });
}

export async function legajoDe(userId: string, gestor: RrhhUser) {
  const legajo = await asegurarLegajo(userId);
  const [usuario, docs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: { select: { label: true } } },
    }),
    documentosDeLegajo(legajo.id, true),
  ]);
  return {
    usuario: { id: usuario!.id, nombre: usuario!.name, email: usuario!.email, telefono: usuario!.phone, rol: usuario!.role.label },
    legajo: serializarLegajo(legajo, true),
    documentos: docs.map((d) => serializarDocumento(d, gestor)),
    resumen: resumenVencimientos(legajo.vinculo, docs),
    requeridos: REQUERIDOS[legajo.vinculo],
  };
}

export async function actualizarLegajo(userId: string, datos: DatosPersonales & DatosEmpresa, gestor: RrhhUser) {
  const legajo = await asegurarLegajo(userId);
  const data: Prisma.LegajoUpdateInput = datosPersonalesParaDb(datos);
  if (datos.vinculo !== undefined) data.vinculo = datos.vinculo;
  if (datos.fechaIngreso !== undefined) data.fechaIngreso = aFechaDb(datos.fechaIngreso);
  if (datos.fechaEgreso !== undefined) data.fechaEgreso = aFechaDb(datos.fechaEgreso);
  for (const c of ["cargo", "tipoContrato", "categoria", "notasInternas"] as const) {
    if (datos[c] !== undefined) data[c] = limpiarTexto(datos[c]);
  }
  if (datos.sueldoNominal !== undefined) data.sueldoNominal = datos.sueldoNominal;
  if (datos.sueldoMoneda !== undefined) data.sueldoMoneda = datos.sueldoMoneda;
  const actualizado = await prisma.legajo.update({ where: { id: legajo.id }, data });
  // Solo los nombres de los campos: el sueldo no se copia a la auditoría.
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: legajo.id,
    userId: gestor.id,
    action: AuditAction.updated,
    description: `Editó el legajo (${Object.keys(data).join(", ")})`,
  });
  return serializarLegajo(actualizado, true);
}

/** RRHH sube un documento al legajo de alguien: entra validado y, si la persona lo ve, se le avisa. */
export async function subirDocumento(userId: string, file: MultipartFile, datos: DatosDocumento, gestor: RrhhUser) {
  const legajo = await asegurarLegajo(userId);
  const doc = await guardarDocumento(legajo.id, file, datos, LegajoDocumentoEstado.VALIDADO, gestor.id);
  if (!doc.soloInterno && userId !== gestor.id) {
    await createNotification({
      userId,
      type: NotificationType.legajo_documento,
      title: doc.tipo === "RECIBO_SUELDO" ? `Tu recibo de sueldo ${doc.periodo ?? ""}`.trim() : `Nuevo en tu legajo: ${doc.titulo}`,
      message: "Está disponible en Mi legajo.",
      link: "/mi-legajo",
    }).catch(() => undefined);
  }
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: legajo.id,
    userId: gestor.id,
    action: AuditAction.file_uploaded,
    description: `Subió «${doc.titulo}» al legajo`,
  });
  return serializarDocumento(doc, gestor);
}

async function findDocumentoOrThrow(id: string) {
  const doc = await prisma.legajoDocumento.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, titulo: true, tipo: true, url: true, legajoId: true, legajo: { select: { userId: true } } },
  });
  if (!doc) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  return doc;
}

export async function actualizarDocumento(
  id: string,
  datos: { titulo?: string; vencimiento?: string | null; periodo?: string | null; soloInterno?: boolean },
  gestor: RrhhUser,
) {
  await findDocumentoOrThrow(id);
  if (datos.periodo && !/^\d{4}-\d{2}$/.test(datos.periodo)) {
    throw badRequest("PERIODO_INVALIDO", "El período va como AAAA-MM");
  }
  const doc = await prisma.legajoDocumento.update({
    where: { id },
    data: {
      titulo: limpiarTexto(datos.titulo) ?? undefined,
      vencimiento: aFechaDb(datos.vencimiento),
      periodo: datos.periodo === undefined ? undefined : datos.periodo || null,
      soloInterno: datos.soloInterno,
    },
    select: documentoSelect,
  });
  return serializarDocumento(doc, gestor);
}

/** Validar o rechazar lo que cargó la persona. Al validar se puede corregir el vencimiento. */
export async function revisarDocumento(
  id: string,
  decision: { aprobar: boolean; motivo?: string | null; vencimiento?: string | null },
  gestor: RrhhUser,
) {
  const actual = await findDocumentoOrThrow(id);
  if (!decision.aprobar && !limpiarTexto(decision.motivo)) {
    throw badRequest("MOTIVO_REQUERIDO", "Decí por qué se rechaza, así la persona sabe qué volver a subir");
  }
  const doc = await prisma.legajoDocumento.update({
    where: { id },
    data: {
      estado: decision.aprobar ? LegajoDocumentoEstado.VALIDADO : LegajoDocumentoEstado.RECHAZADO,
      motivoRechazo: decision.aprobar ? null : limpiarTexto(decision.motivo),
      validadoPorId: gestor.id,
      validadoAt: new Date(),
      ...(decision.vencimiento !== undefined ? { vencimiento: aFechaDb(decision.vencimiento) } : {}),
    },
    select: documentoSelect,
  });
  await createNotification({
    userId: actual.legajo.userId,
    type: NotificationType.legajo_documento,
    title: decision.aprobar ? `Validado: ${doc.titulo}` : `Hay que volver a subir: ${doc.titulo}`,
    message: decision.aprobar ? "Administración revisó el documento y quedó validado." : `Motivo: ${doc.motivoRechazo}`,
    link: "/mi-legajo",
  }).catch(() => undefined);
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: actual.legajoId,
    userId: gestor.id,
    action: AuditAction.status_changed,
    description: `${decision.aprobar ? "Validó" : "Rechazó"} «${doc.titulo}»`,
  });
  return serializarDocumento(doc, gestor);
}

export async function borrarDocumento(id: string, gestor: RrhhUser) {
  const doc = await findDocumentoOrThrow(id);
  await prisma.legajoDocumento.update({ where: { id }, data: { deletedAt: new Date() } });
  await deleteStoredFile(doc.url);
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: doc.legajoId,
    userId: gestor.id,
    action: AuditAction.deleted,
    description: `Quitó «${doc.titulo}» del legajo`,
  });
  return doc;
}

/**
 * Tablero de vencimientos: lo vencido, lo que vence en 30 días y lo que falta,
 * de toda la gente activa. Lo usa la pantalla de gestión y el job diario.
 */
export async function tableroVencimientos() {
  const legajos = await listarLegajos();
  return legajos
    .filter((l) => !l.fechaEgreso && (l.vencidos.length || l.porVencer.length || l.faltantes.length))
    .map((l) => ({
      userId: l.userId,
      nombre: l.nombre,
      vinculo: l.vinculo,
      vencidos: l.vencidos.map((t) => TIPO_LABEL[t]),
      porVencer: l.porVencer.map((t) => TIPO_LABEL[t]),
      faltantes: l.faltantes.map((t) => TIPO_LABEL[t]),
    }));
}

export const TIPOS = Object.values(LegajoDocumentoTipo).map((t) => ({ tipo: t, label: TIPO_LABEL[t] }));
