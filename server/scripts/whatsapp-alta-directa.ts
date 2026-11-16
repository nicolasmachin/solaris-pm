/**
 * Alta de un número de WhatsApp con el token del usuario del sistema de Voltia
 * (WHATSAPP_TOKEN), sin el registro integrado.
 *
 * Para qué: Meta no deja que el portafolio dueño de la app "Voltia PM" termine el
 * registro integrado con su propia app (error 1690130, "no es un identificador
 * del negocio válido"). El número igual queda conectado en coexistencia dentro
 * del portafolio Voltia; como es nuestro, se usa con el token del usuario del
 * sistema, que tiene que tener asignada esa cuenta de WhatsApp (Configuración del
 * negocio → Usuarios del sistema → voltia-pm → Asignar activos).
 *
 * Uso (en el servidor de producción):
 *   docker compose -f docker-compose.prod.yml exec server npx tsx scripts/whatsapp-alta-directa.ts \
 *     --business <id del portafolio> --telefono 59892369535 --responsable july@voltia.com.uy --uso VENTAS \
 *     --por nicolas@voltia.com.uy [--aplicar]
 *
 * Sin --aplicar solo muestra qué número encontró y qué guardaría.
 * Con --aplicar lo guarda, suscribe la app a la cuenta y pide contactos e
 * historial (Meta lo permite una sola vez y dentro de las 24 h de conectar).
 */

import { prisma } from "../src/lib/prisma.js";
import { graphUrl, whatsappConfig } from "../src/services/whatsapp-cloud/config.js";
import { registrarNumero } from "../src/services/whatsapp-cloud/numeros.service.js";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(graphUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`${path}: ${data.error?.message ?? res.status}`);
  return data;
}

type Telefono = { id: string; display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean };

async function main() {
  const business = arg("business");
  const telefono = (arg("telefono") ?? "").replace(/\D/g, "");
  const responsableEmail = arg("responsable");
  const porEmail = arg("por");
  const uso = arg("uso") as "VENTAS" | "EXPERIENCIA_SOLAR" | undefined;
  const aplicar = process.argv.includes("--aplicar");
  if (!business || !telefono || !porEmail) {
    console.error("Faltan --business, --telefono o --por.");
    process.exit(1);
  }
  if (uso && uso !== "VENTAS" && uso !== "EXPERIENCIA_SOLAR") {
    console.error("--uso tiene que ser VENTAS o EXPERIENCIA_SOLAR.");
    process.exit(1);
  }
  const token = whatsappConfig().token;
  if (!token) {
    console.error("Falta WHATSAPP_TOKEN en el entorno.");
    process.exit(1);
  }

  const cuentas = await get<{ data?: Array<{ id: string; name?: string }> }>(
    `${business}/owned_whatsapp_business_accounts?fields=id,name&limit=100`,
    token,
  );
  let encontrado: { waba: string; tel: Telefono } | null = null;
  for (const c of cuentas.data ?? []) {
    const tels = await get<{ data?: Telefono[] }>(
      `${c.id}/phone_numbers?fields=id,display_phone_number,verified_name,is_on_biz_app`,
      token,
    );
    for (const t of tels.data ?? []) {
      console.log(`cuenta ${c.id} (${c.name ?? "sin nombre"}): ${t.display_phone_number} — app Business: ${t.is_on_biz_app === true ? "sí" : "no"}`);
      if ((t.display_phone_number ?? "").replace(/\D/g, "") === telefono) encontrado = { waba: c.id, tel: t };
    }
  }
  if (!encontrado) {
    console.error(`No encontré el ${telefono} en las cuentas del portafolio ${business}. ¿Está asignada la cuenta al usuario del sistema?`);
    process.exit(1);
  }

  const por = await prisma.user.findUnique({ where: { email: porEmail }, select: { id: true, name: true } });
  const responsable = responsableEmail
    ? await prisma.user.findUnique({ where: { email: responsableEmail }, select: { id: true, name: true } })
    : null;
  if (!por || (responsableEmail && !responsable)) {
    console.error("No encontré el usuario de --por o de --responsable.");
    process.exit(1);
  }

  console.log(
    `\nNúmero: ${encontrado.tel.display_phone_number} (id ${encontrado.tel.id}, cuenta ${encontrado.waba})` +
      `\nSigue en el celular: ${encontrado.tel.is_on_biz_app === true ? "sí" : "NO"}` +
      `\nBandeja: ${uso ?? "ninguna"} · responsable: ${responsable?.name ?? "nadie"} · lo da de alta: ${por.name}`,
  );
  if (!aplicar) {
    console.log("\nSin --aplicar: no se guardó nada.");
    return;
  }

  const n = await registrarNumero(token, {
    phoneNumberId: encontrado.tel.id,
    wabaId: encontrado.waba,
    businessId: business,
    responsableId: responsable?.id,
    uso,
    userId: por.id,
  });
  console.log(
    `\nGuardado: ${n.telefono} · coexistencia ${n.coexistencia} · contactos ${n.syncContactosId ? "pedidos" : "no"}` +
      ` · historial ${n.syncHistorialId ? "pedido" : "no"}${n.syncError ? ` · error: ${n.syncError}` : ""}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
