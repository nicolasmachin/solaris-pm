import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";

import {
  descartarIncidencia,
  DIAGNOSTICO_BADGE,
  DIAGNOSTICO_LABEL,
  getGeneracionDiaria,
  getIncidencias,
  revisarIncidencia,
  silenciarPlanta,
  type FilaMonitor,
} from "../../../api/monitorFv.api";
import { Sheet } from "../../../components/ui/Sheet";
import { usePermission } from "../../../hooks/usePermission";

const COLOR_GEN = "#f59e0b";

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function diaCorto(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

export function MonitorPlantaDrawer({
  planta,
  onClose,
}: {
  planta: FilaMonitor;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const [nota, setNota] = useState("");
  const [silenciarHasta, setSilenciarHasta] = useState("");
  const [motivoSilencio, setMotivoSilencio] = useState("");

  const desde = haceDias(30);
  const hasta = haceDias(0);

  const { data: serie } = useQuery({
    queryKey: ["monitor-fv", "generacion-diaria", planta.projectId, desde, hasta],
    queryFn: () => getGeneracionDiaria(planta.projectId!, desde, hasta),
    enabled: Boolean(planta.projectId),
  });

  const { data: incidencias } = useQuery({
    queryKey: ["monitor-fv", "incidencias", planta.projectId],
    queryFn: () => getIncidencias({ projectId: planta.projectId!, limit: 50 }),
    enabled: Boolean(planta.projectId),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["monitor-fv"] });

  const revisar = useMutation({
    mutationFn: () => revisarIncidencia(planta.incidenciaId!, nota || undefined),
    onSuccess: () => {
      toast.success("Marcada como revisada");
      setNota("");
      invalidar();
    },
    onError: () => toast.error("No se pudo marcar como revisada"),
  });

  const descartar = useMutation({
    mutationFn: () => descartarIncidencia(planta.incidenciaId!, nota),
    onSuccess: () => {
      toast.success("Incidencia descartada");
      setNota("");
      invalidar();
      onClose();
    },
    onError: () => toast.error("No se pudo descartar"),
  });

  const silenciar = useMutation({
    mutationFn: (quitar: boolean) =>
      silenciarPlanta(
        planta.growattPlantId,
        quitar ? null : silenciarHasta,
        quitar ? undefined : motivoSilencio,
      ),
    onSuccess: (_d, quitar) => {
      toast.success(quitar ? "Monitoreo reactivado" : "Planta silenciada");
      setSilenciarHasta("");
      setMotivoSilencio("");
      invalidar();
    },
    onError: () => toast.error("No se pudo cambiar el silencio"),
  });

  const datos = (serie ?? []).map((d) => ({ dia: diaCorto(d.fecha), kWh: d.generacionKwh }));

  return (
    <Sheet open onClose={onClose} title={planta.clientName ?? planta.plantName}>
      <div className="space-y-5">
        <div>
          <span
            className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${DIAGNOSTICO_BADGE[planta.diagnostico]}`}
          >
            {DIAGNOSTICO_LABEL[planta.diagnostico]}
          </span>
          {planta.detalle && (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{planta.detalle}</p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-[var(--color-text-muted)]">Planta Growatt</dt>
            <dd className="text-[var(--color-text-primary)]">{planta.plantName}</dd>
            <dt className="text-[var(--color-text-muted)]">Potencia</dt>
            <dd className="text-[var(--color-text-primary)]">
              {planta.peakPowerKw != null ? `${planta.peakPowerKw} kWp` : "—"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Último dato del equipo</dt>
            <dd className="text-[var(--color-text-primary)]">
              {planta.ultimoDatoEn
                ? new Date(planta.ultimoDatoEn).toLocaleString("es-UY", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </dd>
            {planta.silenciadaHasta && (
              <>
                <dt className="text-[var(--color-text-muted)]">Silenciada hasta</dt>
                <dd className="text-[var(--color-text-primary)]">
                  {diaCorto(planta.silenciadaHasta)}
                  {planta.silenciadaMotivo ? ` — ${planta.silenciadaMotivo}` : ""}
                </dd>
              </>
            )}
          </dl>
        </div>

        <div>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Generación de los últimos 30 días
          </h3>
          {datos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Todavía no hay serie diaria guardada para este generador.
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                  <Tooltip
                    formatter={(v) => [`${Number(v ?? 0).toFixed(1)} kWh`, "Generación"]}
                    contentStyle={{
                      background: "var(--color-bg-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="kWh" fill={COLOR_GEN} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {canEdit && planta.incidenciaId && (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Gestión
            </h3>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (qué se hizo, con quién se habló…)"
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => revisar.mutate()}
                disabled={revisar.isPending}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
              >
                Marcar revisada
              </button>
              <button
                onClick={() => descartar.mutate()}
                disabled={descartar.isPending || nota.trim().length < 3}
                title={nota.trim().length < 3 ? "Escribí el motivo para descartarla" : undefined}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] disabled:opacity-40"
              >
                Descartar
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Marcarla como revisada no la cierra: sigue abierta hasta que la planta vuelva a generar.
              Descartarla es para falsos positivos, y por eso pide motivo.
            </p>
          </div>
        )}

        {canEdit && (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Silenciar el monitoreo
            </h3>
            {planta.silenciadaHasta ? (
              <button
                onClick={() => silenciar.mutate(true)}
                disabled={silenciar.isPending}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
              >
                Reactivar el monitoreo
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={silenciarHasta}
                    onChange={(e) => setSilenciarHasta(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
                  />
                  <input
                    value={motivoSilencio}
                    onChange={(e) => setMotivoSilencio(e.target.value)}
                    placeholder="Motivo"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
                  />
                  <button
                    onClick={() => silenciar.mutate(false)}
                    disabled={silenciar.isPending || !silenciarHasta || !motivoSilencio.trim()}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] disabled:opacity-40"
                  >
                    Silenciar
                  </button>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Se silencia hasta una fecha, nunca para siempre: un silencio permanente se olvida y
                  la planta queda sin vigilar sin que nadie se entere.
                </p>
              </>
            )}
          </div>
        )}

        {(incidencias ?? []).length > 0 && (
          <div>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Historial
            </h3>
            <ul className="space-y-1.5">
              {(incidencias ?? []).map((i) => (
                <li key={i.id} className="text-[13px] text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">
                    {diaCorto(i.primeraDeteccionEn)}
                    {i.resueltaEn ? ` → ${diaCorto(i.resueltaEn)}` : " → sigue"}
                  </span>{" "}
                  {DIAGNOSTICO_LABEL[i.diagnostico]}
                  {i.nota ? ` · ${i.nota}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
