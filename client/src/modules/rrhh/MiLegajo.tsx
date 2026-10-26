import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  VINCULO_LABEL,
  deleteMiDocumento,
  getMiLegajo,
  updateMisDatos,
  uploadMiDocumento,
  type DatosSubida,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertasResumen,
  BotonBorrar,
  DatosPersonalesForm,
  DocumentoFila,
  Seccion,
  SubirDocumentoSheet,
  datosPersonalesDe,
  errorMsg,
  fmtFecha,
} from "./rrhhUi";

// Mi legajo: lo que cada persona ve y carga de sí misma. Los recibos y el
// contrato los sube administración; lo demás (carné, licencia, cursos…) lo
// carga la persona y queda pendiente hasta que lo validan.
export function MiLegajo() {
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["mi-legajo"], queryFn: getMiLegajo });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["mi-legajo"] });

  const subir = useMutation({
    mutationFn: ({ file, datos }: { file: File; datos: DatosSubida }) => uploadMiDocumento(file, datos),
    onSuccess: () => {
      toast.success("Documento cargado. Queda pendiente de validar.");
      setSubiendo(false);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo subir el documento")),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => deleteMiDocumento(id),
    onSuccess: () => {
      toast.success("Documento quitado");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo quitar")),
  });

  const guardar = useMutation({
    mutationFn: updateMisDatos,
    onSuccess: () => {
      toast.success("Datos guardados");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudieron guardar los datos")),
  });

  const datos = useMemo(() => (data ? datosPersonalesDe(data.legajo) : null), [data]);

  if (isLoading || !data || !datos) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const tercerizado = data.legajo.vinculo === "TERCERIZADO";
  const recibos = data.documentos
    .filter((d) => d.tipo === "RECIBO_SUELDO")
    .sort((a, b) => (b.periodo ?? b.createdAt).localeCompare(a.periodo ?? a.createdAt));
  const otros = data.documentos.filter((d) => d.tipo !== "RECIBO_SUELDO");

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Mi legajo</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Tus datos y tus documentos de trabajo. Lo que cargás acá lo ve solo administración.
        </p>
      </div>

      <AlertasResumen resumen={data.resumen} propio />

      {!tercerizado && (
        <Seccion titulo="Mis recibos">
          {recibos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay recibos cargados.</p>
          ) : (
            recibos.map((d) => <DocumentoFila key={d.id} doc={d} mostrarNuevo />)
          )}
        </Seccion>
      )}

      <Seccion
        titulo="Mis documentos"
        accion={
          <Button size="sm" onClick={() => setSubiendo(true)}>
            <span className="inline-flex items-center gap-1">
              <Plus size={14} /> Cargar documento
            </span>
          </Button>
        }
      >
        {otros.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Todavía no cargaste nada. Empezá por la cédula y el carné de salud.
          </p>
        ) : (
          otros.map((d) => (
            <DocumentoFila
              key={d.id}
              doc={d}
              acciones={
                d.subidoPorUserId === data.legajo.userId && d.estado !== "VALIDADO" ? (
                  <BotonBorrar
                    disabled={borrar.isPending}
                    onClick={() => {
                      if (confirm(`¿Quitar "${d.titulo}"?`)) borrar.mutate(d.id);
                    }}
                  />
                ) : undefined
              }
            />
          ))
        )}
      </Seccion>

      <Seccion titulo="Mis datos">
        <dl className="mb-5 grid grid-cols-2 gap-3 rounded-lg bg-[var(--color-bg-card-hover)] p-3 text-sm sm:grid-cols-4">
          {[
            ["Vínculo", VINCULO_LABEL[data.legajo.vinculo]],
            ["Ingreso", fmtFecha(data.legajo.fechaIngreso)],
            ["Cargo", data.legajo.cargo ?? "—"],
            ["Contrato", data.legajo.tipoContrato ?? "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-[var(--color-text-muted)]">{k}</dt>
              <dd className="text-[var(--color-text-primary)]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mb-4 text-[11px] text-[var(--color-text-muted)]">
          Lo de arriba lo carga administración. Si algo no está bien, avisales.
        </p>
        <DatosPersonalesForm
          inicial={datos}
          ocultar={tercerizado ? ["cobro"] : []}
          guardando={guardar.isPending}
          onGuardar={(c) => guardar.mutate(c)}
        />
      </Seccion>

      <SubirDocumentoSheet
        open={subiendo}
        onClose={() => setSubiendo(false)}
        tipos={data.tiposAutocarga}
        enviando={subir.isPending}
        onSubmit={(file, d) => subir.mutate({ file, datos: d })}
      />
    </div>
  );
}
