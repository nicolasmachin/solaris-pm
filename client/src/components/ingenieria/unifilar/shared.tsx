import type { ReactNode } from "react";
import { NumberInput } from "../../ui/NumberInput";
import type {
  TipoProteccionDC,
  TipoRed,
  UnifilarFormInput,
} from "../../../api/unifilar.api";

export function klass(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const res = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export const inp =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
export const lbl =
  "block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider";

export const TIPO_RED_OPTIONS: { value: TipoRed; label: string }[] = [
  { value: "MONO_230", label: "Monofásica 230V" },
  { value: "TRI_230_SN", label: "Trifásica 230V (sin N)" },
  { value: "TRI_400_CN", label: "Trifásica 400V (con N)" },
];

export const TIPO_PROT_DC_OPTIONS: { value: TipoProteccionDC; label: string }[] = [
  { value: "TERMOMAGNETICO", label: "Termomagnético" },
  { value: "FUSIBLE", label: "Fusible" },
];

export function emptyForm(): UnifilarFormInput {
  return {
    label: "",
    tipoRed: "MONO_230",
    cantidadPaneles: 10,
    potenciaPanelW: 580,
    modeloPanel: "",
    cantidadStrings: 2,
    potenciaContratadaKw: 7.0,
    modeloInversor: "Growatt MIN 6000 TL-X",
    potenciaInversorKw: 6.0,
    tipoProteccionDc: "TERMOMAGNETICO",
    calibreProteccionDc: "25A 2P",
    termicaAcCalibre: null,
    diferencialAcCalibre: null,
    modeloMedidorMonitoreo: "",
    largoDcPanelesM: 15,
    largoDcEsLargo: false,
    largoAcInversorIcpM: 10,
    largoAcIcpTableroM: 10,
  };
}

export function fromVersionAsForm(v: {
  label: string | null;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  termicaAcCalibre: string | null;
  diferencialAcCalibre: string | null;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}): UnifilarFormInput {
  return {
    label: v.label ?? "",
    tipoRed: v.tipoRed,
    cantidadPaneles: v.cantidadPaneles,
    potenciaPanelW: v.potenciaPanelW,
    modeloPanel: v.modeloPanel ?? "",
    cantidadStrings: v.cantidadStrings,
    potenciaContratadaKw: v.potenciaContratadaKw,
    modeloInversor: v.modeloInversor,
    potenciaInversorKw: v.potenciaInversorKw,
    tipoProteccionDc: v.tipoProteccionDc,
    calibreProteccionDc: v.calibreProteccionDc,
    termicaAcCalibre: v.termicaAcCalibre,
    diferencialAcCalibre: v.diferencialAcCalibre,
    modeloMedidorMonitoreo: v.modeloMedidorMonitoreo ?? "",
    largoDcPanelesM: v.largoDcPanelesM,
    largoDcEsLargo: v.largoDcEsLargo,
    largoAcInversorIcpM: v.largoAcInversorIcpM,
    largoAcIcpTableroM: v.largoAcIcpTableroM,
  };
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className={klass(lbl, "text-[var(--color-text-secondary)]")}>{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

export function NumGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// Wrapper sobre NumberInput para enteros con min/max. Conserva la firma
// histórica para no tocar los 8 call sites del UnifilarFormModal.
export function Num({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <NumberInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={1}
        className={inp}
        ariaLabel={label}
      />
    </div>
  );
}

// Wrapper sobre NumberInput para decimales (sin clamp explícito porque las
// fuentes históricas no pasaban min/max; el server valida el rango).
export function NumF({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <NumberInput
        value={value}
        onChange={onChange}
        allowDecimals
        step={0.1}
        className={inp}
        ariaLabel={label}
      />
    </div>
  );
}
