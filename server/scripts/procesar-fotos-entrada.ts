// One-off de uso local: toma las fotos crudas de `server/scripts/fotos-materiales`
// (la bandeja de entrada, que NO se versiona) y escribe la versión ya procesada
// en `server/prisma/scripts/fotos-materiales` (que sí va al repo y viaja a prod).
//
//   docker compose exec server npx tsx scripts/procesar-fotos-entrada.ts IMG_3587.HEIC=sujetador-intermedio-paneles
import { promises as fs } from "node:fs";
import path from "node:path";
import { procesarFotoMaterial } from "../src/services/material-photo.service.js";

const ENTRADA = "/app/scripts/fotos-materiales";
const SALIDA = "/app/prisma/scripts/fotos-materiales";

const pares = process.argv.slice(2).map((a) => {
  const [origen, destino] = a.split("=");
  return { origen, destino };
});
if (pares.length === 0) throw new Error("Uso: <archivo.HEIC>=<nombre-destino-sin-extension> ...");

await fs.mkdir(SALIDA, { recursive: true });
for (const { origen, destino } of pares) {
  const buf = await fs.readFile(path.join(ENTRADA, origen));
  const out = await procesarFotoMaterial(buf, { filename: origen });
  await fs.writeFile(path.join(SALIDA, `${destino}.jpg`), out);
  console.log(`${origen} → ${destino}.jpg (${Math.round(out.length / 1024)} KB)`);
}
