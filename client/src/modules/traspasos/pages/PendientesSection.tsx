import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import {
  cancelarTraspaso,
  confirmarTraspaso,
  getTraspasosPendientes,
  posponerTraspaso,
  type TraspasoPendiente,
} from "../../../api/traspasos.api";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function TraspasoCard({ t }: { t: TraspasoPendiente }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [nota, setNota] = useState("");

  const confirmar = useMutation({
    mutationFn: () => confirmarTraspaso(t.id, nota),
    onSuccess: (r) => {
      toast.success(`Confirmado · ${r.notificacionesEnviadas} notificados`);
      qc.invalidateQueries({ queryKey: ["traspasos-pendientes"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo confirmar"),
  });

  const cancelar = useMutation({
    mutationFn: () => cancelarTraspaso(t.id),
    onSuccess: () => {
      toast.success("Traspaso cancelado");
      qc.invalidateQueries({ queryKey: ["traspasos-pendientes"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo cancelar"),
  });

  const posponer = useMutation({
    mutationFn: () => posponerTraspaso(t.id),
    onSuccess: () => {
      toast.success("Pospuesto 6 horas");
      qc.invalidateQueries({ queryKey: ["traspasos-pendientes"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo posponer"),
  });

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded bg-[var(--color-bg-app)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-accent)]">
          {t.label}
        </span>
        <button
          onClick={() => navigate(`/projects/${t.projectId}`)}
          className="text-[12px] text-[var(--color-accent)] hover:underline"
        >
          {t.projectName} →
        </button>
      </div>
      <p className="text-sm text-[var(--color-text-primary)]">{t.modalTexto}</p>
      {t.destinatariosPreview.length > 0 && (
        <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
          Se notifica a: {t.destinatariosPreview.join(" · ")}
        </p>
      )}
      <textarea
        rows={2}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota al receptor (opcional)…"
        className="mt-2 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-[var(--color-text-muted)]">Detectado {fmt(t.condicionDetectadaEn)}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={posponer.isPending} onClick={() => posponer.mutate()}>
            Posponer 6 hs
          </Button>
          <Button variant="ghost" size="sm" loading={cancelar.isPending} onClick={() => cancelar.mutate()}>
            Cancelar
          </Button>
          <Button size="sm" loading={confirmar.isPending} onClick={() => confirmar.mutate()}>
            Confirmar y notificar
          </Button>
        </div>
      </div>
    </div>
  );
}

// Contenido de la tab "Pendientes" de Mis tareas: la bandeja de traspasos que el
// usuario disparó y todavía no confirmó. Sin wrapper de página/título propio (el
// MisTareasLayout aporta el header "Mis tareas" y la barra de tabs).
export function PendientesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["traspasos-pendientes"],
    queryFn: getTraspasosPendientes,
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Traspasos que disparaste y todavía no confirmaste. Al confirmar, se notifica al área correspondiente.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={24} />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No tenés traspasos pendientes.</p>
      ) : (
        <div className="space-y-3">
          {data.map((t) => (
            <TraspasoCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
