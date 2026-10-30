import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { comentariosDelAviso, mensajesDelAviso, textoDe } from "./aviso.js";
import { type Automatizacion, carpetaArchivos, coincide, elegirParaComentario, leerArchivo, normalizar } from "./automatizaciones.js";
import { pedido } from "./comentarios.js";
import { secretoValido } from "./conector.js";
import { conWhatsapp, escribioOtro, mensajesDe, mensajesParaClaude, pidioMasInfo, porQueNo, tocaSeguimiento } from "./privados.js";

const MIN = 60_000;
const HORA = 60 * MIN;

// ── El aviso de Meta ────────────────────────────────────────────────────────

test("el aviso: mensajes, botones, ecos, anuncios; lecturas y borrados no cuentan", () => {
  const aviso = {
    object: "instagram",
    entry: [
      {
        messaging: [
          { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 1000, message: { mid: "a", text: "Hola", referral: { ad_id: "77" } } },
          { sender: { id: "999" }, recipient: { id: "111" }, timestamp: 2000, message: { mid: "b", text: "eco", is_echo: true } },
          { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 3000, postback: { mid: "c", title: "Quiero más info" } },
          { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 4000, message: { mid: "d", attachments: [{ type: "image" }] } },
          { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 5000, message: { mid: "e", is_deleted: true } },
          { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 6000, read: { mid: "a" } },
        ],
      },
    ],
  };
  const m = mensajesDelAviso(aviso);
  assert.deepEqual(m.map((x) => x.mid), ["a", "b", "c", "d"]);
  assert.equal(m[0].anuncio, true);
  assert.equal(m[1].esEco, true);
  assert.equal(m[2].texto, "Quiero más info");
  assert.equal(textoDe(m[3]), "[Mandó: image]");
});

test("el aviso: comentarios", () => {
  const c = comentariosDelAviso({
    entry: [
      {
        changes: [
          { field: "comments", value: { id: "55", text: "AHORRO", from: { id: "1", username: "ana" }, media: { id: "9" } } },
          { field: "mentions", value: { id: "56" } },
          { field: "comments", value: { id: "57", text: "gracias", parent_id: "55", from: { id: "2", username: "b" }, media: { id: "9" } } },
        ],
      },
    ],
  });
  assert.deepEqual(c.map((x) => [x.id, x.usuario, x.mediaId, x.parentId]), [
    ["55", "ana", "9", ""],
    ["57", "b", "9", "55"],
  ]);
});

// ── Automatizaciones ────────────────────────────────────────────────────────

test("los archivos de las automatizaciones se leen todos", () => {
  const archivos = readdirSync(carpetaArchivos()).filter((a) => a.endsWith(".md"));
  const leidas = archivos.map((a) => leerArchivo(a, readFileSync(join(carpetaArchivos(), a), "utf8")));
  const ids = leidas.map((a) => a.id).sort();
  assert.deepEqual(ids, ["_comentarios", "_datos", "ahorro", "comentarios", "privados", "seguimiento"]);
  const ahorro = leidas.find((a) => a.id === "ahorro")!;
  assert.deepEqual(ahorro.palabras, ["ahorro"]);
  assert.equal(ahorro.link, "https://voltia.com.uy/ahorro");
  assert.equal(ahorro.topeDiario, 150);
  assert.equal(ahorro.esperaMinSeg, 40);
  const privados = leidas.find((a) => a.id === "privados")!;
  assert.ok(privados.flujo.includes("{DATOS}"));
  const seg = leidas.find((a) => a.id === "seguimiento")!;
  assert.deepEqual((seg.extra as { horas: number[] }).horas, [20, 23.5]);
  assert.ok(leidas.find((a) => a.id === "_comentarios")!.flujo.includes("{FLUJO}"));
});

