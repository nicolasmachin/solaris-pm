// Smoke test del Commit 3: endpoints multi-permiso + lastEdited audit.
// Corre dentro del container con `node --import tsx scripts/smoke-materials-permissions.ts`.
// El script firma JWTs directamente (no usa passwords) y crea un user+rol
// transitorios para validar el 403.

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
  console.log(`${c.info} Smoke test: endpoints materials con multi-permiso`);

  // Encontrar al user OPERACIONES y un proyecto con materiales.
  const opsUser = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "OPERACIONES" } },
    include: { role: { select: { name: true } } },
  });
  if (!opsUser) throw new Error("No hay user OPERACIONES — abortando");

  const ingUser = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "INGENIERIA" } },
    include: { role: { select: { name: true } } },
  });
  if (!ingUser) throw new Error("No hay user INGENIERIA — abortando");

  const projectWithMaterials = await prisma.project.findFirst({
    where: { deletedAt: null, projectMaterials: { some: {} } },
    select: { id: true, code: true, clientName: true },
  });
  if (!projectWithMaterials) throw new Error("No hay proyecto con materiales — abortando");
  console.log(`${c.info} proyecto target: ${projectWithMaterials.code} — ${projectWithMaterials.clientName}`);

  const materialItem = await prisma.materialItem.findFirst({
    where: { activo: true },
    select: { id: true, nombre: true, precioSugerido: true, moneda: true },
  });
  if (!materialItem) throw new Error("No hay materialItem activo — abortando");

  const opsToken = signToken({
    id: opsUser.id,
    email: opsUser.email,
    name: opsUser.name,
    role: opsUser.role.name,
  });

  // ─── 1) GET con OPERACIONES.VIEW ──────────────────────────────────────
  const getRes = await authedFetch(opsToken, "GET", `/api/projects/${projectWithMaterials.id}/materials`);
  expect(getRes.status === 200, "GET con OPERACIONES.VIEW devuelve 200", { status: getRes.status });
  expect(Array.isArray(getRes.body) && (getRes.body as unknown[]).length > 0, "GET devuelve array no vacío");
  const sample = Array.isArray(getRes.body) ? (getRes.body as unknown[])[0] as Record<string, unknown> : null;
  expect(sample !== null && "status" in (sample ?? {}), "Cada item devuelve campo status");
  expect(sample !== null && "crossed" in (sample ?? {}), "Cada item devuelve campo crossed");
  expect(sample !== null && "rowColor" in (sample ?? {}), "Cada item devuelve campo rowColor");
  expect(sample !== null && "addedBy" in (sample ?? {}), "Cada item devuelve campo addedBy (puede ser null)");
  expect(sample !== null && "lastEditedAt" in (sample ?? {}), "Cada item devuelve campo lastEditedAt");
  expect(sample !== null && "lastEditedRole" in (sample ?? {}), "Cada item devuelve campo lastEditedRole");

  // ─── 2) POST con OPERACIONES.EDIT ─────────────────────────────────────
  const tStart = new Date();
  const postRes = await authedFetch(opsToken, "POST", `/api/projects/${projectWithMaterials.id}/materials`, {
    materialItemId: materialItem.id,
    quantity: 7,
  });
  expect(postRes.status === 200 || postRes.status === 201, "POST con OPERACIONES.EDIT crea material", postRes);
  const createdId = (postRes.body as { id?: string }).id ?? null;
  expect(typeof createdId === "string", "POST devuelve id del nuevo material");

  if (createdId) {
    const fromDb = await prisma.projectMaterial.findUnique({
      where: { id: createdId },
      select: {
        status: true, crossed: true, rowColor: true,
        addedById: true, lastEditedAt: true, lastEditedById: true, lastEditedRole: true,
        movementId: true, // confirmar que NO se creó un movement como side-effect
      },
    });
    expect(fromDb?.status === "PENDIENTE", "DB: status default PENDIENTE");
    expect(fromDb?.crossed === false, "DB: crossed default false");
    expect(fromDb?.rowColor === null, "DB: rowColor default null");
    expect(fromDb?.addedById === opsUser.id, "DB: addedById = ops user");
    expect(fromDb?.lastEditedById === opsUser.id, "DB: lastEditedById = ops user");
    expect(fromDb?.lastEditedRole === "OPERACIONES", "DB: lastEditedRole = OPERACIONES");
    expect(
      fromDb?.lastEditedAt instanceof Date && fromDb.lastEditedAt.getTime() >= tStart.getTime() - 1000,
      "DB: lastEditedAt es ~now",
    );
    expect(fromDb?.movementId === null, "DB: no se creó FinanceMovement como side-effect");
  }

  // ─── 3) PATCH cambia status y persiste ────────────────────────────────
  if (createdId) {
    const ingToken = signToken({
      id: ingUser.id, email: ingUser.email, name: ingUser.name, role: ingUser.role.name,
    });
    const tBeforePatch = new Date();
    const patchRes = await authedFetch(ingToken, "PATCH", `/api/projects/${projectWithMaterials.id}/materials/${createdId}`, {
      status: "PEDIDO",
      crossed: true,
      rowColor: "yellow",
    });
    expect(patchRes.status === 200, "PATCH responde 200", patchRes);
    const patchedBody = patchRes.body as { status?: string; crossed?: boolean; rowColor?: string; lastEditedRole?: string };
    expect(patchedBody.status === "PEDIDO", "PATCH body: status=PEDIDO");
    expect(patchedBody.crossed === true, "PATCH body: crossed=true");
    expect(patchedBody.rowColor === "yellow", "PATCH body: rowColor=yellow");
    expect(patchedBody.lastEditedRole === "INGENIERIA", "PATCH body: lastEditedRole=INGENIERIA (cambió de OPS a ING)");

    const after = await prisma.projectMaterial.findUnique({
      where: { id: createdId },
      select: { status: true, crossed: true, rowColor: true, lastEditedById: true, lastEditedRole: true, lastEditedAt: true, addedById: true },
    });
    expect(after?.status === "PEDIDO", "DB: status=PEDIDO");
    expect(after?.crossed === true, "DB: crossed=true");
    expect(after?.rowColor === "yellow", "DB: rowColor=yellow");
    expect(after?.lastEditedById === ingUser.id, "DB: lastEditedById = ing user");
    expect(after?.lastEditedRole === "INGENIERIA", "DB: lastEditedRole=INGENIERIA");
    expect(
      after?.lastEditedAt instanceof Date && after.lastEditedAt.getTime() >= tBeforePatch.getTime() - 1000,
      "DB: lastEditedAt actualizado al PATCH",
    );
    expect(after?.addedById === opsUser.id, "DB: addedById NO cambió (sigue ops)");
  }

  // ─── 4) PATCH con rowColor inválido → 400 ─────────────────────────────
  if (createdId) {
    const badPatch = await authedFetch(opsToken, "PATCH", `/api/projects/${projectWithMaterials.id}/materials/${createdId}`, {
      rowColor: "naranja",
    });
    expect(badPatch.status === 400, "PATCH con rowColor='naranja' → 400", badPatch);
  }

  // ─── 5) Crear user+rol transitorios con solo VENTAS.VIEW → 403 en POST ──
  const tempRole = await prisma.role.create({
    data: {
      id: `role_smoke_${Date.now()}`,
      name: `SMOKE_TEST_${Date.now()}`,
      label: "Smoke test (temp)",
      isSystem: false,
      permissions: {
        create: [{ module: "VENTAS", action: "VIEW" }],
      },
    },
  });
  const tempUser = await prisma.user.create({
    data: {
      email: `smoke-${Date.now()}@test.local`,
      name: "Smoke Test User",
      password: "x", // no se usa, signamos token directo
      roleId: tempRole.id,
    },
  });
  try {
    const tempToken = signToken({ id: tempUser.id, email: tempUser.email, name: tempUser.name, role: tempRole.name });
    const forbiddenPost = await authedFetch(tempToken, "POST", `/api/projects/${projectWithMaterials.id}/materials`, {
      materialItemId: materialItem.id,
      quantity: 1,
    });
    expect(forbiddenPost.status === 403, "POST con solo VENTAS.VIEW → 403", forbiddenPost);

    const forbiddenGet = await authedFetch(tempToken, "GET", `/api/projects/${projectWithMaterials.id}/materials`);
    expect(forbiddenGet.status === 403, "GET con solo VENTAS.VIEW → 403 (no es ni ING ni OPS VIEW)", forbiddenGet);
  } finally {
    await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => undefined);
    await prisma.role.delete({ where: { id: tempRole.id } }).catch(() => undefined);
  }

  // ─── 6) DELETE con OPERACIONES.EDIT borra el material ─────────────────
  if (createdId) {
    const delRes = await authedFetch(opsToken, "DELETE", `/api/projects/${projectWithMaterials.id}/materials/${createdId}`);
    expect(delRes.status === 200, "DELETE con OPERACIONES.EDIT → 200", delRes);
    const stillThere = await prisma.projectMaterial.findUnique({ where: { id: createdId } });
    expect(stillThere === null, "DB: material borrado");
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
