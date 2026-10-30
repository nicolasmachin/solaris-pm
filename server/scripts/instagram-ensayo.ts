/**
 * Ensayo del asistente de Instagram contra la base de DESARROLLO, con Meta y
 * Claude de mentira: recibe mensajes y comentarios como si vinieran del
 * webhook, contesta, deriva, hace el lead magnet y el seguimiento, y muestra lo
 * que quedó en la base. No sale nada a internet. Se niega a correr en
 * producción.
 *
 *   docker compose exec -e INSTAGRAM_MODO=envio server npx tsx scripts/instagram-ensayo.ts
 */

import assert from "node:assert/strict";

import { prisma } from "../src/lib/prisma.js";
import { sembrarAutomatizaciones } from "../src/services/instagram-marketing/automatizaciones.js";
import * as comentarios from "../src/services/instagram-marketing/comentarios.js";
import * as privados from "../src/services/instagram-marketing/privados.js";
import { consultasPorDia } from "../src/services/instagram-marketing/metricas.js";

if (process.env.NODE_ENV === "production") {
  console.error("Esto es solo para desarrollo.");
  process.exit(1);
}

const PERSONA = "999000111222";
const enviados: string[] = [];
const mails: string[] = [];

function deps(respuestas: privados.ResultadoPrivado[]): privados.Deps {
  return {
    claude: async () => ({ resultado: respuestas.shift() ?? { mensajes: [] }, problema: null, costoUsd: 0.0002 }),
    enviar: async (_p, texto) => {
      enviados.push(texto);
      return `mid-${Date.now()}-${enviados.length}`;
    },
    escribiendo: async () => undefined,
    dormir: async () => undefined,
    perfil: async () => ({ username: "ensayo.persona", name: "Ana Ensayo", is_user_follow_business: false }),
    avisar: async (asunto) => {
      mails.push(asunto);
      return true;
    },
  };
}

async function limpiar() {
  await prisma.instagramConversacion.deleteMany({ where: { persona: PERSONA } });
  await prisma.instagramEvento.deleteMany({ where: { OR: [{ persona: { in: [PERSONA, "888"] } }, { comentarioId: { startsWith: "17999" } }] } });
  await prisma.instagramComentario.deleteMany({ where: { id: { startsWith: "17999" } } });
  await prisma.instagramContacto.deleteMany({ where: { OR: [{ persona: PERSONA }, { usuario: { in: ["ensayo.persona", "ensayo.comenta"] } }] } });
}

