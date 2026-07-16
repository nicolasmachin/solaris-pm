import type { Moneda } from './finance.types';

export interface MaterialCategory {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export interface MaterialItem {
  id: string;
  categoryId: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  precioSugerido: number | null;
  moneda: Moneda;
  ivaTasa: number;
  defaultSupplierId: string | null;
  activo: boolean;
  gestionaStock: boolean;
  stockActual: number;
  stockMinimo: number | null;
  ubicacionDeposito: string | null;
  bajoMinimo: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; nombre: string; orden: number; activa: boolean };
  defaultSupplier?: { id: string; nombre: string };
  _count?: { projectMaterials: number };
}

export type MaterialStatus = 'PENDIENTE' | 'PEDIDO' | 'RECIBIDO' | 'EN_STOCK';
export type MaterialRowColor = 'yellow' | 'green' | 'blue' | 'purple' | 'red' | 'gray';
export const MATERIAL_ROW_COLORS: ReadonlyArray<MaterialRowColor> = [
  'yellow', 'green', 'blue', 'purple', 'red', 'gray',
];
export const MATERIAL_STATUSES: ReadonlyArray<MaterialStatus> = [
  'PENDIENTE', 'PEDIDO', 'RECIBIDO', 'EN_STOCK',
];

// ─── Plantillas de lista de materiales ───────────────────────────────────────

export type PhaseType = 'MONOFASICO' | 'TRIFASICO_230' | 'TRIFASICO_400';
export const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  MONOFASICO: 'Monofásico',
  TRIFASICO_230: 'Trifásico 230',
  TRIFASICO_400: 'Trifásico 400',
};

export interface MaterialTemplateItem {
  id: string;
  materialItemId: string;
  quantity: number;
  orden: number;
  materialItem?: {
    id: string;
    nombre: string;
    unidad: string;
    activo: boolean;
    category: { id: string; nombre: string; orden: number };
  };
}

export interface MaterialTemplate {
  id: string;
  nombre: string;
  descripcion: string | null;
  phaseType: PhaseType | null;
  orden: number;
  activa: boolean;
  itemCount: number;
  items: MaterialTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  materialItemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  moneda: Moneda;
  ivaTasa: number;
  supplierId: string | null;
  notes: string | null;
  movementId: string | null;
  status: MaterialStatus;
  crossed: boolean;
  rowColor: MaterialRowColor | null;
  addedBy: { id: string; name: string } | null;
  lastEditedAt: string | null;
  lastEditedBy: { id: string; name: string } | null;
  lastEditedRole: string | null;
  createdAt: string;
  updatedAt: string;
  materialItem?: {
    id: string;
    nombre: string;
    unidad: string;
    categoryId: string;
    category: { id: string; nombre: string; orden: number };
  };
  supplier?: { id: string; nombre: string };
  movement?: { id: string; status: string; descripcion: string };
}
