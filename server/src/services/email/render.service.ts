import Handlebars from "handlebars";
import type { EmailTemplate } from "@prisma/client";

import { buildEmailContext, emptyContext, type EmailTemplateContext } from "./context.service.js";
import { getTemplateByKey } from "./template.service.js";

export interface EmailOverrides {
  tecnica?: Partial<EmailTemplateContext["tecnica"]>;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
}

export interface PreparedEmail {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  context: EmailTemplateContext;
  missingVariables: string[];
}

// noEscape: el cuerpo es texto plano (no HTML), no queremos escapar los valores.
function render(tpl: string, context: EmailTemplateContext): string {
  if (!tpl) return "";
  return Handlebars.compile(tpl, { noEscape: true })(context);
}

// Resuelve una plantilla contra el contexto del proyecto, aplicando overrides
// manuales. NO envía: solo resuelve y devuelve (alimenta el preview en vivo).
export async function prepareEmail(params: {
  templateKey: string;
  projectId?: string;
  leadId?: string;
  overrides?: EmailOverrides;
}): Promise<PreparedEmail> {
  const template: EmailTemplate = await getTemplateByKey(params.templateKey);

  let context: EmailTemplateContext;
  let missingVariables: string[];
  if (params.projectId) {
    const built = await buildEmailContext(params.projectId);
    context = built.context;
    missingVariables = built.missingVariables;
  } else {
    context = emptyContext();
    missingVariables = [];
  }

  // Los overrides técnicos pisan el contexto derivado antes de renderizar.
  if (params.overrides?.tecnica) {
    context = { ...context, tecnica: { ...context.tecnica, ...params.overrides.tecnica } };
  }

  const ov = params.overrides ?? {};
  return {
    to: ov.to ?? render(template.toTemplate, context),
    cc: ov.cc ?? render(template.ccTemplate, context),
    bcc: ov.bcc ?? render(template.bccTemplate, context),
    subject: ov.subject ?? render(template.subjectTemplate, context),
    body: ov.body ?? render(template.bodyTemplate, context),
    context,
    missingVariables,
  };
}
