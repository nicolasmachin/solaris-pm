// Estructura de los snapshots congelados en EFPVersion.
// Cada versión del Proyecto Final de Ingeniería guarda copia de los datos
// relevantes del momento, para que el PDF generado en cualquier fecha futura
// muestre lo mismo que mostraba el día que se aprobó.
//
// El consumidor del PDF (Fase B) lee primero el snapshot; si está null
// (versiones legacy sin backfillear o antes de la migración), cae al fallback
// de re-leer DB. Después del backfill, todos los EFPVersion deberían tener
// snapshots no-null.

export type SnapshotProject = {
  id: string;
  code: string | null;
  clientName: string;
  clientAddress: string | null;
  locationCity: string | null;
  locationProvince: string | null;
  capacityKwp: number | null;
  notificationEmail: string | null;
  capturedAt: string; // ISO timestamp del momento del snapshot
};

export type SnapshotPreIng = {
  versionId: string | null;
  version: number | null;
  cantidadPaneles: number | null;
  potenciaPanelesW: number | null;
  inversor: string | null;
  capturedAt: string;
};

export type SnapshotUte = {
  caseNumber: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  capturedAt: string;
};

export type SnapshotMaterials = {
  items: Array<{
    materialItemId: string;
    description: string;
    quantity: number;
    unit: string | null;
  }>;
  capturedAt: string;
};

/**
 * Parser tolerante para `PreIngenieriaVersion.potenciaPaneles` (free text
 * legacy). Detecta unidad kW y convierte a watts; sin unidad asume W.
 * Devuelve null si no encuentra ningún número.
 *
 * Casos cubiertos:
 *   "570 W"  → 570
 *   "5 kW"   → 5000
 *   "590"    → 590
 *   "5,5kW"  → 5500
 *   "abc"    → null
 *
 * Salvaguarda: valores < 50 sin unidad son sospechosos (un panel real entrega
 * 200-700W) — el script de pre-migración los reporta pero NO los descarta.
 * La salvaguarda final queda en la UI/Zod, no acá.
 */
export function parsePotenciaPanelesW(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  // Si Prisma ya devuelve number (post-migración a Int?), pasamos directo.
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const match = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(kw|w)?/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = match[2];
  if (unit === "kw") return Math.round(value * 1000);
  return Math.round(value);
}

/**
 * Parser de `cantidadPaneles` (string free-text). Saca el primer entero.
 * "9" → 9; "9 paneles" → 9; "abc" → null.
 */
export function parseCantidadPaneles(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const match = String(raw).trim().match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}
