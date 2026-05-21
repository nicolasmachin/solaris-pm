import twilio from "twilio";
import { prisma } from "../lib/prisma.js";

/**
 * Servicio de envío de WhatsApp.
 *
 * GUARDRAIL DE SEGURIDAD (espejo del de email.service.ts):
 * Por defecto, sendWhatsApp() solo permite enviar a teléfonos que existan
 * en la tabla `users` (usuarios internos de Voltia). Para enviar a
 * destinatarios externos hay que pasar explícitamente
 * `type: 'client_facing'`.
 *
 * El mismo incidente de mayo 2026 que dejó la info interna del proyecto
 * llegando al email del cliente también disparaba WhatsApps al teléfono
 * del cliente vía `Project.notificationPhone`. Este guardrail evita que
 * un cambio futuro vuelva a re-conectar el envío automático al teléfono
 * del cliente.
 *
 * Nota: `User.phone` no es único en el schema. La comparación se hace
 * por igualdad simple; cualquier teléfono cargado en `users` cuenta como
 * interno. Si un cliente comparte teléfono con un usuario interno (caso
 * teórico) el guardrail no lo bloquea, pero el caso es prácticamente
 * inexistente en la operación real.
 */

export type WhatsAppType = "internal" | "client_facing";

interface SendWhatsAppParams {
  to: string;
  message: string;
  type?: WhatsAppType;
}

function normalizePhone(raw: string): string {
  return raw.replace(/^whatsapp:/, "").replace(/^\+/, "").replace(/\s+/g, "");
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<boolean> {
  const { to, type = "internal" } = params;

  if (type === "internal") {
    const target = normalizePhone(to);
    const users = await prisma.user.findMany({
      where: { deletedAt: null, phone: { not: null } },
      select: { phone: true },
    });
    const matches = users.some(
      (u) => u.phone && normalizePhone(u.phone) === target,
    );

    if (!matches) {
      console.error(
        `[whatsapp] BLOQUEADO: ${to} no coincide con ningún teléfono ` +
          `de la tabla users. Para enviar a externos usar type: 'client_facing' explícitamente.`,
      );
      return false;
    }
  } else {
    console.log(`[whatsapp] Envío client_facing a ${to}`);
  }

  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.warn("[whatsapp] Twilio no configurado, omitiendo envío");
    return false;
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "";
    const formatted = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:+${params.to.replace(/^\+/, "")}`;

    await client.messages.create({
      from,
      to: formatted,
      body: params.message,
    });

    console.log(`[whatsapp] Enviado a ${params.to}`);
    return true;
  } catch (err) {
    console.error(`[whatsapp] Error enviando a ${params.to}:`, err);
    return false;
  }
}