test("un encabezado mal escrito se rechaza", () => {
  assert.throws(() => leerArchivo("x.md", "sin encabezado"), /encabezado/);
  assert.throws(() => leerArchivo("x.md", '+++\ndisparador = "otro"\n+++\nflujo'), /disparador/);
  assert.throws(() => leerArchivo("x.md", "+++\ndisparador = comentario\n+++\nflujo"), /mal escrito/);
});

test("palabras clave: sin tildes ni mayúsculas, al principio de la palabra", () => {
  assert.equal(normalizar("  AHÓRRO "), "ahorro");
  assert.ok(coincide(["ahorro"], "Ahorro!"));
  assert.ok(coincide(["ahorro"], "quiero los ahorros 🙌"));
  assert.ok(coincide(["ahorro"], "AHÓRRO"));
  assert.ok(!coincide(["ahorro"], "desahorro"));
  assert.ok(!coincide(["ahorro"], "hola"));
});

const auto = (x: Partial<Automatizacion>): Automatizacion => ({
  id: "x",
  nombre: "x",
  activa: true,
  disparador: "comentario",
  palabras: [],
  publicaciones: [],
  link: "",
  espera: [1, 2],
  topeDiario: 40,
  extra: {},
  flujo: "",
  ...x,
});

test("comentario: primero la de palabra clave, si no la general; las apagadas no", () => {
  const autos = [auto({ id: "comentarios" }), auto({ id: "ahorro", palabras: ["ahorro"] }), auto({ id: "otra", palabras: ["kit"], activa: false })];
  assert.equal(elegirParaComentario(autos, "AHORRO", "1")?.id, "ahorro");
  assert.equal(elegirParaComentario(autos, "¿cuánto sale?", "1")?.id, "comentarios");
  assert.equal(elegirParaComentario(autos, "kit", "1")?.id, "comentarios");
  assert.equal(elegirParaComentario([auto({ id: "solo", palabras: ["kit"], publicaciones: ["5"] })], "kit", "1"), null);
  assert.equal(elegirParaComentario([auto({ id: "x", activa: false })], "hola", "1"), null);
});

// ── Privados ────────────────────────────────────────────────────────────────

const ahora = new Date("2026-10-30T15:00:00.000Z"); // viernes 12:00 en Uruguay
const hace = (ms: number) => new Date(ahora.getTime() - ms);
const conv = { desdeAnuncio: false, derivadaEn: null, tomadaEn: null };
const ctx = { modo: "envio" as const, activa: true, pausaOtroMs: 30 * MIN, topeSuperado: false };

test("porQueNo: contesta lo que corresponde y explica lo que no", () => {
  const cliente = [{ autor: "CLIENTE", enviadoEn: hace(2 * MIN) }];
  assert.equal(porQueNo(conv, cliente, ahora, ctx), null);
  assert.equal(porQueNo(conv, cliente, ahora, { ...ctx, modo: "apagado" }), "apagado");
  assert.equal(porQueNo(conv, cliente, ahora, { ...ctx, activa: false }), "apagado");
  assert.equal(porQueNo(conv, [], ahora, ctx), "sin_mensajes");
  assert.equal(porQueNo(conv, [...cliente, { autor: "ASISTENTE", enviadoEn: hace(MIN) }], ahora, ctx), "ya_contestado");
  assert.equal(porQueNo(conv, [{ autor: "CLIENTE", enviadoEn: hace(25 * HORA) }], ahora, ctx), "fuera_de_ventana");
  assert.equal(porQueNo({ ...conv, desdeAnuncio: true }, [{ autor: "CLIENTE", enviadoEn: hace(25 * HORA) }], ahora, ctx), null);
  assert.equal(porQueNo({ ...conv, tomadaEn: hace(HORA) }, cliente, ahora, ctx), "tomada");
  const conOtro = [{ autor: "OTRO", enviadoEn: hace(10 * MIN) }, ...cliente];
  assert.equal(porQueNo(conv, conOtro, ahora, ctx), "contesto_otro");
  assert.equal(porQueNo(conv, [{ autor: "PERSONA", enviadoEn: hace(10 * MIN) }, ...cliente], ahora, ctx), "contesto_otro");
  assert.equal(porQueNo(conv, [{ autor: "OTRO", enviadoEn: hace(40 * MIN) }, ...cliente], ahora, ctx), null);
  assert.equal(porQueNo({ ...conv, derivadaEn: hace(24 * HORA) }, cliente, ahora, ctx), "derivada");
  assert.equal(porQueNo({ ...conv, derivadaEn: hace(8 * 24 * HORA) }, cliente, ahora, ctx), null);
  assert.equal(porQueNo(conv, cliente, ahora, { ...ctx, topeSuperado: true }), "tope_de_gasto");
});

