import { apiClient } from "./axios";
import type { User } from "../types/api.types";

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/api/users");
  return data;
}

// Usuarios asignables a recursos internos (etapas, tareas, etc.).
// Excluye los CLIENT (clientes del portal) — esos viven en otro flujo.
// Es el endpoint que consume UserSelect para que ningún selector de
// asignación muestre clientes del portal.
export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function getAssignableUsers(): Promise<AssignableUser[]> {
  const { data } = await apiClient.get<AssignableUser[]>("/api/users/assignable");
  return data;
}
