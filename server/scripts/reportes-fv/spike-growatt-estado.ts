/**
 * SPIKE (one-off, descartable) — ¿qué señales de estado/falla expone la Growatt
 * Open API v1?
 *
 * La API v1 NO tiene endpoint de alarmas (`inverter/alarm`, `device/fault` no
 * existen). Lo único que sabemos seguro es que `device/list` devuelve por
 * dispositivo `lost`, `status` y `last_update_time`, y que hoy los tiramos
 * (`client.ts:dataloggersSmartMeter` filtra `type === 3` y se queda sólo con el
 * datalogger_sn). Este script contesta si, además de eso, hay códigos de falla
 * usables.
 *
 * NO reusa `client.ts` a propósito: es código descartable que no debe tocar
 * producción, y además `device/tlx/tlx_last_data` es POST con form body, que el
 * `get()` de producción no sabe hacer.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/spike-growatt-estado.ts [plantId...]
 *
 * Sin argumentos elige 3 plantas de la base: una con status "1", una con "4" y
 * una vinculada a un proyecto sin fecha de habilitación.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE = process.env.GROWATT_API_BASE || "https://openapi.growatt.com/v1";
const TOKEN = process.env.GROWATT_API_TOKEN;
const PAUSA_MS = Number(process.env.REPORTES_FV_GROWATT_PAUSA_MS ?? 700);

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requests = 0;

interface Resultado {
  etiqueta: string;
  ok: boolean;
  data: any;
  error?: string;
  ms: number;
}

async function pedir(
  metodo: "GET" | "POST",
  endpoint: string,
  params: Record<string, string | number>,
): Promise<Resultado> {
  const etiqueta = `${metodo} ${endpoint} ${JSON.stringify(params)}`;
  const t0 = Date.now();
  requests++;
  try {
    const url = new URL(`${BASE}/${endpoint}`);
    let res: Response;
    if (metodo === "GET") {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      res = await fetch(url, { headers: { Token: TOKEN! } });
    } else {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) body.set(k, String(v));
      res = await fetch(url, {
        method: "POST",
        headers: { Token: TOKEN!, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    }
    const ms = Date.now() - t0;
    if (!res.ok) return { etiqueta, ok: false, data: null, error: `HTTP ${res.status}`, ms };
    const payload: any = await res.json();
    if (payload?.error_code !== 0 && payload?.error_code !== undefined) {
      return {
        etiqueta,
        ok: false,
        data: payload,
        error: `error_code=${payload.error_code} ${payload.error_msg ?? ""}`,
        ms,
      };
    }
    return { etiqueta, ok: true, data: payload?.data ?? payload, ms };
  } catch (err) {
    return {
      etiqueta,
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0,
    };
  } finally {
    await dormir(PAUSA_MS);
  }
}

/** Claves "interesantes" de un objeto anidado: las que hablan de estado o falla. */
const RE_INTERESANTE = /fault|warn|error|status|lost|derat|pid|update|alarm|time/i;

function clavesInteresantes(obj: any, prefijo = "", out: Array<[string, string]> = [], prof = 0) {
  if (obj == null || prof > 3) return out;
  if (Array.isArray(obj)) {
    // Sólo el primer elemento: alcanza para conocer la forma.
    if (obj.length > 0) clavesInteresantes(obj[0], `${prefijo}[0]`, out, prof + 1);
    return out;
  }
  if (typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const ruta = prefijo ? `${prefijo}.${k}` : k;
    if (v != null && typeof v === "object") {
      clavesInteresantes(v, ruta, out, prof + 1);
    } else if (RE_INTERESANTE.test(k)) {
      out.push([ruta, JSON.stringify(v)]);
    }
  }
  return out;
}

function volcar(r: Resultado) {
  console.log(`\n──── ${r.etiqueta}  [${r.ms} ms]`);
  if (!r.ok) {
    console.log(`  ✗ ${r.error}`);
    if (r.data) console.log(JSON.stringify(r.data, null, 2).slice(0, 1500));
    return;
  }
  console.log(JSON.stringify(r.data, null, 2).slice(0, 6000));
}

