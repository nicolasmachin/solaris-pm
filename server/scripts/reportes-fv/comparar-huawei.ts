/**
 * One-off: totales mensuales según la API de FusionSolar, para contrastarlos con
 * las lecturas que hoy están cargadas a mano en la base.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/comparar-huawei.ts 2026-05 2026-06 2026-07
 *
 * Suma el mes calendario. Si el generador tiene día de corte configurado, el
 * total de la app no tiene por qué coincidir exactamente con éste.
 */

const USER = process.env.HUAWEI_API_USER;
const PASSWORD = process.env.HUAWEI_API_PASSWORD;
const BASE = process.env.HUAWEI_API_BASE || "https://la5.fusionsolar.huawei.com";

const PLANTAS: Record<string, string> = {
  "NE=35882968": "BARENOF SA (Cidel)",
  "NE=36611488": "Jorge Alvarez",
  "NE=44559396": "Marianela Indart",
  "NE=55952858": "Alejandro Fiermarin",
  "NE=54778684": "ESTILO SRL",
  "NE=55650978": "Rodolfo Sosa",
};

let token: string | null = null;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llamar(ruta: string, body: unknown, intento = 1): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["XSRF-TOKEN"] = token;
  const res = await fetch(`${BASE}${ruta}`, { method: "POST", headers, body: JSON.stringify(body) });
  const xsrf = res.headers.get("set-cookie")?.match(/XSRF-TOKEN=([^;]+)/)?.[1];
  if (xsrf) token = xsrf;
  const data = await res.json();

  // 407 = frecuencia demasiado alta. Medido: con ~2 s entre llamadas no aparece.
  if (data?.failCode === 407 && intento <= 5) {
    await dormir(5000 * intento);
    return llamar(ruta, body, intento + 1);
  }
  return data;
}

function totalesDelMes(dias: any[]) {
  let gen = 0, consumo = 0, exportado = 0, importado = 0, conDatos = 0;
  for (const d of dias) {
    const m = d.dataItemMap ?? {};
    if (Object.keys(m).length === 0) continue;
    conDatos++;
    gen += Number(m.PVYield ?? m.inverterYield ?? 0);
    consumo += Number(m.use_power ?? 0);
    exportado += Number(m.ongrid_power ?? 0);
    importado += Number(m.buyPower ?? 0);
  }
  return { gen, consumo, exportado, importado, conDatos };
}

async function main() {
  const periodos = process.argv.slice(2);
  if (!periodos.length) {
    console.error("Uso: comparar-huawei.ts 2026-06 2026-07");
    process.exit(1);
  }

  await llamar("/thirdData/login", { userName: USER, systemCode: PASSWORD });
  if (!token) {
    console.error("No se pudo loguear. ¿HUAWEI_API_USER / HUAWEI_API_PASSWORD?");
    process.exit(1);
  }

  const codigos = Object.keys(PLANTAS).join(",");

  for (const periodo of periodos) {
    const [anio, mes] = periodo.split("-").map(Number);
    // Mediodía del día 15: cae inequívocamente dentro del mes en cualquier huso.
    const collectTime = Date.UTC(anio, mes - 1, 15, 12);

    await dormir(2500);
    const r = await llamar("/thirdData/getKpiStationDay", { stationCodes: codigos, collectTime });
    if (r?.failCode) {
      console.log(`\n${periodo}: ERROR failCode ${r.failCode} — ${r.data ?? r.message}`);
      continue;
    }

    const porPlanta = new Map<string, any[]>();
    for (const fila of r.data ?? []) {
      const arr = porPlanta.get(fila.stationCode) ?? [];
      arr.push(fila);
      porPlanta.set(fila.stationCode, arr);
    }

    console.log(`\n${"=".repeat(78)}\n${periodo}\n${"=".repeat(78)}`);
    console.log(
      "cliente".padEnd(24) +
        "gen".padStart(9) +
        "consumo".padStart(10) +
        "export".padStart(9) +
        "import".padStart(9) +
        "  días",
    );
    for (const [code, nombre] of Object.entries(PLANTAS)) {
      const t = totalesDelMes(porPlanta.get(code) ?? []);
      const dias = porPlanta.get(code)?.length ?? 0;
      console.log(
        nombre.padEnd(24) +
          t.gen.toFixed(0).padStart(9) +
          t.consumo.toFixed(0).padStart(10) +
          t.exportado.toFixed(0).padStart(9) +
          t.importado.toFixed(0).padStart(9) +
          `  ${t.conDatos}/${dias}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
