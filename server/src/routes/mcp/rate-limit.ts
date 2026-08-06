// Límite de intentos en memoria para el flujo de autorización.
//
// El resto de la API no tiene rate limit porque vive detrás del login y de un
// frontend propio. El `POST /oauth/authorize` es distinto: valida contraseñas
// contra pedidos que llegan de internet, así que sin freno es un blanco para
// probar credenciales a repetición.
//
// Es por proceso y en memoria: se pierde al reiniciar y no se comparte entre
// instancias. Alcanza para lo que protege; si algún día hay varias instancias
// del servidor, hay que moverlo a la base o a un Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Cada cuánto se reinicia la cuenta de intentos. */
const WINDOW_MS = 10 * 60 * 1000;

/** Intentos permitidos por ventana. */
const MAX_ATTEMPTS = 10;

/**
 * Registra un intento y dice si hay que rechazarlo. La clave conviene que
 * combine IP y email: así un atacante que rota emails desde una IP choca con
 * el límite igual, y alguien que se equivoca de contraseña no bloquea a otros.
 */
export function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_ATTEMPTS;
}

/** Limpia el registro tras un intento exitoso. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}

/** Descarta las ventanas vencidas para que el Map no crezca sin techo. */
export function pruneRateLimitBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
