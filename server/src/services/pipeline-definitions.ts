import { ModalidadPago, SettingKey, SettingLevel, StageType, TipoObra } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type ChecklistTemplate = {
  label: string;
  isRequired?: boolean;
  isBlocker?: boolean;
  appliesWhenModalidadPago?: ModalidadPago;
};

export type SubstageTemplate = {
  order: number;
  name: string;
  sopCode?: string;
  responsableRol?: string;
  responsible: string;
  isSystem?: boolean;
  isActive?: boolean;
  operationVariant?: TipoObra;
  checklist?: ChecklistTemplate[];
};

export type StageTemplate = {
  order: number;
  name: StageType;
  label?: string;
  weight: number;
  substages: SubstageTemplate[];
};

export type PipelineTemplate = StageTemplate[];

export const STAGE_LABELS: Record<StageType, string> = {
  [StageType.ONBOARDING]: "Onboarding",
  [StageType.INGENIERIA]: "Ingeniería",
  [StageType.OPERACIONES]: "Operaciones",
  [StageType.HABILITACION_UTE]: "Habilitación UTE",
  [StageType.POSTVENTA]: "Post-Habilitación",
  // Pipeline expandido a 8 etapas (Traspasos v1).
  [StageType.PRE_INGENIERIA]: "Pre-Ingeniería",
  [StageType.REVISION_CAPATAZ]: "Revisión del Capataz",
  [StageType.VALIDACION_OPERACIONES]: "Validación de Operaciones",
  [StageType.INGENIERIA_FINAL]: "Ingeniería Final",
  [StageType.COMPRAS]: "Compras",
  [StageType.EJECUCION_OBRA]: "Ejecución de Obra",
  [StageType.TRAMITACION_UTE]: "Tramitación UTE",
  [StageType.POST_HABILITACION]: "Post-Habilitación",
};

export const TIPO_OBRA_LABELS: Record<TipoObra, string> = {
  [TipoObra.PROPIA]: "Propia",
  [TipoObra.TERCERIZADA]: "Tercerizada",
};

export function getStageLabel(stage: StageType) {
  return STAGE_LABELS[stage];
}

export function getTipoObraLabel(tipoObra: TipoObra) {
  return TIPO_OBRA_LABELS[tipoObra];
}

