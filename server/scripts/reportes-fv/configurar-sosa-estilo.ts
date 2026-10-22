/**
 * Deja listos (y APAGADOS) los reportes fotovoltaicos de Estilo (PRY-2026-001)
 * y de la casa de Rodolfo Sosa (PRY-2026-002), las dos plantas Huawei de la
 * familia Sosa.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/configurar-sosa-estilo.ts <email-usuario> [--aplicar]
 *
 * Fuentes (22-oct-2026):
 * - Estilo: factura UTE cuenta 0451476057 (ver configurar-estilo.ts). Se agregan
 *   los destinatarios y se borran las lecturas de los ciclos de julio y agosto,
 *   contaminadas por el transformador de corriente al revés hasta el 24-jul.
 * - Rodolfo: "datos.txt" del trámite UTE en Drive y la solicitud de aumento de
 *   potencia (jun-2026): cuenta 5133896646, Residencial Doble, 25 kW contratados,
 *   26 paneles de 630 W = 16,4 kWp, mail rodolfo.sosa@estilosrl.com. Inversión
 *   USD 20.000: la mitad de la venta conjunta, igual que Estilo. El día de corte
 *   queda vacío hasta tener una factura.
 *
 * Los dos quedan con habilitado = false: no entran en la emisión ni en el envío
 * automático hasta que alguien revise el primer reporte y los prenda.
 */

import { prisma } from "../../src/lib/prisma.js";
import { getConfigEfectiva, upsertConfig } from "../../src/services/reportesFv/config.service.js";

async function main() {
  const [email] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const aplicar = process.argv.includes("--aplicar");
  if (!email) throw new Error("Uso: configurar-sosa-estilo.ts <email-usuario> [--aplicar]");

  const usuario = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!usuario) throw new Error(`No existe el usuario ${email}`);
  const estilo = await prisma.project.findFirst({ where: { code: "PRY-2026-001" }, select: { id: true, clientName: true } });
  const rodolfo = await prisma.project.findFirst({ where: { code: "PRY-2026-002" }, select: { id: true, clientName: true } });
  if (!estilo || !rodolfo) throw new Error("No existen PRY-2026-001 / PRY-2026-002");

  const contaminadas = await prisma.reporteFvLectura.findMany({
    where: { projectId: estilo.id, periodo: { in: [new Date("2026-07-01"), new Date("2026-08-01")] } },
    select: { id: true, periodo: true },
  });
  console.log(`Estilo: ${contaminadas.length} lecturas a borrar (${contaminadas.map((l) => l.periodo.toISOString().slice(0, 7)).join(", ")})`);

  if (!aplicar) {
    console.log("Simulación. Correr con --aplicar para guardar.");
    return;
  }

  await prisma.reporteFvLectura.deleteMany({ where: { id: { in: contaminadas.map((l) => l.id) } } });

  await upsertConfig(
    estilo.id,
    {
      habilitado: false,
      destinatarios: [
        { email: "cristhian.sosa@estilosrl.com", nombre: "Cristhian Sosa" },
        { email: "rodolfo.sosa@estilosrl.com", nombre: "Rodolfo Sosa", esCopia: true },
      ],
    },
    usuario.id,
  );

  await upsertConfig(
    rodolfo.id,
    {
      habilitado: false,
      tipoCliente: "residencial",
      tarifaContratada: "doble",
      potenciaContratadaKw: 25,
      pctPunta: 0.15,
      pctLlano: 0.75,
      pctValle: 0.1,
      inversionUsd: 20000,
      potenciaInstaladaKwp: 16.4,
      // Habilitado por UTE el 2-jul-2026.
      mesInicio: "2026-07",
      origenDatos: "HUAWEI",
      destinatarios: [{ email: "rodolfo.sosa@estilosrl.com", nombre: "Rodolfo Sosa" }],
    },
    usuario.id,
  );

  for (const p of [estilo, rodolfo]) {
    const c = await getConfigEfectiva(p.id);
    console.log(p.clientName, {
      habilitado: c.habilitado, tipoCliente: c.tipoCliente, tarifa: c.tarifaContratada,
      potencia: c.potenciaContratadaKw, kwp: c.potenciaInstaladaKwp, inversionUsd: c.inversionUsd,
      corte: c.diaCorteMedidor, mesInicio: c.mesInicio, origen: c.origenDatos, bloqueos: c.bloqueosCalculo,
    });
  }
  const dest = await prisma.reporteFvDestinatario.findMany({
    where: { config: { projectId: { in: [estilo.id, rodolfo.id] } } },
    select: { email: true, esCopia: true, config: { select: { project: { select: { clientName: true } } } } },
  });
  console.log(dest.map((d) => `${d.config.project.clientName}: ${d.email}${d.esCopia ? " (copia)" : ""}`).join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
