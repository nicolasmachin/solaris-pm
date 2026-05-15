import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ChevronLeft, Download, RotateCcw, Save } from "lucide-react";

import {
  createSolarSystem,
  getProject,
  patchProject,
  patchSolarSystem,
  type SolarSystemPayload,
} from "../api/projects.api";
import {
  useGenerateUteDocs,
  useSaveUteDocsConfig,
  useUteDocsConfig,
} from "../hooks/useUteDocs";
import {
  UTE_DOC_KEYS,
  UTE_DOC_LABEL,
  deleteUteDocsConfig,
  type UteDocKey,
  type UteDocumentConfig,
} from "../api/uteDocs.api";
import { Spinner } from "../components/ui/Spinner";

// Campos del Project que se editan desde acá. Los cambios se persisten al
// proyecto (no a la config UTE) usando patchProject — así si el operario
// detecta un email mal cargado o falta la ciudad, queda corregido en TODO
// el proyecto, no sólo en este form.
type ProjectFields = {
  clientName: string;
  notificationEmail: string;
  notificationPhone: string;
  clientAddress: string;
  locationCity: string;
  locationProvince: string;
  // Datos del cliente que también se extraen con IA. Ahora viven en Project.
  ciCliente: string;
  calle: string;
  numCalle: string;
  personaFisica: boolean;
  empresa: boolean;
};

// Subconjunto editable del SolarSystem primario (order=1). Si el proyecto
// todavía no tiene SolarSystem, al guardar se crea uno con estos datos.
// Los campos numéricos se manejan como string en el form para que el input
// soporte vacío sin saltar a 0.
type SolarFields = {
  panelBrand: string;
  panelModel: string;
  panelQuantity: string;
  panelPowerW: string;
  inverterBrand: string;
  inverterModel: string;
  inverterQuantity: string;
  // El form muestra/edita la potencia del inversor en W (igual que pide UTE).
  // En la DB se guarda en kW (SolarSystem.inverterPowerKw). La conversión se
  // hace al hidratar (×1000) y al guardar (÷1000).
  inverterPowerW: string;
};

function emptyOrNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

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
  const qc = useQueryClient();
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });
  const configQ = useUteDocsConfig(projectId!);
  const saveMut = useSaveUteDocsConfig(projectId!);
  const generateMut = useGenerateUteDocs(projectId!);

  // Patch del Project para los campos editables de la sección "Datos del proyecto".
  const patchProjectMut = useMutation({
    mutationFn: (body: Partial<ProjectFields>) => patchProject(projectId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // Upsert del SolarSystem primario (order=1). Si no existe, crea uno; si
  // existe, patchea solo los 4 campos editables (marca/modelo panel + inv).
  const saveSolarMut = useMutation({
    mutationFn: async (args: { systemId: string | null; body: SolarSystemPayload }) => {
      if (args.systemId) return patchSolarSystem(projectId!, args.systemId, args.body);
      return createSolarSystem(projectId!, { order: 1, ...args.body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [projectFields, setProjectFields] = useState<ProjectFields | null>(null);
  const [solarFields, setSolarFields] = useState<SolarFields | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<UteDocKey>>(new Set(UTE_DOC_KEYS));

  // Hidratar el form de la config cuando llega.
  useEffect(() => {
    if (configQ.data && !form) setForm(configToForm(configQ.data));
  }, [configQ.data, form]);

  // Hidratar los campos editables del proyecto cuando llega.
  useEffect(() => {
    if (projectQ.data && !projectFields) {
      setProjectFields({
        clientName: projectQ.data.clientName ?? "",
        notificationEmail: projectQ.data.notificationEmail ?? "",
        notificationPhone: projectQ.data.notificationPhone ?? "",
        clientAddress: projectQ.data.clientAddress ?? "",
        locationCity: projectQ.data.locationCity ?? "",
        locationProvince: projectQ.data.locationProvince ?? "",
        ciCliente: projectQ.data.ciCliente ?? "",
        calle: projectQ.data.calle ?? "",
        numCalle: projectQ.data.numCalle ?? "",
        personaFisica: projectQ.data.personaFisica ?? true,
        empresa: projectQ.data.empresa ?? false,
      });
    }
  }, [projectQ.data, projectFields]);

  // Hidratar los campos editables del SolarSystem primario cuando llega.
  // Regla del usuario: si ya está en el proyecto, se carga. Si está vacío,
  // se aplica el default (para los campos del listado típico). Los demás
  // quedan en blanco si no hay dato.
  useEffect(() => {
    if (projectQ.data && !solarFields) {
      const primary = projectQ.data.solarSystems?.[0] ?? null;
      const orDefault = <T,>(actual: T | null | undefined, def: T): T =>
        actual != null && actual !== "" ? actual : def;
      // kW (DB) → W (form). Si hay valor, convierto y muestro en W.
      const inverterWFromDb = primary?.inverterPowerKw != null
        ? String(Math.round(Number(primary.inverterPowerKw) * 1000))
        : "";
      setSolarFields({
        panelBrand: primary?.panelBrand ?? "",
        panelModel: primary?.panelModel ?? "",
        panelQuantity: primary?.panelQuantity != null ? String(primary.panelQuantity) : "",
        panelPowerW: orDefault(primary?.panelPowerW != null ? String(primary.panelPowerW) : "", "580"),
        inverterBrand: orDefault(primary?.inverterBrand ?? "", "Growatt"),
        inverterModel: orDefault(primary?.inverterModel ?? "", "MIN 6000 TL-X2"),
        inverterQuantity: orDefault(primary?.inverterQuantity != null ? String(primary.inverterQuantity) : "", "1"),
        inverterPowerW: orDefault(inverterWFromDb, "6000"),
      });
    }
  }, [projectQ.data, solarFields]);

  const project = projectQ.data;
  const primarySolar = project?.solarSystems?.[0] ?? null;
  const projectFilename = useMemo(
    () => (project?.clientName ?? "proyecto").replace(/[^a-zA-Z0-9_-]+/g, "_"),
    [project],
  );

  if (!projectId) return null;
  if (configQ.isLoading || projectQ.isLoading || !form || !projectFields || !solarFields) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  function patch(key: keyof ConfigForm, value: string | boolean | null) {
    setForm((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  function patchProjectField<K extends keyof ProjectFields>(key: K, value: ProjectFields[K]) {
    setProjectFields((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  function patchSolarField(key: keyof SolarFields, value: string) {
    setSolarFields((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  function toggleDoc(key: UteDocKey) {
    setSelectedDocs((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Diff de campos del Project: solo persiste lo que realmente cambió.
  // null vacío en lugar de string vacío para fields nullable (email, phone, address).
  function buildProjectPatch(): Partial<ProjectFields> | null {
    if (!projectFields || !project) return null;
    const out: Partial<ProjectFields> = {};
    const stringKeys: (keyof ProjectFields)[] = [
      "clientName",
      "notificationEmail",
      "notificationPhone",
      "clientAddress",
      "locationCity",
      "locationProvince",
      "ciCliente",
      "calle",
      "numCalle",
    ];
    for (const k of stringKeys) {
      const current = (project[k as keyof typeof project] ?? "") as string;
      const next = projectFields[k] as string;
      if (current !== next) (out as Record<string, unknown>)[k] = next;
    }
    // Booleans (personaFisica, empresa).
    if (project.personaFisica !== projectFields.personaFisica) out.personaFisica = projectFields.personaFisica;
    if (project.empresa !== projectFields.empresa) out.empresa = projectFields.empresa;
    return Object.keys(out).length > 0 ? out : null;
  }

  // Diff del SolarSystem primario. Si no había sistema, cualquier valor no
  // vacío dispara la creación. Si ya había, manda solo los campos cambiados.
  function buildSolarPatch(): SolarSystemPayload | null {
    if (!solarFields) return null;
    const sourceBrand = primarySolar?.panelBrand ?? "";
    const sourceModel = primarySolar?.panelModel ?? "";
    const sourcePanelQty = primarySolar?.panelQuantity != null ? String(primarySolar.panelQuantity) : "";
    const sourcePanelW = primarySolar?.panelPowerW != null ? String(primarySolar.panelPowerW) : "";
    const sourceInvBrand = primarySolar?.inverterBrand ?? "";
    const sourceInvModel = primarySolar?.inverterModel ?? "";
    const sourceInvQty = primarySolar?.inverterQuantity != null ? String(primarySolar.inverterQuantity) : "";
    // Comparamos en W (la unidad que ve el usuario en el input). Si difiere,
    // convertimos de vuelta a kW para persistir en SolarSystem.inverterPowerKw.
    const sourceInvW = primarySolar?.inverterPowerKw != null
      ? String(Math.round(Number(primarySolar.inverterPowerKw) * 1000))
      : "";

    const out: SolarSystemPayload = {};
    if (sourceBrand !== solarFields.panelBrand) out.panelBrand = solarFields.panelBrand || null;
    if (sourceModel !== solarFields.panelModel) out.panelModel = solarFields.panelModel || null;
    if (sourcePanelQty !== solarFields.panelQuantity) out.panelQuantity = emptyOrNum(solarFields.panelQuantity);
    if (sourcePanelW !== solarFields.panelPowerW) out.panelPowerW = emptyOrNum(solarFields.panelPowerW);
    if (sourceInvBrand !== solarFields.inverterBrand) out.inverterBrand = solarFields.inverterBrand || null;
    if (sourceInvModel !== solarFields.inverterModel) out.inverterModel = solarFields.inverterModel || null;
    if (sourceInvQty !== solarFields.inverterQuantity) out.inverterQuantity = emptyOrNum(solarFields.inverterQuantity);
    if (sourceInvW !== solarFields.inverterPowerW) {
      const w = emptyOrNum(solarFields.inverterPowerW);
      out.inverterPowerKw = w != null ? w / 1000 : null;
    }

    return Object.keys(out).length > 0 ? out : null;
  }

  async function saveAll(): Promise<{ projectChanged: boolean; solarChanged: boolean }> {
    const projectPatch = buildProjectPatch();
    const solarPatch = buildSolarPatch();
    const ops: Promise<unknown>[] = [
      saveMut.mutateAsync({ ...form!, fechaFin: form!.fechaFin || null }),
    ];
    if (projectPatch) ops.push(patchProjectMut.mutateAsync(projectPatch));
    if (solarPatch) {
      ops.push(saveSolarMut.mutateAsync({ systemId: primarySolar?.id ?? null, body: solarPatch }));
    }
    await Promise.all(ops);
    return { projectChanged: !!projectPatch, solarChanged: !!solarPatch };
  }

  // Reset: BORRA la config UTE persistida (incluye lo que el usuario haya
  // guardado a mano) y vuelve a hidratar desde el server. El próximo GET
  // recrea la config con los defaults del schema (FI, RUT, normas, etc.)
  // y deja en blanco los campos sin default. No toca Project ni SolarSystem.
  async function handleReset() {
    if (!confirm("¿Borrar todos los datos cargados en la config UTE y volver a los valores por defecto? Los datos del proyecto y del sistema FV se conservan.")) return;
    try {
      await deleteUteDocsConfig(projectId!);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["project", projectId] }),
        qc.invalidateQueries({ queryKey: ["ute-docs-config", projectId] }),
      ]);
      setForm(null);
      setProjectFields(null);
      setSolarFields(null);
      toast.success("Config UTE restablecida a los valores por defecto");
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo resetear");
    }
  }

  async function handleSave() {
    if (!form || !projectFields || !solarFields) return;
    try {
      const { projectChanged, solarChanged } = await saveAll();
      const parts = ["Configuración UTE"];
      if (projectChanged) parts.push("datos del proyecto");
      if (solarChanged) parts.push("sistema FV");
      toast.success(`${parts.join(", ")} ${parts.length === 1 ? "guardada" : "guardados"}`);
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
      await saveAll();
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

      {/* Datos del proyecto — editables. Los cambios se guardan al proyecto
          (no a la config UTE), así corrigen el dato en toda la app. */}
      <Section title="Datos del proyecto (editables)">
        <Text label="Cliente" value={projectFields.clientName} onChange={(v) => patchProjectField("clientName", v)} />
        <Text label="Email" value={projectFields.notificationEmail} onChange={(v) => patchProjectField("notificationEmail", v)} />
        <Text label="Teléfono" value={projectFields.notificationPhone} onChange={(v) => patchProjectField("notificationPhone", v)} />
        <Text label="Dirección" value={projectFields.clientAddress} onChange={(v) => patchProjectField("clientAddress", v)} />
        <Text label="Ciudad" value={projectFields.locationCity} onChange={(v) => patchProjectField("locationCity", v)} />
        <Text label="Departamento" value={projectFields.locationProvince} onChange={(v) => patchProjectField("locationProvince", v)} />
      </Section>

      {/* Sistema fotovoltaico — vive en SolarSystem. Editable acá; los cambios
          se persisten al sistema primario del proyecto (o lo crean si no
          existe todavía). */}
      <Section title="Sistema fotovoltaico (editable)">
        <Text label="Marca panel" value={solarFields.panelBrand} onChange={(v) => patchSolarField("panelBrand", v)} />
        <Text label="Modelo panel" value={solarFields.panelModel} onChange={(v) => patchSolarField("panelModel", v)} />
        <Text label="Cantidad de paneles" value={solarFields.panelQuantity} onChange={(v) => patchSolarField("panelQuantity", v)} />
        <Text label="Potencia panel (W)" value={solarFields.panelPowerW} onChange={(v) => patchSolarField("panelPowerW", v)} />
        <Text label="Marca inversor" value={solarFields.inverterBrand} onChange={(v) => patchSolarField("inverterBrand", v)} />
        <Text label="Modelo inversor" value={solarFields.inverterModel} onChange={(v) => patchSolarField("inverterModel", v)} />
        <Text label="Cantidad de inversores" value={solarFields.inverterQuantity} onChange={(v) => patchSolarField("inverterQuantity", v)} />
        <Text label="Pot Nominal inversor (W)" value={solarFields.inverterPowerW} onChange={(v) => patchSolarField("inverterPowerW", v)} />
      </Section>

      {/* Cliente — viven en Project. Se editan acá y también se extraen con IA
          desde cédula / factura UTE (feature ute-doc-extraction). */}
      <Section title="Cliente">
        <Text label="CI cliente" value={projectFields.ciCliente} onChange={(v) => patchProjectField("ciCliente", v)} />
        <Text label="Calle" value={projectFields.calle} onChange={(v) => patchProjectField("calle", v)} />
        <Text label="Num calle" value={projectFields.numCalle} onChange={(v) => patchProjectField("numCalle", v)} />
        <Checkbox label="Persona Fisica" checked={projectFields.personaFisica} onChange={(v) => patchProjectField("personaFisica", v)} />
        <Checkbox label="Empresa" checked={projectFields.empresa} onChange={(v) => patchProjectField("empresa", v)} />
      </Section>

      {/* Representante */}
      <Section title="Representante del cliente (si aplica)">
        <Text label="Representa" value={form.representa} onChange={(v) => patch("representa", v)} />
        <Text label="CI Repre" value={form.ciRepre} onChange={(v) => patch("ciRepre", v)} />
        <Text label="Calidad Repre" value={form.calidadRepre} onChange={(v) => patch("calidadRepre", v)} />
      </Section>

      {/* Voltia */}
      <Section title="Datos de Voltia y técnico instalador">
        <Text label="FI" value={form.fi} onChange={(v) => patch("fi", v)} />
        <Text label="RUT" value={form.rut} onChange={(v) => patch("rut", v)} />
        <Text label="Dir FI" value={form.dirFi} onChange={(v) => patch("dirFi", v)} />
        <Text label="TI" value={form.ti} onChange={(v) => patch("ti", v)} />
        <Text label="CI TI" value={form.ciTi} onChange={(v) => patch("ciTi", v)} />
      </Section>

      {/* Trámite UTE — todos los datos del trámite/expediente UTE. */}
      <Section title="Trámite UTE">
        <Text label="Cuenta" value={form.cuentaUte} onChange={(v) => patch("cuentaUte", v)} />
        <Text label="Caso" value={form.casoUte} onChange={(v) => patch("casoUte", v)} />
        <Text label="AS" value={form.asUte} onChange={(v) => patch("asUte", v)} />
        <Text label="PS" value={form.ps} onChange={(v) => patch("ps", v)} />
        <Text label="Oficina Comercial UTE" value={form.oficina} onChange={(v) => patch("oficina", v)} />
        <Text label="Rep UTE" value={form.repUte} onChange={(v) => patch("repUte", v)} />
        <Text label="Calidad UTE" value={form.calidadUte} onChange={(v) => patch("calidadUte", v)} />
        <Text label="X" value={form.x} onChange={(v) => patch("x", v)} />
      </Section>

      {/* Datos técnicos */}
      <Section title="Datos técnicos del sistema">
        <Text label="Pot nominal IMG (W)" value={form.potenciaNomSolicitudImg} onChange={(v) => patch("potenciaNomSolicitudImg", v)} />
        <Text label="Corriente Nominal (A)" value={form.intensidadNomSolicitudImg} onChange={(v) => patch("intensidadNomSolicitudImg", v)} />
        <Checkbox label="Tensión 230V" checked={form.tension230} onChange={(v) => patch("tension230", v)} />
        <Checkbox label="Tensión 400V" checked={form.tension400} onChange={(v) => patch("tension400", v)} />
        <Checkbox label="Tensión inversor 230V" checked={form.tensionNomInversor230} onChange={(v) => patch("tensionNomInversor230", v)} />
        <Checkbox label="Tensión inversor 400V" checked={form.tensionNomInversor400} onChange={(v) => patch("tensionNomInversor400", v)} />
        <Checkbox label="Fases monofásico" checked={form.fasesMono} onChange={(v) => patch("fasesMono", v)} />
        <Checkbox label="Fases trifásico" checked={form.fasesTri} onChange={(v) => patch("fasesTri", v)} />
        <Checkbox label="Tipo generador Sinc mono" checked={form.tipoGeneradorSincMono} onChange={(v) => patch("tipoGeneradorSincMono", v)} />
        <Checkbox label="Tipo generador Sinc tri" checked={form.tipoGeneradorSincTri} onChange={(v) => patch("tipoGeneradorSincTri", v)} />
        <Text label="Pot IMG (kW)" value={form.potImg} onChange={(v) => patch("potImg", v)} />
        <Text label="Pot IMG (en letras)" value={form.potImgLetras} onChange={(v) => patch("potImgLetras", v)} />
        <Text label="Pot contratada (kW)" value={form.potContratada} onChange={(v) => patch("potContratada", v)} />
        <Text label="Pot Contratada (en letras)" value={form.potContratadaLetras} onChange={(v) => patch("potContratadaLetras", v)} />
        {/* Pot_contratada_1000 = Pot_contratada × 1000. Calculado en variables.ts;
            mostramos preview read-only para que el usuario vea cuánto va al PDF. */}
        <div>
          <label className={lbl}>Potencia contratada (×1000)</label>
          <p className="text-sm text-[var(--color-text-secondary)] py-1.5 tabular-nums">
            {(() => {
              const raw = form.potContratada.trim().replace(",", ".");
              const n = Number(raw);
              return Number.isFinite(n) && raw !== "" ? `${Math.round(n * 1000)} (calculado)` : "—";
            })()}
          </p>
        </div>
        <Text label="Tarifa" value={form.tarifa} onChange={(v) => patch("tarifa", v)} />
        <Text label="Factor de potencia (fp)" value={form.fp} onChange={(v) => patch("fp", v)} />
        <Text label="Norma 1" value={form.normas1} onChange={(v) => patch("normas1", v)} />
        <Text label="Norma 2" value={form.normas2} onChange={(v) => patch("normas2", v)} />
        {/* X1-X4 son checkboxes de Jurada Técnica que dependen de la
            corriente nominal: ≤16 A → X1+X2; >16 y ≤75 A → X3+X4; >75 → nada.
            Se calculan al generar el PDF a partir de "Corriente Nominal (A)". */}
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-app)]/50 rounded p-2">
            <span className="font-mono uppercase tracking-wider text-[10px]">X1-X4</span> · se marcan automáticamente al generar el PDF según la <strong>Corriente Nominal (A)</strong>:
            ≤ 16 A → X1+X2 · &gt; 16 y ≤ 75 A → X3+X4 · &gt; 75 A → ninguno.
            {(() => {
              const raw = form.intensidadNomSolicitudImg.trim().replace(",", ".");
              const n = Number(raw);
              if (!Number.isFinite(n) || raw === "") {
                return <span className="ml-1 text-[var(--color-warning-text)]"> (sin corriente cargada — no se marca ninguno).</span>;
              }
              if (n <= 16) return <span className="ml-1 text-emerald-400"> Con {n} A → se marcarán X1 y X2.</span>;
              if (n <= 75) return <span className="ml-1 text-emerald-400"> Con {n} A → se marcarán X3 y X4.</span>;
              return <span className="ml-1 text-[var(--color-text-muted)]"> Con {n} A → no se marca ninguno.</span>;
            })()}
          </p>
        </div>
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

      {/* Botones de la config */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={saveMut.isPending}
          title="Vuelve a los valores cargados al entrar a la página"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-secondary)] disabled:opacity-60"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Resetear datos
        </button>
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

