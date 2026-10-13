import { useQuery } from "@tanstack/react-query";

import { getInteractions } from "../../api/clientes.api";
import { CHANNEL_LABELS, DIRECTION_LABELS, REASON_LABELS } from "../../modules/clientes/constants";
import { Spinner } from "../ui/Spinner";

// Lo que Experiencia Solar habló con el cliente (llamadas, WhatsApp, mails),
// visto desde la pantalla del proyecto. Solo lectura: se registra desde la
// ficha del cliente. Antes estas interacciones solo se veían en la ficha.
export function ContactoClienteTab({ projectId }: { projectId: string }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["cliente-interacciones", projectId],
    queryFn: () => getInteractions(projectId),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (isError) return <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No se pudo cargar el contacto con el cliente.</p>;
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
        Todavía no hay contactos registrados con el cliente. Los registra Experiencia Solar desde la ficha del cliente.
      </p>
    );
  }

  const ordenadas = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <ul className="space-y-2">
      {ordenadas.map((i) => (
        <li key={i.id} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {new Date(i.createdAt).toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" })} ·{" "}
            {CHANNEL_LABELS[i.channel]}
            {i.direction ? ` · ${DIRECTION_LABELS[i.direction]}` : ""}
            {i.reason ? ` · ${REASON_LABELS[i.reason]}` : ""} · {i.autor.nombre}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--color-text-primary)]">{i.content}</p>
        </li>
      ))}
    </ul>
  );
}
