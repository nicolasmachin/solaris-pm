/**
 * Asistente IA con Text-to-SQL.
 *
 * Pipeline:
 *   1. Pregunta del usuario → generar SQL con Claude (system prompt con schema).
 *   2. Validar SQL contra reglas de seguridad (validateSQL).
 *   3. Ejecutar con usuario PG read-only (DATABASE_URL_READONLY).
 *   4. Resumir resultado a lenguaje natural con Claude.
 *
 * Rate limiting + audit log se manejan en el endpoint que invoca a este service.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";

import { ensureLimit, validateSQL } from "./ai-sql-validator.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATABASE_URL_READONLY = process.env.DATABASE_URL_READONLY;

if (!ANTHROPIC_API_KEY) {
  // No tiramos error en import: el endpoint chequea y devuelve 503 si falta.
  // eslint-disable-next-line no-console
  console.warn("[ai-assistant] ANTHROPIC_API_KEY no seteada — el assistant estará deshabilitado.");
}
if (!DATABASE_URL_READONLY) {
  // eslint-disable-next-line no-console
  console.warn("[ai-assistant] DATABASE_URL_READONLY no seteada — el assistant estará deshabilitado.");
}

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no configurada");
  if (!anthropic) anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropic;
}

// Lazy-init del pool: si el .env todavía no tiene DATABASE_URL_READONLY no rompemos al boot.
let readonlyPool: Pool | null = null;
function getReadonlyPool(): Pool {
  if (!DATABASE_URL_READONLY) throw new Error("DATABASE_URL_READONLY no configurada");
  if (!readonlyPool) {
    readonlyPool = new Pool({ connectionString: DATABASE_URL_READONLY, max: 4 });
  }
  return readonlyPool;
}

export function isAIAssistantEnabled(): boolean {
  return !!ANTHROPIC_API_KEY && !!DATABASE_URL_READONLY;
}

const DB_SCHEMA = `
-- Voltia PM - Schema simplificado (PostgreSQL)
-- Empresa de instalaciones fotovoltaicas en Uruguay.
-- IMPORTANTE: tablas y columnas usan camelCase con comillas dobles (estilo Prisma).
-- Ejemplo: "tipoMovimiento", "fechaSaldoInicial", "deletedAt".

-- Cuentas (bancos / efectivo)
TABLE accounts (
  id text PK, nombre text, tipo "AccountType",
  moneda "Moneda", "saldoInicial" numeric, "fechaSaldoInicial" date,
  activa boolean, "deletedAt" timestamp
);
-- enums:
-- "AccountType": BANCO | EFECTIVO | TARJETA | OTRO
-- "Moneda": USD | UYU

-- Movimientos financieros (gastos / ingresos / ajustes)
TABLE finance_movements (
  id text PK,
  fecha timestamp,
  "tipoMovimiento" "TipoMovimiento",   -- INGRESO | GASTO | AJUSTE
  "categoriaPrincipal" "CategoriaPrincipal",
  status "FinanceMovementStatus",      -- PREVISTO | COMPROMETIDO | A_PAGAR | PARCIALMENTE_PAGADO | PAGADO
  cobrado boolean, pagado boolean,
  monto numeric, moneda "Moneda", "tipoCambio" numeric, "ivaTasa" double precision,
  descripcion text,
  "projectId" text FK -> projects.id,
  "supplierId" text FK -> suppliers.id,
  "accountId" text FK -> accounts.id,
  "deletedAt" timestamp
);
-- "CategoriaPrincipal": FIJO | VARIABLE | PROYECTO_ENTRADA | PROYECTO_SALIDA | COMPRA_STOCK | CONSUMO_STOCK | PAGO_PROVEEDOR | COBRO_CLIENTE | AJUSTE_CONCILIACION | OTRO

-- Pagos a proveedores (Payment + PaymentApplication)
TABLE payments (
  id text PK, "supplierId" text FK, fecha date,
  monto numeric, moneda "Moneda", metodo "MetodoPago",
  referencia text, "accountId" text FK, "deletedAt" timestamp
);
TABLE payment_applications (
  id text PK, "paymentId" text FK, "movementId" text FK,
  "montoAplicado" numeric
);

-- Proyectos
TABLE projects (
  id text PK, code text UNIQUE, "clientName" text,
  "capacityKwp" numeric, "budgetUsd" numeric, "executedUsd" numeric,
  status "ProjectStatus", "startDate" date, "actualEndDate" date,
  "deletedAt" timestamp
);
-- "ProjectStatus": PROSPECT | ACTIVE | COMPLETED | PAUSED | ARCHIVED

-- Etapas y subetapas
TABLE stages (
  id text PK, "projectId" text FK, name "StageType",
  status "StageStatus", "startDate" date, "endDate" date, "deletedAt" timestamp
);
TABLE substages (
  id text PK, "stageId" text FK, "projectId" text FK, name text,
  status "SubstageStatus", "plannedEndDate" date, "actualEndDate" date,
  "assignedToId" text FK, deadline date, "deletedAt" timestamp
);
-- "StageType": ONBOARDING | INGENIERIA | OPERACIONES | HABILITACION_UTE | POSTVENTA
-- "StageStatus" / "SubstageStatus": PENDING | IN_PROGRESS | COMPLETED | BLOCKED

-- Proveedores y clientes
TABLE suppliers (
  id text PK, nombre text, rut text, email text, telefono text,
  activo boolean, "deletedAt" timestamp
);

-- Stock
TABLE material_categories (id text PK, nombre text, activa boolean);
TABLE material_items (
  id text PK, "categoryId" text FK, nombre text, unidad text,
  "precioSugerido" numeric, moneda "Moneda", "stockActual" numeric,
  activo boolean, "deletedAt" timestamp
);
TABLE stock_movements (
  id text PK, fecha timestamp, "materialItemId" text FK,
  tipo "TipoMovimientoStock", cantidad numeric, "costoUnitario" numeric,
  "stockResultante" numeric, "supplierId" text FK
);

-- Cambio
TABLE exchange_rates (id text PK, date timestamp, "usdToUyu" numeric);

-- Tareas
TABLE tasks (
  id text PK, "projectId" text FK, "assignedToId" text FK,
  title text, description text, status "TaskStatus", priority "TaskPriority",
  "dueDate" date, "deletedAt" timestamp
);

-- Conciliaciones bancarias
TABLE account_reconciliations (
  id text PK, "accountId" text FK, fecha date,
  "saldoReal" numeric, "saldoCalculado" numeric, diferencia numeric,
  "createdAt" timestamp
);

-- Roles + usuarios (sólo lectura básica)
TABLE roles (id text PK, name text, label text);
TABLE users (
  id text PK, email text, name text, "roleId" text FK,
  "deletedAt" timestamp
);

-- ─── Reglas y convenciones ───────────────────────────────────────────────
-- 1. SIEMPRE filtrar "deletedAt" IS NULL en tablas con soft-delete.
-- 2. Para "saldo" de cuentas: saldoInicial + INGRESO/cobrado=true - GASTO/pagado=true sin Payment - Payments,
--    todos con fecha > "fechaSaldoInicial" (estrictamente).
-- 3. Para "facturas pendientes": tipoMovimiento=GASTO, status IN (A_PAGAR, PARCIALMENTE_PAGADO).
-- 4. Para "cobros del mes": tipoMovimiento=INGRESO, cobrado=true, fecha en el mes.
-- 5. Anti-doble-conteo en gastos: si un GASTO PAGADO tiene PaymentApplication activa, NO se cuenta vía gasto directo (lo cuenta el Payment).
-- 6. Excluir "categoriaPrincipal"='AJUSTE_CONCILIACION' al calcular ingresos/gastos operativos (son correcciones contables).

-- ─── Ejemplos ────────────────────────────────────────────────────────────
-- ¿Cuánto cobré en abril de 2026?
SELECT COALESCE(SUM(monto),0) FROM finance_movements
WHERE "tipoMovimiento"='INGRESO' AND cobrado=true
  AND fecha >= '2026-04-01' AND fecha < '2026-05-01'
  AND "categoriaPrincipal" != 'AJUSTE_CONCILIACION'
  AND "deletedAt" IS NULL;

-- Top 5 proveedores con facturas a pagar:
SELECT s.nombre, COUNT(*) AS cant, SUM(m.monto) AS total
FROM finance_movements m JOIN suppliers s ON s.id = m."supplierId"
WHERE m."tipoMovimiento"='GASTO' AND m.status IN ('A_PAGAR','PARCIALMENTE_PAGADO')
  AND m."deletedAt" IS NULL
GROUP BY s.id, s.nombre ORDER BY total DESC LIMIT 5;
`;

const SYSTEM_GENERATE_SQL = `Sos un asistente experto en SQL para PostgreSQL.
La DB es de Voltia PM, empresa de instalaciones fotovoltaicas en Uruguay.

${DB_SCHEMA}

REGLAS IMPORTANTES:
1. Sólo generás queries SELECT (read-only). NUNCA INSERT/UPDATE/DELETE.
2. SIEMPRE filtrar "deletedAt" IS NULL en tablas con soft-delete.
3. Identificadores con camelCase van entre comillas dobles: "tipoMovimiento", "deletedAt", etc.
4. Limitá los resultados con LIMIT 100 si es razonable (la app forzará LIMIT 500 igual).
5. Para fechas, usá ISO ('2026-04-01').
6. Si la pregunta no se puede responder con SQL (ej. requiere lógica de negocio compleja, datos no en DB), devolvé exactamente: "CANNOT_GENERATE".

Respondé SOLO con el SQL puro, sin markdown, sin comentarios, sin "\`\`\`sql".
Si no podés generar, sólo "CANNOT_GENERATE".`;

const SYSTEM_NATURAL_RESPONSE = `Sos un asistente de Voltia PM que responde preguntas sobre datos.
Recibís la pregunta del usuario y el resultado JSON de la query SQL.

Tu respuesta debe ser:
- Clara y concisa, en español rioplatense.
- Números formateados (ej: USD 1.234,56 — siempre USD si la columna es en USD).
- Fechas en formato dd/mm/yyyy.
- Si hay muchos resultados, resumí los más importantes y mencionalos por nombre.
- Si el resultado es vacío o nulo, decilo claro ("no hay registros que cumplan...").
- NO menciones la query SQL ni JSON técnico — sólo la respuesta natural.`;

const MODEL_ID = "claude-sonnet-4-5";
// Pricing aproximado (Sonnet 4.5/4.6, USD por 1M tokens). Ajustable.
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

export type ProcessQuestionResult = {
  generatedSQL: string;
  result: unknown;
  rowCount: number;
  response: string;
  tokens: { input: number; output: number };
  costUSD: number;
};

export class AICannotGenerateError extends Error {
  constructor() {
    super("No pude generar SQL para esta pregunta. Reformulala o sé más específico.");
    this.name = "AICannotGenerateError";
  }
}

export class AISQLInvalidError extends Error {
  generatedSQL: string;
  constructor(generatedSQL: string, validationError: string) {
    super(`SQL generado inválido: ${validationError}`);
    this.name = "AISQLInvalidError";
    this.generatedSQL = generatedSQL;
  }
}

export class AIExecutionError extends Error {
  generatedSQL: string;
  constructor(generatedSQL: string, dbError: string) {
    super(`Error al ejecutar la query: ${dbError}`);
    this.name = "AIExecutionError";
    this.generatedSQL = generatedSQL;
  }
}

export async function processQuestion(question: string): Promise<ProcessQuestionResult> {
  if (!isAIAssistantEnabled()) {
    throw new Error("El assistant IA no está configurado. Falta ANTHROPIC_API_KEY o DATABASE_URL_READONLY.");
  }
  const ai = getAnthropic();
  const pool = getReadonlyPool();

  // Fase 1: generar SQL.
  const sqlResp = await ai.messages.create({
    model: MODEL_ID,
    max_tokens: 1500,
    system: SYSTEM_GENERATE_SQL,
    messages: [{ role: "user", content: question }],
  });
  const sqlText = sqlResp.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:sql)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (sqlText === "CANNOT_GENERATE" || !sqlText) {
    throw new AICannotGenerateError();
  }

  // Fase 2: validar SQL.
  const v = validateSQL(sqlText);
  if (!v.valid) {
    throw new AISQLInvalidError(sqlText, v.error);
  }
  const safeSQL = ensureLimit(sqlText, 500);

  // Fase 3: ejecutar con readonly pool.
  let rows: unknown[] = [];
  try {
    const result = await pool.query(safeSQL);
    rows = result.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    throw new AIExecutionError(safeSQL, msg);
  }

  // Fase 4: respuesta natural.
  // Truncamos JSON grande para no quemar tokens.
  const sample = rows.length > 50 ? rows.slice(0, 50) : rows;
  const truncatedNote = rows.length > 50 ? `\n(Mostrando primeras 50 filas de ${rows.length} totales.)` : "";
  const userMsg = `Pregunta: ${question}\n\nResultado de la query SQL (${rows.length} filas):\n${JSON.stringify(sample, null, 2)}${truncatedNote}\n\nRespondé en español rioplatense, claro y conciso.`;

  const respGen = await ai.messages.create({
    model: MODEL_ID,
    max_tokens: 1200,
    system: SYSTEM_NATURAL_RESPONSE,
    messages: [{ role: "user", content: userMsg }],
  });
  const naturalResponse = respGen.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("")
    .trim() || "No pude generar una respuesta a partir de los datos.";

  // Cálculo de costo / tokens combinados.
  const tokensInput = sqlResp.usage.input_tokens + respGen.usage.input_tokens;
  const tokensOutput = sqlResp.usage.output_tokens + respGen.usage.output_tokens;
  const costUSD = (tokensInput * PRICE_INPUT_PER_M / 1_000_000) + (tokensOutput * PRICE_OUTPUT_PER_M / 1_000_000);

  return {
    generatedSQL: safeSQL,
    result: rows,
    rowCount: rows.length,
    response: naturalResponse,
    tokens: { input: tokensInput, output: tokensOutput },
    costUSD,
  };
}
