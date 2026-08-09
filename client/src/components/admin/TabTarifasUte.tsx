import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Lock, Plus, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";

import { usePermission } from "../../hooks/usePermission";
import { Spinner } from "../ui/Spinner";
import {
  actualizarTarifa,
  crearTarifa,
  FRANJA_LABEL,
  FRANJAS_POR_TARIFA,
  getTarifa,
  listarTarifas,
  publicarTarifa,
  TARIFA_LABEL,
  TARIFAS,
  type FranjaHoraria,
  type TarifaCargo,
  type TarifaFranja,
  type TarifaTramo,
  type TarifaUte,
} from "../../api/reportesFv.api";

// Cuadros tarifarios de UTE, versionados por vigencia.
//
// Un cuadro se prepara como borrador y al publicarlo queda inmutable: los
// reportes ya calculados guardan con qué versión se hicieron, así que si los
// precios se pisaran dejarían de reproducirse. Para cambiar precios se duplica
// el vigente y se publica con la fecha en que UTE los aplicó.

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-60";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";
const num = `${inp} text-right tabular-nums`;

const SIN_TOPE = 9999999;

interface Draft {
  nombre: string;
  vigenteDesde: string;
  ivaPct: number;
  irpfPct: number;
  notas: string;
  cargos: TarifaCargo[];
  tramos: TarifaTramo[];
  franjas: TarifaFranja[];
}

function draftVacio(): Draft {
  return {
    nombre: "",
    vigenteDesde: new Date().toISOString().slice(0, 10),
    ivaPct: 22,
    irpfPct: 12,
    notas: "",
    cargos: TARIFAS.map((tarifa) => ({ tarifa, cargoFijo: 0, cargoPotenciaKw: 0 })),
    tramos: [
      { tarifa: "SIMPLE", orden: 0, desdeKwh: 0, hastaKwh: 100, precioKwh: 0 },
      { tarifa: "SIMPLE", orden: 1, desdeKwh: 101, hastaKwh: 600, precioKwh: 0 },
      { tarifa: "SIMPLE", orden: 2, desdeKwh: 601, hastaKwh: SIN_TOPE, precioKwh: 0 },
    ],
    franjas: TARIFAS.flatMap((tarifa) =>
      FRANJAS_POR_TARIFA[tarifa].map((franja) => ({ tarifa, franja, precioKwh: 0 })),
    ),
  };
}

