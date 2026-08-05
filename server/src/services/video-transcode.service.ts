import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";

import { env } from "../config/env.js";

/**
 * Compresión de videos de ensayos (anti-isla, encendido) con ffmpeg.
 *
 * Un video crudo de celular pesa ~150 MB/min (más si es 4K60). El mismo video
 * recomprimido con el perfil de acá queda en ~6-23 MB/min según cuánto movimiento
 * tenga. Eso es lo que hace viable guardar la evidencia de forma permanente en el
 * disco del VPS en vez de necesitar object storage.
 *
 * El perfil de salida está elegido para dos requisitos que compiten:
 *
 * 1. **Se tiene que leer el display del inversor.** Es el contenido informativo
 *    del video; si los caracteres del LCD se emborronan, el archivo no sirve como
 *    evidencia. Por eso 720p (480p no alcanza) y CRF 21 (más nítido que el 23 por
 *    defecto de x264).
 * 2. **Se tiene que poder abrir dentro de diez años en cualquier máquina.** Por eso
 *    H.264 High@4.0 y no HEVC/AV1, que comprimen mejor pero no reproducen en
 *    Chrome/Linux ni en muchos escritorios corporativos.
 */

const TRANSCODE_TIMEOUT_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 60 * 1000;

/** Transferencias de color que indican HDR y requieren tonemapping a SDR. */
const HDR_TRANSFERS = new Set(["arib-std-b67", "smpte2084"]);

export interface VideoProbe {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codecName: string | null;
  colorTransfer: string | null;
  isHdr: boolean;
  /** Cuadros por segundo reales. Ver `parseFrameRate` para por qué no es trivial. */
  fps: number | null;
  pixFmt: string | null;
  /** Salida cruda de ffprobe, se persiste como parte de la cadena de custodia. */
  raw: unknown;
}

export interface TranscodeResult {
  sizeBytes: number;
  sha256: string;
}

/** Error con causa legible para mostrar en la UI y persistir en processingError. */
export class VideoProcessingError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

/**
 * Corre un binario con argv (NUNCA un string de shell: los nombres de archivo
 * vienen del usuario). Mata el proceso si supera el timeout — un container
 * corrupto puede colgar a ffmpeg indefinidamente y dejar un job trabado para
 * siempre.
 */
