// Cliente HTTP de la Northbound API de Huawei FusionSolar (SmartPVMS).
//
// Diferencias con el cliente de Growatt que condicionan el diseño:
//
//   - Autenticación por SESIÓN, no por token fijo: `POST /thirdData/login` con
//     usuario + systemCode devuelve una cookie XSRF-TOKEN que dura ~30 min y hay
//     que mandar como header en cada request. Se cachea en memoria; el login
//     tiene su propio rate limit, así que re-loguear en loop es peor que fallar.
//   - Los errores llegan con HTTP 200 y `failCode` en el body. `success: false`.
//   - `getKpiStationDay` devuelve el MES ENTERO de HASTA 100 plantas en UNA
//     llamada, con generación, consumo, exportación e importación juntos. Es la
//     diferencia grande con Growatt, donde consumo y exportación salen del smart
//     meter día por día y fallan seguido.
//   - Rate limit real (medido en el spike del 8-ago-2026, no el de la doc): dos
//     llamadas a 177 ms dan failCode 407; separadas ~2 s pasan siempre. La doc
//     dice "1 cada 5 minutos" y no se cumple. Igual se reintenta con backoff.
//
// El dominio es regional y la cuenta existe en uno solo: el nuestro es `la5`.

import { AppError } from "../../../utils/errors.js";

const BASE = process.env.HUAWEI_API_BASE || "https://la5.fusionsolar.huawei.com";
const PAUSA_MS = Number(process.env.HUAWEI_PAUSA_MS || "") || 2500;
const REINTENTOS = 5;

/** La sesión dura ~30 min; se renueva antes para no cortar una ingesta a mitad. */
const SESION_MS = 20 * 60 * 1000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token: string | null = null;
let tokenVence = 0;

function credenciales(): { userName: string; systemCode: string } {
  const userName = process.env.HUAWEI_API_USER;
  const systemCode = process.env.HUAWEI_API_PASSWORD;
  if (!userName || !systemCode) {
    throw new AppError(
      500,
      "HUAWEI_NOT_CONFIGURED",
      "Faltan HUAWEI_API_USER / HUAWEI_API_PASSWORD (usuario Northbound de FusionSolar).",
    );
  }
  return { userName, systemCode };
}

