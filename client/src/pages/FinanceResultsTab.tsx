import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  getFinanceResults,
  type ResultItem,
  type ResultProjectGroup,
  type ResultsDto,
  type ResultsPeriodo,
} from "../api/results.api";
import { fmtCurrency, currentMonthYear, MONTH_NAMES } from "../lib/finance";

const TRIMESTRES = [
  { value: 1, label: "T1 (ene-mar)" },
  { value: 2, label: "T2 (abr-jun)" },
  { value: 3, label: "T3 (jul-sep)" },
  { value: 4, label: "T4 (oct-dic)" },
];

export function FinanceResultsTab() {
  const { mes: defaultMes, anio: defaultAnio } = currentMonthYear();
  const [periodo, setPeriodo] = useState<ResultsPeriodo>("MENSUAL");
  const [mes, setMes] = useState<number>(defaultMes);
  const [trimestre, setTrimestre] = useState<number>(Math.ceil(defaultMes / 3));
  const [anio, setAnio] = useState<number>(defaultAnio);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-results", periodo, mes, trimestre, anio],
    queryFn: () =>
      getFinanceResults({
        periodo,
        anio,
        ...(periodo === "MENSUAL" ? { mes } : {}),
        ...(periodo === "TRIMESTRAL" ? { trimestre } : {}),
      }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
          {(["MENSUAL", "TRIMESTRAL", "ANUAL"] as ResultsPeriodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 transition-colors ${
                periodo === p
                  ? "bg-[var(--color-accent)] text-gray-900 font-semibold"
                  : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
              }`}
            >
              {p === "MENSUAL" ? "Mensual" : p === "TRIMESTRAL" ? "Trimestral" : "Anual"}
            </button>
          ))}
        </div>

        {periodo === "MENSUAL" && (
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        {periodo === "TRIMESTRAL" && (
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            {TRIMESTRES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}

        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        >
          {[defaultAnio - 2, defaultAnio - 1, defaultAnio, defaultAnio + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando…</div>
      ) : (
        <ResultsTable data={data} />
      )}

      {data && (
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
          Montos en UYU. Movimientos en USD se convierten al TC actual ({data.fallbackUsdToUyu.toFixed(2)}).
          Excluye AJUSTE_CONCILIACION. Solo movimientos PAGADO.
        </p>
      )}
    </div>
  );
}

function periodLabel(d: ResultsDto): string {
  if (d.periodo === "MENSUAL" && d.mes) return `${MONTH_NAMES[d.mes - 1]} ${d.anio}`;
  if (d.periodo === "TRIMESTRAL" && d.trimestre) return `T${d.trimestre} ${d.anio}`;
  return `Año ${d.anio}`;
}

function ResultsTable({ data }: { data: ResultsDto }) {
  const e = data.egresos;
  const showOtros = e.otros.total > 0;
  const showProveedores = e.pagoProveedores.total > 0;
  const showStock = e.comprasStock.total > 0;

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[var(--color-bg-app)] border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {periodLabel(data)}
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
          {data.fechaInicio.slice(0, 10)} → {new Date(new Date(data.fechaFin).getTime() - 86400000).toISOString().slice(0, 10)}
        </span>
      </div>

      <CategoryRow
        label="Ingresos"
        value={data.ingresos.total}
        variant="positive"
        items={data.ingresos.items}
      />

      <SectionLabel>Egresos por categoría</SectionLabel>
      <CategoryRow
        label="Costos fijos"
        value={e.costosFijos.total}
        variant="negative"
        items={e.costosFijos.items}
      />
      <CategoryRow
        label="Costos variables"
        value={e.costosVariables.total}
        variant="negative"
        items={e.costosVariables.items}
      />
      <CategoryRow
        label="Salidas por proyecto"
        value={e.salidasProyecto.total}
        variant="negative"
        byProject={e.salidasProyecto.byProject}
      />
      {showProveedores && (
        <CategoryRow
          label="Pago a proveedores"
          value={e.pagoProveedores.total}
          variant="negative"
          items={e.pagoProveedores.items}
        />
      )}
      {showStock && (
        <CategoryRow
          label="Compras de stock"
          value={e.comprasStock.total}
          variant="negative"
          items={e.comprasStock.items}
        />
      )}
      {showOtros && (
        <CategoryRow label="Otros" value={e.otros.total} variant="negative" items={e.otros.items} />
      )}

      <div className="px-4 py-3 bg-[var(--color-bg-app)] border-t border-[var(--color-border)] flex justify-between items-center text-sm font-semibold">
        <span>Total egresos</span>
        <span className="tabular-nums text-red-400">-{fmtCurrency(e.total, "UYU")}</span>
      </div>

      <div className="px-4 py-4 border-t-2 border-[var(--color-border-hover)] flex justify-between items-center">
        <span className="text-base font-semibold text-[var(--color-text-primary)]">Resultado</span>
        <span
          className={`text-base font-bold tabular-nums ${
            data.resultado >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {data.resultado >= 0 ? "+" : ""}
          {fmtCurrency(data.resultado, "UYU")}
        </span>
      </div>
      <div className="px-4 py-2 border-t border-[var(--color-border)] flex justify-between items-center text-sm">
        <span className="text-[var(--color-text-secondary)]">Rentabilidad</span>
        <span
          className={`font-semibold tabular-nums ${
            data.rentabilidad >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {data.rentabilidad}%
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-1.5 bg-[var(--color-bg-app)]/40 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">
      {children}
    </div>
  );
}

function CategoryRow({
  label,
  value,
  variant,
  items,
  byProject,
}: {
  label: string;
  value: number;
  variant: "positive" | "negative";
  items?: ResultItem[];
  byProject?: ResultProjectGroup[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = (items && items.length > 0) || (byProject && byProject.length > 0);
  const expandable = hasContent;

  return (
    <>
      <div
        className={`px-4 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-sm ${
          expandable ? "cursor-pointer hover:bg-[var(--color-bg-card-hover)]" : ""
        }`}
        onClick={() => expandable && setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
          {expandable ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            )
          ) : (
            <span className="w-3.5" />
          )}
          {label}
        </span>
        <span
          className={`tabular-nums ${
            variant === "positive" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"
          }`}
        >
          {variant === "positive" ? "+" : "-"}
          {fmtCurrency(value, "UYU")}
        </span>
      </div>

      {expanded && items && items.length > 0 && (
        <ItemList items={items} />
      )}
      {expanded && byProject && byProject.length > 0 && (
        <ProjectList groups={byProject} />
      )}
    </>
  );
}

function ItemList({ items }: { items: ResultItem[] }) {
  return (
    <>
      {items.map((it) => (
        <div
          key={it.id}
          className="px-4 py-1.5 pl-10 border-t border-[var(--color-border)] flex justify-between items-center text-xs text-[var(--color-text-secondary)]"
        >
          <span className="truncate flex-1 mr-3">
            <span className="text-[var(--color-text-muted)] tabular-nums mr-2">
              {it.fecha.slice(0, 10)}
            </span>
            {it.descripcion}
            {it.supplierName && (
              <span className="text-[var(--color-text-muted)]"> · {it.supplierName}</span>
            )}
            {it.projectClientName && (
              <span className="text-[var(--color-text-muted)]"> · {it.projectClientName}</span>
            )}
          </span>
          <span className="tabular-nums shrink-0">{fmtCurrency(it.monto, it.moneda)}</span>
        </div>
      ))}
    </>
  );
}

function ProjectList({ groups }: { groups: ResultProjectGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <ProjectGroupRow key={g.projectId || g.clientName} group={g} />
      ))}
    </>
  );
}

function ProjectGroupRow({ group }: { group: ResultProjectGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="px-4 py-2 pl-9 border-t border-[var(--color-border)] flex justify-between items-center text-xs cursor-pointer hover:bg-[var(--color-bg-card-hover)]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5 text-[var(--color-text-primary)] font-medium">
          {open ? (
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
          )}
          {group.clientName}
          {group.code && (
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{group.code}</span>
          )}
        </span>
        <span className="tabular-nums text-[var(--color-text-secondary)]">
          {fmtCurrency(group.total, "UYU")}
        </span>
      </div>
      {open && (
        <>
          {group.items.map((it) => (
            <div
              key={it.id}
              className="px-4 py-1.5 pl-14 border-t border-[var(--color-border)] flex justify-between items-center text-[11px] text-[var(--color-text-muted)]"
            >
              <span className="truncate flex-1 mr-3">
                <span className="tabular-nums mr-2">{it.fecha.slice(0, 10)}</span>
                {it.descripcion}
                {it.supplierName && <span> · {it.supplierName}</span>}
              </span>
              <span className="tabular-nums shrink-0">{fmtCurrency(it.monto, it.moneda)}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
