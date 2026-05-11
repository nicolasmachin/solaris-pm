import { useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  convertLead,
  createLead,
  deleteLead,
  generateProposal,
  getLead,
  getLeads,
  getProposal,
  getProposalDownloadUrl,
  patchLead,
  patchLeadStage,
} from "../api/leads.api";
import { getUsers } from "../api/users.api";
import { CommentThread } from "../components/comments/CommentThread";
import { LeadAttachments } from "../components/sales/LeadAttachments";
import { usePermission } from "../hooks/usePermission";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CanAccess } from "../components/ui/CanAccess";
import { Spinner } from "../components/ui/Spinner";
import { useAuthStore } from "../store/auth.store";
import type { User } from "../types/api.types";
import type { LeadDetail, LeadListItem, LeadProposal, LeadStageGroup, SalesStage } from "../types/leads.types";
import { KANBAN_COLUMNS, STAGE_LABELS } from "../types/leads.types";

type SalesTab = "active" | "won" | "lost";

const WON_STAGE = "CERRADO_GANADO";
const LOST_STAGE = "CERRADO_PERDIDO";

const COLUMN_COLORS: Record<SalesStage, { border: string; dot: string }> = {
  NUEVO_LEAD: { border: "#334155", dot: "#94a3b8" },
  PENDIENTE_COTIZAR: { border: "#b45309", dot: "#f59e0b" },
  COTIZADO: { border: "#2563eb", dot: "#60a5fa" },
  RECLAMADO: { border: "#ea580c", dot: "#fb923c" },
  VOLVER_CONTACTAR: { border: "#6b7280", dot: "#cbd5e1" },
  NEGOCIACION: { border: "#7c3aed", dot: "#c084fc" },
  AGENDAR_VISITA: { border: "#0f766e", dot: "#2dd4bf" },
  VISITADO: { border: "#4d7c0f", dot: "#a3e635" },
  ONBOARDING: { border: "#4d7c0f", dot: "#a3e635" },
  CERRADO_GANADO: { border: "#166534", dot: "#4ade80" },
  CERRADO_PERDIDO: { border: "#991b1b", dot: "#f87171" },
  MAS_ADELANTE: { border: "#64748b", dot: "#94a3b8" },
};

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelative(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

function getAssigneeInitial(name?: string) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function useLeadGroups() {
  return useQuery({
    queryKey: ["lead-groups"],
    queryFn: () => getLeads(),
    staleTime: 30_000,
  });
}

function findLead(groups: LeadStageGroup[], leadId: string) {
  for (const group of groups) {
    const found = group.leads.find((lead) => lead.id === leadId);
    if (found) return found;
  }
  return null;
}

function NewLeadModal({
  onClose,
  users,
}: {
  onClose: () => void;
  users: User[];
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    estimatedKwp: "",
    estimatedBudgetUsd: "",
    uteBillMonthlyUsd: "",
    roofType: "",
    notes: "",
    assignedToId: user?.id ?? "",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLead({
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail || null,
        clientPhone: form.clientPhone || null,
        address: form.address || null,
        estimatedKwp: form.estimatedKwp ? Number(form.estimatedKwp) : null,
        estimatedBudgetUsd: form.estimatedBudgetUsd ? Number(form.estimatedBudgetUsd) : null,
        uteBillMonthlyUsd: form.uteBillMonthlyUsd ? Number(form.uteBillMonthlyUsd) : null,
        roofType: form.roofType || null,
        notes: form.notes || null,
        assignedToId: form.assignedToId || null,
      }),
    onSuccess: () => {
      toast.success("Lead creado");
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      onClose();
    },
    onError: () => toast.error("No se pudo crear el lead"),
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <div className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Nuevo lead</p>
          <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">Alta comercial</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Nombre del cliente", "clientName"],
            ["Email", "clientEmail"],
            ["Teléfono", "clientPhone"],
            ["Dirección", "address"],
            ["kWp estimados", "estimatedKwp"],
            ["Presupuesto estimado USD", "estimatedBudgetUsd"],
            ["Factura UTE mensual USD", "uteBillMonthlyUsd"],
            ["Tipo de techo", "roofType"],
          ].map(([label, key]) => (
            <label key={key} className={key === "address" || key === "roofType" ? "md:col-span-2" : ""}>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</span>
              <input
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            </label>
          ))}

          <label className="md:col-span-2">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Asignar a</span>
            <select
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              value={form.assignedToId}
              onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}
            >
              <option value="">Sin asignar</option>
              {users.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Notas iniciales</span>
            <textarea
              className="min-h-[96px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.clientName.trim()}
            loading={createMutation.isPending}
          >
            Crear lead
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableLeadCard({
  lead,
  onOpen,
}: {
  lead: LeadListItem;
  onOpen: (leadId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
      stage: lead.stage,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const daysColor =
    lead.daysInStage > 14
      ? "#f87171"
      : lead.daysInStage > 7
        ? "var(--color-accent)"
        : "var(--color-text-muted)";

  return (
    <button
      ref={setNodeRef}
      style={style}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-left"
      onClick={() => onOpen(lead.id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{lead.clientName}</p>
          <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{lead.estimatedKwp ?? "—"} kWp</p>
        </div>
        <button
          className="cursor-grab rounded p-1 text-[var(--color-text-muted)]"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          ⋮⋮
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--color-text-secondary)]">{formatMoney(lead.estimatedBudgetUsd)}</div>
        {lead.assignedTo ? (
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-black">
              {getAssigneeInitial(lead.assignedTo.name)}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">{lead.assignedTo.name}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 font-mono text-[10px]" style={{ color: daysColor }}>
        {lead.daysInStage} día{lead.daysInStage === 1 ? "" : "s"} en etapa
      </div>
    </button>
  );
}

function KanbanColumn({
  stage,
  leads,
  onOpen,
}: {
  stage: SalesStage;
  leads: LeadListItem[];
  onOpen: (leadId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: {
      type: "column",
      stage,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex min-h-[520px] w-[280px] shrink-0 flex-col rounded-xl border bg-[var(--color-bg-card)] p-3"
      style={{
        borderColor: isOver ? "var(--color-accent)" : COLUMN_COLORS[stage].border,
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLORS[stage].dot }} />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{STAGE_LABELS[stage]}</p>
        <span className="ml-auto text-xs font-semibold text-[var(--color-text-primary)]">{leads.length}</span>
      </div>

      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
          {leads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              Sin leads en esta etapa
            </div>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

function ProposalModal({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const proposalQuery = useQuery({
    queryKey: ["proposal-status", proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: Boolean(proposalId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED" ? false : 2000;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("FILE_REQUIRED");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("leadId", leadId);
      return generateProposal(formData);
    },
    onSuccess: (data) => {
      setProposalId(data.id);
      toast.success("Generación iniciada");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
    },
    onError: () => toast.error("No se pudo iniciar la generación"),
  });

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Propuesta comercial</p>
        <h3 className="mb-4 font-display text-lg font-bold text-[var(--color-text-primary)]">Generar desde Excel</h3>

        <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center">
          <input
            className="hidden"
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-sm text-[var(--color-text-primary)]">{file ? file.name : "Arrastrá o seleccioná un Excel"}</p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Formatos permitidos: .xlsx y .xls</p>
        </label>

        <div className="mt-4">
          {proposalQuery.data?.status === "PROCESSING" || proposalQuery.data?.status === "PENDING" ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Spinner size={16} />
              Generando propuesta...
            </div>
          ) : null}
          {proposalQuery.data?.status === "FAILED" ? (
            <div className="rounded-md border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-300">
              {proposalQuery.data.errorMessage ?? "La generación falló"}
            </div>
          ) : null}
          {proposalQuery.data?.status === "COMPLETED" ? (
            <a
              className="inline-flex rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black"
              href={getProposalDownloadUrl(proposalQuery.data.id)}
              target="_blank"
              rel="noreferrer"
            >
              Descargar PDF
            </a>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => generateMutation.mutate()} disabled={!file} loading={generateMutation.isPending}>
            Generar propuesta
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeadPanel({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEditSales = usePermission("VENTAS", "EDIT");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [pendingStage, setPendingStage] = useState<SalesStage | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [dates, setDates] = useState({ proposalSentAt: "", visitScheduledAt: "", visitCompletedAt: "", closedAt: "" });

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
  });

  const usersQuery = useQuery({
    queryKey: ["sales-users-panel"],
    queryFn: getUsers,
    retry: false,
  });

  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    estimatedKwp: "",
    estimatedBudgetUsd: "",
    uteBillMonthlyUsd: "",
    roofType: "",
    notes: "",
    assignedToId: "",
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      clientName: lead.clientName,
      clientEmail: lead.clientEmail ?? "",
      clientPhone: lead.clientPhone ?? "",
      address: lead.address ?? "",
      estimatedKwp: lead.estimatedKwp?.toString() ?? "",
      estimatedBudgetUsd: lead.estimatedBudgetUsd?.toString() ?? "",
      uteBillMonthlyUsd: lead.uteBillMonthlyUsd?.toString() ?? "",
      roofType: lead.roofType ?? "",
      notes: lead.notes ?? "",
      assignedToId: lead.assignedTo?.id ?? "",
    });
    setLostReason(lead.lostReason ?? "");
    setDates({
      proposalSentAt: lead.proposalSentAt ? lead.proposalSentAt.slice(0, 10) : "",
      visitScheduledAt: lead.visitScheduledAt ? lead.visitScheduledAt.slice(0, 10) : "",
      visitCompletedAt: lead.visitCompletedAt ? lead.visitCompletedAt.slice(0, 10) : "",
      closedAt: lead.closedAt ? lead.closedAt.slice(0, 10) : "",
    });
  }, [lead]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchLead(leadId, {
        clientName: form.clientName,
        clientEmail: form.clientEmail || null,
        clientPhone: form.clientPhone || null,
        address: form.address || null,
        estimatedKwp: form.estimatedKwp ? Number(form.estimatedKwp) : null,
        estimatedBudgetUsd: form.estimatedBudgetUsd ? Number(form.estimatedBudgetUsd) : null,
        uteBillMonthlyUsd: form.uteBillMonthlyUsd ? Number(form.uteBillMonthlyUsd) : null,
        roofType: form.roofType || null,
        notes: form.notes || null,
        assignedToId: form.assignedToId || null,
      }),
    onSuccess: () => {
      toast.success("Lead actualizado");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
    },
  });

  const datesMutation = useMutation({
    mutationFn: () =>
      patchLead(leadId, {
        proposalSentAt: dates.proposalSentAt ? new Date(dates.proposalSentAt).toISOString() : null,
        visitScheduledAt: dates.visitScheduledAt ? new Date(dates.visitScheduledAt).toISOString() : null,
        visitCompletedAt: dates.visitCompletedAt ? new Date(dates.visitCompletedAt).toISOString() : null,
        closedAt: dates.closedAt ? new Date(dates.closedAt).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success("Fechas actualizadas");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
    },
  });

  const stageMutation = useMutation({
    mutationFn: (stage: SalesStage) =>
      patchLeadStage(leadId, {
        stage,
        lostReason: stage === LOST_STAGE ? lostReason : null,
      }),
    onSuccess: () => {
      setPendingStage(null);
      toast.success("Etapa actualizada");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
    },
    onError: () => toast.error("No se pudo cambiar la etapa"),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertLead(leadId),
    onSuccess: (project) => {
      toast.success("Proyecto creado");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      navigate(`/projects/${project.id}`);
    },
    onError: () => toast.error("No se pudo convertir el lead"),
  });

  if (isLoading || !lead) {
    return (
      <aside className="fixed right-0 top-[52px] z-40 h-[calc(100vh-52px)] w-full max-w-[420px] border-l border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Spinner size={18} /> Cargando lead...
        </div>
      </aside>
    );
  }

  const selectStage = (value: SalesStage) => {
    if (value === LOST_STAGE) {
      setPendingStage(value);
      return;
    }
    if (value === WON_STAGE) {
      setConfirmConvert(true);
      return;
    }
    stageMutation.mutate(value);
  };

  const availableUsers = usersQuery.data ?? [];

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-[52px] z-40 h-[calc(100vh-52px)] w-full max-w-[420px] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-sidebar)] p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">{lead.clientName}</h2>
              <Badge variant="default" label={STAGE_LABELS[lead.stage]} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{lead.code}</p>
          </div>
          <button className="rounded p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)]" onClick={onClose} type="button">✕</button>
        </div>

        {lead.stage === WON_STAGE || lead.stage === LOST_STAGE ? (
          <div className="mb-5 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${lead.stage === WON_STAGE ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
              {lead.stage === WON_STAGE ? "✓ Cerrado como Ganado" : "✗ Cerrado como Perdido"}
            </span>
          </div>
        ) : (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmConvert(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 active:bg-green-700 transition-colors"
            >
              ✓ Marcar como Ganado
            </button>
            <button
              type="button"
              onClick={() => setPendingStage(LOST_STAGE)}
              className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 active:bg-red-700 transition-colors"
            >
              ✗ Marcar como Perdido
            </button>
          </div>
        )}

        <section className="mb-5 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="grid gap-3">
            {[
              ["Nombre", "clientName"],
              ["Email", "clientEmail"],
              ["Teléfono", "clientPhone"],
              ["Dirección", "address"],
              ["kWp estimados", "estimatedKwp"],
              ["Presupuesto USD", "estimatedBudgetUsd"],
              ["UTE mensual USD", "uteBillMonthlyUsd"],
              ["Tipo de techo", "roofType"],
            ].map(([label, key]) => (
              <label key={key}>
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</span>
                <input
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                  value={form[key as keyof typeof form]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
            <label>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Asignado a</span>
              <select
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                value={form.assignedToId}
                onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}
              >
                <option value="">Sin asignar</option>
                {availableUsers.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Notas</span>
              <textarea
                className="min-h-[88px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>

          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="w-full">
            Guardar cambios
          </Button>
        </section>

        <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Cambiar etapa</p>
          <select
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            value={lead.stage}
            onChange={(event) => selectStage(event.target.value as SalesStage)}
          >
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Fechas del proceso</p>
          <div className="grid gap-3">
            {(
              [
                { key: "proposalSentAt", label: "Propuesta enviada", auto: !!lead.proposalSentAt },
                { key: "visitScheduledAt", label: "Visita agendada", auto: false },
                { key: "visitCompletedAt", label: "Visita realizada", auto: false },
                { key: "closedAt", label: "Fecha de cierre", auto: !!lead.closedAt },
              ] as { key: keyof typeof dates; label: string; auto: boolean }[]
            ).map(({ key, label, auto }) => (
              <label key={key}>
                <span className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  {label}
                  {auto && <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-400 font-bold normal-case tracking-normal">Auto</span>}
                </span>
                <input
                  type="date"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                  value={dates[key]}
                  onChange={(e) => setDates((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <Button loading={datesMutation.isPending} onClick={() => datesMutation.mutate()} className="mt-3 w-full">
            Guardar fechas
          </Button>
        </section>

        <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Propuestas comerciales</p>
            <Button size="sm" onClick={() => setShowProposalModal(true)}>Generar propuesta comercial</Button>
          </div>
          <div className="space-y-2">
            {lead.proposals.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Sin propuestas generadas todavía.</p>
            ) : (
              lead.proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-[var(--color-text-primary)]">{formatRelative(proposal.createdAt)}</p>
                      <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{proposal.id}</p>
                    </div>
                    <Badge variant="default" label={proposal.status} />
                  </div>
                  {proposal.errorMessage ? (
                    <p className="mt-2 text-xs text-red-300">{proposal.errorMessage}</p>
                  ) : null}
                  {proposal.status === "COMPLETED" ? (
                    <a
                      className="mt-2 inline-flex text-sm text-[var(--color-accent)] hover:underline"
                      href={getProposalDownloadUrl(proposal.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Descargar PDF
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Historial de actividad</p>
          <div className="space-y-2">
            {lead.activities.map((activity) => (
              <div key={activity.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
                <p className="text-sm text-[var(--color-text-primary)]">{activity.action}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {activity.user.name} · {formatRelative(activity.createdAt)}
                </p>
                {activity.notes ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{activity.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Adjuntos</h3>
          <LeadAttachments leadId={lead.id} canEdit={canEditSales} />
        </section>

        <CommentThread leadId={lead.id} level="lead" />
      </aside>

      {pendingStage === LOST_STAGE ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60" onClick={(event) => event.target === event.currentTarget && setPendingStage(null)}>
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
            <h3 className="mb-3 font-display text-lg font-bold text-[var(--color-text-primary)]">Cerrar como perdido</h3>
            <textarea
              className="min-h-[110px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingStage(null)}>Cancelar</Button>
              <Button disabled={!lostReason.trim()} onClick={() => stageMutation.mutate(LOST_STAGE)}>Confirmar</Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmConvert ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60" onClick={(event) => event.target === event.currentTarget && setConfirmConvert(false)}>
          <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
            <h3 className="mb-2 font-display text-lg font-bold text-[var(--color-text-primary)]">Convertir lead en proyecto</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              ¿Convertir este lead en proyecto? Se creará automáticamente con todas sus etapas y checklists.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmConvert(false)}>Cancelar</Button>
              <Button loading={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showProposalModal ? <ProposalModal leadId={lead.id} onClose={() => setShowProposalModal(false)} /> : null}
    </>
  );
}

function Tabs({
  current,
  onChange,
}: {
  current: SalesTab;
  onChange: (tab: SalesTab) => void;
}) {
  const items: Array<{ id: SalesTab; label: string }> = [
    { id: "active", label: "Activos" },
    { id: "won", label: "Ganados" },
    { id: "lost", label: "Perdidos" },
  ];

  return (
    <div className="mb-4 flex gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          className={`rounded-full px-3 py-1.5 text-sm ${current === item.id ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"}`}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Sales() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data = [], isLoading } = useLeadGroups();
  const [tab, setTab] = useState<SalesTab>("active");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const canListUsers = user?.role === "ADMIN";
  const usersQuery = useQuery({
    queryKey: ["sales-users"],
    queryFn: getUsers,
    enabled: canListUsers,
  });

  const users = canListUsers ? usersQuery.data ?? [] : user ? [user] : [];

  const stageMap = useMemo(() => new Map(data.map((group) => [group.stage, group])), [data]);
  const activeGroups = KANBAN_COLUMNS.map((stage) => stageMap.get(stage) ?? { stage, count: 0, leads: [] });
  const wonLeads = stageMap.get(WON_STAGE)?.leads ?? [];
  const lostLeads = stageMap.get(LOST_STAGE)?.leads ?? [];

  const stageMutation = useMutation({
    mutationFn: ({ leadId, stage }: { leadId: string; stage: SalesStage }) => patchLeadStage(leadId, { stage }),
    onSuccess: () => {
      toast.success("Lead movido");
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      if (selectedLeadId) queryClient.invalidateQueries({ queryKey: ["lead-detail", selectedLeadId] });
    },
    onError: () => toast.error("No se pudo mover el lead"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      toast.success("Lead eliminado");
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      setSelectedLeadId(null);
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    const lead = findLead(data, activeId);
    if (!lead || !KANBAN_COLUMNS.includes(overId as SalesStage) || lead.stage === overId) return;
    stageMutation.mutate({ leadId: lead.id, stage: overId as SalesStage });
  };

  return (
    <div className="relative min-h-[calc(100vh-52px)] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Ventas</p>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Pipeline comercial</h1>
        </div>
        <CanAccess module="VENTAS" action="CREATE">
          <Button onClick={() => setShowNewLead(true)}>Nuevo lead</Button>
        </CanAccess>
      </div>

      <Tabs current={tab} onChange={setTab} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Spinner size={18} /> Cargando pipeline...
        </div>
      ) : tab === "active" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activeGroups.map((group) => (
              <KanbanColumn
                key={group.stage}
                stage={group.stage}
                leads={group.leads}
                onOpen={setSelectedLeadId}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {(tab === "won" ? wonLeads : lostLeads).map((lead) => (
            <button
              key={lead.id}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left"
              onClick={() => setSelectedLeadId(lead.id)}
              type="button"
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{lead.clientName}</p>
                <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{lead.estimatedKwp ?? "—"} kWp</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--color-text-secondary)]">{formatMoney(lead.estimatedBudgetUsd)}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{lead.daysInStage} días</p>
              </div>
            </button>
          ))}
          {(tab === "won" ? wonLeads : lostLeads).length === 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
              No hay leads en esta pestaña.
            </div>
          ) : null}
        </div>
      )}

      {selectedLeadId ? <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} /> : null}
      {showNewLead ? <NewLeadModal onClose={() => setShowNewLead(false)} users={users} /> : null}
    </div>
  );
}
