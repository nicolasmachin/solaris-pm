import { create } from "zustand";
import type { ThemeMode } from "../styles/theme";

const STORAGE_KEY = "voltia-theme";

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
}

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const initial = getInitialTheme();
applyTheme(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initial,
  toggle: () =>
    set((state) => {
      const next: ThemeMode = state.mode === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      return { mode: next };
    }),
  setMode: (mode) => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
}));
