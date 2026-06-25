// Wrapper Puppeteer del generador de propuestas v2: HTML string → PDF Buffer.
// Cada página del diseño ya es una hoja A4 full-bleed (794×1123px con su propio
// pie), así que se renderiza sin header/footer de Puppeteer y con margin 0.
// Reusa una sola instancia de browser entre requests para amortizar el launch.

import puppeteer, { type Browser } from "puppeteer";

import { renderProposalFull, renderProposalSummary, type RenderContext } from "./template.js";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise;
    if (existing.connected) return existing;
    browserPromise = null; // browser muerto, re-lanzar.
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

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Todo el contenido está embebido (estilos inline + logos base64), así que
    // networkidle resuelve rápido; el catch cubre cualquier espera espuria.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 5000 }).catch(() => undefined);
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
    });
    return Buffer.from(buffer);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function generateProposalFullPdf(ctx: RenderContext): Promise<Buffer> {
  return htmlToPdf(renderProposalFull(ctx));
}

export async function generateProposalSummaryPdf(ctx: RenderContext): Promise<Buffer> {
  return htmlToPdf(renderProposalSummary(ctx));
}

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

process.once("SIGTERM", shutdownBrowser);
process.once("SIGINT", shutdownBrowser);
