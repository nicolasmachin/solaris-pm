import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { altaAppApi } from "../api/altaApp.api";
import { AltaAppForm } from "../components/altaApp/AltaAppForm";

// Página pública (sin login) a la que llega el cliente con el link que le manda
// Voltia: elige usuario y contraseña de la aplicación del inversor y Voltia PM
// crea la cuenta en Growatt con su planta.
export function AltaApp() {
  const { token = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["alta-app", token],
    queryFn: () => altaAppApi.info(token),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] px-4 py-8 text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-md">
        <img src="/logo-voltia.png" alt="Voltia" className="mx-auto mb-6 h-10 w-auto" />
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
          ) : !data || data.estado !== "VALIDO" ? (
            <div>
              <h1 className="text-lg font-semibold">
                {data?.estado === "USADO" ? "Este link ya se usó" : "Este link no es válido"}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {data?.estado === "USADO"
                  ? "Tu acceso a la aplicación ya está creado. Entrá con el usuario y la contraseña que elegiste."
                  : "Puede haber vencido. Escribinos y te mandamos uno nuevo."}
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Hola{data.nombre ? ` ${data.nombre}` : ""}</h1>
              <p className="mt-1 mb-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Creá tu acceso a la aplicación del inversor para ver en vivo lo que genera tu planta,{" "}
                <strong>{data.planta}</strong>. Elegí un usuario y una contraseña que te acuerdes.
              </p>
              <AltaAppForm
                planta={data.planta}
                emailInicial={data.email}
                links={data.links}
                disponible={(u) => altaAppApi.disponible(token, u)}
                completar={(d) => altaAppApi.completar(token, d)}
              />
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">Voltia · Energía solar fotovoltaica · Uruguay</p>
      </div>
    </div>
  );
}
