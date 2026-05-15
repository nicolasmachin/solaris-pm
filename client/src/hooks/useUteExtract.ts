import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { getProject, patchProject } from "../api/projects.api";
import type { Project } from "../types/api.types";
import {
  uteExtract,
  type UteExtractTipo,
  type UteExtractedData,
} from "../api/uteExtract.api";

// Mapeo de campos extraídos por IA → campos del Project.
//
// Reglas:
// - Solo se persisten campos del proyecto que estén VACÍOS. Lo que el
//   usuario ya cargó (al crear el proyecto o después) no se modifica.
// - Cédula: el nombre va a nombreCliente. NUNCA toca clientName (nombre
//   del proyecto).
// - Factura UTE: se IGNORA el nombre del titular.
// - Ciudad y departamento NUNCA se extraen (vienen del create del
//   proyecto y son obligatorios allí).
function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function buildProjectPatch(
  data: Partial<UteExtractedData>,
  tipo: UteExtractTipo,
  project: Project | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Helper: incluir el campo solo si en el proyecto está vacío.
  const fill = <K extends keyof Project>(field: K, value: unknown): void => {
    if (!value) return;
    if (project && !isEmpty(project[field])) return;
    out[field as string] = value;
  };

  if (tipo === "cedula") fill("nombreCliente", data.nombre_cliente);
  fill("ciCliente", data.ci_cliente);
  fill("calle", data.calle);
  fill("numCalle", data.num_calle);
  fill("clientAddress", data.dir_cliente);
  fill("notificationEmail", data.mail_cliente);
  fill("notificationPhone", data.telefono_cliente);
  // Ciudad y depto: no se tocan desde la extracción.
  // Persona física / empresa: se respetan los valores actuales del proyecto
  // (default true al crear). No los modifica la extracción.
  return out;
}

// Campos que van a UteDocumentConfig (cuenta, caso). El frontend los manda
// como parte del confirm; el caller decide si los aplica.
export function buildConfigPatch(data: Partial<UteExtractedData>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.cuenta_ute) out.cuentaUte = data.cuenta_ute;
  if (data.caso_ute) out.casoUte = data.caso_ute;
  if (data.oficina_ute) out.oficina = data.oficina_ute;
  if (data.tarifa_ute) out.tarifa = data.tarifa_ute;
  if (data.pot_contratada) out.potContratada = data.pot_contratada;
  return out;
}

export function useUteExtract(projectId: string) {
  const qc = useQueryClient();
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [extracted, setExtracted] = useState<UteExtractedData | null>(null);
  const [tipoActual, setTipoActual] = useState<UteExtractTipo | null>(null);

  const extractMut = useMutation({
    mutationFn: (args: { file: File; tipo: UteExtractTipo }) =>
      uteExtract(projectId, args.tipo, args.file),
    onSuccess: (resp) => {
      setExtracted(resp.extraido);
      setTipoActual(resp.tipo);
      setModalOpen(true);
      // Invalidar project para que la ruta del archivo (cedulaPath /
      // facturaUtePath) se vea actualizada.
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudieron extraer los datos");
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (args: { data: Partial<UteExtractedData>; tipo: UteExtractTipo }) => {
      const projectPatch = buildProjectPatch(args.data, args.tipo, projectQ.data);
      if (Object.keys(projectPatch).length === 0) return { applied: 0 };
      await patchProject(projectId, projectPatch);
      return { applied: Object.keys(projectPatch).length };
    },
    onSuccess: ({ applied }) => {
      toast.success(
        applied > 0
          ? `${applied} dato${applied === 1 ? "" : "s"} guardado${applied === 1 ? "" : "s"} en el proyecto`
          : "Sin cambios — los campos extraídos ya estaban cargados en el proyecto",
      );
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setModalOpen(false);
      setExtracted(null);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar");
    },
  });

  // Qué campos extraídos NO van a persistirse porque el proyecto ya los tiene.
  // El modal usa este set para mostrarlos con un badge "ya en el proyecto".
  function buildAlreadyFilled(): Set<keyof UteExtractedData> {
    const out = new Set<keyof UteExtractedData>();
    const p = projectQ.data;
    if (!p) return out;
    if (!isEmpty(p.nombreCliente)) out.add("nombre_cliente");
    if (!isEmpty(p.ciCliente)) out.add("ci_cliente");
    if (!isEmpty(p.calle)) out.add("calle");
    if (!isEmpty(p.numCalle)) out.add("num_calle");
    if (!isEmpty(p.clientAddress)) out.add("dir_cliente");
    if (!isEmpty(p.notificationEmail)) out.add("mail_cliente");
    if (!isEmpty(p.notificationPhone)) out.add("telefono_cliente");
    return out;
  }

  return {
    uploadAndExtract: (file: File, tipo: UteExtractTipo) => extractMut.mutate({ file, tipo }),
    isExtracting: extractMut.isPending,
    modalOpen,
    extracted,
    tipoActual,
    alreadyFilled: buildAlreadyFilled(),
    confirmar: (data: Partial<UteExtractedData>) => {
      if (!tipoActual) return;
      confirmMut.mutate({ data, tipo: tipoActual });
    },
    isConfirming: confirmMut.isPending,
    cancelar: () => {
      setModalOpen(false);
      setExtracted(null);
    },
  };
}
