import { create } from "zustand";

// "Ver el portal como lo ve el cliente", para usuarios internos.
//
// Vive en sessionStorage y no en localStorage a propósito: es un modo temporal
// para mirar una pantalla, y tiene que morir al cerrar la pestaña. Si
// sobreviviera entre sesiones, alguien terminaría trabajando media mañana
// creyendo que ve su propia pantalla.

const CLAVE = "voltia-portal-preview";

export interface PortalPreview {
  projectId: string;
  clientName: string;
}

function leerGuardado(): PortalPreview | null {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as PortalPreview) : null;
  } catch {
    return null;
  }
}

interface PortalPreviewState {
  preview: PortalPreview | null;
  activar: (p: PortalPreview) => void;
  salir: () => void;
}

export const usePortalPreviewStore = create<PortalPreviewState>((set) => ({
  preview: leerGuardado(),
  activar: (preview) => {
    sessionStorage.setItem(CLAVE, JSON.stringify(preview));
    set({ preview });
  },
  salir: () => {
    sessionStorage.removeItem(CLAVE);
    set({ preview: null });
  },
}));

/** Para el interceptor de axios, que no puede usar hooks. */
export function getPortalPreviewProjectId(): string | null {
  return usePortalPreviewStore.getState().preview?.projectId ?? null;
}
