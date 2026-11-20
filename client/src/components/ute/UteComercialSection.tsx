import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ExternalLink, FileSpreadsheet, FileText, Plus, Send, Trash2, UserPlus, X } from "lucide-react";

import {
  COMERCIAL_COLOR,
  ESTADO_COMERCIAL_COLORS,
  ESTADO_COMERCIAL_LABEL,
  ESTADO_COMERCIAL_ORDER,
  ESTADOS_COMERCIAL_ABIERTOS,
  TIPO_COMERCIAL_LABEL,
  TIPO_COMERCIAL_ORDER,
  buscarContactosUte,
  clienteDeTramite,
  crearContactoUte,
  createTramiteComercial,
  deleteTramiteComercial,
  descargarArchivoTramite,
  getTramitesComerciales,
  patchTramiteComercial,
  type UteComercialEstado,
  type UteContacto,
  type UteTramiteArchivo,
  type UteComercialPatch,
  type UteComercialTipo,
  type UteTramiteComercial,
} from "../../api/uteComercial.api";
import { getProjects, getSuministros } from "../../api/projects.api";
import { usePermission } from "../../hooks/usePermission";
import { useBusqueda } from "../crm/Elegir";
import { ProjectPicker } from "../finance/ProjectPicker";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { DropdownFilter } from "../ui/DropdownFilter";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Columnas de solo día: medianoche UTC. Se leen con getters UTC para que en
// Uruguay no se muestre el día anterior.
function fmtDia(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()}-${MONTHS_ES[d.getUTCMonth()]}`;
}

function errorMsg(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none";

function EstadoBadge({ estado }: { estado: UteComercialEstado }) {
  const c = ESTADO_COMERCIAL_COLORS[estado];
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: c.bg, color: c.text }}>
      {ESTADO_COMERCIAL_LABEL[estado]}
    </span>
  );
}

/** Proyectos para elegir en Trámites UTE (lista compartida entre los modales). */
function useProyectosUte(enabled: boolean) {
  return useQuery({
    queryKey: ["projects", "for-ute"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
    enabled,
  });
}

function bajar(tramiteId: string, a: UteTramiteArchivo) {
  descargarArchivoTramite(tramiteId, a).catch(() => toast.error("No se pudo descargar el archivo"));
}

/** Íconos para bajar el formulario enviado y la factura de UTE del trámite. */
function ArchivosFila({ t }: { t: UteTramiteComercial }) {
  if (t.archivos.length === 0) {
    return t.fileAttachmentId ? (
      <FileSpreadsheet
        size={12}
        className="ml-1 inline text-[var(--color-text-muted)]"
        aria-label="Formulario enviado desde Voltia PM"
      />
    ) : null;
  }
  return (
    <>
      {t.archivos.map((a) => {
        const Icono = a.clase === "formulario" ? FileSpreadsheet : FileText;
        return (
          <button
            key={a.id}
            type="button"
            title={`${a.clase === "formulario" ? "Formulario enviado" : "Factura de UTE"}: ${a.filename}`}
            onClick={(e) => {
              e.stopPropagation();
              bajar(t.id, a);
            }}
            className="ml-1 inline-flex align-middle text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            <Icono size={12} />
          </button>
        );
      })}
    </>
  );
}

/**
 * Buscar un contacto del CRM o darlo de alta. Es el cliente de un trámite que
 * no tiene proyecto (todavía no compró, o es un trámite aparte).
 */
function ElegirContacto({ onElegido }: { onElegido: (c: UteContacto) => void }) {
  const [texto, q, setTexto] = useBusqueda();
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");

  const { data = [], isFetching } = useQuery({
    queryKey: ["ute-contactos", q],
    queryFn: () => buscarContactosUte(q),
    enabled: q.length >= 2,
  });

  const crear = useMutation({
    mutationFn: () =>
      crearContactoUte({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        documento: documento.trim() || undefined,
      }),
    onSuccess: (c) => {
      toast.success("Cliente creado");
      onElegido(c);
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo crear el cliente")),
  });

  if (nuevo) {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
        <p className="text-xs font-semibold text-[var(--color-text-primary)]">Cliente nuevo</p>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">Nombre o razón social *</span>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Teléfono</span>
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Cédula o RUT</span>
            <input className={inputCls} value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">Email</span>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Queda como contacto en el CRM, así Ventas lo encuentra si después compra.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setNuevo(false)}>
            Volver a buscar
          </Button>
          <Button
            type="button"
            size="sm"
            loading={crear.isPending}
            disabled={nombre.trim().length < 2}
            onClick={() => crear.mutate()}
          >
            Crear cliente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          className={`${inputCls} mt-0`}
          placeholder="Buscar cliente por nombre, teléfono, email o documento…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setNombre(texto.trim());
            setNuevo(true);
          }}
        >
          <UserPlus size={14} />
          Cliente nuevo
        </Button>
      </div>
      {q.length >= 2 && (
        <ul className="max-h-56 overflow-auto rounded-lg border border-[var(--color-border)]">
          {data.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
              {isFetching ? "Buscando…" : "Sin resultados: crealo con «Cliente nuevo»."}
            </li>
          )}
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onElegido(c)}
                className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                {c.nombre}
                <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">
                  {[c.documento, c.telefono, c.email].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Contacto ya elegido, con la opción de cambiarlo. */
function ContactoElegido({ c, onCambiar }: { c: UteContacto; onCambiar?: () => void }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-semibold text-[var(--color-text-primary)]">{c.nombre}</div>
        <div className="truncate text-[11px] text-[var(--color-text-muted)]">
          {[c.documento, c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
        </div>
      </div>
      {onCambiar ? (
        <button type="button" onClick={onCambiar} className="text-xs text-[var(--color-accent)] hover:underline">
          Cambiar
        </button>
      ) : null}
    </div>
  );
}

/** Selector "¿Para quién?": un proyecto o un cliente sin proyecto. */
function ParaQuien({ value, onChange }: { value: "proyecto" | "contacto"; onChange: (v: "proyecto" | "contacto") => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]">
      {(
        [
          { k: "proyecto", t: "Proyecto" },
          { k: "contacto", t: "Cliente sin proyecto" },
        ] as const
      ).map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`px-4 py-1.5 text-sm font-medium ${
            value === o.k ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

/**
 * "Pedir trámite a UTE": elige para quién y lleva al formulario oficial de UTE.
 * Con proyecto es el mismo formulario de Onboarding; sin proyecto, el mismo
 * formulario con los datos del contacto.
 */
function PedirTramiteModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [para, setPara] = useState<"proyecto" | "contacto">("proyecto");
  const [projectId, setProjectId] = useState("");
  const { data: projects = [], isLoading } = useProyectosUte(para === "proyecto");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[var(--color-bg-card)] p-5 shadow-2xl"
        style={{ borderColor: `${COMERCIAL_COLOR}66`, borderTop: `3px solid ${COMERCIAL_COLOR}` }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--color-text-primary)]">Pedir trámite a UTE</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Aumento de potencia o suministro nuevo, con el formulario oficial de UTE adjunto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X size={18} />
          </button>
        </div>

        <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">¿Para quién?</span>
        <ParaQuien value={para} onChange={setPara} />

        <div className="mt-4">
          {para === "proyecto" ? (
            <>
              <ProjectPicker
                value={projectId}
                onChange={setProjectId}
                projects={projects}
                loading={isLoading}
                emptyLabel="Elegí un proyecto"
              />
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  disabled={!projectId}
                  onClick={() => navigate(`/proyecto/${projectId}/suministro-individual`)}
                >
                  <Send size={14} />
                  Armar el formulario
                </Button>
              </div>
            </>
          ) : (
            <>
              <ElegirContacto
                onElegido={(c) => navigate(`/tramites-ute/contacto/${c.id}/suministro-individual`)}
              />
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Para quien todavía no tiene proyecto en Voltia PM. El trámite queda en el bloque «Sin proyecto».
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tabla de trámites (un bloque: con proyecto o sin proyecto). */
function TablaTramites({
  titulo,
  filas,
  conProyecto,
  onAbrir,
}: {
  titulo: string;
  filas: UteTramiteComercial[];
  conProyecto: boolean;
  onAbrir: (t: UteTramiteComercial) => void;
}) {
  if (filas.length === 0) return null;
  return (
    <div className="mb-5">
      <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {titulo} · {filas.length}
      </h4>
      <div
        className="overflow-x-auto rounded-xl border bg-[var(--color-bg-card)]"
        style={{ borderColor: `${COMERCIAL_COLOR}55`, borderTop: `3px solid ${COMERCIAL_COLOR}` }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Trámite</th>
              <th className="px-3 py-2">Detalle</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">DAR enviado</th>
              <th className="px-3 py-2">Resuelto</th>
              <th className="px-3 py-2 text-right">Días</th>
              <th className="px-3 py-2">Nº caso</th>
              <th className="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr
                key={t.id}
                onClick={() => onAbrir(t)}
                className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-card-hover)]"
              >
                <td className="px-3 py-2">
                  <div className="font-semibold text-[var(--color-text-primary)]">{clienteDeTramite(t)}</div>
                  <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {conProyecto
                      ? `${t.project?.code ?? ""}${t.suministro > 1 ? ` · Suministro ${t.suministro}` : ""}`
                      : [t.contacto?.documento, t.contacto?.telefono].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${COMERCIAL_COLOR}26`, color: COMERCIAL_COLOR }}
                  >
                    {TIPO_COMERCIAL_LABEL[t.tipo]}
                  </span>
                  <ArchivosFila t={t} />
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{t.detalle ?? "—"}</td>
                <td className="px-3 py-2">
                  <EstadoBadge estado={t.estado} />
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDia(t.solicitadoEl)}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDia(t.darEnviadoEl)}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDia(t.resueltoEl)}</td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)]">{t.dias ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-text-secondary)]">{t.caseNumber ?? "—"}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-[var(--color-text-secondary)]">{t.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Sección "Comercial" de Trámites UTE: lo que se le pide a UTE Comercial y no
 * es la habilitación (aumentos de potencia, suministros nuevos, provisorios…).
 * No todos los proyectos tienen uno; un proyecto puede tener varios. También
 * hay trámites de clientes SIN proyecto (un contacto del CRM): van en su
 * propio bloque.
 */
export function UteComercialSection() {
  const [search, setSearch] = useState("");
  const [estados, setEstados] = useState<UteComercialEstado[]>(ESTADOS_COMERCIAL_ABIERTOS);
  const [editando, setEditando] = useState<UteTramiteComercial | "nuevo" | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const canCreate = usePermission("TRAMITES_UTE", "CREATE");
  // El envío del formulario lo pueden hacer TRAMITES_UTE:EDIT u ONBOARDING:EDIT
  // (el asesor comercial): son los mismos permisos que pide el servidor.
  const canEditUte = usePermission("TRAMITES_UTE", "EDIT");
  const canEditOnb = usePermission("ONBOARDING", "EDIT");
  const canPedir = canEditUte || canEditOnb;

  const { data: todos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ute-comerciales"],
    queryFn: () => getTramitesComerciales(),
  });

  const filas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos.filter(
      (t) =>
        estados.includes(t.estado) &&
        (!q ||
          clienteDeTramite(t).toLowerCase().includes(q) ||
          (t.project?.code ?? "").toLowerCase().includes(q) ||
          (t.contacto?.documento ?? "").toLowerCase().includes(q)),
    );
  }, [todos, estados, search]);
  const conProyecto = filas.filter((t) => t.projectId);
  const sinProyecto = filas.filter((t) => !t.projectId);

  return (
    <div>
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-[var(--color-bg-card)] p-3"
        style={{ borderColor: `${COMERCIAL_COLOR}55` }}
      >
        <DropdownFilter
          label="Estado"
          options={ESTADO_COMERCIAL_ORDER.map((s) => ({ value: s, label: ESTADO_COMERCIAL_LABEL[s] }))}
          selected={estados}
          onChange={(v) => setEstados(v as UteComercialEstado[])}
          allLabel="Todos"
        />
        <input
          type="search"
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <span className="flex-1 text-xs text-[var(--color-text-secondary)]">
          Aumentos de potencia, suministros nuevos y todo lo que se le pide a UTE Comercial, con proyecto o sin él.
          Los que se mandan con el formulario (desde acá o desde Onboarding) aparecen solos.
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          {filas.length} de {todos.length}
        </span>
        {canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setEditando("nuevo")}>
            <Plus size={14} />
            Anotar trámite ya pedido
          </Button>
        )}
        {canPedir && (
          <Button size="sm" onClick={() => setPidiendo(true)}>
            <Send size={14} />
            Pedir trámite a UTE
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No se pudieron cargar los trámites comerciales.</p>
          <Button onClick={() => refetch()} variant="secondary" size="sm" className="mt-3">
            Reintentar
          </Button>
        </div>
      ) : filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="font-display text-base font-semibold text-[var(--color-text-primary)]">
            {todos.length === 0 ? "Sin trámites comerciales" : "Ningún trámite coincide con los filtros"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {todos.length === 0
              ? "Cuando haya algo que pedirle a UTE Comercial, va a aparecer acá."
              : "Los resueltos y cancelados quedan ocultos: se ven eligiéndolos en Estado."}
          </p>
        </div>
      ) : (
        <>
          <TablaTramites titulo="Con proyecto" filas={conProyecto} conProyecto onAbrir={setEditando} />
          <TablaTramites titulo="Sin proyecto" filas={sinProyecto} conProyecto={false} onAbrir={setEditando} />
        </>
      )}

      {editando ? (
        <TramiteComercialModal
          tramite={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)}
        />
      ) : null}
      {pidiendo ? <PedirTramiteModal onClose={() => setPidiendo(false)} /> : null}
    </div>
  );
}

// ─── Alta / edición ─────────────────────────────────────────────────────────

export function TramiteComercialModal({
  tramite,
  projectIdFijo,
  onClose,
}: {
  tramite: UteTramiteComercial | null;
  /** Al abrirlo desde un proyecto, el proyecto ya está elegido. */
  projectIdFijo?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = usePermission("TRAMITES_UTE", tramite ? "EDIT" : "CREATE");
  const canDelete = usePermission("TRAMITES_UTE", "DELETE");

  const [para, setPara] = useState<"proyecto" | "contacto">(
    tramite && !tramite.projectId ? "contacto" : "proyecto",
  );
  const [projectId, setProjectId] = useState(tramite?.projectId ?? projectIdFijo ?? "");
  const [contacto, setContacto] = useState<UteContacto | null>(tramite?.contacto ?? null);
  const [suministro, setSuministro] = useState(tramite?.suministro ?? 1);
  const [tipo, setTipo] = useState<UteComercialTipo>(tramite?.tipo ?? "AUMENTO");
  const [detalle, setDetalle] = useState(tramite?.detalle ?? "");
  const [estado, setEstado] = useState<UteComercialEstado>(tramite?.estado ?? "PEDIDO");
  const [caseNumber, setCaseNumber] = useState(tramite?.caseNumber ?? "");
  const [notes, setNotes] = useState(tramite?.notes ?? "");
  const [solicitadoEl, setSolicitadoEl] = useState(tramite?.solicitadoEl?.slice(0, 10) ?? "");
  const [darEnviadoEl, setDarEnviadoEl] = useState(tramite?.darEnviadoEl?.slice(0, 10) ?? "");
  const [resueltoEl, setResueltoEl] = useState(tramite?.resueltoEl?.slice(0, 10) ?? "");

  const eligiendo = !tramite && !projectIdFijo;
  const { data: projects = [], isLoading: loadingProjects } = useProyectosUte(eligiendo && para === "proyecto");
  const { data: suministros = [] } = useQuery({
    queryKey: ["suministros", projectId],
    queryFn: () => getSuministros(projectId),
    enabled: !!projectId && para === "proyecto",
  });
  const listo = para === "proyecto" ? !!projectId : !!contacto;

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["ute-comerciales"] });
    qc.invalidateQueries({ queryKey: ["suministro-individual-estado"] });
  }

  const guardar = useMutation({
    mutationFn: async () => {
      if (!tramite) {
        return createTramiteComercial({
          ...(para === "proyecto" ? { projectId } : { contactoId: contacto!.id }),
          suministro: para === "proyecto" ? suministro : 1,
          tipo,
          detalle: detalle.trim() || null,
          estado,
          caseNumber: caseNumber.trim() || null,
          notes: notes.trim() || null,
          solicitadoEl: solicitadoEl || null,
        });
      }
      // Solo lo que cambió: así el historial no anota campos que nadie tocó.
      const patch: UteComercialPatch = {};
      if (suministro !== tramite.suministro) patch.suministro = suministro;
      if (tipo !== tramite.tipo) patch.tipo = tipo;
      if ((detalle.trim() || null) !== tramite.detalle) patch.detalle = detalle.trim() || null;
      if (estado !== tramite.estado) patch.estado = estado;
      if ((caseNumber.trim() || null) !== tramite.caseNumber) patch.caseNumber = caseNumber.trim() || null;
      if ((notes.trim() || null) !== tramite.notes) patch.notes = notes.trim() || null;
      if ((solicitadoEl || null) !== (tramite.solicitadoEl?.slice(0, 10) ?? null))
        patch.solicitadoEl = solicitadoEl || null;
      if ((darEnviadoEl || null) !== (tramite.darEnviadoEl?.slice(0, 10) ?? null)) patch.darEnviadoEl = darEnviadoEl || null;
      if ((resueltoEl || null) !== (tramite.resueltoEl?.slice(0, 10) ?? null)) patch.resueltoEl = resueltoEl || null;
      if (Object.keys(patch).length === 0) return tramite;
      return patchTramiteComercial(tramite.id, patch);
    },
    onSuccess: () => {
      invalidar();
      toast.success(tramite ? "Trámite actualizado" : "Trámite cargado");
      onClose();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar el trámite")),
  });

  const borrar = useMutation({
    mutationFn: () => deleteTramiteComercial(tramite!.id),
    onSuccess: () => {
      invalidar();
      toast.success("Trámite borrado");
      onClose();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo borrar el trámite")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;
    if (tipo === "OTRO" && !detalle.trim()) {
      toast.error("Para «Otro», escribí en Detalle qué trámite es");
      return;
    }
    guardar.mutate();
  }

  const proyectoNombre = tramite?.project ? `[${tramite.project.code}] ${tramite.project.clientName}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[var(--color-bg-card)] p-5 shadow-2xl"
        style={{ borderColor: `${COMERCIAL_COLOR}66`, borderTop: `3px solid ${COMERCIAL_COLOR}` }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
              {tramite ? "Trámite con UTE Comercial" : "Anotar trámite ya pedido a UTE"}
            </h3>
            {proyectoNombre ? (
              <button
                type="button"
                onClick={() => navigate(`/projects/${tramite!.projectId}`)}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                {proyectoNombre}
                <ExternalLink size={11} />
              </button>
            ) : tramite ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {clienteDeTramite(tramite)} · sin proyecto
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X size={18} />
          </button>
        </div>

        {eligiendo && (
          <div className="space-y-2">
            <span className="block text-xs text-[var(--color-text-secondary)]">¿Para quién?</span>
            <ParaQuien value={para} onChange={setPara} />
            {para === "proyecto" ? (
              <ProjectPicker
                value={projectId}
                onChange={setProjectId}
                projects={projects}
                loading={loadingProjects}
                emptyLabel="Elegí un proyecto"
              />
            ) : contacto ? (
              <ContactoElegido c={contacto} onCambiar={() => setContacto(null)} />
            ) : (
              <ElegirContacto onElegido={setContacto} />
            )}
          </div>
        )}

        {tramite && tramite.contacto ? <ContactoElegido c={tramite.contacto} /> : null}

        {para === "proyecto" && suministros.length > 1 && (
          <label className="mt-3 block">
            <span className="text-xs text-[var(--color-text-secondary)]">Suministro</span>
            <select
              value={suministro}
              onChange={(e) => setSuministro(Number(e.target.value))}
              disabled={!canEdit}
              className={inputCls}
            >
              {suministros.map((s) => (
                <option key={s.numero} value={s.numero}>
                  Suministro {s.numero}
                  {s.cuentaUte ? ` · Cta ${s.cuentaUte}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Trámite</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as UteComercialTipo)}
              disabled={!canEdit}
              className={inputCls}
            >
              {TIPO_COMERCIAL_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TIPO_COMERCIAL_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as UteComercialEstado)}
              disabled={!canEdit}
              className={inputCls}
            >
              {ESTADO_COMERCIAL_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ESTADO_COMERCIAL_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Detalle {tipo === "OTRO" ? "(qué trámite es)" : "(opcional: «de 3,7 a 9,2 kW», «cambio a trifásico»…)"}
          </span>
          <input
            type="text"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={500}
            required={tipo === "OTRO"}
            disabled={!canEdit}
            className={inputCls}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Pedido el</span>
            <input
              type="date"
              value={solicitadoEl}
              onChange={(e) => setSolicitadoEl(e.target.value)}
              disabled={!canEdit}
              className={inputCls}
            />
          </label>
          {tramite && (
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)]">DAR enviado el</span>
              <input
                type="date"
                value={darEnviadoEl}
                onChange={(e) => setDarEnviadoEl(e.target.value)}
                disabled={!canEdit}
                className={inputCls}
              />
            </label>
          )}
          {tramite ? (
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)]">Resuelto el</span>
              <input
                type="date"
                value={resueltoEl}
                onChange={(e) => setResueltoEl(e.target.value)}
                disabled={!canEdit}
                className={inputCls}
              />
            </label>
          ) : (
            <div />
          )}
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Nº de caso</span>
            <input
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              disabled={!canEdit}
              className={inputCls}
            />
          </label>
        </div>
        {!tramite && !solicitadoEl && estado !== "A_PEDIR" ? (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Sin fecha de pedido, se toma hoy.</p>
        ) : null}

        <label className="mt-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={5000}
            disabled={!canEdit}
            className={inputCls}
          />
        </label>

        {tramite && tramite.archivos.length > 0 ? (
          <div className="mt-3">
            <span className="text-xs text-[var(--color-text-secondary)]">Archivos</span>
            <ul className="mt-1 space-y-1">
              {tramite.archivos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => bajar(tramite.id, a)}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
                  >
                    {a.clase === "formulario" ? <FileSpreadsheet size={12} /> : <FileText size={12} />}
                    {a.clase === "formulario" ? "Formulario enviado" : "Factura de UTE"} · {a.filename}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!tramite && listo ? (
          <button
            type="button"
            onClick={() =>
              navigate(
                para === "proyecto"
                  ? `/proyecto/${projectId}/suministro-individual`
                  : `/tramites-ute/contacto/${contacto!.id}/suministro-individual`,
              )
            }
            className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <FileSpreadsheet size={12} />
            ¿Todavía no se pidió? Armar el formulario de UTE y mandarlo desde acá
          </button>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2">
          {tramite && canDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Borrar este trámite comercial?")) borrar.mutate();
              }}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={13} />
              Borrar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {canEdit ? "Cancelar" : "Cerrar"}
            </Button>
            {canEdit && (
              <Button type="submit" size="sm" loading={guardar.isPending} disabled={!listo}>
                {tramite ? "Guardar" : "Cargar trámite"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
