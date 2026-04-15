import { useAuthStore } from "../store/auth.store";

export function usePermission(module: string, action: string): boolean {
  const { user, permissions } = useAuthStore();

  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const entry = permissions.find((p) => p.module === module);
  return entry?.actions.includes(action) ?? false;
}
