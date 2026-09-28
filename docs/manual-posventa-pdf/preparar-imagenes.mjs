// Deja las fotos y las capturas en la medida exacta con que entran en la
// maqueta, antes de subirlas como assets del canvas. Corre en el contenedor
// `server`, que es el que tiene sharp.
//
//   docker compose cp docs/Fotos server:/app/fotos-src
//   docker compose exec -T -w /app server node preparar-imagenes.mjs fotos-src capturas-src /tmp/imgs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [fotos, capturas, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });

const foto = (n) => path.join(fotos, n);
const cap = (n) => path.join(capturas, `${n}.png`);
const sale = (n) => path.join(destino, n);

// 1. Portada: la banda superior mide 794×596, o sea 4:3 apaisado.
await sharp(foto("4031630_100DRONE_SING0768 (2).JPG"))
  .resize(1588, 1192, { fit: "cover", position: "centre" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(sale("portada.jpg"));

// 2. Portadillas: van de fondo a sangre bajo un velo azul, así que alcanza con
//    la proporción de la hoja y no hace falta resolución de imprenta.
const portadillas = {
  "portadilla-e1.jpg": "27962cb7-1540-462d-a8da-7992d3625d22.jpg", // estructura en obra
  "portadilla-e2.jpg": "3d951101-4fdb-425b-ac1b-af3deacce4f5.jpg", // techo terminado
  "portadilla-e3.jpg": "4d27a792-0c35-4aa3-84da-be8131220366.jpg", // atardecer, ya generando
};
for (const [out, src] of Object.entries(portadillas)) {
  await sharp(foto(src))
    .resize(900, 1273, { fit: "cover", position: "centre" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(sale(out));
}

// 3. Cierre: una banda apaisada para el final del manual.
await sharp(foto("cfee4bba-dd54-4d7f-a454-4863556e3643.jpg"))
  .resize(1300, 585, { fit: "cover", position: "centre" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(sale("cierre.jpg"));

// 4. El recorte de la ficha que entra en el hueco de la página 28: el
//    encabezado y el recorrido, sin el resto del scroll.
const fichaMeta = await sharp(cap("ficha-cliente")).metadata();
await sharp(cap("ficha-cliente"))
  .extract({ left: 0, top: 0, width: fichaMeta.width, height: Math.round(fichaMeta.width / 2.16) })
  .resize(1300)
  .png({ compressionLevel: 9 })
  .toFile(sale("ficha-encabezado.png"));

// 5. El portal se mira en modo previsualización, y eso deja una banda de aviso
//    arriba que en el manual solo confunde: se recorta.
const portalMeta = await sharp(cap("portal-cliente")).metadata();
const bandaAviso = Math.round(portalMeta.height * 0.043);
await sharp(cap("portal-cliente"))
  .extract({ left: 0, top: bandaAviso, width: portalMeta.width, height: portalMeta.height - bandaAviso })
  .resize(1400, null, { withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(sale("portal-cliente.png"));

// 6. Las capturas del anexo, a un ancho cómodo de lectura.
for (const n of ["ficha-cliente", "tramite-ute", "plantillas", "reportes-fv", "listado-clientes", "recorrido-etapas", "calendario", "pasos-e2"]) {
  await sharp(cap(n)).resize(1400, null, { withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(sale(`${n}.png`));
}

for (const f of fs.readdirSync(destino).sort()) {
  const m = await sharp(path.join(destino, f)).metadata();
  const kb = Math.round(fs.statSync(path.join(destino, f)).size / 1024);
  console.log(`${f.padEnd(26)} ${m.width}×${m.height}  ${kb} KB`);
}
