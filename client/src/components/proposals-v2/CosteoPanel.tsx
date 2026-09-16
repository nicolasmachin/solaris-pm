// Costeo de ESTA cotización: réplica de la planilla con la que se costea a mano
// (COSTEO / PRICING / Flujo de caja), con la columna de costos editable.
//
// Lo que se edita acá NO toca los defaults ni ninguna otra propuesta: viaja
// dentro del borrador, se autoguarda con el resto del formulario y queda pegado
// a la versión que se publique.
//
// Un campo vacío significa "usar el valor de fábrica". Por eso el input se
// muestra en blanco cuando no hay ajuste: escribir un número lo pisa, borrarlo
// vuelve al original.

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { useDraftCosteo } from "../../hooks/useDraftCosteo";
import type {
  ProposalCostosOverride,
  ProposalCosteoCalc,
  ProposalDraftData,
  ProposalVariante,
} from "../../types/proposals-v2";

const IVA = 0.22;

function usd(n: number, dec = 1): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const th = "px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide";
const td = "px-2 py-1 text-sm tabular-nums";
const tdNum = `${td} text-right`;

/** Input de costo. Vacío = usar el valor de fábrica. */
function CostoInput({
  valor,
  fabrica,
  onChange,
  decimales = 2,
}: {
  valor: number | undefined;
  fabrica: number;
  onChange: (v: number | undefined) => void;
  decimales?: number;
}) {
  // Estado local para no pelear con el usuario mientras tipea (un "12." es
  // intermedio válido y Number() lo rompería en cada tecla).
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor === undefined ? "" : String(valor));
  const pisado = valor !== undefined && valor !== fabrica;

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        step="any"
        min={0}
        value={mostrado}
        placeholder={usd(fabrica, decimales)}
        onChange={(e) => {
          setTexto(e.target.value);
          const v = e.target.value.trim();
          if (v === "") onChange(undefined);
          else if (Number.isFinite(Number(v))) onChange(Number(v));
        }}
        onBlur={() => setTexto(null)}
        className={`w-24 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] ${
          pisado
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-semibold"
            : "border-[var(--color-border)] bg-[var(--color-bg-app)]"
        }`}
      />
      {pisado ? (
        <button
          type="button"
          onClick={() => {
            setTexto(null);
            onChange(undefined);
          }}
          title={`Volver al valor original (${usd(fabrica, decimales)})`}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="w-3.5" />
      )}
    </div>
  );
}

type ItemKey = "panel" | "estructura" | "electrica" | "inversor" | "meter";

const ITEMS: { key: ItemKey; nombre: string }[] = [
  { key: "panel", nombre: "Paneles" },
  { key: "estructura", nombre: "Estructuras" },
  { key: "electrica", nombre: "Eléctrica" },
  { key: "inversor", nombre: "Inversor" },
  { key: "meter", nombre: "Meter" },
];

