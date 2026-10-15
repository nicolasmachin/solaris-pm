/**
 * Configura el reporte fotovoltaico de Estilo SAS (PRY-2026-001, planta Huawei).
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/configurar-estilo.ts <email-usuario> [--aplicar]
 *
 * Datos de la factura de UTE de la cuenta 0451476057 (ciclo 16-ago a
 * 16-sep-2026): General Simple, 35 kW contratados, corte el 16. La inversión
 * (USD 20.000) es la mitad estimada de la venta conjunta con la casa de
 * Rodolfo Sosa, decidida por Nicolás el 15-oct-2026.
 *
 * Queda DESHABILITADO a propósito: así no entra en "Enviar pendientes" ni en el
 * envío automático hasta que alguien revise el primer reporte y lo habilite.
 */

import { prisma } from "../../src/lib/prisma.js";
import { getConfigEfectiva, upsertConfig } from "../../src/services/reportesFv/config.service.js";

async function main() {
  const [email] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const aplicar = process.argv.includes("--aplicar");
  if (!email) throw new Error("Uso: configurar-estilo.ts <email-usuario> [--aplicar]");

  const usuario = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!usuario) throw new Error(`No existe el usuario ${email}`);
  const proyecto = await prisma.project.findFirst({ where: { code: "PRY-2026-001" }, select: { id: true, clientName: true } });
  if (!proyecto) throw new Error("No existe PRY-2026-001");

  const antes = await getConfigEfectiva(proyecto.id).catch(() => null);
  console.log(`${proyecto.clientName} — antes:`, antes && {
    habilitado: antes.habilitado, tipoCliente: antes.tipoCliente, tarifa: antes.tarifaContratada,
    potencia: antes.potenciaContratadaKw, corte: antes.diaCorteMedidor, inversionUsd: antes.inversionUsd,
    kwp: antes.potenciaInstaladaKwp, mesInicio: antes.mesInicio, origen: antes.origenDatos,
  });

  if (!aplicar) {
    console.log("\nSimulación. Correr con --aplicar para guardar.");
    return;
  }

  await upsertConfig(
    proyecto.id,
    {
      habilitado: false,
      tipoCliente: "empresa",
      tarifaContratada: "general_simple",
      potenciaContratadaKw: 35,
      inversionUsd: 20000,
      potenciaInstaladaKwp: 18.6,
      diaCorteMedidor: 16,
      // Reparto por franja: no se usa en la General Simple (va por tramos), pero
      // la config lo exige. Mismo default que tenía.
      pctPunta: 0.1,
      pctLlano: 0.85,
      pctValle: 0.05,
      origenDatos: "HUAWEI",
    },
    usuario.id,
  );

  const despues = await getConfigEfectiva(proyecto.id);
  console.log("después:", {
    habilitado: despues.habilitado, tipoCliente: despues.tipoCliente, tarifa: despues.tarifaContratada,
    potencia: despues.potenciaContratadaKw, corte: despues.diaCorteMedidor, inversionUsd: despues.inversionUsd,
    kwp: despues.potenciaInstaladaKwp, mesInicio: despues.mesInicio, origen: despues.origenDatos, bloqueos: despues.bloqueosCalculo,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
