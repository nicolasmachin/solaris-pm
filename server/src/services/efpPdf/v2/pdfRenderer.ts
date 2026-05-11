// Wrapper Puppeteer del generador EFP v2: HTML string → PDF Buffer.
// Reusa una sola instancia de browser entre requests para amortizar el costo
// de launch (~1s vs ~100ms al reusar). Cleanup ordenado en SIGTERM/SIGINT.

import puppeteer, { type Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // Memoiza la promise: si dos requests llegan en paralelo antes del primer
  // launch, ambos esperan al mismo browser. Si el browser ya cerró (.connected
  // = false), arrancamos uno nuevo.
  if (browserPromise) {
    const existing = await browserPromise;
    if (existing.connected) return existing;
    browserPromise = null; // browser muerto, re-lanzar abajo.
  }

  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });
  return browserPromise;
}

export type RenderOptions = {
  headerHtml: string;
  footerHtml: string;
};

export async function renderHtmlToPdf(
  html: string,
  options: RenderOptions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // networkidle0: espera a que toda la red termine. Si Google Fonts es
    // inalcanzable (sin internet) la página puede demorar — fallback: si
    // pasan 5s sin idle, igual rendereamos con el fallback del sistema.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 5000 }).catch(() => {
      // Silenciar timeout: con load+domcontentloaded basta para el render.
    });

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: options.headerHtml,
      footerTemplate: options.footerHtml,
      margin: {
        top: "22mm",
        right: "18mm",
        bottom: "22mm",
        left: "18mm",
      },
      preferCSSPageSize: false,
    });
    return Buffer.from(buffer);
  } finally {
    await page.close().catch(() => undefined);
  }
}

// Cleanup ordenado al apagar el server. Sin esto, Chromium queda zombie
// hasta que el container muera.
async function shutdownBrowser() {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // ignore
  }
  browserPromise = null;
}

process.once("SIGTERM", () => {
  void shutdownBrowser();
});
process.once("SIGINT", () => {
  void shutdownBrowser();
});