function ayer(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function elegirPlantas(): Promise<Array<{ plantId: string; nota: string }>> {
  const elegidas: Array<{ plantId: string; nota: string }> = [];
  const vistos = new Set<string>();

  const push = (plantId: bigint | null | undefined, nota: string) => {
    if (plantId == null) return;
    const s = String(plantId);
    if (vistos.has(s)) return;
    vistos.add(s);
    elegidas.push({ plantId: s, nota });
  };

  const conStatus1 = await prisma.growattPlant.findFirst({
    where: { status: "1", ignorada: false, projectId: { not: null } },
    orderBy: { plantId: "asc" },
  });
  push(conStatus1?.plantId, 'status="1" vinculada');

  const conStatus4 = await prisma.growattPlant.findFirst({
    where: { status: "4", ignorada: false },
    orderBy: { plantId: "asc" },
  });
  push(conStatus4?.plantId, 'status="4" (el código sin decodificar)');

  const sinHabilitar = await prisma.growattPlant.findFirst({
    where: {
      ignorada: false,
      projectId: { not: null },
      project: { postHabilitacionInicioEn: null, actualUteEnd: null },
    },
    orderBy: { plantId: "asc" },
  });
  push(sinHabilitar?.plantId, "vinculada a proyecto SIN fecha de habilitación");

  if (elegidas.length === 0) {
    const cualquiera = await prisma.growattPlant.findMany({ take: 2, orderBy: { plantId: "asc" } });
    for (const p of cualquiera) push(p.plantId, "fallback");
  }
  return elegidas;
}

async function main() {
  if (!TOKEN) {
    console.error("Falta GROWATT_API_TOKEN.");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const plantas =
    args.length > 0
      ? args.map((plantId) => ({ plantId, nota: "pasada por argumento" }))
      : await elegirPlantas();

  console.log("═".repeat(78));
  console.log("SPIKE Growatt — señales de estado y falla");
  console.log(`Base: ${BASE} · día evaluado: ${ayer()}`);
  console.log("Plantas:");
  for (const p of plantas) console.log(`  · ${p.plantId} — ${p.nota}`);
  console.log("═".repeat(78));

  const resumen: Array<{ planta: string; endpoint: string; claves: Array<[string, string]> }> = [];
  const tipos = new Map<number, number>();

  for (const { plantId, nota } of plantas) {
    console.log(`\n\n${"█".repeat(78)}\nPLANTA ${plantId} — ${nota}\n${"█".repeat(78)}`);

    const detalles = await pedir("GET", "plant/details", { plant_id: plantId });
    volcar(detalles);
    resumen.push({ planta: plantId, endpoint: "plant/details", claves: clavesInteresantes(detalles.data) });

    const datos = await pedir("GET", "plant/data", { plant_id: plantId });
    volcar(datos);
    resumen.push({ planta: plantId, endpoint: "plant/data", claves: clavesInteresantes(datos.data) });

    const potencia = await pedir("GET", "plant/power", { plant_id: plantId, date: ayer() });
    // La curva son ~288 puntos: sólo interesa si viene y cuántos son.
    if (potencia.ok) {
      const puntos: any[] = potencia.data?.powers ?? potencia.data?.datas ?? [];
      console.log(`\n──── GET plant/power [${potencia.ms} ms] → ${puntos.length} puntos`);
      console.log(JSON.stringify(puntos.slice(0, 3), null, 2));
      console.log(`  claves del payload: ${Object.keys(potencia.data ?? {}).join(", ")}`);
    } else {
      volcar(potencia);
    }

    const devices = await pedir("GET", "device/list", { plant_id: plantId });
    volcar(devices);
    resumen.push({ planta: plantId, endpoint: "device/list", claves: clavesInteresantes(devices.data) });

    const lista: any[] = devices.data?.devices ?? [];
    for (const d of lista) {
      const tipo = Number(d?.type);
      tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
    }

    // Detalle por inversor. type 3 = datalogger/otro, no es inversor.
    const inversores = lista.filter((d) => Number(d?.type) !== 3 && d?.device_sn);
    for (const inv of inversores.slice(0, 2)) {
      const sn = String(inv.device_sn);
      const tipo = Number(inv.type);
      console.log(`\n>>> inversor ${sn} (type=${tipo}, model=${inv.model ?? "?"})`);

      const info = await pedir("GET", "device/tlx/tlx_data_info", { device_sn: sn });
      volcar(info);
      resumen.push({ planta: plantId, endpoint: "tlx_data_info", claves: clavesInteresantes(info.data) });

      const last = await pedir("POST", "device/tlx/tlx_last_data", { tlx_sn: sn });
      volcar(last);
      resumen.push({ planta: plantId, endpoint: "tlx_last_data(POST)", claves: clavesInteresantes(last.data) });

      // ¿Acepta GET también? Cambia si hay que agregar post() a client.ts.
      const lastGet = await pedir("GET", "device/tlx/tlx_last_data", { tlx_sn: sn });
      console.log(
        `\n──── tlx_last_data por GET: ${lastGet.ok ? "FUNCIONA" : `no (${lastGet.error})`}`,
      );
    }
  }

  console.log(`\n\n${"═".repeat(78)}\nRESUMEN — claves de estado/falla encontradas\n${"═".repeat(78)}`);
  for (const r of resumen) {
    if (r.claves.length === 0) continue;
    console.log(`\n[${r.planta}] ${r.endpoint}`);
    for (const [k, v] of r.claves) console.log(`   ${k} = ${v}`);
  }

  console.log(`\nTipos de dispositivo vistos: ${[...tipos.entries()].map(([t, n]) => `${t}×${n}`).join(", ")}`);
  console.log(`Requests totales: ${requests} (pausa ${PAUSA_MS} ms)`);
  console.log(
    "\nPreguntas a contestar: ¿lost y last_update_time vienen frescos? ¿hay fault/warn code ≠ 0?" +
      " ¿hay texto legible? ¿sirve plant/power? ¿qué type tienen los inversores?",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
