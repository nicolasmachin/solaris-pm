// Las capturas del Manual de trabajo de Operaciones: todo el módulo de
// Proyectos de Voltia PM (lista, proyecto, panel de cada etapa de Operaciones,
// documentos, fotos, pestañas), el calendario con su reprogramación y los pagos
// a instaladores. Corre en el contenedor `server`, igual que capturas.mjs:
//
//   IP=$(docker compose exec -T client hostname -i)
//   docker compose cp docs/manual-trabajo-pdf/capturas-operaciones.mjs server:/app/capturas-ops.mjs
//   docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas-ops.mjs /tmp/capturas-ops
//
// Nada de lo que hace modifica datos: abre pantallas, paneles y diálogos, y los
// cierra con Cancelar o Escape.
import fs from "node:fs";
import net from "node:net";
import puppeteer from "puppeteer";

const destino = process.argv[2] || "/tmp/capturas-ops";
// Un proyecto con obra hecha: fotos, documentos y fecha confirmada.
const PROYECTO = process.env.CAPTURA_PROYECTO || "cmoisqa3s00evqx0i9z3ripko";
const FRONT = process.env.CAPTURA_FRONT || "172.18.0.2:5173";
const BASE = "http://127.0.0.1:5173";
const USER = process.env.CAPTURA_USER || "admin@voltiapm.com";
const PASS = process.env.CAPTURA_PASS || "Y1025Voltia";

fs.mkdirSync(destino, { recursive: true });

const [frontHost, frontPort] = FRONT.split(":");
const proxy = net.createServer((cliente) => {
  const arriba = net.connect(Number(frontPort), frontHost, () => cliente.pipe(arriba).pipe(cliente));
  arriba.on("error", () => cliente.destroy());
  cliente.on("error", () => arriba.destroy());
});
await new Promise((r) => proxy.listen(5173, "127.0.0.1", r));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.type("#email", USER);
await page.type("#password", PASS);
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}),
]);
await esperar(4000);
if (page.url().includes("/login")) {
  console.error("NO ENTRÓ");
  await browser.close();
  proxy.close();
  process.exit(1);
}
await page.evaluate(() => localStorage.setItem("voltia-theme", "light"));

async function cerrarAvisos() {
  // Un traspaso pendiente abre un aviso encima de todo: "Cancelar" no confirma nada.
  for (let i = 0; i < 3; i++) {
    const cerro = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Cancelar");
      if (!b) return false;
      b.click();
      return true;
    });
    if (!cerro) break;
    await esperar(800);
  }
}

async function abrir(url, espera = 4500) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60000 });
  await esperar(espera);
  await cerrarAvisos();
  // La barra de arriba es fija: en los recortes de una sección quedaba pintada
  // encima. Se la deja en su lugar para la captura.
  await page.addStyleTag({ content: "header, nav, [class*='sticky'] { position: relative !important; top: auto !important; }" });
}

async function guardar(nombre, opciones = {}) {
  await page.screenshot({ path: `${destino}/${nombre}.png`, ...opciones });
  console.log(`  ✓ ${nombre}`);
}

// La caja de la sección que contiene un texto: sube desde el texto hasta el
// primer contenedor ancho con borde o fondo propio. Devuelve el recorte en
// coordenadas de la página, con un margen.
async function cajaDe(texto, { minAlto = 120, margen = 12 } = {}) {
  return page.evaluate(
    (t, minAlto, margen) => {
      const hojas = [...document.querySelectorAll("h1,h2,h3,h4,span,div,p,button")].filter(
        (x) => x.childElementCount === 0 && x.textContent?.trim().startsWith(t),
      );
      const el = hojas[0];
      if (!el) return null;
      let n = el;
      while (n && n !== document.body) {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        const tieneCaja = cs.borderTopWidth !== "0px" || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
        if (r.width > 560 && r.height >= minAlto && tieneCaja) break;
        n = n.parentElement;
      }
      if (!n || n === document.body) return null;
      n.scrollIntoView({ block: "start" });
      const r = n.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - margen),
        y: Math.max(0, r.top + window.scrollY - margen),
        width: Math.min(r.width + 2 * margen, document.documentElement.clientWidth),
        height: Math.min(r.height + 2 * margen, 2400),
      };
    },
    texto,
    minAlto,
    margen,
  );
}

async function seccion(nombre, texto, opciones) {
  const caja = await cajaDe(texto, opciones);
  if (!caja) {
    console.log(`  · no encontré "${texto}"`);
    return;
  }
  await esperar(900);
  await guardar(nombre, { clip: caja, captureBeyondViewport: true });
}