function run(
  command: string,
  args: string[],
  { timeoutMs, label }: { timeoutMs: number; label: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      // ffmpeg escribe todo su log por stderr, incluso cuando termina bien.
      // Se acumula solo la cola: un video largo genera cientos de líneas de
      // progreso que no aportan nada al diagnóstico.
      stderr = (stderr + String(chunk)).slice(-4000);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new VideoProcessingError(
          `No se pudo ejecutar ${command}`,
          err instanceof Error ? err.message : String(err),
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new VideoProcessingError(
            `El procesamiento del video superó el tiempo máximo (${Math.round(timeoutMs / 60000)} min)`,
            label,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(new VideoProcessingError(`${label} falló (código ${code})`, stderr.trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

/** Lee metadata del video: duración, dimensiones, codec y espacio de color. */
export async function probeVideo(absolutePath: string): Promise<VideoProbe> {
  const stdout = await run(
    env.ffprobePath,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name,color_transfer,color_primaries,r_frame_rate,avg_frame_rate,pix_fmt",
      "-show_entries",
      "format=duration,format_name,bit_rate",
      "-of",
      "json",
      absolutePath,
    ],
    { timeoutMs: PROBE_TIMEOUT_MS, label: "ffprobe" },
  );

  let parsed: {
    streams?: Array<{
      width?: number;
      height?: number;
      codec_name?: string;
      color_transfer?: string;
      pix_fmt?: string;
      r_frame_rate?: string;
      avg_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new VideoProcessingError("No se pudo leer la información del video", stdout.slice(0, 500));
  }

  const stream = parsed.streams?.[0];
  if (!stream) {
    throw new VideoProcessingError(
      "El archivo no contiene una pista de video",
      "ffprobe no encontró ningún stream de video",
    );
  }

  const duration = Number(parsed.format?.duration);
  const colorTransfer = stream.color_transfer ?? null;

  return {
    durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
    width: stream.width ?? null,
    height: stream.height ?? null,
    codecName: stream.codec_name ?? null,
    colorTransfer,
    isHdr: colorTransfer != null && HDR_TRANSFERS.has(colorTransfer),
    // `avg_frame_rate` primero: en los videos que sube iOS, `r_frame_rate`
    // devuelve el timebase del contenedor (90000) en vez de los cuadros por
    // segundo, y tomarlo en serio lleva a decisiones absurdas.
    fps: parseFrameRate(stream.avg_frame_rate) ?? parseFrameRate(stream.r_frame_rate),
    pixFmt: stream.pix_fmt ?? null,
    raw: parsed,
  };
}

/**
 * Convierte una fracción tipo "30000/1001" a número, descartando valores que no
 * pueden ser un framerate real (ffprobe devuelve "0/0" cuando no lo sabe, y el
 * timebase 90000/1 cuando el contenedor no lo declara).
 */
function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;

  const fps = num / den;
  return fps > 0 && fps <= 240 ? fps : null;
}

/**
 * Cadena de filtros de video.
 *
 * `scale` capea el lado largo en 1280 respetando aspecto **y orientación**: un
 * video vertical de 1080x1920 sale 720x1280, uno horizontal sale 1280x720.
 * `force_divisible_by=2` es obligatorio para yuv420p (que exige dimensiones pares).
 *
 * `fps=30` porque muchos celulares graban a 60: bajarlo corta el bitrate a la
 * mitad sin perder nada de legibilidad en un plano casi estático.
 */
/** Lado largo máximo del video de archivo. */
const MAX_LADO = 1280;

/** Cuadros por segundo máximos. */
const MAX_FPS = 30;

/**
 * Bits por píxel y por cuadro que se le permiten al video de archivo.
 *
 * Es lo que define cuánto termina pesando, y **tiene que ser proporcional a la
 * resolución**: un techo fijo (antes eran 3 Mbps, pensados para 720p) no
 * comprime nada cuando el video ya viene chico. Los que sube un iPhone desde la
 * fototeca llegan transcodificados por iOS a ~478x850 y ~1,5 Mbps: con el techo
 * viejo entraban enteros y salían pesando casi lo mismo.
 *
 * 0,05 bpp da ~1,4 Mbps en 720p y ~600 kbps en 478x850. Alcanza de sobra para
 * contenido de obra, que tiene poco movimiento.
 */
const BITS_POR_PIXEL = 0.05;

const MIN_BITRATE_KBPS = 350;
const MAX_BITRATE_KBPS = 3000;

/** Dimensiones que va a tener la salida después del escalado. */
function dimensionesDeSalida(probe: VideoProbe): { width: number; height: number } {
  const w = probe.width ?? 1280;
  const h = probe.height ?? 720;
  const ladoLargo = Math.max(w, h);

  if (ladoLargo <= MAX_LADO) return { width: w, height: h };

  const factor = MAX_LADO / ladoLargo;
  // Pares: yuv420p no admite dimensiones impares.
  return {
    width: Math.round((w * factor) / 2) * 2,
    height: Math.round((h * factor) / 2) * 2,
  };
}

/** Techo de bitrate en kbps, según la resolución y los cuadros de salida. */
function maxBitrateKbps(probe: VideoProbe): number {
  const { width, height } = dimensionesDeSalida(probe);
  const fps = Math.min(probe.fps ?? MAX_FPS, MAX_FPS);
  const bitrate = (width * height * fps * BITS_POR_PIXEL) / 1000;

  return Math.round(Math.min(Math.max(bitrate, MIN_BITRATE_KBPS), MAX_BITRATE_KBPS));
}

function buildVideoFilter(probe: VideoProbe): string {
  // El filtro `fps` solo se aplica si el video viene a más de 30: agregarlo
  // cuando ya está en 30 o menos hace trabajo de más y puede duplicar cuadros.
  const necesitaBajarFps = (probe.fps ?? 0) > MAX_FPS;
  const scaleAndFps =
    `scale='min(${MAX_LADO},iw)':'min(${MAX_LADO},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2` +
    (necesitaBajarFps ? `,fps=${MAX_FPS}` : "");

  if (!probe.isHdr) return scaleAndFps;

  // Los iPhone recientes graban en Dolby Vision / HLG de 10 bits. Una conversión
  // directa a SDR deja el video lavado y grisáceo — justo lo que arruina la
  // legibilidad de un display. El tonemapping preserva el contraste.
  const tonemap = [
    "zscale=t=linear:npl=100",
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=tonemap=hable:desat=0",
    "zscale=t=bt709:m=bt709:r=tv",
    "format=yuv420p",
  ].join(",");

  return `${tonemap},${scaleAndFps}`;
}

/**
 * Comprime el video al perfil estándar de archivo.
 *
 * Corre bajo `nice` para que el kernel le dé prioridad a Fastify y a Postgres: en
 * un VPS de 4 cores, una transcodificación sin ceder CPU se nota en la latencia de
 * toda la app.
 */
export async function transcodeToStandard(
  inputPath: string,
  outputPath: string,
  probe: VideoProbe,
): Promise<TranscodeResult> {
  const maxBitrate = maxBitrateKbps(probe);

  const ffmpegArgs = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
    "-vf",
    buildVideoFilter(probe),
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-preset",
    "medium",
    "-crf",
    "23",
    // Techo duro, proporcional a la resolución de salida (ver BITS_POR_PIXEL).
    // Es lo que efectivamente hace que el archivo pese poco: el CRF por sí solo
    // reproduce la calidad de la fuente, y si la fuente ya venía comprimida
    // termina gastando bits en preservar sus propios artefactos.
    "-maxrate",
    `${maxBitrate}k`,
    "-bufsize",
    `${maxBitrate * 2}k`,
    // Sin forzar 8 bits 4:2:0, el MP4 que sale de un original HEVC de 10 bits no
    // reproduce en Safari ni en QuickTime.
    "-pix_fmt",
    "yuv420p",
    // Keyframe cada 2 segundos: sin esto, adelantar el video es pastoso.
    "-g",
    "60",
    // El audio NO se descarta: la narración del operario ("abro el interruptor, el
    // inversor desconecta a los dos segundos") es parte de la evidencia del ensayo.
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-ac",
    "1",
    // Mueve el índice al principio del archivo. Sin esto el navegador tiene que
    // bajar el archivo entero antes del primer frame y los range requests no
    // sirven de nada.
    "-movflags",
    "+faststart",
    // Deja 2 de los 4 cores libres para el resto de la app.
    "-threads",
    "2",
    outputPath,
  ];

  await run("nice", ["-n", "10", env.ffmpegPath, ...ffmpegArgs], {
    timeoutMs: TRANSCODE_TIMEOUT_MS,
    label: "ffmpeg (compresión)",
  });

  const original = await fsPromises.stat(inputPath);
  let stats = await fsPromises.stat(outputPath);

  // Red de seguridad: si el "comprimido" no achicó nada, guardar eso sería
  // perder calidad a cambio de nada. Cuando el original ya cumple el perfil de
  // archivo (H.264 8 bits), se lo remuxea con +faststart y se usa tal cual.
  if (stats.size >= original.size && puedeUsarseSinRecodificar(probe)) {
    const remuxPath = `${outputPath}.remux.mp4`;
    try {
      await run(
        "nice",
        [
          "-n",
          "10",
          env.ffmpegPath,
          ...["-hide_banner", "-nostdin", "-y", "-i", inputPath],
          ...["-c", "copy", "-movflags", "+faststart", remuxPath],
        ],
        { timeoutMs: TRANSCODE_TIMEOUT_MS, label: "ffmpeg (remux)" },
      );

      const remuxStats = await fsPromises.stat(remuxPath);
      if (remuxStats.size < stats.size) {
        await fsPromises.rename(remuxPath, outputPath);
        stats = await fsPromises.stat(outputPath);
      } else {
        await fsPromises.unlink(remuxPath).catch(() => undefined);
      }
    } catch {
      // El remux es una mejora oportunista: si falla, el comprimido sirve igual.
      await fsPromises.unlink(remuxPath).catch(() => undefined);
    }
  }

  const sha256 = await sha256File(outputPath);
  return { sizeBytes: stats.size, sha256 };
}

/**
 * ¿El original se puede servir tal cual, sin recodificar?
 *
 * Solo si ya es H.264 de 8 bits y no es HDR: cualquier otra cosa (HEVC de los
 * iPhone, 10 bits, Dolby Vision) no reproduce en todos los navegadores, que es
 * justo lo que la recompresión viene a garantizar.
 */
function puedeUsarseSinRecodificar(probe: VideoProbe): boolean {
  if (probe.isHdr) return false;
  if (probe.codecName !== "h264") return false;
  if (probe.pixFmt != null && probe.pixFmt !== "yuv420p") return false;

  const ladoLargo = Math.max(probe.width ?? 0, probe.height ?? 0);
  return ladoLargo > 0 && ladoLargo <= MAX_LADO;
}

/**
 * Extrae una miniatura del video ya comprimido (no del original: repetir el
 * tonemapping sería trabajo al pedo). Arranca en el segundo 1 para no quedarse
 * con el frame negro del principio.
 */
export async function extractPoster(videoPath: string, posterPath: string): Promise<void> {
  await run(
    "nice",
    [
      "-n",
      "10",
      env.ffmpegPath,
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      "-q:v",
      "4",
      posterPath,
    ],
    { timeoutMs: PROBE_TIMEOUT_MS, label: "ffmpeg (miniatura)" },
  );
}

/**
 * Hash del contenido de un archivo. Se usa como cadena de custodia: del original
 * antes de descartarlo, y del comprimido para poder detectar alteraciones.
 */
export function sha256File(absolutePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(absolutePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
