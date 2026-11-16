import {
  asociarLeadVentas,
  urlArchivoVentas,
  enviarArchivoVentas,
  enviarWhatsAppVentas,
  getBandejaVentas,
  getConversacionVentas,
  getPlantillasVentas,
  marcarLeidaVentas,
  marcarResueltaVentas,
} from "../../api/whatsapp.api";
import { getLeadsFlat } from "../../api/leads.api";
import type { BandejaApi } from "../whatsapp/BandejaWhatsApp";

/**
 * La bandeja de WhatsApp de Ventas: el número del asesor. Sin `asesor`, la
 * propia; con él, el admin usando la de otro.
 */
export function bandejaVentas(asesor: string | null): BandejaApi {
  return {
    clave: `whatsapp-ventas-${asesor ?? "propia"}`,
    getBandeja: () => getBandejaVentas(asesor),
    getConversacion: (telefono) => getConversacionVentas(telefono, asesor),
    marcarLeida: (telefono) => marcarLeidaVentas(telefono, asesor),
    marcarResuelta: (telefono) => marcarResueltaVentas(telefono, asesor),
    asociarCliente: (telefono, id) => asociarLeadVentas(telefono, id, asesor),
    enviar: (body) => enviarWhatsAppVentas(body, asesor),
    getPlantillas: () => getPlantillasVentas(asesor),
    urlArchivo: (id) => urlArchivoVentas(id, asesor),
    enviarArchivo: (d) => enviarArchivoVentas(d, asesor),
    buscarParaAsociar: async (q) => {
      const { data } = await getLeadsFlat({ q: q || undefined, limit: 8, sortBy: "leadCreatedAt", sortOrder: "desc" });
      return data.map((l) => ({ id: l.id, nombre: l.clientName, detalle: l.code }));
    },
    queEsCliente: "lead",
    enlaceCliente: (c) => `/ventas?lead=${c.leadId}`,
    alMandar: (c, qc) => {
      qc.invalidateQueries({ queryKey: ["lead-detail", c.leadId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-lead", c.leadId] });
    },
  };
}
