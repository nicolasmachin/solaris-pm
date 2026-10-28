import { useQuery, useQueryClient } from "@tanstack/react-query";

import { altaAppApi } from "../api/altaApp.api";
import { AltaAppForm, Descargas } from "../components/altaApp/AltaAppForm";

// Portal: el cliente crea él mismo su acceso a la aplicación del inversor.
export function PortalAppInversor() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-alta-app"], queryFn: () => altaAppApi.portal() });

  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>;
  if (!data || data.proyectos.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-lg font-semibold">Aplicación del inversor</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Tu planta todavía no está lista para crear el acceso desde acá. Escribinos y te ayudamos.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Aplicación del inversor</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Con la aplicación del inversor ves en vivo lo que genera tu planta.
        </p>
      </div>
      {data.proyectos.map((p) => (
        <div key={p.projectId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
          <div className="mb-3 text-sm font-semibold">{p.planta}</div>
          {p.usuario ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Tu acceso ya está creado: el usuario es <strong>{p.usuario}</strong>, con la contraseña que elegiste.
              </p>
              <Descargas links={data.links} />
            </div>
          ) : (
            <AltaAppForm
              planta={p.planta}
              emailInicial={p.email}
              links={data.links}
              disponible={(u) => altaAppApi.portalDisponible(p.projectId, u)}
              completar={async (d) => {
                const r = await altaAppApi.portalCompletar(p.projectId, d);
                qc.invalidateQueries({ queryKey: ["portal-alta-app"] });
                return r;
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