test("porQueNo en sombra: no se calla por los ecos del contestador de indicadores", () => {
  const conOtro = [{ autor: "OTRO", enviadoEn: hace(10 * MIN) }, { autor: "CLIENTE", enviadoEn: hace(2 * MIN) }];
  assert.equal(porQueNo(conv, conOtro, ahora, { ...ctx, modo: "sombra" }), null);
});

test("escribió otro desde que el cliente escribió", () => {
  const desde = hace(5 * MIN);
  assert.ok(escribioOtro([{ autor: "OTRO", enviadoEn: hace(MIN) }], desde));
  assert.ok(escribioOtro([{ autor: "PERSONA", enviadoEn: hace(MIN) }], desde));
  assert.ok(!escribioOtro([{ autor: "OTRO", enviadoEn: hace(10 * MIN) }, { autor: "ASISTENTE", enviadoEn: hace(MIN) }], desde));
});

test("los mensajes de Claude se limpian; acepta la forma vieja", () => {
  assert.deepEqual(mensajesDe({ mensajes: [" hola ", "", "  "] }), ["hola"]);
  assert.deepEqual(mensajesDe({ respuesta: "uno solo" }), ["uno solo"]);
  assert.equal(mensajesDe({ mensajes: Array(10).fill("x") }).length, 6);
  assert.equal(mensajesDe({ mensajes: ["a".repeat(2000)] })[0].length, 1000);
});

test("si deriva y no puso el WhatsApp, se agrega", () => {
  assert.deepEqual(conWhatsapp(["hola"], false), ["hola"]);
  const con = conWhatsapp(["hola"], true);
  assert.equal(con.length, 2);
  assert.match(con[1], /365 636/);
  assert.deepEqual(conWhatsapp(["escribile al 092365636"], true), ["escribile al 092365636"]);
  assert.equal(conWhatsapp([], true).length, 1);
});

test("la conversación para Claude: turnos alternados, empezando por el cliente", () => {
  const t = (autor: string, texto: string) => ({ autor, texto, enviadoEn: ahora });
  const turnos = mensajesParaClaude([t("ASISTENTE", "viejo"), t("CLIENTE", "hola"), t("CLIENTE", "precio?"), t("OTRO", "ManyChat"), t("CLIENTE", "")]);
  assert.deepEqual(turnos, [
    { role: "user", content: "hola\nprecio?" },
    { role: "assistant", content: "[Escribió Voltia por otro lado] ManyChat" },
    { role: "user", content: "[mensaje sin texto]" },
  ]);
});

test("pidió más info (el botón del lead magnet)", () => {
  assert.ok(pidioMasInfo("Quiero más info"));
  assert.ok(pidioMasInfo("quiero mas informacion!"));
  assert.ok(!pidioMasInfo("quiero saber el precio"));
});

