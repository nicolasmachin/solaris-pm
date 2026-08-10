import cron from "node-cron";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";

/**
 * Envío programado del resumen de novedades de la app al equipo.
 *
 * Corre los LUNES y JUEVES a las 07:00 (hora Uruguay) y manda un mail con las
 * novedades de los últimos días, tomadas del CHANGELOG público de la app
 * (`/CHANGELOG.md`, el mismo que alimenta el "Novedades" del footer). Ventana:
 *  - Lunes: desde el jueves anterior (últimos 4 días).
 *  - Jueves: desde el lunes anterior (últimos 3 días).
 * Si no hubo novedades en la ventana, no manda nada.
 *
 * Destinatarios: un grupo fijo del equipo (por nombre) + Nicolás. Se puede
 * sobrescribir con NOVEDADES_RECIPIENTS (emails separados por coma).
 */

const CHANGELOG_URL =
  process.env.CHANGELOG_URL || "https://app.voltia.com.uy/CHANGELOG.md";

// Grupo del equipo (nombre completo normalizado). Se resuelven sus emails desde
// la tabla users en cada corrida (así un cambio de email se toma solo).
const NOMBRES_EQUIPO = [
  "july correa",
  "gabriel vera",
  "luna toja",
  "martin garcia",
  "gonzalo ingold",
  "alejandra yañez",
];
const SIEMPRE = ["nmachin@voltia.com.uy"];

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Paleta de marca
const AZUL = "#0055A4";
const NAVY = "#00306B";
const AZUL_TINT = "#F1F6FC";
const PAGE = "#E4ECF7";
const AMARILLO = "#FFC400";

interface SeccionNov {
  titulo: string;
  bullets: string[];
}
interface DiaNov {
  dateStr: string; // "10 de agosto de 2026"
  ymd: string; // "2026-08-10"
  secciones: SeccionNov[];
}

// --- Fechas en hora de Uruguay ---
function mvYmd(d: Date): string {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}
function addDays(ymd: string, days: number): string {
  const d = ymdToUtcMidnight(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Parsea "10 de agosto de 2026" -> "2026-08-10" (o null).
function parseSpanishDate(s: string): string | null {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(norm(s));
  if (!m) return null;
  const dia = Number(m[1]);
  const mesIdx = MESES.indexOf(m[2]);
  const anio = Number(m[3]);
  if (mesIdx < 0) return null;
  const mm = String(mesIdx + 1).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${anio}-${mm}-${dd}`;
}

// Extrae del markdown los días con novedades dentro de [desdeYmd, hastaYmd].
// Deduplica secciones por (ymd + título) porque una misma fecha puede repetirse
// en dos bloques de versión.
function parseChangelog(md: string, desdeYmd: string, hastaYmd: string): DiaNov[] {
  const lines = md.split(/\r?\n/);
  const dias = new Map<string, DiaNov>();
  const vistos = new Set<string>(); // ymd|titulo
  let curYmd: string | null = null;
  let curInWindow = false;
  let curSection: SeccionNov | null = null;

  const closeSection = () => {
    if (curYmd && curInWindow && curSection && curSection.bullets.length > 0) {
      const key = `${curYmd}|${norm(curSection.titulo)}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        let dia = dias.get(curYmd);
        if (!dia) {
          dia = { dateStr: "", ymd: curYmd, secciones: [] };
          dias.set(curYmd, dia);
        }
        dia.secciones.push(curSection);
      }
    }
    curSection = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line) && !/^####\s+/.test(line)) {
      closeSection();
      const label = line.replace(/^###\s+/, "").trim();
      const ymd = parseSpanishDate(label);
      curYmd = ymd;
      curInWindow = !!ymd && ymd >= desdeYmd && ymd <= hastaYmd;
      if (curYmd && curInWindow) {
        const dia = dias.get(curYmd);
        if (dia && !dia.dateStr) dia.dateStr = label;
        else if (!dia) dias.set(curYmd, { dateStr: label, ymd: curYmd, secciones: [] });
      }
    } else if (/^####\s+/.test(line)) {
      closeSection();
      curSection = { titulo: line.replace(/^####\s+/, "").trim(), bullets: [] };
    } else if (/^\s*-\s+/.test(line)) {
      if (curSection) curSection.bullets.push(line.replace(/^\s*-\s+/, "").trim());
    } else if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
      // cabecera de versión o título: cierra sección, la fecha sigue vigente
      closeSection();
    }
  }
  closeSection();

  return [...dias.values()]
    .filter((d) => d.secciones.length > 0)
    .sort((a, b) => (a.ymd < b.ymd ? 1 : -1)); // más reciente primero
}

// Convierte **negrita** y `código` simple del markdown a HTML seguro.
function mdInline(s: string): string {
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<span style=\"font-family:monospace\">$1</span>");
}

function rangoTexto(desdeYmd: string, hastaYmd: string): string {
  const d = ymdToUtcMidnight(desdeYmd);
  const h = ymdToUtcMidnight(hastaYmd);
  const dd = d.getUTCDate();
  const hd = h.getUTCDate();
  const dMes = MESES[d.getUTCMonth()];
  const hMes = MESES[h.getUTCMonth()];
  if (dMes === hMes) return `del ${dd} al ${hd} de ${hMes}`;
  return `del ${dd} de ${dMes} al ${hd} de ${hMes}`;
}

