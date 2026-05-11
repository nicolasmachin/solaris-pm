// Smoke test del Commit 6: overlay + cascade-update del Consolidador.
// Corre dentro del container con
//   node --import tsx scripts/smoke-consolidador-compras.ts
// El script crea un consolidado efímero con 2 proyectos, valida el overlay
// (aggregatedStatus, isCrossed, perProjectStatus), hace una cascada y verifica
// el estado en DB. Limpia todo al final.

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

async function authedFetch(token: string, method: string, path: string, body?: unknown) {
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
  console.log(`${c.info} Smoke test: consolidador · vista compras + cascada`);

  const opsUser = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "OPERACIONES" } },
    include: { role: { select: { name: true } } },
  });
  if (!opsUser) throw new Error("No hay user OPERACIONES");

  const ingUser = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "INGENIERIA" } },
    include: { role: { select: { name: true } } },
  });
  if (!ingUser) throw new Error("No hay user INGENIERIA");

  // Encontrar 2 proyectos que compartan al menos 1 material para que MIXED
  // sea verificable.
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      projectMaterials: { some: {} },
    },
    take: 5,
    select: {
      id: true,
      code: true,
      clientName: true,
      projectMaterials: { select: { materialItemId: true } },
    },
  });

  // Buscar un materialItemId que aparezca en al menos 2 proyectos.
  const sharedItem: { materialItemId: string; projectIds: string[] } | null = (() => {
    const map = new Map<string, string[]>();
    for (const p of projects) {
      for (const pm of p.projectMaterials) {
        const list = map.get(pm.materialItemId) ?? [];
        list.push(p.id);
        map.set(pm.materialItemId, list);
      }
    }
    for (const [matId, pids] of map.entries()) {
      const uniq = Array.from(new Set(pids));
      if (uniq.length >= 2) return { materialItemId: matId, projectIds: uniq.slice(0, 2) };
    }
    return null;
  })();

  if (!sharedItem) {
    console.log(`${c.fail} no hay materiales compartidos entre proyectos — abortando`);
    process.exitCode = 1;
    return;
  }

  console.log(`${c.info} usando 2 proyectos que comparten materialItem ${sharedItem.materialItemId}`);

  // Seedeo: poner statuses distintos en los dos proyectos para forzar MIXED.
  const targetPMs = await prisma.projectMaterial.findMany({
    where: {
      projectId: { in: sharedItem.projectIds },
      materialItemId: sharedItem.materialItemId,
    },
    select: { id: true, projectId: true, status: true, crossed: true, lastEditedRole: true, lastEditedById: true, lastEditedAt: true },
    orderBy: { projectId: "asc" },
  });
  expect(targetPMs.length >= 2, "Se encontraron 2 ProjectMaterials para el item compartido");

  // Guardar snapshot original para restaurar al final.
  const original = targetPMs.map((p) => ({ ...p }));

  // Forzar MIXED: el primero PENDIENTE, el segundo PEDIDO.
  await prisma.projectMaterial.update({
    where: { id: targetPMs[0].id },
    data: { status: "PENDIENTE", crossed: false },
  });
  await prisma.projectMaterial.update({
    where: { id: targetPMs[1].id },
    data: { status: "PEDIDO", crossed: false },
  });

  // Crear consolidado con esos 2 proyectos.
  const ingToken = signToken({ id: ingUser.id, email: ingUser.email, name: ingUser.name, role: ingUser.role.name });
  const createRes = await authedFetch(ingToken, "POST", "/api/ingenieria/materiales-consolidados", {
    label: `smoke-${Date.now()}`,
    projectIds: sharedItem.projectIds,
  });
  expect(createRes.status === 201, "POST /materiales-consolidados crea version", createRes);
  const versionId = (createRes.body as { id?: string }).id ?? null;
  if (!versionId) {
    console.log(`${c.fail} no hubo id de version — abortando`);
    process.exitCode = 1;
    return;
  }

  try {
    // ─── 1) overlay: aggregatedStatus debe ser MIXED ────────────────────
    const opsToken = signToken({ id: opsUser.id, email: opsUser.email, name: opsUser.name, role: opsUser.role.name });
    const overlayRes = await authedFetch(opsToken, "GET", `/api/ingenieria/materiales-consolidados/${versionId}/compras-overlay`);
    expect(overlayRes.status === 200, "GET /compras-overlay con OPERACIONES.VIEW → 200", overlayRes);

    const overlayItems = (overlayRes.body as { items?: Array<{ catalogItemId: string; aggregatedStatus: string | null; isCrossed: boolean; perProjectStatus: unknown[] }> }).items ?? [];
    const shared = overlayItems.find((it) => it.catalogItemId === sharedItem.materialItemId);
    expect(!!shared, "Overlay contiene el item compartido");
    expect(shared?.aggregatedStatus === "MIXED", "aggregatedStatus = MIXED (estados distintos en los 2 proyectos)");
    expect(shared?.isCrossed === false, "isCrossed = false (ninguno tachado)");
    expect(Array.isArray(shared?.perProjectStatus) && shared.perProjectStatus.length === 2, "perProjectStatus tiene 2 entradas");

    // ─── 2) cascada: poner status=RECIBIDO ──────────────────────────────
    const cascadeRes = await authedFetch(opsToken, "POST", `/api/ingenieria/materiales-consolidados/${versionId}/items/${sharedItem.materialItemId}/cascade-update`, {
      status: "RECIBIDO",
    });
    expect(cascadeRes.status === 200, "POST cascade-update status=RECIBIDO con OPERACIONES.EDIT → 200", cascadeRes);
    const updated = (cascadeRes.body as { updatedCount?: number }).updatedCount ?? 0;
    expect(updated === 2, "cascade-update actualizó 2 ProjectMaterials");

    // Verificar en DB
    const afterStatus = await prisma.projectMaterial.findMany({
      where: { id: { in: targetPMs.map((p) => p.id) } },
      select: { id: true, status: true, lastEditedRole: true, lastEditedById: true, lastEditedAt: true },
    });
    expect(afterStatus.every((p) => p.status === "RECIBIDO"), "DB: ambos PMs ahora son RECIBIDO");
    expect(afterStatus.every((p) => p.lastEditedRole === "OPERACIONES"), "DB: lastEditedRole = OPERACIONES en ambos");
    expect(afterStatus.every((p) => p.lastEditedById === opsUser.id), "DB: lastEditedById = ops user en ambos");
    expect(afterStatus.every((p) => p.lastEditedAt instanceof Date), "DB: lastEditedAt populado");

    // ─── 3) overlay tras cascada: aggregatedStatus = RECIBIDO ───────────
    const overlay2 = await authedFetch(opsToken, "GET", `/api/ingenieria/materiales-consolidados/${versionId}/compras-overlay`);
    const shared2 = ((overlay2.body as { items?: Array<{ catalogItemId: string; aggregatedStatus: string | null }> }).items ?? []).find((it) => it.catalogItemId === sharedItem.materialItemId);
    expect(shared2?.aggregatedStatus === "RECIBIDO", "Overlay post-cascada: aggregatedStatus = RECIBIDO");

    // ─── 4) cascada: crossed=true ──────────────────────────────────────
    const crossRes = await authedFetch(opsToken, "POST", `/api/ingenieria/materiales-consolidados/${versionId}/items/${sharedItem.materialItemId}/cascade-update`, {
      crossed: true,
    });
    expect(crossRes.status === 200, "POST cascade-update crossed=true → 200");
    const afterCross = await prisma.projectMaterial.findMany({
      where: { id: { in: targetPMs.map((p) => p.id) } },
      select: { id: true, crossed: true },
    });
    expect(afterCross.every((p) => p.crossed === true), "DB: ambos PMs ahora tienen crossed=true");

    // ─── 5) overlay: isCrossed=true ────────────────────────────────────
    const overlay3 = await authedFetch(opsToken, "GET", `/api/ingenieria/materiales-consolidados/${versionId}/compras-overlay`);
    const shared3 = ((overlay3.body as { items?: Array<{ catalogItemId: string; isCrossed: boolean }> }).items ?? []).find((it) => it.catalogItemId === sharedItem.materialItemId);
    expect(shared3?.isCrossed === true, "Overlay: isCrossed = true (cascada explícita)");

    // ─── 6) Body inválido (ni status ni crossed) → 400 ────────────────
    const badRes = await authedFetch(opsToken, "POST", `/api/ingenieria/materiales-consolidados/${versionId}/items/${sharedItem.materialItemId}/cascade-update`, {});
    expect(badRes.status === 400, "POST cascade-update sin status ni crossed → 400");

    // ─── 7) User con solo VENTAS.VIEW → 403 en cascade-update ─────────
    const tempRole = await prisma.role.create({
      data: {
        id: `role_smoke_cons_${Date.now()}`,
        name: `SMOKE_CONS_${Date.now()}`,
        label: "Smoke consolidador",
        isSystem: false,
        permissions: { create: [{ module: "VENTAS", action: "VIEW" }] },
      },
    });
    const tempUser = await prisma.user.create({
      data: { email: `smoke-cons-${Date.now()}@test.local`, name: "Smoke Cons", password: "x", roleId: tempRole.id },
    });
    try {
      const tempToken = signToken({ id: tempUser.id, email: tempUser.email, name: tempUser.name, role: tempRole.name });
      const forb = await authedFetch(tempToken, "POST", `/api/ingenieria/materiales-consolidados/${versionId}/items/${sharedItem.materialItemId}/cascade-update`, {
        status: "PEDIDO",
      });
      expect(forb.status === 403, "POST cascade-update con solo VENTAS.VIEW → 403", forb);

      const forbOverlay = await authedFetch(tempToken, "GET", `/api/ingenieria/materiales-consolidados/${versionId}/compras-overlay`);
      expect(forbOverlay.status === 403, "GET overlay con solo VENTAS.VIEW → 403");
    } finally {
      await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => undefined);
      await prisma.role.delete({ where: { id: tempRole.id } }).catch(() => undefined);
    }
  } finally {
    // Cleanup: borrar consolidado y restaurar PMs
    await prisma.materialesConsolidadosVersion.delete({ where: { id: versionId } }).catch(() => undefined);
    for (const p of original) {
      await prisma.projectMaterial.update({
        where: { id: p.id },
        data: {
          status: p.status, crossed: p.crossed,
          lastEditedRole: p.lastEditedRole, lastEditedById: p.lastEditedById, lastEditedAt: p.lastEditedAt,
        },
      }).catch(() => undefined);
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
    console.error(`${c.fail} EXCEPCIÓN:`, err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
