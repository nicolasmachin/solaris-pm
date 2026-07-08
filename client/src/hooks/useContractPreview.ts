// Preview del PDF del contrato con debounce (se refresca cuando el último autosave
// fue exitoso, escuchando `savedTick`). Trae el PDF como blob (auth Bearer) y arma
// un object URL para el iframe.

import { useCallback, useEffect, useRef, useState } from "react";

import axios from "axios";

import { contractApi } from "../api/contract.api";
import type { PreviewStatus } from "./useDraftPreview";

const DEBOUNCE_MS = 2500;

export function useContractPreview(params: { projectId: string; savedTick: number; enabled: boolean }) {
  const { projectId, savedTick, enabled } = params;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUrl = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDone = useRef(false);

  const fetchPreview = useCallback(async () => {
    setStatus("loading");
    try {
      const blob = await contractApi.getDraftPreviewBlob(projectId);
      const url = URL.createObjectURL(blob);
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = url;
      setBlobUrl(url);
      setStatus("ready");
      setErrorMsg(null);
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.status : undefined;
      setErrorMsg(
        code === 400
          ? "Completá los campos obligatorios para ver el preview."
          : "No se pudo generar el preview. Probá de nuevo en unos segundos.",
      );
      setStatus("error");
    }
  }, [projectId]);

  useEffect(() => {
    if (!enabled) return;
    const delay = firstDone.current ? DEBOUNCE_MS : 0;
    firstDone.current = true;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void fetchPreview(), delay);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [savedTick, enabled, fetchPreview]);

  useEffect(
    () => () => {
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    },
    [],
  );

  return { blobUrl, status, errorMsg };
}
