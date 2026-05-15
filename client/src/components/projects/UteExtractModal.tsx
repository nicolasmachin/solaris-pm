import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

import type { UteExtractTipo, UteExtractedData } from "../../api/uteExtract.api";

type FieldKey = keyof UteExtractedData;

const FIELD_LABEL: Record<FieldKey, string> = {
  nombre_cliente: "Nombre",
  ci_cliente: "CI",
  dir_cliente: "Dirección",
  calle: "Calle",
  num_calle: "Número",
  ciudad: "Ciudad",
  depto: "Departamento",
  mail_cliente: "Email",
  telefono_cliente: "Teléfono",
  cuenta_ute: "Cuenta UTE",
  caso_ute: "Caso UTE",
  oficina_ute: "Oficina UTE",
  tarifa_ute: "Tarifa",
  pot_contratada: "Pot contratada (kW)",
  persona_fisica: "Persona física",
};

// Qué campos se muestran según el tipo de doc. La cédula no trae datos UTE.
const FIELDS_BY_TIPO: Record<UteExtractTipo, FieldKey[]> = {
  cedula: ["nombre_cliente", "ci_cliente", "dir_cliente", "calle", "num_calle", "ciudad", "depto", "persona_fisica"],
  factura_ute: [
    "nombre_cliente",
    "ci_cliente",
    "dir_cliente",
    "calle",
    "num_calle",
    "ciudad",
    "depto",
    "mail_cliente",
    "telefono_cliente",
    "cuenta_ute",
    "caso_ute",
    "oficina_ute",
    "tarifa_ute",
    "pot_contratada",
  ],
};

function emptyForm(data: UteExtractedData): UteExtractedData {
  // Convertir null → "" para strings y null → false para booleans en el form;
  // al confirmar limpiamos los strings vacíos para no sobreescribir.
  return data;
}

export function UteExtractModal({
  data,
  tipo,
  isSaving,
  onConfirm,
  onCancel,
}: {
  data: UteExtractedData;
  tipo: UteExtractTipo;
  isSaving: boolean;
  onConfirm: (data: Partial<UteExtractedData>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UteExtractedData>(() => emptyForm(data));

  // Si cambia el data prop (otro doc subido), re-hidratamos.
  useEffect(() => {
    setForm(emptyForm(data));
  }, [data]);

  const fields = FIELDS_BY_TIPO[tipo];

  function patchField(key: FieldKey, value: string | boolean) {
    setForm((cur) => ({ ...cur, [key]: value === "" ? null : value }));
  }

  function handleConfirm() {
    // Filtrar campos vacíos para no sobreescribir datos del proyecto con nada.
    const filtered: Partial<UteExtractedData> = {};
    for (const k of fields) {
      const v = form[k];
      if (v == null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      (filtered as Record<string, unknown>)[k] = v;
    }
    onConfirm(filtered);
  }

  const tipoLabel = tipo === "cedula" ? "cédula" : "factura UTE";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onCancel();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)] mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Datos extraídos de la {tipoLabel}
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Revisá y corregí lo que haga falta. Al confirmar, se guardan en el proyecto.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((key) => {
              const value = form[key];
              const isBoolean = typeof value === "boolean" || key === "persona_fisica";
              const isEmpty = value == null || value === "";
              return (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                    {FIELD_LABEL[key]}
                    {isEmpty && !isBoolean && (
                      <span className="ml-1 normal-case tracking-normal text-[var(--color-warning-text)] font-sans">
                        · no encontrado
                      </span>
                    )}
                  </label>
                  {isBoolean ? (
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] py-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => patchField(key, e.target.checked)}
                      />
                      Sí
                    </label>
                  ) : (
                    <input
                      type="text"
                      value={(value as string | null) ?? ""}
                      onChange={(e) => patchField(key, e.target.value)}
                      placeholder={isEmpty ? "No encontrado en el documento" : ""}
                      className={`w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] ${
                        isEmpty ? "bg-[var(--color-bg-app)]/30" : "bg-[var(--color-bg-app)]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-app)]/30">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {isSaving ? "Guardando…" : "Confirmar datos"}
          </button>
        </div>
      </div>
    </div>
  );
}
