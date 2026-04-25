import https from "node:https";
import cron from "node-cron";

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// ─── BCU SOAP — fetch tipo de cambio interbancario USD ─────────────────────

const BCU_HOST = "cotizaciones.bcu.gub.uy";
const BCU_PATH = "/wscotizaciones/servlet/awsbcucotizaciones";
const USD_INTERBANCARIO_CODE = 2225; // BCU: dólar interbancario / fondo

type BcuRate = { fechaIso: string; tcv: number; tcc: number };

function buildSoapRequest(fechaDesde: string, fechaHasta: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    "<soap:Body>" +
    '<wsbcucotizaciones.Execute xmlns="Cotiza">' +
    "<Entrada>" +
    `<Moneda><item>${USD_INTERBANCARIO_CODE}</item></Moneda>` +
    `<FechaDesde>${fechaDesde}</FechaDesde>` +
    `<FechaHasta>${fechaHasta}</FechaHasta>` +
    "<Grupo>0</Grupo>" +
    "</Entrada>" +
    "</wsbcucotizaciones.Execute>" +
    "</soap:Body>" +
    "</soap:Envelope>"
  );
}

function fetchBcuRange(fechaDesde: string, fechaHasta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = buildSoapRequest(fechaDesde, fechaHasta);
    const req = https.request(
      {
        hostname: BCU_HOST,
        path: BCU_PATH,
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "Cotiza.Execute",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 20_000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`BCU respondió HTTP ${res.statusCode}`));
            return;
          }
          resolve(data);
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("BCU SOAP timeout (20s)"));
    });
    req.write(body);
    req.end();
  });
}

// Parsea la respuesta SOAP con regex (sin agregar deps de XML).
// Devuelve la cotización MÁS RECIENTE del rango (BCU sólo publica días hábiles).
function parseBcuResponse(xml: string): BcuRate | null {
  // Si BCU devuelve un fault o status != 1, abortamos.
  const statusMatch = xml.match(/<status>(\d+)<\/status>/);
  if (statusMatch && statusMatch[1] !== "1") return null;

  const fault = xml.match(/<faultstring>([^<]+)<\/faultstring>/);
  if (fault) throw new Error(`BCU SOAP Fault: ${fault[1]}`);

  // Cada cotización viene en un bloque <datoscotizaciones.dato>...</...>.
  // Tomamos el bloque cuyo <Fecha> es el más reciente.
  const datoRegex = /<datoscotizaciones\.dato[^>]*>([\s\S]*?)<\/datoscotizaciones\.dato>/g;
  const candidates: BcuRate[] = [];
  let match;
  while ((match = datoRegex.exec(xml)) !== null) {
    const block = match[1];
    const fecha = block.match(/<Fecha>(\d{4}-\d{2}-\d{2})<\/Fecha>/)?.[1];
    const tcc = block.match(/<TCC>([\d.]+)<\/TCC>/)?.[1];
    const tcv = block.match(/<TCV>([\d.]+)<\/TCV>/)?.[1];
    if (fecha && tcc && tcv) {
      candidates.push({ fechaIso: fecha, tcc: parseFloat(tcc), tcv: parseFloat(tcv) });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.fechaIso > b.fechaIso ? -1 : 1));
  return candidates[0];
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Consulta SOLO el TC del BCU sin tocar la DB. Para uso desde el modal de
 * "actualizar TC": el usuario ve el valor sugerido por BCU y decide si lo
 * aplica con el botón Guardar (que va por el endpoint POST normal).
 *
 * Pide los últimos 7 días para cubrir fines de semana / feriados (BCU sólo
 * publica en días hábiles).
 */
export async function fetchBcuRatePreview(): Promise<{
  fechaIso: string;
  usdToUyu: number;
} | null> {
  const today = new Date();
  const fechaHasta = isoDateOnly(today);
  const fechaDesde = isoDateOnly(shiftDays(today, -7));
  const xml = await fetchBcuRange(fechaDesde, fechaHasta);
  const parsed = parseBcuResponse(xml);
  if (!parsed) return null;
  return { fechaIso: parsed.fechaIso, usdToUyu: parsed.tcv };
}

/**
 * Sincroniza el TC interbancario USD desde BCU. Idempotente: si ya hay un
 * registro con `source = "bcu"` para la fecha que devuelve BCU, no inserta
 * duplicado. Pide un rango de los últimos 7 días para cubrir fines de
 * semana y feriados (BCU sólo publica en días hábiles).
 *
 * El valor que se persiste es TCV (venta) — para el TC interbancario,
 * BCU normalmente devuelve TCC === TCV (mismo precio compra/venta).
 *
 * Si falla (BCU caído, formato inesperado), loguea warning y no toca DB.
 * El sistema sigue usando el último rate manual o automático previo.
 */
export async function syncBcuRate(): Promise<{
  inserted: boolean;
  rate?: number;
  fechaIso?: string;
  reason?: string;
}> {
  const today = new Date();
  const fechaHasta = isoDateOnly(today);
  const fechaDesde = isoDateOnly(shiftDays(today, -7));

  let xml: string;
  try {
    xml = await fetchBcuRange(fechaDesde, fechaHasta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bcu-rate] Fetch a BCU falló: ${msg}`);
    return { inserted: false, reason: `fetch_error: ${msg}` };
  }

  let parsed: BcuRate | null;
  try {
    parsed = parseBcuResponse(xml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bcu-rate] Parseo de respuesta BCU falló: ${msg}`);
    return { inserted: false, reason: `parse_error: ${msg}` };
  }

  if (!parsed) {
    console.warn("[bcu-rate] BCU no devolvió cotizaciones en los últimos 7 días");
    return { inserted: false, reason: "no_data" };
  }

  // Idempotencia: si ya hay una entrada BCU para esta fecha (=00:00 UTC del día),
  // no insertamos otra.
  const fechaUtc = new Date(`${parsed.fechaIso}T00:00:00.000Z`);
  const startOfDay = fechaUtc;
  const endOfDay = shiftDays(fechaUtc, 1);

  const existing = await prisma.exchangeRate.findFirst({
    where: {
      source: "bcu",
      date: { gte: startOfDay, lt: endOfDay },
    },
    select: { id: true },
  });

  if (existing) {
    return { inserted: false, rate: parsed.tcv, fechaIso: parsed.fechaIso, reason: "already_synced" };
  }

  await prisma.exchangeRate.create({
    data: {
      date: fechaUtc,
      usdToUyu: new Prisma.Decimal(parsed.tcv),
      source: "bcu",
      createdBy: null,
    },
  });

  console.log(
    `[bcu-rate] Sincronizado TC interbancario BCU: 1 USD = ${parsed.tcv} UYU (fecha ${parsed.fechaIso})`,
  );
  return { inserted: true, rate: parsed.tcv, fechaIso: parsed.fechaIso };
}

/**
 * Job diario que sincroniza el TC del BCU. Se dispara todos los días a
 * las 14:00 UY (BCU publica las cotizaciones del día generalmente entre
 * las 13:30 y 14:00 hora local). El cron usa la hora del server (UTC),
 * por eso la expresión es "0 17 * * *" → 17:00 UTC = 14:00 UY (UTC-3).
 *
 * Además se corre en el bootstrap del server para que arrancando el
 * sistema desde cero ya haya un rate disponible.
 */
export function startBcuRateJob() {
  const task = cron.schedule("0 17 * * *", async () => {
    try {
      await syncBcuRate();
    } catch (error) {
      console.error("[bcu-rate] Error ejecutando sync diario:", error);
    }
  });
  return task;
}
