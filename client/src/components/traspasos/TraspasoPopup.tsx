import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import {
  cancelarTraspaso,
  confirmarTraspaso,
  getTraspasosPendientes,
  posponerTraspaso,
  type TraspasoPendiente,
} from "../../api/traspasos.api";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/auth.store";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Watcher global montado en el layout interno: cada 15s revisa si el usuario
// tiene traspasos pendientes (que él disparó y aún no confirmó) y, al aparecer
// uno nuevo, abre un popup en el momento para confirmar / cancelar / posponer.
// Sin esto, el traspaso solo se ve entrando a la campana o a la bandeja.
export function TraspasoPopup() {
  const isAuthed = useAuthStore((s) => !!s.user && s.user.role !== "CLIENT");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: pendientes } = useQuery({
    queryKey: ["traspasos-pendientes"],
    queryFn: getTraspasosPendientes,
    refetchInterval: 15_000,
    enabled: isAuthed,
  });

  // IDs que el usuario cerró con "recordar más tarde" en esta sesión: no se
  // vuelven a popupear hasta recargar (siguen visibles en la bandeja).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState("");
  const notaRef = useRef<string>("");
  notaRef.current = nota;

  const lista = pendientes ?? [];
  const activo: TraspasoPendiente | undefined = useMemo(
    () => lista.find((t) => !dismissed.has(t.id)),
    [lista, dismissed],
  );
  const restantes = lista.filter((t) => !dismissed.has(t.id)).length;

  // Al cambiar de traspaso activo, limpiar la nota.
  useEffect(() => {
    setNota("");
  }, [activo?.id]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["traspasos-pendientes"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const confirmar = useMutation({
    mutationFn: (id: string) => confirmarTraspaso(id, notaRef.current),
    onSuccess: (r) => {
      toast.success(`Confirmado · ${r.notificacionesEnviadas} notificados`);
      invalidar();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo confirmar"),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarTraspaso(id),
    onSuccess: () => {
      toast.success("Traspaso cancelado");
      invalidar();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo cancelar"),
  });

  const posponer = useMutation({
    mutationFn: (id: string) => posponerTraspaso(id),
    onSuccess: () => {
      toast.success("Pospuesto 6 horas");
      invalidar();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo posponer"),
  });

  if (!isAuthed || !activo) return null;

  const busy = confirmar.isPending || cancelar.isPending || posponer.isPending;

  function recordarMasTarde() {
    if (!activo) return;
    setDismissed((prev) => new Set(prev).add(activo.id));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={recordarMasTarde} />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              ✋
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Traspaso para confirmar
              </h2>
              <span className="rounded bg-[var(--color-bg-app)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-accent)]">
                {activo.label}
              </span>
            </div>
          </div>
          <button
            onClick={recordarMasTarde}
            title="Recordar más tarde"
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <button
            onClick={() => {
              recordarMasTarde();
              navigate(`/projects/${activo.projectId}`);
            }}
            className="mb-1 text-[12px] text-[var(--color-accent)] hover:underline"
          >
            {activo.projectName} →
          </button>
          <p className="text-sm text-[var(--color-text-primary)]">{activo.modalTexto}</p>
          {activo.destinatariosPreview.length > 0 && (
            <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
              Se notifica a: {activo.destinatariosPreview.join(" · ")}
            </p>
          )}
          <textarea
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota al receptor (opcional)…"
            className="mt-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Detectado {fmt(activo.condicionDetectadaEn)}
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <Button loading={confirmar.isPending} disabled={busy} onClick={() => confirmar.mutate(activo.id)}>
            Confirmar y notificar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              loading={posponer.isPending}
              className="flex-1"
              onClick={() => posponer.mutate(activo.id)}
            >
              Posponer 6 hs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              loading={cancelar.isPending}
              className="flex-1"
              onClick={() => cancelar.mutate(activo.id)}
            >
              Cancelar
            </Button>
          </div>
          {restantes > 1 && (
            <button
              onClick={() => {
                recordarMasTarde();
                navigate("/mis-tareas/pendientes");
              }}
              className="mt-1 text-center text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:underline"
            >
              Tenés {restantes} traspasos pendientes · ver todos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
