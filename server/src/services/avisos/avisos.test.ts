import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../lib/prisma.js";
import { diaUruguay, enviarProgramados, leEscribieronDesde, mandarAviso, PREFIJO_BITACORA } from "./emitir.js";
import { aFormatoMeta, fechaLarga, nombrePlantilla, problemasDelTexto, rellenar } from "./plantilla.js";

describe("texto del aviso", () => {
  test("pasa las variables a huecos numerados, con un ejemplo cada uno", () => {
    const r = aFormatoMeta("Hola {{cliente.nombre}}, la obra es el {{ obra.fecha }}. Saludos");
    assert.equal(r.cuerpo, "Hola {{1}}, la obra es el {{2}}. Saludos");
    assert.deepEqual(r.variables, ["cliente.nombre", "obra.fecha"]);
    assert.deepEqual(r.ejemplos, ["María", "martes 3 de noviembre"]);
  });

  test("marca lo que Meta rechaza y las variables sin dato para el disparador", () => {
    const p = problemasDelTexto("{{cliente.nombre}} tu obra es el {{obra.fecha}}", "ute.habilitado", "WHATSAPP");
    assert.ok(p.some((x) => x.includes("empiece o termine")));
    assert.ok(p.some((x) => x.includes("{{obra.fecha}} no tiene dato")));
    assert.ok(problemasDelTexto("Hola {{cliente.nombre}}{{obra.fecha}} chau", "obra.fecha_confirmada", "WHATSAPP").some((x) => x.includes("seguidas")));
    assert.deepEqual(problemasDelTexto("Hola {{cliente.nombre}}, ya habilitó UTE.", "ute.habilitado", "WHATSAPP"), []);
    // En mail no rigen las reglas de Meta.
    assert.deepEqual(problemasDelTexto("{{cliente.nombre}}", "ute.habilitado", "EMAIL"), []);
  });

  test("rellena y avisa lo que falta", () => {
    const r = rellenar("Hola {{cliente.nombre}}, el {{obra.fecha}}.", { "cliente.nombre": "Ana", "obra.fecha": null });
    assert.equal(r.texto, "Hola Ana, el {{obra.fecha}}.");
    assert.deepEqual(r.faltan, ["obra.fecha"]);
  });

  test("el día del hecho se compara en hora de Uruguay", () => {
    // 03:15 UTC del 30 = 00:15 del 30 en Uruguay; 02:15 UTC = 23:15 del 29.
    assert.equal(diaUruguay(new Date("2026-10-30T03:15:00Z")), "2026-10-30");
    assert.equal(diaUruguay(new Date("2026-10-30T02:15:00Z")), "2026-10-29");
    assert.equal(diaUruguay(new Date("2026-10-29T00:00:00Z")), "2026-10-29");
  });

  test("fechas y nombre de plantilla", () => {
    assert.equal(fechaLarga(new Date("2026-11-03T00:00:00Z")), "martes 3 de noviembre");
    // 01:30 UTC del 4 = 22:30 del 3 en Uruguay.
    assert.equal(fechaLarga(new Date("2026-11-04T01:30:00Z")), "martes 3 de noviembre");
    assert.equal(nombrePlantilla("Fecha de obra ¡confirmada!", "ab12"), "aviso_fecha_de_obra_confirmada_ab12");
  });
});

