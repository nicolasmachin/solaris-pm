import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, FileSpreadsheet, Send, Sparkles, Upload } from "lucide-react";

import { getProject } from "../api/projects.api";
import { useAuthStore } from "../store/auth.store";
import { useEmailTemplates, usePrepareEmail, useSendEmail } from "../hooks/useEmail";
import { useUteExtract } from "../hooks/useUteExtract";
import { UteExtractModal } from "../components/projects/UteExtractModal";
import type { EmailTemplate, EmailTemplateContext } from "../api/email.api";
import { RecipientChips } from "../components/email/RecipientChips";
import { bodyToHtml, renderTemplate } from "../components/email/renderMailBody";
import { ACCEPT_FOTOS_Y_PDF } from "../utils/fileAccept";
import {
  OPCIONES_UTE,
  SUMINISTRO_TEMPLATE_KEY,
  enviarSuministroIndividual,
  potenciasPara,
  previewFormularioSuministro,
} from "../api/uteSuministro.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";
const seccion = "border-t border-dashed border-[var(--color-border)] pt-3";

function splitCsv(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

/** Select que nunca pierde un valor fuera de la lista: lo agrega como opción. */
function Select({
  label,
  value,
  opciones,
  onChange,
  requerido,
}: {
  label: string;
  value: string;
  opciones: readonly string[];
  onChange: (v: string) => void;
  requerido?: boolean;
}) {
  const falta = requerido && !value.trim();
  return (
    <div>
      <label className={lbl}>
        {label} {requerido && <span className="text-red-500">*</span>}
      </label>
      <select
        className={`${inp}${falta ? " border-red-500" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!opciones.includes(value) && <option value={value}>{value || "(elegir)"}</option>}
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o || "(sin especificar)"}
          </option>
        ))}
      </select>
    </div>
  );
}

function Texto({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input className={inp} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function SuministroIndividualUte() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const { data: templates } = useEmailTemplates({ activo: true });
  const template: EmailTemplate | undefined = useMemo(
    () => templates?.find((t) => t.key === SUMINISTRO_TEMPLATE_KEY),
    [templates],
  );

  const prepare = usePrepareEmail();
  const send = useSendEmail();
  const extractor = useUteExtract(projectId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [ctx, setCtx] = useState<EmailTemplateContext | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [bajando, setBajando] = useState(false);

  // El contexto que llega del servidor mezcla vocabularios: `pasaLinea` viene
  // con el default de la consulta de microgenerador ("No corresponde"), que NO
  // es un valor válido del formulario de UTE. Se normaliza al entrar para que
  // el asesor no mande un formulario que UTE va a rechazar.
  function normalizar(context: EmailTemplateContext): EmailTemplateContext {
    const pasaLinea = OPCIONES_UTE.pasaLinea.includes(
      context.tecnica.pasaLinea as (typeof OPCIONES_UTE.pasaLinea)[number],
    )
      ? context.tecnica.pasaLinea
      : "No Declara";
    return { ...context, tecnica: { ...context.tecnica, pasaLinea } };
  }

  function seed(context: EmailTemplateContext) {
    setCtx(normalizar(context));
    if (template) {
      setTo(splitCsv(renderTemplate(template.toTemplate, context)));
      setCc(splitCsv(renderTemplate(template.ccTemplate, context)));
      setBcc(splitCsv(renderTemplate(template.bccTemplate, context)));
    }
    setSubjectOverride(null);
  }

  useEffect(() => {
    if (!projectId || !template || ready) return;
    prepare.mutate(
      { templateKey: SUMINISTRO_TEMPLATE_KEY, projectId },
      {
        onSuccess: (res) => {
          seed(res.context);
          setReady(true);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, template]);

  // Tras confirmar la factura UTE (que completa cuenta, tarifa y potencia),
  // se vuelve a preparar para refrescar el formulario con los datos nuevos.
  const prevConfirming = useRef(false);
  useEffect(() => {
    if (prevConfirming.current && !extractor.isConfirming && !extractor.modalOpen) {
      prepare.mutate(
        { templateKey: SUMINISTRO_TEMPLATE_KEY, projectId },
        { onSuccess: (res) => seed(res.context) },
      );
    }
    prevConfirming.current = extractor.isConfirming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractor.isConfirming, extractor.modalOpen]);

  function setCliente<K extends keyof EmailTemplateContext["cliente"]>(
    k: K,
    v: EmailTemplateContext["cliente"][K],
  ) {
    setCtx((c) => (c ? { ...c, cliente: { ...c.cliente, [k]: v } } : c));
  }
  function setSum<K extends keyof EmailTemplateContext["suministro"]>(k: K, v: string) {
    setCtx((c) => (c ? { ...c, suministro: { ...c.suministro, [k]: v } } : c));
  }
  function setTec<K extends keyof EmailTemplateContext["tecnica"]>(
    k: K,
    v: EmailTemplateContext["tecnica"][K],
  ) {
    setCtx((c) => (c ? { ...c, tecnica: { ...c.tecnica, [k]: v } } : c));
  }

  // Cambiar las fases cambia los escalones de potencia admitidos: si la
  // potencia elegida no existe en la lista nueva, se limpia en vez de mandar
  // un valor que UTE no acepta.
  function setFases(fases: string) {
    setCtx((c) => {
      if (!c) return c;
      const admitidas = potenciasPara(fases);
      const potencia = admitidas.includes(c.tecnica.potenciaSolicitada)
        ? c.tecnica.potenciaSolicitada
        : "";
      return { ...c, tecnica: { ...c.tecnica, fases, potenciaSolicitada: potencia } };
    });
  }

  // El modo cambia el asunto y, por conveniencia, el trámite que corresponde.
  function setModo(esAumento: boolean) {
    setCtx((c) =>
      c
        ? {
            ...c,
            tecnica: {
              ...c.tecnica,
              esAumento,
              tramite: esAumento ? "Aumento" : "Nuevo Servicio",
            },
          }
        : c,
    );
    setSubjectOverride(null);
  }

  function onPickFactura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) extractor.uploadAndExtract(file, "factura_ute");
    if (fileRef.current) fileRef.current.value = "";
  }

  const subject = ctx ? (subjectOverride ?? renderTemplate(template?.subjectTemplate ?? "", ctx)) : "";
  const bodyText = ctx ? renderTemplate(template?.bodyTemplate ?? "", ctx) : "";
  const potenciaVacia = !ctx?.tecnica.potenciaSolicitada.trim();

  async function onVerFormulario() {
    if (!ctx) return;
    setBajando(true);
    try {
      const { blob, filename } = await previewFormularioSuministro(projectId, ctx);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el formulario");
    } finally {
      setBajando(false);
    }
  }

  async function onEnviar() {
    if (!ctx) return;
    if (to.length === 0) {
      toast.error("Falta el destinatario (Para)");
      return;
    }
    if (potenciaVacia) {
      toast.error("Elegí la potencia solicitada (obligatoria)");
      return;
    }
    setEnviando(true);
    try {
      await enviarSuministroIndividual(projectId, {
        to: to.join(", "),
        cc: cc.join(", "),
        bcc: bcc.join(", "),
        subject,
        body: bodyText,
        context: ctx,
      });
      toast.success(
        ctx.tecnica.esAumento ? "Solicitud de aumento enviada a UTE" : "Solicitud enviada a UTE",
      );
      navigate(-1);
    } catch (err) {
      const data = (err as { response?: { data?: { code?: string; message?: string } } })?.response
        ?.data;
      if (data?.code === "SMTP_NOT_CONFIGURED") {
        toast.error("Configurá tu servidor SMTP primero");
        navigate("/settings");
      } else {
        toast.error(data?.message ?? "No se pudo enviar la solicitud");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!ready || !ctx) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
        {template ? "Preparando la solicitud…" : "Cargando plantilla…"}
      </div>
    );
  }

  const potencias = potenciasPara(ctx.tecnica.fases);
  const contratadaHoy = ctx.tecnica.potenciaContratada.trim();

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-3 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>
      <h1 className="mb-1 text-lg font-bold text-[var(--color-text-primary)]">
        {project?.clientName ?? ctx.cliente.nombre} ·{" "}
        {ctx.tecnica.esAumento ? "Aumento de potencia contratada" : "Solicitud de suministro"}
      </h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
        {/* ─── Formulario ─── */}
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div>
            <label className={lbl}>Tipo de trámite</label>
            <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]">
              {[
                { k: true, t: "Aumento de potencia" },
                { k: false, t: "Solicitud de suministro" },
              ].map((o) => (
                <button
                  key={o.t}
                  onClick={() => setModo(o.k)}
                  className={`px-4 py-1.5 text-sm font-medium ${
                    ctx.tecnica.esAumento === o.k
                      ? "bg-[var(--color-accent)] text-black"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          {/* Carga de factura UTE (IA) */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-3 py-2.5">
            <Sparkles className="h-5 w-5 flex-shrink-0 text-[var(--color-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Cargar factura UTE
              </p>
              <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {project?.facturaUtePath
                  ? "Ya hay una factura cargada y sus datos ya están abajo. Subí otra para reemplazar."
                  : "La IA lee la factura y completa cuenta, tarifa y potencia contratada."}
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={extractor.isExtracting}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />{" "}
              {extractor.isExtracting ? "Leyendo…" : project?.facturaUtePath ? "Reemplazar" : "Cargar factura"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_FOTOS_Y_PDF}
              className="hidden"
              onChange={onPickFactura}
            />
          </div>

          <div className={seccion}>
            <p className={`${lbl} mb-2`}>Destinatarios</p>
            <div className="space-y-2">
              <div>
                <label className={lbl}>Para</label>
                <RecipientChips value={to} onChange={setTo} placeholder="comercial@ute.com.uy" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Cc</label>
                  <RecipientChips value={cc} onChange={setCc} />
                </div>
                <div>
                  <label className={lbl}>Cco (cliente)</label>
                  <RecipientChips value={bcc} onChange={setBcc} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Asunto</label>
            <input className={inp} value={subject} onChange={(e) => setSubjectOverride(e.target.value)} />
          </div>

          {/* ─── Datos del suministro ─── */}
          <div className={seccion}>
            <p className={`${lbl} mb-2`}>Datos del suministro</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Departamento"
                  value={ctx.suministro.departamento}
                  opciones={OPCIONES_UTE.departamento}
                  onChange={(v) => setSum("departamento", v)}
                />
                <Texto
                  label="Localidad"
                  value={ctx.suministro.localidad}
                  onChange={(v) => setSum("localidad", v)}
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <Texto label="Calle" value={ctx.suministro.calle} onChange={(v) => setSum("calle", v)} />
                </div>
                <Texto label="Nro." value={ctx.suministro.numero} onChange={(v) => setSum("numero", v)} />
                <Texto
                  label="Duplic."
                  value={ctx.suministro.duplicador}
                  onChange={(v) => setSum("duplicador", v)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Texto
                  label="Apartamento"
                  value={ctx.suministro.apartamento}
                  onChange={(v) => setSum("apartamento", v)}
                />
                <div className="col-span-2">
                  <Texto
                    label="Padrón / Nro. medidor vecino"
                    value={ctx.suministro.padron}
                    onChange={(v) => setSum("padron", v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Texto
                  label="Aviso de acceso / esquina"
                  value={ctx.suministro.avisoAcceso}
                  onChange={(v) => setSum("avisoAcceso", v)}
                  placeholder="Ej: Esquina José María Paz"
                />
                <Select
                  label="Notificaciones a esta dirección"
                  value={ctx.suministro.notificaciones}
                  opciones={OPCIONES_UTE.siNo}
                  onChange={(v) => setSum("notificaciones", v)}
                />
              </div>
            </div>
          </div>

          {/* Dirección alternativa: solo si NO recibe en la del suministro */}
          {ctx.suministro.notificaciones === "No" && (
            <div className={seccion}>
              <p className={`${lbl} mb-2`}>Dirección de envío de notificaciones</p>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Texto
                      label="Calle"
                      value={ctx.suministro.notifCalle}
                      onChange={(v) => setSum("notifCalle", v)}
                    />
                  </div>
                  <Texto
                    label="Nro."
                    value={ctx.suministro.notifNumero}
                    onChange={(v) => setSum("notifNumero", v)}
                  />
                  <Texto
                    label="Apto."
                    value={ctx.suministro.notifApartamento}
                    onChange={(v) => setSum("notifApartamento", v)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="Departamento"
                    value={ctx.suministro.notifDepartamento}
                    opciones={OPCIONES_UTE.departamento}
                    onChange={(v) => setSum("notifDepartamento", v)}
                  />
                  <Texto
                    label="Localidad"
                    value={ctx.suministro.notifLocalidad}
                    onChange={(v) => setSum("notifLocalidad", v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── Datos del cliente ─── */}
          <div className={seccion}>
            <p className={`${lbl} mb-2`}>Datos del cliente</p>
            <div className="space-y-2">
              <Texto
                label={ctx.cliente.documento === "RUT" ? "Razón social" : "Nombre y apellido"}
                value={ctx.cliente.nombre}
                onChange={(v) => setCliente("nombre", v)}
              />
              <div className="grid grid-cols-3 gap-2">
                <Select
                  label="Documento"
                  value={ctx.cliente.documento}
                  opciones={OPCIONES_UTE.documento}
                  onChange={(v) => setCliente("documento", v)}
                />
                <div className="col-span-2">
                  <Texto label="Número" value={ctx.cliente.ci} onChange={(v) => setCliente("ci", v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Texto
                  label="Teléfono"
                  value={ctx.cliente.telefono}
                  onChange={(v) => setCliente("telefono", v)}
                />
                <Texto label="Email" value={ctx.cliente.email} onChange={(v) => setCliente("email", v)} />
              </div>
            </div>
          </div>

          {/* ─── Datos técnicos ─── */}
          <div className={seccion}>
            <p className={`${lbl} mb-2`}>Datos técnicos de la solicitud</p>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Select
                  label="Tipo de solicitud"
                  value={ctx.tecnica.tipoSolicitud}
                  opciones={OPCIONES_UTE.tipoSolicitud}
                  onChange={(v) => setTec("tipoSolicitud", v)}
                />
                <Select
                  label="Pasa línea"
                  value={ctx.tecnica.pasaLinea}
                  opciones={OPCIONES_UTE.pasaLinea}
                  onChange={(v) => setTec("pasaLinea", v)}
                />
                <Select
                  label="Acometida"
                  value={ctx.tecnica.acometida}
                  opciones={OPCIONES_UTE.acometida}
                  onChange={(v) => setTec("acometida", v)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  label="Trámite"
                  value={ctx.tecnica.tramite}
                  opciones={OPCIONES_UTE.tramite}
                  onChange={(v) => setTec("tramite", v)}
                />
                <Select
                  label="Requerimiento"
                  value={ctx.tecnica.requerimiento}
                  opciones={OPCIONES_UTE.requerimiento}
                  onChange={(v) => setTec("requerimiento", v)}
                />
                <Select
                  label="Actividad"
                  value={ctx.tecnica.actividad}
                  opciones={OPCIONES_UTE.actividad}
                  onChange={(v) => setTec("actividad", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Texto
                  label="Trámite asociado"
                  value={ctx.tecnica.tramiteAsociado}
                  onChange={(v) => setTec("tramiteAsociado", v)}
                />
                <Select
                  label="Tipo de puesta de medida"
                  value={ctx.tecnica.tipoMedida}
                  opciones={OPCIONES_UTE.tipoMedida}
                  onChange={(v) => setTec("tipoMedida", v)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  label="Tensión"
                  value={ctx.tecnica.tensionNivel}
                  opciones={OPCIONES_UTE.tension}
                  onChange={(v) => setTec("tensionNivel", v)}
                />
                <Select
                  label="Tarifa"
                  value={ctx.tecnica.tarifa}
                  opciones={OPCIONES_UTE.tarifa}
                  onChange={(v) => setTec("tarifa", v)}
                />
                <Select
                  label="Fases"
                  value={ctx.tecnica.fases}
                  opciones={OPCIONES_UTE.fases}
                  onChange={setFases}
                />
              </div>

              <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-3 py-2.5">
                <Select
                  label="Potencia solicitada"
                  value={ctx.tecnica.potenciaSolicitada}
                  opciones={["", ...potencias]}
                  onChange={(v) => setTec("potenciaSolicitada", v)}
                  requerido
                />
                <p className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">
                  {contratadaHoy ? (
                    <>
                      Contratada hoy: <b>{contratadaHoy} kW</b>
                      {ctx.tecnica.potenciaSolicitada && (
                        <> → se solicita <b>{ctx.tecnica.potenciaSolicitada} kW</b></>
                      )}
                    </>
                  ) : (
                    "No hay potencia contratada cargada en el proyecto."
                  )}{" "}
                  UTE solo acepta los escalones de la lista ({ctx.tecnica.fases || "según las fases"}).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Select
                  label="Certificado de carga"
                  value={ctx.tecnica.certificadoCarga}
                  opciones={OPCIONES_UTE.siNo}
                  onChange={(v) => setTec("certificadoCarga", v)}
                />
                <Select
                  label="Instalada en calefacción"
                  value={ctx.tecnica.instaladaCalefaccion}
                  opciones={OPCIONES_UTE.siNo}
                  onChange={(v) => setTec("instaladaCalefaccion", v)}
                />
                <Select
                  label="Carga perturbadora"
                  value={ctx.tecnica.cargaPerturbadora}
                  opciones={OPCIONES_UTE.siNo}
                  onChange={(v) => setTec("cargaPerturbadora", v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Doble contratación de potencia"
                  value={ctx.tecnica.dobleContratacion}
                  opciones={OPCIONES_UTE.siNo}
                  onChange={(v) => setTec("dobleContratacion", v)}
                />
                {ctx.tecnica.dobleContratacion === "Si" && (
                  <Texto
                    label="Potencia en punta - llano"
                    value={ctx.tecnica.potenciaPunta}
                    onChange={(v) => setTec("potenciaPunta", v)}
                  />
                )}
              </div>

              <div>
                <label className={lbl}>Observaciones</label>
                <textarea
                  className={`${inp} min-h-[70px]`}
                  value={ctx.tecnica.observaciones}
                  onChange={(e) => setTec("observaciones", e.target.value)}
                />
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  El formulario de UTE no tiene campo para el número de cuenta: va acá.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <button
              onClick={onEnviar}
              disabled={enviando || send.isPending || potenciaVacia}
              title={potenciaVacia ? "Elegí la potencia solicitada" : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar a UTE"}
            </button>
          </div>
        </div>

        {/* ─── Preview ─── */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
            <FileSpreadsheet className="h-6 w-6 flex-shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Formulario de UTE (adjunto)
              </p>
              <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
                Se completa con los datos de este formulario y viaja adjunto al correo.
              </p>
            </div>
            <button
              onClick={onVerFormulario}
              disabled={bajando}
              className="flex-shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-app)] disabled:opacity-50"
            >
              {bajando ? "Generando…" : "Ver formulario"}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              Previsualización en vivo
            </div>
            <div className="space-y-1 border-b border-[var(--color-border)] px-4 py-3 text-[13px]">
              <div className="flex gap-2">
                <span className="w-12 font-semibold text-[var(--color-text-muted)]">De:</span>
                <span className="text-[var(--color-text-primary)]">{currentUser?.email ?? "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 font-semibold text-[var(--color-text-muted)]">Para:</span>
                <span className="break-words text-[var(--color-text-primary)]">{to.join(", ") || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 font-semibold text-[var(--color-text-muted)]">Cc:</span>
                <span className="break-words text-[var(--color-text-primary)]">{cc.join(", ") || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 font-semibold text-[var(--color-text-muted)]">Cco:</span>
                <span className="break-words text-[var(--color-text-primary)]">{bcc.join(", ") || "—"}</span>
              </div>
              <div className="mt-2 border-t border-[var(--color-border)] pt-2 text-sm font-bold text-[var(--color-text-primary)]">
                {subject || "—"}
              </div>
            </div>
            <div
              className="px-4 py-4 text-[13px] leading-relaxed text-[var(--color-text-primary)]"
              dangerouslySetInnerHTML={{ __html: bodyToHtml(bodyText) }}
            />
          </div>
        </div>
      </div>

      {extractor.modalOpen && extractor.extracted && extractor.tipoActual && (
        <UteExtractModal
          data={extractor.extracted}
          tipo={extractor.tipoActual}
          isSaving={extractor.isConfirming}
          alreadyFilled={extractor.alreadyFilled}
          onConfirm={(d) => extractor.confirmar(d)}
          onCancel={extractor.cancelar}
        />
      )}
    </div>
  );
}
