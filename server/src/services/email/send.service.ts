import { AuditAction, AuditEntityType, EmailStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { AppError, badRequest } from "../../utils/errors.js";
import { buildTransporter, getSmtpCredentials } from "./smtp.service.js";
import { redirectInDev } from "./dev-redirect.js";
import { renderEmailLayout } from "./layout.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CSV → lista de emails limpia (admite separar por coma o punto y coma).
function parseAddresses(csv: string | undefined | null): string[] {
  if (!csv) return [];
  return csv
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function validarDestinatarios(...grupos: string[][]): void {
  const todos = grupos.flat();
  const invalido = todos.find((a) => !EMAIL_RE.test(a));
  if (invalido) throw badRequest("INVALID_RECIPIENT", `Destinatario inválido: ${invalido}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Texto → HTML simple respetando el WYSIWYG del preview: rótulos de sección
// ("Datos …") y la etiqueta antes de ":" van en negrita; saltos de línea → <br>.
function bodyToHtml(text: string): string {
  const lines = text.split("\n").map((raw) => {
    const line = escapeHtml(raw);
    if (/^Datos\b/.test(raw.trim())) return `<strong>${line}</strong>`;
    const idx = line.indexOf(":");
    if (idx > 0) return `<strong>${line.slice(0, idx + 1)}</strong>${line.slice(idx + 1)}`;
    return line;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:normal;line-height:1.5">${lines.join("<br>")}</div>`;
}

export interface SendEmailInput {
  userId: string;
  templateKey?: string;
  projectId?: string;
  leadId?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}

export async function sendTemplatedEmail(input: SendEmailInput): Promise<{ id: string; status: "SENT" }> {
  const to = parseAddresses(input.to);
  const cc = parseAddresses(input.cc);
  const bcc = parseAddresses(input.bcc);

  if (to.length === 0) throw badRequest("INVALID_RECIPIENT", "Falta el destinatario (Para)");
  validarDestinatarios(to, cc, bcc);

  // Resolver templateId (best-effort) para el log.
  const template = input.templateKey
    ? await prisma.emailTemplate.findUnique({ where: { key: input.templateKey }, select: { id: true } })
    : null;

  // Credenciales del usuario (lanza SMTP_NOT_CONFIGURED si no hay).
  const creds = await getSmtpCredentials(input.userId);

  const fromName = creds.fromName ?? undefined;
  const from = fromName ? `${fromName} <${creds.username}>` : creds.username;

  async function registrar(status: EmailStatus, errorMessage?: string) {
    const log = await prisma.emailLog.create({
      data: {
        templateId: template?.id ?? null,
        templateKey: input.templateKey ?? null,
        projectId: input.projectId ?? null,
        leadId: input.leadId ?? null,
        sentById: input.userId,
        toAddresses: to.join(", "),
        ccAddresses: cc.length ? cc.join(", ") : null,
        bccAddresses: bcc.length ? bcc.join(", ") : null,
        subject: input.subject,
        status,
        errorMessage: errorMessage ?? null,
      },
    });
    // Auditoría siempre (SENT o FAILED).
    await createAuditEntry({
      entityType: AuditEntityType.email_log,
      entityId: log.id,
      projectId: input.projectId ?? null,
      userId: input.userId,
      action: AuditAction.email_sent,
      description:
        status === EmailStatus.SENT
          ? `Mail enviado: ${input.subject}`
          : `Mail falló: ${input.subject}`,
      newValue: status,
      metadata: { to: to.join(", "), cc: cc.join(", "), bcc: bcc.join(", ") },
    });
    return log;
  }

  try {
    const transporter = buildTransporter(creds);
    // En desarrollo, redirigir la entrega a la casilla de testing (el emailLog
    // de más abajo sigue registrando los destinatarios reales `to`/`cc`/`bcc`).
    const dest = redirectInDev({
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: input.subject,
      text: input.body,
      html: renderEmailLayout({
        title: input.subject,
        kicker: "Voltia PM",
        contentHtml: bodyToHtml(input.body),
      }),
    });
    await transporter.sendMail({
      from,
      to: dest.to,
      cc: dest.cc,
      bcc: dest.bcc,
      replyTo: creds.replyTo ?? undefined,
      subject: dest.subject,
      text: dest.text,
      html: dest.html,
    });
    const log = await registrar(EmailStatus.SENT);
    return { id: log.id, status: "SENT" };
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Error desconocido del SMTP";
    await registrar(EmailStatus.FAILED, message);
    throw new AppError(500, "SMTP_SEND_FAILED", message);
  }
}

export function listEmailLogs(filtros: {
  projectId?: string;
  leadId?: string;
  sentById?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filtros.page ?? 1);
  const limit = Math.min(100, Math.max(1, filtros.limit ?? 50));
  return prisma.emailLog.findMany({
    where: {
      ...(filtros.projectId ? { projectId: filtros.projectId } : {}),
      ...(filtros.leadId ? { leadId: filtros.leadId } : {}),
      ...(filtros.sentById ? { sentById: filtros.sentById } : {}),
    },
    orderBy: { sentAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
}
