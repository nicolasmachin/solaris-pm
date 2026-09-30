import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Send, Sparkles, Upload } from "lucide-react";

import { getProject, getSuministros, type Suministro } from "../api/projects.api";
import { useAuthStore } from "../store/auth.store";
import { useEmailTemplates, usePrepareEmail, useSendEmail } from "../hooks/useEmail";
import { useUteExtract } from "../hooks/useUteExtract";
import { UteExtractModal } from "../components/projects/UteExtractModal";
import type { EmailTemplate, EmailTemplateContext } from "../api/email.api";
import { RecipientChips } from "../components/email/RecipientChips";
import { bodyToHtml, renderTemplate } from "../components/email/renderMailBody";
import { ACCEPT_FOTOS_Y_PDF } from "../utils/fileAccept";

const TEMPLATE_KEY = "consulta_ute";
const TENSIONES = ["BT Monofásico 230V", "BT Trifásico 230V", "BT Trifásico 400V"];

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

function splitCsv(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

// Mismos chequeos que buildEmailContext del backend (labels visibles).
function calcularFaltantes(ctx: EmailTemplateContext, bcc: string[]): string[] {
  const checks: Array<[string, string]> = [
    ["nombre del cliente", ctx.cliente.nombre],
    ["C.I./RUT", ctx.cliente.ci],
    ["email del cliente", bcc.length ? "ok" : ""],
    ["departamento", ctx.suministro.departamento],
    ["localidad", ctx.suministro.localidad],
    ["calle", ctx.suministro.calle],
    ["número", ctx.suministro.numero],
    ["cuenta", ctx.suministro.cuenta],
    ["tensión", ctx.tecnica.tension],
    ["potencia contratada", ctx.tecnica.potenciaContratada],
    ["tarifa", ctx.tecnica.tarifa],
  ];
  return checks.filter(([, v]) => !v.trim()).map(([label]) => label);
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Un proyecto con inversores distintos tiene un suministro (cuenta UTE) por
// inversor, y a UTE se le manda una consulta por cada uno. Esta página detecta
// cuántos hay: con uno solo es la pantalla de siempre; con más, una pestaña por
// suministro, cada una con su formulario, su factura y su envío.
export default function ConsultaUte() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const suministrosQ = useQuery({
    queryKey: ["suministros", projectId],
    queryFn: () => getSuministros(projectId),
    enabled: !!projectId,
  });
  const suministros = suministrosQ.data ?? [];
  const varios = suministros.length > 1;
  const [elegido, setElegido] = useState<number | null>(null);

  // Arranca en el primero que todavía no tiene la consulta mandada.
  useEffect(() => {
    if (elegido !== null || suministros.length === 0) return;
    setElegido(suministros.find((s) => !s.consultaSentAt)?.numero ?? suministros[0].numero);
  }, [suministros, elegido]);

  if (suministrosQ.isLoading || elegido === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
        Preparando la consulta…
      </div>
    );
  }

  const actual = suministros.find((s) => s.numero === elegido) ?? null;

  async function onEnviada(numero: number) {
    await qc.invalidateQueries({ queryKey: ["suministros", projectId] });
    if (!varios) {
      toast.success("Consulta enviada a UTE");
      navigate(-1);
      return;
    }
    const pendiente = suministros.find((s) => s.numero !== numero && !s.consultaSentAt);
    if (pendiente) {
      toast.success(`Consulta del suministro ${numero} enviada. Falta la del suministro ${pendiente.numero}.`);
      setElegido(pendiente.numero);
    } else {
      toast.success(`Consulta del suministro ${numero} enviada. Ya salieron todas.`);
      navigate(-1);
    }
  }

  return (
    <div>
      {varios && (
        <div className="mb-4 space-y-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>
          <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
            Este proyecto tiene <b className="text-[var(--color-text-primary)]">{suministros.length} suministros</b>, uno
            por inversor. A UTE va <b className="text-[var(--color-text-primary)]">una consulta por cada cuenta</b>, cada
            una con su factura, su titular y la potencia de su inversor.
          </div>
          <div className="flex flex-wrap gap-2">
            {suministros.map((s) => (
              <SuministroTab key={s.numero} s={s} activo={s.numero === elegido} onClick={() => setElegido(s.numero)} />
            ))}
          </div>
        </div>
      )}
      <ConsultaUteForm
        key={elegido}
        projectId={projectId}
        suministro={elegido}
        info={varios ? actual : null}
        onEnviada={() => onEnviada(elegido)}
      />
    </div>
  );
}

