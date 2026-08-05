/**
 * Cola de trabajos de video, en memoria y estrictamente serial.
 *
 * **Concurrencia 1 a propósito.** Cada transcodificación usa 2 de los 4 cores del
 * VPS; dos en paralelo saturarían la máquina y dejarían al event loop de Fastify
 * sin CPU, con la app entera lenta para todos. Con el volumen real (unos pocos
 * videos por día) una cola serial no genera ninguna espera perceptible.
 *
 * No usa Redis ni BullMQ: no hay Redis en el stack y montar uno para este volumen
 * sería infraestructura sin contrapartida. El costo de la simplicidad es que la
 * cola muere con el proceso — de ahí que cada consumidor deba reencolar sus
 * trabajos pendientes al arrancar (ver `recoverPendingProjectVideos`).
 */

interface QueuedJob {
  key: string;
  run: () => Promise<void>;
}

const pending: QueuedJob[] = [];
const queuedKeys = new Set<string>();
let running = false;

/**
 * Encola un trabajo. `key` deduplica: si ese trabajo ya está esperando, la
 * llamada se ignora (evita que dos requests seguidos procesen el mismo video).
 *
 * No devuelve el resultado del trabajo a propósito: el llamador responde al
 * request enseguida y el estado se sigue por la fila en la base.
 */
export function enqueueVideoJob(key: string, run: () => Promise<void>): void {
  if (queuedKeys.has(key)) return;
  queuedKeys.add(key);
  pending.push({ key, run });
  void drain();
}

export function videoQueueSize(): number {
  return pending.length + (running ? 1 : 0);
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;

  try {
    while (pending.length > 0) {
      const job = pending.shift();
      if (!job) break;
      queuedKeys.delete(job.key);

      try {
        await job.run();
      } catch (error) {
        // El trabajo es responsable de registrar su propio fallo en la base. Acá
        // solo se evita que una excepción corte la cola y deje trabados a los
        // trabajos que vienen atrás.
        console.error(`[video-queue] el trabajo ${job.key} falló:`, error);
      }
    }
  } finally {
    running = false;
  }
}
