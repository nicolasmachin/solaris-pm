export const darkTheme = {
  bgApp: "#06111f",
  bgSidebar: "#08172a",
  bgCard: "#0b1d33",
  bgCardHover: "#102746",
  border: "#1b4370",
  borderHover: "#2b62a1",
  textPrimary: "#f8fbff",
  textSecondary: "#c8def8",
  textMuted: "#88afd6",
  accent: "#ffd84d",
  accentHover: "#ffca1b",
} as const;

export const lightTheme = {
  bgApp: "#eef6ff",
  bgSidebar: "#e6f1ff",
  bgCard: "#ffffff",
  bgCardHover: "#f3f9ff",
  border: "#b7d3f2",
  borderHover: "#80b4eb",
  textPrimary: "#07203b",
  textSecondary: "#27507c",
  textMuted: "#5379a3",
  accent: "#e3b400",
  accentHover: "#c99c00",
} as const;

export const stateColors = {
  done: { text: "#dff2ff", bg: "#12355c" },
  active: { text: "#f8fbff", bg: "#0f5b9f" },
  pending: { text: "#fff4bf", bg: "#5b4a05" },
  locked: { text: "#9cc0e8", bg: "#17304a" },
} as const;

export type ThemeMode = "dark" | "light";
