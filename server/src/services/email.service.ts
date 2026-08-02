import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { redirectInDev } from "./email/dev-redirect.js";
import { isFullHtmlDoc, renderEmailLayout } from "./email/layout.js";

/**
 * Servicio de envío de email.
 *
 * GUARDRAIL DE SEGURIDAD:
 * Por defecto, sendEmail() solo permite enviar a emails que existan en la
 * tabla `users` (usuarios internos de Voltia). Para enviar a destinatarios
 * externos (clientes, proveedores), hay que pasar explícitamente
 * `type: 'client_facing'`.
 *
 * Este guardrail existe para evitar que código nuevo o generado por IA lea
 * por error campos como `clientEmail` o similares y mande info interna a
 * clientes externos.
 *
 * Historia: en mayo 2026 hubo un incidente donde el campo
 * `notificationEmail` (que en realidad tenía emails de clientes) se usó
 * para enviar notificaciones internas. Llegaron mails con info interna a
 * 27 clientes. El guardrail previene que vuelva a pasar: el campo se
 * renombró a `clientEmail` y todo envío "interno" valida que el
 * destinatario sea un User.
 */

export type EmailType = "internal" | "client_facing";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  type?: EmailType;
  attachments?: EmailAttachment[];
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, type = "internal" } = params;
  const destinatarios = Array.isArray(to) ? to : [to];

  if (type === "internal") {
    // El guardrail exige que TODOS los destinatarios sean usuarios internos.
    const users = await prisma.user.findMany({
      where: { email: { in: destinatarios }, deletedAt: null },
      select: { email: true },
    });
    const internos = new Set(users.map((u) => u.email));
    const externos = destinatarios.filter((e) => !internos.has(e));
    if (externos.length > 0) {
      console.error(
        `[email] BLOQUEADO: ${externos.join(", ")} no ${externos.length === 1 ? "es usuario interno" : "son usuarios internos"}. ` +
          `Para enviar a externos usar type: 'client_facing' explícitamente.`,
      );
      return false;
    }
  } else {
    console.log(`[email] Envío client_facing a ${destinatarios.join(", ")}`);
  }

  if (!process.env.SMTP_HOST) {
    console.warn("[email] SMTP no configurado, omitiendo envío");
    return false;
  }

  try {
    const transporter = getTransporter();
    // En desarrollo, redirigir la entrega a la casilla de testing. El guardrail
    // interno de arriba ya validó el destinatario real; acá solo cambia a dónde
    // se entrega efectivamente.
    // Formato de marca para TODOS los mails: si el html no es ya un documento
    // completo (algunas plantillas ricas lo son), se envuelve en el layout
    // compartido usando el subject como título/referencia.
    const brandedHtml = isFullHtmlDoc(params.html)
      ? params.html
      : renderEmailLayout({ title: params.subject, contentHtml: params.html });
    const dest = redirectInDev({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      html: brandedHtml,
      text: params.text,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: dest.to,
      cc: dest.cc,
      bcc: dest.bcc,
      subject: dest.subject,
      html: dest.html,
      text: dest.text,
      attachments: params.attachments,
    });

    console.log(
      `[email] Enviado a ${Array.isArray(dest.to) ? dest.to.join(", ") : dest.to}: ${params.subject}` +
        `${params.attachments?.length ? ` (+${params.attachments.length} adjunto)` : ""}`,
    );
    return true;
  } catch (err) {
    console.error(`[email] Error enviando a ${params.to}:`, err);
    return false;
  }
}
