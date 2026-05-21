// Construye el objeto plano UteVariables — exactamente las mismas keys que
// usaba el script Python (con tilde donde corresponde, case mixto). Mantenerlo
// idéntico al .txt original simplifica el portado y futuras actualizaciones
// del template UTE.

import type { Project, SolarSystem, UteDocumentConfig } from "@prisma/client";

const MES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function fmtNum(d: Date): { dia: string; mesNombre: string; mesNum: string; anio: string; anioCorto: string } {
  const dia = String(d.getUTCDate());
  const mesIdx = d.getUTCMonth();
  const mesNombre = MES_ES[mesIdx] ?? "";
  const mesNum = String(mesIdx + 1);
  const anio = String(d.getUTCFullYear());
  const anioCorto = anio.slice(-2);
  return { dia, mesNombre, mesNum, anio, anioCorto };
}

// Todos los campos boolean del form UTE se resuelven a "X" o "" — porque
// las plantillas UTE tienen un checkbox físico (☐) en cada posición y el
// usuario lo "marca" con una X. NO se completa con texto descriptivo
// ("230V" / "Monofásico" / etc.) — eso ya viene impreso al lado del checkbox
// en el PDF original.
function bool(value: boolean): string {
  return value ? "X" : "";
}

function dec(d: { toString(): string } | null | undefined): string {
  if (d == null) return "";
  return String(d);
}

export type UteVariables = {
  // ─ Cliente ─
  Cliente: string;
  CI_cliente: string;
  Mail_cliente: string;
  Telefono_cliente: string;
  Dir_cliente: string;
  Calle: string;
  Num_calle: string;
  Ciudad: string;
  Depto: string;
  Cuenta: string;
  Caso: string;
  Persona_Fisica: string;
  Empresa: string;
  // ─ Representante del cliente ─
  Representa: string;
  CI_Repre: string;
  Calidad_Repre: string;
  // ─ Sistema (SolarSystem + extras de UteDocumentConfig) ─
  Cantidad_paneles: string;
  Cantidad_inversores: string;
  Pot_tot_paneles: string;
  Area_paneles: string;
  Marca_panel: string;
  Modelo_panel: string;
  Serie_panel: string;
  Pot_panel: string;
  Marca_inversor: string;
  Modelo_inversor: string;
  Serie_inversor: string;
  Potencia_nom_inversor: string;
  // ─ Voltia / técnico / UTE ─
  FI: string;
  RUT: string;
  Dir_FI: string;
  TI: string;
  CI_TI: string;
  Oficina: string;
  Rep_UTE: string;
  Calidad_UTE: string;
  AS: string;
  PS: string;
  X: string;
  // ─ Datos técnicos UTE-específicos ─
  Potencia_nom_solicitud_IMG: string;
  Intensidad_nom_solicitud_IMG: string;
  Tension_230: string;
  Tension_400: string;
  Tension_nom_inversor_230: string;
  Tension_nom_inversor_400: string;
  Fases_mono: string;
  Fases_tri: string;
  Tipo_generador_Sinc_mono: string;
  Tipo_generador_Sinc_tri: string;
  Pot_IMG: string;
  Pot_IMG_letras: string;
  Pot_contratada: string;
  Pot_contratada_letras: string;
  Pot_contratada_1000: string;
  Tarifa: string;
  fp: string;
  normas1: string;
  normas2: string;
  x1: string;
  x2: string;
  x3: string;
  x4: string;
  // ─ Derivados de fechas ─
  Dia1: string;
  Mes2: string;
  Mes1: string;
  Año1: string;
  Año1_corto: string;
  Dia_fin: string;
  Mes_fin: string;
  Año_fin: string;
};

