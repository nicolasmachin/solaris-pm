export type DeadlineRuleTipo =
  | 'DIAS_DESDE_CREACION'
  | 'DIAS_ANTES_INSTALACION'
  | 'MANUAL'
  | 'SIN_DEADLINE';

export type StageType =
  | 'ONBOARDING'
  | 'INGENIERIA'
  | 'OPERACIONES'
  | 'HABILITACION_UTE'
  | 'POSTVENTA'
  // Pipeline expandido a 8 etapas + 2 bloques CX paralelos (Traspasos v1).
  | 'PRE_INGENIERIA'
  | 'REVISION_CAPATAZ'
  | 'VALIDACION_OPERACIONES'
  | 'INGENIERIA_FINAL'
  | 'COMPRAS'
  | 'EJECUCION_OBRA'
  | 'TRAMITACION_UTE'
  | 'POST_HABILITACION'
  | 'SEGUIMIENTO_PREOBRA'
  | 'SEGUIMIENTO_HABILITACION';

export interface DeadlineRule {
  id: string;
  stageType: StageType;
  sopCode: string | null;
  substageName: string | null;
  tipo: DeadlineRuleTipo;
  dias: number | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeadlineRulePayload {
  stageType: StageType;
  sopCode?: string | null;
  substageName?: string | null;
  tipo: DeadlineRuleTipo;
  dias?: number | null;
  activa?: boolean;
}

export type UpdateDeadlineRulePayload = Partial<Pick<CreateDeadlineRulePayload, 'tipo' | 'dias' | 'activa'>>;

export const DEADLINE_RULE_TIPO_LABEL: Record<DeadlineRuleTipo, string> = {
  DIAS_DESDE_CREACION: 'Días desde creación del proyecto',
  DIAS_ANTES_INSTALACION: 'Días antes de la instalación',
  MANUAL: 'Manual (editado por el usuario)',
  SIN_DEADLINE: 'Sin deadline',
};

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  ONBOARDING: 'Onboarding',
  INGENIERIA: 'Ingeniería',
  OPERACIONES: 'Operaciones',
  HABILITACION_UTE: 'Habilitación UTE',
  POSTVENTA: 'Post-Habilitación',
  PRE_INGENIERIA: 'Pre-Ingeniería',
  REVISION_CAPATAZ: 'Revisión del Capataz',
  VALIDACION_OPERACIONES: 'Validación de Operaciones',
  INGENIERIA_FINAL: 'Ingeniería Final',
  COMPRAS: 'Compras',
  EJECUCION_OBRA: 'Ejecución de Obra',
  TRAMITACION_UTE: 'Tramitación UTE',
  POST_HABILITACION: 'Post-Habilitación',
  SEGUIMIENTO_PREOBRA: 'Experiencia Solar · Preobra',
  SEGUIMIENTO_HABILITACION: 'Experiencia Solar · Habilitación',
};
