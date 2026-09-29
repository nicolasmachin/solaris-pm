// Deja las variantes del logo que usa la maqueta. Corre en el contenedor
// `server`, que tiene sharp:
//
//   docker compose exec -T -w /app server node preparar-logo.mjs logo-voltia.png /tmp/logos
//
// Tres variantes porque el manual tiene hojas blancas y hojas azules:
//   · completo  — la marca entera, para la portada y el cierre.
//   · isotipo   — solo la V, para el pie: el logo entero a 11 px de alto sería
//                 ilegible, y el pie ya dice "Voltia" en texto.
//   · isotipo blanco — el mismo, para los pies sobre fondo azul.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [origen, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });
const sale = (n) => path.join(destino, n);

const meta = await sharp(origen).metadata();
console.log(`origen: ${meta.width}×${meta.height}, alpha=${meta.hasAlpha}`);

// Completo, recortado al contenido real.
await sharp(origen).trim().resize({ width: 900 }).png({ compressionLevel: 9 }).toFile(sale("logo-completo.png"));

// El isotipo es la V: vive en la mitad de arriba.
// extract y trim van en pipelines separados: encadenados, sharp rechaza el área.
const recorte = await sharp(origen)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.62) })
  .toBuffer();
const arriba = await sharp(recorte).trim().toBuffer();
await sharp(arriba).resize({ height: 260 }).png({ compressionLevel: 9 }).toFile(sale("logo-isotipo.png"));

// El mismo isotipo en blanco, para los pies sobre azul: se tiñe usando su
// propio alpha como máscara, así no quedan bordes del color viejo.
// Hay que medir el buffer YA redimensionado: metadata() sobre el pipeline
// devuelve el tamaño del original y el lienzo sale de otra medida.
const isoBuf = await sharp(arriba).resize({ height: 260 }).png().toBuffer();
const { width: iw, height: ih } = await sharp(isoBuf).metadata();
await sharp({ create: { width: iw, height: ih, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: isoBuf, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(sale("logo-isotipo-blanco.png"));

for (const f of fs.readdirSync(destino).sort()) {
  const m = await sharp(path.join(destino, f)).metadata();
  console.log(`  ${f.padEnd(26)} ${m.width}×${m.height}`);
}
