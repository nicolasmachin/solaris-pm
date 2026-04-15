import twilio from "twilio";

interface SendWhatsAppParams {
  to: string; // phone number with country code, without whatsapp: prefix
  message: string;
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.warn("[whatsapp] Twilio no configurado, omitiendo envío");
    return false;
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "";
    const to = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:+${params.to.replace(/^\+/, "")}`;

    await client.messages.create({
      from,
      to,
      body: params.message,
    });

    console.log(`[whatsapp] Enviado a ${params.to}`);
    return true;
  } catch (err) {
    console.error(`[whatsapp] Error enviando a ${params.to}:`, err);
    return false;
  }
}
