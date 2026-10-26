import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  anularEntrega,
  anularLicencia,
  borrarContingente,
  editarLicencia,
  getEntregasLegajo,
  getLicenciasLegajo,
  guardarContingente,
  registrarEntrega,
  registrarLicencia,
  resolverLicencia,
  type Contingente,
  type DatosLicencia,
  type Entrega,
  type ItemEntrega,
  type Licencia,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { EntregaFirmadaFila, EntregaPendiente, FirmarEntregaSheet, RegistrarEntregaSheet } from "./entregasUi";
import { LicenciaFila, LicenciaSheet, ResolverLicenciaSheet, SaldoTarjetas, botonChico } from "./licenciasUi";
import { BotonBorrar, Campo, Seccion, errorMsg, inputClass } from "./rrhhUi";

// Licencias y entregas de materiales dentro del legajo visto por RRHH.

function useInvalidarRrhh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["rrhh"] });
}

// ─── Licencias ──────────────────────────────────────────────────────────────

export function BloqueLicencias({ userId }: { userId: string }) {
  const invalidar = useInvalidarRrhh();
  const { data } = useQuery({ queryKey: ["rrhh", "licencias", userId], queryFn: () => getLicenciasLegajo(userId) });
  const [registrando, setRegistrando] = useState(false);
  const [editando, setEditando] = useState<Licencia | null>(null);
  const [resolviendo, setResolviendo] = useState<Licencia | null>(null);
  const [contingente, setContingente] = useState<{ anio: number; dias: number; nota: string | null } | null>(null);

  const ok = (msg: string, cerrar?: () => void) => () => {
    toast.success(msg);
    cerrar?.();
    invalidar();
  };

  const registrar = useMutation({
    mutationFn: (d: DatosLicencia) => registrarLicencia(userId, d),
    onSuccess: ok("Licencia registrada", () => setRegistrando(false)),
    onError: (e) => toast.error(errorMsg(e, "No se pudo registrar")),
  });
  const editar = useMutation({
    mutationFn: (d: DatosLicencia) => editarLicencia(editando!.id, d),
    onSuccess: ok("Licencia corregida", () => setEditando(null)),
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar")),
  });
  const resolver = useMutation({
    mutationFn: (d: { aprobar: boolean; motivo?: string; dias?: number }) => resolverLicencia(resolviendo!.id, d),
    onSuccess: (_r, v) => {
      toast.success(v.aprobar ? "Licencia aprobada: se le avisó" : "Pedido no aprobado: se le avisó el motivo");
      setResolviendo(null);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo responder")),
  });
  const anular = useMutation({
    mutationFn: anularLicencia,
    onSuccess: ok("Licencia anulada"),
    onError: (e) => toast.error(errorMsg(e, "No se pudo anular")),
  });
  const guardarCont = useMutation({
    mutationFn: (d: { anio: number; dias: number; nota: string | null }) => guardarContingente(userId, d),
    onSuccess: ok("Días guardados", () => setContingente(null)),
    onError: (e) => toast.error(errorMsg(e, "No se pudo guardar")),
  });
  const borrarCont = useMutation({
    mutationFn: borrarContingente,
    onSuccess: ok("Año quitado"),
    onError: (e) => toast.error(errorMsg(e, "No se pudo quitar")),
  });

  if (!data) return null;
  if (!data.aplica) return null;

  // Años cargados más los sugeridos que falten, del más nuevo al más viejo.
  const porAnio = new Map<number, Contingente | null>(data.contingentes.map((c) => [c.anio, c]));
  for (const s of data.sugeridos) if (!porAnio.has(s.anio)) porAnio.set(s.anio, null);
  const anios = [...porAnio.keys()].sort((a, b) => b - a);
  const sugerido = new Map(data.sugeridos.map((s) => [s.anio, s.dias]));

  return (
    <Seccion
      titulo="Licencias"
      accion={
        <Button size="sm" onClick={() => setRegistrando(true)}>
          <span className="inline-flex items-center gap-1">
            <Plus size={14} /> Registrar licencia
          </span>
        </Button>
      }
    >
      <SaldoTarjetas saldo={data.saldo} />

      <div className="mt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Días generados por año</p>
          <button
            className={botonChico}
            onClick={() => setContingente({ anio: new Date().getFullYear(), dias: 20, nota: null })}
          >
            <Plus size={12} /> Otro año
          </button>
        </div>
        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {anios.map((anio) => {
            const c = porAnio.get(anio);
            const sug = sugerido.get(anio);
            return (
              <div key={anio} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="w-12 font-semibold tabular-nums text-[var(--color-text-primary)]">{anio}</span>
                <span className="min-w-0 flex-1 text-[var(--color-text-secondary)]">
                  {c ? (
                    <>
                      <span className="font-semibold text-[var(--color-text-primary)]">{c.dias} días</span>
                      {c.nota && <span className="text-[11px] text-[var(--color-text-muted)]"> · {c.nota}</span>}
                    </>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">Sin cargar</span>
                  )}
                  {sug !== undefined && (!c || c.dias !== sug) && (
                    <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">sugerido: {sug}</span>
                  )}
                </span>
                <span className="flex gap-1">
                  {sug !== undefined && (!c || c.dias !== sug) && (
                    <button
                      className={botonChico}
                      disabled={guardarCont.isPending}
                      onClick={() => guardarCont.mutate({ anio, dias: sug, nota: c?.nota ?? null })}
                    >
                      Usar sugerido
                    </button>
                  )}
                  <button
                    className={botonChico}
                    title="Editar"
                    onClick={() => setContingente({ anio, dias: c?.dias ?? sug ?? 20, nota: c?.nota ?? null })}
                  >
                    <Pencil size={12} />
                  </button>
                  {c && (
                    <BotonBorrar
                      disabled={borrarCont.isPending}
                      onClick={() => {
                        if (confirm(`¿Quitar los días generados en ${anio}?`)) borrarCont.mutate(c.id);
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Los días generados en un año se toman al año siguiente. Sugerido: 20 días y, desde el 5.º año, uno más cada 4
          años (proporcional el año que entró). Confirmalo con la contadora.
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">Licencias</p>
        {data.licencias.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay licencias.</p>
        ) : (
          data.licencias.map((l) => (
            <LicenciaFila
              key={l.id}
              l={l}
              acciones={
                <>
                  {l.estado === "SOLICITADA" && (
                    <>
                      <button
                        onClick={() => setResolviendo(l)}
                        className="inline-flex items-center gap-1 rounded border border-green-500/40 px-2 py-1 text-xs text-green-400 hover:bg-green-500/15"
                      >
                        <Check size={12} /> Responder
                      </button>
                    </>
                  )}
                  {(l.estado === "SOLICITADA" || l.estado === "APROBADA") && (
                    <>
                      <button className={botonChico} title="Corregir" onClick={() => setEditando(l)}>
                        <Pencil size={12} />
                      </button>
                      <button
                        className={botonChico}
                        disabled={anular.isPending}
                        title="Anular"
                        onClick={() => {
                          if (confirm("¿Anular esta licencia? Deja de contar en el saldo.")) anular.mutate(l.id);
                        }}
                      >
                        <X size={12} /> Anular
                      </button>
                    </>
                  )}
                </>
              }
            />
          ))
        )}
      </div>

      <LicenciaSheet
        open={registrando}
        modo="registrar"
        tipos={data.tipos}
        enviando={registrar.isPending}
        onClose={() => setRegistrando(false)}
        onSubmit={(d) => registrar.mutate(d)}
      />
      <LicenciaSheet
        open={Boolean(editando)}
        modo="editar"
        tipos={data.tipos}
        inicial={editando}
        enviando={editar.isPending}
        onClose={() => setEditando(null)}
        onSubmit={(d) => editar.mutate(d)}
      />
      <ResolverLicenciaSheet
        licencia={resolviendo}
        enviando={resolver.isPending}
        onClose={() => setResolviendo(null)}
        onResolver={(d) => resolver.mutate(d)}
      />
      <ContingenteSheet
        valor={contingente}
        enviando={guardarCont.isPending}
        onClose={() => setContingente(null)}
        onGuardar={(d) => guardarCont.mutate(d)}
      />
    </Seccion>
  );
}

function ContingenteSheet({
  valor,
  enviando,
  onClose,
  onGuardar,
}: {
  valor: { anio: number; dias: number; nota: string | null } | null;
  enviando: boolean;
  onClose: () => void;
  onGuardar: (d: { anio: number; dias: number; nota: string | null }) => void;
}) {
  const [anio, setAnio] = useState("");
  const [dias, setDias] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => {
    if (!valor) return;
    setAnio(String(valor.anio));
    setDias(String(valor.dias));
    setNota(valor.nota ?? "");
  }, [valor]);
  const listo = /^\d{4}$/.test(anio) && dias !== "";
  return (
    <Sheet
      open={Boolean(valor)}
      onClose={onClose}
      title="Días de licencia generados"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!listo || enviando}
            onClick={() => onGuardar({ anio: Number(anio), dias: Number(dias), nota: nota.trim() || null })}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Año en que se generaron">
            <input inputMode="numeric" className={inputClass} value={anio} onChange={(e) => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Campo>
          <Campo label="Días">
            <input inputMode="numeric" className={inputClass} value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} />
          </Campo>
        </div>
        <Campo label="Nota (opcional)" ayuda="Por ejemplo: «saldo que venía de antes del sistema».">
          <input className={inputClass} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        </Campo>
      </div>
    </Sheet>
  );
}

// ─── Entregas ───────────────────────────────────────────────────────────────

export function BloqueEntregas({ userId, nombre }: { userId: string; nombre: string }) {
  const invalidar = useInvalidarRrhh();
  const { data = [] } = useQuery({ queryKey: ["rrhh", "entregas", userId], queryFn: () => getEntregasLegajo(userId) });
  const [registrando, setRegistrando] = useState(false);
  const [firmando, setFirmando] = useState<Entrega | null>(null);

  const registrar = useMutation({
    mutationFn: (d: { fecha: string; items: ItemEntrega[]; observaciones: string | null }) => registrarEntrega(userId, d),
    onSuccess: () => {
      toast.success("Entrega registrada. Falta la firma.");
      setRegistrando(false);
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo registrar")),
  });
  const anular = useMutation({
    mutationFn: anularEntrega,
    onSuccess: () => {
      toast.success("Entrega anulada");
      invalidar();
    },
    onError: (e) => toast.error(errorMsg(e, "No se pudo anular")),
  });

  const pendientes = data.filter((e) => e.estado === "PENDIENTE_FIRMA");
  const firmadas = data.filter((e) => e.estado === "FIRMADA");
  const botonAnular = (e: Entrega) => (
    <button
      className={botonChico}
      disabled={anular.isPending}
      onClick={() => {
        const aviso =
          e.estado === "FIRMADA"
            ? "¿Anular esta entrega? La constancia firmada queda en el legajo."
            : "¿Anular esta entrega?";
        if (confirm(aviso)) anular.mutate(e.id);
      }}
    >
      <X size={12} /> Anular
    </button>
  );

  return (
    <Seccion
      titulo="Entregas de materiales"
      accion={
        <Button size="sm" onClick={() => setRegistrando(true)}>
          <span className="inline-flex items-center gap-1">
            <Plus size={14} /> Registrar entrega
          </span>
        </Button>
      }
    >
      {data.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Ropa de trabajo, equipos de protección, herramientas: se registra lo que se entrega y la persona firma que lo
          recibió.
        </p>
      ) : (
        <div className="space-y-3">
          {pendientes.map((e) => (
            <EntregaPendiente
              key={e.id}
              entrega={e}
              textoFirmar="Firmar en persona"
              onFirmar={() => setFirmando(e)}
              acciones={botonAnular(e)}
            />
          ))}
          {firmadas.length > 0 && (
            <div>
              {firmadas.map((e) => (
                <EntregaFirmadaFila key={e.id} entrega={e} acciones={botonAnular(e)} />
              ))}
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Las constancias firmadas están en Documentos.</p>
            </div>
          )}
        </div>
      )}

      <RegistrarEntregaSheet
        open={registrando}
        enviando={registrar.isPending}
        onClose={() => setRegistrando(false)}
        onSubmit={(d) => registrar.mutate(d)}
      />
      <FirmarEntregaSheet
        entrega={firmando}
        nombre={nombre}
        presencial
        onClose={() => setFirmando(null)}
        onFirmada={invalidar}
      />
    </Seccion>
  );
}