export function buildVariables(args: {
  project: Project;
  config: UteDocumentConfig;
  primarySolar: SolarSystem | null;
}): UteVariables {
  const { project, config, primarySolar } = args;

  const emptyFecha = { dia: "", mesNombre: "", mesNum: "", anio: "", anioCorto: "" };
  const fechaDoc = config.fechaDoc ? fmtNum(config.fechaDoc) : emptyFecha;
  const fechaFin = config.fechaFin ? fmtNum(config.fechaFin) : emptyFecha;

  // Pot total paneles: si tenemos qty + W, calculamos en W; si no, queda vacío.
  let potTotPanelesStr = "";
  if (primarySolar?.panelQuantity && primarySolar?.panelPowerW) {
    const totalW = primarySolar.panelQuantity * primarySolar.panelPowerW;
    potTotPanelesStr = String(totalW);
  }

  return {
    // Cliente — los datos generales viven en Project. Solo cuenta/caso UTE
    // siguen en config porque son por-expediente.
    // El campo "Cliente" en los PDFs UTE viene EXCLUSIVAMENTE de
    // nombreCliente (extraído de cédula). NO se mezcla con clientName
    // (título del proyecto). Si está vacío, queda vacío en el PDF —
    // el usuario tiene que cargarlo manualmente o subiendo la cédula.
    Cliente: project.nombreCliente ?? "",
    CI_cliente: project.ciCliente,
    Mail_cliente: project.clientEmail ?? "",
    Telefono_cliente: project.clientPhone ?? "",
    Dir_cliente: project.clientAddress ?? "",
    Calle: project.calle,
    Num_calle: project.numCalle,
    Ciudad: project.locationCity ?? "",
    Depto: project.locationProvince ?? "",
    Cuenta: config.cuentaUte,
    Caso: config.casoUte,
    Persona_Fisica: bool(project.personaFisica),
    Empresa: bool(project.empresa),
    // Representante — por defecto es el propio cliente (nombreCliente /
    // ciCliente). En el form se precarga así y queda editable para
    // apoderados distintos del titular. Si la config tiene valor, lo
    // usamos; si no, caemos al cliente como safety net.
    Representa: config.representa?.trim() ? config.representa : project.nombreCliente,
    CI_Repre: config.ciRepre?.trim() ? config.ciRepre : project.ciCliente,
    Calidad_Repre: config.calidadRepre,
    // Sistema
    Cantidad_paneles: primarySolar?.panelQuantity ? String(primarySolar.panelQuantity) : "",
    Cantidad_inversores: primarySolar?.inverterQuantity ? String(primarySolar.inverterQuantity) : "",
    Pot_tot_paneles: potTotPanelesStr,
    // Área = 2.5 m² × cantidad de paneles (heurística estándar para paneles
    // residenciales). Se ignora cualquier valor manual en config.areaPaneles.
    Area_paneles: primarySolar?.panelQuantity
      ? String(Math.round(primarySolar.panelQuantity * 2.5))
      : "",
    Marca_panel: primarySolar?.panelBrand ?? "",
    Modelo_panel: primarySolar?.panelModel ?? "",
    Serie_panel: config.seriePanel,
    Pot_panel: primarySolar?.panelPowerW ? String(primarySolar.panelPowerW) : "",
    Marca_inversor: primarySolar?.inverterBrand ?? "",
    Modelo_inversor: primarySolar?.inverterModel ?? "",
    Serie_inversor: config.serieInversor,
    // SolarSystem guarda inverterPowerKw en kW; el PDF de UTE pide la
    // potencia nominal del inversor en W (ej. "6000"). Multiplicamos.
    // Si la Pot IMG (kW × 1000 = W) es menor que la Pot del inversor,
    // agregamos "(limitado a NNNN)" — refleja que la instalación está
    // capada al valor declarado a UTE aunque el inversor pueda más.
    Potencia_nom_inversor: (() => {
      const invW = primarySolar?.inverterPowerKw
        ? Math.round(Number(primarySolar.inverterPowerKw) * 1000)
        : null;
      if (invW == null) return "";
      const potImgKw = Number((config.potImg ?? "").trim().replace(",", "."));
      const potImgW = Number.isFinite(potImgKw) && potImgKw > 0
        ? Math.round(potImgKw * 1000)
        : null;
      if (potImgW != null && potImgW < invW) {
        return `${invW} (limitado a ${potImgW})`;
      }
      return String(invW);
    })(),
    // Voltia / técnico / UTE
    FI: config.fi,
    RUT: config.rut,
    Dir_FI: config.dirFi,
    TI: config.ti,
    CI_TI: config.ciTi,
    Oficina: config.oficina,
    Rep_UTE: config.repUte,
    Calidad_UTE: config.calidadUte,
    AS: config.asUte,
    PS: config.ps,
    X: config.x,
    // Técnicos UTE
    // Pot nominal IMG (W) = Pot IMG (kW) × 1000. El usuario carga solo kW;
    // los W se derivan acá. Se ignora cualquier valor manual previo en
    // config.potenciaNomSolicitudImg.
    Potencia_nom_solicitud_IMG: (() => {
      const raw = (config.potImg ?? "").trim().replace(",", ".");
      const n = Number(raw);
      return Number.isFinite(n) && raw !== "" ? String(Math.round(n * 1000)) : "";
    })(),
    // Intensidad nominal calculada según fases + tensión:
    //   Monofásico            → I = P / 230
    //   Trifásico (230 V)     → I = P / (230 × √3)
    //   Trifásico (400 V)     → I = P / (400 × √3)
    // Se ignora cualquier valor manual guardado en config.intensidadNomSolicitudImg.
    Intensidad_nom_solicitud_IMG: (() => {
      // P (W) = potImg (kW) × 1000.
      const raw = (config.potImg ?? "").trim().replace(",", ".");
      const pKw = Number(raw);
      const p = Number.isFinite(pKw) && raw !== "" ? pKw * 1000 : NaN;
      if (!Number.isFinite(p) || p <= 0) return "";
      const SQRT3 = Math.sqrt(3);
      let i: number;
      if (config.fasesMono) {
        i = p / 230;
      } else if (config.fasesTri && config.tension400) {
        i = p / (400 * SQRT3);
      } else if (config.fasesTri && config.tension230) {
        i = p / (230 * SQRT3);
      } else {
        // Fallback razonable: monofásico 230 V.
        i = p / 230;
      }
      // Redondear al entero más cercano.
      return String(Math.round(i));
    })(),
    Tension_230: bool(config.tension230),
    Tension_400: bool(config.tension400),
    Tension_nom_inversor_230: bool(config.tensionNomInversor230),
    Tension_nom_inversor_400: bool(config.tensionNomInversor400),
    Fases_mono: bool(config.fasesMono),
    Fases_tri: bool(config.fasesTri),
    Tipo_generador_Sinc_mono: bool(config.tipoGeneradorSincMono),
    Tipo_generador_Sinc_tri: bool(config.tipoGeneradorSincTri),
    Pot_IMG: config.potImg,
    Pot_IMG_letras: config.potImgLetras,
    Pot_contratada: config.potContratada,
    Pot_contratada_letras: config.potContratadaLetras,
    // Pot_contratada_1000 = Pot_contratada × 1000 (kW → W). Si el usuario
    // dejó algo escrito en config.potContratada1000 (datos viejos), lo
    // ignoramos y usamos siempre el cálculo a partir de potContratada.
    // Acepta "5.5" o "5,5" como separador decimal.
    Pot_contratada_1000: (() => {
      const raw = (config.potContratada ?? "").trim().replace(",", ".");
      const n = Number(raw);
      return Number.isFinite(n) && raw !== "" ? String(Math.round(n * 1000)) : "";
    })(),
    Tarifa: config.tarifa,
    fp: config.fp,
    normas1: config.normas1,
    normas2: config.normas2,
    // x1-x4 son checkboxes en el doc Jurada Técnica que dependen del rango
    // de la corriente nominal CALCULADA (P / 230 mono ó P/(V·√3) tri):
    //   ≤ 16 A             → x1, x2 marcados (≈ "circuito clase A")
    //   > 16 A, ≤ 75 A     → x3, x4 marcados
    //   > 75 A             → ninguno marcado
    ...(() => {
      const raw = (config.potImg ?? "").trim().replace(",", ".");
      const pKw = Number(raw);
      const p = Number.isFinite(pKw) && raw !== "" ? pKw * 1000 : NaN;
      if (!Number.isFinite(p) || p <= 0) {
        return { x1: "", x2: "", x3: "", x4: "" };
      }
      const SQRT3 = Math.sqrt(3);
      const i = config.fasesMono
        ? p / 230
        : config.fasesTri && config.tension400
          ? p / (400 * SQRT3)
          : config.fasesTri && config.tension230
            ? p / (230 * SQRT3)
            : p / 230;
      const rounded = Math.round(i);
      if (rounded <= 16) return { x1: "X", x2: "X", x3: "", x4: "" };
      if (rounded <= 75) return { x1: "", x2: "", x3: "X", x4: "X" };
      return { x1: "", x2: "", x3: "", x4: "" };
    })(),
    // Derivados
    Dia1: fechaDoc.dia,
    Mes2: fechaDoc.mesNombre,
    Mes1: fechaDoc.mesNum,
    Año1: fechaDoc.anio,
    Año1_corto: fechaDoc.anioCorto,
    Dia_fin: fechaFin.dia,
    Mes_fin: fechaFin.mesNombre,
    Año_fin: fechaFin.anio,
  };
}
