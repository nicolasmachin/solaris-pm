import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
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
  addReclamo,
  createLead,
  deleteLead,
  downloadProposal,
  generateProposal,
  getLead,
  getLeads,
  getProposal,
  patchLead,
  patchLeadStage,
} from "../api/leads.api";
import { getUsers } from "../api/users.api";
import { CommentThread } from "../components/comments/CommentThread";
import { LeadAttachments } from "../components/sales/LeadAttachments";
import { LeadToProjectModal } from "../components/sales/LeadToProjectModal";
import { LostReasonModal } from "../components/sales/LostReasonModal";
import { MarkAsWonModal } from "../components/sales/MarkAsWonModal";
import { CommissionCaptureModal } from "../components/sales/CommissionCaptureModal";
import { getLeadCommission } from "../api/comisiones.api";
import { LeadProposalsList } from "../components/sales/LeadProposalsList";
import { LargeModal } from "../components/ui/LargeModal";
import { DeleteConfirmModal } from "../components/ui/DeleteConfirmModal";
import { ProposalBuilderModal } from "../components/proposals-v2/ProposalBuilderModal";
import { ProposalPreviewModal } from "../components/sales/ProposalPreviewModal";
import { StageSelect } from "../components/sales/StageSelect";
import { usePermission } from "../hooks/usePermission";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sheet } from "../components/ui/Sheet";
import { Button } from "../components/ui/Button";
import { CanAccess } from "../components/ui/CanAccess";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Spinner } from "../components/ui/Spinner";
import { useAuthStore } from "../store/auth.store";
import type { User } from "../types/api.types";
import type { LeadDetail, LeadListItem, LeadStageGroup, SalesStage } from "../types/leads.types";
import { KANBAN_COLUMNS, STAGE_COLORS, STAGE_LABELS } from "../types/leads.types";
import { LeadsListView } from "../components/sales/LeadsListView";
import { SalesViewToggle, useSalesView } from "../components/sales/SalesViewToggle";
import { PriorityView } from "../components/sales/PriorityView";
import { LeadRow } from "../components/sales/LeadRow";
import { LeadCard } from "../components/sales/LeadCard";

const WON_STAGE = "CERRADO_GANADO";
const LOST_STAGE = "CERRADO_PERDIDO";

// Alias local: los colores ahora viven en leads.types para que también
// los use la vista de lista. Se mantiene el nombre histórico para no
// tocar los call sites del Kanban.
const COLUMN_COLORS = STAGE_COLORS;

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

function useLeadGroups(params: { search?: string; assignedTo?: "me"; ownerId?: string } = {}) {
  const search = params.search?.trim() || undefined;
  const ownerId = params.ownerId || undefined;
  return useQuery({
    queryKey: ["lead-groups", search ?? "", params.assignedTo ?? "all", ownerId ?? "all"],
    queryFn: () => getLeads({ search, assignedTo: params.assignedTo, ownerId }),
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
    <Sheet
      open
      onClose={onClose}
      title="Nuevo lead"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.clientName.trim()}
            loading={createMutation.isPending}
          >
            Crear lead
          </Button>
        </>
      }
    >
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
    </Sheet>
  );
}

function SortableLeadCard(props: {
  lead: LeadListItem;
  onOpen: (leadId: string) => void;
  onMove: (leadId: string, stage: SalesStage) => void;
  onReclamo: (leadId: string) => void;
  onCloseRequest: (leadId: string) => void;
}) {
  // Wrapper draggable: usa la misma LeadCard visual que la vista priorizada,
  // pasándole los bindings de dnd-kit. activationConstraint distance=8 en el
  // PointerSensor distingue click de drag, así el onClick sigue abriendo el
  // lead cuando el mouse no se mueve.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.lead.id,
    data: { type: "lead", leadId: props.lead.id, stage: props.lead.stage },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <LeadCard
      {...props}
      dragRef={setNodeRef}
      dragStyle={style}
      dragProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLDivElement>}
      isDragging={isDragging}
    />
  );
}

