import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../lib/prisma.js";
import { diaUruguay, mandarAviso } from "./emitir.js";
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
