// Tests del origen del lead ("¿Cómo nos conoció?").
//   npm run test:origen-lead

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { OrigenLead } from "@prisma/client";

import {
  completarOrigenSiFalta,
  describirOrigen,
  normalizarOrigen,
  origenDesdeAnuncio,
  resumirPorOrigen,
} from "./origen-lead.js";

test("todos los valores del enum tienen etiqueta", () => {
  for (const o of Object.values(OrigenLead)) {
    assert.notEqual(describirOrigen(o, null), "Sin dato");
  }
  assert.equal(describirOrigen(null, null), "Sin dato");
  assert.equal(describirOrigen(OrigenLead.RECOMENDACION, " Juan "), "Recomendación (Juan)");
});

test("sin campos no toca nada (edición parcial)", () => {
  assert.deepEqual(normalizarOrigen({}), {});
});

test("OTRO exige detalle, en alta y en edición", () => {
  assert.throws(() => normalizarOrigen({ origen: OrigenLead.OTRO }), /Otro/);
  assert.throws(() => normalizarOrigen({ origen: OrigenLead.OTRO, origenDetalle: "   " }), /Otro/);
  // Borrar el detalle de un lead que ya está en OTRO tampoco vale.
  assert.throws(() =>
    normalizarOrigen({ origenDetalle: "" }, { origen: OrigenLead.OTRO, origenDetalle: "feria" }),
  );
  assert.deepEqual(normalizarOrigen({ origen: OrigenLead.OTRO, origenDetalle: " feria " }), {
    origen: OrigenLead.OTRO,
    origenDetalle: "feria",
  });
});

test("el detalle es opcional en los demás y vacío pasa a null", () => {
  assert.deepEqual(normalizarOrigen({ origen: OrigenLead.GOOGLE_WEB, origenDetalle: "" }), {
    origen: OrigenLead.GOOGLE_WEB,
    origenDetalle: null,
  });
});

test("cambiar solo el origen conserva el detalle que ya tenía", () => {
  assert.deepEqual(
    normalizarOrigen({ origen: OrigenLead.OTRO }, { origen: OrigenLead.RECOMENDACION, origenDetalle: "Ana" }),
    { origen: OrigenLead.OTRO, origenDetalle: "Ana" },
  );
});

test("borrar el origen borra el detalle", () => {
  assert.deepEqual(
    normalizarOrigen({ origen: null }, { origen: OrigenLead.RECOMENDACION, origenDetalle: "Ana" }),
    { origen: null, origenDetalle: null },
  );
});

test("anuncio de WhatsApp: completa solo si el lead no tiene origen", () => {
  const inferido = origenDesdeAnuncio({ source_id: "123", headline: "Paneles en 30 días" });
  assert.deepEqual(inferido, { origen: OrigenLead.ANUNCIO_META, origenDetalle: "Paneles en 30 días · anuncio 123" });
  assert.deepEqual(completarOrigenSiFalta({ origen: null }, inferido), inferido);
  assert.equal(completarOrigenSiFalta({ origen: OrigenLead.RECOMENDACION }, inferido), null);
  assert.deepEqual(origenDesdeAnuncio({}), { origen: OrigenLead.ANUNCIO_META, origenDetalle: null });
});

test("resumen por origen: cuenta cada hecho y suma montos", () => {
  const filas = resumirPorOrigen({
    leads: [
      { origen: OrigenLead.ANUNCIO_META },
      { origen: OrigenLead.ANUNCIO_META },
      { origen: OrigenLead.RECOMENDACION },
      { origen: null },
    ],
    propuestas: [{ origen: OrigenLead.ANUNCIO_META }, { origen: OrigenLead.RECOMENDACION }],
    ventas: [
      { origen: OrigenLead.RECOMENDACION, montoUsd: 10_000 },
      { origen: OrigenLead.RECOMENDACION, montoUsd: null },
      { origen: null, montoUsd: 5_000 },
    ],
  });

  assert.deepEqual(
    filas.map((f) => f.origen),
    [OrigenLead.RECOMENDACION, OrigenLead.ANUNCIO_META, null],
  );
  const rec = filas[0];
  assert.equal(rec.leads, 1);
  assert.equal(rec.propuestas, 1);
  assert.equal(rec.ventas, 2);
  assert.equal(rec.montoUsd, 10_000);
  assert.equal(rec.ventasSinMonto, 1);
  // Sin dato va al final aunque tenga ventas.
  assert.equal(filas[2].ventas, 1);
  // Los totales cierran con la entrada.
  assert.equal(filas.reduce((s, f) => s + f.leads, 0), 4);
});
