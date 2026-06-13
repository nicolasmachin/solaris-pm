import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import {
  createEmailTemplate,
  deleteEmailTemplate,
  getEmailLogs,
  getEmailTemplate,
  getEmailTemplates,
  getSmtpConfig,
  prepareEmail,
  putSmtpConfig,
  sendEmail,
  testSmtpConfig,
  updateEmailTemplate,
  type EmailTemplateCreate,
  type EmailTemplateScope,
  type EmailTemplateUpdate,
  type PrepareEmailBody,
  type SendEmailBody,
  type SmtpConfigInput,
} from "../api/email.api";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// ─── SMTP del usuario ─────────────────────────────────────────────────────────

export function useSmtpConfig() {
  return useQuery({ queryKey: ["smtp-config"], queryFn: getSmtpConfig });
}

export function useSmtpMutations() {
  const qc = useQueryClient();

  const guardar = useMutation({
    mutationFn: (body: SmtpConfigInput) => putSmtpConfig(body),
    onSuccess: () => {
      toast.success("Configuración SMTP guardada");
      qc.invalidateQueries({ queryKey: ["smtp-config"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar la configuración"),
  });

  // El test devuelve { ok } — no es error HTTP; el toast lo maneja el caller.
  const probar = useMutation({
    mutationFn: (body?: SmtpConfigInput) => testSmtpConfig(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smtp-config"] }),
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo probar la conexión"),
  });

  return { guardar, probar };
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

export function useEmailTemplates(params?: { modulo?: string; scope?: EmailTemplateScope; activo?: boolean }) {
  return useQuery({
    queryKey: ["email-templates", params ?? {}],
    queryFn: () => getEmailTemplates(params),
  });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({
    queryKey: ["email-template", id],
    queryFn: () => getEmailTemplate(id!),
    enabled: !!id,
  });
}

export function useEmailTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["email-templates"] });

  const crear = useMutation({
    mutationFn: (body: EmailTemplateCreate) => createEmailTemplate(body),
    onSuccess: () => {
      toast.success("Plantilla creada");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo crear la plantilla"),
  });

  const editar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EmailTemplateUpdate }) => updateEmailTemplate(id, body),
    onSuccess: (_d, vars) => {
      toast.success("Plantilla actualizada");
      invalidate();
      qc.invalidateQueries({ queryKey: ["email-template", vars.id] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo actualizar la plantilla"),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar la plantilla"),
  });

  return { crear, editar, borrar };
}

// ─── Preparar / enviar / historial ────────────────────────────────────────────

export function usePrepareEmail() {
  return useMutation({
    mutationFn: (body: PrepareEmailBody) => prepareEmail(body),
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo preparar el mail"),
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendEmailBody) => sendEmail(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-logs"] }),
    // El caller maneja el error (puede ser SMTP_NOT_CONFIGURED → redirect).
  });
}

export function useEmailLogs(params?: { projectId?: string; leadId?: string; sentById?: string }) {
  return useQuery({
    queryKey: ["email-logs", params ?? {}],
    queryFn: () => getEmailLogs(params),
  });
}