function KanbanColumn({
  stage,
  leads,
  onOpen,
  onMove,
  onReclamo,
  onCloseRequest,
  isCollapsed,
  onToggle,
}: {
  stage: SalesStage;
  leads: LeadListItem[];
  onOpen: (leadId: string) => void;
  onMove: (leadId: string, stage: SalesStage) => void;
  onReclamo: (leadId: string) => void;
  onCloseRequest: (leadId: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  // useDroppable se llama incondicionalmente: la columna nunca se
  // desmonta, solo cambia su render. El ref de drop sigue activo aún
  // colapsada, así un drag-over una barra fina sigue funcionando.
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: {
      type: "column",
      stage,
    },
  });

  const totalBudget = leads.reduce(
    (sum, lead) => sum + (lead.estimatedBudgetUsd ?? 0),
    0,
  );

  const borderColor = isOver ? "var(--color-accent)" : COLUMN_COLORS[stage].border;

  if (isCollapsed) {
    // Barra fina vertical. Toda la columna es clickeable para expandir.
    // El nombre se rota con writing-mode (más robusto que rotate(-90deg)
    // porque respeta el flujo del layout y soporta ellipsis nativo).
    return (
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        title={`Expandir ${STAGE_LABELS[stage]}`}
        aria-label={`Expandir ${STAGE_LABELS[stage]}`}
        className="flex h-full w-12 shrink-0 snap-start cursor-pointer flex-col items-center justify-between rounded-xl border bg-[var(--color-bg-card)] py-3 transition-all duration-200 hover:bg-[var(--color-bg-card-hover)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        style={{ borderColor }}
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
          <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLORS[stage].dot }} />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{leads.length}</span>
        </div>
        <p
          className="overflow-hidden font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {STAGE_LABELS[stage]}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className="flex h-full w-[calc(100vw-5rem)] shrink-0 snap-start flex-col rounded-xl border bg-[var(--color-bg-card)] p-3 transition-all duration-200 md:w-[280px]"
      style={{ borderColor }}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLORS[stage].dot }} />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{STAGE_LABELS[stage]}</p>
        <span className="ml-auto text-xs font-semibold text-[var(--color-text-primary)]">{leads.length}</span>
        <button
          type="button"
          onClick={onToggle}
          title={`Colapsar ${STAGE_LABELS[stage]}`}
          aria-label={`Colapsar ${STAGE_LABELS[stage]}`}
          className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onOpen={onOpen} onMove={onMove} onReclamo={onReclamo} onCloseRequest={onCloseRequest} />
          ))}
          {leads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              Sin leads en esta etapa
            </div>
          ) : null}
        </div>
      </SortableContext>

      <div className="mt-3 shrink-0 border-t border-[var(--color-border)] pt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {formatMoney(totalBudget)} · {leads.length} lead{leads.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

// Columna "Cerrado" del kanban: agrupa ganados + perdidos (cada tarjeta con su
// badge). Es un drop-zone: al soltar un lead activo, no mueve el stage directo,
// sino que dispara el selector Ganado/Perdido (data.type="closed" lo detecta
// handleDragEnd). Las tarjetas cerradas no son arrastrables.
function ClosedColumn({
  leads,
  onOpen,
}: {
  leads: LeadListItem[];
  onOpen: (leadId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "__CLOSED__", data: { type: "closed" } });
  const borderColor = isOver ? "var(--color-accent)" : "var(--color-border)";
  return (
    <div
      ref={setNodeRef}
      className="flex h-full w-[calc(100vw-5rem)] shrink-0 snap-start flex-col rounded-xl border bg-[var(--color-bg-card)] p-3 transition-all duration-200 md:w-[280px]"
      style={{ borderColor }}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)]" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Cerrado</p>
        <span className="ml-auto text-xs font-semibold text-[var(--color-text-primary)]">{leads.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {leads.map((lead) => (
          <LeadRow key={lead.id} lead={lead} onOpen={onOpen} showStageBadge />
        ))}
        {leads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
            Arrastrá un lead acá para cerrarlo
          </div>
        ) : null}
      </div>
    </div>
  );
}

function proposalFilename(clientName: string, version: number): string {
  const name = clientName.trim() || "Cliente";
  return `Propuesta Comercial Voltia - ${name} v${version}.pdf`;
}

