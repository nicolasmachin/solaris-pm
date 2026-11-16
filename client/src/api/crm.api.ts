import { apiClient } from "./axios";

// CRM de Ventas: Contactos (personas) y Empresas.

export type CrmConteo = { leads: number; projects: number };

export type CrmContacto = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  documento: string | null;
  empresas: Array<{ cargo: string | null; principal: boolean; empresa: { id: string; razonSocial: string } }>;
  _count: CrmConteo;
};

export type CrmLeadRef = { id: string; clientName: string; stage: string; createdAt: string };
export type CrmProyectoRef = { id: string; code: string; clientName: string; status: string };

export type CrmContactoFicha = CrmContacto & {
  notas: string | null;
  createdAt: string;
  leads: CrmLeadRef[];
  projects: CrmProyectoRef[];
};

export type CrmEmpresa = {
  id: string;
  razonSocial: string;
  nombreFantasia: string | null;
  rut: string | null;
  telefono: string | null;
  email: string | null;
  contactos: Array<{ cargo: string | null; principal: boolean; contacto: { id: string; nombre: string; telefono: string | null } }>;
  _count: CrmConteo;
};

export type CrmEmpresaFicha = CrmEmpresa & {
  direccion: string | null;
  notas: string | null;
  createdAt: string;
  leads: CrmLeadRef[];
  projects: CrmProyectoRef[];
};

export type DatosContacto = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
  notas?: string | null;
};

export type DatosEmpresa = {
  razonSocial: string;
  nombreFantasia?: string | null;
  rut?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

export async function getContactos(q?: string) {
  return (await apiClient.get<CrmContacto[]>("/api/crm/contactos", { params: q ? { q } : {} })).data;
}
export async function getContacto(id: string) {
  return (await apiClient.get<CrmContactoFicha>(`/api/crm/contactos/${id}`)).data;
}
export async function crearContacto(d: DatosContacto) {
  return (await apiClient.post<{ id: string }>("/api/crm/contactos", d)).data;
}
export async function editarContacto(id: string, d: Partial<DatosContacto>) {
  return (await apiClient.patch(`/api/crm/contactos/${id}`, d)).data;
}
export async function borrarContacto(id: string) {
  await apiClient.delete(`/api/crm/contactos/${id}`);
}

export async function getEmpresas(q?: string) {
  return (await apiClient.get<CrmEmpresa[]>("/api/crm/empresas", { params: q ? { q } : {} })).data;
}
export async function getEmpresa(id: string) {
  return (await apiClient.get<CrmEmpresaFicha>(`/api/crm/empresas/${id}`)).data;
}
export async function crearEmpresa(d: DatosEmpresa) {
  return (await apiClient.post<{ id: string }>("/api/crm/empresas", d)).data;
}
export async function editarEmpresa(id: string, d: Partial<DatosEmpresa>) {
  return (await apiClient.patch(`/api/crm/empresas/${id}`, d)).data;
}
export async function borrarEmpresa(id: string) {
  await apiClient.delete(`/api/crm/empresas/${id}`);
}

export async function vincularContacto(empresaId: string, contactoId: string, d: { cargo?: string | null; principal?: boolean } = {}) {
  await apiClient.put(`/api/crm/empresas/${empresaId}/contactos/${contactoId}`, d);
}
export async function desvincularContacto(empresaId: string, contactoId: string) {
  await apiClient.delete(`/api/crm/empresas/${empresaId}/contactos/${contactoId}`);
}

/** "59899123456" → "+598 99 123 456". */
export function telefonoLindo(t: string | null): string {
  if (!t) return "";
  const m = t.match(/^598(\d{2})(\d{3})(\d{3})$/);
  return m ? `+598 ${m[1]} ${m[2]} ${m[3]}` : `+${t}`;
}

/** El contacto y la empresa de un lead o un proyecto. */
export type CrmVinculo = {
  contacto: { id: string; nombre: string; telefono: string | null; email: string | null } | null;
  empresaCliente: { id: string; razonSocial: string; rut: string | null } | null;
};

export async function cambiarVinculo(
  destino: { leadId: string } | { projectId: string },
  d: { contactoId?: string | null; empresaId?: string | null },
) {
  const url = "leadId" in destino ? `/api/crm/leads/${destino.leadId}/vinculo` : `/api/crm/proyectos/${destino.projectId}/vinculo`;
  await apiClient.put(url, d);
}
