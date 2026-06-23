import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Sheet } from "../ui/Sheet";

import { createManualPending } from "../../api/pending.api";
import { ProjectPicker } from "./ProjectPicker";
import type { CategoriaPrincipal, Moneda } from "../../types/finance.types";
import { todayLocalISO } from "../../utils/date";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

type Tipo = "GASTO" | "INGRESO";

export function ManualPendingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<Tipo>("GASTO");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [categoria, setCategoria] = useState<CategoriaPrincipal>("VARIABLE");
  const [fechaEsperada, setFechaEsperada] = useState<string>(todayLocalISO());
  const [projectId, setProjectId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const createMut = useMutation({
    mutationFn: () =>
      createManualPending({
        tipoMovimiento: tipo,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        moneda,
        categoriaPrincipal: tipo === "INGRESO" ? "PROYECTO_ENTRADA" : categoria,
        fechaEsperada,
        projectId: projectId || null,
      }),
    onSuccess: () => {
      toast.success(tipo === "INGRESO" ? "Cobro previsto creado" : "Gasto previsto creado");
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo crear el pendiente");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) return toast.error("Falta la descripción");
    const n = Number(monto);
    if (!n || n <= 0) return toast.error("Monto inválido");
    if (tipo === "INGRESO" && !projectId) {
      return toast.error("Los cobros previstos requieren un proyecto");
    }
    setSaving(true);
    createMut.mutate(undefined, { onSettled: () => setSaving(false) });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Agregar pendiente manual"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="manual-pending-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {saving ? "Creando…" : "Crear pendiente"}
          </button>
        </>
      }
    >
        <form id="manual-pending-form" onSubmit={submit} className="space-y-3">
          <div>
            <label className={lbl}>Tipo *</label>
            <div className="flex gap-2">
              {(["GASTO", "INGRESO"] as Tipo[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border ${
                    tipo === t
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {t === "GASTO" ? "Gasto previsto" : "Cobro previsto"}
                </button>
              ))}
            </div>
          </div>

          {tipo === "GASTO" && (
            <div>
              <label className={lbl}>Categoría *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaPrincipal)}
                className={inp}
              >
                <option value="FIJO">Costo fijo</option>
                <option value="VARIABLE">Costo variable</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          )}

          <div>
            <label className={lbl}>Descripción *</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={
                tipo === "INGRESO" ? "Ej: Anticipo Cliente X 50%" : "Ej: Comisión Julio mayo"
              }
              autoFocus
              className={inp}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Monto *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Moneda</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
                className={inp}
              >
                <option value="USD">USD</option>
                <option value="UYU">UYU</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Fecha esperada *</label>
            <input
              type="date"
              value={fechaEsperada}
              onChange={(e) => setFechaEsperada(e.target.value)}
              className={inp}
            />
          </div>

          <div>
            <label className={lbl}>
              {tipo === "INGRESO" ? "Proyecto *" : "Proyecto (opcional)"}
            </label>
            <ProjectPicker value={projectId} onChange={setProjectId} />
          </div>

        </form>
    </Sheet>
  );
}
