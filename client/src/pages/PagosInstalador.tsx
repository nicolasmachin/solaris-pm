import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Copy } from "lucide-react";

import {
  deleteInstallerPayment,
  getInstallerPayments,
  STATUS_LABEL,
  type InstallerPayment,
  type InstallerPaymentStatus,
} from "../api/pagosInstalador.api";
import { getAssignableUsers } from "../api/users.api";
import { AsignarInstaladorModal } from "../components/pagos-instalador/AsignarInstaladorModal";
import { RegistrarPagoModal } from "../components/pagos-instalador/RegistrarPagoModal";
import { PagoInstaladorManualModal } from "../components/pagos-instalador/PagoInstaladorManualModal";
import { buildResumenInstalador } from "../components/pagos-instalador/resumenWhatsApp";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { usePermission } from "../hooks/usePermission";

const CURRENT_YEAR = new Date().getFullYear();

type StatusFilter = "todos" | InstallerPaymentStatus;

function fmtUsd(v: number) {
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Las fechas llegan como medianoche UTC, así que se formatean desde la string:
 * pasarlas por `Date` las corre un día para atrás en Uruguay (-03). Mismo
 * criterio que `formatDate` en `utils/date.ts`.
 */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

// Color estable por instalador para identificarlos de un vistazo en el listado.
// Se deriva del id (hash simple → índice en la paleta), así el mismo instalador
// siempre sale del mismo color.
const INSTALLER_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
  "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#e879f9",
];
function installerColor(id: string | null): string | undefined {
  if (!id) return undefined;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return INSTALLER_COLORS[h % INSTALLER_COLORS.length];
}

