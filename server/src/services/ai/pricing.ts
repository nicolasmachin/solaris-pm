/**
 * Tabla única de precios de IA. Antes cada servicio tenía su propia copia
 * (y el asistente los tenía hardcodeados), así que cambiar de modelo dejaba el
 * costo calculado mal sin que nadie se enterara.
 *
 * Precios en USD por millón de tokens, tarifa de la API de Anthropic.
 * El modelo se busca por prefijo: así matchean tanto el alias
 * (`claude-sonnet-4-5`) como el ID con fecha (`claude-sonnet-4-5-20250929`).
 * Los prefijos más largos van primero para que `claude-opus-5-5` no caiga en
 * `claude-opus-5`.
 *
 * Caché: leer cuesta 0,1× el input; escribir cuesta 1,25× (TTL 5 min) o
 * 2× (TTL 1 h). La respuesta de la API no discrimina el TTL en el total, así
 * que se cobra la escritura a 1,25×, que es lo que usa el caché por defecto.
 *
 * Un modelo que no está en la tabla devuelve `null`: mejor un costo
 * desconocido a la vista que uno inventado.
 */

type PrecioModelo = { input: number; output: number };

const PRECIOS_ANTHROPIC: Array<[prefijo: string, precio: PrecioModelo]> = [
  ["claude-fable-5-1", { input: 10, output: 50 }],
  ["claude-fable-5", { input: 10, output: 50 }],
  ["claude-opus-5-5", { input: 4, output: 20 }],
  ["claude-opus-5", { input: 5, output: 25 }],
  ["claude-opus-4-8", { input: 5, output: 25 }],
  ["claude-opus-4-7", { input: 5, output: 25 }],
  ["claude-opus-4-6", { input: 5, output: 25 }],
  ["claude-sonnet-5", { input: 2, output: 10 }],
  ["claude-sonnet-4-6", { input: 3, output: 15 }],
  ["claude-sonnet-4-5", { input: 3, output: 15 }],
  ["claude-haiku-4-5", { input: 1, output: 5 }],
];

const FACTOR_CACHE_LECTURA = 0.1;
const FACTOR_CACHE_ESCRITURA = 1.25;

/** Whisper de OpenAI: USD por minuto de audio. */
const PRECIO_WHISPER_POR_MINUTO: Record<string, number> = {
  "whisper-1": 0.006,
};

export type UsoTokens = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
};

function precioDe(model: string): PrecioModelo | null {
  const hit = PRECIOS_ANTHROPIC.find(([prefijo]) => model.startsWith(prefijo));
  return hit ? hit[1] : null;
}

export function costoAnthropic(model: string, uso: UsoTokens): number | null {
  const precio = precioDe(model);
  if (!precio) {
    console.warn(`[ai/pricing] Modelo sin precio en la tabla: ${model}`);
    return null;
  }
  const porToken = (usdPorMillon: number) => usdPorMillon / 1_000_000;
  return (
    uso.input * porToken(precio.input) +
    uso.output * porToken(precio.output) +
    (uso.cacheRead ?? 0) * porToken(precio.input * FACTOR_CACHE_LECTURA) +
    (uso.cacheWrite ?? 0) * porToken(precio.input * FACTOR_CACHE_ESCRITURA)
  );
}

export function costoWhisper(model: string, segundos: number): number | null {
  const porMinuto = PRECIO_WHISPER_POR_MINUTO[model];
  if (porMinuto === undefined) {
    console.warn(`[ai/pricing] Modelo de audio sin precio en la tabla: ${model}`);
    return null;
  }
  return (segundos / 60) * porMinuto;
}
