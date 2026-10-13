import { useQuery } from "@tanstack/react-query";

import { fuentesPortal, getPlantasDelCliente } from "../../api/energiaFv.api";
import { EnergiaPlanta } from "../energia/EnergiaPlanta";

// La vista de energía en el portal de Voltia: la misma que ve el equipo en la
// ficha del cliente, para que el Generador no necesite la aplicación del
// inversor. Una por planta; si tiene más de una, cada una con su nombre.
export function PortalEnergiaPlantas() {
  const { data: plantas = [] } = useQuery({ queryKey: ["portal-energia-plantas"], queryFn: getPlantasDelCliente });
  if (plantas.length === 0) return null;
  return (
    <div className="space-y-4">
      {plantas.map((p) => (
        <div key={p.projectId}>
          {plantas.length > 1 && (
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{p.nombre}</h2>
          )}
          <EnergiaPlanta fuentes={fuentesPortal(p.projectId)} claveCache={`portal-${p.projectId}`} puedeActualizar={false} />
        </div>
      ))}
    </div>
  );
}
