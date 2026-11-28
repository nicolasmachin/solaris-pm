import axios from "axios";

import { apiClient } from "./axios";
import type { OrigenLead } from "../types/leads.types";

// Agenda de instalación de cargadores de autos eléctricos.
//
// La página pública usa su propio cliente axios, sin el token ni los
// interceptores de la sesión: la abre cualquiera desde la web de Voltia, y un
// 401 o un toast de "sesión vencida" no tienen sentido ahí.

const publico = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});

export type FranjaCargador = "MANANA" | "TARDE";
export type EstadoReservaCargador = "RESERVADA" | "A_CONFIRMAR" | "CANCELADA";

export interface ConfigPublicaCargadores {
  activa: boolean;
  franjas: Record<FranjaCargador, { label: string; horario: string }>;
  departamentos: string[];
  departamentosEnZona: string[];
  localidadesEnZona: Array<{ departamento: string; localidad: string }>;
}

export interface DiaDisponible {
  fecha: string;
  franjas: Array<{ franja: FranjaCargador; libres: number }>;
}

export interface NuevaReservaCargador {
  nombre: string;
  celular: string;
  email: string;
  direccion: string;
  departamento: string;
  localidad: string;
  fecha?: string | null;
  franja?: FranjaCargador | null;
  tieneCargador: boolean;
  modeloCargador?: string | null;
  modeloAuto?: string | null;
  notas?: string | null;
  origen?: OrigenLead | null;
  /** Trampa para bots: siempre vacío. */
  web?: string;
}

export async function getConfigPublicaCargadores(): Promise<ConfigPublicaCargadores> {
  const { data } = await publico.get<{ config: ConfigPublicaCargadores }>("/api/publico/cargadores/config");
  return data.config;
}

export async function getDisponibilidadCargadores(): Promise<DiaDisponible[]> {
  const { data } = await publico.get<{ dias: DiaDisponible[] }>("/api/publico/cargadores/disponibilidad");
  return data.dias;
}

export async function crearReservaCargador(body: NuevaReservaCargador) {
  const { data } = await publico.post<{
    ok: boolean;
    estado: EstadoReservaCargador;
    fecha: string | null;
    franja: FranjaCargador | null;
  }>("/api/publico/cargadores/reservas", body);
  return data;
}

// ── Gestión interna ────────────────────────────────────────────────────────

export interface ConfigCargadores {
  activa: boolean;
  dias: number[];
  franjas: Record<FranjaCargador, { horario: string; cupo: number }>;
  anticipacionDias: number;
  horizonteDias: number;
  teamId: string | null;
  departamentosEnZona: string[];
  localidadesEnZona: Array<{ departamento: string; localidad: string }>;
  avisarA: string[];
}

export interface ReservaCargador {
  id: string;
  estado: EstadoReservaCargador;
  nombre: string;
  celular: string;
  email: string;
  direccion: string;
  departamento: string;
  localidad: string;
  enZona: boolean;
  fecha: string | null;
  franja: FranjaCargador | null;
  tieneCargador: boolean;
  modeloCargador: string | null;
  modeloAuto: string | null;
  notas: string | null;
  leadId: string | null;
  leadCode: string | null;
  agendaEventoId: string | null;
  createdAt: string;
  canceladaEn: string | null;
}

export async function getConfigCargadores(): Promise<{ config: ConfigCargadores; diasLibres: number }> {
  const { data } = await apiClient.get<{ config: ConfigCargadores; diasLibres: number }>("/api/cargadores/config");
  return data;
}

export async function guardarConfigCargadores(config: ConfigCargadores): Promise<ConfigCargadores> {
  const { data } = await apiClient.put<{ config: ConfigCargadores }>("/api/cargadores/config", config);
  return data.config;
}

export async function getReservasCargadores(canceladas: boolean): Promise<ReservaCargador[]> {
  const { data } = await apiClient.get<{ reservas: ReservaCargador[] }>("/api/cargadores/reservas", {
    params: canceladas ? { canceladas: "1" } : undefined,
  });
  return data.reservas;
}

export async function cancelarReservaCargador(id: string): Promise<void> {
  await apiClient.post(`/api/cargadores/reservas/${id}/cancelar`);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "setiembre", "octubre", "noviembre", "diciembre"];

/** "sábado 5 de diciembre" a partir de "2026-12-05". */
export function describirFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}

export const FRANJA_LABEL: Record<FranjaCargador, string> = { MANANA: "Mañana", TARDE: "Tarde" };

export function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
