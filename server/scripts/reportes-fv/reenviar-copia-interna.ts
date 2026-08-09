/**
 * Reenvía a una casilla interna una copia EXACTA del mail que se le mandó a un
 * cliente: mismo asunto, mismo cuerpo y el mismo PDF adjunto.
 *
 * Para qué existe: la copia oculta (REPORTES_FV_BCC) se configuró después de la
 * primera tanda de envíos, así que de esos reportes no quedó copia en ninguna
 * casilla. Esto permite ver cómo salieron sin tener que reenviárselos al
 * cliente.
 *
 * NO toca el estado del envío: no crea ReporteFvEnvio, no marca nada como
 * enviado y no vuelve a publicar en el portal. Es sólo un mail más.
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/reportes-fv/reenviar-copia-interna.ts <emisionId> [destino]
 *
 * Sin emisionId toma el último reporte enviado. El destino por defecto sale de
 * REPORTES_FV_BCC.
 */

import { prisma } from "../../src/lib/prisma.js";
import { sendEmail } from "../../src/services/email.service.js";
import {
  asuntoReporteFv,
  cuerpoHtmlReporteFv,
  cuerpoTextoReporteFv,
} from "../../src/services/reportesFv/emailBody.js";
import { regenerarPdfDesdeSnapshot } from "../../src/services/reportesFv/emision.service.js";
import { mesEs } from "../../src/services/reportesFv/format.js";
import { dateAPeriodo } from "../../src/services/reportesFv/periodo.js";

async function main() {
  const [emisionIdArg, destinoArg] = process.argv.slice(2);
  const destino = destinoArg || process.env.REPORTES_FV_BCC;

  if (!destino) {
    console.error("Falta el destino: pasalo como 2º argumento o seteá REPORTES_FV_BCC.");
    process.exit(1);
  }

  const emision = emisionIdArg
    ? await prisma.reporteFvEmision.findUnique({
        where: { id: emisionIdArg },
        include: { project: { select: { clientName: true } } },
      })
    : await prisma.reporteFvEmision.findFirst({
        where: { envios: { some: { esDryRun: false, estado: "ENVIADO" } } },
        orderBy: { enviadoEn: "desc" },
        include: { project: { select: { clientName: true } } },
      });

  if (!emision) {
    console.error("No se encontró la emisión.");
    process.exit(1);
  }

  const periodo = dateAPeriodo(emision.periodo);
  const mes = mesEs(periodo);
  const cliente = emision.project.clientName;

  // Desde el snapshot: es exactamente el PDF que recibió el cliente, aunque
  // después hayan cambiado las tarifas o la configuración.
  const pdf = await regenerarPdfDesdeSnapshot(emision.id);

  console.log(`Reenviando a ${destino} la copia del reporte de ${cliente} — ${mes}`);
  console.log(`  asunto: ${asuntoReporteFv(mes)}`);
  console.log(`  PDF: ${(pdf.length / 1024).toFixed(0)} KB`);

  const ok = await sendEmail({
    to: destino,
    subject: `[copia] ${asuntoReporteFv(mes)}`,
    html:
      `<p style="background:#fff8dc;padding:10px;border-left:3px solid #f2b705">` +
      `<strong>Copia interna.</strong> Así se ve el reporte que recibió ${cliente}. ` +
      `Este mail no se le mandó al cliente.</p>` +
      cuerpoHtmlReporteFv(cliente, mes),
    text: `[COPIA INTERNA — así lo recibió ${cliente}]\n\n${cuerpoTextoReporteFv(cliente, mes)}`,
    // La casilla es interna, pero el guardrail de "internal" exige que sea un
    // usuario de la app; con una casilla de dominio propio que no esté cargada
    // como usuario, el envío se bloquearía en silencio.
    type: "client_facing",
    attachments: [
      { filename: `reporte-fotovoltaico-${periodo}.pdf`, content: pdf, contentType: "application/pdf" },
    ],
  });

  console.log(ok ? "\n✅ Enviado." : "\n❌ El transporte SMTP lo rechazó.");
  process.exit(ok ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
