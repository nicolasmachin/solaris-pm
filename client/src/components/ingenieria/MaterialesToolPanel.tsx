import { EngineeringMaterials } from "../project/EngineeringMaterials";

/**
 * Panel inline de la herramienta "Lista de materiales" en el workspace de
 * Ingeniería. Reusa el componente original `EngineeringMaterials` que vivía
 * en el StageDrawer del proyecto — la lógica interna (categorías, generación
 * de previstos, exportación de PDF) no cambió.
 *
 * `plannedWorkStart` queda en `null`: en el StageDrawer se pasaba la fecha
 * planificada del stage Ingeniería, pero el componente ya tiene fallback al
 * día actual. Si en el futuro hace falta precargar la fecha desde el workspace,
 * se puede leer del endpoint del workspace (no es bloqueante).
 */
export function MaterialesToolPanel({ projectId }: { projectId: string }) {
  return <EngineeringMaterials projectId={projectId} plannedWorkStart={null} />;
}
