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
//   POST /device/getMAXHistory  igual, con maxSn. Trae además las tensiones de
//                               las tres fases, la corriente de cada string,
//                               la resistencia de aislamiento (pvIso) y la
//                               corriente de fuga (gfci).
//   POST /log/getNewPlantFaultLog  plantId, date (AAAA-MM con type=2: el mes),
//                               toPageNum (desde 1), deviceSn "" (todos),
//                               deviceFlag 0. El "Registro de fallos de la
//                               planta": código, nombre y solución sugerida.
//
// Inversores MIN/TLX (tipo 7) y MAX/MID/MAC (tipo 4), que son todos los
// Growatt de la cartera. Verificado el 27-oct-2026 con Gustavo Vallegra
// (ZJP2G3900R, TLX) y Martín González (JRR1EXR00E, MID 12KTL3-XL2). Es una API
// no documentada: si Growatt la cambia, esto se rompe y hay que volver a mirar
// qué hace la página.

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

/** Un registro del History Data de un inversor (cada ~5 minutos). */
export interface RegistroInversor {
  /** "AAAA-MM-DD HH:MM:SS", hora de la planta (Uruguay). */
  time: string;
  /** 0 en espera, 1 generando, 3 en falla. */
  status: number | null;
  ppv: number | null;
  pac: number | null;
  /** Por entrada (PV1, PV2…; 4 en los MIN, hasta 16 en los MAX): tensión V, corriente A, potencia W. */
  vpv: (number | null)[];
  ipv: (number | null)[];
  ppvN: (number | null)[];
  /** Corriente de cada string (solo MAX; vacío en los MIN). */
  iString: (number | null)[];
  /** Tensión de red: la de fase, o la de línea en redes de 230 V sin neutro. */
  vac1: number | null;
  fac: number | null;
  temp1: number | null;
  /** Resistencia de aislamiento de los paneles a tierra (kΩ), si el equipo la informa. */
  pvIso: number | null;
  /** Corriente de fuga (mA), si el equipo la informa. */
  gfci: number | null;
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

export type TipoInversorWeb = 4 | 7;

const HISTORIAL: Record<TipoInversorWeb, { ruta: string; campo: string }> = {
  7: { ruta: "/device/getTLXHistory", campo: "tlxSn" },
  4: { ruta: "/device/getMAXHistory", campo: "maxSn" },
};

export function tipoConHistorial(tipo: number): tipo is TipoInversorWeb {
  return tipo in HISTORIAL;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Los valores `${prefijo}1`, `${prefijo}2`… que traiga el registro. */
function serie(d: Record<string, unknown>, prefijo: string, hasta: number) {
  const out: (number | null)[] = [];
  for (let i = 1; i <= hasta && `${prefijo}${i}` in d; i++) out.push(num(d[`${prefijo}${i}`]));
  return out;
}

function mapear(d: Record<string, unknown>): RegistroInversor {
  // Los MAX traen las tres fases (vacr/s/t) y las de línea (vacRs/St/Tr). En
  // una red de 230 V sin neutro la "de fase" da ~133 V: ahí vale la de línea.
  let vac1 = num(d.vac1);
  if (vac1 == null && ("vacr" in d || "vacRs" in d)) {
    const max = (xs: unknown[]) => Math.max(0, ...xs.map(num).filter((x): x is number => x != null));
    const fase = max([d.vacr, d.vacs, d.vact]);
    vac1 = fase > 180 ? fase : max([d.vacRs, d.vacSt, d.vacTr]) || null;
  }
  return {
    time: String(d.time ?? ""),
    status: num(d.status),
    ppv: num(d.ppv),
    pac: num(d.pac),
    vpv: serie(d, "vpv", 16),
    ipv: serie(d, "ipv", 16),
    ppvN: serie(d, "ppv", 16),
    iString: serie(d, "currentString", 32),
    vac1,
    fac: num(d.fac),
    temp1: num(d.temp1 ?? d.temperature),
    pvIso: num(d.pvIso),
    gfci: num(d.gfci),
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

/** Respuesta de la web; si no vino bien, se reintenta una vez con login nuevo. */
async function pedir<T>(ruta: string, form: Record<string, string>, error: string): Promise<T> {
  await asegurarSesion();
  for (let intento = 0; ; intento++) {
    const r = await post(ruta, form);
    const j = (await r.json().catch(() => null)) as { result?: number; obj?: T } | null;
    if (j && j.result === 1 && j.obj) return j.obj;
    if (intento > 0) throw new AppError(502, "GROWATT_WEB", error);
    await login();
  }
}

/**
 * History Data de un inversor MIN/TLX o MAX entre dos días (inclusive),
 * ordenado del más viejo al más nuevo. Corta a las 60 páginas (~4.800
 * registros, unos 30 días de luz) para no quedarse colgado si la web responde
 * algo raro.
 */
export async function historialInversor(sn: string, tipo: TipoInversorWeb, desde: string, hasta: string): Promise<RegistroInversor[]> {
  const { ruta, campo } = HISTORIAL[tipo];
  const out: RegistroInversor[] = [];
  for (let pagina = 0; pagina < 60; pagina++) {
    const obj = await pedir<{ datas?: Record<string, unknown>[]; haveNext?: boolean }>(
      ruta,
      { [campo]: sn, startDate: desde, endDate: hasta, start: String(pagina) },
      "La web de Growatt no devolvió el historial.",
    );
    out.push(...(obj.datas ?? []).map(mapear));
    if (!obj.haveNext) break;
  }
  return out.filter((x) => x.time).sort((a, b) => a.time.localeCompare(b.time));
}

/** Una alarma del "Registro de fallos de la planta" de la web. */
export interface AlarmaGrowatt {
  /** "AAAA-MM-DD HH:MM:SS", hora de la planta. */
  time: string;
  sn: string;
  modelo: string | null;
  /** Ej. "Error 203(00)". */
  codigo: string;
  /** Ej. "PV Isolation Low". */
  nombre: string;
  /** Lo que sugiere Growatt (en inglés). */
  solucion: string | null;
}

/** Las alarmas de una planta entre dos días (inclusive), de la más vieja a la más nueva. */
export async function alarmasPlanta(plantId: string, desde: string, hasta: string): Promise<AlarmaGrowatt[]> {
  const meses: string[] = [];
  for (let m = desde.slice(0, 7); m <= hasta.slice(0, 7); ) {
    meses.push(m);
    const [a, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`;
  }
  const out: AlarmaGrowatt[] = [];
  for (const mes of meses) {
    for (let pagina = 1, paginas = 1; pagina <= paginas && pagina <= 30; pagina++) {
      const obj = await pedir<{ pages?: number; datas?: Record<string, unknown>[] }>(
        "/log/getNewPlantFaultLog",
        { plantId, date: mes, type: "2", toPageNum: String(pagina), deviceSn: "", deviceFlag: "0" },
        "La web de Growatt no devolvió el registro de alarmas.",
      );
      paginas = obj.pages ?? 1;
      for (const d of obj.datas ?? []) {
        out.push({
          time: String(d.time ?? ""),
          sn: String(d.sn ?? d.deviceSn ?? ""),
          modelo: d.deviceModelName ? String(d.deviceModelName) : null,
          codigo: String(d.eventId ?? ""),
          nombre: String(d.eventName ?? ""),
          solucion: d.eventSolution || d.solution ? String(d.eventSolution || d.solution) : null,
        });
      }
    }
  }
  const fin = `${hasta} 23:59:59`;
  return out.filter((a) => a.time >= desde && a.time <= fin).sort((a, b) => a.time.localeCompare(b.time));
}

// ─── Visitantes (acceso del cliente a la aplicación del inversor) ─────────────
//
// Lo mismo que hace la web en Setting → Visitor Account list → Add (verificado
// el 28-oct-2026 al crear 'yramos'): la contraseña viaja TAL CUAL en `pwd` (la
// web no la cifra), `plantIds` con las plantas que ve, y la respuesta es
// {"result":1} o {"result":0,"msg":"…"}. Las reglas son las del JS de la página
// (addUserCheck): usuario sin caracteres especiales, contraseña ≥ 6, mail válido.

/** Caracteres que la web de Growatt no acepta en el usuario (los mismos de su JS). */
const ESPECIALES = /[`~!#$%^&*()+<>?:"{},/;'\\·！￥（）：；“”‘、，|《。》？【】\s]/;

export function validarVisitante(usuario: string, password: string, email: string): string | null {
  if (!usuario.trim()) return "Elegí un nombre de usuario.";
  if (usuario.trim().length < 3) return "El usuario tiene que tener al menos 3 caracteres.";
  if (ESPECIALES.test(usuario.trim())) return "El usuario no puede tener espacios ni caracteres especiales (solo letras, números, guion, guion bajo, punto o @).";
  if (password.length < 6) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Falta un mail válido.";
  return null;
}

/** true si el nombre de usuario ya existe en Growatt (en cualquier cuenta). */
export async function usuarioGrowattExiste(usuario: string): Promise<boolean> {
  await asegurarSesion();
  const r = await post("/userCenter.do", { action: "checkAccountExist", accountName: usuario.trim() });
  const t = (await r.text()).trim();
  return t === "true";
}

/**
 * Crea un visitante que ve solo `plantId`. Devuelve null si salió bien, o el
 * mensaje de Growatt si lo rechazó. No guarda la contraseña en ningún lado.
 */
export async function crearVisitanteGrowatt(p: {
  usuario: string;
  password: string;
  email: string;
  nombre: string;
  telefono?: string | null;
  plantId: string;
}): Promise<string | null> {
  const error = validarVisitante(p.usuario, p.password, p.email);
  if (error) return error;
  await asegurarSesion();
  const form = {
    accountName: p.usuario.trim(),
    pwd: p.password,
    // Mismo valor que dejó la web en las cuentas creadas a mano (no cambia las
    // horas de la planta, que van en el huso de la planta).
    timezone: "8",
    email: p.email.trim(),
    nickName: p.usuario.trim(),
    activeName: p.nombre.trim(),
    company: "",
    phone: (p.telefono ?? "").replace(/\D/g, ""),
    isSendPwd: "false",
    plantIds: p.plantId,
  };
  let r = await post("/set/addViewAccount", form);
  let j = (await r.json().catch(() => null)) as { result?: number; msg?: string } | null;
  if (!j) {
    // Sesión vencida: la web devuelve la página de login en vez de JSON.
    await login();
    r = await post("/set/addViewAccount", form);
    j = (await r.json().catch(() => null)) as { result?: number; msg?: string } | null;
  }
  if (j?.result === 1) return null;
  return j?.msg ? `Growatt rechazó el alta: ${j.msg}` : "Growatt no confirmó el alta.";
}
