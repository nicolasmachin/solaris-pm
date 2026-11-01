import { useSearchParams } from "react-router-dom";

import { BandejaWhatsApp } from "../../../components/whatsapp/BandejaWhatsApp";
import { BANDEJA_ES } from "../whatsappBandeja";

// Experiencia Solar → WhatsApp: todas las conversaciones del número general, para
// cualquiera que entre al módulo. Desde la ficha del cliente se llega con
// ?tel=598… y se abre directo su conversación.
export function WhatsAppESPage() {
  const [params] = useSearchParams();
  return (
    <BandejaWhatsApp
      api={BANDEJA_ES}
      telefonoInicial={params.get("tel")}
      sinNumero="Todavía no hay un número de WhatsApp conectado para Experiencia Solar. Se conecta desde Administración → WhatsApp."
    />
  );
}
