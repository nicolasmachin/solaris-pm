// Carga de una sola vez (20-oct-2026, pedida por Nicolás): ordenar Tiempo al Tiempo y Würth.
// Se corre DENTRO del contenedor server de prod: usa la API de Voltia PM con un token de Nicolás,
// así pasa por las mismas validaciones, aplicación FIFO y auditoría que la pantalla.
import { signToken } from "./src/middleware/auth.middleware.ts";

const NICOLAS = { id: "cmo9072ub0000o74be37paqkz", email: "nicolas@voltia.com.uy", name: "Nicolas Machin", role: "ADMIN" };
const token = signToken(NICOLAS);
const BASE = "http://localhost:4000/api";

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : null;
}

const TIEMPO = "cmohl58kv002jm50hibukx6ci";
const WURTH = "cmohl6jgp0031m50hqvwlqdpx";
const BBVA_USD = "cmohkwkk8001xm50hn97ch4wf";

// ── Tiempo al Tiempo ──
const a1433 = await api("POST", "/finance/facturas-recibidas/cmv9x4o5400bymm0jcs8hm2qu/confirmar", {});
console.log("A1433 confirmada →", a1433);

const saldoAnt = await api("POST", "/finance/supplier-invoices", {
  supplierId: TIEMPO,
  descripcion: "Saldo anterior al 30/09 (cuenta de la unipersonal en Tiempo al Tiempo)",
  monto: 6276.56,
  moneda: "USD",
  fechaEmision: "2026-09-30",
  fechaVencimiento: "2026-09-30",
});
console.log("Saldo anterior →", saldoAnt.id, saldoAnt.monto);

const pago = await api("POST", "/finance/payments", {
  supplierId: TIEMPO,
  accountId: BBVA_USD,
  fecha: "2026-10-20",
  monto: 10000,
  moneda: "USD",
  metodo: "TRANSFERENCIA",
  referencia: "Liquida cuenta unipersonal (6.276,56) + recibo A1155 (3.723,44)",
  autoAplicar: true,
});
console.log("Pago →", pago.id, JSON.stringify(pago.aplicacion));

// ── Würth ──
await api("PATCH", `/finance/suppliers/${WURTH}`, { nombre: "Würth" });
console.log("Proveedor renombrado a Würth");
for (const id of ["cmv9g0b1l01dho80jwhgntyte", "cmv9g0b5w01eno80je0hf2b6i", "cmv9qp4yp01i1o80j5o7mb36g"]) {
  const r = await api("POST", `/finance/facturas-recibidas/${id}/confirmar`, { supplierId: WURTH });
  console.log("Würth confirmada", id, "→", r);
}
process.exit(0);
