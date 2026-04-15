import { create } from "zustand";
import type { User } from "../types/api.types";

const TOKEN_KEY = "voltia-token";
const USER_KEY = "voltia-user";
const PERMISSIONS_KEY = "voltia-permissions";

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export interface UserPermission {
  module: string;
  actions: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  permissions: UserPermission[];
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, permissions?: UserPermission[]) => void;
  setPermissions: (permissions: UserPermission[]) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: readJson<User>(USER_KEY),
  permissions: readJson<UserPermission[]>(PERMISSIONS_KEY) ?? [],
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  setAuth: (token, user, permissions = []) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
    set({ token, user, permissions, isAuthenticated: true });
  },
  setPermissions: (permissions) => {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
    set({ permissions });
  },
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    set({ token: null, user: null, permissions: [], isAuthenticated: false });
  },
}));
