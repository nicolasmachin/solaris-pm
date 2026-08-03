// Cliente HTTP de la Growatt Open API v1.
//
// fetch nativo (sin el SDK Python ni dependencia nueva). Token OBLIGATORIO por
// env — en el script original estaba hardcodeado, acá no. Cada request reintenta
// con backoff y respeta el rate limit (error_code 10012 = "frequently access").
//
// Hallazgos de la bitácora que condicionan el diseño:
//   - meter_data devuelve SÓLO el último día de un rango → hay que iterar día a día.
//   - plant/list pagina de a 20 por default → perpage=100.
//   - rate limit fuerte: pausa entre llamadas + backoff en 10012.

import { AppError } from "../../../utils/errors.js";
import type { MuestraMedidor } from "./metricas.js";

const BASE = process.env.GROWATT_API_BASE || "https://openapi.growatt.com/v1";
const PAUSA_MS = Number(process.env.REPORTES_FV_GROWATT_PAUSA_MS ?? 700);
const REINTENTOS = 5;

function requireToken(): string {
  const token = process.env.GROWATT_API_TOKEN;
  if (!token) {
    throw new AppError(
      500,
      "GROWATT_NOT_CONFIGURED",
      "Falta GROWATT_API_TOKEN. Configurá el token de la Growatt Open API para poder ingerir datos.",
    );
  }
  return token;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PlantaGrowatt {
  plantId: string;
  name: string;
  status?: string | null;
  peakPowerKw?: number | null;
  city?: string | null;
  country?: string | null;
}

/**
 * GET a la Open API con retry. Growatt envuelve todo en
 * `{ error_code, error_msg, data }`. error_code 0 = ok. `data` es lo que
 * devolvemos. Reintenta ante error de red o error_code != 0 (incluye rate limit).
 */
async function get(endpoint: string, params: Record<string, string | number>): Promise<any> {
  const token = requireToken();
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let ultimoError: unknown = null;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let payload: any;
      try {
        const res = await fetch(url, { headers: { Token: token }, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        payload = await res.json();
      } finally {
        clearTimeout(timeout);
      }

      const errorCode = payload?.error_code;
      if (errorCode !== 0 && errorCode !== undefined) {
        // 10012 = frequently_access (rate limit) → reintentar con más pausa.
        throw new Error(`error_code=${errorCode} error_msg=${payload?.error_msg ?? ""}`);
      }
      return payload?.data ?? payload;
    } catch (err) {
      ultimoError = err;
      if (intento < REINTENTOS) await dormir(Math.min(1500 * intento, 5000));
    }
  }
  throw new AppError(
    502,
    "GROWATT_API_ERROR",
    `Growatt no respondió a ${endpoint} tras ${REINTENTOS} intentos: ${
      ultimoError instanceof Error ? ultimoError.message : String(ultimoError)
    }`,
  );
}

/** Inventario completo de plantas visibles con el token, paginado. */
export async function listarPlantas(): Promise<PlantaGrowatt[]> {
  const plantas: PlantaGrowatt[] = [];
  let pagina = 1;
  let totalEsperado: number | null = null;

  while (true) {
    const data = await get("plant/list", {
      page: pagina,
      perpage: 100,
      search_type: "",
      search_keyword: "",
    });
    const lista: any[] = data?.plants ?? [];
    if (totalEsperado == null) totalEsperado = Number(data?.count ?? lista.length);
    if (lista.length === 0) break;

    for (const p of lista) {
      plantas.push({
        plantId: String(p.plant_id ?? p.plantId),
        name: String(p.name ?? p.plant_name ?? `Planta ${p.plant_id}`),
        status: p.status != null ? String(p.status) : null,
        peakPowerKw: p.peak_power != null ? Number(p.peak_power) : null,
        city: p.city != null ? String(p.city) : null,
        country: p.country != null ? String(p.country) : null,
      });
    }
    if (plantas.length >= (totalEsperado ?? 0)) break;
    pagina++;
    await dormir(PAUSA_MS);
  }
  return plantas;
}

/** Generación mensual (kWh) de una planta para el rango [inicio, fin] del mes. */
export async function generacionMensual(
  plantId: string,
  inicio: string,
  fin: string,
): Promise<number | null> {
  const data = await get("plant/energy", {
    plant_id: plantId,
    start_date: inicio,
    end_date: fin,
    time_unit: "month",
  });
  const energys: any[] = data?.energys ?? [];
  if (energys.length === 0) return null;
  const e = Number(energys[0]?.energy);
  return Number.isFinite(e) ? e : null;
}

/** Dataloggers de smart meter (type === 3) de una planta. */
export async function dataloggersSmartMeter(plantId: string): Promise<string[]> {
  const data = await get("device/list", { plant_id: plantId });
  const devices: any[] = data?.devices ?? [];
  const out: string[] = [];
  for (const d of devices) {
    if (d?.type !== 3) continue;
    const sn = String(d?.datalogger_sn ?? "").trim();
    if (sn && !out.includes(sn)) out.push(sn);
  }
  return out;
}

/** Direcciones de medidores de un datalogger. */
export async function medidoresDeDatalogger(datalogSn: string): Promise<string[]> {
  const data = await get("device/ammeter/meter_list", { datalog_sn: datalogSn });
  const meters: any[] = data?.meters ?? [];
  return meters.map((m) => String(m?.address ?? "").trim()).filter(Boolean);
}

/** Muestras de un medidor en un día concreto. */
export async function muestrasDelDia(
  datalogSn: string,
  address: string,
  dia: string,
): Promise<MuestraMedidor[]> {
  const data = await get("device/ammeter/meter_data", {
    datalog_sn: datalogSn,
    address,
    start_date: dia,
    end_date: dia,
  });
  return (data?.meter_data ?? []) as MuestraMedidor[];
}

export const growattPausaMs = PAUSA_MS;
export { dormir as growattDormir };
