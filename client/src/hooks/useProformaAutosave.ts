// Autosave del borrador de proforma. Igual que el del contrato: debounce 1.5s,
// sin solapamiento, retry exponencial, y `savedTick` para el preview.

import { useCallback, useEffect, useRef, useState } from "react";

import { proformaApi } from "../api/proforma.api";
import type { ProformaData } from "../types/proforma";
import type { AutosaveStatus } from "./useDraftAutosave";

const DEBOUNCE_MS = 1500;
const MAX_RETRIES = 3;

export function useProformaAutosave(params: {
  projectId: string;
  data: ProformaData | null;
  enabled: boolean;
  draftExisted: boolean;
}) {
  const { projectId, data, enabled, draftExisted } = params;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  const latest = useRef<ProformaData | null>(data);
  latest.current = data;
  const inFlight = useRef(false);
  const pending = useRef(false);
  const savedJson = useRef<string | null>(null);
  const seeded = useRef(false);
  const retries = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (seeded.current || !data) return;
    seeded.current = true;
    if (draftExisted) savedJson.current = JSON.stringify(data);
  }, [data, draftExisted]);

  const doSave = useCallback(async () => {
    if (!enabled || !latest.current) return;
    const json = JSON.stringify(latest.current);
    if (json === savedJson.current) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    try {
      await proformaApi.putDraft(projectId, latest.current);
      savedJson.current = json;
      retries.current = 0;
      setLastSavedAt(Date.now());
      setStatus("saved");
      setSavedTick((t) => t + 1);
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        void doSave();
      }
    } catch {
      inFlight.current = false;
      retries.current += 1;
      if (retries.current >= MAX_RETRIES) {
        setStatus("error-final");
        return;
      }
      setStatus("error");
      const backoff = Math.min(30_000, 1000 * 2 ** (retries.current - 1));
      retryTimer.current = setTimeout(() => void doSave(), backoff);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    if (!enabled || !data) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void doSave(), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [data, enabled, doSave]);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const retryNow = useCallback(() => {
    retries.current = 0;
    void doSave();
  }, [doSave]);

  return { status, lastSavedAt, savedTick, retryNow };
}
