/**
 * SPIKE (one-off, descartable) — ¿sirve la Northbound API de Huawei FusionSolar
 * para monitorear las plantas Huawei como ya hacemos con las Growatt?
 *
 * Motivo: la Open API v1 de Growatt NO tiene endpoint de alarmas, así que hoy el
 * diagnóstico "inversor con falla" lo INFERIMOS (comunica pero no genera). La NBI
 * de Huawei sí expone `getAlarmList`, y el usuario `voltia_api` ya está creado
 * con la opción "Interfaces API básicas" prendida, que es la que las incluye.
 *
 * Preguntas que este script tiene que contestar:
 *   1. ¿Qué dominio regional atiende nuestra cuenta? (no lo sabemos: se prueban varios)
 *   2. ¿`stations` o el viejo `getStationList`? ¿Cuántas plantas devuelve?
 *   3. ¿`getAlarmList` trae códigos + texto legible, y en qué idioma?
 *   4. ¿`getKpiStationDay` da la generación día a día que necesita el monitor?
 *   5. ¿Cuál es el rate limit REAL? (la doc dice 1 llamada/5 min por interfaz;
 *      si fuera literal, condiciona todo el diseño del cron)
 *
 * No reusa nada de `growatt/client.ts`: es código descartable y el protocolo es
 * distinto (login con cookie XSRF, POST con JSON, errores con HTTP 200 + failCode).
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/spike-huawei-fusionsolar.ts
 *
 * Requiere en el .env de la raíz:
 *   HUAWEI_API_USER=voltia_api
 *   HUAWEI_API_PASSWORD=<la contraseña del usuario Northbound>
 *   HUAWEI_API_BASE=<opcional; si no está, se autodetecta>
 */

const USER = process.env.HUAWEI_API_USER;
const PASSWORD = process.env.HUAWEI_API_PASSWORD;

// FusionSolar particiona por región y la cuenta sólo existe en una. No sabemos
// cuál nos tocó, así que se prueban en orden de probabilidad para Uruguay.
const DOMINIOS_CANDIDATOS = [
  "https://la5.fusionsolar.huawei.com",
  "https://intl.fusionsolar.huawei.com",
  "https://sg5.fusionsolar.huawei.com",
  "https://eu5.fusionsolar.huawei.com",
  "https://uni003eu5.fusionsolar.huawei.com",
];

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requests = 0;
let token: string | null = null;
let base: string | null = null;

/** Los errores de FusionSolar vienen con HTTP 200 y `failCode` en el body. */
const FAIL_CODES: Record<number, string> = {
  0: "OK",
  20001: "el usuario no tiene permiso sobre ese recurso",
  20002: "el recurso no existe",
  20005: "parámetro inválido",
  305: "no autenticado (sesión vencida: hay que volver a loguear)",
  306: "el usuario no existe",
  307: "sesión inválida",
  401: "credenciales incorrectas",
  407: "RATE LIMIT: frecuencia de acceso a la interfaz demasiado alta",
  20400: "demasiadas estaciones en un solo request",
};

