// Plan de Protección contra Granizo (servicio de reposición de Voltia; NO es un
// seguro, ver services/seguro-granizo/polizas.service.ts). Prefijo /api.
//
// Permisos: módulo EXPERIENCIA_CLIENTES (la sección vive en Experiencia Solar).
// El único endpoint compartido con Finanzas es marcar cobrada / prevista una
// anualidad: el que maneja la plata también puede registrarlo.
//
// Lógica en services/seguro-granizo/.

import fs from "node:fs";

import { Action, Module, SiniestroGranizoEstado } from "@prisma/client";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny } from "../middleware/authorize.middleware.js";
import { deriveObraThumbUrl, getStoredFilePath } from "../services/file-storage.service.js";
import { esHeic } from "../services/heic.service.js";
import {
  agregarAmpliacion,
  ampliacionesPendientes,
  borrarFotoInicio,
  listarFotosInicio,
  marcarCobroAmpliacion,
  subirFotoInicio,
  activarPoliza,
  cancelarPoliza,
  crearPoliza,
  editarPoliza,
  getPoliza,
  getPolizaDeProyecto,
  listarPolizas,
  marcarCobro,
  quitarAnexo,
  reactivarPoliza,
  registrarAnexo,
  regenerarCobro,
  renovarPoliza,
  type PolizaDTO,
} from "../services/seguro-granizo/polizas.service.js";
import {
  actualizarSiniestro,
  borrarFoto,
  borrarSiniestro,
  crearSiniestro,
  getArchivoPlan,
  listarFotos,
  subirFoto,
} from "../services/seguro-granizo/siniestros.service.js";
import { parseDateOnly } from "../utils/dates.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { MOTIVOS_RECHAZO, MOTIVOS_RECHAZO_CODIGOS } from "../services/seguro-granizo/plazos.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const fechaStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
const idParams = z.object({ id: z.string().min(1) }).strict();

const guard = (action: Action) => [authenticate, authorize(Module.EXPERIENCIA_CLIENTES, action)];

// Agrega las fotos de cada daño y las fotos de inicio del plan.
async function conFotos(p: PolizaDTO) {
  const [fotos, fotosInicio] = await Promise.all([listarFotos(p.siniestros.map((s) => s.id)), listarFotosInicio(p.id)]);
  return { ...p, fotosInicio, siniestros: p.siniestros.map((s) => ({ ...s, fotos: fotos.get(s.id) ?? [] })) };
}

