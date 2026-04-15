import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  if (!process.env.SMTP_HOST) {
    console.warn("[email] SMTP no configurado, omitiendo envío");
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log(`[email] Enviado a ${params.to}: ${params.subject}`);
    return true;
  } catch (err) {
    console.error(`[email] Error enviando a ${params.to}:`, err);
    return false;
  }
}
