import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Navigation, Pencil, X } from "lucide-react";

import { guardarUbicacion, linksMapa } from "../../api/ubicacion.api";

const ORIGEN: Record<string, string> = {
  WHATSAPP: "la mandó el cliente por WhatsApp",
  TELEGRAM: "cargada desde el bot de minutas",
  MANUAL: "cargada a mano",
};

type Props = {
  destino: { leadId: string } | { projectId: string };
  lat?: number | null;
  lng?: number | null;
  en?: string | null;
  origen?: string | null;
  puedeEditar: boolean;
  queryKey: unknown[];
};

/**
 * Ubicación GPS del domicilio: abre en Google Maps o en Waze con un toque. Se
 * llena sola cuando el cliente manda su ubicación por WhatsApp; a mano se pegan
 * las coordenadas o el link de Google Maps.
 */
export function UbicacionGps({ destino, lat, lng, en, origen, puedeEditar, queryKey }: Props) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const hay = lat != null && lng != null;

  const mut = useMutation({
    mutationFn: (t: string | null) => guardarUbicacion(destino, t),
    onSuccess: (_d, t) => {
      qc.invalidateQueries({ queryKey });
      toast.success(t === null ? "Ubicación borrada" : "Ubicación guardada");
      setEditando(false);
      setTexto("");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar la ubicación");
    },
  });

  const boton =
    "inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[12px] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors";

  if (editando) {
    return (
      <form
        className="inline-flex flex-wrap items-center gap-1.5 text-[12px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) mut.mutate(texto.trim());
        }}
      >
        <input
          autoFocus
          className="w-[260px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="Coordenadas o link de Google Maps"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className={boton} disabled={mut.isPending || !texto.trim()}>
          Guardar
        </button>
        {hay ? (
          <button type="button" className={boton} disabled={mut.isPending} onClick={() => mut.mutate(null)}>
            Borrar
          </button>
        ) : null}
        <button type="button" className={boton} onClick={() => setEditando(false)} aria-label="Cancelar">
          <X size={12} />
        </button>
      </form>
    );
  }

  if (!hay) {
    return puedeEditar ? (
      <button type="button" className={`${boton} text-[var(--color-text-muted)]`} onClick={() => setEditando(true)}>
        <Navigation size={12} /> Cargar ubicación GPS
      </button>
    ) : null;
  }

  const links = linksMapa(lat, lng);
  const cuando = en ? new Date(en).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" }) : null;
  const titulo = [origen ? ORIGEN[origen] ?? null : null, cuando ? `el ${cuando}` : null].filter(Boolean).join(" ");

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={titulo ? `Ubicación GPS: ${titulo}` : "Ubicación GPS"}>
      <Navigation size={14} className="shrink-0" />
      <a href={links.googleMaps} target="_blank" rel="noreferrer" className={boton}>
        Google Maps
      </a>
      <a href={links.waze} target="_blank" rel="noreferrer" className={boton}>
        Waze
      </a>
      {puedeEditar ? (
        <button type="button" className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" onClick={() => setEditando(true)} aria-label="Cambiar ubicación">
          <Pencil size={12} />
        </button>
      ) : null}
    </span>
  );
}
