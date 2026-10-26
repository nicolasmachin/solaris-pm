import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, PenLine, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { firmarEntrega, getItemsSugeridos, type Entrega, type ItemEntrega } from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { FirmaPad, type FirmaPadHandle } from "./FirmaPad";
import { Campo, errorMsg, fmtFecha, inputClass } from "./rrhhUi";

// Piezas de entregas de materiales compartidas entre Mi legajo y el legajo
// visto por RRHH.

function fmtFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Tabla chica de lo entregado. */
export function ItemsEntrega({ entrega }: { entrega: Entrega }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] text-sm">
        {entrega.items.map((it, i) => (
          <li key={i} className="flex gap-3 px-3 py-2">
            <span className="w-8 flex-shrink-0 text-right font-semibold tabular-nums text-[var(--color-text-primary)]">
              {it.cantidad}
            </span>
            <span className="text-[var(--color-text-primary)]">
              {it.descripcion}
              {it.detalle && <span className="text-[var(--color-text-muted)]"> · {it.detalle}</span>}
            </span>
          </li>
        ))}
      </ul>
      {entrega.observaciones && <p className="text-xs text-[var(--color-text-muted)]">Observaciones: {entrega.observaciones}</p>}
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Entregado el {fmtFecha(entrega.fecha)} por {entrega.entregadoPor}
      </p>
    </div>
  );
}

/** Una entrega ya firmada, en una línea. */
export function EntregaFirmadaFila({ entrega, acciones }: { entrega: Entrega; acciones?: React.ReactNode }) {
  const resumen = entrega.items.map((i) => `${i.cantidad} ${i.descripcion.toLowerCase()}`).join(", ");
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--color-text-primary)]" title={resumen}>
          {resumen}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-green-400">
          <CheckCircle2 size={11} /> Firmada el {entrega.firmadaAt ? fmtFechaHora(entrega.firmadaAt) : "—"}
          {entrega.firmaPresencial && <span className="text-[var(--color-text-muted)]"> · en persona</span>}
          <span className="text-[var(--color-text-muted)]"> · entregada el {fmtFecha(entrega.fecha)}</span>
        </p>
      </div>
      {acciones}
    </div>
  );
}

/**
 * Firmar una entrega: el detalle, la declaración y el recuadro de firma.
 * `presencial` = la firma se hace en el dispositivo de quien entrega.
 */
export function FirmarEntregaSheet({
  entrega,
  nombre,
  presencial = false,
  onClose,
  onFirmada,
}: {
  entrega: Entrega | null;
  nombre?: string;
  presencial?: boolean;
  onClose: () => void;
  onFirmada: () => void;
}) {
  const pad = useRef<FirmaPadHandle>(null);
  const [hayFirma, setHayFirma] = useState(false);

  const firmar = useMutation({
    mutationFn: (firma: string) => firmarEntrega(entrega!.id, firma),
    onSuccess: () => {
      toast.success(presencial ? "Entrega firmada. La constancia quedó en el legajo." : "¡Listo! La constancia quedó en tus documentos.");
      onFirmada();
      onClose();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar la firma")),
  });

  return (
    <Sheet
      open={Boolean(entrega)}
      onClose={onClose}
      title={presencial ? `Firma en persona${nombre ? ` · ${nombre}` : ""}` : "Firmar recibido"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!hayFirma || firmar.isPending}
            onClick={() => {
              const png = pad.current?.exportar();
              if (!png) {
                toast.error("Firmá dentro del recuadro");
                return;
              }
              firmar.mutate(png);
            }}
          >
            {firmar.isPending ? "Guardando…" : "Firmar"}
          </Button>
        </div>
      }
    >
      {entrega && (
        <div className="space-y-4">
          <ItemsEntrega entrega={entrega} />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Declaro haber recibido los materiales detallados.
          </p>
          {presencial && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Pasale el dispositivo a {nombre ?? "la persona"} para que firme. En la constancia queda que firmó en persona.
            </p>
          )}
          <FirmaPad ref={pad} onCambio={setHayFirma} />
        </div>
      )}
    </Sheet>
  );
}

