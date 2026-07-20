import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { redirectInDev } from "./email/dev-redirect.js";

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

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type?: EmailType;
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

  if (type === "internal") {
    const user = await prisma.user.findFirst({
      where: { email: to, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      console.error(
        `[email] BLOQUEADO: ${to} no es usuario interno. ` +
          `Para enviar a externos usar type: 'client_facing' explícitamente.`,
      );
      return false;
    }
  } else {
    console.log(`[email] Envío client_facing a ${to}`);
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
    const dest = redirectInDev({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: dest.to,
      subject: dest.subject,
      html: dest.html,
      text: dest.text,
    });

    console.log(
      `[email] Enviado a ${Array.isArray(dest.to) ? dest.to.join(", ") : dest.to}` +
        `${dest.to === params.to ? "" : ` (original: ${params.to})`}: ${params.subject}`,
    );
    return true;
  } catch (err) {
    console.error(`[email] Error enviando a ${params.to}:`, err);
    return false;
  }
}
