import { apiClient } from "./axios";

// Cotizaciones a medida (ampliaciones, cargadores, lo que se cotice a mano) y la
// lista de artículos de venta que se usan como ítems precargados.

export type CotizacionEstado = "BORRADOR" | "ENVIADA" | "ACEPTADA" | "RECHAZADA";
export type Moneda = "USD" | "UYU";

export type Renglon =
  | {
      tipo: "item";
      descripcion: string;
      detalle?: string | null;
      cantidad: number;
      unidad?: string | null;
      precioUnitario: number;
      articuloId?: string | null;
    }
  | { tipo: "seccion"; descripcion: string };

export type ContenidoCotizacion = {
  clienteNombre: string;
  clienteDireccion?: string | null;
  clienteCiudad?: string | null;
  clienteTelefono?: string | null;
  clienteEmail?: string | null;
  fecha: string;
  validaHasta: string;
  moneda: Moneda;
  vendedorId?: string | null;
  formaTrabajo?: string | null;
  alcanceTitulo?: string | null;
  alcanceTexto?: string | null;
  items: Renglon[];
  ivaTasa: number;
  condicionesPago?: string | null;
  plazoEntrega?: string | null;
  incluye?: string | null;
  noIncluye?: string | null;
  observaciones?: string | null;
};

export type DestinoCotizacion = {
  leadId?: string | null;
  contactoId?: string | null;
  empresaId?: string | null;
  projectId?: string | null;
  clienteNuevo?: { nombre: string; telefono?: string | null; email?: string | null } | null;
};

type Vinculos = {
  lead: { id: string; code: string | null; clientName: string } | null;
  contacto: { id: string; nombre: string } | null;
  empresa: { id: string; razonSocial: string } | null;
  project: { id: string; code: string; clientName: string } | null;
  vendedor: { id: string; name: string } | null;
};

export type CotizacionFila = Vinculos & {
  id: string;
  numero: string;
  estado: CotizacionEstado;
  clienteNombre: string;
  fecha: string;
  validaHasta: string;
  moneda: Moneda;
  total: string;
  primerItem: string | null;
  leadId: string | null;
  contactoId: string | null;
  empresaId: string | null;
  projectId: string | null;
  createdAt: string;
};

export type CotizacionFicha = CotizacionFila & { contenido: ContenidoCotizacion };

export type Destinatario = {
  tipo: "lead" | "contacto" | "empresa" | "proyecto";
  id: string;
  titulo: string;
  subtitulo: string | null;
  vinculo: { leadId?: string; contactoId?: string; empresaId?: string; projectId?: string };
  cliente: { nombre: string; direccion: string | null; ciudad: string | null; telefono: string | null; email: string | null };
};

export type ArticuloVenta = {
  id: string;
  nombre: string;
  detalle: string | null;
  unidad: string;
  precio: string;
  moneda: Moneda;
  activo: boolean;
};

export type DatosArticulo = { nombre: string; detalle?: string | null; unidad: string; precio: number; moneda: Moneda; activo?: boolean };

export const ESTADO_LABEL: Record<CotizacionEstado, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
};

export const getCotizaciones = (p: { q?: string; estado?: CotizacionEstado }) =>
  apiClient.get<CotizacionFila[]>("/api/cotizaciones", { params: p }).then((r) => r.data);
export const getCotizacion = (id: string) => apiClient.get<CotizacionFicha>(`/api/cotizaciones/${id}`).then((r) => r.data);
export const buscarDestinatarios = (q: string) =>
  apiClient.get<Destinatario[]>("/api/cotizaciones/destinatarios", { params: { q } }).then((r) => r.data);
export const crearCotizacion = (d: ContenidoCotizacion & DestinoCotizacion) =>
  apiClient.post<CotizacionFila>("/api/cotizaciones", d).then((r) => r.data);
export const editarCotizacion = (id: string, d: ContenidoCotizacion & DestinoCotizacion) =>
  apiClient.put<CotizacionFila>(`/api/cotizaciones/${id}`, d).then((r) => r.data);
export const cambiarEstadoCotizacion = (id: string, estado: CotizacionEstado) =>
  apiClient.patch(`/api/cotizaciones/${id}/estado`, { estado }).then((r) => r.data);
export const duplicarCotizacion = (id: string) => apiClient.post<CotizacionFila>(`/api/cotizaciones/${id}/duplicar`).then((r) => r.data);
export const borrarCotizacion = (id: string) => apiClient.delete(`/api/cotizaciones/${id}`);

/** PDF de lo que está en pantalla, sin guardar. */
export const vistaPreviaCotizacion = (d: ContenidoCotizacion & { numero?: string | null }) =>
  apiClient.post<Blob>("/api/cotizaciones/vista-previa", d, { responseType: "blob" }).then((r) => r.data);
/** PDF de una cotización guardada (para bajarlo). */
export const pdfCotizacion = (id: string) =>
  apiClient.get<Blob>(`/api/cotizaciones/${id}/pdf`, { params: { download: 1 }, responseType: "blob" }).then((r) => r.data);

export const getArticulosVenta = (todos = false) =>
  apiClient.get<ArticuloVenta[]>("/api/articulos-venta", { params: todos ? { todos: "true" } : {} }).then((r) => r.data);
export const crearArticuloVenta = (d: DatosArticulo) => apiClient.post<ArticuloVenta>("/api/articulos-venta", d).then((r) => r.data);
export const editarArticuloVenta = (id: string, d: DatosArticulo) =>
  apiClient.put<ArticuloVenta>(`/api/articulos-venta/${id}`, d).then((r) => r.data);
