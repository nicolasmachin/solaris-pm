import { apiClient } from "./axios";

// ─── Tipos (alineados al backend: server/src/services/email/*) ────────────────

export type EmailTemplateScope = "PROJECT" | "LEAD" | "GLOBAL";
export type EmailStatus = "SENT" | "FAILED";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string | null;
  replyTo: string | null;
  hasPassword: boolean;
  verifiedAt: string | null;
}

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string; // si se omite y ya había, se conserva
  fromName?: string | null;
  replyTo?: string | null;
}

export type SmtpTestResult = { ok: true } | { ok: false; error: string };

export interface EmailTemplate {
  id: string;
  key: string;
  nombre: string;
  descripcion: string | null;
  modulo: string;
  scope: EmailTemplateScope;
  toTemplate: string;
  ccTemplate: string;
  bccTemplate: string;
  subjectTemplate: string;
  bodyTemplate: string;
  activo: boolean;
  esSistema: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateCreate {
  key: string;
  nombre: string;
  descripcion?: string | null;
  modulo: string;
  scope: EmailTemplateScope;
  toTemplate?: string;
  ccTemplate?: string;
  bccTemplate?: string;
  subjectTemplate: string;
  bodyTemplate: string;
  activo?: boolean;
}

export type EmailTemplateUpdate = Partial<Omit<EmailTemplateCreate, "key">>;

// Contexto que devuelve `prepare` y que el cliente edita para el preview en vivo.
// ESPEJO de EmailTemplateContext del backend (server/src/services/email/
// context.service.ts). Si se agrega un campo allá hay que agregarlo acá: el
// preview del mail se renderiza en el navegador con este mismo objeto.
export interface EmailTemplateContext {
  cliente: {
    nombre: string;
    ci: string;
    telefono: string;
    email: string;
    esEmpresa: boolean;
    documento: string;
  };
  suministro: {
    departamento: string;
    localidad: string;
    calle: string;
    numero: string;
    cuenta: string;
    padron: string;
    duplicador: string;
    apartamento: string;
    avisoAcceso: string;
    notificaciones: string;
    notifCalle: string;
    notifNumero: string;
    notifDuplicador: string;
    notifApartamento: string;
    notifDepartamento: string;
    notifLocalidad: string;
  };
  tecnica: {
    tension: string;
    potenciaGenerador: string;
    potenciaContratada: string;
    tarifa: string;
    acometida: string;
    destino: string;
    pasaLinea: string;
    certificadoCarga: string;
    cargaPerturbadora: string;
    tensionNivel: string;
    tipoSolicitud: string;
    tramite: string;
    tramiteAsociado: string;
    requerimiento: string;
    tipoMedida: string;
    actividad: string;
    potenciaSolicitada: string;
    fases: string;
    dobleContratacion: string;
    potenciaPunta: string;
    instaladaCalefaccion: string;
    observaciones: string;
    esAumento: boolean;
  };
  firma: { nombre: string; cargo: string; telefono: string; email: string };
}

export interface PrepareEmailBody {
  templateKey: string;
  projectId?: string;
  leadId?: string;
  overrides?: {
    tecnica?: Partial<EmailTemplateContext["tecnica"]>;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
  };
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

export interface SendEmailBody {
  templateKey?: string;
  projectId?: string;
  leadId?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}

export interface EmailLog {
  id: string;
  templateId: string | null;
  templateKey: string | null;
  projectId: string | null;
  leadId: string | null;
  sentById: string;
  toAddresses: string;
  ccAddresses: string | null;
  bccAddresses: string | null;
  subject: string;
  status: EmailStatus;
  errorMessage: string | null;
  sentAt: string;
}

// ─── SMTP por usuario ─────────────────────────────────────────────────────────

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const { data } = await apiClient.get<SmtpConfig | null>("/api/me/smtp-config");
  return data;
}

export async function putSmtpConfig(body: SmtpConfigInput): Promise<SmtpConfig> {
  const { data } = await apiClient.put<SmtpConfig>("/api/me/smtp-config", body);
  return data;
}

export async function testSmtpConfig(body?: SmtpConfigInput): Promise<SmtpTestResult> {
  const { data } = await apiClient.post<SmtpTestResult>("/api/me/smtp-config/test", body ?? {});
  return data;
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

export async function getEmailTemplates(params?: {
  modulo?: string;
  scope?: EmailTemplateScope;
  activo?: boolean;
}): Promise<EmailTemplate[]> {
  const clean = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ""),
  );
  const { data } = await apiClient.get<EmailTemplate[]>("/api/email-templates", { params: clean });
  return data;
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const { data } = await apiClient.get<EmailTemplate>(`/api/email-templates/${id}`);
  return data;
}

export async function createEmailTemplate(body: EmailTemplateCreate): Promise<EmailTemplate> {
  const { data } = await apiClient.post<EmailTemplate>("/api/email-templates", body);
  return data;
}

export async function updateEmailTemplate(id: string, body: EmailTemplateUpdate): Promise<EmailTemplate> {
  const { data } = await apiClient.patch<EmailTemplate>(`/api/email-templates/${id}`, body);
  return data;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await apiClient.delete(`/api/email-templates/${id}`);
}

// ─── Preparar / enviar / historial ────────────────────────────────────────────

export async function prepareEmail(body: PrepareEmailBody): Promise<PreparedEmail> {
  const { data } = await apiClient.post<PreparedEmail>("/api/emails/prepare", body);
  return data;
}

export async function sendEmail(body: SendEmailBody): Promise<{ id: string; status: EmailStatus }> {
  const { data } = await apiClient.post<{ id: string; status: EmailStatus }>("/api/emails/send", body);
  return data;
}

export async function getEmailLogs(params?: {
  projectId?: string;
  leadId?: string;
  sentById?: string;
  page?: number;
  limit?: number;
}): Promise<EmailLog[]> {
  const clean = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ""),
  );
  const { data } = await apiClient.get<EmailLog[]>("/api/emails/logs", { params: clean });
  return data;
}
