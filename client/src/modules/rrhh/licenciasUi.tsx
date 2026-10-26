import { useEffect, useState } from "react";

import {
  contarDiasHabiles,
  type DatosLicencia,
  type Licencia,
  type LicenciaTipo,
  type SaldoLicencia,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { Campo, fmtFecha, inputClass } from "./rrhhUi";

// Piezas de licencias compartidas entre Mi legajo y el legajo visto por RRHH.

export function SaldoTarjetas({ saldo }: { saldo: SaldoLicencia }) {
  const chicas: Array<[string, number, string]> = [
    ["Generados", saldo.generados, "Días que te corresponden en total"],
    ["Tomados", saldo.tomados, "Licencias anuales aprobadas"],
    ["Pedidos", saldo.pedidos, "Esperando respuesta"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 sm:col-span-1">
        <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Disponibles</p>
        <p
          className={`text-3xl font-bold tabular-nums ${saldo.disponibles < 0 ? "text-red-400" : "text-[var(--color-text-primary)]"}`}
        >
          {saldo.disponibles}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">días de licencia anual</p>
      </div>
      {chicas.map(([label, n, ayuda]) => (
        <div key={label} className="rounded-lg bg-[var(--color-bg-card-hover)] p-3" title={ayuda}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">{n}</p>
        </div>
      ))}
    </div>
  );
}

export function EstadoLicencia({ l }: { l: Licencia }) {
  const map: Record<Licencia["estado"], [string, string]> = {
    SOLICITADA: ["Pedida", "bg-blue-500/15 text-blue-400"],
    APROBADA: ["Aprobada", "bg-green-500/15 text-green-400"],
    RECHAZADA: ["No aprobada", "bg-red-500/15 text-red-400"],
    CANCELADA: ["Cancelada", "bg-zinc-500/15 text-zinc-400"],
  };
  const [texto, tono] = map[l.estado];
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${tono}`}>{texto}</span>;
}

/** Una licencia en una fila: tipo, fechas, días, estado. `acciones` va a la derecha. */
export function LicenciaFila({ l, acciones, nombre }: { l: Licencia; acciones?: React.ReactNode; nombre?: string }) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-[var(--color-border)] py-3 last:border-b-0 sm:flex-row sm:items-center ${
        l.estado === "CANCELADA" || l.estado === "RECHAZADA" ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-primary)]">
          {nombre && <span className="font-medium">{nombre} ·</span>}
          <span>{l.tipoLabel}</span>
          <EstadoLicencia l={l} />
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
          {l.desde === l.hasta ? `El ${fmtFecha(l.desde)}` : `Del ${fmtFecha(l.desde)} al ${fmtFecha(l.hasta)}`} ·{" "}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {l.dias} día{l.dias === 1 ? "" : "s"}
          </span>
          {l.nota && ` · ${l.nota}`}
        </p>
        {l.estado === "RECHAZADA" && l.motivoRechazo && (
          <p className="mt-1 text-xs text-red-400">Motivo: {l.motivoRechazo}</p>
        )}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-1">{acciones}</div>}
    </div>
  );
}

export const botonChico =
  "inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] disabled:opacity-50";

/**
 * Modal de licencia. "pedir": la persona (los días los cuenta el sistema y los
 * confirma administración). "registrar" y "editar": RRHH, con los días editables.
 */
export function LicenciaSheet({
  open,
  modo,
  tipos,
  inicial,
  enviando,
  onClose,
  onSubmit,
}: {
  open: boolean;
  modo: "pedir" | "registrar" | "editar";
  tipos: Array<{ tipo: LicenciaTipo; label: string }>;
  inicial?: Licencia | null;
  enviando: boolean;
  onClose: () => void;
  onSubmit: (datos: DatosLicencia) => void;
}) {
  const [tipo, setTipo] = useState<LicenciaTipo>("ANUAL");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [dias, setDias] = useState("");
  const [diasTocados, setDiasTocados] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo(inicial?.tipo ?? "ANUAL");
    setDesde(inicial?.desde ?? "");
    setHasta(inicial?.hasta ?? "");
    setNota(inicial?.nota ?? "");
    setDias(inicial ? String(inicial.dias) : "");
    setDiasTocados(Boolean(inicial));
  }, [open, inicial]);

  const conteo = contarDiasHabiles(desde, hasta);
  // Mientras RRHH no toque los días, siguen al conteo.
  useEffect(() => {
    if (!diasTocados && desde && hasta) setDias(String(conteo));
  }, [conteo, desde, hasta, diasTocados]);

  const rangoMal = Boolean(desde && hasta && hasta < desde);
  const diasNum = Number(dias);
  const editaDias = modo !== "pedir";
  const listo =
    desde && hasta && !rangoMal && (!editaDias || (dias !== "" && Number.isInteger(diasNum) && diasNum >= 0));

  const titulos = { pedir: "Pedir licencia", registrar: "Registrar licencia", editar: "Corregir licencia" };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titulos[modo]}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!listo || enviando}
            onClick={() =>
              onSubmit({
                tipo,
                desde,
                hasta,
                nota: nota.trim() || null,
                ...(editaDias ? { dias: diasNum } : {}),
              })
            }
          >
            {enviando ? "Guardando…" : modo === "pedir" ? "Pedir" : "Guardar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Campo label="Tipo de licencia">
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as LicenciaTipo)}>
            {tipos.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Desde">
            <input type="date" className={inputClass} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo label="Hasta (inclusive)">
            <input type="date" className={inputClass} value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
        </div>
        {rangoMal && <p className="text-xs text-red-400">La fecha de vuelta es anterior a la de salida.</p>}
        {editaDias ? (
          <Campo
            label="Días que cuenta"
            ayuda={`De lunes a viernes son ${conteo}. Si hay feriados en el medio o se cuenta distinto, corregilo: es lo que descuenta del saldo.`}
          >
            <input
              inputMode="numeric"
              className={inputClass}
              value={dias}
              onChange={(e) => {
                setDias(e.target.value.replace(/\D/g, ""));
                setDiasTocados(true);
              }}
            />
          </Campo>
        ) : (
          desde &&
          hasta &&
          !rangoMal && (
            <p className="rounded-lg bg-[var(--color-bg-card-hover)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              ≈ <span className="font-semibold text-[var(--color-text-primary)]">{conteo} días hábiles</span>
              <span className="block text-[11px] text-[var(--color-text-muted)]">
                Contados de lunes a viernes. Administración confirma los días al aprobarla (los feriados no cuentan).
              </span>
            </p>
          )
        )}
        <Campo label="Nota (opcional)">
          <input className={inputClass} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
        </Campo>
      </div>
    </Sheet>
  );
}

/** Aprobar (con los días corregibles) o rechazar (con motivo) un pedido. */
export function ResolverLicenciaSheet({
  licencia,
  nombre,
  enviando,
  onClose,
  onResolver,
}: {
  licencia: Licencia | null;
  nombre?: string;
  enviando: boolean;
  onClose: () => void;
  onResolver: (d: { aprobar: boolean; motivo?: string; dias?: number }) => void;
}) {
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [rechazar, setRechazar] = useState(false);
  useEffect(() => {
    setDias(licencia ? String(licencia.dias) : "");
    setMotivo("");
    setRechazar(false);
  }, [licencia]);

  return (
    <Sheet
      open={Boolean(licencia)}
      onClose={onClose}
      title="Responder pedido de licencia"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {rechazar ? (
            <Button variant="danger" disabled={!motivo.trim() || enviando} onClick={() => onResolver({ aprobar: false, motivo: motivo.trim() })}>
              No aprobar
            </Button>
          ) : (
            <Button
              disabled={dias === "" || enviando}
              onClick={() => onResolver({ aprobar: true, dias: Number(dias) })}
            >
              Aprobar
            </Button>
          )}
        </div>
      }
    >
      {licencia && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {nombre && <span className="font-medium text-[var(--color-text-primary)]">{nombre}: </span>}
            {licencia.tipoLabel}, del {fmtFecha(licencia.desde)} al {fmtFecha(licencia.hasta)}
            {licencia.nota && ` · «${licencia.nota}»`}
          </p>
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-sm">
            {[
              [false, "Aprobar"],
              [true, "No aprobar"],
            ].map(([v, label]) => (
              <button
                key={String(label)}
                onClick={() => setRechazar(v as boolean)}
                className={`px-3 py-1.5 ${rechazar === v ? "bg-[var(--color-accent)] font-semibold text-gray-900" : "text-[var(--color-text-secondary)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {rechazar ? (
            <Campo label="¿Por qué no?" ayuda="Se lo mandamos a la persona.">
              <textarea rows={3} className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
            </Campo>
          ) : (
            <Campo label="Días que cuenta" ayuda="Se propusieron contando de lunes a viernes sin feriados. Corregilo si corresponde.">
              <input inputMode="numeric" className={inputClass} value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} />
            </Campo>
          )}
        </div>
      )}
    </Sheet>
  );
}
