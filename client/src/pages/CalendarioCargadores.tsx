import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import {
  cancelarReservaCargador,
  describirFecha,
  mayuscula,
  FRANJA_LABEL,
  getConfigCargadores,
  getReservasCargadores,
  guardarConfigCargadores,
  type ConfigCargadores,
  type FranjaCargador,
  type ReservaCargador,
} from "../api/cargadores.api";
import { getCalendarTeams } from "../api/calendar.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { usePermission } from "../hooks/usePermission";

/**
 * Gestión de la agenda pública de cargadores (/calendario/cargadores):
 * las reservas que dejaron los clientes y la configuración de qué días y
 * franjas se ofrecen.
 */

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

const ESTADO_LABEL: Record<ReservaCargador["estado"], { texto: string; color: string }> = {
  RESERVADA: { texto: "Reservada", color: "#12B5CB" },
  A_CONFIRMAR: { texto: "A confirmar", color: "#E0A020" },
  CANCELADA: { texto: "Cancelada", color: "#9AA0A6" },
};

const URL_PUBLICA = `${window.location.origin}/agendar-cargador`;

export function CalendarioCargadores() {
  const puedeEditar = usePermission("OPERACIONES", "EDIT");
  const [verCanceladas, setVerCanceladas] = useState(false);
  const reservasQ = useQuery({
    queryKey: ["cargadores-reservas", verCanceladas],
    queryFn: () => getReservasCargadores(verCanceladas),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/calendario" className="text-xs text-[var(--color-text-muted)] hover:underline">
            ‹ Calendario
          </Link>
          <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)]">Agenda de cargadores</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Lo que reservan los clientes desde la página pública.{" "}
            <a href={URL_PUBLICA} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
              Abrir la página
            </a>{" "}
            <button
              type="button"
              className="text-xs text-[var(--color-text-muted)] hover:underline"
              onClick={() => {
                void navigator.clipboard.writeText(URL_PUBLICA);
                toast.success("Enlace copiado");
              }}
            >
              (copiar enlace)
            </button>
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Reservas</h2>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} />
            Ver canceladas
          </label>
        </div>
        {reservasQ.isLoading ? (
          <Spinner />
        ) : (reservasQ.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay reservas.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {reservasQ.data!.map((r) => (
              <FilaReserva key={r.id} r={r} puedeEditar={puedeEditar} />
            ))}
          </div>
        )}
      </section>

      <ConfigPanel puedeEditar={puedeEditar} />
    </div>
  );
}

