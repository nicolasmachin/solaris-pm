import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";

import { getClientes } from "../../../api/clientes.api";
import { planGranizoApi, type PlanGranizo } from "../../../api/planGranizo.api";
import { EstadoPlanChip } from "../../../components/planGranizo/EstadoPlanChip";
import { ESTADO_PLAN_LABEL, etiquetaAlerta, fmtFecha, fmtUsd, NOMBRE_ALERTA } from "../../../components/planGranizo/estado";
import { PlanGranizoModal } from "../../../components/planGranizo/PlanGranizoModal";
import { Spinner } from "../../../components/ui/Spinner";
import { usePermission } from "../../../hooks/usePermission";

// Pestaña "Plan granizo" de Experiencia Solar: todos los Planes de Protección
// contra Granizo, con lo que requiere acción arriba. El nombre del cliente sale
// en rojo cuando falta un mes o menos para vencer, está en gracia, suspendido o
// vencido.

const FILTROS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ALERTA", label: "Requieren acción" },
  { value: "PENDIENTE_ACTIVACION", label: ESTADO_PLAN_LABEL.PENDIENTE_ACTIVACION },
  { value: "PENDIENTE_INICIO", label: ESTADO_PLAN_LABEL.PENDIENTE_INICIO },
  { value: "EN_CARENCIA", label: ESTADO_PLAN_LABEL.EN_CARENCIA },
  { value: "VIGENTE", label: ESTADO_PLAN_LABEL.VIGENTE },
  { value: "POR_VENCER", label: ESTADO_PLAN_LABEL.POR_VENCER },
  { value: "EN_GRACIA", label: ESTADO_PLAN_LABEL.EN_GRACIA },
  { value: "SUSPENDIDA", label: ESTADO_PLAN_LABEL.SUSPENDIDA },
  { value: "VENCIDA", label: ESTADO_PLAN_LABEL.VENCIDA },
  { value: "CANCELADA", label: ESTADO_PLAN_LABEL.CANCELADA },
];

function Kpi({ label, value, tono }: { label: string; value: string | number; tono?: "alerta" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
      <div className={`text-xl font-bold ${tono === "alerta" ? "text-[var(--color-danger-text)]" : "text-[var(--color-text-primary)]"}`}>{value}</div>
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function faltantes(p: PlanGranizo): string[] {
  const out: string[] = [];
  if (p.estadoBase === "CANCELADA") return out;
  if (p.estado.faltaFirma) out.push("Anexo A");
  if (p.estado.faltaPago) out.push("1er pago");
  if (!p.sinCarencia && p.fotosInicio.length === 0) out.push("fotos");
  const pendientes = p.siniestros.filter((s) => s.plazos.pendiente).length;
  if (pendientes) out.push(`${pendientes} daño${pendientes === 1 ? "" : "s"} en curso`);
  return out;
}

export function PlanGranizoPage() {
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [alta, setAlta] = useState(false);

  const list = useQuery({
    queryKey: ["plan-granizo-list", estado, q],
    queryFn: () => planGranizoApi.list({ estado: estado || undefined, q: q || undefined }),
  });
  const k = list.data?.kpis;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Plan de Protección contra Granizo: USD 12 por panel por año, sólo paneles, sólo obras de Voltia. Es un servicio de reposición de Voltia,{" "}
        <strong>no un seguro</strong>: decí “plan”, “anualidad” y “daño por granizo”.
      </p>

      {k ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Planes que cubren hoy" value={k.vigentes} />
          <Kpi label="Paneles cubiertos" value={k.panelesCubiertos} />
          <Kpi label={`Cobrado en ${k.anio}`} value={fmtUsd(k.cobradoAnioUsd)} />
          <Kpi label={`Reposiciones ${k.anio}`} value={fmtUsd(k.reposicionesAnioUsd)} />
          <Kpi label="A cobrar" value={fmtUsd(k.pendienteCobroUsd)} tono={k.pendienteCobroUsd > 0 ? "alerta" : undefined} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            placeholder="Buscar cliente o código"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setEstado(f.value)}
              className={`rounded-full px-3 py-1 text-xs ${
                estado === f.value
                  ? "bg-[var(--color-accent)] font-semibold text-[#1f2937]"
                  : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {f.label}
              {f.value === "ALERTA" && k?.enAlerta ? ` (${k.enAlerta})` : ""}
            </button>
          ))}
        </div>
        <button type="button" className="ml-auto text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAlta((v) => !v)}>
          + Dar de alta un plan
        </button>
      </div>

      {alta ? <BuscarCliente /> : null}

      {list.isLoading ? (
        <Spinner />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No hay planes con ese filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Paneles</th>
                <th className="px-3 py-2 text-right">Anualidad</th>
                <th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2">Próximo cobro</th>
                <th className="px-3 py-2">Falta</th>
              </tr>
            </thead>
            <tbody>
              {list.data!.items.map((p) => {
                const falta = faltantes(p);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setAbierto(p.id)}
                    className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card)]"
                  >
                    <td className="px-3 py-2">
                      <div className={`font-medium ${p.estado.alerta ? NOMBRE_ALERTA : "text-[var(--color-text-primary)]"}`}>
                        {p.project.clientName}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{p.project.code}</div>
                    </td>
                    <td className="px-3 py-2">
                      <EstadoPlanChip
                        estado={p.estado.estado}
                        texto={p.estado.alerta ? etiquetaAlerta(p.estado) : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{p.cantidadPaneles}</td>
                    <td className="px-3 py-2 text-right">{fmtUsd(p.montoAnualUsd)}</td>
                    <td className="px-3 py-2">{fmtFecha(p.estado.vencimiento)}</td>
                    <td className="px-3 py-2">
                      {p.estado.proximoCobro ? `${fmtUsd(p.estado.proximoCobro.montoUsd)} · ${fmtFecha(p.estado.proximoCobro.fecha)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-[var(--color-warning-text)]">{falta.join(" · ") || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierto ? <PlanGranizoModal polizaId={abierto} onClose={() => setAbierto(null)} /> : null}
    </div>
  );
}

// El alta se hace en la ficha del cliente (ahí están sus datos y el documento).
// Esto sólo lo encuentra.
function BuscarCliente() {
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const [search, setSearch] = useState("");
  const r = useQuery({
    queryKey: ["clientes", "buscar-plan-granizo", search],
    queryFn: () => getClientes({ search }, 1, 8),
    enabled: search.trim().length >= 2,
  });
  const items = useMemo(() => (r.data?.items ?? []).filter((c) => !c.planGranizo), [r.data]);
  if (!canCreate) return <p className="text-xs text-[var(--color-text-muted)]">No tenés permiso para dar de alta planes.</p>;
  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Buscá al cliente: el alta y el documento para firmar se hacen desde su ficha.
      </p>
      <input
        autoFocus
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        placeholder="Nombre del cliente"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {items.map((c) => (
        <Link key={c.projectId} to={`/clientes/${c.projectId}`} className="block rounded px-2 py-1 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-app)]">
          {c.nombre} <span className="text-[11px] text-[var(--color-text-muted)]">{c.departamento ?? ""}</span>
        </Link>
      ))}
    </div>
  );
}