async function llamar(ruta: string, body: unknown): Promise<any> {
  requests++;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["XSRF-TOKEN"] = token;

  const t0 = Date.now();
  const res = await fetch(`${base}${ruta}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;

  // El token de sesión llega por cookie en el login, no en el body.
  const cookie = res.headers.get("set-cookie");
  const xsrf = cookie?.match(/XSRF-TOKEN=([^;]+)/)?.[1];
  if (xsrf) token = xsrf;

  const texto = await res.text();
  let data: any;
  try {
    data = JSON.parse(texto);
  } catch {
    data = { _noEsJson: texto.slice(0, 300) };
  }

  const fail = data?.failCode;
  const etiqueta =
    fail == null || fail === 0
      ? "ok"
      : `failCode ${fail} — ${FAIL_CODES[fail] ?? data?.message ?? "desconocido"}`;

  console.log(`\n▸ POST ${ruta}  [HTTP ${res.status} · ${ms} ms · ${etiqueta}]`);
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));

  return data;
}

/** Prueba el login contra cada dominio hasta que uno acepte las credenciales. */
async function detectarDominioYLoguear(): Promise<boolean> {
  const fijo = process.env.HUAWEI_API_BASE;
  const candidatos = fijo ? [fijo] : DOMINIOS_CANDIDATOS;

  for (const dominio of candidatos) {
    base = dominio;
    token = null;
    process.stdout.write(`Probando ${dominio} … `);
    try {
      const r = await llamar("/thirdData/login", { userName: USER, systemCode: PASSWORD });
      if (token) {
        console.log(`\n✅ DOMINIO CORRECTO: ${dominio}\n`);
        return true;
      }
      console.log(`   (sin token — failCode ${r?.failCode})`);
    } catch (e: any) {
      console.log(`   (error de red: ${e.message})`);
    }
    await dormir(1500);
  }
  return false;
}

async function main() {
  if (!USER || !PASSWORD) {
    console.error(
      "Faltan HUAWEI_API_USER / HUAWEI_API_PASSWORD en el .env de la raíz.\n" +
        "La contraseña es la del usuario Northbound (voltia_api), no la de tu login normal.",
    );
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("SPIKE — Huawei FusionSolar Northbound API");
  console.log("=".repeat(70));

  if (!(await detectarDominioYLoguear())) {
    console.error(
      "\n❌ Ningún dominio aceptó las credenciales.\n" +
        "   Revisá: (a) que la contraseña sea la del usuario Northbound,\n" +
        "   (b) el dominio que muestra tu navegador al entrar a FusionSolar\n" +
        "       (seteálo como HUAWEI_API_BASE y volvé a correr).",
    );
    process.exit(1);
  }

  // 1) Listado de plantas. El endpoint nuevo es `stations` (paginado);
  //    `getStationList` es el viejo y está deprecado pero suele seguir andando.
  const nuevas = await llamar("/thirdData/stations", { pageNo: 1, pageSize: 100 });
  await dormir(2000);
  const viejas = await llamar("/thirdData/getStationList", {});

  const lista: any[] =
    nuevas?.data?.list ?? (Array.isArray(viejas?.data) ? viejas.data : []) ?? [];
  const codigos = lista
    .map((s: any) => s.plantCode ?? s.stationCode)
    .filter(Boolean) as string[];

  console.log(`\n📍 Plantas detectadas: ${codigos.length}`);
  for (const s of lista) {
    console.log(
      `   · ${s.plantCode ?? s.stationCode} — ${s.plantName ?? s.stationName} ` +
        `(${s.capacity ?? s.stationLinkman ?? "?"} · ${s.plantAddress ?? s.stationAddr ?? ""})`,
    );
  }

  if (!codigos.length) {
    console.log("\n⚠️  Sin plantas: el usuario no tiene alcance asignado. Frenamos acá.");
    return;
  }

  const muestra = codigos.slice(0, 10).join(",");

  // 2) Dispositivos: para saber si hay inversor + medidor y con qué IDs.
  await dormir(2000);
  await llamar("/thirdData/getDevList", { stationCodes: muestra });

  // 3) LA PREGUNTA CLAVE: alarmas. Growatt no las tiene.
  await dormir(2000);
  const hasta = Date.now();
  const desde = hasta - 30 * 24 * 3600 * 1000;
  await llamar("/thirdData/getAlarmList", {
    stationCodes: muestra,
    beginTime: desde,
    endTime: hasta,
    language: "es_ES",
  });

  // 4) Generación día a día: es lo que alimenta el monitor y el gráfico del portal.
  await dormir(2000);
  await llamar("/thirdData/getKpiStationDay", { stationCodes: muestra, collectTime: hasta });

  // 5) Estado en tiempo real de la planta.
  await dormir(2000);
  await llamar("/thirdData/getStationRealKpi", { stationCodes: muestra });

  // 6) Rate limit real: dos llamadas seguidas sin pausa. Si la segunda da 407,
  //    la doc es literal y el cron hay que diseñarlo distinto.
  console.log("\n" + "=".repeat(70));
  console.log("PRUEBA DE RATE LIMIT — dos llamadas idénticas sin pausa");
  console.log("=".repeat(70));
  await llamar("/thirdData/getStationRealKpi", { stationCodes: muestra });
  await llamar("/thirdData/getStationRealKpi", { stationCodes: muestra });

  console.log("\n" + "=".repeat(70));
  console.log(`RESUMEN — dominio ${base} · ${codigos.length} plantas · ${requests} requests`);
  console.log("=".repeat(70));
  console.log(
    "Revisar arriba: (a) si getAlarmList trae texto legible en castellano,\n" +
      "(b) si getKpiStationDay da kWh por día, (c) si la última llamada dio 407.",
  );
}

main().catch((e) => {
  console.error("\n❌ El spike falló:", e);
  process.exit(1);
});
