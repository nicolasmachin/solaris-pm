/**
 * Ubicación GPS del domicilio de la obra, en el lead y en el proyecto: para que
 * con un toque se abra en Google Maps o en Waze. Llega sola cuando el cliente
 * manda su ubicación por WhatsApp (a una bandeja integrada) o desde el bot de
 * minutas, y se puede pegar a mano (coordenadas o un link de Google Maps).
 */

import { prisma } from "../lib/prisma.js";
import { createAuditEntry } from "./audit.service.js";

export type OrigenUbicacion = "WHATSAPP" | "TELEGRAM" | "MANUAL";
export type Coordenadas = { lat: number; lng: number };

function valida(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/**
 * Lee coordenadas de lo que se pegue: "-34.9, -56.1", o un link de Google Maps
 * (`@-34.9,-56.1,17z`, `?q=-34.9,-56.1`, `query=`, `ll=`) o de Waze (`ll=`).
 * Los links cortos (maps.app.goo.gl) no traen las coordenadas: devuelve null.
 */
export function parsearCoordenadas(texto: string | null | undefined): Coordenadas | null {
  const t = decodeURIComponent((texto ?? "").trim());
  if (!t) return null;
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patrones = [
    new RegExp(`@${num},${num}`),
    new RegExp(`[?&](?:q|query|ll|destination|center)=${num},\\s*${num}`),
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`),
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const c = valida(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  return null;
}

/** Links para abrir la ubicación (navegación lista para salir). */
export function linksMapa(lat: number, lng: number) {
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

/** Coordenadas de un mensaje de WhatsApp de tipo `location` (payload de Meta). */
export function coordenadasDeMensajeWhatsApp(payload: unknown): Coordenadas | null {
  const loc = (payload as { location?: { latitude?: unknown; longitude?: unknown } } | null)?.location;
  if (!loc) return null;
  return valida(Number(loc.latitude), Number(loc.longitude));
}

type Guardar = { coords: Coordenadas | null; origen: OrigenUbicacion; userId?: string | null; en?: Date };

function datos(g: Guardar) {
  return g.coords
    ? { ubicacionLat: g.coords.lat, ubicacionLng: g.coords.lng, ubicacionEn: g.en ?? new Date(), ubicacionOrigen: g.origen }
    : { ubicacionLat: null, ubicacionLng: null, ubicacionEn: null, ubicacionOrigen: null };
}

const texto = (c: Coordenadas | null) => (c ? `${c.lat}, ${c.lng}` : null);

/**
 * Guarda la ubicación en el lead y, si ya se convirtió, también en su proyecto
 * (es el mismo domicilio). `coords: null` la borra.
 */
export async function guardarUbicacionLead(leadId: string, g: Guardar) {
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, ubicacionLat: true, ubicacionLng: true, convertedToProjectId: true },
  });
  if (!lead) return null;
  await prisma.salesLead.update({ where: { id: leadId }, data: datos(g) });
  if (g.userId) {
    await createAuditEntry({
      entityType: "lead",
      entityId: leadId,
      userId: g.userId,
      action: "updated",
      fieldChanged: "ubicacion",
      oldValue: lead.ubicacionLat != null ? `${lead.ubicacionLat}, ${lead.ubicacionLng}` : null,
      newValue: texto(g.coords),
      description: g.coords ? `Ubicación GPS cargada (${g.origen.toLowerCase()})` : "Ubicación GPS borrada",
      metadata: { origen: g.origen },
    });
  }
  if (lead.convertedToProjectId) await guardarUbicacionProyecto(lead.convertedToProjectId, g);
  return { leadId, projectId: lead.convertedToProjectId };
}

export async function guardarUbicacionProyecto(projectId: string, g: Guardar) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { ubicacionLat: true, ubicacionLng: true } });
  if (!p) return null;
  await prisma.project.update({ where: { id: projectId }, data: datos(g) });
  if (g.userId) {
    await createAuditEntry({
      entityType: "project",
      entityId: projectId,
      projectId,
      userId: g.userId,
      action: "updated",
      fieldChanged: "ubicacion",
      oldValue: p.ubicacionLat != null ? `${p.ubicacionLat}, ${p.ubicacionLng}` : null,
      newValue: texto(g.coords),
      description: g.coords ? `Ubicación GPS cargada (${g.origen.toLowerCase()})` : "Ubicación GPS borrada",
      metadata: { origen: g.origen },
    });
  }
  return { projectId };
}
