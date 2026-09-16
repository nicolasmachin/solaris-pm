// Tarjeta de vista previa del enlace de un video (WhatsApp, Slack, Telegram…).
//
// El robot que arma la tarjeta no tiene sesión y no ejecuta JavaScript: hay que
// devolverle HTML con las etiquetas Open Graph ya resueltas. Como la app es una
// sola página, todos sus enlaces comparten el mismo título ("VOLTIA PM"); por
// eso el enlace que se comparte apunta acá, y esta página redirige a la persona
// al reproductor.
//
// Qué se expone sin login: título, área y miniatura. El video NUNCA: sigue
// detrás del embed firmado. El id es un cuid, así que la dirección no se puede
// adivinar.

import { env } from "../../config/env.js";

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDuracion(segundos: number | null): string | null {
  if (!segundos || segundos <= 0) return null;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function urlCompartir(videoId: string) {
  return `${env.baseUrl}/api/capacitacion/compartir/${videoId}`;
}

export function paginaCompartir(video: {
  id: string;
  titulo: string;
  descripcion: string | null;
  duracionSeg: number | null;
  thumbnailFileName: string | null;
  lista: { id: string; titulo: string; seccion: { nombre: string } };
}) {
  const destino = `${env.baseUrl}/capacitacion/lista/${video.lista.id}?v=${video.id}`;
  const duracion = fmtDuracion(video.duracionSeg);
  const descripcion =
    video.descripcion?.trim() ||
    [`Capacitación · ${video.lista.seccion.nombre}`, video.lista.titulo, duracion].filter(Boolean).join(" · ");
  const imagen = video.thumbnailFileName ? `${urlCompartir(video.id)}/miniatura.jpg` : null;

  const t = escaparHtml(video.titulo);
  const d = escaparHtml(descripcion);
  const u = escaparHtml(destino);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} · Capacitación Voltia</title>
<meta property="og:site_name" content="Voltia PM">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escaparHtml(urlCompartir(video.id))}">
${imagen ? `<meta property="og:image" content="${escaparHtml(imagen)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${imagen ? `<meta name="twitter:image" content="${escaparHtml(imagen)}">` : ""}
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${u}">
<script>window.location.replace(${JSON.stringify(destino)});</script>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b1220;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}
.c{max-width:420px;text-align:center}
img{width:100%;border-radius:10px;margin-bottom:16px}
a{color:#fbbf24}
</style>
</head>
<body>
<div class="c">
${imagen ? `<img src="${escaparHtml(imagen)}" alt="">` : ""}
<h1 style="font-size:18px;margin:0 0 8px">${t}</h1>
<p style="font-size:14px;color:#9ca3af;margin:0 0 16px">${d}</p>
<p style="font-size:14px">Te estamos llevando al video… <a href="${u}">Abrir en Voltia PM</a></p>
</div>
</body>
</html>`;
}
