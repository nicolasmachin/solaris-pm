import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Users, KeyRound } from "lucide-react";
import { getProjectClients } from "../../api/clients.api";

/**
 * Panel del detalle de proyecto: muestra qué CLIENTs tienen acceso al portal
 * para este proyecto (relación m2m). Sólo visible para usuarios con permiso
 * USUARIOS.VIEW (admins). El listado y la creación viven en /admin → tab
 * "Clientes portal".
 */
export function PortalClientsPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["project-clients", projectId],
    queryFn: () => getProjectClients(projectId),
    staleTime: 30_000,
  });

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          Clientes con acceso al portal
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
        >
          Gestionar <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Ningún cliente tiene acceso a este proyecto todavía. Andá a{" "}
          <button
            onClick={() => navigate("/admin")}
            className="text-[var(--color-accent)] hover:underline"
          >
            Admin → Clientes portal
          </button>{" "}
          para asignar uno.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((c) => (
            <li
              key={c.projectClientId}
              className="flex items-center justify-between gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                    {c.name}
                  </p>
                  {c.passwordTemporary && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 text-amber-400 px-1 py-px text-[9px] font-mono uppercase"
                      title="Aún no cambió la contraseña inicial"
                    >
                      <KeyRound className="w-2.5 h-2.5" />
                      pass temporal
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
