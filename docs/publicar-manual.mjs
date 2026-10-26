#!/usr/bin/env node
// Publica el PDF de un manual en Documentación (la intranet de Voltia PM).
//
//   node docs/publicar-manual.mjs <slug> <pdf> [--version X.Y]
//
// Es el último paso después de exportar el PDF del canvas:
//   1. copia el PDF a `server/manuales/` con el nombre que dice el manifiesto;
//   2. anota en `server/manuales/manuales.json` la versión y "qué cambió",
//      sacado del anexo «Registro de cambios» del .md del manual.
// Con el próximo deploy el server lo detecta (el PDF cambió), publica la versión
// nueva y avisa a la gente de los roles del manual. Ver
// server/src/services/documentacion/sincronizar-manuales.ts.
//
// La versión sale de la cabecera del .md («Versión 1.4 · del 22/10/26»), que es
// la que imprime la portada cuando el canvas se acaba de regenerar desde el .md.
// `--version` la fuerza (para un PDF viejo que no coincide con el .md de hoy).
// Igual el server lee la versión de la portada del PDF, que es la que manda.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirManuales = path.join(raiz, "server", "manuales");
const rutaManifiesto = path.join(dirManuales, "manuales.json");

const args = process.argv.slice(2);
const iVersion = args.indexOf("--version");
const versionForzada = iVersion >= 0 ? args[iVersion + 1] : null;
const [slug, pdf] = args.filter((_, i) => i !== iVersion && i !== iVersion + 1);

const manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, "utf8"));
if (!slug || !pdf) {
  console.error("Uso: node docs/publicar-manual.mjs <slug> <pdf> [--version X.Y]");
  console.error(`Slugs: ${manifiesto.map((e) => e.slug).join(", ")}`);
  process.exit(1);
}
const entrada = manifiesto.find((e) => e.slug === slug);
if (!entrada) {
  console.error(`No hay un manual «${slug}» en manuales.json. Slugs: ${manifiesto.map((e) => e.slug).join(", ")}`);
  process.exit(1);
}
if (!fs.existsSync(pdf)) {
  console.error(`No existe el archivo ${pdf}`);
  process.exit(1);
}

const md = entrada.fuente ? fs.readFileSync(path.join(raiz, entrada.fuente), "utf8") : "";
const version = versionForzada ?? md.match(/Versi[oó]n\s+(\d+(?:\.\d+)*)/i)?.[1];
if (!version) {
  console.error("No encontré la versión en la cabecera del .md: pasala con --version X.Y");
  process.exit(1);
}

// La fila de esa versión en el anexo: «| 1.4 | 22 de octubre de 2026 | Qué cambió |».
const anexo = md.split(/^##\s+Anexo\s+·\s+Registro de cambios/im)[1] ?? "";
const fila = anexo
  .split("\n")
  .map((l) => l.split("|").map((c) => c.trim()))
  .find((c) => c[1] === version);
const notas = fila?.[3] ?? null;

fs.copyFileSync(pdf, path.join(dirManuales, entrada.archivo));
entrada.version = version;
entrada.notas = { ...(entrada.notas ?? {}), ...(notas ? { [version]: notas } : {}) };
fs.writeFileSync(rutaManifiesto, `${JSON.stringify(manifiesto, null, 2)}\n`);

console.log(`✓ ${entrada.titulo} v${version} → server/manuales/${entrada.archivo}`);
console.log(notas ? `  Qué cambió: ${notas.slice(0, 120)}${notas.length > 120 ? "…" : ""}` : "  (sin entrada en el registro de cambios para esta versión)");
console.log("  Se publica en Documentación con el próximo deploy.");