function ProposalModal({
  leadId,
  clientName,
  onClose,
}: {
  leadId: string;
  clientName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

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
    <>
      <Sheet
        open
        onClose={onClose}
        title="Generar propuesta desde Excel"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => generateMutation.mutate()} disabled={!file} loading={generateMutation.isPending}>
              Generar propuesta
            </Button>
          </>
        }
      >
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowPreview(true)}>
                Previsualizar
              </Button>
              <Button
                onClick={() => {
                  if (!proposalQuery.data) return;
                  void downloadProposal(
                    proposalQuery.data.id,
                    proposalFilename(clientName, proposalQuery.data.version),
                  ).catch(() => toast.error("No se pudo descargar el PDF"));
                }}
              >
                Descargar PDF
              </Button>
            </div>
          ) : null}
        </div>
      </Sheet>

      {proposalQuery.data?.status === "COMPLETED" ? (
        <ProposalPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          pdfUrl={`/api/proposals/${proposalQuery.data.id}/download`}
          title={proposalFilename(clientName, proposalQuery.data.version)}
        />
      ) : null}
    </>
  );
}

function LeadPanel({
  leadId,
  onClose,
  initialClose = null,
}: {
  leadId: string;
  onClose: () => void;
  // Intención de cierre disparada desde afuera (al mandar el lead a la columna
  // "Cerrado" del kanban): abre el flujo de cierre apenas carga el lead —
  // "lost" pide el motivo, "won" abre la captura de comisión + pase a proyecto.
  initialClose?: "won" | "lost" | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEditSales = usePermission("VENTAS", "EDIT");
  const canDeleteSales = usePermission("VENTAS", "DELETE");
  const deleteLeadMut = useMutation({
    mutationFn: () => deleteLead(leadId),
    onSuccess: () => {
      toast.success("Lead eliminado");
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      queryClient.invalidateQueries({ queryKey: ["leads-flat"] });
      onClose();
    },
    onError: () => toast.error("No se pudo eliminar el lead"),
  });
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showDeleteLead, setShowDeleteLead] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [pendingStage, setPendingStage] = useState<SalesStage | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  // Etapa destino pendiente de confirmar al reabrir un lead ganado con comisión.
  const [reopenTarget, setReopenTarget] = useState<SalesStage | null>(null);
  // ADMIN/FINANZAS pueden cargar la comisión manual (propuestas viejas).
  const canManualCommission = usePermission("FINANZAS", "VIEW");

  // Comisión del lead (para el aviso al reabrir un ganado).
  const leadCommissionQuery = useQuery({
    queryKey: ["lead-commission", leadId],
    queryFn: () => getLeadCommission(leadId),
  });
  const [dates, setDates] = useState({ leadCreatedAt: "", proposalSentAt: "", visitScheduledAt: "", visitCompletedAt: "", closedAt: "" });

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
  });

  // Dispara el flujo de cierre cuando el lead se abre con una intención de
  // cierre (desde la columna "Cerrado" del kanban). Solo una vez y solo si el
  // lead todavía no está cerrado.
  const closeTriggered = useRef(false);
  useEffect(() => {
    if (closeTriggered.current || !initialClose || !lead) return;
    if (lead.stage === WON_STAGE || lead.stage === LOST_STAGE) return;
    closeTriggered.current = true;
    if (initialClose === "lost") setPendingStage(LOST_STAGE);
    else setConfirmConvert(true);
  }, [initialClose, lead]);

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
      leadCreatedAt: lead.leadCreatedAt ? lead.leadCreatedAt.slice(0, 10) : "",
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
        leadCreatedAt: dates.leadCreatedAt ? new Date(dates.leadCreatedAt).toISOString() : null,
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
    mutationFn: ({ stage, reason }: { stage: SalesStage; reason?: string }) =>
      patchLeadStage(leadId, {
        stage,
        lostReason: stage === LOST_STAGE ? (reason ?? lostReason) : null,
      }),
    onSuccess: () => {
      setPendingStage(null);
      toast.success("Etapa actualizada");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
    },
    onError: () => toast.error("No se pudo cambiar la etapa"),
  });

  // Sólo cambia la etapa a CERRADO_GANADO. La creación del proyecto pasa
  // por el modal LeadToProjectModal, que pide los datos que falten.
  const markAsWonMutation = useMutation({
    mutationFn: async () => {
      if (lead && lead.stage !== WON_STAGE) {
        await patchLeadStage(leadId, { stage: "CERRADO_GANADO" as SalesStage });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      setConfirmConvert(false);
      // Etapa 2: primero capturar la comisión; al cerrar ese modal se ofrece
      // convertir a proyecto.
      setShowCommissionModal(true);
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo cambiar la etapa");
    },
  });

  if (isLoading || !lead) {
    return (
      <LargeModal open onClose={onClose} size="wide" ariaLabel="Detalle del lead">
        <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Spinner size={18} /> Cargando lead...
        </div>
      </LargeModal>
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
    // Reapertura de un lead ganado con comisión registrada: avisar (la comisión
    // y su pendiente en Finanzas se mantienen).
    if (lead.stage === WON_STAGE && leadCommissionQuery.data) {
      setReopenTarget(value);
      return;
    }
    stageMutation.mutate({ stage: value });
  };

  const availableUsers = usersQuery.data ?? [];

  return (
    <>
      <LargeModal open onClose={onClose} size="wide" ariaLabel="Detalle del lead">
        <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">{lead.clientName}</h2>
              <StageSelect
                currentStage={lead.stage}
                onChange={selectStage}
                disabled={stageMutation.isPending || markAsWonMutation.isPending}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{lead.code}</p>
          </div>

        {lead.stage === WON_STAGE || lead.stage === LOST_STAGE ? (
          <div className="mb-5 flex flex-col items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${lead.stage === WON_STAGE ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
              {lead.stage === WON_STAGE ? "✓ Cerrado como Ganado" : "✗ Cerrado como Perdido"}
            </span>
            {lead.convertedToProject ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Convertido al proyecto{" "}
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${lead.convertedToProject!.id}`)}
                  className="font-mono text-[var(--color-accent)] hover:underline"
                >
                  {lead.convertedToProject.code} · {lead.convertedToProject.clientName}
                </button>
              </p>
            ) : lead.stage === WON_STAGE ? (
              <button
                type="button"
                onClick={() => setShowConversionModal(true)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Convertir a proyecto
              </button>
            ) : null}
            {lead.stage === WON_STAGE ? (
              leadCommissionQuery.data ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Comisión:{" "}
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    US$ {leadCommissionQuery.data.montoUsd.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>{" "}
                  · {leadCommissionQuery.data.status === "PAGADA" ? "Pagada" : "Pendiente"}
                </p>
              ) : canEditSales ? (
                <button
                  type="button"
                  onClick={() => setShowCommissionModal(true)}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Registrar comisión del asesor
                </button>
              ) : null
            ) : null}
          </div>
        ) : (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmConvert(true)}
              disabled={markAsWonMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 active:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              ✓ {markAsWonMutation.isPending ? "Procesando…" : "Marcar como Ganado"}
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
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-[var(--color-border)] p-5 lg:border-b-0 lg:border-r">

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
                { key: "leadCreatedAt", label: "Fecha de creación", auto: !!lead.leadCreatedAt },
                { key: "proposalSentAt", label: "Propuesta enviada", auto: !!lead.proposalSentAt },
                { key: "visitScheduledAt", label: "Visita agendada", auto: !!lead.visitScheduledAt },
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
        </div>

        <div className="min-h-0 overflow-y-auto p-5">

        <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Propuestas comerciales</p>
            <div className="flex items-center gap-2">
              {canEditSales && (
                <Button size="sm" variant="secondary" onClick={() => setIsBuilderOpen(true)}>
                  Armar propuesta
                </Button>
              )}
              <Button size="sm" onClick={() => setShowProposalModal(true)}>Generar propuesta comercial</Button>
            </div>
          </div>
          <LeadProposalsList leadId={leadId} clientName={lead.clientName} />
        </section>

        <section className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Adjuntos</h3>
          <LeadAttachments leadId={lead.id} canEdit={canEditSales} />
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

        <CommentThread leadId={lead.id} level="lead" />

        {canDeleteSales ? (
          <section className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Zona de peligro
            </p>
            <button
              type="button"
              disabled={deleteLeadMut.isPending}
              onClick={() => setShowDeleteLead(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLeadMut.isPending ? "Eliminando…" : "Borrar lead"}
            </button>
          </section>
        ) : null}
        </div>
        </div>
        </div>
      </LargeModal>

      <DeleteConfirmModal
        open={showDeleteLead}
        title="Borrar lead"
        description={`Se va a borrar el lead de "${lead.clientName}". Desaparece de todas las listas de la app (queda recuperable en la base).`}
        loading={deleteLeadMut.isPending}
        onConfirm={() => deleteLeadMut.mutate()}
        onClose={() => !deleteLeadMut.isPending && setShowDeleteLead(false)}
      />

      <LostReasonModal
        open={pendingStage === LOST_STAGE}
        initialReason={lostReason}
        onCancel={() => setPendingStage(null)}
        onConfirm={(reason) => {
          setLostReason(reason);
          stageMutation.mutate({ stage: LOST_STAGE, reason });
        }}
        isPending={stageMutation.isPending}
      />

      <MarkAsWonModal
        open={confirmConvert}
        onCancel={() => setConfirmConvert(false)}
        onConfirm={() => markAsWonMutation.mutate()}
        isPending={markAsWonMutation.isPending}
      />

      <ConfirmDialog
        open={reopenTarget !== null}
        title="Reabrir lead ganado"
        description="Este lead tiene una comisión registrada. Se mantiene junto con su pendiente en Finanzas; revisala si corresponde. ¿Reabrir igual?"
        confirmLabel="Reabrir"
        loading={stageMutation.isPending}
        onConfirm={() => {
          if (reopenTarget) stageMutation.mutate({ stage: reopenTarget });
          setReopenTarget(null);
        }}
        onClose={() => setReopenTarget(null)}
      />

      <CommissionCaptureModal
        open={showCommissionModal}
        leadId={lead.id}
        leadClientName={lead.clientName}
        canManual={canManualCommission}
        onClose={() => {
          setShowCommissionModal(false);
          // Si el lead aún no fue convertido, ofrecer la conversión a proyecto.
          if (!lead.convertedToProject) setShowConversionModal(true);
        }}
      />

      {showConversionModal ? (
        <LeadToProjectModal
          leadId={lead.id}
          onClose={() => setShowConversionModal(false)}
        />
      ) : null}

      {showProposalModal ? (
        <ProposalModal
          leadId={lead.id}
          clientName={lead.clientName}
          onClose={() => setShowProposalModal(false)}
        />
      ) : null}

      {isBuilderOpen ? (
        <ProposalBuilderModal leadId={leadId} onClose={() => setIsBuilderOpen(false)} />
      ) : null}
    </>
  );
}

export function Sales() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  // Búsqueda/filtro del Kanban (la vista Lista tiene los suyos en la URL).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  // Filtro por vendedor asignado ("" = todos, "unassigned" = sin asignar, o userId).
  const [ownerId, setOwnerId] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const { data = [], isLoading } = useLeadGroups({
    search,
    assignedTo: onlyMine ? "me" : undefined,
    ownerId: ownerId || undefined,
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useSalesView();
  // Cierre desde la columna "Cerrado" del kanban: `closeSelector` es el leadId
  // al que se le está por elegir Ganado/Perdido; `closeIntent` es la intención
  // que se pasa al panel del lead para disparar el flujo de cierre.
  const [closeSelector, setCloseSelector] = useState<string | null>(null);
  const [closeIntent, setCloseIntent] = useState<{ leadId: string; kind: "won" | "lost" } | null>(null);
  // Filtros activos del Kanban para el badge del botón "Filtros" en móvil.
  const activeFilterCount = (searchInput.trim() ? 1 : 0) + (onlyMine ? 1 : 0) + (ownerId ? 1 : 0);

  // Set de stages con columna colapsada. No se persiste: cada refresh
  // arranca con todas las columnas abiertas (decisión del usuario).
  const [collapsedColumns, setCollapsedColumns] = useState<Set<SalesStage>>(new Set());
  const toggleColumn = useCallback((stage: SalesStage) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }, []);

  // En móvil el drag arranca con long-press (delay) para NO secuestrar el scroll
  // vertical; en desktop con un pequeño desplazamiento (distance), como hoy.
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 200, tolerance: 8 } : { distance: 8 },
    }),
  );

  const canListUsers = user?.role === "ADMIN";
  const usersQuery = useQuery({
    queryKey: ["sales-users"],
    queryFn: getUsers,
    enabled: canListUsers,
  });

  // Solo usuarios internos: se excluyen los del portal (rol CLIENT), que no son
  // vendedores ni asignables a un lead.
  const users = (canListUsers ? usersQuery.data ?? [] : user ? [user] : []).filter(
    (u) => u.role !== "CLIENT",
  );

  const stageMap = useMemo(() => new Map(data.map((group) => [group.stage, group])), [data]);
  const activeGroups = KANBAN_COLUMNS.map((stage) => stageMap.get(stage) ?? { stage, count: 0, leads: [] });
  const wonLeads = stageMap.get(WON_STAGE)?.leads ?? [];
  const lostLeads = stageMap.get(LOST_STAGE)?.leads ?? [];
  // Una sola pestaña "Cerrados": ganados + perdidos juntos, cada uno con su
  // badge de estado. Ordenados por días (más recientes en la etapa arriba).
  const closedLeads = useMemo(
    () => [...wonLeads, ...lostLeads].sort((a, b) => a.daysInStage - b.daysInStage),
    [wonLeads, lostLeads],
  );

  const stageMutation = useMutation({
    mutationFn: ({ leadId, stage }: { leadId: string; stage: SalesStage }) => patchLeadStage(leadId, { stage }),
    onSuccess: () => {
      toast.success("Lead movido");
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      if (selectedLeadId) queryClient.invalidateQueries({ queryKey: ["lead-detail", selectedLeadId] });
    },
    onError: () => toast.error("No se pudo mover el lead"),
  });

  const reclamoMutation = useMutation({
    mutationFn: (leadId: string) => addReclamo(leadId),
    onSuccess: (res) => {
      toast.success(`Reclamo registrado (${res.reclamosCount})`);
      queryClient.invalidateQueries({ queryKey: ["lead-groups"] });
      if (selectedLeadId) queryClient.invalidateQueries({ queryKey: ["lead-detail", selectedLeadId] });
    },
    onError: () => toast.error("No se pudo registrar el reclamo"),
  });
  const handleReclamo = useCallback((leadId: string) => reclamoMutation.mutate(leadId), [reclamoMutation]);


  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const activeId = String(event.active.id);

    // El destino puede ser una card (SortableLeadCard expuso
    // data={type:"lead", stage}) o la columna entera (KanbanColumn
    // expuso data={type:"column", stage}). En ambos casos derivamos
    // el stage destino del data.current — más robusto que comparar
    // over.id contra KANBAN_COLUMNS, porque cuando se suelta sobre
    // una card específica over.id es el id del lead, no el del stage.
    const overData = event.over.data?.current as
      | { type: "lead"; stage: SalesStage }
      | { type: "column"; stage: SalesStage }
      | { type: "closed" }
      | undefined;
    if (!overData) return;

    const lead = findLead(data, activeId);
    if (!lead) return;

    // Soltar sobre la columna "Cerrado": no se mueve el stage directo — se abre
    // el selector Ganado/Perdido, que luego abre el lead con su flujo de cierre.
    if (overData.type === "closed") {
      if (lead.stage === WON_STAGE || lead.stage === LOST_STAGE) return; // ya cerrado
      setCloseSelector(lead.id);
      return;
    }

    if (overData.type !== "lead" && overData.type !== "column") return;
    const destStage = overData.stage;
    if (lead.stage === destStage) return;
    stageMutation.mutate({ leadId: lead.id, stage: destStage });
  };

  return (
    <div className="relative flex h-[calc(100vh-52px)] min-h-0 flex-col p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Ventas</p>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Pipeline comercial</h1>
        </div>
        <CanAccess module="VENTAS" action="CREATE">
          <Button onClick={() => setShowNewLead(true)}>Nuevo lead</Button>
        </CanAccess>
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <SalesViewToggle view={view} onChange={setView} />
        {/* Kanban y Priorizada comparten los mismos filtros (search + Solo
            míos) porque leen el mismo dataset. La vista Lista tiene los suyos. */}
        {view !== "list" ? (
          <>
            {/* Desktop: búsqueda + "Solo míos" inline. En móvil van al sheet. */}
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar lead…"
                className="w-52 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <label className="hidden cursor-pointer items-center gap-1.5 text-xs text-[var(--color-text-secondary)] md:inline-flex">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(event) => setOnlyMine(event.target.checked)}
                className="cursor-pointer"
              />
              Solo míos
            </label>
            {canListUsers && users.length > 1 ? (
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                title="Filtrar por vendedor asignado"
                className="hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 px-2 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none md:block"
              >
                <option value="">Todos los vendedores</option>
                <option value="unassigned">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            ) : null}
            {/* Móvil: botón "Filtros" que abre el sheet (búsqueda + "Solo míos"). */}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="tap-target inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] md:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-black">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </>
        ) : null}
      </div>

      {view === "list" ? (
        <LeadsListView onOpenLead={setSelectedLeadId} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Spinner size={18} /> Cargando pipeline...
        </div>
      ) : view === "priority" ? (
        <PriorityView
          groups={data}
          onOpenLead={setSelectedLeadId}
          onMove={(leadId, stage) => stageMutation.mutate({ leadId, stage })}
          onReclamo={handleReclamo}
          onCloseRequest={setCloseSelector}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {activeGroups.map((group) => (
              <KanbanColumn
                key={group.stage}
                stage={group.stage}
                leads={group.leads}
                onOpen={setSelectedLeadId}
                onMove={(leadId, stage) => stageMutation.mutate({ leadId, stage })}
                onReclamo={handleReclamo}
                onCloseRequest={setCloseSelector}
                isCollapsed={collapsedColumns.has(group.stage)}
                onToggle={() => toggleColumn(group.stage)}
              />
            ))}
            <ClosedColumn leads={closedLeads} onOpen={setSelectedLeadId} />
          </div>
        </DndContext>
      )}

      {selectedLeadId ? (
        <LeadPanel
          leadId={selectedLeadId}
          onClose={() => {
            setSelectedLeadId(null);
            setCloseIntent(null);
          }}
          initialClose={closeIntent && closeIntent.leadId === selectedLeadId ? closeIntent.kind : null}
        />
      ) : null}

      {/* Selector Ganado/Perdido al mandar un lead a la columna "Cerrado". */}
      <Sheet open={closeSelector != null} onClose={() => setCloseSelector(null)} title="Cerrar lead">
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          ¿Cómo querés cerrar este lead? Se abre el lead para completar el cierre.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const id = closeSelector;
              setCloseSelector(null);
              if (id) {
                setCloseIntent({ leadId: id, kind: "won" });
                setSelectedLeadId(id);
              }
            }}
            className="flex w-full items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLORS.CERRADO_GANADO.dot }} />
            Cerrar como <strong>Ganado</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              const id = closeSelector;
              setCloseSelector(null);
              if (id) {
                setCloseIntent({ leadId: id, kind: "lost" });
                setSelectedLeadId(id);
              }
            }}
            className="flex w-full items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLORS.CERRADO_PERDIDO.dot }} />
            Cerrar como <strong>Perdido</strong>
          </button>
        </div>
      </Sheet>
      {showNewLead ? <NewLeadModal onClose={() => setShowNewLead(false)} users={users} /> : null}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={<Button onClick={() => setFiltersOpen(false)}>Listo</Button>}
      >
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Buscar lead</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar lead…"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-2 pl-8 pr-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </label>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          Solo míos
        </label>
        {canListUsers && users.length > 1 ? (
          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Vendedor asignado</span>
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-2 px-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="">Todos los vendedores</option>
              <option value="unassigned">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </Sheet>
    </div>
  );
}
