import { useEffect, useState } from "react";
import { apiClient } from "../api/axios";

/**
 * Descarga un archivo protegido (endpoint que requiere `Authorization: Bearer`)
 * y devuelve un `blob:` URL para usar como `src` de <img>, <iframe>, o
 * como `href` de un <a download>. El iframe / anchor no mandan el header JWT
 * por sí solos, por eso necesitamos hacer el fetch manual via axios
 * (que ya tiene baseURL + header de auth configurados en el interceptor).
 */
export function useAuthBlobUrl(url: string | null): {
  blobUrl: string | null;
  loading: boolean;
  error: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    apiClient
      .get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(res.data);
        setBlobUrl(createdUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  return { blobUrl, loading, error };
}

/**
 * Descarga un archivo autenticado forzando el guardado en disco con el
 * nombre original. Usado por el botón "Descargar".
 */
export async function downloadAuthenticated(url: string, filename: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay para dar tiempo a que el browser inicie la descarga antes de revocar
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}
