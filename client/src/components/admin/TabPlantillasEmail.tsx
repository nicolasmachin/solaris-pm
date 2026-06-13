import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Lock } from "lucide-react";

import { usePermission } from "../../hooks/usePermission";
import { useEmailTemplate, useEmailTemplates, useEmailTemplateMutations } from "../../hooks/useEmail";
import type { EmailTemplate, EmailTemplateScope } from "../../api/email.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

const MODULOS = ["ONBOARDING", "VENTAS", "INGENIERIA", "OPERACIONES", "HABILITACION", "POSTVENTA", "CONFIGURACION"];
const SCOPES: EmailTemplateScope[] = ["PROJECT", "LEAD", "GLOBAL"];

const VARIABLES_AYUDA = [
  "{{cliente.nombre}}", "{{cliente.ci}}", "{{cliente.telefono}}", "{{cliente.email}}", "{{cliente.esEmpresa}}",
  "{{suministro.departamento}}", "{{suministro.localidad}}", "{{suministro.calle}}", "{{suministro.numero}}", "{{suministro.cuenta}}",
  "{{tecnica.tension}}", "{{tecnica.potenciaGenerador}}", "{{tecnica.potenciaContratada}}", "{{tecnica.tarifa}}",
  "{{tecnica.destino}}", "{{tecnica.acometida}}", "{{tecnica.pasaLinea}}", "{{tecnica.certificadoCarga}}", "{{tecnica.cargaPerturbadora}}",
];

interface Draft {
  key: string;
  nombre: string;
  descripcion: string;
  modulo: string;
  scope: EmailTemplateScope;
  toTemplate: string;
  ccTemplate: string;
  bccTemplate: string;
  subjectTemplate: string;
  bodyTemplate: string;
  activo: boolean;
}

const EMPTY_DRAFT: Draft = {
  key: "",
  nombre: "",
  descripcion: "",
  modulo: "ONBOARDING",
  scope: "PROJECT",
  toTemplate: "",
  ccTemplate: "",
  bccTemplate: "",
  subjectTemplate: "",
  bodyTemplate: "",
  activo: true,
};

function toDraft(t: EmailTemplate): Draft {
  return {
    key: t.key,
    nombre: t.nombre,
    descripcion: t.descripcion ?? "",
    modulo: t.modulo,
    scope: t.scope,
    toTemplate: t.toTemplate,
    ccTemplate: t.ccTemplate,
    bccTemplate: t.bccTemplate,
    subjectTemplate: t.subjectTemplate,
    bodyTemplate: t.bodyTemplate,
    activo: t.activo,
  };
}

