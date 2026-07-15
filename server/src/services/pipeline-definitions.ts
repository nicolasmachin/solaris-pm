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
  [StageType.SEGUIMIENTO_PREOBRA]: "Experiencia Solar · Preobra",
  [StageType.SEGUIMIENTO_HABILITACION]: "Experiencia Solar · Habilitación",
};

// Etapas PARALELAS de Experiencia Solar: corren al costado del pipeline y NO
// participan del orden lineal, el progreso ni el cierre del proyecto.
export const PARALLEL_STAGE_TYPES: StageType[] = [
  StageType.SEGUIMIENTO_PREOBRA,
  StageType.SEGUIMIENTO_HABILITACION,
];
export function isParallelStage(name: StageType | string): boolean {
  return name === StageType.SEGUIMIENTO_PREOBRA || name === StageType.SEGUIMIENTO_HABILITACION;
}

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
        // Nueva sub-tarea (spec v3 C8): Ventas agenda la fecha tentativa de obra
        // antes de comunicar al cliente. El evento de calendario nace "tentativo"
        // (C9) y luego el gerente lo confirma en Validación de Operaciones.
        order: 9,
        name: "Fecha tentativa de obra",
        sopCode: "V3",
        responsableRol: "Asesor Comercial",
        responsible: "Asesor Comercial",
        isSystem: true,
        checklist: [
          { label: "Fecha tentativa de obra definida", isRequired: true },
          { label: "Evento tentativo agendado en el calendario", isRequired: true },
        ],
      },
      {
        order: 10,
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
  // ─── Etapa 2: Pre-Ingeniería (Ingeniería) ──────────────────────────────────
  // Pipeline expandido a 8 etapas (Traspasos). Carga el Relevamiento Técnico
  // (SOP O0) que antes vivía en la etapa INGENIERIA. Cierre → T2.
  {
    order: 2,
    name: StageType.PRE_INGENIERIA,
    weight: 11,
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
      // Entregables de diseño de la pre-ingeniería (guía del diagrama de pipeline
      // v3). Checklists mínimos por ahora; el workspace de Ingeniería (Unifilar,
      // pre-ingeniería, materiales) se abre a nivel etapa desde la UI.
      {
        order: 2,
        name: "Documento pre-ingeniería",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Documento de pre-ingeniería generado", isRequired: true }],
      },
      {
        order: 3,
        name: "Unifilar",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Diagrama unifilar preliminar generado", isRequired: true }],
      },
      {
        order: 4,
        name: "Memoria descriptiva",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Memoria descriptiva redactada", isRequired: true }],
      },
      {
        order: 5,
        name: "Memoria de cálculo",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Memoria de cálculo completada", isRequired: true }],
      },
      {
        order: 6,
        name: "Planos aéreos",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Planos aéreos completados", isRequired: true }],
      },
      {
        order: 7,
        name: "Planos estructurales",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Planos estructurales completados", isRequired: true }],
      },
      {
        order: 8,
        name: "Lista de materiales preliminar",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Lista de materiales preliminar armada", isRequired: true }],
      },
    ],
  },
  // ─── Etapa 3: Validación de Operaciones (Operaciones · Capatacía/Gerente) ───
  // Unifica el informe del capataz (audio+IA, se mueve desde Ingeniería) con la
  // confirmación de la fecha real de obra. Disparador compuesto → T3 + T4 (v3 C7/C12).
  // Sub-tareas mínimas: el detalle fino se define con la gerencia (a definir).
  {
    order: 3,
    name: StageType.VALIDACION_OPERACIONES,
    weight: 11,
    substages: [
      {
        order: 1,
        name: "Informe del capataz",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
        checklist: [
          { label: "Visita técnica del capataz realizada (o no aplica)", isRequired: true },
          { label: "Lista de materiales validada (OK o con modificaciones)", isRequired: true },
          { label: "Informe cargado (texto/audio/fotos, procesado por IA)", isRequired: true },
        ],
      },
      {
        order: 2,
        name: "Fecha de obra confirmada",
        responsableRol: "Gerente de Operaciones",
        responsible: "Gerente de Operaciones",
        isSystem: true,
        checklist: [
          { label: "Fecha real de obra confirmada", isRequired: true },
          { label: "Evento de calendario marcado como confirmado", isRequired: true },
        ],
      },
    ],
  },
  // ─── Etapa 4: Ingeniería Final (Ingeniería) ────────────────────────────────
  // Carga el Proyecto Final de Ingeniería (SOP I2). Cierre → T5.
  {
    order: 4,
    name: StageType.INGENIERIA_FINAL,
    weight: 11,
    substages: [
      {
        order: 1,
        name: "Revisar informe del capataz",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Informe del capataz revisado e incorporado", isRequired: true }],
      },
      {
        // Hereda el checklist SOP del Proyecto Final de Ingeniería (I2).
        order: 2,
        name: "Validar/ajustar paquete de ingeniería",
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
      {
        order: 3,
        name: "Cerrar lista definitiva",
        responsableRol: "Proyectista",
        responsible: "Proyectista",
        isSystem: true,
        checklist: [{ label: "Lista definitiva de materiales cerrada y versionada", isRequired: true }],
      },
    ],
  },
  // ─── Etapa 5: Compras (Operaciones · Compras) ──────────────────────────────
  // Regla de Oro: lista definitiva 7 días hábiles antes de obra; materiales
  // recibidos y verificados 3 días hábiles antes. Cierre (materiales) → T6.
  // "Logística de envío" es condicional (NO_APLICA si el equipo no es tercerizado, C13).
  {
    order: 5,
    name: StageType.COMPRAS,
    weight: 10,
    substages: [
      {
        order: 1,
        name: "Materiales listos (stock + comprados)",
        responsableRol: "Compras",
        responsible: "Compras",
        isSystem: true,
        checklist: [
          { label: "Lista definitiva recibida de Ingeniería", isRequired: true },
          { label: "Documentación técnica para UTE incluida en la lista", isRequired: true },
          { label: "Stock controlado y faltantes comprados", isRequired: true },
        ],
      },
      {
        order: 2,
        name: "Logística de envío",
        responsableRol: "Compras",
        responsible: "Compras",
        isSystem: true,
        checklist: [
          { label: "Envío coordinado (si el equipo de obra es tercerizado)", isRequired: true },
        ],
      },
      {
        order: 3,
        name: "Materiales recibidos en depósito",
        responsableRol: "Compras",
        responsible: "Compras",
        isSystem: true,
        checklist: [
          { label: "Materiales recibidos en depósito", isRequired: true },
          { label: "Materiales verificados (cantidad y estado)", isRequired: true, isBlocker: true },
        ],
      },
    ],
  },
  // ─── Etapa 6: Ejecución de Obra (Operaciones) ──────────────────────────────
  // Carga Planificación/Logística (O1), Ejecución Propia/Tercerizada (O2P/O2T)
  // y Control de Costos (O4, v3 C14). Cierre → T7.
  {
    order: 6,
    name: StageType.EJECUCION_OBRA,
    weight: 20,
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
  // ─── Etapa 7: Tramitación UTE ──────────────────────────────────────────────
  // Las subetapas las puebla ÍNTEGRAMENTE ute-sync (las 11 subetapas system con
  // uteAction, ver ensureUteSubstages). NO sembrar subetapas acá: hacerlo
  // duplicaba la etapa (3 del template + 11 del módulo de trámites). Cierre → T8.
  {
    order: 7,
    name: StageType.TRAMITACION_UTE,
    weight: 15,
    substages: [],
  },
  // ─── Etapa 8: Post-Habilitación (Experiencia Solar) ────────────────────────
  // Etapa indefinida (E3-A / E3-B), sin fechas. No dispara traspaso de cierre.
  {
    order: 8,
    name: StageType.POST_HABILITACION,
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
  // ─── Etapas PARALELAS de Experiencia Solar (§10) ───────────────────────────
  // Corren al costado del pipeline técnico: no tienen fechas, no participan del
  // orden lineal ni del cierre del proyecto. Se operan por sus sub-etapas.
  {
    order: 9,
    name: StageType.SEGUIMIENTO_PREOBRA,
    weight: 0,
    substages: [
      {
        order: 1,
        name: "Mensaje de bienvenida al Generador",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Bienvenida enviada al Generador", isRequired: true }],
      },
      {
        order: 2,
        name: "Seguimiento semanal (preobra)",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Contacto semanal al día", isRequired: true }],
      },
      {
        order: 3,
        name: "Registro en bitácora",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Interacciones registradas en la bitácora", isRequired: true }],
      },
    ],
  },
  {
    order: 10,
    name: StageType.SEGUIMIENTO_HABILITACION,
    weight: 0,
    substages: [
      {
        order: 1,
        name: "Aviso de inicio de trámite UTE al Generador",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Generador informado del inicio del trámite", isRequired: true }],
      },
      {
        order: 2,
        name: "Seguimiento semanal (habilitación)",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Contacto semanal al día", isRequired: true }],
      },
      {
        order: 3,
        name: "Aviso de habilitación otorgada (Regla de Oro 24-48h)",
        responsableRol: "Experiencia Solar",
        responsible: "Experiencia Solar",
        isSystem: true,
        checklist: [{ label: "Generador avisado de que puede encender", isRequired: true, isBlocker: true }],
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
