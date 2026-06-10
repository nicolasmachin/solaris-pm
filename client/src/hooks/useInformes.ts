import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import {
  borrarAdjuntoInforme,
  borrarInforme,
  crearInforme,
  editarInforme,
  enviarInforme,
  getInforme,
  getInformes,
  getInformesPendientesCount,
  responderInforme,
  subirAdjuntoInforme,
  type CrearInformeBody,
  type EditarInformeBody,
  type InformeBox,
  type InformeEstado,
} from "../api/informes.api";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function useInformesList(filtros: { box: InformeBox; estado?: InformeEstado; search?: string }) {
  return useQuery({
    queryKey: ["informes", filtros.box, filtros.estado ?? "", filtros.search ?? ""],
    queryFn: () => getInformes(filtros),
  });
}

export function useInforme(id: string | null) {
  return useQuery({
    queryKey: ["informe", id],
    queryFn: () => getInforme(id!),
    enabled: !!id,
  });
}

// Contador del badge. Es una llamada SECUNDARIA: nunca debe poder voltear la
// sesión. Por eso:
//  - `enabled`: solo se dispara si el caller confirma permiso INFORMES.VIEW
//    (fallo seguro: sin permiso, el endpoint no se llama).
//  - `retry: false`: si igual fallara, no reintenta y no genera ruido.
export function useInformesPendientesCount(enabled = true) {
  return useQuery({
    queryKey: ["informes-pendientes-count"],
    queryFn: getInformesPendientesCount,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

// Mutaciones. Invalidan la lista, el detalle y el contador del badge.
export function useInformeMutations(selectedId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["informes"] });
    qc.invalidateQueries({ queryKey: ["informes-pendientes-count"] });
    if (selectedId) qc.invalidateQueries({ queryKey: ["informe", selectedId] });
  };

  const crear = useMutation({
    mutationFn: (body: CrearInformeBody) => crearInforme(body),
    onSuccess: () => {
      toast.success("Borrador creado");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo crear el informe"),
  });

  const editar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EditarInformeBody }) => editarInforme(id, body),
    onSuccess: () => {
      toast.success("Cambios guardados");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar"),
  });

  const enviar = useMutation({
    mutationFn: (id: string) => enviarInforme(id),
    onSuccess: () => {
      toast.success("Informe enviado");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo enviar"),
  });

  const responder = useMutation({
    mutationFn: ({ id, respuesta, comentario }: { id: string; respuesta: "APROBADO" | "DEVUELTO"; comentario?: string }) =>
      responderInforme(id, { respuesta, comentario }),
    onSuccess: (_d, vars) => {
      toast.success(vars.respuesta === "DEVUELTO" ? "Informe devuelto" : "Informe aprobado");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo responder"),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => borrarInforme(id),
    onSuccess: () => {
      toast.success("Informe eliminado");
      invalidate();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar"),
  });

  const subirAdjunto = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => subirAdjuntoInforme(id, file),
    onSuccess: () => {
      if (selectedId) qc.invalidateQueries({ queryKey: ["informe", selectedId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo subir el adjunto"),
  });

  const borrarAdjunto = useMutation({
    mutationFn: ({ id, fileId }: { id: string; fileId: string }) => borrarAdjuntoInforme(id, fileId),
    onSuccess: () => {
      if (selectedId) qc.invalidateQueries({ queryKey: ["informe", selectedId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo borrar el adjunto"),
  });

  return { crear, editar, enviar, responder, borrar, subirAdjunto, borrarAdjunto };
}
