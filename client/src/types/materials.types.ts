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
  defaultSupplierId: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; nombre: string; orden: number; activa: boolean };
  defaultSupplier?: { id: string; nombre: string };
  _count?: { projectMaterials: number };
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  materialItemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  moneda: Moneda;
  supplierId: string | null;
  notes: string | null;
  movementId: string | null;
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
