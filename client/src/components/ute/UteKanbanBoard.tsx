import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import {
  UTE_FLOW_ORDER,
  UTE_STAGE_LABEL,
  UTE_STAGE_ORDER,
  UTE_STATUS_LABEL,
  patchUteProcess,
  type UteActionKey,
  type UteProcess,
  type UtePatchInput,
  type UteStage,
} from "../../api/uteProcess.api";
import { Button } from "../ui/Button";
import { STAGE_BADGE_COLORS, STATUS_BADGE_COLORS } from "./UteProcessDetail";

// ─── Definición de transiciones ─────────────────────────────────────────────

type TransitionField = {
  key: UteActionKey;
  label: string;
  required?: boolean;
};

// Cuáles fechas "gate" se piden cuando se mueve de fromStage a toStage.
// Incluye tanto el cierre de la etapa origen como la apertura de la destino,
// si corresponde según el flow.
function transitionFields(fromStage: UteStage, toStage: UteStage): TransitionField[] {
  if (toStage === "RELEVAR" || fromStage === toStage) return [];

  // A FINALIZADO siempre se pide finalizedAt.
  if (toStage === "FINALIZADO") {
    const fields: TransitionField[] = [];
    if (UTE_FLOW_ORDER[fromStage] < UTE_FLOW_ORDER.DOCS_2) {
      fields.push({ key: "docs2SentAt", label: "Docs 2 enviados" });
    }
    fields.push({ key: "finalizedAt", label: "Finalizado", required: true });
    return fields;
  }

  // Mapa: stage destino → (gate de etapa previa en el flow) + (apertura de la nueva)
  const ENTRY_GATE: Partial<Record<UteStage, TransitionField[]>> = {
    SOLICITUD: [
      { key: "consultaApprovedAt", label: "Consulta aprobada" },
      { key: "solicitudSentAt", label: "Solicitud enviada", required: true },
    ],
    DOCS_1: [
      { key: "proyectoApprovedAt", label: "Proyecto aprobado" },
      { key: "docs1SentAt", label: "Docs 1 enviados", required: true },
    ],
    ENSAYOS: [
      { key: "docs1ApprovedAt", label: "Docs 1 aprobados" },
      { key: "ensayosSentAt", label: "Ensayos enviados", required: true },
    ],
    DOCS_2: [
      { key: "ensayosApprovedAt", label: "Ensayos aprobados" },
      { key: "docs2SentAt", label: "Docs 2 enviados", required: true },
    ],
    CONSULTA: [
      { key: "consultaSentAt", label: "Consulta enviada" },
    ],
  };
  return ENTRY_GATE[toStage] ?? [];
}

// ─── Tarjeta draggable ──────────────────────────────────────────────────────

function UteKanbanCard({
  process,
  onClick,
}: {
  process: UteProcess;
  onClick: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging, transform } = useDraggable({
    id: process.id,
    data: { type: "card", stage: process.currentStage },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
      className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2"
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="shrink-0 cursor-grab rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] active:cursor-grabbing"
          aria-label="Arrastrar"
        >
          <GripVertical size={12} />
        </button>
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <div className="mb-1 truncate text-[12px] font-semibold text-[var(--color-text-primary)]">
            {process.project.clientName}
          </div>
          <div className="mb-1.5">
            <span
              className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                background: STATUS_BADGE_COLORS[process.currentStatus].bg,
                color: STATUS_BADGE_COLORS[process.currentStatus].text,
              }}
            >
              {UTE_STATUS_LABEL[process.currentStatus]}
            </span>
          </div>
          {process.notes ? (
            <p className="mb-1 line-clamp-2 text-[11px] text-[var(--color-text-secondary)]">{process.notes}</p>
          ) : null}
          <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--color-text-muted)]">
            <span className="shrink-0">{process.totalDays} d</span>
            {process.caseNumber ? (
              <span className="truncate font-mono">#{process.caseNumber}</span>
            ) : null}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Columna droppable ──────────────────────────────────────────────────────

