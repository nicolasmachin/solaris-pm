type ProjectWithTeamColor =
  | {
      installationTeamColor?: string | null;
      installationTeamName?: string | null;
      installationTeamType?: "PROPIO" | "TERCERIZADO" | null;
      installationSchedule?: {
        teamColor?: string | null;
        teamName?: string | null;
        teamType?: "PROPIO" | "TERCERIZADO" | null;
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

export function getProjectTeamColor(project: ProjectWithTeamColor): string | null {
  return normalizeHexColor(
    project?.installationSchedule?.teamColor ?? project?.installationTeamColor ?? null,
  );
}

export function getProjectTeamName(project: ProjectWithTeamColor): string | null {
  return project?.installationSchedule?.teamName ?? project?.installationTeamName ?? null;
}

export function getProjectTeamType(project: ProjectWithTeamColor): "PROPIO" | "TERCERIZADO" | null {
  return project?.installationSchedule?.teamType ?? project?.installationTeamType ?? null;
}