/** Tarjeta destacada de una entrega que espera la firma. */
export function EntregaPendiente({
  entrega,
  onFirmar,
  acciones,
  textoFirmar = "Firmar recibido",
}: {
  entrega: Entrega;
  onFirmar: () => void;
  acciones?: React.ReactNode;
  textoFirmar?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
        <PenLine size={12} /> Falta la firma
      </p>
      <ItemsEntrega entrega={entrega} />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {acciones}
        <Button size="sm" onClick={onFirmar}>
          <span className="inline-flex items-center gap-1">
            <PenLine size={14} /> {textoFirmar}
          </span>
        </Button>
      </div>
    </div>
  );
}

type FilaItem = { descripcion: string; cantidad: string; detalle: string };
const filaVacia = (): FilaItem => ({ descripcion: "", cantidad: "1", detalle: "" });

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** RRHH registra qué se entregó; después la persona firma. */
export function RegistrarEntregaSheet({
  open,
  enviando,
  onClose,
  onSubmit,
}: {
  open: boolean;
  enviando: boolean;
  onClose: () => void;
  onSubmit: (d: { fecha: string; items: ItemEntrega[]; observaciones: string | null }) => void;
}) {
  const { data: sugeridos = [] } = useQuery({
    queryKey: ["rrhh", "entregas-sugeridos"],
    queryFn: getItemsSugeridos,
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });
  const [fecha, setFecha] = useState(hoyIso());
  const [filas, setFilas] = useState<FilaItem[]>([filaVacia()]);
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return;
    setFecha(hoyIso());
    setFilas([filaVacia()]);
    setObservaciones("");
  }, [open]);

  const set = (i: number, k: keyof FilaItem, v: string) =>
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const items = filas
    .filter((f) => f.descripcion.trim())
    .map((f) => ({ descripcion: f.descripcion.trim(), cantidad: Number(f.cantidad), detalle: f.detalle.trim() || null }));
  const cantidadesOk = items.every((i) => Number.isInteger(i.cantidad) && i.cantidad >= 1);
  const listo = fecha && items.length > 0 && cantidadesOk;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar entrega de materiales"
      size="wide"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!listo || enviando}
            onClick={() => onSubmit({ fecha, items, observaciones: observaciones.trim() || null })}
          >
            {enviando ? "Guardando…" : "Registrar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Campo label="Fecha de entrega">
          <input type="date" className={`${inputClass} sm:w-48`} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-muted)]">Qué se entregó</p>
          <datalist id="items-entrega-sugeridos">
            {sugeridos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {filas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2 last:border-b-0 sm:flex-nowrap sm:border-0 sm:pb-0">
              <input
                inputMode="numeric"
                aria-label="Cantidad"
                className={`${inputClass} w-16 text-center`}
                value={f.cantidad}
                onChange={(e) => set(i, "cantidad", e.target.value.replace(/\D/g, ""))}
              />
              <input
                list="items-entrega-sugeridos"
                placeholder="Material (casco, botas…)"
                className={`${inputClass} min-w-0 flex-1`}
                value={f.descripcion}
                onChange={(e) => set(i, "descripcion", e.target.value)}
              />
              <button
                type="button"
                title="Quitar fila"
                disabled={filas.length === 1}
                onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
                className="order-3 rounded p-2 text-[var(--color-text-muted)] hover:text-red-400 disabled:opacity-30 sm:order-4"
              >
                <Trash2 size={14} />
              </button>
              <input
                placeholder="Detalle (talle, marca…)"
                className={`${inputClass} order-4 w-full sm:order-3 sm:w-auto sm:flex-1`}
                value={f.detalle}
                onChange={(e) => set(i, "detalle", e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFilas((prev) => [...prev, filaVacia()])}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Plus size={12} /> Agregar otro material
          </button>
          {!cantidadesOk && <p className="text-xs text-red-400">Cada material lleva una cantidad mayor que cero.</p>}
        </div>
        <Campo label="Observaciones (opcional)">
          <textarea rows={2} className={inputClass} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={1000} />
        </Campo>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Queda esperando la firma: la persona la hace desde su Mi legajo (le llega un aviso) o acá mismo, en persona.
        </p>
      </div>
    </Sheet>
  );
}
