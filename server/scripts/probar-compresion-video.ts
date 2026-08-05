/**
 * Banco de pruebas del perfil de compresión de los videos de ensayos.
 *
 * Corre el pipeline real (`video-transcode.service.ts`) sobre videos de prueba y
 * reporta cuánto pesa el resultado y cuánto tardó. Sirve para recalibrar el
 * perfil sin tener que subir nada por la app: si algún día hay que tocar el CRF o
 * la resolución porque no se lee un display, este script dice qué se gana y qué
 * se paga.
 *
 * Uso (dentro del contenedor):
 *   docker compose exec server node --import tsx scripts/probar-compresion-video.ts
 *
 * Con un video propio (ideal: un .mov de iPhone filmando un inversor real):
 *   docker compose exec server node --import tsx scripts/probar-compresion-video.ts /app/storage/mi-video.mov
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  extractPoster,
  probeVideo,
  transcodeToStandard,
} from "../src/services/video-transcode.service.js";

const MB = 1024 * 1024;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr = (stderr + String(c)).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} falló (${code}): ${stderr}`)),
    );
  });
}

/**
 * Genera un clip sintético que imita lo que filma un operario: un patrón con
 * detalle fino (equivalente al display de un inversor) sobre fondo con
 * movimiento, que es el caso costoso en bitrate.
 */
async function generarClip(
  destino: string,
  opciones: { width: number; height: number; fps: number; segundos: number; hdr: boolean },
): Promise<void> {
  const { width, height, fps, segundos, hdr } = opciones;

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${width}x${height}:rate=${fps}:duration=${segundos}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${segundos}`,
    "-vf",
    // Texto chico = detalle fino, lo más parecido a un display de 7 segmentos.
    "drawtext=text='INV 4.8kW  V=231.4  I=12.7A  F=50.01Hz':fontsize=28:fontcolor=white:box=1:boxcolor=black:x=40:y=h-80",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "14", // clip "crudo" de alta calidad, para que la comparación tenga sentido
    "-pix_fmt",
    hdr ? "yuv420p10le" : "yuv420p",
    ...(hdr
      ? ["-color_trc", "smpte2084", "-color_primaries", "bt2020", "-colorspace", "bt2020nc"]
      : []),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    destino,
  ];

  await run("ffmpeg", args);
}

async function medir(nombre: string, entrada: string, dir: string): Promise<void> {
  const salida = path.join(dir, `out_${nombre}.mp4`);
  const poster = path.join(dir, `poster_${nombre}.jpg`);

  const antes = (await fs.stat(entrada)).size;
  const probe = await probeVideo(entrada);

  const t0 = process.hrtime.bigint();
  const { sizeBytes } = await transcodeToStandard(entrada, salida, probe);
  const segundos = Number(process.hrtime.bigint() - t0) / 1e9;

  await extractPoster(salida, poster);
  const posterBytes = (await fs.stat(poster)).size;

  const dur = probe.durationSeconds ?? 0;
  const mbPorMinuto = dur > 0 ? (sizeBytes / MB / dur) * 60 : 0;

  const salidaProbe = await probeVideo(salida);

  console.log(`\n── ${nombre} ${"─".repeat(Math.max(0, 44 - nombre.length))}`);
  console.log(
    `   entrada : ${probe.width}x${probe.height} ${probe.codecName}` +
      `${probe.isHdr ? " HDR" : ""} · ${dur}s · ${(antes / MB).toFixed(1)} MB`,
  );
  console.log(
    `   salida  : ${salidaProbe.width}x${salidaProbe.height} ${salidaProbe.codecName}` +
      ` · ${(sizeBytes / MB).toFixed(1)} MB · ${mbPorMinuto.toFixed(1)} MB/min`,
  );
  console.log(
    `   ratio   : ${(antes / sizeBytes).toFixed(1)}x más chico` +
      ` · comprimió en ${segundos.toFixed(1)}s (${(dur / segundos).toFixed(1)}x tiempo real)`,
  );
  console.log(`   poster  : ${(posterBytes / 1024).toFixed(0)} KB`);
}

async function main(): Promise<void> {
  const propio = process.argv[2];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ensayo-video-"));

  try {
    if (propio) {
      await medir(path.basename(propio), propio, dir);
      return;
    }

    console.log("Generando clips de prueba (sin video propio, se usan sintéticos)…");

    const casos = [
      { nombre: "1080p30-horizontal", width: 1920, height: 1080, fps: 30, hdr: false },
      { nombre: "1080p60-horizontal", width: 1920, height: 1080, fps: 60, hdr: false },
      { nombre: "1080p30-vertical", width: 1080, height: 1920, fps: 30, hdr: false },
      { nombre: "4k30-horizontal", width: 3840, height: 2160, fps: 30, hdr: false },
      { nombre: "1080p30-hdr", width: 1920, height: 1080, fps: 30, hdr: true },
    ];

    for (const caso of casos) {
      const entrada = path.join(dir, `in_${caso.nombre}.mp4`);
      await generarClip(entrada, { ...caso, segundos: 20 });
      await medir(caso.nombre, entrada, dir);
    }

    console.log(
      "\nNota: los sintéticos sirven para validar el pipeline (resolución, orientación,\n" +
        "tonemapping, tiempos). Para decidir si el CRF alcanza hay que correrlo sobre un\n" +
        "video real de un display de inversor y mirarlo.",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
