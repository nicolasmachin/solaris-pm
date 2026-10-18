/**
 * Suscribe la aplicación "Voltia PM" de Meta a la cuenta de WhatsApp (WABA),
 * para que Meta mande los mensajes y estados al webhook. Se corre una vez por
 * cuenta, después de guardar el webhook en developers.facebook.com.
 *
 * Uso (en el servidor de producción, con las variables cargadas):
 *   docker compose -f docker-compose.prod.yml exec server npx tsx scripts/whatsapp-suscribir-app.ts
 *   docker compose -f docker-compose.prod.yml exec server npx tsx scripts/whatsapp-suscribir-app.ts --ver
 *
 * Sin --ver suscribe; con --ver solo lista las aplicaciones suscriptas.
 */

import { graphUrl, whatsappConfig } from "../src/services/whatsapp-cloud/config.js";

async function main() {
  const c = whatsappConfig();
  if (!c.token || !c.wabaId) {
    console.error("Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en el entorno.");
    process.exit(1);
  }
  const soloVer = process.argv.includes("--ver");
  const res = await fetch(graphUrl(`${c.wabaId}/subscribed_apps`, c), {
    method: soloVer ? "GET" : "POST",
    headers: { Authorization: `Bearer ${c.token}` },
  });
  const data = await res.json();
  console.log(res.status, JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