function filterBtn(active: boolean) {
  return `px-2.5 py-1 rounded text-xs font-medium ${
    active
      ? "bg-[var(--color-accent)] text-gray-900"
      : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
  }`;
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-[var(--color-accent)] bg-[var(--color-bg-card)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
      }`}
    >
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`font-display font-bold mt-1 ${
          accent
            ? "text-3xl text-[var(--color-accent)]"
            : "text-2xl text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: InstallerPaymentStatus }) {
  const estilo =
    status === "PAGADO"
      ? "text-green-300 bg-green-500/20"
      : status === "PARCIAL"
        ? "text-sky-300 bg-sky-500/20"
        : "text-amber-300 bg-amber-500/20";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${estilo}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Pagos de mano de obra a instaladores tercerizados.
 *
 * Una sola pantalla para dos audiencias: el instalador ve solo lo suyo y en modo
 * lectura; quien gestiona (admin/finanzas) ve los de todos, asigna instaladores y
 * registra las entregas. El backend ya scopea por su cuenta — acá solo se decide
 * qué controles mostrar.
 */
export function PagosInstalador() {
  const qc = useQueryClient();
  const puedeGestionar = usePermission("FINANZAS", "EDIT");

  const [status, setStatus] = useState<StatusFilter>("todos");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [soloSinAsignar, setSoloSinAsignar] = useState(false);
  const [installerId, setInstallerId] = useState("");
  const [asignando, setAsignando] = useState<InstallerPayment | null>(null);
  const [pagando, setPagando] = useState<InstallerPayment | null>(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [borrando, setBorrando] = useState<InstallerPayment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["installer-payments", { status, year, soloSinAsignar, installerId }],
    queryFn: () =>
      getInstallerPayments({
        status: status === "todos" ? undefined : status,
        year,
        sinAsignar: soloSinAsignar || undefined,
        installerId: installerId || undefined,
      }),
  });

  // Solo para el selector de instalador del modal de asignación.
  const usuariosQ = useQuery({
    queryKey: ["assignable-users"],
    queryFn: getAssignableUsers,
    enabled: puedeGestionar,
  });

  const instaladores = useMemo(
    () => (usuariosQ.data ?? []).filter((u) => u.role === "INSTALADOR_TERCERIZADO"),
    [usuariosQ.data],
  );

  const borrarMut = useMutation({
    mutationFn: (id: string) => deleteInstallerPayment(id),
    onSuccess: () => {
      toast.success("Pago eliminado");
      setBorrando(null);
      qc.invalidateQueries({ queryKey: ["installer-payments"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar");
    },
  });

  const payments = data?.payments ?? [];
  const metrics = data?.metrics;
  const veTodos = data?.seeAll ?? false;

  function copiarResumen() {
    const nombre = instaladores.find((u) => u.id === installerId)?.name ?? "instalador";
    const texto = buildResumenInstalador(nombre, payments);
    navigator.clipboard.writeText(texto).then(
      () => toast.success("Resumen copiado — pegalo en WhatsApp"),
      () => toast.error("No se pudo copiar"),
    );
  }

  const anios = useMemo(
    () => Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i),
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)]">
            {veTodos ? "Pagos a instaladores" : "Mis cobros"}
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {veTodos
              ? "Mano de obra de cada obra: cuánto se debe, cuánto se pagó y qué falta."
              : "Los trabajos que hiciste, lo que ya cobraste y lo que queda pendiente."}
          </p>
        </div>
        {puedeGestionar && (
          <Button onClick={() => setManualAbierto(true)}>Cargar pago manual</Button>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Total del año" value={fmtUsd(metrics.totalUsd)} />
          <Tile label="Ya pagado" value={fmtUsd(metrics.pagadoUsd)} />
          <Tile label="Saldo pendiente" value={fmtUsd(metrics.saldoUsd)} accent />
          <Tile
            label={veTodos ? "Trabajos · sin asignar" : "Trabajos"}
            value={veTodos ? `${metrics.trabajos} · ${metrics.sinAsignar}` : String(metrics.trabajos)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          Estado
        </span>
        {(["todos", "PENDIENTE", "PARCIAL", "PAGADO"] as const).map((s) => (
          <button key={s} type="button" className={filterBtn(status === s)} onClick={() => setStatus(s)}>
            {s === "todos" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}

        <span className="ml-3 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          Año
        </span>
        {anios.map((a) => (
          <button key={a} type="button" className={filterBtn(year === a)} onClick={() => setYear(a)}>
            {a}
          </button>
        ))}

        {veTodos && (
          <button
            type="button"
            className={`ml-3 ${filterBtn(soloSinAsignar)}`}
            onClick={() => setSoloSinAsignar((v) => !v)}
          >
            Sin asignar
          </button>
        )}

        {veTodos && (
          <div className="ml-auto flex items-center gap-2">
            <select
              value={installerId}
              onChange={(e) => {
                setInstallerId(e.target.value);
                // Filtrar por alguien y "sin asignar" se contradicen.
                if (e.target.value) setSoloSinAsignar(false);
              }}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs"
            >
              <option value="">Todos los instaladores</option>
              {instaladores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!installerId || payments.length === 0}
              onClick={copiarResumen}
              title={
                !installerId
                  ? "Elegí un instalador para armar su resumen"
                  : "Copiar el resumen para pegarlo en WhatsApp"
              }
              className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-40"
            >
              <Copy size={13} /> Resumen WhatsApp
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : payments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay pagos para estos filtros.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--color-table-header-bg)] text-left text-[11px] uppercase tracking-wider text-[var(--color-table-header-text)]">
                  <th className="px-4 py-3">Obra</th>
                  {veTodos && <th className="px-4 py-3">Instalador</th>}
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                  {puedeGestionar && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{p.clientName}</div>
                      <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {p.projectCode ?? "sin proyecto"}
                        {p.origenManual && p.montoUsd === 0 ? " · falta cargar el monto" : ""}
                        {p.montoEditado ? " · monto corregido" : ""}
                      </div>
                    </td>
                    {veTodos && (
                      <td className="px-4 py-3">
                        {p.installerName ? (
                          <span className="font-semibold" style={{ color: installerColor(p.installerId) }}>
                            {p.installerName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-300">Sin asignar</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {fmtDate(p.fechaTrabajo)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtUsd(p.montoUsd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {fmtUsd(p.pagadoUsd)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmtUsd(p.saldoUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    {puedeGestionar && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAsignando(p)}
                            className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                          >
                            {p.installerId ? "Editar" : "Asignar"}
                          </button>
                          <button
                            type="button"
                            disabled={!p.installerId || (p.saldoUsd <= 0 && p.pagos.length === 0)}
                            onClick={() => setPagando(p)}
                            title={
                              !p.installerId
                                ? "Asigná primero a quién se le paga"
                                : p.saldoUsd <= 0
                                  ? "Saldado — abrí para corregir o anular entregas"
                                  : undefined
                            }
                            className="rounded bg-[var(--color-accent)] px-2 py-1 text-[11px] font-semibold text-gray-900 disabled:opacity-40"
                          >
                            {p.saldoUsd > 0 ? "Pagar" : "Pagos"}
                          </button>
                          {p.pagos.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setBorrando(p)}
                              className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:border-red-500/40 hover:text-red-400"
                            >
                              Borrar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {asignando && (
        <AsignarInstaladorModal
          payment={asignando}
          instaladores={instaladores}
          onClose={() => setAsignando(null)}
        />
      )}
      {pagando && <RegistrarPagoModal payment={pagando} onClose={() => setPagando(null)} />}
      {manualAbierto && (
        <PagoInstaladorManualModal
          instaladores={instaladores}
          onClose={() => setManualAbierto(false)}
        />
      )}

      <ConfirmDialog
        open={borrando !== null}
        title="Eliminar pago"
        description={`¿Eliminar el pago de "${borrando?.clientName ?? ""}"? No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        loading={borrarMut.isPending}
        onClose={() => setBorrando(null)}
        onConfirm={() => borrando && borrarMut.mutate(borrando.id)}
      />
    </div>
  );
}