export function TabPlantillasEmail() {
  const canEdit = usePermission("CONFIGURACION", "EDIT");
  const canCreate = usePermission("CONFIGURACION", "CREATE");
  const canDelete = usePermission("CONFIGURACION", "DELETE");

  const { data: templates = [], isLoading } = useEmailTemplates();
  const { crear, editar, borrar } = useEmailTemplateMutations();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const { data: selected } = useEmailTemplate(creating ? null : selectedId);
  const esSistema = !creating && (selected?.esSistema ?? false);

  // Selección inicial automática.
  useEffect(() => {
    if (!creating && !selectedId && templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId, creating]);

  useEffect(() => {
    if (creating) setDraft(EMPTY_DRAFT);
    else if (selected) setDraft(toDraft(selected));
  }, [selected, creating]);

  const readOnly = creating ? !canCreate : !canEdit;

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function guardar() {
    if (!draft.nombre.trim() || !draft.subjectTemplate.trim() || !draft.bodyTemplate.trim()) return;
    if (creating) {
      const created = await crear.mutateAsync({
        key: draft.key.trim(),
        nombre: draft.nombre.trim(),
        descripcion: draft.descripcion.trim() || null,
        modulo: draft.modulo,
        scope: draft.scope,
        toTemplate: draft.toTemplate,
        ccTemplate: draft.ccTemplate,
        bccTemplate: draft.bccTemplate,
        subjectTemplate: draft.subjectTemplate,
        bodyTemplate: draft.bodyTemplate,
        activo: draft.activo,
      });
      setCreating(false);
      setSelectedId(created.id);
    } else if (selectedId) {
      await editar.mutateAsync({
        id: selectedId,
        body: {
          nombre: draft.nombre.trim(),
          descripcion: draft.descripcion.trim() || null,
          modulo: draft.modulo,
          scope: draft.scope,
          toTemplate: draft.toTemplate,
          ccTemplate: draft.ccTemplate,
          bccTemplate: draft.bccTemplate,
          subjectTemplate: draft.subjectTemplate,
          bodyTemplate: draft.bodyTemplate,
          activo: draft.activo,
        },
      });
    }
  }

  function onBorrar() {
    if (!selectedId || !selected || selected.esSistema) return;
    if (!confirm(`¿Eliminar la plantilla "${selected.nombre}"?`)) return;
    borrar.mutate(selectedId, {
      onSuccess: () => setSelectedId(null),
    });
  }

  const busy = crear.isPending || editar.isPending;
  const ayuda = useMemo(() => VARIABLES_AYUDA.join("  ·  "), []);

  return (
    <div className="flex gap-4">
      {/* Lista */}
      <aside className="w-60 flex-shrink-0">
        {canCreate && (
          <button
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
            }}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva plantilla
          </button>
        )}
        <div className="space-y-1">
          {isLoading ? (
            <p className="px-2 py-3 text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : (
            templates.map((t) => {
              const active = !creating && t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(t.id);
                  }}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs ${
                    active
                      ? "border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10"
                      : "border border-transparent hover:bg-[var(--color-border)]/25"
                  }`}
                >
                  {t.esSistema && <Lock className="h-3 w-3 flex-shrink-0 text-[var(--color-text-muted)]" />}
                  <span className="flex-1 truncate text-[var(--color-text-primary)]">{t.nombre}</span>
                  {!t.activo && <span className="text-[9px] text-[var(--color-text-muted)]">inactiva</span>}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        {!creating && !selectedId ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Elegí una plantilla o creá una nueva.</p>
        ) : (
          <div className="space-y-3">
            {esSistema && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/50 px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
                Plantilla de sistema: podés editar asunto, cuerpo y destinatarios, pero no borrarla ni cambiar su clave.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nombre *</label>
                <input className={inp} value={draft.nombre} disabled={readOnly} onChange={(e) => set("nombre", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Clave (key)</label>
                <input
                  className={inp}
                  value={draft.key}
                  disabled={!creating}
                  placeholder="consulta_ute"
                  onChange={(e) => set("key", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Módulo</label>
                <select className={inp} value={draft.modulo} disabled={readOnly} onChange={(e) => set("modulo", e.target.value)}>
                  {MODULOS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Scope</label>
                <select className={inp} value={draft.scope} disabled={readOnly} onChange={(e) => set("scope", e.target.value as EmailTemplateScope)}>
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Para (To)</label>
                <input className={inp} value={draft.toTemplate} disabled={readOnly} onChange={(e) => set("toTemplate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Cc</label>
                <input className={inp} value={draft.ccTemplate} disabled={readOnly} onChange={(e) => set("ccTemplate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Cco (Bcc)</label>
                <input className={inp} value={draft.bccTemplate} disabled={readOnly} onChange={(e) => set("bccTemplate", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Asunto *</label>
              <input className={inp} value={draft.subjectTemplate} disabled={readOnly} onChange={(e) => set("subjectTemplate", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Cuerpo *</label>
              <textarea
                className={`${inp} resize-y font-mono text-xs`}
                rows={14}
                value={draft.bodyTemplate}
                disabled={readOnly}
                onChange={(e) => set("bodyTemplate", e.target.value)}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                Variables: {ayuda}. Condicional: <code>{"{{#if cliente.esEmpresa}}…{{else}}…{{/if}}"}</code>
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
              <input type="checkbox" checked={draft.activo} disabled={readOnly} onChange={(e) => set("activo", e.target.checked)} />
              Activa
            </label>

            {!readOnly && (
              <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <button
                  onClick={guardar}
                  disabled={busy}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Guardando…" : creating ? "Crear plantilla" : "Guardar cambios"}
                </button>
                {!creating && !esSistema && canDelete && (
                  <button
                    onClick={onBorrar}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
