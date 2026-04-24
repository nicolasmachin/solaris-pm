import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, Send, Inbox, X } from "lucide-react";
import {
  UTE_ACTIONS_ORDERED,
  UTE_STAGE_LABEL,
  UTE_STAGE_ORDER,
  UTE_STATUS_LABEL,
  patchUteProcess,
  type UteActionKey,
  type UteProcess,
  type UtePatchInput,
} from "../../api/uteProcess.api";
import { Button } from "../ui/Button";

// Paleta pública de colores para badges (sincronizada con los que usa la tabla).
export const STAGE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  CONSULTA:   { bg: "rgba(59,130,246,0.18)",  text: "#60a5fa" },
  SOLICITUD:  { bg: "rgba(139,92,246,0.18)",  text: "#a78bfa" },
  DOCS_1:     { bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  DOCS_2:     { bg: "rgba(249,115,22,0.18)",  text: "#fb923c" },
  RELEVAR:    { bg: "rgba(234,179,8,0.18)",   text: "#facc15" },
  ENSAYOS:    { bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
  FINALIZADO: { bg: "rgba(45,212,191,0.18)",  text: "#5eead4" },
};

export const STATUS_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  CERRADO:    { bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  EN_PROCESO: { bg: "rgba(59,130,246,0.18)",  text: "#60a5fa" },
  ESPERANDO:  { bg: "rgba(148,163,184,0.22)", text: "#cbd5e1" },
  PENDIENTE:  { bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
};

function toInputDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Detalle del trámite UTE. Se usa tanto en el drawer de /tramites-ute como
 * en la pestaña UTE de ProjectDetail. No muestra teléfono ni link al
 * proyecto: la información del proyecto es responsabilidad del wrapper.
 */
export function UteProcessDetail({ process }: { process: UteProcess }) {
  const qc = useQueryClient();
  const [notesValue, setNotesValue] = useState(process.notes ?? "");
  const [caseValue, setCaseValue] = useState(process.caseNumber ?? "");
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sólo resincronizamos con las props cuando cambia el trámite (otro id).
  // Si lo sincronizáramos con cada cambio de process.notes, el valor del
  // servidor pisaría lo que el usuario está tipeando en ese momento (race
  // con el auto-save).
  useEffect(() => {
    setNotesValue(process.notes ?? "");
    setCaseValue(process.caseNumber ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id]);

  const patch = useMutation({
    mutationFn: (body: UtePatchInput) => patchUteProcess(process.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      qc.invalidateQueries({ queryKey: ["project", process.projectId] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo guardar";
      toast.error(msg);
    },
  });

  function saveDateField(key: UteActionKey, value: string) {
    patch.mutate({ [key]: value || null } as UtePatchInput);
    if (value) toast.success("Fecha actualizada");
  }

  function flushNotes(next: string) {
    if (next !== (process.notes ?? "")) patch.mutate({ notes: next || null });
  }

  function scheduleNotesSave(next: string) {
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => flushNotes(next), 1000);
  }

  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    };
  }, []);

  // "Guardar ahora": fuerza el flush de lo que esté pendiente de los campos
  // con debounce/blur (notes, caseNumber). Si nada cambió, sólo confirma.
  // Los otros campos (fechas, etapa, estado) ya guardan en el acto.
  const isDirty =
    notesValue !== (process.notes ?? "") || caseValue !== (process.caseNumber ?? "");

  function saveAllNow() {
    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    const payload: UtePatchInput = {};
    if (notesValue !== (process.notes ?? "")) payload.notes = notesValue.trim() || null;
    if (caseValue !== (process.caseNumber ?? "")) payload.caseNumber = caseValue.trim() || null;
    if (Object.keys(payload).length === 0) {
      toast.success("Todo guardado");
      return;
    }
    patch.mutate(payload, {
      onSuccess: () => toast.success("Cambios guardados"),
    });
  }

  const completedPct =
    process.totalDays > 0 ? Math.round((process.ourTimeDays / process.totalDays) * 100) : 0;
  const utePct = process.totalDays > 0 ? 100 - completedPct : 0;
  const invariantOk = process.totalDays === process.ourTimeDays + process.uteTimeDays;

  return (
    <div>
      {/* Pipeline visual */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-0.5">
          {UTE_STAGE_ORDER.map((stage, idx) => {
            const pos = UTE_STAGE_ORDER.indexOf(process.currentStage);
            const reached = idx <= pos && process.currentStage !== "RELEVAR";
            const isCurrent = stage === process.currentStage;
            return (
              <div key={stage} className="flex-1">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    background: isCurrent
                      ? "var(--color-accent)"
                      : reached
                        ? "var(--color-state-done-text)"
                        : "var(--color-border)",
                  }}
                  title={UTE_STAGE_LABEL[stage]}
                />
                <div className="mt-1 text-center text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  {idx + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fechas */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Fechas de acciones
        </h3>
        <div className="space-y-2">
          {UTE_ACTIONS_ORDERED.map((a) => {
            const Icon = a.side === "ours" ? Send : Inbox;
            const value = process[a.key];
            return (
              <div
                key={a.key}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2"
              >
                <Icon
                  size={14}
                  className={a.side === "ours" ? "text-[#60a5fa]" : "text-[#34d399]"}
                  aria-label={a.side === "ours" ? "Nuestro" : "De UTE"}
                />
                <label className="flex-1 text-xs text-[var(--color-text-secondary)]">{a.label}</label>
                <input
                  key={`${a.key}-${value ?? "empty"}`}
                  type="date"
                  defaultValue={toInputDate(value)}
                  onBlur={(e) => {
                    const next = e.target.value;
                    if (next !== toInputDate(value)) saveDateField(a.key, next);
                  }}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                {value ? (
                  <button
                    type="button"
                    onClick={() => saveDateField(a.key, "")}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-red-400"
                    title="Limpiar fecha"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Caso */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Datos del caso
        </h3>
        <label className="block text-xs text-[var(--color-text-secondary)]">
          Número de caso UTE
          <input
            type="text"
            value={caseValue}
            onChange={(e) => setCaseValue(e.target.value)}
            onBlur={() => {
              if (caseValue !== (process.caseNumber ?? "")) patch.mutate({ caseNumber: caseValue.trim() || null });
            }}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="UTE-2026-…"
          />
        </label>
      </div>

      {/* Notas con debounce 1s */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Notas
        </h3>
        <textarea
          value={notesValue}
          onChange={(e) => {
            const next = e.target.value;
            setNotesValue(next);
            scheduleNotesSave(next);
          }}
          onBlur={() => {
            if (notesDebounceRef.current) {
              clearTimeout(notesDebounceRef.current);
              notesDebounceRef.current = null;
            }
            flushNotes(notesValue);
          }}
          rows={3}
          maxLength={5000}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="Agregá una nota…"
        />
      </div>

      {/* Etapa/Estado inline */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Etapa y estado
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--color-text-secondary)]">
            Etapa actual
            <select
              value={process.currentStage}
              onChange={(e) =>
                patch.mutate({ currentStage: e.target.value as UteProcess["currentStage"] })
              }
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {UTE_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {UTE_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--color-text-secondary)]">
            Estado
            <select
              value={process.currentStatus}
              onChange={(e) =>
                patch.mutate({ currentStatus: e.target.value as UteProcess["currentStatus"] })
              }
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {(Object.keys(UTE_STATUS_LABEL) as Array<keyof typeof UTE_STATUS_LABEL>).map((s) => (
                <option key={s} value={s}>
                  {UTE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {process.stageManuallySet ? (
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Etapa fijada manualmente. No se re-calcula automáticamente al cargar fechas.{" "}
            <button
              type="button"
              onClick={() => patch.mutate({ stageManuallySet: false })}
              className="underline hover:text-[var(--color-text-primary)]"
            >
              Desbloquear
            </button>
          </p>
        ) : null}
      </div>

      {/* Métricas */}
      <div className="px-5 py-4">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Métricas del trámite
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
            <div className="font-display text-xl font-bold text-[var(--color-text-primary)]">
              {process.totalDays}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Total (días)
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
            <div className="font-display text-xl font-bold" style={{ color: "#f87171" }}>
              {process.ourTimeDays}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Nuestro ({completedPct}%)
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
            <div className="font-display text-xl font-bold" style={{ color: "#60a5fa" }}>
              {process.uteTimeDays}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              UTE ({utePct}%)
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          {invariantOk ? "✓" : "⚠"} Verificación: nuestro + UTE = total
        </p>
      </div>

      {/* Barra de guardado: sticky al borde inferior dentro del scroll del
          contenedor padre. Muestra el estado de forma explícita y permite
          forzar el guardado de notas/caso sin esperar al blur/debounce. */}
      <div
        className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-app)] px-5 py-3"
        style={{ backdropFilter: "blur(6px)" }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-[11px]"
          style={{
            color: isDirty
              ? "var(--color-warning-text)"
              : "var(--color-state-done-text)",
          }}
        >
          {isDirty ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-warning-text)]" />
              Cambios sin guardar
            </>
          ) : (
            <>
              <Check size={12} />
              Todo guardado
            </>
          )}
        </span>
        <Button
          size="sm"
          onClick={saveAllNow}
          loading={patch.isPending}
          disabled={!isDirty && !patch.isPending}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
