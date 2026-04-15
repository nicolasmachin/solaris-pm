import { useThemeStore } from "../store/theme.store";

export function useTheme() {
  const { mode, toggle, setMode } = useThemeStore();
  return { mode, toggle, setMode, isDark: mode === "dark" };
}
