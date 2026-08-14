// Preview del PDF del borrador con debounce (Fase F, 1.9). Se refresca cuando el
// último autosave fue exitoso (escucha `savedTick`), con debounce 2.5s (más
// largo que el autosave para no saturar Puppeteer). Trae el PDF como blob (auth
// Bearer) y arma un object URL para el iframe.

import { useCallback, useEffect, useRef, useState } from "react";

import axios from "axios";

import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import type { ProposalVariante } from "../types/proposals-v2";

export type PreviewStatus = "idle" | "loading" | "ready" | "error";
const DEBOUNCE_MS = 2500;

export function useDraftPreview(params: {
  leadId: string;
  savedTick: number;
  enabled: boolean;
  variante: ProposalVariante;
}) {
  const { leadId, savedTick, enabled, variante } = params;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUrl = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDone = useRef(false);

  const fetchPreview = useCallback(async () => {
    setStatus("loading");
    try {
      const blob = await proposalsV2BuilderApi.getDraftPreviewBlob(leadId, variante);
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
  }, [leadId]);

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
