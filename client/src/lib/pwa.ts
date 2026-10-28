// Voltia PM instalable + avisos push. Ver public/sw.js y server/src/services/push.
import { apiClient } from "../api/axios";

/** El evento que Chrome/Android dispara cuando se puede instalar la aplicación. */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let eventoInstalar: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** Se llama una vez al arrancar (main.tsx). */
export function iniciarPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[pwa] no se registró el service worker", e));
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalar = null;
    avisar();
  });
}

export function suscribirseCambios(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export const puedeInstalar = () => eventoInstalar !== null;

export async function instalar() {
  if (!eventoInstalar) return;
  await eventoInstalar.prompt();
  await eventoInstalar.userChoice;
  eventoInstalar = null;
  avisar();
}

/** Abierta como aplicación instalada (no en una pestaña del navegador). */
export function esInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function pushSoportado(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function claveABytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function estadoServidor(): Promise<{ habilitado: boolean; clavePublica: string | null }> {
  return apiClient.get("/api/push/estado").then((r) => r.data);
}

/** La suscripción de este navegador, si hay. */
export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Pide permiso, suscribe este dispositivo y lo registra en Voltia PM. */
export async function activarAvisos(): Promise<"ok" | "denegado" | "error"> {
  const { habilitado, clavePublica } = await estadoServidor();
  if (!habilitado || !clavePublica) return "error";
  // El permiso se pide como respuesta directa a un toque: si no, iPhone lo niega.
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return "denegado";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clavePublica) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await apiClient.post("/api/push/suscripciones", { endpoint: json.endpoint, keys: json.keys });
  await apiClient.post("/api/push/prueba").catch(() => undefined);
  return "ok";
}

export async function desactivarAvisos() {
  const sub = await suscripcionActual();
  if (!sub) return;
  await apiClient.delete("/api/push/suscripciones", { data: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe();
}
