import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

import { convertLeadWithBody, getConversionDefaults, getLead } from "../../api/leads.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

export function LeadToProjectModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
  });

  // Potencia y cotización a pre-cargar: salen de la última propuesta publicada
  // (con fallback al estimado del lead, resuelto en el backend).
  const {
    data: defaults,
    isSuccess: defaultsReady,
    isError: defaultsFailed,
  } = useQuery({
    queryKey: ["lead-conversion-defaults", leadId],
    queryFn: () => getConversionDefaults(leadId),
  });

  // Form state, se hidrata 1 vez cuando llega `lead`.
  const [hydrated, setHydrated] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [capacityKwp, setCapacityKwp] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationProvince, setLocationProvince] = useState("Montevideo");
  const [budgetUsd, setBudgetUsd] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Hidratar 1 vez, esperando también a los defaults (o a que fallen, para no
  // trabar el modal si el endpoint no responde).
  if (lead && (defaultsReady || defaultsFailed) && !hydrated) {
    setClientName(lead.clientName ?? "");
    setClientAddress(lead.address ?? "");
    setClientEmail(lead.clientEmail ?? "");
    setClientPhone(lead.clientPhone ?? "");
    const kwp = defaults?.capacityKwp ?? lead.estimatedKwp ?? null;
    const budget = defaults?.budgetUsd ?? lead.estimatedBudgetUsd ?? null;
    setCapacityKwp(kwp != null ? String(kwp) : "");
    setBudgetUsd(budget != null ? String(budget) : "");
    setHydrated(true);
  }

  const fromProposal = defaults?.source === "proposal";

  const convertMut = useMutation({
    mutationFn: () =>
      convertLeadWithBody(leadId, {
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        capacityKwp: Number(capacityKwp),
        locationCity: locationCity.trim(),
        locationProvince: locationProvince.trim(),
        budgetUsd: budgetUsd ? Number(budgetUsd) : null,
        plannedEndDate: plannedEndDate || null,
      }),
    onSuccess: (project) => {
      const codeStr = (project as { code?: string }).code;
      toast.success(codeStr ? `Proyecto ${codeStr} creado` : "Proyecto creado");
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-groups"] });
      onClose();
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo crear el proyecto");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return toast.error("Falta el nombre del cliente");
    if (!locationCity.trim()) return toast.error("Falta la ciudad");
    if (!locationProvince.trim()) return toast.error("Falta la provincia");
    const n = Number(capacityKwp);
    if (!n || n <= 0) return toast.error("Falta la potencia (kWp)");
    setSaving(true);
    convertMut.mutate(undefined, { onSettled: () => setSaving(false) });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[97] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            Crear proyecto desde lead
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Cargando lead…</p>
        ) : (
          <>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              El lead está en Cerrado como Ganado. Los datos cargados en el lead aparecen
              precargados acá — completá lo que falte (ciudad, provincia, potencia) y dale crear.
              Los adjuntos, la propuesta comercial y los comentarios del lead se copian
              automáticamente al proyecto.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className={lbl}>Cliente *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  autoFocus
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Dirección</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Calle, número, barrio"
                  className={inp}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Ciudad *</label>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="Ej: Montevideo"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Provincia *</label>
                  <input
                    type="text"
                    value={locationProvince}
                    onChange={(e) => setLocationProvince(e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Email cliente</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Teléfono</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Potencia (kWp) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={capacityKwp}
                    onChange={(e) => setCapacityKwp(e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Presupuesto (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetUsd}
                    onChange={(e) => setBudgetUsd(e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              {fromProposal && (
                <p className="text-[10px] text-[var(--color-text-muted)] -mt-1">
                  Potencia y presupuesto tomados de la propuesta comercial. Podés editarlos.
                </p>
              )}
              <div>
                <label className={lbl}>Fecha estimada fin obra</label>
                <input
                  type="date"
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                  className={inp}
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Si lo dejás vacío, se calcula 90 días desde hoy como placeholder.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
                >
                  {saving ? "Creando proyecto…" : "Crear proyecto"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
