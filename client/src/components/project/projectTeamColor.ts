import type { CSSProperties } from "react";

type ProjectWithTeamColor =
  | {
      installationTeamColor?: string | null;
      installationSchedule?: {
        teamColor?: string | null;
      } | null;
    }
  | null
  | undefined;

function normalizeHexColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  if (hex.length === 3) {
    return `#${hex.split("").map((char) => char + char).join("").toUpperCase()}`;
  }
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(hex: string) {
  const value = hex.slice(1);
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function getProjectTeamColor(project: ProjectWithTeamColor): string | null {
  return normalizeHexColor(
    project?.installationSchedule?.teamColor ?? project?.installationTeamColor ?? null,
  );
}

export function getProjectTeamSurfaceStyle(
  project: ProjectWithTeamColor,
  options?: { isDark?: boolean },
): CSSProperties | undefined {
  const color = getProjectTeamColor(project);
  if (!color) return undefined;

  const isDark = options?.isDark ?? false;
  const luminance = relativeLuminance(color);
  const isVeryDark = luminance < 0.12;

  const backgroundAlpha = isDark
    ? isVeryDark
      ? 0.1
      : 0.16
    : isVeryDark
      ? 0.06
      : 0.1;
  const borderAlpha = isDark
    ? isVeryDark
      ? 0.2
      : 0.32
    : isVeryDark
      ? 0.14
      : 0.22;

  return {
    backgroundColor: rgba(color, backgroundAlpha),
    borderColor: rgba(color, borderAlpha),
  };
}