function UteKanbanColumn({
  stage,
  items,
  onCardClick,
}: {
  stage: UteStage;
  items: UteProcess[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { type: "column", stage },
  });

  const color = STAGE_BADGE_COLORS[stage];
  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-0 flex-col rounded-xl border bg-[var(--color-bg-card)] ${
        isOver ? "border-[var(--color-accent)] bg-[var(--color-bg-card-hover)]" : "border-[var(--color-border)]"
      }`}
      style={{ borderTop: `3px solid ${color.text}` }}
    >
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <div className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
          {UTE_STAGE_LABEL[stage]}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)]">{items.length} trámites</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-[var(--color-text-muted)]">Sin trámites</p>
        ) : (
          items.map((p) => <UteKanbanCard key={p.id} process={p} onClick={() => onCardClick(p.id)} />)
        )}
      </div>
    </div>
  );
}

// ─── Modal de transición ────────────────────────────────────────────────────

type PendingTransition = {
  process: UteProcess;
  fromStage: UteStage;
  toStage: UteStage;
};

function TransitionModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingTransition;
  onCancel: () => void;
  onConfirm: (patch: UtePatchInput) => void;
}) {
  const { process, fromStage, toStage } = pending;
  const fields = useMemo(() => transitionFields(fromStage, toStage), [fromStage, toStage]);
  const isBackward =
    toStage !== "RELEVAR" &&
    fromStage !== "RELEVAR" &&
    UTE_FLOW_ORDER[toStage] < UTE_FLOW_ORDER[fromStage];
  const needsConfirmBackward = isBackward;

  const initial: Record<UteActionKey, string> = {} as any;
  fields.forEach((f) => {
    initial[f.key] = process[f.key]?.slice(0, 10) ?? "";
  });
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [acknowledgedBackward, setAcknowledgedBackward] = useState(!needsConfirmBackward);
  const [newStatus, setNewStatus] = useState<UteProcess["currentStatus"] | "">("");

  function setField(k: UteActionKey, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function handleConfirm() {
    if (!acknowledgedBackward) return;

    // Validar requeridos y secuencia lógica: las fechas en el orden de los
    // fields deben ser ascendentes (aprobación < envío siguiente).
    const patch: UtePatchInput = { currentStage: toStage };
    const dates: Array<{ key: UteActionKey; date: Date | null }> = [];
    for (const f of fields) {
      const raw = values[f.key];
      if (!raw) {
        if (f.required) {
          toast.error(`"${f.label}" es obligatoria para esta transición`);
          return;
        }
        continue;
      }
      const d = new Date(`${raw}T00:00:00`);
      if (isNaN(d.getTime())) {
        toast.error(`Fecha inválida en "${f.label}"`);
        return;
      }
      dates.push({ key: f.key, date: d });
      (patch as Record<string, unknown>)[f.key] = raw;
    }
    for (let i = 1; i < dates.length; i++) {
      if (dates[i].date!.getTime() < dates[i - 1].date!.getTime()) {
        toast.error("La secuencia de fechas no es coherente");
        return;
      }
    }

    if (toStage === "FINALIZADO" && !values.finalizedAt) {
      toast.error('"Finalizado" es obligatoria al cerrar el trámite');
      return;
    }

    if (newStatus) patch.currentStatus = newStatus;
    onConfirm(patch);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
              Mover trámite
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {UTE_STAGE_LABEL[fromStage]} → <strong>{UTE_STAGE_LABEL[toStage]}</strong>
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {process.project.clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X size={16} />
          </button>
        </div>

        {isBackward ? (
          <label className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <input
              type="checkbox"
              checked={acknowledgedBackward}
              onChange={(e) => setAcknowledgedBackward(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Estás moviendo el trámite hacia atrás en el flujo. Esto puede afectar las métricas del trámite.
              ¿Confirmás?
            </span>
          </label>
        ) : null}

        {fields.length > 0 ? (
          <div className="space-y-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                  {f.label}
                  {f.required ? <span className="text-red-400">*</span> : null}
                </span>
                <input
                  type="date"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
            ))}
          </div>
        ) : toStage === "RELEVAR" ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-xs text-[var(--color-text-secondary)]">
            La etapa "Relevar" se marca manualmente. El sistema no seguirá derivando la etapa automáticamente a partir de las fechas.
          </p>
        ) : null}

        <label className="mt-4 block">
          <span className="text-xs text-[var(--color-text-secondary)]">Cambiar estado (opcional)</span>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as UteProcess["currentStatus"] | "")}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">(sin cambio)</option>
            {(Object.keys(UTE_STATUS_LABEL) as Array<keyof typeof UTE_STATUS_LABEL>).map((s) => (
              <option key={s} value={s}>
                {UTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!acknowledgedBackward}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────

export function UteKanbanBoard({
  processes,
  onCardClick,
}: {
  processes: UteProcess[];
  onCardClick: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = new Map<UteStage, UteProcess[]>();
    for (const s of UTE_STAGE_ORDER) map.set(s, []);
    for (const p of processes) map.get(p.currentStage)?.push(p);
    return map;
  }, [processes]);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UtePatchInput }) => patchUteProcess(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo mover el trámite";
      toast.error(msg);
    },
  });

  function onDragEnd(e: DragEndEvent) {
    const cardId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const process = processes.find((p) => p.id === cardId);
    if (!process) return;
    const toStage = overId as UteStage;
    if (!UTE_STAGE_ORDER.includes(toStage)) return;
    if (toStage === process.currentStage) return;
    setPending({ process, fromStage: process.currentStage, toStage });
  }

  function handleConfirm(patchBody: UtePatchInput) {
    if (!pending) return;
    const { process, toStage } = pending;
    patch.mutate(
      { id: process.id, body: patchBody },
      {
        onSuccess: () => {
          toast.success(`Trámite movido a ${UTE_STAGE_LABEL[toStage]}`);
          setPending(null);
        },
      },
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {/* Grid de 7 columnas que se reparten el ancho completo del
            contenedor. En pantallas muy angostas volvemos a permitir scroll
            horizontal para no espachurrar las tarjetas debajo de ~900px. */}
        <div className="overflow-x-auto">
          <div
            className="grid gap-2 pb-2"
            style={{
              gridTemplateColumns: "repeat(7, minmax(130px, 1fr))",
              minWidth: 910,
            }}
          >
            {UTE_STAGE_ORDER.map((stage) => (
              <UteKanbanColumn
                key={stage}
                stage={stage}
                items={byStage.get(stage) ?? []}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {pending ? (
        <TransitionModal
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}
