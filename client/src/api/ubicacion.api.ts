import { apiClient as api } from "./axios";

/** `texto`: coordenadas o link de Google Maps; `null` borra la ubicación. */
export async function guardarUbicacion(destino: { leadId: string } | { projectId: string }, texto: string | null) {
  const url = "leadId" in destino ? `/api/leads/${destino.leadId}/ubicacion` : `/api/projects/${destino.projectId}/ubicacion`;
  const { data } = await api.put(url, { texto });
  return data as { success: true; ubicacion: { lat: number; lng: number } | null };
}

export function linksMapa(lat: number, lng: number) {
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}
