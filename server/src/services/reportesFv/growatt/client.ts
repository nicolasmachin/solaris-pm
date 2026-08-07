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
async function pedir(
  metodo: "GET" | "POST",
  endpoint: string,
  params: Record<string, string | number>,
): Promise<any> {
  const token = requireToken();
  const url = new URL(`${BASE}/${endpoint}`);
  if (metodo === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }

  let ultimoError: unknown = null;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let payload: any;
      try {
        const init: RequestInit = { headers: { Token: token }, signal: controller.signal };
        if (metodo === "POST") {
          const body = new URLSearchParams();
          for (const [k, v] of Object.entries(params)) body.set(k, String(v));
          init.method = "POST";
          init.headers = { Token: token, "Content-Type": "application/x-www-form-urlencoded" };
          init.body = body;
        }
        const res = await fetch(url, init);
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
      if (intento < REINTENTOS) {
        // El rate limit de Growatt es MUCHO más duro de lo que sugiere su
        // documentación: medido contra la API real, una corrida de 44 plantas a
        // ~1,4 req/s hizo que 40 fallaran con 10012 incluso reintentando. Hay
        // que darle segundos de aire, no milisegundos; para el resto de los
        // errores (red, 5xx) el backoff corto de siempre alcanza.
        const esRateLimit = err instanceof Error && err.message.includes("10012");
        await dormir(esRateLimit ? Math.min(4000 * intento, 20_000) : Math.min(1500 * intento, 5000));
      }
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

const get = (endpoint: string, params: Record<string, string | number>) =>
  pedir("GET", endpoint, params);

const post = (endpoint: string, params: Record<string, string | number>) =>
  pedir("POST", endpoint, params);

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

/**
 * Generación diaria (kWh por día) de un rango, vía plant/energy time_unit=day.
 * La API sólo acepta rangos de ≤7 días, así que se itera en tramos. Devuelve un
 * mapa día(YYYY-MM-DD) → kWh. Requests: ceil(dias/7).
 */
export async function generacionDiaria(
  plantId: string,
  desde: string,
  hasta: string,
  onRequest?: () => void,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let inicio = new Date(`${desde}T00:00:00.000Z`);
  const fin = new Date(`${hasta}T00:00:00.000Z`);

  while (inicio <= fin) {
    // Tramo de hasta 7 días.
    const tramoFin = new Date(inicio);
    tramoFin.setUTCDate(tramoFin.getUTCDate() + 6);
    const tramoFinReal = tramoFin > fin ? fin : tramoFin;

    onRequest?.();
    const data = await get("plant/energy", {
      plant_id: plantId,
      start_date: inicio.toISOString().slice(0, 10),
      end_date: tramoFinReal.toISOString().slice(0, 10),
      time_unit: "day",
    });
    const energys: any[] = data?.energys ?? [];
    for (const e of energys) {
      const dia = String(e?.date ?? e?.time ?? "").slice(0, 10);
      const kwh = Number(e?.energy);
      if (dia && Number.isFinite(kwh)) out.set(dia, kwh);
    }

    inicio = new Date(tramoFinReal);
    inicio.setUTCDate(inicio.getUTCDate() + 1);
    await dormir(PAUSA_MS);
  }
  return out;
}

export interface DispositivoGrowatt {
  deviceSn: string;
  dataloggerSn: string | null;
  /** 1=inverter, 3=other (el medidor), 4=max, 5=sph, 7=min/TLX. */
  tipo: number;
  model: string | null;
  /** El servidor de Growatt no ve el equipo. De noche es NORMAL: el datalogger
   *  se alimenta del inversor y sólo transmite con sol. */
  lost: boolean | null;
  status: number | null;
  ultimoDatoEn: Date | null;
}

/**
 * Todos los dispositivos de una planta. Un único request que sirve para dos
 * cosas: encontrar los dataloggers del smart meter (lo que se hacía antes) y
 * conocer el estado del inversor, que antes se descartaba.
 */
export async function listarDispositivos(plantId: string): Promise<DispositivoGrowatt[]> {
  const data = await get("device/list", { plant_id: plantId });
  const devices: any[] = data?.devices ?? [];
  return devices.map((d) => ({
    deviceSn: String(d?.device_sn ?? "").trim(),
    dataloggerSn: d?.datalogger_sn ? String(d.datalogger_sn).trim() : null,
    tipo: Number(d?.type),
    model: d?.model ? String(d.model) : null,
    lost: typeof d?.lost === "boolean" ? d.lost : null,
    status: d?.status != null && d.status !== "" ? Number(d.status) : null,
    ultimoDatoEn: parsearFechaGrowatt(d?.last_update_time),
  }));
}

/**
 * "2026-08-07 12:16:22" en hora local de la planta (Uruguay, GMT-3 fijo, sin
 * horario de verano). Se interpreta explícitamente en -03:00 en vez de dejarlo
 * al TZ del proceso, que en Docker es UTC.
 */
function parsearFechaGrowatt(v: unknown): Date | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dataloggers de smart meter (type === 3) de una planta. */
export async function dataloggersSmartMeter(plantId: string): Promise<string[]> {
  const devices = await listarDispositivos(plantId);
  const out: string[] = [];
  for (const d of devices) {
    if (d.tipo !== 3) continue;
    if (d.dataloggerSn && !out.includes(d.dataloggerSn)) out.push(d.dataloggerSn);
  }
  return out;
}

export interface EstadoInversorGrowatt {
  faultCode: number | null;
  warnCode: number | null;
  /** Texto de Growatt, en inglés. "Unknown" cuando no hay falla. */
  faultTexto: string | null;
  warnTexto: string | null;
  /** "Normal", "Waiting", "Fault"… */
  statusText: string | null;
  status: number | null;
  ultimoDatoEn: Date | null;
}

/**
 * Estado detallado de un inversor MIN/TLX. Es el único endpoint de la Open API
 * v1 que expone códigos de falla (no existe `inverter/alarm` ni `device/fault`),
 * y es **POST con form body**: por GET devuelve HTTP 405.
 *
 * Se pide sólo para inversores ya sospechosos, no para toda la flota: es un
 * request extra y el rate limit de Growatt es agresivo.
 */
export async function estadoInversor(deviceSn: string): Promise<EstadoInversorGrowatt | null> {
  const data = await post("device/tlx/tlx_last_data", { tlx_sn: deviceSn });
  // La API envuelve la muestra en un objeto cuyo nombre varía según el modelo.
  const d = data?.tlx ?? data?.data ?? data;
  if (!d || typeof d !== "object") return null;

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // "Unknown" es lo que devuelve Growatt cuando NO hay falla: tratarlo como
  // texto real llenaría el panel de "Unknown" sin significar nada.
  const texto = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" || s.toLowerCase() === "unknown" ? null : s;
  };

  return {
    faultCode: num(d.faultCode ?? d.faultType ?? d.fault_code),
    warnCode: num(d.warnCode ?? d.newWarnCode ?? d.warn_code),
    faultTexto: texto(d.faultText ?? d.errorText),
    warnTexto: texto(d.warnText),
    statusText: texto(d.statusText),
    status: num(d.status),
    ultimoDatoEn: parsearFechaGrowatt(d.time ?? d.lastUpdateTimeText),
  };
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
