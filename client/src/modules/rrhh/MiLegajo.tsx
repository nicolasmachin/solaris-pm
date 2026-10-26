import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  VINCULO_LABEL,
  cancelarMiLicencia,
  deleteMiDocumento,
  getMiLegajo,
  getMisEntregas,
  getMisLicencias,
  solicitarLicencia,
  type DatosLicencia,
  type Entrega,
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
import { EntregaFirmadaFila, EntregaPendiente, FirmarEntregaSheet } from "./entregasUi";
import { LicenciaFila, LicenciaSheet, SaldoTarjetas, botonChico } from "./licenciasUi";

// Mi legajo: lo que cada persona ve y carga de sí misma. Los recibos y el
// contrato los sube administración; lo demás (carné, licencia, cursos…) lo
// carga la persona y queda pendiente hasta que lo validan.
export function MiLegajo() {
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [firmando, setFirmando] = useState<Entrega | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["mi-legajo"], queryFn: getMiLegajo });
  const { data: licencias } = useQuery({ queryKey: ["mi-legajo", "licencias"], queryFn: getMisLicencias });
  const { data: entregas = [] } = useQuery({ queryKey: ["mi-legajo", "entregas"], queryFn: getMisEntregas });
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

  const pedir = useMutation({
    mutationFn: (d: DatosLicencia) => solicitarLicencia(d),
    onSuccess: () => {
      toast.success("Pedido enviado. Te avisamos cuando lo respondan.");
      setPidiendo(false);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo pedir la licencia")),
  });

  const retirar = useMutation({
    mutationFn: (id: string) => cancelarMiLicencia(id),
    onSuccess: () => {
      toast.success("Pedido retirado");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo retirar")),
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
  const entregasPendientes = entregas.filter((e) => e.estado === "PENDIENTE_FIRMA");
  const entregasFirmadas = entregas.filter((e) => e.estado === "FIRMADA");

  const seccionEntregas =
    entregas.length > 0 ? (
      <Seccion titulo="Entregas de materiales">
        <div className="space-y-3">
          {entregasPendientes.map((e) => (
            <EntregaPendiente key={e.id} entrega={e} onFirmar={() => setFirmando(e)} />
          ))}
          {entregasFirmadas.length > 0 && (
            <div>
              {entregasFirmadas.map((e) => (
                <EntregaFirmadaFila key={e.id} entrega={e} />
              ))}
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Cada constancia firmada está en Mis documentos.
              </p>
            </div>
          )}
        </div>
      </Seccion>
    ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Mi legajo</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Tus datos y tus documentos de trabajo. Lo que cargás acá lo ve solo administración.
        </p>
      </div>

      <AlertasResumen resumen={data.resumen} propio />

      {/* Si hay algo para firmar, va arriba de todo. */}
      {entregasPendientes.length > 0 && seccionEntregas}

      {!tercerizado && (
        <Seccion titulo="Mis recibos">
          {recibos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay recibos cargados.</p>
          ) : (
            recibos.map((d) => <DocumentoFila key={d.id} doc={d} mostrarNuevo />)
          )}
        </Seccion>
      )}

      {licencias?.aplica && (
        <Seccion
          titulo="Mis licencias"
          accion={
            <Button size="sm" onClick={() => setPidiendo(true)}>
              <span className="inline-flex items-center gap-1">
                <Plus size={14} /> Pedir licencia
              </span>
            </Button>
          }
        >
          <SaldoTarjetas saldo={licencias.saldo} />
          {licencias.saldo.generados === 0 && (
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Administración todavía no cargó los días que te corresponden.
            </p>
          )}
          <div className="mt-3">
            {licencias.licencias.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay licencias registradas.</p>
            ) : (
              licencias.licencias.map((l) => (
                <LicenciaFila
                  key={l.id}
                  l={l}
                  acciones={
                    l.estado === "SOLICITADA" ? (
                      <button
                        className={botonChico}
                        disabled={retirar.isPending}
                        onClick={() => {
                          if (confirm("¿Retirar este pedido de licencia?")) retirar.mutate(l.id);
                        }}
                      >
                        Retirar pedido
                      </button>
                    ) : undefined
                  }
                />
              ))
            )}
          </div>
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

      {entregasPendientes.length === 0 && seccionEntregas}

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

      {licencias && (
        <LicenciaSheet
          open={pidiendo}
          modo="pedir"
          tipos={licencias.tipos}
          enviando={pedir.isPending}
          onClose={() => setPidiendo(false)}
          onSubmit={(d) => pedir.mutate(d)}
        />
      )}
      <FirmarEntregaSheet entrega={firmando} onClose={() => setFirmando(null)} onFirmada={invalidar} />

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
