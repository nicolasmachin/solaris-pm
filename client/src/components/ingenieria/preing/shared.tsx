import type { ReactNode } from "react";
import type {
  PreIngenieriaFormInput,
  PreIngenieriaVersionFull,
  TipoTecho,
} from "../../../api/preingenieria.api";
import type { TipoRed, UnifilarVersionFull } from "../../../api/unifilar.api";

export function klass(...p: (string | false | undefined | null)[]) {
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

export const TIPO_TECHO_OPTIONS: { value: TipoTecho; label: string }[] = [
  { value: "ISOPANEL", label: "Isopanel" },
  { value: "HORMIGON", label: "Hormigón" },
  { value: "CHAPA", label: "Chapa" },
  { value: "TEJAS", label: "Tejas" },
  { value: "OTRO", label: "Otro" },
];

export function emptyForm(snapshotNombre: string): PreIngenieriaFormInput {
  return {
    label: "",
    snapshotNombre: snapshotNombre || "",
    snapshotDireccion: "",
    snapshotCiudad: "",
    snapshotCelular: "",
    snapshotFechaPrevista: "",
    tipoTecho: null,
    tipoTechoOtro: "",
    infoTecho: "",
    alturaTecho: "",
    cantidadPaneles: "",
    potenciaPaneles: null,
    inversor: "",
    stringsLineasDc: "",
    cableAc: "",
    termicaAc: "",
    diferencialAc: "",
    largoCablesAcMts: "",
    largoCablesDcMts: "",
    redMonofasica: false,
    redTrifasica230SN: false,
    redTrifasica400CN: false,
    notasAdicionales: "",
    unifilarVersionId: null,
    fotosOrden: [],
    fotosEtiquetas: {},
  };
}

/**
 * Pre-carga el formulario con los datos de una versión de pre-ingeniería
 * existente (al crear una "nueva versión", arranca con lo que tenía la
 * anterior). Copia todos los campos del formulario; NO copia las fotos
 * (son uploads por versión) ni la trazabilidad de minuta/label.
 */
export function applyPreviousVersionPrefill(
  form: PreIngenieriaFormInput,
  v: PreIngenieriaVersionFull,
): PreIngenieriaFormInput {
  return {
    ...form,
    snapshotNombre: v.snapshotNombre || form.snapshotNombre,
    snapshotDireccion: v.snapshotDireccion ?? "",
    snapshotCiudad: v.snapshotCiudad ?? "",
    snapshotCelular: v.snapshotCelular ?? "",
    snapshotFechaPrevista: v.snapshotFechaPrevista ?? "",
    tipoTecho: v.tipoTecho ?? null,
    tipoTechoOtro: v.tipoTechoOtro ?? "",
    infoTecho: v.infoTecho ?? "",
    alturaTecho: v.alturaTecho ?? "",
    cantidadPaneles: v.cantidadPaneles ?? "",
    potenciaPaneles: v.potenciaPaneles ?? null,
    inversor: v.inversor ?? "",
    stringsLineasDc: v.stringsLineasDc ?? "",
    cableAc: v.cableAc ?? "",
    termicaAc: v.termicaAc ?? "",
    diferencialAc: v.diferencialAc ?? "",
    largoCablesAcMts: v.largoCablesAcMts ?? "",
    largoCablesDcMts: v.largoCablesDcMts ?? "",
    redMonofasica: v.redMonofasica,
    redTrifasica230SN: v.redTrifasica230SN,
    redTrifasica400CN: v.redTrifasica400CN,
    notasAdicionales: v.notasAdicionales ?? "",
    unifilarVersionId: v.unifilarVersionId ?? null,
  };
}

/**
 * Mapeo unifilar → pre-ingeniería según SPEC sec. 4.1.
 * Construye texto libre listo para mostrar/editar en el form. Sigue las reglas
 * eléctricas del SPEC del unifilar para sección de cable, termomagnética y
 * diferencial.
 */
export function applyUnifilarPrefill(
  form: PreIngenieriaFormInput,
  v: UnifilarVersionFull,
): PreIngenieriaFormInput {
  const seccionMm2 = computeSeccionAcMm2(v.tipoRed, v.potenciaInversorKw);
  const polos = polosPorRed(v.tipoRed);
  const calibre = computeCalibreA(v.potenciaInversorKw, v.tipoRed);

  return {
    ...form,
    cantidadPaneles: String(v.cantidadPaneles),
    // potenciaPaneles ya es Int en el backend (Watts enteros) — pasamos el
    // entero directo sin sufijo de unidad.
    potenciaPaneles: v.potenciaPanelW,
    inversor: `${v.modeloInversor} de ${v.potenciaInversorKw}kW`,
    stringsLineasDc: String(v.cantidadStrings),
    cableAc: `Superplastico ${polos}x${seccionMm2}mm2`,
    termicaAc: `${calibre} A`,
    diferencialAc: `${calibre} A, 300mA`,
    largoCablesAcMts: `${v.largoAcInversorIcpM} mts`,
    largoCablesDcMts: `${v.largoDcPanelesM} mts`,
    redMonofasica: v.tipoRed === "MONO_230",
    redTrifasica230SN: v.tipoRed === "TRI_230_SN",
    redTrifasica400CN: v.tipoRed === "TRI_400_CN",
    unifilarVersionId: v.id,
  };
}

function polosPorRed(tipoRed: TipoRed): "2" | "3" | "4" {
  if (tipoRed === "MONO_230") return "2";
  if (tipoRed === "TRI_230_SN") return "3";
  return "4";
}

/**
 * Sección AC en mm² siguiendo la regla 4.4 del unifilar SPEC (aproximación
 * razonable: a más kW + más fases más sección). El usuario puede sobreescribir
 * el resultado en el form.
 */
function computeSeccionAcMm2(tipoRed: TipoRed, potenciaInvKw: number): number {
  if (tipoRed === "MONO_230") {
    if (potenciaInvKw <= 6) return 6;
    if (potenciaInvKw <= 8) return 10;
    return 16;
  }
  // Trifásico
  if (potenciaInvKw <= 10) return 4;
  if (potenciaInvKw <= 17) return 6;
  if (potenciaInvKw <= 25) return 10;
  return 16;
}

/**
 * Calibre de termomagnética/diferencial AC en amperes según regla 4.5 del
 * unifilar SPEC. Aproximación.
 */
function computeCalibreA(potenciaInvKw: number, tipoRed: TipoRed): number {
  const factor = tipoRed === "MONO_230" ? 230 : 400 * Math.sqrt(3);
  const I = (potenciaInvKw * 1000) / factor;
  // Redondear hacia arriba al calibre estándar más cercano
  const standards = [16, 20, 25, 32, 40, 50, 63, 80, 100];
  for (const s of standards) {
    if (s >= I * 1.25) return s;
  }
  return 100;
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className={klass(lbl, "text-[var(--color-text-secondary)]")}>{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}
