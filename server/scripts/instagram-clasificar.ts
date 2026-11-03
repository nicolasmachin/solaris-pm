/**
 * Marca como potencial cliente (para que las vea Ventas) las conversaciones de
 * Instagram que ya existían: antes del 3-nov-2026 el asistente no las marcaba,
 * y en modo sombra no se guardaba nada. Le pregunta al asistente por cada una,
 * con las mismas instrucciones, y NO le manda nada a nadie. Guarda también el
 * celular si la persona lo dejó escrito. Cuesta centavos (Haiku).
 *
 * Sin --aplicar solo muestra qué haría.
 *   npx tsx scripts/instagram-clasificar.ts [--dias 30]
 *   npx tsx scripts/instagram-clasificar.ts --aplicar [--dias 30]
 */

import { prisma } from "../src/lib/prisma.js";
import { clasificarPotenciales } from "../src/services/instagram-marketing/privados.js";

const aplicar = process.argv.includes("--aplicar");
const i = process.argv.indexOf("--dias");
const dias = i > 0 ? Number(process.argv[i + 1]) : 30;
const r = await clasificarPotenciales({ aplicar, dias, log: (l) => console.log(l) });
console.log(
  `\n${aplicar ? "Hecho" : "Ensayo (nada guardado)"}: ${r.revisadas} conversaciones de los últimos ${dias} días, ` +
    `${r.potenciales} potenciales clientes, ${r.conCelular} con celular, ${r.errores} con error, US$ ${r.costoUsd.toFixed(4)}.`,
);
await prisma.$disconnect();