function FilaReserva({ r, puedeEditar }: { r: ReservaCargador; puedeEditar: boolean }) {
  const qc = useQueryClient();
  const cancelar = useMutation({
    mutationFn: () => cancelarReservaCargador(r.id),
    onSuccess: () => {
      toast.success("Reserva cancelada");
      qc.invalidateQueries({ queryKey: ["cargadores-reservas"] });
      qc.invalidateQueries({ queryKey: ["agenda-eventos"] });
    },
    onError: () => toast.error("No se pudo cancelar"),
  });
  const est = ESTADO_LABEL[r.estado];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${est.color}26`, color: est.color }}
          >
            {est.texto}
          </span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {r.fecha && r.franja ? `${mayuscula(describirFecha(r.fecha))} · ${FRANJA_LABEL[r.franja].toLowerCase()}` : "Sin fecha"}
          </span>
        </div>
        <div className="mt-1 text-[var(--color-text-primary)]">
          {r.nombre} · {r.celular} · {r.email}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {r.direccion}, {r.localidad}, {r.departamento}
          {!r.enZona && " (fuera de zona)"}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {r.tieneCargador ? `Tiene cargador${r.modeloCargador ? `: ${r.modeloCargador}` : ""}` : "No tiene cargador"}
          {r.modeloAuto && ` · Auto: ${r.modeloAuto}`}
        </div>
        {r.notas && <div className="mt-1 text-xs italic text-[var(--color-text-muted)]">“{r.notas}”</div>}
      </div>
      <div className="flex items-center gap-2">
        {r.leadId && (
          <Link to={`/ventas?lead=${r.leadId}`} className="text-xs text-[var(--color-accent)] hover:underline">
            {r.leadCode ?? "Ver lead"}
          </Link>
        )}
        {puedeEditar && r.estado !== "CANCELADA" && (
          <button
            type="button"
            disabled={cancelar.isPending}
            onClick={() => {
              if (window.confirm(`¿Cancelar la reserva de ${r.nombre}? Se libera el lugar en la agenda.`)) cancelar.mutate();
            }}
            className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-center">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] disabled:opacity-60";

function ConfigPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const qc = useQueryClient();
  const configQ = useQuery({ queryKey: ["cargadores-config"], queryFn: getConfigCargadores });
  const teamsQ = useQuery({ queryKey: ["calendar-teams"], queryFn: getCalendarTeams });
  const [c, setC] = useState<ConfigCargadores | null>(null);
  const [localidadesTxt, setLocalidadesTxt] = useState("");
  const [avisarTxt, setAvisarTxt] = useState("");

  useEffect(() => {
    const cfg = configQ.data?.config;
    if (!cfg) return;
    setC(cfg);
    setLocalidadesTxt(cfg.localidadesEnZona.map((l) => `${l.departamento}: ${l.localidad}`).join("\n"));
    setAvisarTxt(cfg.avisarA.join(", "));
  }, [configQ.data]);

  const guardar = useMutation({
    mutationFn: (cfg: ConfigCargadores) => guardarConfigCargadores(cfg),
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["cargadores-config"] });
    },
    onError: () => toast.error("No se pudo guardar. Revisá los datos (mails, localidades)."),
  });

  if (!c) return <Spinner />;
  const dis = !puedeEditar;

  function setFranja(f: FranjaCargador, campo: "horario" | "cupo", v: string) {
    setC((prev) =>
      prev && {
        ...prev,
        franjas: { ...prev.franjas, [f]: { ...prev.franjas[f], [campo]: campo === "cupo" ? Number(v) || 0 : v } },
      },
    );
  }

  function enviar() {
    if (!c) return;
    const localidadesEnZona = localidadesTxt
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [departamento, ...resto] = l.split(":");
        return { departamento: departamento.trim(), localidad: resto.join(":").trim() };
      })
      .filter((l) => l.departamento && l.localidad);
    const avisarA = avisarTxt
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    guardar.mutate({ ...c, localidadesEnZona, avisarA });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          Hoy se ofrecen {configQ.data?.diasLibres ?? 0} días con lugar
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <Fila label="Tomar reservas">
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={dis} checked={c.activa} onChange={(e) => setC({ ...c, activa: e.target.checked })} />
            <span className="text-[var(--color-text-secondary)]">
              {c.activa ? "Prendida: la página acepta reservas" : "Apagada: la página avisa que no se toman reservas"}
            </span>
          </label>
        </Fila>
        <Fila label="Días que se ofrecen">
          <div className="flex flex-wrap gap-1.5">
            {ORDEN_DIAS.map((d) => {
              const sel = c.dias.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={dis}
                  onClick={() => setC({ ...c, dias: sel ? c.dias.filter((x) => x !== d) : [...c.dias, d] })}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    sel
                      ? "border-[var(--color-accent)] bg-[var(--color-info-bg)] text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {DIAS_SEMANA[d]}
                </button>
              );
            })}
          </div>
        </Fila>
        {(["MANANA", "TARDE"] as const).map((f) => (
          <Fila key={f} label={`Franja ${FRANJA_LABEL[f].toLowerCase()}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} w-32`}
                disabled={dis}
                value={c.franjas[f].horario}
                onChange={(e) => setFranja(f, "horario", e.target.value)}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">cupo</span>
              <input
                type="number"
                min={0}
                max={10}
                className={`${inputCls} w-16`}
                disabled={dis}
                value={c.franjas[f].cupo}
                onChange={(e) => setFranja(f, "cupo", e.target.value)}
              />
              <span className="text-xs text-[var(--color-text-muted)]">(0 = no se ofrece)</span>
            </div>
          </Fila>
        ))}
        <Fila label="Anticipación mínima (días)">
          <input
            type="number"
            min={0}
            max={60}
            className={`${inputCls} w-20`}
            disabled={dis}
            value={c.anticipacionDias}
            onChange={(e) => setC({ ...c, anticipacionDias: Number(e.target.value) || 0 })}
          />
        </Fila>
        <Fila label="Hasta cuántos días adelante">
          <input
            type="number"
            min={7}
            max={180}
            className={`${inputCls} w-20`}
            disabled={dis}
            value={c.horizonteDias}
            onChange={(e) => setC({ ...c, horizonteDias: Number(e.target.value) || 7 })}
          />
        </Fila>
        <Fila label="Equipo que instala">
          <select
            className={inputCls}
            disabled={dis}
            value={c.teamId ?? ""}
            onChange={(e) => setC({ ...c, teamId: e.target.value || null })}
          >
            <option value="">Cualquiera (bloquea si hay alguna obra ese día)</option>
            {(teamsQ.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName}
              </option>
            ))}
          </select>
        </Fila>
        <Fila label="Departamentos enteros en la zona">
          <input
            className={`${inputCls} w-full`}
            disabled={dis}
            value={c.departamentosEnZona.join(", ")}
            onChange={(e) =>
              setC({
                ...c,
                departamentosEnZona: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Fila>
        <Fila label="Otras localidades en la zona (una por línea, «Departamento: Localidad»)">
          <textarea
            rows={6}
            className={`${inputCls} w-full font-mono text-xs`}
            disabled={dis}
            value={localidadesTxt}
            onChange={(e) => setLocalidadesTxt(e.target.value)}
          />
        </Fila>
        <Fila label="Avisar cada reserva a (mails)">
          <input
            className={`${inputCls} w-full`}
            disabled={dis}
            placeholder="operaciones@voltia.com.uy, …"
            value={avisarTxt}
            onChange={(e) => setAvisarTxt(e.target.value)}
          />
        </Fila>
        {puedeEditar && (
          <div className="flex justify-end">
            <Button size="sm" onClick={enviar} disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
