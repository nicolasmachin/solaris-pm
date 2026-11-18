import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ExternalLink, FileSpreadsheet, Plus, Trash2, X } from "lucide-react";

import {
  COMERCIAL_COLOR,
  ESTADO_COMERCIAL_COLORS,
  ESTADO_COMERCIAL_LABEL,
  ESTADO_COMERCIAL_ORDER,
  ESTADOS_COMERCIAL_ABIERTOS,
  TIPO_COMERCIAL_LABEL,
  TIPO_COMERCIAL_ORDER,
  createTramiteComercial,
  deleteTramiteComercial,
  getTramitesComerciales,
  patchTramiteComercial,
  type UteComercialEstado,
  type UteComercialPatch,
  type UteComercialTipo,
  type UteTramiteComercial,
} from "../../api/uteComercial.api";
import { getProjects, getSuministros } from "../../api/projects.api";
import type { ProjectListItem } from "../../types/api.types";
import { usePermission } from "../../hooks/usePermission";
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

/**
 * Sección "Comercial" de Trámites UTE: lo que se le pide a UTE Comercial y no
 * es la habilitación (aumentos de potencia, suministros nuevos, provisorios…).
 * No todos los proyectos tienen uno; un proyecto puede tener varios.
 */
export function UteComercialSection() {
  const [search, setSearch] = useState("");
  const [estados, setEstados] = useState<UteComercialEstado[]>(ESTADOS_COMERCIAL_ABIERTOS);
  const [editando, setEditando] = useState<UteTramiteComercial | "nuevo" | null>(null);
  const canCreate = usePermission("TRAMITES_UTE", "CREATE");

  const { data: todos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ute-comerciales"],
    queryFn: () => getTramitesComerciales(),
  });

  const filas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos.filter(
      (t) =>
        estados.includes(t.estado) &&
        (!q || t.project.clientName.toLowerCase().includes(q) || t.project.code.toLowerCase().includes(q)),
    );
  }, [todos, estados, search]);

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
          Aumentos de potencia, suministros nuevos y todo lo que se le pide a UTE Comercial. Los que se mandan con el
          formulario desde Onboarding aparecen solos.
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          {filas.length} de {todos.length}
        </span>
        {canCreate && (
          <Button size="sm" onClick={() => setEditando("nuevo")}>
            <Plus size={14} />
            Nuevo trámite comercial
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
                  onClick={() => setEditando(t)}
                  className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-card-hover)]"
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[var(--color-text-primary)]">{t.project.clientName}</div>
                    <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                      {t.project.code}
                      {t.suministro > 1 ? ` · Suministro ${t.suministro}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: `${COMERCIAL_COLOR}26`, color: COMERCIAL_COLOR }}
                    >
                      {TIPO_COMERCIAL_LABEL[t.tipo]}
                    </span>
                    {t.fileAttachmentId ? (
                      <FileSpreadsheet
                        size={12}
                        className="ml-1 inline text-[var(--color-text-muted)]"
                        aria-label="Formulario enviado desde Voltia PM"
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{t.detalle ?? "—"}</td>
                  <td className="px-3 py-2">
                    <EstadoBadge estado={t.estado} />
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDia(t.solicitadoEl)}</td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDia(t.resueltoEl)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)]">{t.dias ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[var(--color-text-secondary)]">{t.caseNumber ?? "—"}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-[var(--color-text-secondary)]">{t.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando ? (
        <TramiteComercialModal
          tramite={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)}
        />
      ) : null}
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

  const [projectId, setProjectId] = useState(tramite?.projectId ?? projectIdFijo ?? "");
  const [suministro, setSuministro] = useState(tramite?.suministro ?? 1);
  const [tipo, setTipo] = useState<UteComercialTipo>(tramite?.tipo ?? "AUMENTO");
  const [detalle, setDetalle] = useState(tramite?.detalle ?? "");
  const [estado, setEstado] = useState<UteComercialEstado>(tramite?.estado ?? "PEDIDO");
  const [caseNumber, setCaseNumber] = useState(tramite?.caseNumber ?? "");
  const [notes, setNotes] = useState(tramite?.notes ?? "");
  const [solicitadoEl, setSolicitadoEl] = useState(tramite?.solicitadoEl?.slice(0, 10) ?? "");
  const [resueltoEl, setResueltoEl] = useState(tramite?.resueltoEl?.slice(0, 10) ?? "");

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects", "for-ute"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
    enabled: !tramite && !projectIdFijo,
  });
  const { data: suministros = [] } = useQuery({
    queryKey: ["suministros", projectId],
    queryFn: () => getSuministros(projectId),
    enabled: !!projectId,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["ute-comerciales"] });
    qc.invalidateQueries({ queryKey: ["suministro-individual-estado"] });
  }

  const guardar = useMutation({
    mutationFn: async () => {
      if (!tramite) {
        return createTramiteComercial({
          projectId,
          suministro,
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
    if (!projectId) return;
    if (tipo === "OTRO" && !detalle.trim()) {
      toast.error("Para «Otro», escribí en Detalle qué trámite es");
      return;
    }
    guardar.mutate();
  }

  const proyectoNombre = tramite
    ? `[${tramite.project.code}] ${tramite.project.clientName}`
    : null;

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
              {tramite ? "Trámite con UTE Comercial" : "Nuevo trámite con UTE Comercial"}
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

        {!tramite && !projectIdFijo && (
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">Proyecto</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputCls}>
              <option value="">{loadingProjects ? "Cargando…" : "Elegí un proyecto"}</option>
              {projects.map((p: ProjectListItem) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.clientName}
                </option>
              ))}
            </select>
          </label>
        )}

        {suministros.length > 1 && (
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

        <div className="mt-3 grid grid-cols-3 gap-3">
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

        {!tramite && projectId ? (
          <button
            type="button"
            onClick={() => navigate(`/proyecto/${projectId}/suministro-individual`)}
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
              <Button type="submit" size="sm" loading={guardar.isPending} disabled={!projectId}>
                {tramite ? "Guardar" : "Cargar trámite"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