function SuministroTab({ s, activo, onClick }: { s: Suministro; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[200px] rounded-lg border px-3 py-2 text-left transition ${
        activo
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent)]/60"
      }`}
    >
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">Suministro {s.numero}</div>
      <div className="text-[11px] text-[var(--color-text-secondary)]">
        {s.inversor ?? "Inversor sin cargar"}
        {s.cuentaUte ? ` · Cta ${s.cuentaUte}` : " · sin cuenta"}
      </div>
      <div
        className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${
          s.consultaSentAt ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
        }`}
      >
        {s.consultaSentAt ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Consulta enviada el {fechaCorta(s.consultaSentAt)}
          </>
        ) : (
          "Consulta pendiente"
        )}
      </div>
    </button>
  );
}

function ConsultaUteForm({
  projectId,
  suministro,
  info,
  onEnviada,
}: {
  projectId: string;
  suministro: number;
  /** Datos del suministro cuando el proyecto tiene más de uno (null = el caso de siempre). */
  info: Suministro | null;
  onEnviada: () => void;
}) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const principal = suministro === 1;

  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId), enabled: !!projectId });
  const { data: templates } = useEmailTemplates({ activo: true });
  const template: EmailTemplate | undefined = useMemo(
    () => templates?.find((t) => t.key === TEMPLATE_KEY),
    [templates],
  );

  const prepare = usePrepareEmail();
  const send = useSendEmail();
  const extractor = useUteExtract(projectId, suministro);
  const fileRef = useRef<HTMLInputElement>(null);

  const [ctx, setCtx] = useState<EmailTemplateContext | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Siembra el form desde un context (inicial o tras cargar factura): los
  // destinatarios salen de renderizar los templates To/Cc/Bcc con ese context.
  function seed(context: EmailTemplateContext) {
    setCtx(context);
    if (template) {
      setTo(splitCsv(renderTemplate(template.toTemplate, context)));
      setCc(splitCsv(renderTemplate(template.ccTemplate, context)));
      setBcc(splitCsv(renderTemplate(template.bccTemplate, context)));
    }
    setSubjectOverride(null);
  }

  // Carga inicial: prepare trae el context del proyecto.
  useEffect(() => {
    if (!projectId || !template || ready) return;
    prepare.mutate(
      { templateKey: TEMPLATE_KEY, projectId, suministro },
      {
        onSuccess: (res) => {
          seed(res.context);
          setReady(true);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, template]);

  // Tras confirmar la factura (PATCH al proyecto), re-preparamos para refrescar
  // el preview con los datos nuevos. Detectamos el fin del confirm (isConfirming
  // true→false con el modal ya cerrado = éxito).
  const prevConfirming = useRef(false);
  useEffect(() => {
    if (prevConfirming.current && !extractor.isConfirming && !extractor.modalOpen) {
      prepare.mutate({ templateKey: TEMPLATE_KEY, projectId, suministro }, { onSuccess: (res) => seed(res.context) });
    }
    prevConfirming.current = extractor.isConfirming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractor.isConfirming, extractor.modalOpen]);

  function onPickFactura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) extractor.uploadAndExtract(file, "factura_ute");
    if (fileRef.current) fileRef.current.value = "";
  }

  function setCliente<K extends keyof EmailTemplateContext["cliente"]>(k: K, v: EmailTemplateContext["cliente"][K]) {
    setCtx((c) => (c ? { ...c, cliente: { ...c.cliente, [k]: v } } : c));
  }
  function setSuministro<K extends keyof EmailTemplateContext["suministro"]>(k: K, v: string) {
    setCtx((c) => (c ? { ...c, suministro: { ...c.suministro, [k]: v } } : c));
  }
  function setTecnica<K extends keyof EmailTemplateContext["tecnica"]>(k: K, v: string) {
    setCtx((c) => (c ? { ...c, tecnica: { ...c.tecnica, [k]: v } } : c));
  }
  function setTipo(esEmpresa: boolean) {
    setCtx((c) =>
      c
        ? { ...c, cliente: { ...c.cliente, esEmpresa }, tecnica: { ...c.tecnica, destino: esEmpresa ? "Comercial." : "Residencial." } }
        : c,
    );
  }

  // Derivados del preview (WYSIWYG: lo que se ve es lo que se envía).
  const subject = ctx ? (subjectOverride ?? renderTemplate(template?.subjectTemplate ?? "", ctx)) : "";
  const bodyText = ctx ? renderTemplate(template?.bodyTemplate ?? "", ctx) : "";
  const faltantes = ctx ? calcularFaltantes(ctx, bcc) : [];
  const potenciaGeneradorVacia = !ctx?.tecnica.potenciaGenerador.trim();

  async function onEnviar() {
    if (to.length === 0) {
      toast.error("Falta el destinatario (Para)");
      return;
    }
    if (potenciaGeneradorVacia) {
      toast.error("Completá la Pot. comprometida generador (obligatoria)");
      return;
    }
    try {
      await send.mutateAsync({
        templateKey: TEMPLATE_KEY,
        projectId,
        to: to.join(", "),
        cc: cc.join(", "),
        bcc: bcc.join(", "),
        subject,
        body: bodyText,
        suministro,
        // Los suministros que no son el principal no tienen otro lugar donde
        // estén cargados su cuenta, su titular y su dirección: se guardan con
        // lo que salió en la consulta.
        ...(principal || !ctx
          ? {}
          : {
              datosSuministro: {
                cuenta: ctx.suministro.cuenta,
                titularNombre: ctx.cliente.nombre,
                titularCi: ctx.cliente.ci,
                titularEmpresa: ctx.cliente.esEmpresa,
                calle: ctx.suministro.calle,
                numCalle: ctx.suministro.numero,
                localidad: ctx.suministro.localidad,
                departamento: ctx.suministro.departamento,
              },
            }),
      });
      onEnviada();
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (code?.code === "SMTP_NOT_CONFIGURED") {
        toast.error("Configurá tu servidor SMTP primero");
        navigate("/settings");
      } else {
        toast.error(code?.message ?? "No se pudo enviar la consulta");
      }
    }
  }

  if (!ready || !ctx) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
        {template ? "Preparando la consulta…" : "Cargando plantilla…"}
      </div>
    );
  }

  const ciLabel = ctx.cliente.esEmpresa ? "RUT" : "C.I. / RUT";
  const facturaCargada = principal ? !!project?.facturaUtePath : !!info?.facturaUtePath;

  return (
    <div>
      {!info && (
        <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>
      )}
      <h1 className="mb-1 text-lg font-bold text-[var(--color-text-primary)]">
        {project?.clientName ?? ctx.cliente.nombre} · Enviar consulta a UTE
        {info && ` · Suministro ${suministro}`}
      </h1>
      {info?.consultaSentAt && (
        <p className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
          La consulta de este suministro ya salió el {fechaCorta(info.consultaSentAt)}. Si la mandás de nuevo, esa fecha no cambia.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
        {/* ─── Formulario ─── */}
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div>
            <label className={lbl}>Tipo de cliente</label>
            <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]">
              {[{ k: false, t: "Persona física" }, { k: true, t: "Empresa" }].map((o) => (
                <button
                  key={o.t}
                  onClick={() => setTipo(o.k)}
                  className={`px-4 py-1.5 text-sm font-medium ${
                    ctx.cliente.esEmpresa === o.k ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"
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
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Cargar factura UTE</p>
              <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {facturaCargada
                  ? "Ya hay una factura cargada y sus datos ya están en el formulario. Subí otra para reemplazar."
                  : info
                    ? `Cargá la factura de la cuenta del suministro ${suministro}: la IA completa cuenta, tarifa, potencia y más.`
                    : "La IA lee la factura y completa cuenta, tarifa, potencia y más. Revisás y ajustás abajo."}
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={extractor.isExtracting}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {extractor.isExtracting ? "Leyendo…" : facturaCargada ? "Reemplazar" : "Cargar factura"}
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT_FOTOS_Y_PDF} className="hidden" onChange={onPickFactura} />
          </div>

          <div className="border-t border-dashed border-[var(--color-border)] pt-3">
            <p className={`${lbl} mb-2`}>Destinatarios</p>
            <div className="space-y-2">
              <div>
                <label className={lbl}>Para</label>
                <RecipientChips value={to} onChange={setTo} placeholder="microgeneracion@ute.com.uy" />
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

          <div className="border-t border-dashed border-[var(--color-border)] pt-3">
            <p className={`${lbl} mb-2`}>Datos del cliente y suministro</p>
            <div className="space-y-2">
              <div>
                <label className={lbl}>Nombre completo</label>
                <input className={inp} value={ctx.cliente.nombre} onChange={(e) => setCliente("nombre", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>{ciLabel}</label><input className={inp} value={ctx.cliente.ci} onChange={(e) => setCliente("ci", e.target.value)} /></div>
                <div><label className={lbl}>Cuenta UTE</label><input className={inp} value={ctx.suministro.cuenta} onChange={(e) => setSuministro("cuenta", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Teléfono</label><input className={inp} value={ctx.cliente.telefono} onChange={(e) => setCliente("telefono", e.target.value)} /></div>
                <div><label className={lbl}>Departamento</label><input className={inp} value={ctx.suministro.departamento} onChange={(e) => setSuministro("departamento", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>Localidad</label><input className={inp} value={ctx.suministro.localidad} onChange={(e) => setSuministro("localidad", e.target.value)} /></div>
                <div><label className={lbl}>Calle</label><input className={inp} value={ctx.suministro.calle} onChange={(e) => setSuministro("calle", e.target.value)} /></div>
                <div><label className={lbl}>Nro.</label><input className={inp} value={ctx.suministro.numero} onChange={(e) => setSuministro("numero", e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-[var(--color-border)] pt-3">
            <p className={`${lbl} mb-2`}>Datos técnicos de la solicitud</p>
            {info?.inversor && (
              <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
                Inversor de este suministro: <b className="text-[var(--color-text-primary)]">{info.inversor}</b>
                {info.paneles ? ` · ${info.paneles} paneles` : ""}. La potencia comprometida es la de este inversor, no la del proyecto entero.
              </p>
            )}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Tensión suministro</label>
                  <select className={inp} value={ctx.tecnica.tension} onChange={(e) => setTecnica("tension", e.target.value)}>
                    {!TENSIONES.includes(ctx.tecnica.tension) && <option value={ctx.tecnica.tension}>{ctx.tecnica.tension || "(elegir)"}</option>}
                    {TENSIONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Pot. comprometida generador <span className="text-red-500">*</span></label><input className={`${inp}${potenciaGeneradorVacia ? " border-red-500 focus:border-red-500" : ""}`} value={ctx.tecnica.potenciaGenerador} placeholder="(obligatorio)" onChange={(e) => setTecnica("potenciaGenerador", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Potencia contratada</label><input className={inp} value={ctx.tecnica.potenciaContratada} onChange={(e) => setTecnica("potenciaContratada", e.target.value)} /></div>
                <div><label className={lbl}>Tarifa</label><input className={inp} value={ctx.tecnica.tarifa} onChange={(e) => setTecnica("tarifa", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Acometida</label><input className={inp} value={ctx.tecnica.acometida} onChange={(e) => setTecnica("acometida", e.target.value)} /></div>
                <div><label className={lbl}>Destino del servicio</label><input className={inp} value={ctx.tecnica.destino} onChange={(e) => setTecnica("destino", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>Pasa línea</label><input className={inp} value={ctx.tecnica.pasaLinea} onChange={(e) => setTecnica("pasaLinea", e.target.value)} /></div>
                <div><label className={lbl}>Certificado carga</label><input className={inp} value={ctx.tecnica.certificadoCarga} onChange={(e) => setTecnica("certificadoCarga", e.target.value)} /></div>
                <div><label className={lbl}>Carga perturbadora</label><input className={inp} value={ctx.tecnica.cargaPerturbadora} onChange={(e) => setTecnica("cargaPerturbadora", e.target.value)} /></div>
              </div>
            </div>
          </div>

          {faltantes.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠ Faltan datos: <b>{faltantes.join(", ")}</b>. Podés completarlos a mano (no bloquea el envío).
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <button
              onClick={onEnviar}
              disabled={send.isPending || potenciaGeneradorVacia}
              title={potenciaGeneradorVacia ? "Completá la Pot. comprometida generador" : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {send.isPending ? "Enviando…" : info ? `Enviar consulta del suministro ${suministro}` : "Enviar consulta"}
            </button>
          </div>
        </div>

        {/* ─── Preview en vivo ─── */}
        <div className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              Previsualización en vivo
            </div>
            <div className="space-y-1 border-b border-[var(--color-border)] px-4 py-3 text-[13px]">
              <div className="flex gap-2"><span className="w-12 font-semibold text-[var(--color-text-muted)]">De:</span><span className="text-[var(--color-text-primary)]">{currentUser?.email ?? "—"}</span></div>
              <div className="flex gap-2"><span className="w-12 font-semibold text-[var(--color-text-muted)]">Para:</span><span className="break-words text-[var(--color-text-primary)]">{to.join(", ") || "—"}</span></div>
              <div className="flex gap-2"><span className="w-12 font-semibold text-[var(--color-text-muted)]">Cc:</span><span className="break-words text-[var(--color-text-primary)]">{cc.join(", ") || "—"}</span></div>
              <div className="flex gap-2"><span className="w-12 font-semibold text-[var(--color-text-muted)]">Cco:</span><span className="break-words text-[var(--color-text-primary)]">{bcc.join(", ") || "—"}</span></div>
              <div className="mt-2 border-t border-[var(--color-border)] pt-2 text-sm font-bold text-[var(--color-text-primary)]">{subject || "—"}</div>
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