async function clic(texto, { exacto = false, selector = "button" } = {}) {
  const ok = await page.evaluate(
    (t, exacto, selector) => {
      const b = [...document.querySelectorAll(selector)].find((x) => {
        const s = x.textContent?.trim() ?? "";
        return exacto ? s === t : s.startsWith(t);
      });
      if (!b) return false;
      b.scrollIntoView({ block: "center" });
      b.click();
      return true;
    },
    texto,
    exacto,
    selector,
  );
  await esperar(2200);
  return ok;
}

async function intentar(nombre, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${nombre}:`, e.message);
  }
}

// 1. La lista de proyectos.
await intentar("lista", async () => {
  await abrir("/projects");
  await guardar("ops-lista-proyectos");
});

// 2. El proyecto: encabezado, recorrido, documentos, obra.
await intentar("proyecto", async () => {
  await abrir(`/projects/${PROYECTO}`);
  await guardar("ops-proyecto-encabezado", { clip: { x: 0, y: 0, width: 1440, height: 640 } });
  await seccion("ops-proyecto-recorrido", "Pipeline de etapas");
  await seccion("ops-proyecto-documentos-ute", "Documentos UTE generados", { minAlto: 80 });
  await seccion("ops-proyecto-obra", "Obra del proyecto");
});

// 3. El panel de cada etapa de Operaciones, con sus subetapas.
for (const [archivo, etapa] of [
  ["ops-panel-validacion", "Validación de Operaciones"],
  ["ops-panel-compras", "Compras"],
  ["ops-panel-obra", "Ejecución de Obra"],
]) {
  await intentar(archivo, async () => {
    await abrir(`/projects/${PROYECTO}`);
    // La tarjeta de la etapa en el recorrido: el texto "N. Nombre".
    const ok = await page.evaluate((et) => {
      // El título de la tarjeta: "3." va en un span aparte y el nombre en otro.
      const t = [...document.querySelectorAll("*")].find((x) => {
        const s = x.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return x.childElementCount <= 2 && new RegExp(`^\\d+\\.\\s*${et}$`).test(s);
      });
      if (!t) return false;
      t.scrollIntoView({ block: "center" });
      let n = t;
      while (n && n !== document.body && getComputedStyle(n).cursor !== "pointer") n = n.parentElement;
      (n && n !== document.body ? n : t).click();
      return true;
    }, etapa);
    await esperar(2500);
    if (!ok) {
      console.log(`  · no encontré la tarjeta ${etapa}`);
      return;
    }
    await guardar(archivo);
    await page.keyboard.press("Escape");
    await esperar(800);
  });
}

// 4. El checklist de fotos.
await intentar("checklist-fotos", async () => {
  await abrir(`/projects/${PROYECTO}`);
  if (await clic("Checklist de fotos")) await guardar("ops-checklist-fotos");
  else console.log("  · no encontré Checklist de fotos");
  await page.keyboard.press("Escape");
});

// 5. Las pestañas de abajo del proyecto.
for (const [archivo, pestana, ancla] of [
  ["ops-pestana-compras", "Compras", "Compras"],
  ["ops-pestana-materiales", "Materiales", "Materiales"],
  ["ops-pestana-costos", "Costos", "Costos"],
  ["ops-pestana-comentarios", "Comentarios", "Comentarios"],
]) {
  await intentar(archivo, async () => {
    await abrir(`/projects/${PROYECTO}`);
    if (!(await clic(pestana, { exacto: true }))) {
      console.log(`  · no encontré la pestaña ${pestana}`);
      return;
    }
    await esperar(1500);
    // La pestaña activa y lo que muestra debajo, hasta 900 px.
    const caja = await page.evaluate((t) => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === t);
      if (!b) return null;
      b.scrollIntoView({ block: "start" });
      const r = b.getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.top + window.scrollY - 24), width: 1440, height: 900 };
    }, ancla);
    if (caja) await guardar(archivo, { clip: caja, captureBeyondViewport: true });
  });
}

// 6. El calendario: el mes en curso, el detalle de una obra confirmada y el
//    diálogo de reprogramar, que pide el motivo. Se cierra con Cancelar.
await intentar("calendario", async () => {
  await abrir("/calendario");
  await guardar("ops-calendario-mes");
  const abrio = await page.evaluate(() => {
    const ev = [...document.querySelectorAll("[title]")].find(
      (x) => !x.getAttribute("title").includes("Fecha tentativa") && x.getAttribute("title").includes("·"),
    );
    if (!ev) return false;
    ev.click();
    return true;
  });
  await esperar(2000);
  if (!abrio) {
    console.log("  · no encontré una obra confirmada en el mes");
    return;
  }
  await guardar("ops-calendario-detalle");
  if (await clic("Reprogramar")) {
    await guardar("ops-calendario-reprogramar");
    await clic("Cancelar", { exacto: true });
  } else console.log("  · no encontré Reprogramar");
});

// 7. Los pagos a instaladores.
await intentar("pagos", async () => {
  await abrir("/pagos-instalador");
  await guardar("ops-pagos-instalador");
});

await browser.close();
proxy.close();