export function CosteoPanel({
  data,
  onChange,
  leadId,
  variante,
  savedTick,
}: {
  data: ProposalDraftData;
  onChange: (next: ProposalDraftData) => void;
  leadId: string;
  variante: ProposalVariante;
  savedTick: number;
}) {
  const { data: costeo, status, missing } = useDraftCosteo({
    leadId,
    savedTick,
    enabled: Boolean(leadId),
    variante,
  });

  const ajustes: ProposalCostosOverride = data.costos ?? {};

  // Escribe un ajuste. `undefined` borra la clave, que es lo que devuelve la
  // línea a su valor de fábrica: si quedara en el objeto como undefined, el
  // JSON del autosave la mandaría igual y el backend la rechazaría.
  const setAjuste = (k: keyof ProposalCostosOverride, v: number | undefined) => {
    const next = { ...ajustes };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange({ ...data, costos: Object.keys(next).length > 0 ? next : undefined });
  };

  if (status === "invalid") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
        Para ver el costeo falta completar: <b>{missing.join(", ") || "datos del sistema"}</b>.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
        No se pudo calcular el costeo.
      </div>
    );
  }
  if (!costeo) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 rounded bg-[var(--color-border)]" />
        ))}
      </div>
    );
  }

  const c: ProposalCosteoCalc = costeo.calc;
  const f: ProposalCosteoCalc = costeo.fabrica;

  // Aviso: el costeo dice una cantidad de paneles y el sistema otra. Es legítimo
  // (se puede costear de más), pero pasa desapercibido y termina en una
  // propuesta con el costo de un sistema que no es el que se vende.
  const desfasePaneles = c.panelCantidad !== data.sistema.cantidadPaneles;
  const hayAjustes = Object.keys(ajustes).length > 0;

  const flujo: { label: string; valor: number; fuerte?: boolean }[] = [
    { label: "Cobro adelanto cliente", valor: c.cobroAdelantoCliente },
    { label: "Pago al proveedor", valor: c.pagoAlProveedor },
    { label: "Subtotal", valor: c.cobroAdelantoCliente + c.pagoAlProveedor, fuerte: true },
    { label: "Cobro saldo cliente", valor: c.cobroSaldoCliente },
    { label: "Pago mano de obra", valor: c.pagoManoDeObra },
    {
      label: "Subtotal",
      valor: c.cobroAdelantoCliente + c.pagoAlProveedor + c.cobroSaldoCliente + c.pagoManoDeObra,
      fuerte: true,
    },
    { label: "Pago IVA", valor: c.pagoIva },
    { label: "Devolución IVA", valor: c.devolucionIva },
    { label: "Pago vendedor", valor: c.pagoVendedor },
    { label: "Pago BBVA", valor: c.pagoBbva },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Los costos que cambies acá valen <b>solo para esta cotización</b>. No afectan a las
          demás ni a la configuración general. Se guardan solos.
        </p>
        {hayAjustes && (
          <button
            type="button"
            onClick={() => onChange({ ...data, costos: undefined })}
            className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-bg-app)]"
          >
            <RotateCcw className="h-3 w-3" /> Volver todo a los valores originales
          </button>
        )}
      </div>

      {desfasePaneles && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          Estás costeando <b>{c.panelCantidad} paneles</b> pero el sistema cotizado tiene{" "}
          <b>{data.sistema.cantidadPaneles}</b>. Revisá que sea a propósito.
        </div>
      )}

      {/* ── COSTEO ── */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className={`${th} bg-amber-500/15 text-amber-800 dark:text-amber-300`}>Costeo</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className={th}>Ítem</th>
                <th className={`${th} text-right`}>Costo/unidad</th>
                <th className={`${th} text-right`}>Cantidad</th>
                <th className={`${th} text-right`}>Subtotal</th>
                <th className={`${th} text-right`}>Con IVA</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map(({ key, nombre }) => {
                const kPrecio = `${key}PrecioUnitario` as keyof ProposalCostosOverride;
                const kCant = `${key}Cantidad` as keyof ProposalCostosOverride;
                const precio = c[`${key}PrecioUnitario` as keyof ProposalCosteoCalc] as number;
                const cant = c[`${key}Cantidad` as keyof ProposalCosteoCalc] as number;
                const sub = precio * cant;
                return (
                  <tr key={key} className="border-b border-[var(--color-border)]/60">
                    <td className={`${td} font-medium`}>{nombre}</td>
                    <td className={tdNum}>
                      <CostoInput
                        valor={ajustes[kPrecio]}
                        fabrica={f[`${key}PrecioUnitario` as keyof ProposalCosteoCalc] as number}
                        onChange={(v) => setAjuste(kPrecio, v)}
                      />
                    </td>
                    <td className={tdNum}>
                      <CostoInput
                        valor={ajustes[kCant]}
                        fabrica={f[`${key}Cantidad` as keyof ProposalCosteoCalc] as number}
                        onChange={(v) => setAjuste(kCant, v)}
                        decimales={0}
                      />
                    </td>
                    <td className={tdNum}>{usd(sub)}</td>
                    <td className={`${tdNum} text-[var(--color-text-muted)]`}>
                      {usd(sub * (1 + IVA))}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
                <td className={`${td} font-semibold`} colSpan={3}>
                  Equipamiento
                </td>
                <td className={`${tdNum} font-semibold`}>{usd(c.costoEquipamientoSinIva)}</td>
                <td className={`${tdNum} text-[var(--color-text-muted)]`}>
                  {usd(c.costoEquipamientoConIva)}
                </td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={`${td} font-medium`} colSpan={2}>
                  Costos fijos
                </td>
                <td className={tdNum} colSpan={2}>
                  <CostoInput
                    valor={ajustes.costoFijoAsignado}
                    fabrica={f.costoFijoAsignadoUsdSinIva}
                    onChange={(v) => setAjuste("costoFijoAsignado", v)}
                  />
                </td>
                <td className={`${tdNum} text-[var(--color-text-muted)]`}>
                  {usd(c.costoFijoAsignadoUsdConIva)}
                </td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={`${td} font-medium`} colSpan={2}>
                  Costos variables
                </td>
                <td className={tdNum} colSpan={2}>
                  <CostoInput
                    valor={ajustes.costoVariable}
                    fabrica={f.costoVariableUsdSinIva}
                    onChange={(v) => setAjuste("costoVariable", v)}
                  />
                </td>
                <td className={`${tdNum} text-[var(--color-text-muted)]`}>
                  {usd(c.costoVariableUsdConIva)}
                </td>
              </tr>
              <tr className="bg-amber-500/10">
                <td className={`${td} font-bold`} colSpan={3}>
                  Total
                </td>
                <td className={`${tdNum} font-bold`}>{usd(c.costoTotalSinIva)}</td>
                <td className={`${tdNum} font-bold`}>{usd(c.costoTotalConIva)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── PRICING ── */}
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          <div className={`${th} bg-emerald-500/15 text-emerald-800 dark:text-emerald-300`}>
            Pricing
          </div>
          <table className="w-full">
            <tbody>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={td}>Costos</td>
                <td className={tdNum}>{usd(c.costoTotalSinIva)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={`${td} font-medium`}>Mano de obra</td>
                <td className={tdNum}>
                  <CostoInput
                    valor={ajustes.manoDeObra}
                    fabrica={f.manoDeObraUsdSinIva}
                    onChange={(v) => setAjuste("manoDeObra", v)}
                  />
                </td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={td}>Markup</td>
                <td className={tdNum}>{usd(c.markupUsdSinIva)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={td}>Comisión ventas</td>
                <td className={tdNum}>{usd(c.comisionVentasUsdSinIva)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={td}>Comisión BBVA</td>
                <td className={tdNum}>{usd(c.comisionBbvaUsdSinIva)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
                <td className={`${td} font-semibold`}>Subtotal</td>
                <td className={`${tdNum} font-semibold`}>{usd(c.subtotalSinIva)}</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/60">
                <td className={td}>IVA</td>
                <td className={tdNum}>{usd(c.iva)}</td>
              </tr>
              <tr className="bg-emerald-500/10">
                <td className={`${td} font-bold`}>Total con IVA</td>
                <td className={`${tdNum} font-bold`}>{usd(c.totalConIva)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── FLUJO DE CAJA ── */}
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          <div className={`${th} bg-sky-500/15 text-sky-800 dark:text-sky-300`}>
            Flujo de caja (USD)
          </div>
          <table className="w-full">
            <tbody>
              {flujo.map((r, i) => (
                <tr
                  key={`${r.label}-${i}`}
                  className={`border-b border-[var(--color-border)]/60 ${
                    r.fuerte ? "bg-[var(--color-bg-app)]/40" : ""
                  }`}
                >
                  <td className={`${td} ${r.fuerte ? "font-semibold" : ""}`}>{r.label}</td>
                  <td
                    className={`${tdNum} ${r.fuerte ? "font-semibold" : ""} ${
                      r.valor < 0 ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {usd(r.valor)}
                  </td>
                </tr>
              ))}
              <tr className="bg-sky-500/10">
                <td className={`${td} font-bold`}>Ganancia final</td>
                <td className={`${tdNum} font-bold`}>{usd(c.gananciaFinal)}</td>
              </tr>
              <tr>
                <td className={`${td} font-semibold`}>Margen</td>
                <td className={`${tdNum} font-semibold`}>{(c.margen * 100).toFixed(0)} %</td>
              </tr>
              <tr className="border-t border-[var(--color-border)]">
                <td className={td}>USD por watt</td>
                <td className={tdNum}>{usd(c.usdPorWatt, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
