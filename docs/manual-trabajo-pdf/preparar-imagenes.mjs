// Deja las fotos y las capturas del Manual de Trabajo en la medida con que
// entran en la maqueta. Mismo criterio que docs/manual-posventa-pdf/
// preparar-imagenes.mjs, con fotos distintas para que los dos manuales no se
// vean iguales. Corre en el contenedor `server`, que tiene sharp:
//
//   docker compose cp docs/Fotos server:/app/fotos-src
//   docker compose cp docs/manual-trabajo-pdf/capturas server:/app/capturas-src
//   docker compose cp docs/manual-trabajo-pdf/preparar-imagenes.mjs server:/app/preparar-trabajo.mjs
//   docker compose exec -T -w /app server node preparar-trabajo.mjs fotos-src capturas-src /tmp/imgs-trabajo
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [fotos, capturas, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });

const foto = (n) => path.join(fotos, n);
const cap = (n) => path.join(capturas, `${n}.png`);
const sale = (n) => path.join(destino, n);

// 1. Portada: banda superior de 794×596.
await sharp(foto("IMG_4709.jpg"))
  .rotate()
  .resize(1588, 1192, { fit: "cover", position: "centre" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(sale("portada.jpg"));

// 2. Portadillas de las tres partes: de fondo bajo el velo azul.
const portadillas = {
  "portadilla-parte1.jpg": "5884253_100DRONE_SING0841.JPG", // dron, una fila a suelo
  "portadilla-parte2.jpg": "2f1b99bf-1dfa-4479-90e7-eaab5e9d1155.jpg", // techo rojo
  "portadilla-parte3.jpg": "IMG_20241104_112916.jpg", // azotea
};
for (const [out, src] of Object.entries(portadillas)) {
  await sharp(foto(src))
    .rotate()
    .resize(900, 1273, { fit: "cover", position: "centre" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(sale(out));
}

// 3. Cierre: banda apaisada.
await sharp(foto("984a5b02-f039-4270-b343-214cccf31a44.jpg"))
  .rotate()
  .resize(1300, 585, { fit: "cover", position: "centre" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(sale("cierre.jpg"));

// 4. Capturas: se saca la barra lateral de clientes (440 px del original a
//    2x), que en papel no dice nada, y se deja solo la parte que se explica.
const recortes = {
  proyecto: { left: 440, top: 100, width: 2440, height: 1560 },
  recorrido: { left: 440, top: 130, width: 2440, height: 1870 },
  gabinete: { left: 440, top: 890, width: 2440, height: 1110 },
};
for (const [n, r] of Object.entries(recortes)) {
  await sharp(cap(n)).extract(r).resize(1400).png({ compressionLevel: 9 }).toFile(sale(`${n}.png`));
}

for (const f of fs.readdirSync(destino).sort()) {
  const m = await sharp(path.join(destino, f)).metadata();
  const kb = Math.round(fs.statSync(path.join(destino, f)).size / 1024);
  console.log(`${f.padEnd(26)} ${m.width}×${m.height}  ${kb} KB`);
}
