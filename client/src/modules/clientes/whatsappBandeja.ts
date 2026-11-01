import {
  asociarClienteES,
  enviarWhatsAppES,
  getBandejaES,
  getConversacionES,
  getPlantillasES,
  marcarLeidaES,
  marcarResueltaES,
} from "../../api/whatsapp.api";
import type { BandejaApi } from "../../components/whatsapp/BandejaWhatsApp";

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
};
