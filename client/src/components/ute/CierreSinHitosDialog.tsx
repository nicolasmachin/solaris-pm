import { useState } from "react";

import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import type { UtePatchInput } from "../../api/uteProcess.api";

/**
 * Dar el trámite por finalizado le avisa al cliente que ya puede encender su
 * planta, y ese aviso tiene plazo en horas. Por eso el backend rechaza el cierre
 * cuando faltan hitos: acá se muestra qué falta y, si igual hay que cerrarlo
 * (UTE salteó un paso, el cliente no siguió), se exige el motivo, que queda
 * guardado y visible en la ficha.
 */
const CODIGO_HITOS_INCOMPLETOS = "UTE_HITOS_INCOMPLETOS";

type ErrorApi = { response?: { data?: { code?: string; message?: string } } };

/** Lee el error de la API. Devuelve el mensaje si es el de hitos incompletos. */
export function mensajeHitosIncompletos(e: unknown): string | null {
  const data = (e as ErrorApi)?.response?.data;
  return data?.code === CODIGO_HITOS_INCOMPLETOS ? (data.message ?? "Faltan hitos del trámite") : null;
}

interface Props {
  /** El mensaje del backend, con la lista de lo que falta. null = cerrado. */
  mensaje: string | null;
  guardando?: boolean;
  onCerrar: () => void;
  /** Reintenta el mismo guardado, ahora con el motivo escrito. */
  onConfirmar: (extra: Pick<UtePatchInput, "cierreSinHitos" | "cierreSinHitosMotivo">) => void;
}

export function CierreSinHitosDialog({ mensaje, guardando = false, onCerrar, onConfirmar }: Props) {
  const [asumido, setAsumido] = useState(false);
  const [motivo, setMotivo] = useState("");

  function cerrar() {
    setAsumido(false);
    setMotivo("");
    onCerrar();
  }

  const puedeConfirmar = asumido && motivo.trim().length >= 5;

  return (
    <Sheet
      open={mensaje !== null}
      onClose={cerrar}
      title="Faltan pasos del trámite"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={cerrar} disabled={guardando}>
            Cargar las fechas
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={guardando}
            disabled={!puedeConfirmar}
            onClick={() => onConfirmar({ cierreSinHitos: true, cierreSinHitosMotivo: motivo.trim() })}
          >
            Cerrar igual
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--color-text-secondary)]">{mensaje}</p>

      <div className="mt-3 rounded-md bg-[var(--color-warning-bg)] p-3 text-[13px] leading-relaxed text-[var(--color-warning-text)]">
        Cerrar el trámite le avisa al cliente que <strong>ya puede encender su planta</strong>, con un
        plazo de 24 a 48 horas. Si la obra no está hecha, ese aviso no tiene que salir.
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={asumido}
          onChange={(e) => setAsumido(e.target.checked)}
          className="mt-0.5"
        />
        <span>El trámite se cerró sin esos pasos y hay que dejarlo así.</span>
      </label>

      <label className="mt-3 block text-sm">
        <span className="text-[var(--color-text-secondary)]">Motivo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={!asumido}
          rows={3}
          maxLength={500}
          placeholder="Por ejemplo: el cliente no avanzó con la obra y se cerró el caso en UTE."
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-input)] p-2 text-sm disabled:opacity-50"
        />
      </label>
      {asumido && motivo.trim().length > 0 && motivo.trim().length < 5 && (
        <p className="mt-1 text-xs text-[var(--color-danger-text)]">Escribí un motivo un poco más largo.</p>
      )}
    </Sheet>
  );
}
