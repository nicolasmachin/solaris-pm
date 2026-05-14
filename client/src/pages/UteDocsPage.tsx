import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ChevronLeft, Download, Save } from "lucide-react";

import { getProject } from "../api/projects.api";
import {
  useGenerateUteDocs,
  useSaveUteDocsConfig,
  useUteDocsConfig,
} from "../hooks/useUteDocs";
import {
  UTE_DOC_KEYS,
  UTE_DOC_LABEL,
  type UteDocKey,
  type UteDocumentConfig,
} from "../api/uteDocs.api";
import { Spinner } from "../components/ui/Spinner";

const lbl =
  "block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";
const inp =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

type ConfigForm = Omit<UteDocumentConfig, "id" | "projectId" | "createdAt" | "updatedAt">;

function configToForm(c: UteDocumentConfig): ConfigForm {
  const { id: _id, projectId: _p, createdAt: _c, updatedAt: _u, ...rest } = c;
  // El backend envía las fechas como ISO; el <input type="date"> espera YYYY-MM-DD.
  return {
    ...rest,
    fechaDoc: rest.fechaDoc?.slice(0, 10) ?? "",
    fechaFin: rest.fechaFin ? rest.fechaFin.slice(0, 10) : null,
  };
}

export function UteDocsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });
  const configQ = useUteDocsConfig(projectId!);
  const saveMut = useSaveUteDocsConfig(projectId!);
  const generateMut = useGenerateUteDocs(projectId!);

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<UteDocKey>>(new Set(UTE_DOC_KEYS));

  // Hidratar el form cuando llega la config.
  useEffect(() => {
    if (configQ.data && !form) setForm(configToForm(configQ.data));
  }, [configQ.data, form]);

  const project = projectQ.data;
  const projectFilename = useMemo(
    () => (project?.clientName ?? "proyecto").replace(/[^a-zA-Z0-9_-]+/g, "_"),
    [project],
  );

  if (!projectId) return null;
  if (configQ.isLoading || projectQ.isLoading || !form) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  function patch(key: keyof ConfigForm, value: string | boolean | null) {
    setForm((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  function toggleDoc(key: UteDocKey) {
    setSelectedDocs((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!form) return;
    try {
      await saveMut.mutateAsync({
        ...form,
        fechaFin: form.fechaFin || null,
      });
      toast.success("Configuración UTE guardada");
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar");
    }
  }

  async function handleGenerate() {
    if (selectedDocs.size === 0) {
      toast.error("Seleccioná al menos un documento");
      return;
    }
    try {
      // Guardar primero, después generar (asegura que el ZIP usa lo último).
      await saveMut.mutateAsync({ ...form!, fechaFin: form!.fechaFin || null });
      const docs = UTE_DOC_KEYS.filter((k) => selectedDocs.has(k));
      const { docsCount } = await generateMut.mutateAsync({
        docs,
        filenameHint: projectFilename,
      });
      toast.success(`${docsCount} documento${docsCount === 1 ? "" : "s"} descargado${docsCount === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo generar el ZIP");
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <Link
          to={`/ingenieria/proyecto/${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="w-3 h-3" /> Workspace de ingeniería
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
              Documentos UTE
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] font-mono mt-0.5">
              {project?.code} · {project?.clientName}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded p-3">
        Los datos del cliente, sistema fotovoltaico y trámite UTE se cargan acá. Algunos vienen del proyecto (cliente, dirección, capacidad) y otros son específicos del trámite. Revisá y completá lo que falte antes de generar el ZIP.
      </p>

      {/* Datos del proyecto (read-only) */}
      <Section title="Datos del proyecto (referencia)">
        <Readonly label="Cliente" value={project?.clientName ?? ""} />
        <Readonly label="Email" value={project?.notificationEmail ?? ""} />
        <Readonly label="Teléfono" value={project?.notificationPhone ?? ""} />
        <Readonly label="Dirección" value={project?.clientAddress ?? ""} />
        <Readonly label="Ciudad" value={project?.locationCity ?? ""} />
        <Readonly label="Departamento" value={project?.locationProvince ?? ""} />
      </Section>

      {/* Cliente (datos UTE-específicos) */}
      <Section title="Cliente (datos UTE)">
        <Text label="CI cliente" value={form.ciCliente} onChange={(v) => patch("ciCliente", v)} />
        <Text label="Calle" value={form.calle} onChange={(v) => patch("calle", v)} />
        <Text label="Número" value={form.numCalle} onChange={(v) => patch("numCalle", v)} />
        <Text label="Nº cuenta UTE" value={form.cuentaUte} onChange={(v) => patch("cuentaUte", v)} />
        <Text label="Nº caso UTE" value={form.casoUte} onChange={(v) => patch("casoUte", v)} />
        <Checkbox label="Persona física" checked={form.personaFisica} onChange={(v) => patch("personaFisica", v)} />
        <Checkbox label="Empresa" checked={form.empresa} onChange={(v) => patch("empresa", v)} />
      </Section>

      {/* Representante */}
      <Section title="Representante del cliente (si aplica)">
        <Text label="Nombre" value={form.representa} onChange={(v) => patch("representa", v)} />
        <Text label="CI" value={form.ciRepre} onChange={(v) => patch("ciRepre", v)} />
        <Text label="Calidad / cargo" value={form.calidadRepre} onChange={(v) => patch("calidadRepre", v)} />
      </Section>

      {/* Voltia */}
      <Section title="Datos de Voltia y técnico instalador">
        <Text label="Firma instaladora" value={form.fi} onChange={(v) => patch("fi", v)} />
        <Text label="RUT" value={form.rut} onChange={(v) => patch("rut", v)} />
        <Text label="Dirección Voltia" value={form.dirFi} onChange={(v) => patch("dirFi", v)} />
        <Text label="Técnico instalador" value={form.ti} onChange={(v) => patch("ti", v)} />
        <Text label="CI técnico" value={form.ciTi} onChange={(v) => patch("ciTi", v)} />
        <Text label="Oficina UTE" value={form.oficina} onChange={(v) => patch("oficina", v)} />
      </Section>

      {/* UTE */}
      <Section title="UTE">
        <Text label="Representante UTE" value={form.repUte} onChange={(v) => patch("repUte", v)} />
        <Text label="Calidad UTE" value={form.calidadUte} onChange={(v) => patch("calidadUte", v)} />
        <Text label="Asesor" value={form.asUte} onChange={(v) => patch("asUte", v)} />
        <Text label="Punto de suministro (PS)" value={form.ps} onChange={(v) => patch("ps", v)} />
        <Text label="Marca X (genérico)" value={form.x} onChange={(v) => patch("x", v)} />
      </Section>

      {/* Datos técnicos */}
      <Section title="Datos técnicos del sistema">
        <Text label="Potencia nominal (Solicitud IMG)" value={form.potenciaNomSolicitudImg} onChange={(v) => patch("potenciaNomSolicitudImg", v)} />
        <Text label="Intensidad nominal (Solicitud IMG)" value={form.intensidadNomSolicitudImg} onChange={(v) => patch("intensidadNomSolicitudImg", v)} />
        <Checkbox label="Tensión 230V" checked={form.tension230} onChange={(v) => patch("tension230", v)} />
        <Checkbox label="Tensión 400V" checked={form.tension400} onChange={(v) => patch("tension400", v)} />
        <Checkbox label="Tensión inversor 230V" checked={form.tensionNomInversor230} onChange={(v) => patch("tensionNomInversor230", v)} />
        <Checkbox label="Tensión inversor 400V" checked={form.tensionNomInversor400} onChange={(v) => patch("tensionNomInversor400", v)} />
        <Checkbox label="Fases monofásico" checked={form.fasesMono} onChange={(v) => patch("fasesMono", v)} />
        <Checkbox label="Fases trifásico" checked={form.fasesTri} onChange={(v) => patch("fasesTri", v)} />
        <Checkbox label="Tipo generador Sinc mono" checked={form.tipoGeneradorSincMono} onChange={(v) => patch("tipoGeneradorSincMono", v)} />
        <Checkbox label="Tipo generador Sinc tri" checked={form.tipoGeneradorSincTri} onChange={(v) => patch("tipoGeneradorSincTri", v)} />
        <Text label="Potencia IMG" value={form.potImg} onChange={(v) => patch("potImg", v)} />
        <Text label="Potencia IMG (en letras)" value={form.potImgLetras} onChange={(v) => patch("potImgLetras", v)} />
        <Text label="Potencia contratada" value={form.potContratada} onChange={(v) => patch("potContratada", v)} />
        <Text label="Potencia contratada (en letras)" value={form.potContratadaLetras} onChange={(v) => patch("potContratadaLetras", v)} />
        <Text label="Potencia contratada (×1000)" value={form.potContratada1000} onChange={(v) => patch("potContratada1000", v)} />
        <Text label="Tarifa" value={form.tarifa} onChange={(v) => patch("tarifa", v)} />
        <Text label="Factor de potencia (fp)" value={form.fp} onChange={(v) => patch("fp", v)} />
        <Text label="Norma 1" value={form.normas1} onChange={(v) => patch("normas1", v)} />
        <Text label="Norma 2" value={form.normas2} onChange={(v) => patch("normas2", v)} />
        <Text label="X1 (checkbox)" value={form.x1} onChange={(v) => patch("x1", v)} />
        <Text label="X2 (checkbox)" value={form.x2} onChange={(v) => patch("x2", v)} />
        <Text label="X3 (checkbox)" value={form.x3} onChange={(v) => patch("x3", v)} />
        <Text label="X4 (checkbox)" value={form.x4} onChange={(v) => patch("x4", v)} />
        <Text label="Serie panel" value={form.seriePanel} onChange={(v) => patch("seriePanel", v)} />
        <Text label="Serie inversor" value={form.serieInversor} onChange={(v) => patch("serieInversor", v)} />
        <Text label="Área paneles" value={form.areaPaneles} onChange={(v) => patch("areaPaneles", v)} />
      </Section>

      {/* Fechas */}
      <Section title="Fechas">
        <div>
          <label className={lbl}>Fecha del documento *</label>
          <input
            type="date"
            value={form.fechaDoc}
            onChange={(e) => patch("fechaDoc", e.target.value)}
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Fecha de habilitación (Sol_Hab / Acta / Contrato)</label>
          <input
            type="date"
            value={form.fechaFin ?? ""}
            onChange={(e) => patch("fechaFin", e.target.value || null)}
            className={inp}
          />
        </div>
      </Section>

      {/* Botón guardar config */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" /> {saveMut.isPending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>

      {/* Selector de docs */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Documentos a generar
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          {selectedDocs.size} de {UTE_DOC_KEYS.length} seleccionados.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {UTE_DOC_KEYS.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedDocs.has(k)}
                onChange={() => toggleDoc(k)}
              />
              <span className="text-sm text-[var(--color-text-primary)]">{UTE_DOC_LABEL[k]}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateMut.isPending || saveMut.isPending || selectedDocs.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {generateMut.isPending ? "Generando…" : "Generar y descargar ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
      <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inp} />
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <p className="text-sm text-[var(--color-text-secondary)] py-1.5">{value || "—"}</p>
    </div>
  );
}
