import { memo, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Circle } from "lucide-react";

import { getClientes, type ClienteListItem } from "../../../api/clientes.api";

/**
 * La lista de Generadores al costado de la ficha, para saltar de un cliente a
 * otro sin volver al listado.
 *
 * Es el gemelo del sidebar de Proyectos y del de Ingeniería —mismas medidas y
 * misma paleta— pero con los datos de este módulo: viene ordenada por prioridad
 * de contacto y muestra las dos señales del recorrido, que es lo que hace que
 * sirva para trabajar y no sólo para navegar.
 */
function Item({ c }: { c: ClienteListItem }) {
  const urgente = c.avisosClavePendientes.length > 0;
  return (
    <NavLink
      to={`/clientes/${c.projectId}`}
      title={urgente ? c.avisosClavePendientes.join(" · ") : undefined}
      className={({ isActive }) =>
        `block border-l-2 px-3 py-2.5 transition-colors ${
          isActive
            ? "border-l-[var(--color-accent)] bg-[var(--color-bg-card-hover)]"
            : "border-l-transparent hover:bg-[var(--color-bg-card-hover)]"
        }`
      }
    >
      <div className="flex items-start gap-1.5">
        {urgente ? (
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-danger-text)]" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-primary)]">
          {c.nombre}
        </span>
        {c.hayNovedad && (
          <Circle className="mt-1 h-1.5 w-1.5 shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]" />
        )}
      </div>
      <p className="mt-0.5 pl-[18px] text-[10px] text-[var(--color-text-muted)]">
        {c.etapa?.recorrido.codigo ?? "—"} ·{" "}
        {c.diasSinContacto === null ? "sin contacto" : `${c.diasSinContacto} d`}
      </p>
    </NavLink>
  );
}

const ItemMemo = memo(Item);

export function ClientesSidebar() {
  const [search, setSearch] = useState("");
  // Se pide la misma query del listado para no duplicar el fetch cuando se entra
  // desde ahí. El orden por defecto ya es el de prioridad de contacto.
  const { data, isLoading } = useQuery({
    queryKey: ["clientes", {}, 1, 200],
    queryFn: () => getClientes({}, 1, 200),
  });

  const items = data?.items ?? [];
  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.mail ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <>
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <p className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          Generadores
        </p>
      </div>

      <div className="space-y-1.5 border-b border-[var(--color-border)] px-2 pb-2">
        <input
          type="search"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        {!isLoading && (
          <p className="text-right text-[10px] text-[var(--color-text-muted)]">
            {filtrados.length === items.length
              ? `${items.length} clientes`
              : `${filtrados.length} de ${items.length}`}
          </p>
        )}
      </div>

      <div className="flex-1 pb-4 pt-1">
        {isLoading ? (
          <p className="px-3 pt-4 text-center text-[11px] text-[var(--color-text-muted)]">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-3 pt-4 text-center text-[11px] text-[var(--color-text-muted)]">
            Ningún cliente coincide con la búsqueda
          </p>
        ) : (
          filtrados.map((c) => <ItemMemo key={c.projectId} c={c} />)
        )}
      </div>
    </>
  );
}
