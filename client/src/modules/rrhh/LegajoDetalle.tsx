import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  VINCULO_LABEL,
  deleteDocumentoLegajo,
  getLegajo,
  listTipos,
  revisarDocumentoLegajo,
  updateDocumentoLegajo,
  updateLegajo,
  uploadDocumentoLegajo,
  type DatosEmpresa,
  type DatosSubida,
  type DocumentoLegajo,
  type LegajoCompleto,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertasResumen,
  BotonBorrar,
  Campo,
  DatosPersonalesForm,
  DocumentoFila,
  Seccion,
  SubirDocumentoSheet,
  datosPersonalesDe,
  errorMsg,
  inputClass,
} from "./rrhhUi";
import { BloqueEntregas, BloqueLicencias } from "./LegajoLicenciasEntregas";

// Legajo completo de una persona, visto por gerencia y administración
// (RRHH:EDIT): datos de la empresa (sueldo, contrato), datos personales y todos
// los documentos, incluidos los que la persona no ve.
export function LegajoDetalle() {
  const { userId = "" } = useParams();
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState<DocumentoLegajo | null>(null);
  const [rechazando, setRechazando] = useState<DocumentoLegajo | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["rrhh", "legajo", userId], queryFn: () => getLegajo(userId) });
  const { data: tipos = [] } = useQuery({ queryKey: ["rrhh", "tipos"], queryFn: listTipos });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["rrhh"] });

  const guardar = useMutation({
    mutationFn: (body: Partial<LegajoCompleto>) => updateLegajo(userId, body),
    onSuccess: () => {
      toast.success("Legajo guardado");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar")),
  });

  const subir = useMutation({
    mutationFn: ({ file, datos }: { file: File; datos: DatosSubida }) => uploadDocumentoLegajo(userId, file, datos),
    onSuccess: () => {
      toast.success("Documento subido");
      setSubiendo(false);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo subir")),
  });

  const revisar = useMutation({
    mutationFn: ({ id, aprobar, motivo }: { id: string; aprobar: boolean; motivo?: string }) =>
      revisarDocumentoLegajo(id, { aprobar, motivo }),
    onSuccess: (_d, v) => {
      toast.success(v.aprobar ? "Documento validado" : "Documento rechazado: se le avisó a la persona");
      setRechazando(null);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar la revisión")),
  });

  const borrar = useMutation({
    mutationFn: deleteDocumentoLegajo,
    onSuccess: () => {
      toast.success("Documento quitado");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo quitar")),
  });

  const datosPersonales = useMemo(() => (data ? datosPersonalesDe(data.legajo) : null), [data]);

  if (isLoading || !data || !datosPersonales) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const { usuario, legajo } = data;
  const pendientes = data.documentos.filter((d) => d.estado === "PENDIENTE");
  const resto = data.documentos.filter((d) => d.estado !== "PENDIENTE");

  const acciones = (d: DocumentoLegajo) => (
    <>
      {d.estado === "PENDIENTE" && (
        <>
          <button
            onClick={() => revisar.mutate({ id: d.id, aprobar: true })}
            disabled={revisar.isPending}
            className="inline-flex items-center gap-1 rounded border border-green-500/40 px-2 py-1 text-xs text-green-400 hover:bg-green-500/15"
          >
            <Check size={12} /> Validar
          </button>
          <button
            onClick={() => setRechazando(d)}
            className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/15"
          >
            <X size={12} /> Rechazar
          </button>
        </>
      )}
      <button
        onClick={() => setEditando(d)}
        title="Editar"
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
      >
        <Pencil size={12} />
      </button>
      <BotonBorrar
        disabled={borrar.isPending}
        onClick={() => {
          if (confirm(`¿Quitar "${d.titulo}" del legajo? El archivo se borra.`)) borrar.mutate(d.id);
        }}
      />
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <Link to="/rrhh" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
        <ArrowLeft size={14} /> Recursos Humanos
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{usuario.nombre}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {usuario.rol} · {VINCULO_LABEL[legajo.vinculo]}
          {usuario.email && ` · ${usuario.email}`}
          {usuario.telefono && ` · ${usuario.telefono}`}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
          <ShieldCheck size={11} /> Lo que abrís de este legajo queda registrado.
        </p>
      </div>

      <AlertasResumen resumen={data.resumen} propio={false} />

      <Seccion
        titulo="Documentos"
        accion={
          <Button size="sm" onClick={() => setSubiendo(true)}>
            <span className="inline-flex items-center gap-1">
              <Plus size={14} /> Subir documento
            </span>
          </Button>
        }
      >
        {pendientes.length > 0 && (
          <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3">
            <p className="pt-2 text-xs font-medium text-blue-400">Cargado por la persona, para revisar</p>
            {pendientes.map((d) => (
              <DocumentoFila key={d.id} doc={d} acciones={acciones(d)} />
            ))}
          </div>
        )}
        {resto.length === 0 && pendientes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay documentos.</p>
        ) : (
          resto.map((d) => <DocumentoFila key={d.id} doc={d} acciones={acciones(d)} />)
        )}
      </Seccion>

      {legajo.vinculo === "DEPENDIENTE" && <BloqueLicencias userId={userId} />}

      <BloqueEntregas userId={userId} nombre={usuario.nombre} />

      <Seccion titulo="Datos de la empresa">
        <DatosEmpresaForm legajo={legajo} guardando={guardar.isPending} onGuardar={(c) => guardar.mutate(c)} />
      </Seccion>

      <Seccion titulo="Datos personales">
        <DatosPersonalesForm
          inicial={datosPersonales}
          ocultar={legajo.vinculo === "TERCERIZADO" ? ["cobro"] : []}
          guardando={guardar.isPending}
          onGuardar={(c) => guardar.mutate(c)}
        />
      </Seccion>

      <SubirDocumentoSheet
        open={subiendo}
        onClose={() => setSubiendo(false)}
        tipos={tipos}
        gestion
        enviando={subir.isPending}
        onSubmit={(file, d) => subir.mutate({ file, datos: d })}
      />
      <EditarDocumentoSheet doc={editando} onClose={() => setEditando(null)} onGuardado={invalidar} />
      <RechazarSheet
        doc={rechazando}
        enviando={revisar.isPending}
        onClose={() => setRechazando(null)}
        onRechazar={(motivo) => rechazando && revisar.mutate({ id: rechazando.id, aprobar: false, motivo })}
      />
    </div>
  );
}

// ─── Datos de la empresa ────────────────────────────────────────────────────

type EmpresaForm = {
  vinculo: DatosEmpresa["vinculo"];
  fechaIngreso: string;
  fechaEgreso: string;
  cargo: string;
  tipoContrato: string;
  categoria: string;
  sueldoNominal: string;
  sueldoMoneda: DatosEmpresa["sueldoMoneda"];
  notasInternas: string;
};

function empresaDe(l: LegajoCompleto): EmpresaForm {
  return {
    vinculo: l.vinculo,
    fechaIngreso: l.fechaIngreso ?? "",
    fechaEgreso: l.fechaEgreso ?? "",
    cargo: l.cargo ?? "",
    tipoContrato: l.tipoContrato ?? "",
    categoria: l.categoria ?? "",
    sueldoNominal: l.sueldoNominal != null ? String(l.sueldoNominal) : "",
    sueldoMoneda: l.sueldoMoneda,
    notasInternas: l.notasInternas ?? "",
  };
}

function DatosEmpresaForm({
  legajo,
  guardando,
  onGuardar,
}: {
  legajo: LegajoCompleto;
  guardando: boolean;
  onGuardar: (c: Partial<LegajoCompleto>) => void;
}) {
  const inicial = useMemo(() => empresaDe(legajo), [legajo]);
  const [v, setV] = useState(inicial);
  useEffect(() => setV(inicial), [inicial]);
  const set = <K extends keyof EmpresaForm>(k: K, val: EmpresaForm[K]) => setV((p) => ({ ...p, [k]: val }));

  const hayCambios = (Object.keys(v) as Array<keyof EmpresaForm>).some((k) => v[k] !== inicial[k]);
  const sueldoInvalido = v.sueldoNominal !== "" && !(Number(v.sueldoNominal.replace(",", ".")) >= 0);

  function guardar() {
    const cambios: Partial<LegajoCompleto> = {};
    for (const k of Object.keys(v) as Array<keyof EmpresaForm>) {
      if (v[k] === inicial[k]) continue;
      if (k === "sueldoNominal") cambios.sueldoNominal = v.sueldoNominal === "" ? null : Number(v.sueldoNominal.replace(",", "."));
      else if (k === "vinculo") cambios.vinculo = v.vinculo;
      else if (k === "sueldoMoneda") cambios.sueldoMoneda = v.sueldoMoneda;
      else (cambios as Record<string, unknown>)[k] = v[k] || null;
    }
    onGuardar(cambios);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Vínculo" ayuda="Al tercerizado se le piden BPS, BSE y curso de altura; no tiene recibos.">
          <select className={inputClass} value={v.vinculo} onChange={(e) => set("vinculo", e.target.value as EmpresaForm["vinculo"])}>
            <option value="DEPENDIENTE">{VINCULO_LABEL.DEPENDIENTE}</option>
            <option value="TERCERIZADO">{VINCULO_LABEL.TERCERIZADO}</option>
          </select>
        </Campo>
        <Campo label="Fecha de ingreso">
          <input type="date" className={inputClass} value={v.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} />
        </Campo>
        <Campo label="Fecha de egreso" ayuda="Si se va: deja de recibir avisos de vencimiento.">
          <input type="date" className={inputClass} value={v.fechaEgreso} onChange={(e) => set("fechaEgreso", e.target.value)} />
        </Campo>
        <Campo label="Cargo">
          <input className={inputClass} value={v.cargo} onChange={(e) => set("cargo", e.target.value)} />
        </Campo>
        <Campo label="Tipo de contrato">
          <input
            className={inputClass}
            placeholder="Permanente, a prueba, zafral…"
            value={v.tipoContrato}
            onChange={(e) => set("tipoContrato", e.target.value)}
          />
        </Campo>
        <Campo label="Categoría">
          <input className={inputClass} value={v.categoria} onChange={(e) => set("categoria", e.target.value)} />
        </Campo>
        <Campo label="Sueldo nominal">
          <div className="flex gap-2">
            <select
              className={`${inputClass} w-24`}
              value={v.sueldoMoneda}
              onChange={(e) => set("sueldoMoneda", e.target.value as EmpresaForm["sueldoMoneda"])}
            >
              <option value="UYU">$</option>
              <option value="USD">USD</option>
            </select>
            <input
              inputMode="decimal"
              className={inputClass}
              value={v.sueldoNominal}
              onChange={(e) => set("sueldoNominal", e.target.value)}
            />
          </div>
        </Campo>
      </div>
      <Campo label="Notas internas" ayuda="Solo las ve gerencia y administración.">
        <textarea
          rows={3}
          className={inputClass}
          value={v.notasInternas}
          onChange={(e) => set("notasInternas", e.target.value)}
        />
      </Campo>
      <div className="flex justify-end">
        <Button disabled={!hayCambios || guardando || sueldoInvalido} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar datos de la empresa"}
        </Button>
      </div>
    </div>
  );
}

// ─── Editar y rechazar ──────────────────────────────────────────────────────

function EditarDocumentoSheet({
  doc,
  onClose,
  onGuardado,
}: {
  doc: DocumentoLegajo | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [soloInterno, setSoloInterno] = useState(false);

  useEffect(() => {
    if (!doc) return;
    setTitulo(doc.titulo);
    setVencimiento(doc.vencimiento ?? "");
    setPeriodo(doc.periodo ?? "");
    setSoloInterno(doc.soloInterno);
  }, [doc]);

  const guardar = useMutation({
    mutationFn: () =>
      updateDocumentoLegajo(doc!.id, {
        titulo: titulo.trim(),
        vencimiento: vencimiento || null,
        ...(doc!.tipo === "RECIBO_SUELDO" ? { periodo: periodo || null } : {}),
        soloInterno,
      }),
    onSuccess: () => {
      toast.success("Documento actualizado");
      onGuardado();
      onClose();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar")),
  });

  return (
    <Sheet
      open={Boolean(doc)}
      onClose={onClose}
      title="Editar documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!titulo.trim() || guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Button>
        </div>
      }
    >
      {doc && (
        <div className="space-y-4">
          <Campo label="Título">
            <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
          </Campo>
          {doc.tipo === "RECIBO_SUELDO" ? (
            <Campo label="Mes que liquida">
              <input type="month" className={inputClass} value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </Campo>
          ) : (
            <Campo label="Vencimiento">
              <input type="date" className={inputClass} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </Campo>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={soloInterno} onChange={(e) => setSoloInterno(e.target.checked)} />
            Solo administración (la persona no lo ve)
          </label>
        </div>
      )}
    </Sheet>
  );
}

function RechazarSheet({
  doc,
  enviando,
  onClose,
  onRechazar,
}: {
  doc: DocumentoLegajo | null;
  enviando: boolean;
  onClose: () => void;
  onRechazar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => setMotivo(""), [doc]);
  return (
    <Sheet
      open={Boolean(doc)}
      onClose={onClose}
      title="Rechazar documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={!motivo.trim() || enviando} onClick={() => onRechazar(motivo.trim())}>
            Rechazar
          </Button>
        </div>
      }
    >
      <Campo label="¿Qué tiene mal?" ayuda="Se lo mandamos a la persona para que sepa qué volver a subir.">
        <textarea
          rows={3}
          className={inputClass}
          placeholder="La foto está borrosa, está vencido, es de otra persona…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
        />
      </Campo>
    </Sheet>
  );
}