describe("envío", async () => {
  const proyecto = await prisma.project.findFirst({ where: { deletedAt: null, importedFromCsv: false }, select: { id: true } });
  const avisosCreados: string[] = [];
  after(async () => {
    await prisma.avisoAutomatico.deleteMany({ where: { id: { in: avisosCreados } } });
    await prisma.$disconnect();
  });

  const nuevoAviso = async (activadoEn: Date | null) => {
    const a = await prisma.avisoAutomatico.create({
      data: {
        nombre: `prueba ${Date.now()}`,
        disparador: "ute.habilitado",
        canal: "WHATSAPP",
        estado: "ACTIVO",
        cuerpo: "Hola {{cliente.nombre}}, UTE habilitó.",
        activadoEn,
      },
    });
    avisosCreados.push(a.id);
    return a;
  };

  test("un hecho anterior a la activación no manda nada, y queda registrado", { skip: !proyecto }, async () => {
    const aviso = await nuevoAviso(new Date());
    const r = await mandarAviso(aviso, {
      disparador: "ute.habilitado",
      projectId: proyecto!.id,
      ocurrioEn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    assert.equal(r?.estado, "OMITIDO");
    assert.match(r?.detalle ?? "", /anterior a la activación/);
  });

  test("el mismo hecho no se procesa dos veces", { skip: !proyecto }, async () => {
    const aviso = await nuevoAviso(null);
    const hecho = { disparador: "ute.habilitado", projectId: proyecto!.id, ref: "x" };
    const primero = await mandarAviso(aviso, hecho);
    assert.ok(primero);
    const segundo = await mandarAviso(aviso, hecho);
    assert.equal(segundo, null);
    assert.equal(await prisma.avisoEnvio.count({ where: { avisoId: aviso.id } }), 1);
  });
});

describe("demora, bienvenida y condición", async () => {
  const admin = await prisma.user.findFirst({ where: { deletedAt: null, role: { name: "ADMIN" } }, select: { id: true } });
  const avisos: string[] = [];
  const proyectos: string[] = [];
  const usuarios: string[] = [];
  after(async () => {
    await prisma.avisoAutomatico.deleteMany({ where: { id: { in: avisos } } });
    await prisma.project.deleteMany({ where: { id: { in: proyectos } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  const proyectoDePrueba = async () => {
    const p = await prisma.project.create({
      data: {
        code: `TEST-AVISOS-${Date.now()}`,
        clientName: "Cliente Prueba Avisos",
        clientPhone: "099 111 222",
        capacityKwp: 5,
        locationCity: "Montevideo",
        locationProvince: "Montevideo",
        status: "ACTIVE",
        startDate: new Date(),
        executedUsd: 0,
        createdById: admin!.id,
      },
    });
    proyectos.push(p.id);
    await prisma.recorridoCheck.create({
      data: { projectId: p.id, recorrido: "E1", codigo: "e1_bienvenida", titulo: "Bienvenida y presentación", orden: 1 },
    });
    return p.id;
  };

  const nuevoAviso = async (extra: { demoraMinutos?: number; condicion?: string; disparador?: string } = {}) => {
    const a = await prisma.avisoAutomatico.create({
      data: {
        nombre: `prueba ${Date.now()}`,
        disparador: extra.disparador ?? "ute.habilitado",
        canal: "WHATSAPP",
        estado: "ACTIVO",
        cuerpo: "Hola {{cliente.nombre}}, UTE habilitó.",
        activadoEn: new Date(Date.now() - 60_000),
        demoraMinutos: extra.demoraMinutos ?? null,
        condicion: extra.condicion ?? null,
      },
    });
    avisos.push(a.id);
    return a;
  };

  test("antes de la bienvenida queda programado, y sale cuando se hace", { skip: !admin }, async () => {
    const id = await proyectoDePrueba();
    const aviso = await nuevoAviso();
    const r = await mandarAviso(aviso, { disparador: "ute.habilitado", projectId: id });
    assert.equal(r?.estado, "PROGRAMADO");
    assert.match(r?.detalle ?? "", /bienvenida/);
    // Pasa el job: sigue esperando.
    await enviarProgramados({ projectId: id });
    assert.equal((await prisma.avisoEnvio.findUnique({ where: { id: r!.id } }))?.estado, "PROGRAMADO");
    // Se hace la bienvenida: ya no espera (en desarrollo no sale al cliente, pero deja de estar programado).
    await prisma.recorridoCheck.updateMany({ where: { projectId: id, codigo: "e1_bienvenida" }, data: { completadoEn: new Date() } });
    await enviarProgramados({ projectId: id });
    assert.notEqual((await prisma.avisoEnvio.findUnique({ where: { id: r!.id } }))?.estado, "PROGRAMADO");
  });

  test("el aviso de la bienvenida no se espera a sí mismo", { skip: !admin }, async () => {
    const id = await proyectoDePrueba();
    const aviso = await nuevoAviso({ disparador: "es.bienvenida" });
    const r = await mandarAviso(aviso, { disparador: "es.bienvenida", projectId: id });
    assert.notEqual(r?.estado, "PROGRAMADO");
  });

  test("con demora queda programado para el hecho + la demora", { skip: !admin }, async () => {
    const id = await proyectoDePrueba();
    const aviso = await nuevoAviso({ demoraMinutos: 24 * 60 });
    const ocurrio = new Date();
    const r = await mandarAviso(aviso, { disparador: "ute.habilitado", projectId: id, ocurrioEn: ocurrio });
    assert.equal(r?.estado, "PROGRAMADO");
    assert.equal(r?.salirEn?.getTime(), ocurrio.getTime() + 24 * 60 * 60_000);
  });

  test("acceso al portal: crea el usuario si falta y sale el aviso que le corresponde", { skip: !admin }, async () => {
    // Sin mail: usuario nombre.apellido con la contraseña inicial; el aviso "con mail" no le sale.
    const id = await proyectoDePrueba();
    await prisma.recorridoCheck.updateMany({ where: { projectId: id, codigo: "e1_bienvenida" }, data: { completadoEn: new Date() } });
    await prisma.recorridoCheck.create({ data: { projectId: id, recorrido: "E1", codigo: "e1_portal", titulo: "Portal", orden: 3 } });
    const conMail = await nuevoAviso({ disparador: "es.bienvenida", condicion: "PORTAL_CON_MAIL" });
    const r = await mandarAviso(conMail, { disparador: "es.bienvenida", projectId: id });
    assert.equal(r?.estado, "OMITIDO");
    assert.match(r?.detalle ?? "", /sin mail/);
    const link = await prisma.projectClient.findFirst({ where: { projectId: id }, include: { user: true } });
    assert.ok(link);
    usuarios.push(link.user.id);
    assert.equal(link.user.email, null);
    assert.match(link.user.username ?? "", /^cliente\.prueba/);
    assert.equal(link.user.passwordTemporary, true);
    // Crearlo solo no cierra el paso de mandarle el acceso.
    const paso = await prisma.recorridoCheck.findFirst({ where: { projectId: id, codigo: "e1_portal" } });
    assert.equal(paso?.completadoEn, null);
    // El aviso "sin mail" sí le corresponde (en desarrollo no sale al cliente, pero no lo descarta por la condición).
    const sinMail = await nuevoAviso({ disparador: "es.bienvenida", condicion: "PORTAL_SIN_MAIL" });
    const r2 = await mandarAviso(sinMail, { disparador: "es.bienvenida", projectId: id });
    assert.doesNotMatch(r2?.detalle ?? "", /le corresponde/);
  });

  test("con mail, el usuario es el mail y entra con el código", { skip: !admin }, async () => {
    const id = await proyectoDePrueba();
    const mail = `prueba.avisos.${Date.now()}@ejemplo.com`;
    await prisma.project.update({ where: { id }, data: { clientEmail: mail } });
    const { asegurarUsuarioPortal } = await import("../clientes/portal-user.service.js");
    const r = await asegurarUsuarioPortal(id, admin!.id);
    assert.ok(r.ok);
    const u = await prisma.user.findUnique({ where: { email: mail }, select: { id: true, passwordTemporary: true } });
    assert.ok(u);
    usuarios.push(u.id);
    assert.equal(u.passwordTemporary, false);
  });

  test("fecha nueva tras una suspensión: borra la marca y cancela el aviso de suspensión que no salió", { skip: !admin }, async () => {
    const { avisarFechaConfirmada } = await import("./cambios-de-fecha.js");
    const id = await proyectoDePrueba();
    await prisma.project.update({ where: { id }, data: { esperandoFechaNuevaDesde: new Date() } });
    // El aviso de la suspensión, con 24 h de demora, todavía programado.
    const e1 = await nuevoAviso({ disparador: "obra.suspendida", demoraMinutos: 24 * 60 });
    const r = await mandarAviso(e1, { disparador: "obra.suspendida", projectId: id, ref: "2026-12-01", datosFijos: { "obra.fecha": "martes 1 de diciembre" } });
    assert.equal(r?.estado, "PROGRAMADO");
    assert.deepEqual(r?.datosFijos, { "obra.fecha": "martes 1 de diciembre" });

    await avisarFechaConfirmada(id, new Date("2026-12-10T00:00:00Z"));
    const p = await prisma.project.findUnique({ where: { id }, select: { esperandoFechaNuevaDesde: true } });
    assert.equal(p?.esperandoFechaNuevaDesde, null);
    const tras = await prisma.avisoEnvio.findUnique({ where: { id: r!.id } });
    assert.equal(tras?.estado, "OMITIDO");
    assert.match(tras?.detalle ?? "", /reprogramada/);
  });

  test("si Experiencia Solar le escribió, la condición lo frena; los avisos no cuentan", { skip: !admin }, async () => {
    const id = await proyectoDePrueba();
    const desde = new Date(Date.now() - 60_000);
    await prisma.clientInteraction.create({
      data: { projectId: id, channel: "WHATSAPP", direction: "SALIENTE", content: `${PREFIJO_BITACORA}x»: hola`, authorId: admin!.id },
    });
    assert.equal(await leEscribieronDesde(id, "099 111 222", desde), false);
    await prisma.clientInteraction.create({
      data: { projectId: id, channel: "WHATSAPP", direction: "SALIENTE", content: "Le escribí para coordinar", authorId: admin!.id },
    });
    assert.equal(await leEscribieronDesde(id, "099 111 222", desde), true);

    await prisma.recorridoCheck.updateMany({ where: { projectId: id, codigo: "e1_bienvenida" }, data: { completadoEn: new Date() } });
    const aviso = await nuevoAviso({ condicion: "SIN_CONTACTO" });
    const r = await mandarAviso(aviso, { disparador: "ute.habilitado", projectId: id, contactoDesde: desde });
    assert.equal(r?.estado, "OMITIDO");
    assert.match(r?.detalle ?? "", /ya le escribió/);
  });
});

describe("mantenimientos", async () => {
  const admin = await prisma.user.findFirst({ where: { deletedAt: null, role: { name: "ADMIN" } }, select: { id: true } });
  const proyectos: string[] = [];
  after(async () => {
    await prisma.agendaEvento.deleteMany({ where: { projectId: { in: proyectos } } });
    await prisma.project.deleteMany({ where: { id: { in: proyectos } } });
    await prisma.$disconnect();
  });

  const conHabilitacion = async (habilitado: Date) => {
    const p = await prisma.project.create({
      data: {
        code: `TEST-MANT-${Date.now()}-${proyectos.length}`,
        clientName: "Cliente Prueba Mantenimiento",
        capacityKwp: 5,
        locationCity: "Montevideo",
        locationProvince: "Montevideo",
        status: "ACTIVE",
        startDate: new Date(),
        executedUsd: 0,
        createdById: admin!.id,
        postHabilitacionInicioEn: habilitado,
      },
    });
    proyectos.push(p.id);
    return p.id;
  };
  const mantenimiento = (projectId: string, fecha: string, hecho = false) =>
    prisma.agendaEvento.create({
      data: {
        tipo: "MANTENIMIENTO",
        titulo: "Mantenimiento",
        projectId,
        teamName: "Equipo",
        createdById: admin!.id,
        completadoEn: hecho ? new Date(fecha) : null,
        dias: { create: [{ fecha: new Date(`${fecha}T00:00:00Z`) }] },
      },
    });

  test("sin costo: el 1.º y el 2.º dentro de los dos primeros años", { skip: !admin }, async () => {
    const { esMantenimientoSinCosto } = await import("./mantenimientos.js");
    const id = await conHabilitacion(new Date("2025-01-10T00:00:00Z"));
    await mantenimiento(id, "2026-01-12", true);
    assert.equal((await esMantenimientoSinCosto(id, new Date("2026-01-12T00:00:00Z"))).sinCosto, true);
    await mantenimiento(id, "2027-01-15");
    assert.equal((await esMantenimientoSinCosto(id, new Date("2027-01-15T00:00:00Z"))).sinCosto, true);
    // El tercero ya no.
    await mantenimiento(id, "2027-03-01");
    assert.equal((await esMantenimientoSinCosto(id, new Date("2027-03-01T00:00:00Z"))).sinCosto, false);
    // Pasados los dos años (+ 6 meses de margen) tampoco, aunque sea el primero cargado.
    const viejo = await conHabilitacion(new Date("2023-05-01T00:00:00Z"));
    await mantenimiento(viejo, "2026-11-20");
    const r = await esMantenimientoSinCosto(viejo, new Date("2026-11-20T00:00:00Z"));
    assert.equal(r.sinCosto, false);
  });

  test("alerta: próximo sin agendar, y nada por aniversarios de antes del corte", { skip: !admin }, async () => {
    const { alertasMantenimiento } = await import("./mantenimientos.js");
    const ahora = new Date("2026-12-01T12:00:00Z");
    // Cumple el 1.º año el 20-dic-2026: faltan 19 días.
    const proximo = await conHabilitacion(new Date("2025-12-20T00:00:00Z"));
    // Cumplió el 1.º el 1-oct-2026, antes del corte: no se alerta.
    const viejo = await conHabilitacion(new Date("2025-10-01T00:00:00Z"));
    const alertas = await alertasMantenimiento([proximo, viejo], ahora);
    assert.match(alertas.get(proximo) ?? "", /Agendar el 1\.º mantenimiento/);
    assert.equal(alertas.has(viejo), false);
    // Con el mantenimiento agendado, la alerta se apaga.
    await mantenimiento(proximo, "2026-12-22");
    assert.equal((await alertasMantenimiento([proximo], ahora)).has(proximo), false);
    // Vencido: pasó el aniversario sin agendar.
    const vencido = await conHabilitacion(new Date("2025-11-20T00:00:00Z"));
    assert.match((await alertasMantenimiento([vencido], ahora)).get(vencido) ?? "", /vencido/);
  });
});
