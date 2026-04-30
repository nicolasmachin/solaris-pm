/**
 * Validador de SQL para el Asistente IA.
 *
 * Verifica que el SQL generado por el modelo cumpla con:
 *   1. Empieza con SELECT o WITH (read-only).
 *   2. No contiene palabras clave de mutación (INSERT, UPDATE, DELETE, etc.).
 *   3. No accede a tablas sensibles (audit_logs, ai_queries, etc.).
 *   4. Es un solo statement (no múltiples queries separadas por `;`).
 *
 * NOTA: estas validaciones son una capa defensiva. El usuario PG `voltia_readonly`
 * que ejecuta la query NO tiene permisos de escritura ni de SELECT sobre las
 * tablas sensibles, así que aunque alguna query maliciosa pase el validador,
 * Postgres la rechazaría. Doble cinturón.
 */

const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
  "TRUNCATE", "CREATE", "GRANT", "REVOKE",
  "EXECUTE", "CALL", "COPY", "MERGE",
  "VACUUM", "ANALYZE",
];

const FORBIDDEN_PATTERNS = [
  /\bpg_\w+/i,             // pg_user, pg_catalog, pg_proc, etc.
  /\binformation_schema\b/i,
];

const FORBIDDEN_TABLES = [
  "audit_logs",
  "ai_queries",
  "ai_rate_limits",
  "file_attachments",
  "user_notification_preferences",
  "_prisma_migrations",
  // No accesibles aunque no sean estrictamente sensibles
  "permissions",
  "settings",
];

export type SQLValidationResult = { valid: true } | { valid: false; error: string };

export function validateSQL(sql: string): SQLValidationResult {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, error: "SQL vacío" };

  // 1. Sólo un statement: limpiamos comentarios + strings y partimos por `;`.
  const cleaned = trimmed
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  const stmts = cleaned.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  if (stmts.length > 1) {
    return { valid: false, error: "Sólo se permite un statement por consulta" };
  }

  // 2. Palabra de inicio: SELECT o WITH.
  const firstWord = (cleaned.trim().match(/^\w+/)?.[0] ?? "").toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    return { valid: false, error: "Sólo se permiten queries SELECT o WITH" };
  }

  // 3. Palabras prohibidas (whole-word).
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(cleaned)) {
      return { valid: false, error: `Palabra prohibida en SQL: ${kw}` };
    }
  }

  // 4. Patrones prohibidos (pg_*, information_schema).
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(cleaned)) {
      return { valid: false, error: `Acceso a metadatos no permitido (${re.source})` };
    }
  }

  // 5. Tablas prohibidas.
  for (const t of FORBIDDEN_TABLES) {
    const re = new RegExp(`\\b${t}\\b`, "i");
    if (re.test(cleaned)) {
      return { valid: false, error: `Tabla no accesible: ${t}` };
    }
  }

  return { valid: true };
}

/** Asegura que el SQL tenga LIMIT. Si no, agrega `LIMIT maxRows`. */
export function ensureLimit(sql: string, maxRows = 500): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (/\bLIMIT\b/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${maxRows}`;
}
