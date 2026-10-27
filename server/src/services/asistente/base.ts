// Base de conocimiento del asistente del equipo.
//
// Son los Markdown de `server/conocimiento/` (README explica qué es cada uno).
// Viven dentro de `server/` para que viajen en la imagen del server al
// deployar, igual que `server/manuales/`.
//
// Se leen en cada consulta: son unos pocos cientos de KB y así una corrección
// de la base se ve en el próximo mensaje sin reiniciar nada. El contenido sale
// siempre en el mismo orden, byte a byte, para que el caché de prompts de la
// API lo reconozca entre consultas.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/services/asistente → server/conocimiento (y lo mismo desde dist/).
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../conocimiento");

/** Orden de lectura: primero las reglas y los temas, después las fuentes largas. */
const ORDEN = [
  "README.md",
  "01-criterios-y-tono.md",
  "02-ute-y-microgeneracion.md",
  "03-generacion-y-ahorro.md",
  "04-equipos.md",
  "05-techos-y-montaje.md",
  "06-precio-pago-financiacion.md",
  "07-garantias-mantenimiento-granizo.md",
  "08-obra-plazos-y-costos-aparte.md",
  "cifras-vigentes.md",
  "pendientes.md",
];
const AL_FINAL = ["enciclopedia.md", "enciclopedia-tecnica.md"];

function listar(): string[] {
  if (!fs.existsSync(DIR)) return [];
  const raiz = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
  const resto = raiz.filter((f) => !ORDEN.includes(f) && !AL_FINAL.includes(f)).sort();
  const casosDir = path.join(DIR, "casos");
  const casos = fs.existsSync(casosDir)
    ? fs.readdirSync(casosDir).filter((f) => f.endsWith(".md")).sort().map((f) => `casos/${f}`)
    : [];
  return [...ORDEN.filter((f) => raiz.includes(f)), ...resto, ...casos, ...AL_FINAL.filter((f) => raiz.includes(f))];
}

function leer(archivo: string): string {
  return fs.readFileSync(path.join(DIR, archivo), "utf8").trim();
}

/**
 * Las enciclopedias son el 70 % de la base y casi nunca hacen falta enteras:
 * van al prompt solo con su índice de secciones, y el asistente abre la que
 * necesita con la herramienta `leer_enciclopedia`. Cargarlas siempre triplicaba
 * el costo de cada consulta.
 */
export const ENCICLOPEDIAS = AL_FINAL;

function indice(archivo: string): string {
  return leer(archivo)
    .split("\n")
    .filter((l) => /^#{2,3} /.test(l))
    .join("\n");
}

/** La base como un solo texto: los archivos enteros y las enciclopedias por índice. */
export function leerBase(): string {
  const partes = listar().map((archivo) => {
    if (ENCICLOPEDIAS.includes(archivo)) {
      return (
        `<archivo nombre="${archivo}" contenido="solo el índice: abrir secciones con la herramienta leer_enciclopedia">\n` +
        `${indice(archivo)}\n</archivo>`
      );
    }
    return `<archivo nombre="${archivo}">\n${leer(archivo)}\n</archivo>`;
  });
  return partes.join("\n\n");
}

/**
 * Una sección de una enciclopedia, por su número ("6") o su título ("Precio,
 * markup"). Sin sección, devuelve el archivo entero.
 */
export function leerEnciclopedia(archivo: string, seccion?: string): string {
  if (!ENCICLOPEDIAS.includes(archivo)) return `No existe la enciclopedia "${archivo}".`;
  const texto = leer(archivo);
  const buscado = seccion?.trim().toLowerCase();
  if (!buscado) return texto;

  // Secciones de primer nivel ("## 6. Precio…"): de un título al siguiente.
  const bloques = texto.split(/\n(?=## )/);
  const porNumero = /^\d+$/.test(buscado)
    ? bloques.find((b) => new RegExp(`^## ${buscado}[.\\s]`).test(b))
    : undefined;
  const hallado = porNumero ?? bloques.find((b) => b.split("\n")[0].toLowerCase().includes(buscado));
  return hallado ?? `No encontré la sección "${seccion}" en ${archivo}. Mirá el índice y probá con el número.`;
}
