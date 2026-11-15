import {
  asociarLeadVentas,
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
 * propia; con él, gerencia mirando la de otro (el servidor la da solo para leer).
 */
export function bandejaVentas(asesor: string | null): BandejaApi {
  return {
    clave: `whatsapp-ventas-${asesor ?? "propia"}`,
    getBandeja: () => getBandejaVentas(asesor),
    getConversacion: (telefono) => getConversacionVentas(telefono, asesor),
    marcarLeida: marcarLeidaVentas,
    marcarResuelta: marcarResueltaVentas,
    asociarCliente: asociarLeadVentas,
    enviar: enviarWhatsAppVentas,
    getPlantillas: () => getPlantillasVentas(asesor),
    buscarParaAsociar: async (q) => {
      const { data } = await getLeadsFlat({ q: q || undefined, limit: 8, sortBy: "leadCreatedAt", sortOrder: "desc" });
      return data.map((l) => ({ id: l.id, nombre: l.clientName, detalle: l.code }));
    },
    queEsCliente: "lead",
    enlaceCliente: (c) => `/ventas?lead=${c.leadId}`,
    compartida: false,
    alMandar: (c, qc) => {
      qc.invalidateQueries({ queryKey: ["lead-detail", c.leadId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-lead", c.leadId] });
    },
  };
}
