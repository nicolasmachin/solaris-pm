import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Buscador para elegir un contacto o una empresa (CRM de Ventas).

export const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

/** Texto del buscador, con un pequeño retardo para no consultar en cada tecla. */
export function useBusqueda(inicial = ""): [string, string, (v: string) => void] {
  const [texto, setTexto] = useState(inicial);
  const [q, setQ] = useState(inicial.trim());
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);
  return [texto, q, setTexto];
}

/** Buscador para elegir un contacto o una empresa a vincular. */
export function Elegir<T extends { id: string }>({
  buscar,
  etiqueta,
  excluir,
  onElegir,
  placeholder,
}: {
  buscar: (q: string) => Promise<T[]>;
  etiqueta: (x: T) => string;
  excluir: string[];
  onElegir: (x: T) => void;
  placeholder: string;
}) {
  const [texto, q, setTexto] = useBusqueda();
  const { data = [] } = useQuery({ queryKey: ["crm-elegir", placeholder, q], queryFn: () => buscar(q), enabled: q.length >= 2 });
  const opciones = data.filter((x) => !excluir.includes(x.id)).slice(0, 8);
  return (
    <div className="space-y-1">
      <input className={INPUT} placeholder={placeholder} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      {q.length >= 2 && (
        <ul className="max-h-56 overflow-auto rounded-lg border border-[var(--color-border)]">
          {opciones.length === 0 && <li className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">Sin resultados</li>}
          {opciones.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                onClick={() => {
                  onElegir(x);
                  setTexto("");
                }}
              >
                {etiqueta(x)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