export const PIPELINE_DEFINITIONS: StageTemplate[] = [
  {
    order: 1,
    name: StageType.ONBOARDING,
    weight: 18,
    substages: [
      {
        order: 1,
        name: "Confirmación formal por escrito",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Alcance confirmado", isRequired: true },
          { label: "Precio final confirmado", isRequired: true },
          { label: "Modalidad de pago confirmada", isRequired: true },
          { label: "Nota en CRM registrada", isRequired: true },
        ],
      },
      {
        order: 2,
        name: "Cobro de seña (USD 500)",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Datos de transferencia enviados", isRequired: true },
          { label: "Pago confirmado", isRequired: true, isBlocker: true },
          { label: "Comprobante guardado en carpeta", isRequired: true },
          { label: "Registrado en CRM", isRequired: true },
        ],
      },
      {
        order: 3,
        name: "Contrato",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Contrato completado con datos del cliente", isRequired: true },
          { label: "Enviado al cliente", isRequired: true },
          { label: "Recibido firmado", isRequired: true, isBlocker: true },
          { label: "Guardado en carpeta", isRequired: true },
        ],
      },
      {
        order: 4,
        name: "Recolección de datos administrativos",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Mail confirmado", isRequired: true },
          { label: "Cédula confirmada", isRequired: true },
          { label: "Teléfono confirmado", isRequired: true },
          { label: "MEI si corresponde", isRequired: true },
          { label: "Foto de cédula guardada", isRequired: true },
          { label: "Todo guardado en carpeta", isRequired: true },
        ],
      },
      {
        order: 5,
        name: "Modalidad de pago definida",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Modalidad de pago definida", isRequired: true },
          {
            label: "Proforma enviada al banco",
            isRequired: true,
            appliesWhenModalidadPago: ModalidadPago.FINANCIACION_BANCARIA,
          },
          {
            label: "Crédito aprobado",
            isRequired: true,
            isBlocker: true,
            appliesWhenModalidadPago: ModalidadPago.FINANCIACION_BANCARIA,
          },
        ],
      },
      {
        order: 6,
        name: "Organización carpeta digital",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Cotización Excel guardada", isRequired: true },
          { label: "Todas las versiones de propuesta guardadas", isRequired: true },
          { label: "Propuesta final aprobada guardada", isRequired: true },
          { label: "Factura UTE guardada", isRequired: true },
          { label: "Contrato firmado guardado", isRequired: true },
          { label: "Foto de cédula guardada", isRequired: true },
          { label: "Datos del cliente guardados", isRequired: true },
          { label: "Comprobante de seña guardado", isRequired: true },
          { label: "Minuta de visita guardada", isRequired: true },
        ],
      },
      {
        order: 7,
        name: "Registro en planilla de operaciones",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Datos cliente cargados", isRequired: true },
          { label: "Sistema vendido registrado", isRequired: true },
          { label: "Fecha de venta registrada", isRequired: true },
          { label: "Fecha tentativa de obra registrada", isRequired: true },
          { label: "Modalidad de pago registrada", isRequired: true },
          { label: "Margen esperado registrado", isRequired: true },
          { label: "Estado del proyecto registrado", isRequired: true },
        ],
      },
      {
        order: 8,
        name: "Consulta inicial UTE",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Consulta enviada", isRequired: true, isBlocker: true },
          { label: "Guardada en carpeta", isRequired: true },
          { label: "Registrada en planilla de trámites UTE", isRequired: true },
          { label: "Registrada en CRM", isRequired: true },
        ],
      },
      {
        order: 9,
        name: "Comunicación al cliente",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Informado sobre relevamiento técnico", isRequired: true },
          { label: "Fecha tentativa de obra informada", isRequired: true },
          { label: "Próximos pasos explicados", isRequired: true },
        ],
      },
    ],
  },
  {
    order: 2,
    name: StageType.INGENIERIA,
    weight: 22,
    substages: [
      {
        order: 1,
        name: "Relevamiento Técnico",
        sopCode: "O0",
        responsableRol: "Técnico de Relevamiento",
        responsible: "Técnico de Relevamiento / Gerente de Operaciones",
        isSystem: true,
        checklist: [
          { label: "Visita coordinada con cliente", isRequired: true },
          { label: "Fecha registrada en CRM", isRequired: true },
          { label: "Visita confirmada el día anterior", isRequired: true },
          { label: "Tipo y estado del techo relevado", isRequired: true },
          { label: "Pendiente y orientación medidas", isRequired: true },
          { label: "Obstáculos identificados", isRequired: true },
          { label: "Sistema de fijación viable definido", isRequired: true },
          { label: "Tipo de suministro relevado", isRequired: true },
          { label: "Estado de tablero relevado", isRequired: true },
          { label: "Espacio para protecciones verificado", isRequired: true },
          { label: "Puesta a tierra relevada", isRequired: true },
          { label: "Ubicación del inversor definida", isRequired: true },
          { label: "Ubicación de tablero de protecciones definida", isRequired: true },
          { label: "Recorridos DC y AC medidos", isRequired: true },
          { label: "Fotos del techo cargadas", isRequired: true },
          { label: "Fotos de estructura cargadas", isRequired: true },
          { label: "Fotos del tablero cargadas", isRequired: true },
          { label: "Fotos de puesta a tierra cargadas", isRequired: true },
          { label: "Fotos de canalizaciones cargadas", isRequired: true },
          { label: "Fotos del entorno cargadas", isRequired: true },
          { label: "Informe técnico guardado en carpeta", isRequired: true, isBlocker: true },
          { label: "CRM movido a siguiente etapa", isRequired: true },
          { label: "Proyectista notificado", isRequired: true },
        ],
      },
      {
        order: 2,
        name: "Proyecto Final de Ingeniería",
        sopCode: "I2",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [
          { label: "Informe de relevamiento analizado", isRequired: true, isBlocker: true },
          { label: "Coherencia vendido/relevado/viable verificada", isRequired: true },
          { label: "Potencia final confirmada", isRequired: true },
          { label: "Cantidad de paneles confirmada", isRequired: true },
          { label: "Modelos definitivos de panel e inversor definidos", isRequired: true },
          { label: "Tipo de conexión definido", isRequired: true },
          { label: "Configuración de strings definida", isRequired: true },
          { label: "Todos los supuestos eliminados", isRequired: true },
          { label: "Sección de conductores DC definida", isRequired: true },
          { label: "Sección de conductores AC definida", isRequired: true },
          { label: "Longitudes reales definidas", isRequired: true },
          { label: "Protecciones eléctricas definidas", isRequired: true },
          { label: "Ubicación definitiva de equipos definida", isRequired: true },
          { label: "Unifilar eléctrico completado", isRequired: true },
          { label: "Implantación de techo completada", isRequired: true },
          { label: "Plano estructural de montaje completado", isRequired: true },
          { label: "Ubicación de equipos completada", isRequired: true },
          { label: "Esquema de canalización completado si aplica", isRequired: true },
          { label: "Lista de materiales completa", isRequired: true },
          { label: "Versión asignada", isRequired: true },
          { label: "Archivo nombrado con versión y fecha", isRequired: true },
          { label: "Coherencia planos/materiales verificada", isRequired: true },
          { label: "Sin elementos indefinidos", isRequired: true },
          { label: "Sin decisiones abiertas", isRequired: true },
          { label: "Proyecto guardado en carpeta", isRequired: true, isBlocker: true },
          { label: "Lista de materiales guardada", isRequired: true },
          { label: "Emisión registrada en CRM", isRequired: true },
          { label: "Operaciones notificada", isRequired: true },
          { label: "Estado cambiado a listo para planificación", isRequired: true },
        ],
      },
    ],
  },
  {
    order: 3,
    name: StageType.OPERACIONES,
    weight: 30,
    substages: [
      {
        order: 1,
        name: "Planificación y Logística",
        sopCode: "O1",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
        isActive: true,
        checklist: [
          { label: "Fecha confirmada con cliente y en agenda", isRequired: true },
          { label: "Equipo asignado", isRequired: true },
          { label: "Lista de materiales verificada", isRequired: true },
          { label: "Stock controlado y compras gestionadas", isRequired: true },
          { label: "Kit de obra separado y preparado", isRequired: true },
          { label: "Control del día anterior completado", isRequired: true },
        ],
      },
      {
        order: 2,
        name: "Ejecución de Obra Propia",
        sopCode: "O2P",
        responsableRol: "Jefe de Obra",
        responsible: "Jefe de Obra",
        isSystem: true,
        isActive: false,
        operationVariant: TipoObra.PROPIA,
        checklist: [
          { label: "Cliente o responsable presente confirmado", isRequired: true },
          { label: "Alcance repasado con cliente", isRequired: true },
          { label: "Cortes eléctricos explicados", isRequired: true },
          { label: "Ubicación final confirmada", isRequired: true },
          { label: "Seguridad verificada", isRequired: true },
          { label: "Estructura montada", isRequired: true },
          { label: "Paneles instalados", isRequired: true },
          { label: "Canalizaciones realizadas", isRequired: true },
          { label: "Cableado DC completo", isRequired: true },
          { label: "Tablero armado", isRequired: true },
          { label: "Protecciones AC/DC instaladas", isRequired: true },
          { label: "Puesta a tierra realizada", isRequired: true },
          { label: "Rotulado completo", isRequired: true },
          { label: "Gerente de Operaciones notificado", isRequired: true },
          { label: "Medición de strings realizada", isRequired: true },
          { label: "Verificación eléctrica y puesta a tierra realizada", isRequired: true },
          { label: "Conexión final AC realizada", isRequired: true },
          { label: "Sistema encendido", isRequired: true },
          { label: "Planta creada en servidor", isRequired: true },
          { label: "Parámetros configurados", isRequired: true },
          { label: "Ensayo anti-isla realizado y grabado", isRequired: true, isBlocker: true },
          { label: "Checklist técnico completo", isRequired: true },
          { label: "Recorrido y explicación al cliente", isRequired: true },
          { label: "Firma del cliente en checklist", isRequired: true },
          { label: "Fotos generales subidas", isRequired: true },
          { label: "Fotos de tablero y protecciones subidas", isRequired: true },
          { label: "Fotos de puesta a tierra subidas", isRequired: true },
          { label: "Videos de ensayos subidos", isRequired: true },
          { label: "Checklist firmado subido", isRequired: true },
          { label: "Documentación UTE firmada subida", isRequired: true },
        ],
      },
      {
        order: 3,
        name: "Ejecución de Obra Tercerizada",
        sopCode: "O2T",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
        isActive: false,
        operationVariant: TipoObra.TERCERIZADA,
        checklist: [
          { label: "Proyecto de ingeniería entregado", isRequired: true },
          { label: "Plano de montaje entregado", isRequired: true },
          { label: "Esquema unifilar entregado", isRequired: true },
          { label: "Lista de materiales entregada", isRequired: true },
          { label: "Materiales físicos entregados", isRequired: true },
          { label: "Estándar técnico comunicado", isRequired: true },
          { label: "Checklist oficial entregado", isRequired: true },
          { label: "Documentación UTE entregada", isRequired: true },
          { label: "Estándares de seguridad verificados", isRequired: true },
          { label: "Proyecto respetado sin modificaciones no autorizadas", isRequired: true, isBlocker: true },
          { label: "Fotos completas recibidas y subidas", isRequired: true },
          { label: "Videos de ensayos recibidos y subidos", isRequired: true },
          { label: "Checklist firmado recibido", isRequired: true },
          { label: "Documentación UTE firmada recibida", isRequired: true },
          { label: "Todo cargado en carpeta compartida", isRequired: true },
        ],
      },
      {
        order: 4,
        name: "Control de Costos",
        sopCode: "O4",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
        isActive: true,
        checklist: [
          { label: "Consumo real registrado por material", isRequired: true },
          { label: "Material adicional comprado registrado", isRequired: true },
          { label: "Material sobrante registrado", isRequired: true },
          { label: "Comparación cantidad estimada vs real completada", isRequired: true },
          { label: "Comparación costo estimado vs real completada", isRequired: true },
          { label: "Desvío porcentual calculado", isRequired: true },
          { label: "Métricas de costo real por kW generadas", isRequired: true },
          { label: "Análisis de desvíos documentado si aplica", isRequired: true },
        ],
      },
    ],
  },
  {
    order: 4,
    name: StageType.HABILITACION_UTE,
    weight: 15,
    substages: [
      {
        order: 1,
        name: "Trámite de microgeneración UTE",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
      },
      {
        order: 2,
        name: "Inspección y aprobación UTE",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
      },
      {
        order: 3,
        name: "Medidor bidireccional",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
      },
    ],
  },
  {
    order: 5,
    name: StageType.POSTVENTA,
    weight: 15,
    substages: [
      {
        order: 1,
        name: "Capacitación al cliente",
        responsible: "Equipo Postventa",
        isSystem: true,
      },
      {
        order: 2,
        name: "Alta en plataforma de monitoreo",
        responsible: "Equipo Postventa",
        isSystem: true,
      },
      {
        order: 3,
        name: "Garantías y documentación final",
        responsible: "Equipo Postventa",
        isSystem: true,
      },
    ],
  },
];

