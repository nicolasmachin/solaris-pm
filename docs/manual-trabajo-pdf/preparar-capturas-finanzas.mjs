// Las capturas del Manual de trabajo de Administración y Finanzas (las de
// capturas-finanzas.mjs, pantalla de 1440×1000 a 2x), recortadas y llevadas a
// 1600 de ancho para la maqueta. Los recortes van en px de la captura a 2x y se
// midieron sobre las pantallas del 21-nov-2026: si una cambia de lugar las
// cosas, hay que volver a medirlos. Corre en el contenedor `server` (sharp):
//
//   docker compose cp docs/manual-trabajo-pdf/preparar-capturas-finanzas.mjs server:/app/prep-fin.mjs
//   docker compose exec -T -w /app server node prep-fin.mjs /tmp/capturas-fin /tmp/imgs-fin
//
// Después se copian a imagenes/ y se anotan en capturas-finanzas.json y
// assets-locales.json (el id es el md5 del archivo).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [origen, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });

// Las de Finanzas: sin la barra de arriba, con el menú de Finanzas a la izquierda.
const FIN = { left: 0, top: 240, width: 2880, height: 1760 };
// Los detalles (un cliente, un proveedor): debajo del recuadro del aviso.
const DETALLE = { left: 0, top: 350, width: 2840, height: 1650 };
// Las de Experiencia Solar: sin la lista de clientes de la izquierda.
const ES = { left: 440, top: 240, width: 2440, height: 1760 };
// Las de Recursos Humanos: la columna del medio.
const RRHH = { left: 300, top: 240, width: 2280, height: 1760 };

const recortes = {
  "fin-inicio": FIN,
  "fin-cobros": FIN,
  "fin-cobro-detalle": DETALLE,
  "fin-facturacion": { ...FIN, height: 1560 },
  "fin-facturas-proveedores": FIN,
  "fin-proveedores": FIN,
  "fin-proveedor-detalle": DETALLE,
  "fin-instaladores": FIN,
  "fin-costos-fijos": FIN,
  "fin-comisiones": { ...FIN, height: 1700 },
  "fin-banco": FIN,
  "fin-tarjetas": FIN,
  "fin-movimientos": FIN,
  "fin-cuentas": FIN,
  "fin-flujo": FIN,
  // Corta: sin el menú de la izquierda, que quedaría cortado a la mitad.
  "fin-resultados": { left: 480, top: 340, width: 2360, height: 1040 },
  "fin-cierre": { ...FIN, height: 1700 },
  "fin-historial": FIN,
  "fin-es-cobros": ES,
  "fin-plan-granizo": { ...ES, height: 1640 },
  "rrhh-personas": RRHH,
  "rrhh-vencimientos": RRHH,
  "rrhh-licencias": { ...RRHH, height: 1280 },
  "rrhh-recibos": { ...RRHH, height: 700 },
  "rrhh-legajo": { left: 440, top: 260, width: 2000, height: 1740 },
  "rrhh-mi-legajo": { left: 560, top: 240, width: 2040, height: 1760 },
};

for (const [n, r] of Object.entries(recortes)) {
  const src = path.join(origen, `${n}.png`);
  if (!fs.existsSync(src)) {
    console.log(`  · falta ${n}`);
    continue;
  }
  await sharp(src).extract(r).resize(1600, null, { withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(destino, `${n}.jpg`));
}

for (const f of fs.readdirSync(destino).sort()) {
  const m = await sharp(path.join(destino, f)).metadata();
  const kb = Math.round(fs.statSync(path.join(destino, f)).size / 1024);
  console.log(`${f.padEnd(32)} ${m.width}×${m.height}  ${kb} KB`);
}