async function leerFotos(request: FastifyRequest, guardar: (part: MultipartFile) => Promise<unknown>) {
  const creadas = [];
  for await (const part of request.parts()) {
    if (part.type !== "file") continue;
    // Algunos navegadores mandan el HEIC del iPhone como octet-stream: por eso
    // además del mimetype se mira esHeic() (nombre + mime).
    const base = (part.mimetype || "").split(";")[0]!.trim().toLowerCase();
    if (!IMAGE_MIMES.has(base) && !esHeic({ filename: part.filename, mimetype: part.mimetype })) {
      throw badRequest("INVALID_PHOTO_TYPE", "Sólo se aceptan fotos (JPG, PNG, WEBP o HEIC)");
    }
    creadas.push(await guardar(part));
  }
  if (creadas.length === 0) throw badRequest("PHOTO_REQUIRED", "Adjuntá al menos una foto");
  return creadas;
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function registerSeguroGranizoRoutes(app: FastifyInstance) {
  // ── Lectura ────────────────────────────────────────────────────────────────

  app.get("/seguro-granizo/polizas", { preHandler: guard(Action.VIEW) }, async (request) => {
    const q = z
      .object({
        estado: z
          .enum([
            "PENDIENTE_INICIO",
            "PENDIENTE_ACTIVACION",
            "EN_CARENCIA",
            "VIGENTE",
            "POR_VENCER",
            "EN_GRACIA",
            "SUSPENDIDA",
            "VENCIDA",
            "CANCELADA",
            "ALERTA",
          ])
          .optional(),
        q: z.string().max(100).optional(),
      })
      .parse(request.query);
    return listarPolizas(q);
  });

  app.get("/seguro-granizo/polizas/:id", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { id } = idParams.parse(request.params);
    return { poliza: await conFotos(await getPoliza(id)) };
  });

  app.get("/seguro-granizo/proyecto/:projectId", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
    const r = await getPolizaDeProyecto(projectId);
    return { ...r, poliza: r.poliza ? await conFotos(r.poliza) : null };
  });

  // Causales de "no se repone" (sección 4 de las condiciones), para el selector.
  app.get("/seguro-granizo/motivos-rechazo", { preHandler: guard(Action.VIEW) }, async () => ({
    motivos: MOTIVOS_RECHAZO_CODIGOS.map((codigo) => ({ codigo, label: MOTIVOS_RECHAZO[codigo] })),
  }));

  // Sirve fotos de daños (miniatura con ?thumb=1) y Anexos A firmados. Endpoint
  // propio: la descarga genérica de archivos pide OPERACIONES y Experiencia
  // Solar no lo tiene.
  app.get("/seguro-granizo/archivos/:id", { preHandler: guard(Action.VIEW) }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { thumb } = z.object({ thumb: z.string().optional() }).parse(request.query);
    const f = await getArchivoPlan(id);
    if (thumb) {
      const thumbPath = getStoredFilePath(deriveObraThumbUrl(f.url));
      if (fs.existsSync(thumbPath)) {
        reply.header("Content-Type", "image/jpeg");
        return reply.send(fs.createReadStream(thumbPath));
      }
    }
    const path = getStoredFilePath(f.url);
    if (!fs.existsSync(path)) throw notFound("FILE_NOT_FOUND", "El archivo no existe en storage");
    reply.header("Content-Type", f.mimeType);
    reply.header("Content-Disposition", "inline");
    return reply.send(fs.createReadStream(path));
  });

  // ── Pólizas ────────────────────────────────────────────────────────────────

  app.post("/seguro-granizo/polizas", { preHandler: guard(Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .object({
        projectId: z.string().min(1),
        cantidadPaneles: z.number().int().min(1).max(5000).nullable().optional(),
        precioPorPanelUsd: z.number().positive().max(1000).nullable().optional(),
        // Adhesión al contratar la obra (sin carencia). Si no, cliente existente:
        // cubre desde el pago + 30 días.
        sinCarencia: z.boolean().optional(),
        // Sólo con sinCarencia. Omitido: la puesta en marcha si existe; null: pendiente.
        fechaInicio: fechaStr.nullable().optional(),
        notas: z.string().max(2000).nullable().optional(),
        inversorSerie: z.string().max(100).nullable().optional(),
        primerCobroPagadoEl: fechaStr.nullable().optional(),
      })
      .strict()
      .parse(request.body);
    const poliza = await crearPoliza({
      primerCobroPagadoEl: body.primerCobroPagadoEl ? parseDateOnly(body.primerCobroPagadoEl) : null,
      projectId: body.projectId,
      sinCarencia: body.sinCarencia,
      cantidadPaneles: body.cantidadPaneles ?? null,
      precioPorPanelUsd: body.precioPorPanelUsd ?? null,
      fechaInicio: body.fechaInicio === undefined ? undefined : body.fechaInicio ? parseDateOnly(body.fechaInicio) : null,
      notas: body.notas ?? null,
      inversorSerie: body.inversorSerie ?? null,
      userId: user.id,
    });
    reply.code(201);
    return { poliza: await conFotos(poliza) };
  });

  app.patch("/seguro-granizo/polizas/:id", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        cantidadPaneles: z.number().int().min(1).max(5000).optional(),
        precioPorPanelUsd: z.number().positive().max(1000).optional(),
        notas: z.string().max(2000).nullable().optional(),
        sinCarencia: z.boolean().optional(),
        inversorSerie: z.string().max(100).nullable().optional(),
        aplicarAPendientes: z.boolean().optional(),
      })
      .strict()
      .parse(request.body);
    return { poliza: await conFotos(await editarPoliza(id, body, user.id)) };
  });

  app.post("/seguro-granizo/polizas/:id/activar", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z.object({ fechaInicio: fechaStr }).strict().parse(request.body);
    return { poliza: await conFotos(await activarPoliza(id, parseDateOnly(body.fechaInicio), user.id)) };
  });

  app.post("/seguro-granizo/polizas/:id/renovar", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    return { poliza: await conFotos(await renovarPoliza(id, user.id)) };
  });

  app.post("/seguro-granizo/polizas/:id/cancelar", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({ motivo: z.string().trim().min(3).max(500), anularCobrosPendientes: z.boolean().default(true) })
      .strict()
      .parse(request.body);
    return { poliza: await conFotos(await cancelarPoliza(id, body, user.id)) };
  });

  app.post("/seguro-granizo/polizas/:id/reactivar", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    return { poliza: await conFotos(await reactivarPoliza(id, user.id)) };
  });

  // Anexo A firmado (multipart: campo `fechaFirma` YYYY-MM-DD + el archivo).
  // Sin esto el plan no cubre.
  app.post("/seguro-granizo/polizas/:id/anexo", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const file = await request.file();
    if (!file) throw badRequest("FILE_REQUIRED", "Adjuntá el Anexo A firmado (PDF o foto)");
    const raw = (file.fields.fechaFirma as { value?: unknown } | undefined)?.value;
    const fechaFirma = fechaStr.safeParse(raw);
    if (!fechaFirma.success) throw badRequest("FECHA_REQUERIDA", "Indicá la fecha de firma");
    return { poliza: await conFotos(await registrarAnexo(id, parseDateOnly(fechaFirma.data), file, user.id)) };
  });

  app.delete("/seguro-granizo/polizas/:id/anexo", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    return { poliza: await conFotos(await quitarAnexo(id, user.id)) };
  });

  // ── Fotos de inicio (instalaciones existentes) ─────────────────────────────

  app.post("/seguro-granizo/polizas/:id/fotos-inicio", { preHandler: guard(Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    await leerFotos(request, (part) => subirFotoInicio(id, part, user.id));
    reply.code(201);
    return { poliza: await conFotos(await getPoliza(id)) };
  });

  app.delete("/seguro-granizo/polizas/:id/fotos-inicio/:fileId", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id, fileId } = z.object({ id: z.string().min(1), fileId: z.string().min(1) }).parse(request.params);
    await borrarFotoInicio(id, fileId, user.id);
    return { poliza: await conFotos(await getPoliza(id)) };
  });

  // ── Ampliaciones hechas por Voltia ───────────────────────────────────────

  app.get("/seguro-granizo/polizas/:id/ampliaciones-pendientes", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { id } = idParams.parse(request.params);
    return { ampliaciones: await ampliacionesPendientes(id) };
  });

  app.post("/seguro-granizo/polizas/:id/ampliaciones", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({ projectId: z.string().min(1), paneles: z.number().int().min(1).max(5000), desde: fechaStr })
      .strict()
      .parse(request.body);
    return {
      poliza: await conFotos(
        await agregarAmpliacion(id, { projectId: body.projectId, paneles: body.paneles, desde: parseDateOnly(body.desde) }, user.id),
      ),
    };
  });

  // ── Cobros ─────────────────────────────────────────────────────────────────

  app.patch(
    "/seguro-granizo/periodos/:id/cobro",
    {
      preHandler: [
        authenticate,
        authorizeAny([
          { module: Module.EXPERIENCIA_CLIENTES, action: Action.EDIT },
          { module: Module.FINANZAS, action: Action.EDIT },
        ]),
      ],
    },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = z
        .object({ estado: z.enum(["PAGADO", "PREVISTO"]), fechaPago: fechaStr.nullable().optional() })
        .strict()
        .parse(request.body);
      const poliza = await marcarCobro(
        id,
        { estado: body.estado, fechaPago: body.fechaPago ? parseDateOnly(body.fechaPago) : null },
        user.id,
      );
      return { poliza: await conFotos(poliza) };
    },
  );

  app.patch(
    "/seguro-granizo/ampliaciones/:id/cobro",
    {
      preHandler: [
        authenticate,
        authorizeAny([
          { module: Module.EXPERIENCIA_CLIENTES, action: Action.EDIT },
          { module: Module.FINANZAS, action: Action.EDIT },
        ]),
      ],
    },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = z
        .object({ estado: z.enum(["PAGADO", "PREVISTO"]), fechaPago: fechaStr.nullable().optional() })
        .strict()
        .parse(request.body);
      const poliza = await marcarCobroAmpliacion(
        id,
        { estado: body.estado, fechaPago: body.fechaPago ? parseDateOnly(body.fechaPago) : null },
        user.id,
      );
      return { poliza: await conFotos(poliza) };
    },
  );

  app.post("/seguro-granizo/periodos/:id/regenerar-cobro", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    return { poliza: await conFotos(await regenerarCobro(id, user.id)) };
  });

  // ── Siniestros ─────────────────────────────────────────────────────────────

  app.post("/seguro-granizo/polizas/:id/siniestros", { preHandler: guard(Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        fechaEvento: fechaStr,
        fechaAviso: fechaStr.nullable().optional(),
        descripcion: z.string().trim().min(3).max(4000),
        panelesAfectados: z.number().int().min(0).max(5000).nullable().optional(),
        eventoMasivo: z.boolean().optional(),
      })
      .strict()
      .parse(request.body);
    const s = await crearSiniestro(
      id,
      {
        fechaEvento: parseDateOnly(body.fechaEvento),
        fechaAviso: body.fechaAviso ? parseDateOnly(body.fechaAviso) : null,
        descripcion: body.descripcion,
        panelesAfectados: body.panelesAfectados ?? null,
        eventoMasivo: body.eventoMasivo,
      },
      user.id,
    );
    reply.code(201);
    return { siniestroId: s.id, poliza: await conFotos(await getPoliza(id)) };
  });

  app.patch("/seguro-granizo/siniestros/:id", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        estado: z.nativeEnum(SiniestroGranizoEstado).optional(),
        descripcion: z.string().trim().min(3).max(4000).optional(),
        fechaEvento: fechaStr.optional(),
        fechaAviso: fechaStr.optional(),
        panelesAfectados: z.number().int().min(0).max(5000).nullable().optional(),
        eventoMasivo: z.boolean().optional(),
        fechaInspeccion: fechaStr.nullable().optional(),
        evaluacionNota: z.string().max(4000).nullable().optional(),
        fechaReposicion: fechaStr.nullable().optional(),
        panelesRepuestos: z.number().int().min(1).max(5000).nullable().optional(),
        costoRealUsd: z.number().min(0).max(1_000_000).nullable().optional(),
        costoDetalle: z.string().max(2000).nullable().optional(),
        motivoRechazoCodigo: z.enum(MOTIVOS_RECHAZO_CODIGOS).nullable().optional(),
        motivoRechazo: z.string().max(2000).nullable().optional(),
      })
      .strict()
      .parse(request.body);
    const fecha = (x: string | null | undefined) => (x === undefined ? undefined : x ? parseDateOnly(x) : null);
    const s = await actualizarSiniestro(
      id,
      {
        ...body,
        fechaEvento: body.fechaEvento ? parseDateOnly(body.fechaEvento) : undefined,
        fechaAviso: body.fechaAviso ? parseDateOnly(body.fechaAviso) : undefined,
        fechaInspeccion: fecha(body.fechaInspeccion),
        fechaReposicion: fecha(body.fechaReposicion),
      },
      user.id,
    );
    return { poliza: await conFotos(await getPoliza(s.polizaId)) };
  });

  app.delete("/seguro-granizo/siniestros/:id", { preHandler: guard(Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    await borrarSiniestro(id, user.id);
    return reply.code(204).send();
  });

  app.post("/seguro-granizo/siniestros/:id/fotos", { preHandler: guard(Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const fotos = await leerFotos(request, (part) => subirFoto(id, part, user.id));
    reply.code(201);
    return { fotos };
  });

  app.delete("/seguro-granizo/siniestros/:id/fotos/:fileId", { preHandler: guard(Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id, fileId } = z.object({ id: z.string().min(1), fileId: z.string().min(1) }).parse(request.params);
    await borrarFoto(id, fileId, user.id);
    return reply.code(204).send();
  });
}
