import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { getDeadlineRules, createDeadlineRule, updateDeadlineRule, deleteDeadlineRule } from '../api/deadline.api';
import { getPipelineTemplate } from '../api/pipelineTemplate.api';
import {
  DEADLINE_RULE_TIPO_LABEL,
  STAGE_TYPE_LABEL,
  type DeadlineRule,
  type DeadlineRuleTipo,
  type StageType,
} from '../types/deadline.types';

const STAGE_TYPE_VALUES: StageType[] = ['ONBOARDING', 'INGENIERIA', 'OPERACIONES', 'HABILITACION_UTE', 'POSTVENTA'];
const TIPO_VALUES: DeadlineRuleTipo[] = ['DIAS_DESDE_CREACION', 'DIAS_ANTES_INSTALACION', 'MANUAL', 'SIN_DEADLINE'];

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

export function TabDeadlineRules() {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState<StageType | 'all'>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [editingRule, setEditingRule] = useState<DeadlineRule | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['deadline-rules', stageFilter, showOnlyActive],
    queryFn: () =>
      getDeadlineRules({
        ...(stageFilter !== 'all' ? { stageType: stageFilter } : {}),
        ...(showOnlyActive ? { activa: true } : {}),
      }),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline-template'],
    queryFn: getPipelineTemplate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDeadlineRule(id),
    onSuccess: () => {
      toast.success('Regla eliminada');
      qc.invalidateQueries({ queryKey: ['deadline-rules'] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al eliminar'),
  });

  const toggleActivaMut = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) => updateDeadlineRule(id, { activa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deadline-rules'] }),
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al actualizar'),
  });

  function handleDelete(rule: DeadlineRule) {
    const target = rule.sopCode
      ? `${STAGE_TYPE_LABEL[rule.stageType]} → ${rule.sopCode}`
      : rule.substageName
        ? `${STAGE_TYPE_LABEL[rule.stageType]} → ${rule.substageName}`
        : `${STAGE_TYPE_LABEL[rule.stageType]} (default)`;
    if (!confirm(`¿Eliminar la regla de ${target}?`)) return;
    deleteMut.mutate(rule.id);
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold mb-1">¿Cómo funcionan las reglas?</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Cada regla determina cuándo debe completarse una subetapa. Se aplican a todos los proyectos en función del nombre o sopCode de la subetapa dentro de la etapa elegida. Si una subetapa no tiene regla específica, se usa la regla "default" de su etapa (si existe).
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as StageType | 'all')}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-xs text-[var(--color-text-primary)]"
        >
          <option value="all">Todas las etapas</option>
          {STAGE_TYPE_VALUES.map((s) => (
            <option key={s} value={s}>
              {STAGE_TYPE_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={showOnlyActive} onChange={(e) => setShowOnlyActive(e.target.checked)} />
          Solo activas
        </label>
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-app)] hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva regla
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-mono">
              <th className="px-3 py-2 text-left">Etapa / Subetapa</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-right">Días</th>
              <th className="px-3 py-2 text-center">Activa</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">Cargando…</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)] italic">
                No hay reglas de deadlines configuradas. Las reglas determinan cuándo debe completarse cada subetapa automáticamente.
              </td></tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">
                    <div className="font-medium">{STAGE_TYPE_LABEL[rule.stageType]}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {rule.sopCode ? `sopCode: ${rule.sopCode}` : rule.substageName ? rule.substageName : 'Default de etapa'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{DEADLINE_RULE_TIPO_LABEL[rule.tipo]}</td>
                  <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{rule.dias ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={rule.activa}
                      onChange={(e) => toggleActivaMut.mutate({ id: rule.id, activa: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setEditingRule(rule)}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-500"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showCreate || editingRule) && pipeline && (
        <RuleModal
          rule={editingRule}
          stages={pipeline.stages}
          onClose={() => {
            setShowCreate(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

interface PipelineStageLite {
  name: StageType;
  substages: { order: number; name: string; sopCode?: string | null }[];
}

function RuleModal({ rule, stages, onClose }: {
  rule: DeadlineRule | null;
  stages: PipelineStageLite[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!rule;

  const [stageType, setStageType] = useState<StageType>(rule?.stageType ?? 'INGENIERIA');
  const [target, setTarget] = useState<string>(() => {
    if (!rule) return 'default';
    if (rule.sopCode) return `sop:${rule.sopCode}`;
    if (rule.substageName) return `name:${rule.substageName}`;
    return 'default';
  });
  const [tipo, setTipo] = useState<DeadlineRuleTipo>(rule?.tipo ?? 'DIAS_DESDE_CREACION');
  const [dias, setDias] = useState<string>(rule?.dias?.toString() ?? '');
  const [activa, setActiva] = useState<boolean>(rule?.activa ?? true);
  const [error, setError] = useState<string>('');

  const stageOptions = useMemo(() => stages.find((s) => s.name === stageType)?.substages ?? [], [stages, stageType]);

  const needsDias = tipo === 'DIAS_DESDE_CREACION' || tipo === 'DIAS_ANTES_INSTALACION';

  const saveMut = useMutation({
    mutationFn: async () => {
      const sopCode = target.startsWith('sop:') ? target.slice(4) : null;
      const substageName = target.startsWith('name:') ? target.slice(5) : null;
      const diasParsed = needsDias ? Number.parseInt(dias, 10) : null;

      if (needsDias && (!Number.isFinite(diasParsed) || (diasParsed as number) <= 0)) {
        throw new Error('Cantidad de días inválida (debe ser un entero mayor a 0)');
      }

      if (isEdit && rule) {
        return updateDeadlineRule(rule.id, { tipo, dias: diasParsed, activa });
      }
      return createDeadlineRule({ stageType, sopCode, substageName, tipo, dias: diasParsed, activa });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Regla actualizada' : 'Regla creada');
      qc.invalidateQueries({ queryKey: ['deadline-rules'] });
      onClose();
    },
    onError: (err) => setError(getApiErr(err) ?? (err as Error).message ?? 'Error al guardar'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl z-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
            {isEdit ? 'Editar regla' : 'Nueva regla de deadline'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Etapa</label>
            <select
              className={inp}
              value={stageType}
              onChange={(e) => {
                setStageType(e.target.value as StageType);
                setTarget('default');
              }}
              disabled={isEdit}
            >
              {STAGE_TYPE_VALUES.map((s) => (
                <option key={s} value={s}>{STAGE_TYPE_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Aplicar a</label>
            <select
              className={inp}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={isEdit}
            >
              <option value="default">Default de la etapa (todas las subetapas sin regla específica)</option>
              {stageOptions.map((sub) => {
                const value = sub.sopCode ? `sop:${sub.sopCode}` : `name:${sub.name}`;
                const label = sub.sopCode ? `${sub.name} (sopCode: ${sub.sopCode})` : sub.name;
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          </div>

          <div>
            <label className={lbl}>Tipo de regla</label>
            <div className="space-y-1.5">
              {TIPO_VALUES.map((t) => (
                <label key={t} className="flex items-start gap-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="tipo"
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="mt-0.5"
                  />
                  <span className="text-[var(--color-text-primary)]">{DEADLINE_RULE_TIPO_LABEL[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {needsDias && (
            <div>
              <label className={lbl}>Cantidad de días</label>
              <input
                type="number"
                min={1}
                step={1}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                className={inp}
                placeholder="Ej: 5"
                required
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                {tipo === 'DIAS_DESDE_CREACION'
                  ? 'Días contados desde la creación del proyecto'
                  : 'Días anteriores al inicio de la instalación'}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Regla activa
          </label>

          {error && <p className="text-[11px] text-[var(--color-danger-text)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-app)] hover:opacity-90 disabled:opacity-50"
            >
              {saveMut.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
