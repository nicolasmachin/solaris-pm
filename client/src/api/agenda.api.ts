import { apiClient } from "./axios";

// Eventos del calendario que no son obras. Las obras siguen viviendo en
// `calendar.api.ts` (InstallationSchedule) — son dos cosas distintas que
// comparten pantalla.

export type TipoEventoAgenda = "MANTENIMIENTO" | "SOPORTE" | "VISITA_TECNICA";

/** Incluye OBRA para los filtros de la pantalla, que sí la contemplan. */
export type TipoCalendario = "OBRA" | TipoEventoAgenda;

export interface AgendaEvento {
  id: string;
  tipo: TipoEventoAgenda;
  titulo: string;
  projectId: string | null;
  projectCode: string | null;
  clientName: string | null;
  ticketId: string | null;
  ticketTitulo: string | null;
  teamId: string | null;
  teamName: string;
  teamColor: string;
  notas: string | null;
  completadoEn: string | null;
  dias: Array<{ id: string; fecha: string }>;
  createdByName: string | null;
  createdAt: string;
}

/**
 * Identidad visual de cada tipo.
 *
 * El color NO pinta el fondo del bloque —eso sigue siendo el equipo— sino una
 * barra vertical de 3 px a la izquierda. Es la única señal que entra tanto en la
 * vista Mes (carriles de 22 px) como en la Año (6 px), y no le roba ancho al
 * nombre del cliente, que en celular ya viene justo.
 */
export const TIPO_CALENDARIO_META: Record<
  TipoCalendario,
  { label: string; corto: string; color: string; icono: string }
> = {
  OBRA: { label: "Obras", corto: "Obra", color: "#378ADD", icono: "🏗" },
  MANTENIMIENTO: { label: "Mantenimientos", corto: "Mantenimiento", color: "#1D9E75", icono: "🔧" },
  SOPORTE: { label: "Soporte / Reclamos", corto: "Soporte", color: "#E0A020", icono: "⚠" },
  VISITA_TECNICA: { label: "Visitas técnicas", corto: "Visita", color: "#9B6BDF", icono: "🔍" },
};

export const TIPOS_CALENDARIO: TipoCalendario[] = [
  "OBRA",
  "MANTENIMIENTO",
  "SOPORTE",
  "VISITA_TECNICA",
];

export async function getAgendaEventos(params: {
  desde?: string;
  hasta?: string;
  projectId?: string;
}): Promise<AgendaEvento[]> {
  const { data } = await apiClient.get<{ eventos: AgendaEvento[] }>("/api/agenda-eventos", {
    params,
  });
  return data.eventos;
}

export async function crearAgendaEvento(body: {
  tipo: TipoEventoAgenda;
  titulo?: string;
  fechas: string[];
  projectId?: string | null;
  ticketId?: string | null;
  teamId?: string | null;
  notas?: string;
}): Promise<AgendaEvento> {
  const { data } = await apiClient.post<{ evento: AgendaEvento }>("/api/agenda-eventos", body);
  return data.evento;
}

export async function actualizarAgendaEvento(
  id: string,
  body: { titulo?: string; teamId?: string | null; notas?: string; completado?: boolean },
): Promise<AgendaEvento> {
  const { data } = await apiClient.patch<{ evento: AgendaEvento }>(`/api/agenda-eventos/${id}`, body);
  return data.evento;
}

export async function agregarDiaAgenda(id: string, fecha: string): Promise<AgendaEvento> {
  const { data } = await apiClient.post<{ evento: AgendaEvento }>(
    `/api/agenda-eventos/${id}/dias`,
    { fecha },
  );
  return data.evento;
}

/** Mover un día a otra fecha (drag & drop). */
export async function moverDiaAgenda(
  id: string,
  diaId: string,
  fecha: string,
): Promise<AgendaEvento> {
  const { data } = await apiClient.patch<{ evento: AgendaEvento }>(
    `/api/agenda-eventos/${id}/dias/${diaId}`,
    { fecha },
  );
  return data.evento;
}

export async function quitarDiaAgenda(id: string, diaId: string): Promise<AgendaEvento> {
  const { data } = await apiClient.delete<{ evento: AgendaEvento }>(
    `/api/agenda-eventos/${id}/dias/${diaId}`,
  );
  return data.evento;
}

export async function eliminarAgendaEvento(id: string): Promise<void> {
  await apiClient.delete(`/api/agenda-eventos/${id}`);
}
