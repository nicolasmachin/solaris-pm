// Tipos del generador de contrato (mirror del backend contract.schema.ts).

export interface ContractData {
  cliente: {
    nombre: string;
    documento: string;
  };
  instalacion: {
    direccion: string;
    ciudad: string;
    departamento: string;
  };
  sistema: {
    cantidadPaneles: number;
    potenciaUnitariaWp: number;
    potenciaTotalKwp: number;
    marcaPaneles: string;
    cantidadInversores: number;
    potenciaInversorKw: number;
    marcaInversor: string;
    tipoTecho: string;
    generacionAnualKwh: number;
  };
  comercial: {
    precioTotalUsd: number;
  };
  contrato: {
    lugar: string;
    fecha: string;
    fechaInicioObra: string;
  };
  notas: string;
}

// Precarga desde el backend (parcial): cada sección puede venir incompleta.
export interface ContractContext {
  cliente?: Partial<ContractData["cliente"]>;
  instalacion?: Partial<ContractData["instalacion"]>;
  sistema?: Partial<ContractData["sistema"]>;
  comercial?: Partial<ContractData["comercial"]>;
}

export interface ContractDraftResponse {
  id: string;
  projectId: string;
  data: Partial<ContractData>;
  createdAt: string;
  updatedAt: string;
}

export type ContractVersionStatus = "PUBLISHED" | "DISCARDED";

export interface ContractVersionListItem {
  id: string;
  projectId: string;
  versionNumber: number;
  status: ContractVersionStatus;
  publishedAt: string;
  publishedById: string;
  clientName: string | null;
}
