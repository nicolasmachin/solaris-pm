import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Download, Share, SquarePlus, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  activarAvisos,
  desactivarAvisos,
  esInstalada,
  esIos,
  estadoServidor,
  instalar,
  puedeInstalar,
  pushSoportado,
  suscribirseCambios,
  suscripcionActual,
} from "../../lib/pwa";
import { usePortalPreviewStore } from "../../store/portalPreview.store";

// Activar los avisos en este celular o computadora, e instalar Voltia como
// aplicación. Se usa como tarjeta en el Inicio del portal ("tarjeta") y dentro
// de la ventana que se abre desde el menú de la cuenta ("panel").
//
// En iPhone los avisos solo andan con Voltia agregada a la pantalla de inicio
// y abierta desde el ícono (regla de Apple): ahí se explica cómo, paso a paso.

type Estado = "cargando" | "sin-servidor" | "no-disponible" | "instalar-ios" | "bloqueado" | "activo" | "inactivo";

const CLAVE_CERRADA = "voltia-avisos-tarjeta-cerrada";

function useEstado(): [Estado, () => void] {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [vuelta, setVuelta] = useState(0);
  const { data: servidor } = useQuery({ queryKey: ["push-estado"], queryFn: estadoServidor, staleTime: Infinity });

  useEffect(() => {
    if (!servidor) return;
    let vivo = true;
    (async () => {
      let e: Estado;
      if (!servidor.habilitado) e = "sin-servidor";
      else if (esIos() && !esInstalada()) e = "instalar-ios";
      else if (!pushSoportado()) e = "no-disponible";
      else if (Notification.permission === "denied") e = "bloqueado";
      else e = Notification.permission === "granted" && (await suscripcionActual()) ? "activo" : "inactivo";
      if (vivo) setEstado(e);
    })();
    return () => {
      vivo = false;
    };
  }, [servidor, vuelta]);

  return [estado, () => setVuelta((v) => v + 1)];
}

export function AvisosDispositivo({
  variante,
  publico,
  onCerrar,
}: {
  variante: "tarjeta" | "panel";
  /** "cliente" habla de su planta; "equipo", de Voltia PM. */
  publico: "cliente" | "equipo";
  onCerrar?: () => void;
}) {
  const { preview } = usePortalPreviewStore();
  const [estado, refrescar] = useEstado();
  const [trabajando, setTrabajando] = useState(false);
  const instalable = useSyncExternalStore(suscribirseCambios, puedeInstalar);
  const [cerrada, setCerrada] = useState(() => localStorage.getItem(CLAVE_CERRADA) === "1");

  // Mirando el portal como un cliente no se activa nada: quedaría a nombre de
  // quien mira.
  if (preview) return null;
  if (estado === "cargando") return null;
  if (variante === "tarjeta" && (cerrada || estado === "activo" || estado === "no-disponible" || estado === "sin-servidor")) return null;

  const nombre = publico === "cliente" ? "Voltia" : "Voltia PM";
  const queLlega =
    publico === "cliente"
      ? "Te avisamos cuando te respondemos un reclamo, cuando hay una encuesta o algo para hacer, y cuando detectemos un problema en tu planta."
      : "Te llega lo mismo que a la campanita, aunque tengas Voltia PM cerrada.";

  async function activar() {
    setTrabajando(true);
    try {
      const r = await activarAvisos();
      if (r === "ok") toast.success("Listo: los avisos te van a llegar a este dispositivo");
      else if (r === "denegado") toast.error("No diste permiso para los avisos");
      else toast.error("No se pudieron activar los avisos");
    } catch {
      toast.error("No se pudieron activar los avisos");
    } finally {
      setTrabajando(false);
      refrescar();
    }
  }

  async function desactivar() {
    setTrabajando(true);
    try {
      await desactivarAvisos();
      toast.success("Avisos desactivados en este dispositivo");
    } finally {
      setTrabajando(false);
      refrescar();
    }
  }

  function cerrar() {
    localStorage.setItem(CLAVE_CERRADA, "1");
    setCerrada(true);
    onCerrar?.();
  }

  const botonPrincipal =
    "inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-gray-900 hover:opacity-90 disabled:opacity-60";
  const botonSecundario =
    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]";

  let cuerpo: React.ReactNode;
  if (estado === "sin-servidor") {
    cuerpo = <p className="text-sm text-[var(--color-text-muted)]">Los avisos todavía no están disponibles.</p>;
  } else if (estado === "no-disponible") {
    cuerpo = <p className="text-sm text-[var(--color-text-muted)]">Este navegador no permite recibir avisos.</p>;
  } else if (estado === "instalar-ios") {
    cuerpo = (
      <>
        <p className="text-sm text-[var(--color-text-secondary)]">
          En el iPhone, para recibir avisos primero hay que agregar {nombre} a la pantalla de inicio. Es un minuto:
        </p>
        <ol className="mt-2 space-y-1.5 text-sm text-[var(--color-text-primary)]">
          <li className="flex items-center gap-2">
            <span className="font-mono text-[var(--color-text-muted)]">1.</span> Tocá <Share className="h-4 w-4" />{" "}
            <strong>Compartir</strong>, abajo en Safari.
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono text-[var(--color-text-muted)]">2.</span> Elegí <SquarePlus className="h-4 w-4" />{" "}
            <strong>Agregar a inicio</strong>.
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono text-[var(--color-text-muted)]">3.</span> Abrí {nombre} desde el ícono nuevo y activá
            los avisos.
          </li>
        </ol>
      </>
    );
  } else if (estado === "bloqueado") {
    cuerpo = (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Los avisos están bloqueados para {nombre} en este dispositivo. Se habilitan desde la configuración del navegador
        (el candado al lado de la dirección, o Ajustes → Notificaciones en el celular).
      </p>
    );
  } else if (estado === "activo") {
    cuerpo = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
          <Bell className="h-4 w-4" /> Avisos activados en este dispositivo
        </span>
        <button type="button" onClick={desactivar} disabled={trabajando} className={botonSecundario}>
          <BellOff className="h-4 w-4" /> Desactivar
        </button>
      </div>
    );
  } else {
    cuerpo = (
      <>
        <p className="text-sm text-[var(--color-text-secondary)]">{queLlega}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={activar} disabled={trabajando} className={botonPrincipal}>
            <Bell className="h-4 w-4" /> Activar avisos
          </button>
          {instalable && !esInstalada() && (
            <button type="button" onClick={() => instalar()} className={botonSecundario}>
              <Download className="h-4 w-4" /> Instalar {nombre}
            </button>
          )}
        </div>
      </>
    );
  }

  if (variante === "panel") return <div className="space-y-2">{cuerpo}</div>;

  return (
    <div className="relative rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-4">
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="absolute right-2 top-2 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="mb-1 flex items-center gap-2 pr-6 font-semibold text-[var(--color-text-primary)]">
        <Bell className="h-4 w-4 text-[var(--color-accent)]" />
        {publico === "cliente" ? "Recibí los avisos de tu planta en el celular" : "Avisos en este dispositivo"}
      </p>
      {cuerpo}
    </div>
  );
}

/** Ventana chica para el menú de la cuenta. */
export function AvisosModal({ publico, onClose }: { publico: "cliente" | "equipo"; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Avisos en este dispositivo"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
            <Bell className="h-4 w-4 text-[var(--color-accent)]" /> Avisos en este dispositivo
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <AvisosDispositivo variante="panel" publico={publico} />
      </div>
    </div>
  );
}
