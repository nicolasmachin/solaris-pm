import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Info } from "lucide-react";
import { getDigestConfig, putDigestHour, putDigestToggle } from "../../api/digestConfig.api";
import { getRoles } from "../../api/roles.api";

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TabDigestConfig() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ["digest-config"], queryFn: getDigestConfig });
  const { data: roles = [] } = useQuery({ queryKey: ["admin-roles-digest"], queryFn: getRoles });

  // Roles internos (sin CLIENT): son los únicos que reciben el resumen.
  const internalRoles = useMemo(() => roles.filter((r) => r.name !== "CLIENT"), [roles]);

  // Set "roleName::type" de lo habilitado, para lookups O(1).
  const enabledSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of config?.enabled ?? []) s.add(`${e.roleName}::${e.notificationType}`);
    return s;
  }, [config?.enabled]);

  const hourMut = useMutation({
    mutationFn: (hour: number) => putDigestHour(hour),
    onSuccess: () => {
      toast.success("Hora del resumen actualizada");
      qc.invalidateQueries({ queryKey: ["digest-config"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "Error al guardar la hora"),
  });

  const toggleMut = useMutation({
    mutationFn: (body: { roleName: string; notificationType: string; enabled: boolean }) => putDigestToggle(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["digest-config"] }),
    onError: (err) => toast.error(getApiErr(err) ?? "Error al actualizar"),
  });

  if (isLoading || !config) {
    return <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>;
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold mb-1">Resumen diario por email</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Cada persona recibe un solo correo por día con las novedades de sus proyectos. Elegí <strong>qué tipo de
          notificación entra al resumen de cada rol</strong> y <strong>a qué hora</strong> se envía. Las
          notificaciones siguen apareciendo al instante en la campana; esto solo controla el correo. Un rol sin nada
          tildado no recibe correo. Pasá el mouse por la <Info className="inline h-3 w-3" /> de cada notificación para
          ver qué es.
        </p>
      </div>

      {/* Hora de envío */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-[var(--color-text-secondary)]">Hora de envío (Uruguay):</label>
        <select
          value={config.sendHour}
          onChange={(e) => hourMut.mutate(Number(e.target.value))}
          disabled={hourMut.isPending}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </div>

      {/* Matriz Rol × Tipo */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
              <th className="sticky left-0 z-10 bg-[var(--color-bg-app)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider">
                Rol
              </th>
              {config.types.map((t) => (
                <th key={t.type} className="px-2 py-2 text-center align-bottom" style={{ minWidth: 96 }}>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[10px] font-medium text-[var(--color-text-secondary)] leading-tight">
                      {t.label}
                    </span>
                    <span title={t.description} className="cursor-help text-[var(--color-text-muted)]">
                      <Info className="h-3 w-3" />
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {internalRoles.map((role) => (
              <tr key={role.id} className="border-t border-[var(--color-border)]">
                <td className="sticky left-0 z-10 bg-[var(--color-bg-card)] px-3 py-2 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                  {role.label}
                </td>
                {config.types.map((t) => {
                  const on = enabledSet.has(`${role.name}::${t.type}`);
                  return (
                    <td key={t.type} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={toggleMut.isPending}
                        onChange={(e) =>
                          toggleMut.mutate({
                            roleName: role.name,
                            notificationType: t.type,
                            enabled: e.target.checked,
                          })
                        }
                        style={{ accentColor: "var(--color-accent)" }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