async function postCrudo(ruta: string, body: unknown, conToken: boolean): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conToken && token) headers["XSRF-TOKEN"] = token;

  const res = await fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // El token viaja por cookie, no por body.
  const xsrf = res.headers.get("set-cookie")?.match(/XSRF-TOKEN=([^;]+)/)?.[1];
  if (xsrf) {
    token = xsrf;
    tokenVence = Date.now() + SESION_MS;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}`);
  return res.json();
}

async function login(): Promise<void> {
  const r = await postCrudo("/thirdData/login", credenciales(), false);
  if (!token) {
    throw new AppError(
      502,
      "HUAWEI_LOGIN_FAILED",
      `FusionSolar rechazó el login (failCode ${r?.failCode ?? "?"}). Revisá usuario y contraseña del usuario Northbound.`,
    );
  }
}

async function asegurarSesion(): Promise<void> {
  if (token && Date.now() < tokenVence) return;
  token = null;
  await login();
}

/**
 * POST a la NBI con sesión, reintentos y backoff.
 *
 * failCode 305/307 = sesión vencida → re-loguea una vez y repite.
 * failCode 407     = frecuencia demasiado alta → espera creciente.
 */
export async function pedir(ruta: string, body: Record<string, unknown>): Promise<any> {
  await asegurarSesion();

  let ultimoError: unknown = null;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const data = await postCrudo(ruta, body, true);
      const fail = Number(data?.failCode ?? 0);

      if (fail === 0) return data;

      if (fail === 305 || fail === 307) {
        token = null;
        await login();
        continue;
      }
      if (fail === 407) {
        await dormir(5000 * intento);
        continue;
      }
      throw new AppError(
        502,
        "HUAWEI_API_ERROR",
        `FusionSolar devolvió failCode ${fail} en ${ruta}${data?.message ? `: ${data.message}` : ""}`,
      );
    } catch (e) {
      if (e instanceof AppError) throw e;
      ultimoError = e;
      await dormir(PAUSA_MS * intento);
    }
  }
  throw new AppError(
    502,
    "HUAWEI_API_UNREACHABLE",
    `No se pudo consultar ${ruta} tras ${REINTENTOS} intentos: ${String(ultimoError)}`,
  );
}

export interface PlantaHuawei {
  plantCode: string;
  name: string;
  capacityKwp: number | null;
  gridConnectionDate: Date | null;
  address: string | null;
}

/** Catálogo de plantas al alcance del usuario Northbound (paginado de a 100). */
export async function listarPlantas(): Promise<PlantaHuawei[]> {
  const salida: PlantaHuawei[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await pedir("/thirdData/stations", { pageNo: pagina, pageSize: 100 });
    const lista: any[] = r?.data?.list ?? [];
    for (const s of lista) {
      salida.push({
        plantCode: s.plantCode,
        name: s.plantName ?? s.plantCode,
        // `stations` da kWp; el viejo getStationList daba MW. Usamos el nuevo.
        capacityKwp: s.capacity == null ? null : Number(s.capacity),
        gridConnectionDate: s.gridConnectionDate ? new Date(s.gridConnectionDate) : null,
        address: s.plantAddress ?? null,
      });
    }
    if (pagina >= Number(r?.data?.pageCount ?? 1) || !lista.length) break;
    await dormir(PAUSA_MS);
  }
  return salida;
}

export interface DiaHuawei {
  fecha: string; // YYYY-MM-DD
  generacionKwh: number;
  consumoKwh: number;
  exportacionKwh: number;
  importacionKwh: number;
}

/** Serie diaria de un mes, por planta. Clave = plantCode. */
export type SerieDiariaPorPlanta = Map<string, DiaHuawei[]>;

/**
 * Un mes completo de datos diarios para varias plantas en UNA llamada.
 *
 * Ojo: FusionSolar devuelve un registro por día con `dataItemMap` VACÍO cuando
 * ese día no tuvo datos (planta sin comunicación). Esos días se descartan acá,
 * pero la cantidad total de registros es la que define cuántos días se
 * esperaban — y ya viene recortada por la fecha de conexión a red, así que una
 * planta que arrancó a mitad de mes no figura como si le faltaran datos.
 */
export async function serieDiariaDelMes(
  plantCodes: string[],
  anio: number,
  mes: number, // 1-12
): Promise<{ series: SerieDiariaPorPlanta; diasReportados: Map<string, number> }> {
  const series: SerieDiariaPorPlanta = new Map();
  const diasReportados = new Map<string, number>();
  if (!plantCodes.length) return { series, diasReportados };

  // Mediodía del 15: cae dentro del mes en cualquier huso horario.
  const collectTime = Date.UTC(anio, mes - 1, 15, 12);

  // El límite documentado es 100 estaciones por request; de a 50 va sobrado.
  for (let i = 0; i < plantCodes.length; i += 50) {
    const lote = plantCodes.slice(i, i + 50);
    if (i > 0) await dormir(PAUSA_MS);

    const r = await pedir("/thirdData/getKpiStationDay", {
      stationCodes: lote.join(","),
      collectTime,
    });

    for (const fila of r?.data ?? []) {
      const code = fila.stationCode;
      diasReportados.set(code, (diasReportados.get(code) ?? 0) + 1);

      const m = fila.dataItemMap ?? {};
      if (Object.keys(m).length === 0) continue; // día sin datos

      const arr = series.get(code) ?? [];
      arr.push({
        fecha: new Date(Number(fila.collectTime)).toISOString().slice(0, 10),
        // PVYield e inverterYield vienen iguales; PVYield es el canónico.
        generacionKwh: Number(m.PVYield ?? m.inverterYield ?? 0),
        consumoKwh: Number(m.use_power ?? 0),
        exportacionKwh: Number(m.ongrid_power ?? 0),
        importacionKwh: Number(m.buyPower ?? 0),
      });
      series.set(code, arr);
    }
  }

  return { series, diasReportados };
}

/** 1 = sin comunicación, 2 = con falla, 3 = sana. */
export type EstadoSalud = 1 | 2 | 3;

/**
 * Estado en tiempo real. `real_health_state` es la señal que Growatt no da:
 * ahí hay que inferir la falla de "comunica pero no genera".
 *
 * Verificado en campo: Rodolfo Sosa da 1 y la planta está sana — lo que falla es
 * el wifi del inversor. O sea 1 es SIN COMUNICACIÓN, no "planta rota".
 */
export async function estadoActual(plantCodes: string[]): Promise<Map<string, EstadoSalud | null>> {
  const salida = new Map<string, EstadoSalud | null>();
  if (!plantCodes.length) return salida;

  for (let i = 0; i < plantCodes.length; i += 50) {
    const lote = plantCodes.slice(i, i + 50);
    if (i > 0) await dormir(PAUSA_MS);
    const r = await pedir("/thirdData/getStationRealKpi", { stationCodes: lote.join(",") });
    for (const fila of r?.data ?? []) {
      const estado = Number(fila?.dataItemMap?.real_health_state);
      salida.set(fila.stationCode, estado === 1 || estado === 2 || estado === 3 ? estado : null);
    }
  }
  return salida;
}