async function main() {
  await sembrarAutomatizaciones();
  await limpiar();
  const ahora = new Date();

  // 1. Un cliente escribe dos mensajes seguidos: una sola respuesta, agendada.
  for (const [i, texto] of ["Hola", "¿cuánto sale?"].entries()) {
    await privados.registrarMensaje({ mid: `ens-${i}`, de: PERSONA, para: "17841449732396009", momentoMs: ahora.getTime() - 60_000 + i, texto, adjuntos: [], esEco: false, anuncio: i === 0 });
  }
  // Meta reintenta el mismo aviso: no se duplica.
  await privados.registrarMensaje({ mid: "ens-1", de: PERSONA, para: "17841449732396009", momentoMs: ahora.getTime(), texto: "¿cuánto sale?", adjuntos: [], esEco: false, anuncio: false });
  let conv = await prisma.instagramConversacion.findUniqueOrThrow({ where: { persona: PERSONA }, include: { mensajes: true } });
  assert.equal(conv.mensajes.length, 2);
  assert.ok(conv.responderDesde, "quedó agendada la respuesta");
  assert.ok(conv.desdeAnuncio);

  // 2. Contesta con el speech en tres mensajes.
  const r1 = await privados.atender(conv.id, deps([
    { mensajes: ["¡Hola Ana! Mirá, una casa anda entre 8.000 y 15.000 dólares", "Te cuento cómo funciona…", "¿Me pasás una foto de la factura de UTE?"], derivar: false, lead: false, speech: true, temas: ["precio"], motivo: "precio" },
  ]));
  assert.equal(r1, "contestado");
  assert.equal(enviados.length, 3);
  conv = await prisma.instagramConversacion.findUniqueOrThrow({ where: { persona: PERSONA }, include: { mensajes: true } });
  assert.ok(conv.speechEn);
  assert.equal(conv.usuario, "ensayo.persona");
  assert.equal(conv.mensajes.filter((m) => m.autor === "ASISTENTE").length, 3);

  // 3. El eco de lo que mandamos no cambia nada.
  const mid = conv.mensajes.find((m) => m.autor === "ASISTENTE")!.clave;
  assert.equal(await privados.registrarMensaje({ mid, de: "17841449732396009", para: PERSONA, momentoMs: Date.now(), texto: "eco", adjuntos: [], esEco: true, anuncio: false }), null);

  // 4. Manda la factura: es lead, se deriva y se avisa a Martín.
  await privados.registrarMensaje({ mid: "ens-3", de: PERSONA, para: "17841449732396009", momentoMs: Date.now(), texto: "", adjuntos: ["image"], esEco: false, anuncio: false });
  const r2 = await privados.atender(conv.id, deps([{ mensajes: ["¡Gracias Ana! Con eso Martín te arma la propuesta"], derivar: true, lead: true, speech: false, temas: ["precio"], motivo: "mandó la factura" }]));
  assert.equal(r2, "derivado");
  assert.match(enviados[enviados.length - 1], /365 636/, "se agregó el WhatsApp");
  assert.equal(mails.length, 1);
  assert.match(mails[0], /LEAD/);

  // 5. Derivada: si vuelve a escribir, el asistente no contesta.
  await privados.registrarMensaje({ mid: "ens-4", de: PERSONA, para: "17841449732396009", momentoMs: Date.now(), texto: "gracias!", adjuntos: [], esEco: false, anuncio: false });
  assert.equal(await privados.atender(conv.id, deps([])), "derivada");

  // 6. Contacto con sus etiquetas.
  const contacto = await prisma.instagramContacto.findUniqueOrThrow({ where: { persona: PERSONA }, include: { etiquetas: true } });
  const etiquetas = contacto.etiquetas.map((e) => e.nombre).sort();
  for (const e of ["Derivado al comercial", "Escribió por privado", "Lead (mandó factura o techo)", "Speech enviado", "Tema: precio", "Vino de un anuncio"]) {
    assert.ok(etiquetas.includes(e), `falta la etiqueta ${e}`);
  }

  // 7. Lead magnet: comentario AHORRO → privado con link → respuesta pública.
  const publicas: string[] = [];
  const privadosMandados: string[] = [];
  const depsCom: comentarios.DepsComentario = {
    claude: async () => ({ resultado: { respuesta_publica: "¡Listo! Te lo mandé por privado", mensaje_privado: "Hola, acá tenés los números", avisar: false, motivo: "lead magnet" }, problema: null, costoUsd: 0.0001 }),
    publicacion: async (id) => ({ id, permalink: "https://instagram.com/p/ensayo", caption: "Obra" }),
    privado: async (_c, texto) => {
      privadosMandados.push(texto);
      return ["888", `mid-priv-${privadosMandados.length}`];
    },
    responder: async (_c, texto) => {
      publicas.push(texto);
    },
    avisar: async () => true,
  };
  const comentario = { id: "17999000001", texto: "AHORRO 🙌", deId: "555", usuario: "ensayo.comenta", mediaId: "1", parentId: "" };
  assert.equal(await comentarios.recibir(comentario), "ahorro");
  assert.equal(await comentarios.recibir(comentario), null, "Meta reintenta: no se agenda dos veces");
  assert.equal(await comentarios.recibir({ ...comentario, id: "17999000002", parentId: "17999000001" }), null, "respuesta en un hilo");
  assert.equal(await comentarios.atender(comentario.id, depsCom), "contestado");
  assert.match(privadosMandados[0], /voltia\.com\.uy\/ahorro/, "se agregó el link");
  assert.equal(publicas.length, 1);
  // La misma persona comenta otra vez: el privado no se repite.
  await comentarios.recibir({ ...comentario, id: "17999000003" });
  assert.equal(await comentarios.atender("17999000003", depsCom), "contestado");
  assert.equal(privadosMandados.length, 1, "no se manda dos veces el privado");
  const convMagnet = await prisma.instagramConversacion.findUnique({ where: { persona: "888" }, include: { mensajes: true } });
  assert.ok(convMagnet && Array.isArray(convMagnet.origenes) && convMagnet.origenes.length === 1, "la conversación sabe de dónde vino");
  await prisma.instagramConversacion.deleteMany({ where: { persona: "888" } });

  // 8. Métricas: hoy hay una persona, con speech, derivada y lead, y un lead magnet.
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date());
  const [dia] = await consultasPorDia(hoy, hoy);
  console.log("Consultas de hoy (incluye lo que haya en la base de desarrollo):", dia);
  assert.ok(dia.personas >= 1 && dia.speech >= 1 && dia.leads >= 1 && dia.leadMagnets >= 1);

  await limpiar();
  console.log(`Ensayo OK: ${enviados.length} privados, ${privadosMandados.length} privado de lead magnet, ${publicas.length} respuestas públicas, ${mails.length} mail.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await limpiar().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
