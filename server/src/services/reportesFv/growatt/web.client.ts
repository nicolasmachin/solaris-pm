// Cliente de la WEB de Growatt (server.growatt.com), no de la Open API.
//
// La Open API no da el detalle cada 5 minutos por string de todos los equipos
// ni el "History Data" que muestra la web; la web sí. Se entra con el usuario y
// la contraseña de la cuenta de Voltia (GROWATT_WEB_USER / GROWATT_WEB_PASS) y
// se llaman los mismos endpoints que usa la página, sin navegador:
//
//   POST /login                 account + passwordCrc (MD5 con los '0' de las
//                               posiciones pares cambiados por 'c', igual que el
//                               JS de la web). Responde {"result":1} y deja la
//                               sesión en cookies.
//   POST /device/getTLXHistory  tlxSn, startDate, endDate, start = número de
//                               página (0, 1, …). 80 registros por página, del
//                               más nuevo al más viejo, con `haveNext`.
//
// Sólo inversores MIN/TLX (tipo 7). Verificado el 27-oct-2026 con Gustavo
// Vallegra (ZJP2G3900R). Es una API no documentada: si Growatt la cambia, esto
// se rompe y hay que volver a mirar qué hace la página.

import crypto from "node:crypto";

import { AppError } from "../../../utils/errors.js";

const BASE = "https://server.growatt.com";
// La sesión de la web dura bastante más; se renueva cada media hora por las dudas.
const SESION_MS = 30 * 60 * 1000;

let cookies = new Map<string, string>();
let sesionDesde = 0;

export function webConfigurada(): boolean {
  return !!process.env.GROWATT_WEB_USER?.trim() && !!process.env.GROWATT_WEB_PASS?.trim();
}

/** El hash que manda el formulario de login de la web en `passwordCrc`. */
export function hashPasswordGrowatt(password: string): string {
  const h = crypto.createHash("md5").update(password).digest("hex").split("");
  for (let i = 0; i < h.length; i += 2) if (h[i] === "0") h[i] = "c";
  return h.join("");
}

function guardarCookies(r: Response) {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    if (i > 0) cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  }
}

async function post(path: string, form: Record<string, string>): Promise<Response> {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: new URLSearchParams(form),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  guardarCookies(r);
  return r;
}

async function login(): Promise<void> {
  if (!webConfigurada()) {
    throw new AppError(503, "GROWATT_WEB_NO_CONFIGURADA", "Falta configurar el usuario de la web de Growatt (GROWATT_WEB_USER / GROWATT_WEB_PASS).");
  }
  cookies = new Map();
  const r = await post("/login", {
    account: process.env.GROWATT_WEB_USER!.trim(),
    password: "",
    validateCode: "",
    isReadPact: "0",
    passwordCrc: hashPasswordGrowatt(process.env.GROWATT_WEB_PASS!.trim()),
  });
  const j = (await r.json().catch(() => null)) as { result?: number; msg?: string } | null;
  if (j?.result !== 1) {
    throw new AppError(502, "GROWATT_WEB_LOGIN", `La web de Growatt rechazó el login${j?.msg ? `: ${j.msg}` : ""}.`);
  }
  sesionDesde = Date.now();
}

async function asegurarSesion() {
  if (!sesionDesde || Date.now() - sesionDesde > SESION_MS) await login();
}

/** Un registro del History Data de un inversor MIN/TLX (cada ~5 minutos). */
export interface RegistroTlx {
  /** "AAAA-MM-DD HH:MM:SS", hora de la planta (Uruguay). */
  time: string;
  status: number | null;
  ppv: number | null;
  pac: number | null;
  /** Por entrada (PV1..PV4): tensión V, corriente A, potencia W. */
  vpv: (number | null)[];
  ipv: (number | null)[];
  ppvN: (number | null)[];
  vac1: number | null;
  fac: number | null;
  temp1: number | null;
  eacToday: number | null;
  etoGridToday: number | null;
  etoUserToday: number | null;
  elocalLoadToday: number | null;
  pacToGrid: number | null;
  pacToUser: number | null;
  pacToLocalLoad: number | null;
  faultType: number | null;
  warnCode: number | null;
  deratingMode: number | null;
  realOPPercent: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function mapear(d: Record<string, unknown>): RegistroTlx {
  return {
    time: String(d.time ?? ""),
    status: num(d.status),
    ppv: num(d.ppv),
    pac: num(d.pac),
    vpv: [1, 2, 3, 4].map((i) => num(d[`vpv${i}`])),
    ipv: [1, 2, 3, 4].map((i) => num(d[`ipv${i}`])),
    ppvN: [1, 2, 3, 4].map((i) => num(d[`ppv${i}`])),
    vac1: num(d.vac1),
    fac: num(d.fac),
    temp1: num(d.temp1),
    eacToday: num(d.eacToday),
    etoGridToday: num(d.etoGridToday),
    etoUserToday: num(d.etoUserToday),
    elocalLoadToday: num(d.elocalLoadToday),
    pacToGrid: num(d.pacToGridTotal),
    pacToUser: num(d.pacToUserTotal),
    pacToLocalLoad: num(d.pacToLocalLoad),
    faultType: num(d.faultType),
    warnCode: num(d.warnCode),
    deratingMode: num(d.deratingMode),
    realOPPercent: num(d.realOPPercent),
  };
}

/**
 * History Data de un inversor MIN/TLX entre dos días (inclusive), ordenado del
 * más viejo al más nuevo. Corta a las 60 páginas (~4.800 registros, unos 30
 * días de luz) para no quedarse colgado si la web responde algo raro.
 */
export async function historialTlx(tlxSn: string, desde: string, hasta: string): Promise<RegistroTlx[]> {
  await asegurarSesion();
  const out: RegistroTlx[] = [];
  for (let pagina = 0, reintento = false; pagina < 60; ) {
    const r = await post("/device/getTLXHistory", { tlxSn, startDate: desde, endDate: hasta, start: String(pagina) });
    const j = (await r.json().catch(() => null)) as
      | { result?: number; obj?: { datas?: Record<string, unknown>[]; haveNext?: boolean } }
      | null;
    if (!j || j.result !== 1 || !j.obj) {
      // Sesión vencida o rechazada: se reintenta una vez con login nuevo.
      if (!reintento) {
        reintento = true;
        await login();
        continue;
      }
      throw new AppError(502, "GROWATT_WEB_HISTORIAL", "La web de Growatt no devolvió el historial.");
    }
    out.push(...(j.obj.datas ?? []).map(mapear));
    if (!j.obj.haveNext) break;
    pagina++;
  }
  return out.filter((x) => x.time).sort((a, b) => a.time.localeCompare(b.time));
}
