import { apiClient } from "./axios";
import type { AuthResponse } from "../types/api.types";
import type { UserPermission } from "../store/auth.store";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

// Entrar sin contraseña: se pide un código al mail y se entra con él.
export async function requestLoginCode(email: string): Promise<{ sentTo: string; minutes: number }> {
  const { data } = await apiClient.post<{ sentTo: string; minutes: number }>("/auth/login-code/request", { email });
  return data;
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login-code/verify", { email, code });
  return data;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  passwordTemporary?: boolean;
  permissions: UserPermission[];
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>("/api/users/me");
  return data;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true }> {
  const { data } = await apiClient.post<{ success: true }>(
    "/auth/change-password",
    input,
  );
  return data;
}
