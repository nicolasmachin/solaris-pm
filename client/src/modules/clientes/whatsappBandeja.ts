import {
  asociarClienteES,
  enviarWhatsAppES,
  getBandejaES,
  getConversacionES,
  getPlantillasES,
  marcarLeidaES,
  marcarResueltaES,
} from "../../api/whatsapp.api";
import { getClientes } from "../../api/clientes.api";
import type { BandejaApi } from "../../components/whatsapp/BandejaWhatsApp";

let cache: { en: number; datos: ReturnType<typeof getClientes> } | null = null;
function clientesRecientes() {
  if (!cache || Date.now() - cache.en > 60_000) cache = { en: Date.now(), datos: getClientes({}, 1, 200) };
  return cache.datos;
}

/** La bandeja del número general de WhatsApp, la de Experiencia Solar. */
export const BANDEJA_ES: BandejaApi = {
  clave: "whatsapp-es",
  getBandeja: getBandejaES,
  getConversacion: getConversacionES,
  marcarLeida: marcarLeidaES,
  marcarResuelta: marcarResueltaES,
  asociarCliente: asociarClienteES,
  enviar: enviarWhatsAppES,
  getPlantillas: getPlantillasES,
  // Los clientes son pocos: se traen una vez por minuto y se filtran acá.
  buscarParaAsociar: async (q) => {
    const { items } = await clientesRecientes();
    return items
      .filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.telefono ?? "").includes(q))
      .map((c) => ({ id: c.projectId, nombre: c.nombre, detalle: c.telefono }));
  },
  queEsCliente: "cliente",
  enlaceCliente: (c) => `/clientes/${c.projectId}`,
  compartida: true,
  alMandar: (c, qc) => {
    qc.invalidateQueries({ queryKey: ["cliente", c.projectId] });
    qc.invalidateQueries({ queryKey: ["cliente-timeline", c.projectId] });
    qc.invalidateQueries({ queryKey: ["clientes"] });
  },
};
