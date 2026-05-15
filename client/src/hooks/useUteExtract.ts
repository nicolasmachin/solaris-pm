import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { patchProject } from "../api/projects.api";
import {
  uteExtract,
  type UteExtractTipo,
  type UteExtractedData,
} from "../api/uteExtract.api";

// Mapeo de campos extraídos por IA → campos del Project. Lo que se confirma
// en el modal se persiste vía patchProject.
//
// Reglas especiales por tipo de documento:
// - Cédula: el nombre extraído va a nombreCliente (campo UTE-específico).
//   NUNCA se modifica clientName (nombre del proyecto).
// - Factura UTE: se IGNORA el nombre del titular de la factura (no toca
//   ni clientName ni nombreCliente — el nombre oficial sale de cédula).
function buildProjectPatch(
  data: Partial<UteExtractedData>,
  tipo: UteExtractTipo,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (tipo === "cedula" && data.nombre_cliente) out.nombreCliente = data.nombre_cliente;
  if (data.ci_cliente) out.ciCliente = data.ci_cliente;
  if (data.calle) out.calle = data.calle;
  if (data.num_calle) out.numCalle = data.num_calle;
  if (data.dir_cliente) out.clientAddress = data.dir_cliente;
  if (data.ciudad) out.locationCity = data.ciudad;
  if (data.depto) out.locationProvince = data.depto;
  if (data.mail_cliente) out.notificationEmail = data.mail_cliente;
  if (data.telefono_cliente) out.notificationPhone = data.telefono_cliente;
  if (typeof data.persona_fisica === "boolean") {
    out.personaFisica = data.persona_fisica;
    out.empresa = !data.persona_fisica;
  }
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
      const projectPatch = buildProjectPatch(args.data, args.tipo);
      if (Object.keys(projectPatch).length === 0) return { applied: 0 };
      await patchProject(projectId, projectPatch);
      return { applied: Object.keys(projectPatch).length };
    },
    onSuccess: ({ applied }) => {
      toast.success(applied > 0 ? "Datos guardados en el proyecto" : "Sin cambios para guardar");
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

  return {
    uploadAndExtract: (file: File, tipo: UteExtractTipo) => extractMut.mutate({ file, tipo }),
    isExtracting: extractMut.isPending,
    modalOpen,
    extracted,
    tipoActual,
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