export function getStageDefinition(stageType: StageType) {
  return PIPELINE_DEFINITIONS.find((stage) => stage.name === stageType) ?? null;
}

/**
 * Devuelve el template activo del pipeline.
 * - Si existe un registro en settings (key PIPELINE_TEMPLATE) con JSON válido,
 *   se usa ése.
 * - Si no, fallback al const hardcoded PIPELINE_DEFINITIONS.
 * Se invoca al crear un proyecto (POST /projects, conversión de lead).
 */
export async function getActivePipelineTemplate(): Promise<PipelineTemplate> {
  try {
    const setting = await prisma.setting.findFirst({
      where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
    });
    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value) as { stages?: PipelineTemplate };
      if (parsed && Array.isArray(parsed.stages) && parsed.stages.length > 0) {
        return parsed.stages as PipelineTemplate;
      }
    }
  } catch {
    // JSON inválido o DB no disponible → usar fallback
  }
  return PIPELINE_DEFINITIONS;
}

export function getOperationVisibility(tipoObra: TipoObra) {
  return {
    [TipoObra.PROPIA]: {
      "Ejecución de Obra Propia": true,
      "Ejecución de Obra Tercerizada": false,
    },
    [TipoObra.TERCERIZADA]: {
      "Ejecución de Obra Propia": false,
      "Ejecución de Obra Tercerizada": true,
    },
  }[tipoObra];
}
