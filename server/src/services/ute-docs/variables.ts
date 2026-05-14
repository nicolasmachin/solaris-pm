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

function bool(value: boolean, trueValue = "X"): string {
  return value ? trueValue : "";
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

  const fechaDoc = fmtNum(config.fechaDoc);
  const fechaFin = config.fechaFin ? fmtNum(config.fechaFin) : { dia: "", mesNombre: "", mesNum: "", anio: "", anioCorto: "" };

  // Pot total paneles: si tenemos qty + W, calculamos en W; si no, queda vacío.
  let potTotPanelesStr = "";
  if (primarySolar?.panelQuantity && primarySolar?.panelPowerW) {
    const totalW = primarySolar.panelQuantity * primarySolar.panelPowerW;
    potTotPanelesStr = String(totalW);
  }

  return {
    // Cliente
    Cliente: project.clientName ?? "",
    CI_cliente: config.ciCliente,
    Mail_cliente: project.notificationEmail ?? "",
    Telefono_cliente: project.notificationPhone ?? "",
    Dir_cliente: project.clientAddress ?? "",
    Calle: config.calle,
    Num_calle: config.numCalle,
    Ciudad: project.locationCity ?? "",
    Depto: project.locationProvince ?? "",
    Cuenta: config.cuentaUte,
    Caso: config.casoUte,
    Persona_Fisica: bool(config.personaFisica),
    Empresa: bool(config.empresa),
    // Representante
    Representa: config.representa,
    CI_Repre: config.ciRepre,
    Calidad_Repre: config.calidadRepre,
    // Sistema
    Cantidad_paneles: primarySolar?.panelQuantity ? String(primarySolar.panelQuantity) : "",
    Cantidad_inversores: primarySolar?.inverterQuantity ? String(primarySolar.inverterQuantity) : "",
    Pot_tot_paneles: potTotPanelesStr,
    Area_paneles: config.areaPaneles,
    Marca_panel: primarySolar?.panelBrand ?? "",
    Modelo_panel: primarySolar?.panelModel ?? "",
    Serie_panel: config.seriePanel,
    Pot_panel: primarySolar?.panelPowerW ? String(primarySolar.panelPowerW) : "",
    Marca_inversor: primarySolar?.inverterBrand ?? "",
    Modelo_inversor: primarySolar?.inverterModel ?? "",
    Serie_inversor: config.serieInversor,
    Potencia_nom_inversor: dec(primarySolar?.inverterPowerKw),
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
    Potencia_nom_solicitud_IMG: config.potenciaNomSolicitudImg,
    Intensidad_nom_solicitud_IMG: config.intensidadNomSolicitudImg,
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
    Pot_contratada_1000: config.potContratada1000,
    Tarifa: config.tarifa,
    fp: config.fp,
    normas1: config.normas1,
    normas2: config.normas2,
    x1: config.x1,
    x2: config.x2,
    x3: config.x3,
    x4: config.x4,
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
