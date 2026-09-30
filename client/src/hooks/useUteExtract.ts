import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { getProject, patchProject } from "../api/projects.api";
import {
  getUteDocsConfig,
  saveUteDocsConfig,
  type UteDocumentConfig,
} from "../api/uteDocs.api";
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

  // Excepción: nombreCliente SIEMPRE se actualiza desde la cédula (no se
  // respeta el valor previo). La cédula es la fuente autoritativa del
  // nombre para los docs UTE. El título del proyecto (clientName) sí queda
  // intacto siempre.
  if (tipo === "cedula" && data.nombre_cliente) {
    out.nombreCliente = data.nombre_cliente;
  }
  fill("ciCliente", data.ci_cliente);
  fill("calle", data.calle);
  fill("numCalle", data.num_calle);
  fill("clientAddress", data.dir_cliente);
  fill("clientEmail", data.mail_cliente);
  fill("clientPhone", data.telefono_cliente);
  // Ciudad y depto: no se tocan desde la extracción.
  // Persona física / empresa: se respetan los valores actuales del proyecto
  // (default true al crear). No los modifica la extracción.
  return out;
}

// Campos que van a UteDocumentConfig. Misma regla "solo si está vacío".
//
// En un suministro que no es el principal, el titular y la dirección también
// van acá (a su config), porque pueden ser distintos de los del proyecto: el
// proyecto no se toca.
function buildConfigPatch(
  data: Partial<UteExtractedData>,
  config: UteDocumentConfig | undefined,
  tipo: UteExtractTipo,
  suministro: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fill = <K extends keyof UteDocumentConfig>(field: K, value: unknown): void => {
    if (!value) return;
    if (config && !isEmpty(config[field])) return;
    out[field as string] = value;
  };
  if (suministro !== 1) {
    // Misma regla que en el proyecto: la cédula manda en el nombre.
    if (tipo === "cedula" && data.nombre_cliente) out.titularNombre = data.nombre_cliente;
    fill("titularCi", data.ci_cliente);
    fill("calle", data.calle);
    fill("numCalle", data.num_calle);
  }
  fill("cuentaUte", data.cuenta_ute);
  fill("casoUte", data.caso_ute);
  fill("oficina", data.oficina_ute);
  fill("tarifa", data.tarifa_ute);
  fill("potContratada", data.pot_contratada);
  return out;
}

// `suministro`: a qué cuenta UTE del proyecto pertenece el documento. El 1 (el
// principal) guarda en el proyecto como siempre; los demás, en su config.
export function useUteExtract(projectId: string, suministro: number = 1) {
  const qc = useQueryClient();
  const principal = suministro === 1;
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const configQ = useQuery({
    queryKey: principal ? ["ute-docs-config", projectId] : ["ute-docs-config", projectId, suministro],
    queryFn: () => getUteDocsConfig(projectId, suministro),
    enabled: !!projectId,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [extracted, setExtracted] = useState<UteExtractedData | null>(null);
  const [tipoActual, setTipoActual] = useState<UteExtractTipo | null>(null);

  const extractMut = useMutation({
    mutationFn: (args: { file: File; tipo: UteExtractTipo }) =>
      uteExtract(projectId, args.tipo, args.file, suministro),
    onSuccess: (resp) => {
      setExtracted(resp.extraido);
      setTipoActual(resp.tipo);
      setModalOpen(true);
      // Invalidar project para que la ruta del archivo (cedulaPath /
      // facturaUtePath) se vea actualizada.
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["suministros", projectId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudieron extraer los datos");
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (args: { data: Partial<UteExtractedData>; tipo: UteExtractTipo }) => {
      const projectPatch = principal ? buildProjectPatch(args.data, args.tipo, projectQ.data) : {};
      const configPatch = buildConfigPatch(args.data, configQ.data, args.tipo, suministro);
      const ops: Promise<unknown>[] = [];
      if (Object.keys(projectPatch).length > 0) ops.push(patchProject(projectId, projectPatch));
      if (Object.keys(configPatch).length > 0) ops.push(saveUteDocsConfig(projectId, configPatch, suministro));
      if (ops.length === 0) return { applied: 0 };
      await Promise.all(ops);
      return { applied: Object.keys(projectPatch).length + Object.keys(configPatch).length };
    },
    onSuccess: ({ applied }) => {
      toast.success(
        applied > 0
          ? `${applied} dato${applied === 1 ? "" : "s"} guardado${applied === 1 ? "" : "s"}`
          : "Sin cambios — los campos extraídos ya estaban cargados",
      );
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ute-docs-config", projectId] });
      qc.invalidateQueries({ queryKey: ["suministros", projectId] });
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
    const c = configQ.data;
    // nombre_cliente NO se marca como "ya en proyecto" — la cédula siempre
    // pisa nombreCliente (no afecta clientName / título del proyecto).
    if (!principal) {
      // Suministro con datos propios: lo que ya está es lo de su config.
      if (c && !isEmpty(c.titularCi)) out.add("ci_cliente");
      if (c && !isEmpty(c.calle)) out.add("calle");
      if (c && !isEmpty(c.numCalle)) out.add("num_calle");
    } else if (p) {
      if (!isEmpty(p.ciCliente)) out.add("ci_cliente");
      if (!isEmpty(p.calle)) out.add("calle");
      if (!isEmpty(p.numCalle)) out.add("num_calle");
      if (!isEmpty(p.clientAddress)) out.add("dir_cliente");
      if (!isEmpty(p.clientEmail)) out.add("mail_cliente");
      if (!isEmpty(p.clientPhone)) out.add("telefono_cliente");
    }
    if (c) {
      if (!isEmpty(c.cuentaUte)) out.add("cuenta_ute");
      if (!isEmpty(c.casoUte)) out.add("caso_ute");
      if (!isEmpty(c.oficina)) out.add("oficina_ute");
      if (!isEmpty(c.tarifa)) out.add("tarifa_ute");
      if (!isEmpty(c.potContratada)) out.add("pot_contratada");
    }
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
