// Datos guardados de un unifilar → parámetros del generador.
//
// Estaba dentro de `unifilar.routes.ts`. Vive acá porque además de la pantalla
// lo usa el conector MCP: un unifilar en PDF no tiene texto (los rótulos se
// dibujan como trazos), así que para leerlo desde el chat se vuelve a generar
// el dibujo a partir de la versión guardada.

import type { TipoProteccionDC, TipoRed } from "@prisma/client";

import type { UnifilarInputs } from "./index.js";

export function fechaTexto(d: Date): string {
  // "Mes AAAA" en español (locale UY).
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mes = meses[d.getUTCMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

export function inputsFromVersion(v: {
  snapshotCliente: string;
  snapshotUbicacion: string;
  snapshotFecha: Date;
  snapshotAutor: string;
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
  seccionDcOverride: string | null;
  seccionAcInvIcpOverride: string | null;
  seccionAcCasaOverride: string | null;
  seccionPeOverride: string | null;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}): UnifilarInputs {
  return {
    cliente: v.snapshotCliente,
    ubicacion: v.snapshotUbicacion,
    fecha: fechaTexto(v.snapshotFecha),
    autor: v.snapshotAutor,
    tipoRed: v.tipoRed,
    cantidadPaneles: v.cantidadPaneles,
    potenciaPanelW: v.potenciaPanelW,
    modeloPanel: v.modeloPanel,
    cantidadStrings: v.cantidadStrings,
    potenciaContratadaKw: v.potenciaContratadaKw,
    modeloInversor: v.modeloInversor,
    potenciaInversorKw: v.potenciaInversorKw,
    tipoProteccionDc: v.tipoProteccionDc,
    calibreProteccionDc: v.calibreProteccionDc,
    termicaAcCalibre: v.termicaAcCalibre,
    diferencialAcCalibre: v.diferencialAcCalibre,
    seccionDcOverride: v.seccionDcOverride,
    seccionAcInvIcpOverride: v.seccionAcInvIcpOverride,
    seccionAcCasaOverride: v.seccionAcCasaOverride,
    seccionPeOverride: v.seccionPeOverride,
    modeloMedidorMonitoreo: v.modeloMedidorMonitoreo,
    largoDcPanelesM: v.largoDcPanelesM,
    largoDcEsLargo: v.largoDcEsLargo,
    largoAcInversorIcpM: v.largoAcInversorIcpM,
    largoAcIcpTableroM: v.largoAcIcpTableroM,
  };
}