function buildHtml(dias: DiaNov[], desdeYmd: string, hastaYmd: string): string {
  const bloques = dias
    .map((dia) => {
      const secciones = dia.secciones
        .map((sec) => {
          const bullets = sec.bullets
            .map(
              (b) =>
                `<li style="margin:5px 0;color:#334155;font-size:13px;line-height:1.5">${mdInline(b)}</li>`,
            )
            .join("");
          return `
            <div style="margin:12px 0 0">
              <div style="font-size:14px;font-weight:700;color:${NAVY};margin:0 0 2px">${mdInline(sec.titulo)}</div>
              <ul style="margin:4px 0 0 18px;padding:0">${bullets}</ul>
            </div>`;
        })
        .join("");
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:separate">
          <tr><td style="border-left:4px solid ${AZUL};background:${AZUL_TINT};border-radius:10px;padding:14px 18px">
            <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${AZUL}">${dia.dateStr}</div>
            ${secciones}
          </td></tr>
        </table>`;
    })
    .join("");

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light">
<title>Novedades de Voltia PM</title></head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #D4E1F1;">
      <tr><td style="background:${AZUL};padding:22px 32px;">
        <span style="font-size:17px;font-weight:800;letter-spacing:.16em;color:#ffffff;text-transform:uppercase;">VOLTIA <span style="color:${AMARILLO};">PM</span></span>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:${AMARILLO};">&nbsp;</td></tr>
      <tr><td style="padding:26px 32px 6px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${AZUL};margin:0 0 8px;">Novedades ${rangoTexto(desdeYmd, hastaYmd)}</div>
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:${NAVY};font-weight:800;">Lo nuevo en Voltia PM</h1>
        <p style="font-size:14px;color:#44556B;line-height:1.6;margin:0;">Un repaso rápido de lo que se sumó a la app estos días.</p>
      </td></tr>
      <tr><td style="padding:2px 32px 8px;">${bloques}</td></tr>
      <tr><td style="padding:6px 32px 24px;">
        <p style="font-size:13px;color:#44556B;line-height:1.6;margin:10px 0 0;">El detalle completo está en <strong style="color:${NAVY}">Novedades</strong> dentro de la app.</p>
      </td></tr>
      <tr><td style="background:${NAVY};padding:18px 32px;">
        <div style="font-size:16px;font-weight:800;letter-spacing:.14em;color:#ffffff;text-transform:uppercase;">VOLTIA <span style="color:${AMARILLO};">PM</span></div>
        <div style="font-size:12px;color:#A9C2E4;margin-top:6px;">Energía solar · Uruguay</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function resolverDestinatarios(): Promise<string[]> {
  const override = process.env.NOVEDADES_RECIPIENTS;
  if (override && override.trim()) {
    return [...new Set(override.split(",").map((e) => e.trim()).filter(Boolean))];
  }
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: { not: "CLIENT" } } },
    select: { name: true, email: true },
  });
  const set = new Set<string>(SIEMPRE);
  for (const u of users) {
    if (NOMBRES_EQUIPO.includes(norm(u.name))) set.add(u.email);
  }
  return [...set];
}

// Ventana según el día (hora Uruguay). Lunes: 4 días atrás (jueves). Jueves: 3
// (lunes). Otro día (corrida manual): 3 días.
function ventana(hoyYmd: string): { desde: string; hasta: string } {
  const dow = ymdToUtcMidnight(hoyYmd).getUTCDay(); // 1=lun ... 4=jue
  const back = dow === 1 ? 4 : dow === 4 ? 3 : 3;
  return { desde: addDays(hoyYmd, -back), hasta: hoyYmd };
}

export async function enviarNovedades(now: Date = new Date()): Promise<boolean> {
  const hoy = mvYmd(now);

  // Fecha de inicio del envío automático (para no disparar el mismo día que se
  // instala, evitando duplicar un envío manual). Si no está seteada, no aplica.
  const startYmd = process.env.NOVEDADES_START_YMD;
  if (startYmd && hoy < startYmd) {
    console.log(`[novedades] antes de la fecha de inicio (${startYmd}); no se envía.`);
    return false;
  }

  const { desde, hasta } = ventana(hoy);

  let md: string;
  try {
    const res = await fetch(CHANGELOG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    md = await res.text();
  } catch (err) {
    console.error("[novedades] no se pudo leer el CHANGELOG:", err);
    return false;
  }

  const dias = parseChangelog(md, desde, hasta);
  if (dias.length === 0) {
    console.log(`[novedades] sin novedades entre ${desde} y ${hasta}; no se envía.`);
    return false;
  }

  const destinatarios = await resolverDestinatarios();
  if (destinatarios.length === 0) {
    console.warn("[novedades] no hay destinatarios resueltos; no se envía.");
    return false;
  }

  const html = buildHtml(dias, desde, hasta);
  const ok = await sendEmail({
    to: "nmachin@voltia.com.uy",
    bcc: destinatarios.filter((e) => e !== "nmachin@voltia.com.uy"),
    type: "client_facing",
    subject: `Novedades de Voltia PM — ${rangoTexto(desde, hasta)}`,
    html,
  });
  console.log(
    `[novedades] ${ok ? "enviado" : "FALLÓ"} a ${destinatarios.length} destinatarios (${dias.length} días con novedades).`,
  );
  return ok;
}

export function startNovedadesJob() {
  // Lunes y jueves a las 07:00 hora Uruguay.
  const expr = process.env.CRON_NOVEDADES || "0 7 * * 1,4";
  return cron.schedule(
    expr,
    () => {
      enviarNovedades().catch((err) =>
        console.error("[novedades] error en la corrida:", err),
      );
    },
    { timezone: "America/Montevideo" },
  );
}
