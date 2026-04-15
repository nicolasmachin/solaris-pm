import { apiClient } from "./axios";
import type { User } from "../types/api.types";

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/api/users");
  return data;
}