test("seguimiento: al día siguiente, en horario, una sola vez y si no contestó", () => {
  const speech = hace(21 * HORA);
  const base = { speechEn: speech, seguimientoEn: null, derivadaEn: null, tomadaEn: null };
  const mensajes = [
    { autor: "CLIENTE", enviadoEn: hace(21 * HORA + MIN) },
    { autor: "ASISTENTE", enviadoEn: speech },
  ];
  const extra = { horas: [20, 23.5], horario: [8, 21], dias: [0, 1, 2, 3, 4, 5] };
  assert.ok(tocaSeguimiento(base, mensajes, ahora, extra));
  assert.ok(!tocaSeguimiento({ ...base, seguimientoEn: hace(HORA) }, mensajes, ahora, extra), "ya se hizo");
  assert.ok(!tocaSeguimiento({ ...base, derivadaEn: hace(HORA) }, mensajes, ahora, extra), "derivada");
  assert.ok(!tocaSeguimiento({ ...base, tomadaEn: hace(HORA) }, mensajes, ahora, extra), "tomada");
  assert.ok(!tocaSeguimiento({ ...base, speechEn: null }, mensajes, ahora, extra), "sin speech");
  assert.ok(!tocaSeguimiento(base, [...mensajes, { autor: "CLIENTE", enviadoEn: hace(HORA) }], ahora, extra), "contestó");
  assert.ok(!tocaSeguimiento(base, mensajes, new Date(ahora.getTime() - 3 * HORA), extra), "muy temprano");
  // 30-oct es viernes; el domingo 1-nov no.
  const domingo = new Date("2026-11-01T15:00:00.000Z");
  const mDomingo = [
    { autor: "CLIENTE", enviadoEn: new Date(domingo.getTime() - 21 * HORA - MIN) },
    { autor: "ASISTENTE", enviadoEn: new Date(domingo.getTime() - 21 * HORA) },
  ];
  assert.ok(!tocaSeguimiento({ ...base, speechEn: mDomingo[1].enviadoEn }, mDomingo, domingo, extra), "domingo");
  const noche = new Date("2026-10-31T01:30:00.000Z"); // 22:30 en Uruguay
  const mNoche = [
    { autor: "CLIENTE", enviadoEn: new Date(noche.getTime() - 21 * HORA - MIN) },
    { autor: "ASISTENTE", enviadoEn: new Date(noche.getTime() - 21 * HORA) },
  ];
  assert.ok(!tocaSeguimiento({ ...base, speechEn: mNoche[1].enviadoEn }, mNoche, noche, extra), "de noche");
});

// ── Comentarios ─────────────────────────────────────────────────────────────

test("el pedido a Claude para un comentario: link, si ya lo recibió y no repetir", () => {
  const c = { id: "1", texto: "AHORRO", deId: "2", usuario: "ana.perez", mediaId: "9", parentId: "" };
  const p = pedido(auto({ link: "https://voltia.com.uy/ahorro" }), c, { id: "9", permalink: "https://instagram.com/p/x", caption: "obra" }, true, [
    ["¡Listo Ana!"],
    ["Hola Ana, acá tenés"],
  ]);
  assert.match(p, /@ana\.perez: «AHORRO»/);
  assert.match(p, /YA se le mandó/);
  assert.match(p, /- ¡Listo Ana!/);
  assert.match(p, /arrancá distinto/);
  const sinLink = pedido(auto({}), c, { id: "9" }, false);
  assert.doesNotMatch(sinLink, /Link para el privado/);
});

// ── El secreto con indicadores ──────────────────────────────────────────────

test("el secreto compartido: sin secreto configurado no pasa nada", () => {
  const antes = process.env.INSTAGRAM_CONECTOR_SECRETO;
  process.env.INSTAGRAM_CONECTOR_SECRETO = "";
  assert.ok(!secretoValido("Bearer "));
  process.env.INSTAGRAM_CONECTOR_SECRETO = "abc123";
  assert.ok(secretoValido("Bearer abc123"));
  assert.ok(!secretoValido("Bearer abc124"));
  assert.ok(!secretoValido("abc123"));
  assert.ok(!secretoValido(undefined));
  process.env.INSTAGRAM_CONECTOR_SECRETO = antes ?? "";
});
