// Smoke test del Asistente de Plan de Pagos.
// Crea un plan en un proyecto con presupuesto, verifica el shape, reemplaza
// el plan (modo edición), verifica que los previos quedaron soft-deleted,
// borra el plan al final.

import { prisma } from "../src/lib/prisma.js";
import { signToken } from "../src/middleware/auth.middleware.js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";

const c = {
  ok: "\x1b[32m✓\x1b[0m",
  fail: "\x1b[31m✗\x1b[0m",
  info: "\x1b[34m·\x1b[0m",
};
const failures: string[] = [];

function expect(cond: boolean, label: string, details?: unknown) {
  if (cond) {
    console.log(`  ${c.ok} ${label}`);
  } else {
    console.log(`  ${c.fail} ${label}`);
    if (details !== undefined) console.log("    " + JSON.stringify(details));
    failures.push(label);
  }
}

async function authed(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json as Record<string, unknown> };
}

async function main() {
  console.log(`${c.info} Smoke test: asistente plan de pagos`);

  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    include: { role: true },
  });
  if (!admin) throw new Error("no admin user");
  const token = signToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role.name });

  // Buscar un proyecto con budgetUsd > 0. Si no existe, crear uno efímero.
  let project = await prisma.project.findFirst({
    where: { deletedAt: null, budgetUsd: { gt: 0 } },
    select: { id: true, code: true, clientName: true, budgetUsd: true },
  });

  let cleanupProject: string | null = null;
  if (!project) {
    console.log(`${c.info} no hay proyecto con budgetUsd > 0 — creando uno efímero`);
    // Necesito clientId — busco un user CLIENT
    const client = await prisma.user.findFirst({
      where: { role: { name: "CLIENT" } },
    });
    if (!client) throw new Error("no hay client user");
    const tempCode = `SMOKE-PLAN-${Date.now().toString().slice(-6)}`;
    const created = await prisma.project.create({
      data: {
        code: tempCode,
        clientName: "Smoke Plan Test",
        capacityKwp: 5,
        budgetUsd: 12500,
        locationCity: "Test",
        locationProvince: "Test",
        status: "ACTIVE",
        startDate: new Date(),
        executedUsd: 0,
        clientId: client.id,
      } as never,
      select: { id: true, code: true, clientName: true, budgetUsd: true },
    });
    project = created;
    cleanupProject = created.id;
    console.log(`${c.info} project: ${project.code} · USD ${project.budgetUsd}`);
  } else {
    console.log(`${c.info} project existente: ${project.code} · USD ${project.budgetUsd}`);
  }

  try {
    const budget = Number(project.budgetUsd);

    // ─── 1. GET inicial → hasPlan false (asumiendo proyecto limpio) ─────
    const get0 = await authed(token, "GET", `/api/finance/plan-pagos/${project.id}`);
    expect(get0.status === 200, "GET plan-pagos inicial → 200");
    const presupuestoUsd = (get0.body as { presupuestoUsd?: number }).presupuestoUsd;
    expect(presupuestoUsd === budget, `presupuestoUsd = ${budget}`, presupuestoUsd);
    const totalCobrado = (get0.body as { totalCobrado?: number }).totalCobrado ?? 0;
    const saldoPendiente = (get0.body as { saldoPendiente?: number }).saldoPendiente ?? 0;
    expect(typeof totalCobrado === "number", "totalCobrado es number", totalCobrado);
    expect(Math.abs(saldoPendiente - (budget - totalCobrado)) < 0.01, "saldoPendiente = budget - cobrado");

    // ─── 2. POST con suma exacta → 201 ──────────────────────────────────
    // Plan 50/30/20 con seña 500 sobre el saldo pendiente.
    const senia = Math.min(500, saldoPendiente * 0.5);
    const cuota1 = (saldoPendiente * 0.5) - senia;
    const cuota2 = saldoPendiente * 0.3;
    const cuota3 = saldoPendiente * 0.2;
    const post1 = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Seña", monto: senia, fechaPrevista: "2026-06-01" },
        { descripcion: "Cuota 1", monto: cuota1, fechaPrevista: "2026-07-01" },
        { descripcion: "Cuota 2", monto: cuota2, fechaPrevista: "2026-08-01" },
        { descripcion: "Cuota 3", monto: cuota3, fechaPrevista: "2026-09-01" },
      ],
    });
    expect(post1.status === 201, "POST plan-pagos → 201", post1);
    expect((post1.body as { created?: number }).created === 4, "created=4");
    expect((post1.body as { replaced?: number }).replaced === 0, "replaced=0 (primer plan)");

    // ─── 3. GET tras crear → hasPlan true con 4 cuotas ──────────────────
    const get1 = await authed(token, "GET", `/api/finance/plan-pagos/${project.id}`);
    const cuotas1 = (get1.body as { cuotas?: unknown[] }).cuotas ?? [];
    expect(cuotas1.length === 4, "GET tras crear: 4 cuotas");
    const desc1 = cuotas1.map((c) => (c as { descripcion: string }).descripcion);
    expect(desc1[0] === "Seña" && !desc1[0].startsWith("[PLAN]"), "descripcion sin prefijo [PLAN]", desc1[0]);

    // ─── 4. Verificar en DB que se guardaron con prefijo ────────────────
    const dbRows = await prisma.financeMovement.findMany({
      where: {
        projectId: project.id,
        status: "PREVISTO",
        deletedAt: null,
        descripcion: { startsWith: "[PLAN] " },
      },
      select: { descripcion: true },
    });
    expect(dbRows.length === 4, `DB: 4 movimientos con prefijo [PLAN] (real=${dbRows.length})`);
    expect(dbRows.every((r) => r.descripcion.startsWith("[PLAN] ")), "DB: todos los rows tienen prefijo [PLAN]");

    // ─── 5. POST nuevo plan → reemplaza, replaced=4, created=2 ──────────
    const post2 = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Anticipo", monto: saldoPendiente * 0.5, fechaPrevista: "2026-06-15" },
        { descripcion: "Final", monto: saldoPendiente * 0.5, fechaPrevista: "2026-09-15" },
      ],
    });
    expect(post2.status === 201, "POST plan-pagos reemplazo → 201");
    expect((post2.body as { replaced?: number }).replaced === 4, "replaced=4 (plan anterior soft-deleted)");
    expect((post2.body as { created?: number }).created === 2, "created=2");

    const get2 = await authed(token, "GET", `/api/finance/plan-pagos/${project.id}`);
    expect(((get2.body as { cuotas?: unknown[] }).cuotas ?? []).length === 2, "GET tras reemplazo: 2 cuotas");

    // Confirmar que los 4 anteriores quedaron soft-deleted (deletedAt no null).
    // Si el proyecto se reutiliza entre runs hay ruido histórico — chequeamos
    // que sean al menos 4 (los recién creados).
    const oldRows = await prisma.financeMovement.findMany({
      where: {
        projectId: project.id,
        status: "PREVISTO",
        deletedAt: { not: null },
        descripcion: { startsWith: "[PLAN] " },
      },
      select: { id: true },
    });
    expect(oldRows.length >= 4, `DB: ≥4 movimientos del plan viejo soft-deleted (real=${oldRows.length})`);

    // ─── 6. Validación: suma incorrecta → 400 ──────────────────────────
    const post3 = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Una sola", monto: 100, fechaPrevista: "2026-06-15" },
      ],
    });
    expect(post3.status === 400, "POST con suma incorrecta (100 vs budget) → 400", post3);

    // ─── 7. Validación: cuotas vacías → 400 ────────────────────────────
    const post4 = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [],
    });
    expect(post4.status === 400, "POST con cuotas vacías → 400");

    // ─── 8. Validación: seña >= saldoPendiente → 400 ───────────────────
    const post5 = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Seña gigante", monto: saldoPendiente + 100, fechaPrevista: "2026-06-15" },
      ],
    });
    expect(post5.status === 400, "POST con seña >= saldoPendiente → 400");

    // ─── 9. Cobro real reduce saldoPendiente y rebalancea validación ────
    // Creamos un INGRESO PAGADO ad-hoc, verificamos que saldoPendiente caiga
    // y que el plan ahora deba sumar (saldo previo - cobro), no budget bruto.
    // Capturamos baseline porque el proyecto puede tener cobros históricos.
    const getBase = await authed(token, "GET", `/api/finance/plan-pagos/${project.id}`);
    const cobradoBase = (getBase.body as { totalCobrado?: number }).totalCobrado ?? 0;
    const saldoBase = (getBase.body as { saldoPendiente?: number }).saldoPendiente ?? 0;
    const cobroAmount = Math.round(budget * 0.2 * 100) / 100;
    const cobroMovement = await prisma.financeMovement.create({
      data: {
        fecha: new Date(),
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        tipoMovimiento: "INGRESO",
        categoriaPrincipal: "PROYECTO_ENTRADA",
        descripcion: "[SMOKE] Cobro test",
        monto: cobroAmount,
        moneda: "USD",
        pagado: false,
        cobrado: true,
        impactaFlujo: true,
        status: "PAGADO",
        sourceType: "MANUAL",
        estadoAprobacion: "REGISTRADO",
        projectId: project.id,
        creadoPorId: admin.id,
        updatedAt: new Date(),
      },
    });

    const get3 = await authed(token, "GET", `/api/finance/plan-pagos/${project.id}`);
    const cobrado3 = (get3.body as { totalCobrado?: number }).totalCobrado ?? 0;
    const saldo3 = (get3.body as { saldoPendiente?: number }).saldoPendiente ?? 0;
    expect(Math.abs((cobrado3 - cobradoBase) - cobroAmount) < 0.01, `Δ totalCobrado = ${cobroAmount} (real Δ=${cobrado3 - cobradoBase})`);
    expect(Math.abs((saldoBase - saldo3) - cobroAmount) < 0.01, `Δ saldoPendiente = -${cobroAmount} (real Δ=${saldoBase - saldo3})`);

    // POST con suma = budget (no = saldo) ahora debe rechazar
    const postBadSum = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Una", monto: budget, fechaPrevista: "2026-10-01" },
      ],
    });
    expect(postBadSum.status === 400, "POST con suma=budget (no saldo) → 400", postBadSum);

    // POST con suma = saldo debe aceptar
    const postGood = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Restante", monto: saldo3, fechaPrevista: "2026-10-01" },
      ],
    });
    expect(postGood.status === 400, "POST con saldo entero como única cuota → 400 (seña >= saldo)", postGood);

    // POST válido: seña + cuota que sumen saldo
    const senia2 = Math.min(500, saldo3 * 0.5);
    const resto2 = saldo3 - senia2;
    const postSplit = await authed(token, "POST", "/api/finance/plan-pagos", {
      projectId: project.id,
      cuotas: [
        { descripcion: "Seña", monto: senia2, fechaPrevista: "2026-10-01" },
        { descripcion: "Resto", monto: resto2, fechaPrevista: "2026-11-01" },
      ],
    });
    expect(postSplit.status === 201, "POST seña + resto sumando saldo → 201", postSplit);

    // ─── 10. Cleanup: soft-delete del plan actual + cobro smoke ─────────
    await prisma.financeMovement.updateMany({
      where: {
        projectId: project.id,
        descripcion: { startsWith: "[PLAN] " },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    await prisma.financeMovement.delete({ where: { id: cobroMovement.id } });
    console.log(`${c.info} cleanup: plan actual soft-deleted + cobro smoke borrado`);
  } finally {
    if (cleanupProject) {
      // Borrado del proyecto efímero (cascada elimina movements).
      await prisma.financeMovement.deleteMany({ where: { projectId: cleanupProject } }).catch(() => undefined);
      await prisma.project.delete({ where: { id: cleanupProject } }).catch(() => undefined);
      console.log(`${c.info} cleanup: project efímero borrado`);
    }
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`${c.ok} TODOS LOS SMOKE TESTS PASARON`);
  } else {
    console.log(`${c.fail} ${failures.length} FALLAS:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("EXCEPCIÓN:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
