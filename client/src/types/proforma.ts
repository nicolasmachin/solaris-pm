// Tipos del generador de proforma BBVA (mirror del backend proforma.schema.ts).

export interface ProformaTextos {
  tituloLinea1: string;
  tituloLinea2: string;
  headingCliente: string;
  labelNombre: string;
  labelCi: string;
  labelDireccion: string;
  labelTelefono: string;
  labelMail: string;
  labelFecha: string;
  thConcepto: string;
  thMonto: string;
  thPlazo: string;
  thTasa: string;
  bannerDescripcion: string;
  nota: string;
  firmante: string;
  cargo: string;
  footerMarca: string;
  footerRazonSocial: string;
  footerRut: string;
  footerCuentaBbva: string;
  footerTel: string;
  footerEmail: string;
  footerWeb: string;
  footerDomicilio: string;
}

export interface ProformaData {
  cliente: {
    nombre: string;
    documento: string;
    direccion: string;
    telefono: string;
    email: string;
  };
  financiacion: {
    concepto: string;
    montoSolicitadoUsd: number;
    plazoMeses: number;
    tasaUi: number;
  };
  descripcion: string;
  fecha: string;
  textos: ProformaTextos;
}

export interface ProformaContext {
  cliente?: Partial<ProformaData["cliente"]>;
  descripcion?: string;
}

export interface ProformaDraftResponse {
  id: string;
  projectId: string;
  data: Partial<ProformaData>;
  createdAt: string;
  updatedAt: string;
}

export type ProformaVersionStatus = "PUBLISHED" | "DISCARDED";

export interface ProformaVersionListItem {
  id: string;
  projectId: string;
  versionNumber: number;
  status: ProformaVersionStatus;
  publishedAt: string;
  publishedById: string;
  clientName: string | null;
}
