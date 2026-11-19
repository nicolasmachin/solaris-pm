import assert from "node:assert/strict";
import { test } from "node:test";

import { coordenadasDeMensajeWhatsApp, linksMapa, parsearCoordenadas } from "./ubicacion.service.js";

test("coordenadas sueltas, con coma o espacio", () => {
  assert.deepEqual(parsearCoordenadas("-34.905, -56.191"), { lat: -34.905, lng: -56.191 });
  assert.deepEqual(parsearCoordenadas("-34.905 -56.191"), { lat: -34.905, lng: -56.191 });
});

test("links de Google Maps y Waze", () => {
  assert.deepEqual(parsearCoordenadas("https://www.google.com/maps/place/X/@-34.9012346,-56.1645678,17z/data=x"), { lat: -34.901235, lng: -56.164568 });
  assert.deepEqual(parsearCoordenadas("https://maps.google.com/?q=-34.9,-56.1"), { lat: -34.9, lng: -56.1 });
  assert.deepEqual(parsearCoordenadas("https://www.google.com/maps/search/?api=1&query=-34.9%2C-56.1"), { lat: -34.9, lng: -56.1 });
  assert.deepEqual(parsearCoordenadas("https://waze.com/ul?ll=-34.9,-56.1&navigate=yes"), { lat: -34.9, lng: -56.1 });
});

test("lo que no son coordenadas", () => {
  assert.equal(parsearCoordenadas("https://maps.app.goo.gl/abc123"), null);
  assert.equal(parsearCoordenadas("Rivera 1234"), null);
  assert.equal(parsearCoordenadas("0,0"), null);
  assert.equal(parsearCoordenadas("95, 10"), null);
  assert.equal(parsearCoordenadas(""), null);
});

test("mensaje de ubicación de WhatsApp", () => {
  assert.deepEqual(coordenadasDeMensajeWhatsApp({ type: "location", location: { latitude: -34.9, longitude: -56.1, name: "Casa" } }), { lat: -34.9, lng: -56.1 });
  assert.equal(coordenadasDeMensajeWhatsApp({ type: "text" }), null);
});

test("links para abrir", () => {
  const l = linksMapa(-34.9, -56.1);
  assert.equal(l.googleMaps, "https://www.google.com/maps/search/?api=1&query=-34.9,-56.1");
  assert.equal(l.waze, "https://waze.com/ul?ll=-34.9,-56.1&navigate=yes");
});
