const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

function projectLink(projectId: string) {
  return `${BASE_URL}/projects/${projectId}`;
}

export function waTaskDue(params: {
  projectName: string;
  projectId: string;
  taskTitle: string;
  dueDate: string;
}) {
  return `⚠ *${params.projectName}*\nTarea por vencer: _${params.taskTitle}_\nFecha límite: ${params.dueDate}\nVer: ${projectLink(params.projectId)}`;
}

export function waStageOverdue(params: {
  projectName: string;
  projectId: string;
  stageName: string;
  delayDays: number;
}) {
  return `🔴 *${params.projectName}*\nEtapa retrasada: _${params.stageName}_\nDías de retraso: ${params.delayDays}\nVer: ${projectLink(params.projectId)}`;
}

export function waProgressMilestone(params: {
  projectName: string;
  projectId: string;
  percent: number;
}) {
  return `✅ *${params.projectName}* alcanzó el *${params.percent}%* de avance\nVer: ${projectLink(params.projectId)}`;
}

export function waSubstageBlocked(params: {
  projectName: string;
  projectId: string;
  substageName: string;
  responsible?: string | null;
}) {
  const respLine = params.responsible ? `\nResponsable: ${params.responsible}` : "";
  return `🔒 *${params.projectName}*\nSubetapa bloqueada: _${params.substageName}_${respLine}\nVer: ${projectLink(params.projectId)}`;
}

export function waProjectDelayed(params: {
  projectName: string;
  projectId: string;
  delayDays: number;
}) {
  return `📅 *${params.projectName}* acumula *${params.delayDays} días* de desvío\nVer: ${projectLink(params.projectId)}`;
}

export function waStageChanged(params: {
  projectName: string;
  projectId: string;
  stageName: string;
  newStatus: string;
}) {
  return `📋 *${params.projectName}*\n_${params.stageName}_ cambió a *${params.newStatus}*\nVer: ${projectLink(params.projectId)}`;
}