export function TabTarifasUte() {
  const canCreate = usePermission("CONFIGURACION", "CREATE");
  const canEdit = usePermission("CONFIGURACION", "EDIT");
  const qc = useQueryClient();

  const { data: versiones = [], isLoading } = useQuery({
    queryKey: ["reportes-fv", "tarifas"],
    queryFn: listarTarifas,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [clonarDeId, setClonarDeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(draftVacio);

  const { data: seleccionada, isLoading: cargandoDetalle } = useQuery({
    queryKey: ["reportes-fv", "tarifas", selectedId],
    queryFn: () => getTarifa(selectedId as string),
    enabled: !creando && Boolean(selectedId),
  });

  // Al elegir una versión existente, el form se hidrata con su contenido.
  useEffect(() => {
    if (creando || !seleccionada) return;
    setDraft({
      nombre: seleccionada.nombre,
      vigenteDesde: seleccionada.vigenteDesde,
      ivaPct: Math.round(seleccionada.ivaPct * 10000) / 100,
      irpfPct: Math.round(seleccionada.irpfPct * 10000) / 100,
      notas: seleccionada.notas ?? "",
      cargos: seleccionada.cargos,
      tramos: [...seleccionada.tramos].sort((a, b) => a.orden - b.orden),
      franjas: seleccionada.franjas,
    });
  }, [seleccionada, creando]);

  useEffect(() => {
    if (!selectedId && !creando && versiones.length > 0) setSelectedId(versiones[0].id);
  }, [versiones, selectedId, creando]);

  const publicada = !creando && (seleccionada?.publicada ?? false);
  const soloLectura = publicada || (!creando && !canEdit);

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre: draft.nombre,
        vigenteDesde: draft.vigenteDesde,
        ivaPct: draft.ivaPct / 100,
        irpfPct: draft.irpfPct / 100,
        notas: draft.notas || null,
        cargos: draft.cargos,
        tramos: draft.tramos.map((t, i) => ({ ...t, orden: i })),
        franjas: draft.franjas,
      };
      if (creando) {
        return crearTarifa({ ...payload, ...(clonarDeId ? { clonarDeId } : {}) });
      }
      await actualizarTarifa(selectedId as string, payload);
      return selectedId as string;
    },
    onSuccess: (id) => {
      toast.success(creando ? "Cuadro tarifario creado" : "Cambios guardados");
      setCreando(false);
      setClonarDeId(null);
      setSelectedId(id);
      qc.invalidateQueries({ queryKey: ["reportes-fv", "tarifas"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo guardar"),
  });

  const publicar = useMutation({
    mutationFn: () => publicarTarifa(selectedId as string),
    onSuccess: () => {
      toast.success("Cuadro publicado");
      qc.invalidateQueries({ queryKey: ["reportes-fv", "tarifas"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo publicar"),
  });

  function empezarNuevo(desdeId: string | null) {
    const base = desdeId ? versiones.find((v) => v.id === desdeId) : null;
    setCreando(true);
    setClonarDeId(desdeId);
    setSelectedId(null);
    setDraft(
      desdeId && seleccionada
        ? {
            nombre: base ? `${base.nombre} (copia)` : "Cuadro nuevo",
            vigenteDesde: new Date().toISOString().slice(0, 10),
            ivaPct: Math.round(seleccionada.ivaPct * 10000) / 100,
            irpfPct: Math.round(seleccionada.irpfPct * 10000) / 100,
            notas: "",
            cargos: seleccionada.cargos,
            tramos: [...seleccionada.tramos].sort((a, b) => a.orden - b.orden),
            franjas: seleccionada.franjas,
          }
        : draftVacio(),
    );
  }

  const setCargo = (tarifa: TarifaUte, campo: "cargoFijo" | "cargoPotenciaKw", valor: number) =>
    setDraft((d) => ({
      ...d,
      cargos: d.cargos.map((c) => (c.tarifa === tarifa ? { ...c, [campo]: valor } : c)),
    }));

  const setFranja = (tarifa: TarifaUte, franja: FranjaHoraria, precioKwh: number) =>
    setDraft((d) => ({
      ...d,
      franjas: d.franjas.map((f) => (f.tarifa === tarifa && f.franja === franja ? { ...f, precioKwh } : f)),
    }));

  const setTramo = (i: number, campo: keyof TarifaTramo, valor: number) =>
    setDraft((d) => ({
      ...d,
      tramos: d.tramos.map((t, idx) => (idx === i ? { ...t, [campo]: valor } : t)),
    }));

  const tramosSimple = useMemo(() => draft.tramos.filter((t) => t.tarifa === "SIMPLE"), [draft.tramos]);

  if (isLoading) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Listado de versiones */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">Cuadros</h3>
          {canCreate && (
            <button
              type="button"
              onClick={() => empezarNuevo(null)}
              className="flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-gray-900"
            >
              <Plus size={12} /> Nuevo
            </button>
          )}
        </div>

        <ul className="space-y-1">
          {creando && (
            <li className="rounded-lg border border-dashed border-[var(--color-accent)] px-3 py-2 text-sm text-[var(--color-accent)]">
              {clonarDeId ? "Copia sin guardar" : "Cuadro nuevo"}
            </li>
          )}
          {versiones.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => {
                  setCreando(false);
                  setClonarDeId(null);
                  setSelectedId(v.id);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  v.id === selectedId && !creando
                    ? "bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]/40"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {v.publicada ? (
                    <Lock size={11} className="shrink-0 opacity-60" />
                  ) : (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1 text-[9px] font-mono uppercase text-amber-600">
                      borrador
                    </span>
                  )}
                  <span className="truncate">{v.nombre}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                  desde {v.vigenteDesde}
                  {v.vigenteHasta ? ` · hasta ${v.vigenteHasta}` : v.publicada ? " · vigente" : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {versiones.length === 0 && !creando && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Todavía no hay cuadros tarifarios cargados. Sin al menos uno publicado no se pueden calcular
            reportes.
          </p>
        )}
      </div>

      {/* Editor */}
      {!creando && cargandoDetalle ? (
        <Spinner />
      ) : !creando && !seleccionada ? (
        <p className="text-sm text-[var(--color-text-muted)]">Elegí un cuadro para verlo.</p>
      ) : (
        <div className="space-y-6">
          {publicada && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              <Lock size={13} className="mt-0.5 shrink-0 opacity-60" />
              <span>
                Este cuadro está publicado y no se puede editar
                {seleccionada && seleccionada.calculosUsando > 0
                  ? `: ${seleccionada.calculosUsando} ${seleccionada.calculosUsando === 1 ? "reporte calculado depende" : "reportes calculados dependen"} de él`
                  : ""}
                . Para cambiar precios, duplicalo y publicá una versión con la fecha en que UTE los aplicó.
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Nombre</label>
              <input
                className={inp}
                value={draft.nombre}
                disabled={soloLectura}
                placeholder="UTE 2026-01"
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className={lbl}>Vigente desde</label>
              <input
                type="date"
                className={inp}
                value={draft.vigenteDesde}
                disabled={soloLectura}
                onChange={(e) => setDraft((d) => ({ ...d, vigenteDesde: e.target.value }))}
              />
            </div>
            <div>
              <label className={lbl}>IVA (%)</label>
              <input
                type="number"
                step="0.01"
                className={num}
                value={draft.ivaPct}
                disabled={soloLectura}
                onChange={(e) => setDraft((d) => ({ ...d, ivaPct: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className={lbl}>IRPF sobre la venta (%)</label>
              <input
                type="number"
                step="0.01"
                className={num}
                value={draft.irpfPct}
                disabled={soloLectura}
                onChange={(e) => setDraft((d) => ({ ...d, irpfPct: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Cargos fijos y de potencia */}
          <section>
            <h4 className="mb-2 font-display text-sm font-semibold text-[var(--color-text-primary)]">
              Cargos mensuales
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-1.5">Tarifa</th>
                    <th className="py-1.5 text-right">Cargo fijo ($)</th>
                    <th className="py-1.5 text-right">Por kW contratado ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {TARIFAS.map((tarifa) => {
                    const c = draft.cargos.find((x) => x.tarifa === tarifa);
                    return (
                      <tr key={tarifa} className="border-b border-[var(--color-border)]/50">
                        <td className="py-1.5 text-[var(--color-text-secondary)]">{TARIFA_LABEL[tarifa]}</td>
                        <td className="py-1 pl-2">
                          <input
                            type="number"
                            step="0.0001"
                            className={num}
                            value={c?.cargoFijo ?? 0}
                            disabled={soloLectura}
                            onChange={(e) => setCargo(tarifa, "cargoFijo", Number(e.target.value))}
                          />
                        </td>
                        <td className="py-1 pl-2">
                          <input
                            type="number"
                            step="0.0001"
                            className={num}
                            value={c?.cargoPotenciaKw ?? 0}
                            disabled={soloLectura}
                            onChange={(e) => setCargo(tarifa, "cargoPotenciaKw", Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tramos escalonados de la tarifa simple */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
                Tarifa simple — tramos de consumo
              </h4>
              {!soloLectura && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      tramos: [
                        ...d.tramos,
                        {
                          tarifa: "SIMPLE",
                          orden: d.tramos.length,
                          desdeKwh: (d.tramos[d.tramos.length - 1]?.hastaKwh ?? 0) + 1,
                          hastaKwh: SIN_TOPE,
                          precioKwh: 0,
                        },
                      ],
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-[var(--color-accent)]"
                >
                  <Plus size={12} /> Agregar tramo
                </button>
              )}
            </div>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              Los tramos tienen que ser continuos: cada uno arranca donde termina el anterior. Usá{" "}
              {SIN_TOPE.toLocaleString("es-UY")} en el último para indicar que no tiene tope.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-1.5">Desde (kWh)</th>
                    <th className="py-1.5">Hasta (kWh)</th>
                    <th className="py-1.5 text-right">Precio por kWh ($)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {tramosSimple.map((t, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/50">
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          className={num}
                          value={t.desdeKwh}
                          disabled={soloLectura}
                          onChange={(e) => setTramo(i, "desdeKwh", Number(e.target.value))}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          className={num}
                          value={t.hastaKwh}
                          disabled={soloLectura}
                          onChange={(e) => setTramo(i, "hastaKwh", Number(e.target.value))}
                        />
                      </td>
                      <td className="py-1 pl-2">
                        <input
                          type="number"
                          step="0.0001"
                          className={num}
                          value={t.precioKwh}
                          disabled={soloLectura}
                          onChange={(e) => setTramo(i, "precioKwh", Number(e.target.value))}
                        />
                      </td>
                      <td className="py-1 text-right">
                        {!soloLectura && tramosSimple.length > 1 && (
                          <button
                            type="button"
                            aria-label="Quitar tramo"
                            onClick={() =>
                              setDraft((d) => ({ ...d, tramos: d.tramos.filter((_, idx) => idx !== i) }))
                            }
                            className="text-[var(--color-text-muted)] hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Precios por franja horaria */}
          <section>
            <h4 className="mb-2 font-display text-sm font-semibold text-[var(--color-text-primary)]">
              Precios por franja horaria
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["DOBLE", "TRIPLE", "ZAFRAL"] as TarifaUte[]).map((tarifa) => (
                <div key={tarifa}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {TARIFA_LABEL[tarifa]}
                  </div>
                  <div className="space-y-1.5">
                    {FRANJAS_POR_TARIFA[tarifa].map((franja) => {
                      const f = draft.franjas.find((x) => x.tarifa === tarifa && x.franja === franja);
                      return (
                        <div key={franja} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-[var(--color-text-secondary)]">
                            {FRANJA_LABEL[franja]}
                          </span>
                          <input
                            type="number"
                            step="0.0001"
                            className={num}
                            value={f?.precioKwh ?? 0}
                            disabled={soloLectura}
                            onChange={(e) => setFranja(tarifa, franja, Number(e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div>
            <label className={lbl}>Notas</label>
            <textarea
              className={inp}
              rows={2}
              value={draft.notas}
              disabled={soloLectura}
              placeholder="Resolución, fecha de publicación en el Diario Oficial, etc."
              onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
            />
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
            {!soloLectura && (
              <button
                type="button"
                disabled={guardar.isPending || !draft.nombre}
                onClick={() => guardar.mutate()}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
              >
                {guardar.isPending ? "Guardando…" : creando ? "Crear borrador" : "Guardar cambios"}
              </button>
            )}

            {!creando && !publicada && canEdit && (
              <button
                type="button"
                disabled={publicar.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Publicar deja el cuadro inmutable y pasa a regir desde la fecha de vigencia. " +
                        "Los reportes que se calculen de ahí en adelante van a usar estos precios. ¿Continuar?",
                    )
                  ) {
                    return;
                  }
                  publicar.mutate();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)]"
              >
                <Upload size={14} /> Publicar
              </button>
            )}

            {!creando && selectedId && canCreate && (
              <button
                type="button"
                onClick={() => empezarNuevo(selectedId)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                <Copy size={14} /> Duplicar
              </button>
            )}

            {creando && (
              <button
                type="button"
                onClick={() => {
                  setCreando(false);
                  setClonarDeId(null);
                }}
                className="px-3 py-2 text-sm text-[var(--color-text-muted)]"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
