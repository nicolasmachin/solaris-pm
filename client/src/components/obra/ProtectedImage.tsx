import { useEffect, useState } from "react";

interface Props {
  // URL relativa al backend (ej. "/api/files/:id/thumbnail"). Se le antepone
  // la base de la API y se agrega el header Authorization, porque estos
  // endpoints están protegidos y un <img src> directo daría 401.
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

// Carga una imagen de un endpoint que exige Bearer token: hace fetch con el
// token, convierte la respuesta en objectURL y la revoca en el cleanup para
// no filtrar memoria (importante en la galería + lightbox del celular).
export function ProtectedImage({ src, alt, className, onClick }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setFailed(false);
    setObjectUrl(null);

    const token = localStorage.getItem("voltia-token");
    const absolute = src.startsWith("http") ? src : `${API_BASE}${src}`;

    fetch(absolute, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--color-bg-app)] text-[10px] text-[var(--color-text-muted)] ${className ?? ""}`}
      >
        sin imagen
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={`animate-pulse bg-[var(--color-border)]/40 ${className ?? ""}`} />;
  }

  return <img src={objectUrl} alt={alt} className={className} onClick={onClick} />;
}
