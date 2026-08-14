import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";

import { proposalsV2BuilderApi } from "../../api/proposals-v2-builder.api";

// Explicativo de la comisión dentro del cotizador B2B: cuánto cobra el asesor
// con el markup que está cargando y por qué. Los números salen del mismo motor
// que calcula la propuesta (endpoint /draft/comision), no de una fórmula
// reescrita en el front: si mañana cambia el esquema, el panel lo refleja solo.

const usd = (n: number) =>
  `US$ ${n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (fraccion: number) =>
  `${(fraccion * 100).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

export function ComisionB2BPanel({
  leadId,
  savedTick,
}: {
  leadId: string;
  // Se refresca cuando el autosave confirma: así el desglose sigue al markup
  // que el asesor está moviendo.
  savedTick: number;
}) {
  const [abierto, setAbierto] = useState(false);

  const { data } = useQuery({
    queryKey: ["draft-comision", leadId, savedTick],
    queryFn: () => proposalsV2BuilderApi.getDraftComision(leadId, "EMPRESA"),
    staleTime: 0,
    retry: false,
    placeholderData: (prev) => prev,
  });

  if (!data) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        Completá los datos del sistema para ver cómo queda tu comisión.
      </div>
    );
  }

  const hayExcedente = data.comisionExcedenteUsd > 0.5;
  const diferencia = data.comisionTotalUsd - data.comisionEnReferenciaUsd;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-indigo-500/30 bg-indigo-500/5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
          Tu comisión: {usd(data.comisionTotalUsd)}{" "}
          <span className="font-normal text-[var(--color-text-muted)]">
            ({pct(data.comisionPctEfectivo)} efectivo)
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
          {abierto ? "Ocultar" : "Cómo se calcula"}
          {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {abierto ? (
        <div className="space-y-2 border-t border-indigo-500/20 px-3 py-2.5 text-[11px]">
          <p className="text-[var(--color-text-secondary)]">
            En las propuestas a empresas cobrás la comisión de siempre más una parte del markup
            que consigas por encima del <strong>{data.markupReferenciaPorcentaje}%</strong> de
            referencia. Tu markup actual es <strong>{data.markupPorcentaje}%</strong>.
          </p>

          <dl className="space-y-1 font-mono text-[11px] tabular-nums">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">
                Comisión base ({pct(data.comisionBasePorcentaje)})
              </dt>
              <dd className="text-[var(--color-text-primary)]">{usd(data.comisionBaseUsd)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">
                Por negociar ({pct(data.comisionExcedentePorcentaje)} de{" "}
                {usd(data.markupExcedenteUsd)})
              </dt>
              <dd className={hayExcedente ? "text-emerald-400" : "text-[var(--color-text-muted)]"}>
                {usd(data.comisionExcedenteUsd)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-1 font-semibold">
              <dt className="text-[var(--color-text-primary)]">Total</dt>
              <dd className="text-[var(--color-text-primary)]">{usd(data.comisionTotalUsd)}</dd>
            </div>
          </dl>

          <p className="text-[var(--color-text-muted)]">
            {hayExcedente
              ? `Son ${usd(diferencia)} más que cotizando al ${data.markupReferenciaPorcentaje}% de referencia.`
              : `Al ${data.markupReferenciaPorcentaje}% de referencia la comisión es la de siempre. Cada punto de markup que sumes empieza a contar acá.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
