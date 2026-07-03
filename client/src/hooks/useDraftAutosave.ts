// Autosave del borrador del constructor (Fase F). Debounce 1.5s; nunca solapa
// requests (1 en curso + 1 pendiente con el estado más reciente); retry
// exponencial ante error (1/2/4s, max 30s, 3 intentos → error final + reintento
// manual). Expone `savedTick` para que el preview se sincronice (1.9).

import { useCallback, useEffect, useRef, useState } from "react";

import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import type { ProposalDraftData } from "../types/proposals-v2";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error" | "error-final";

const DEBOUNCE_MS = 1500;
const MAX_RETRIES = 3;

export function useDraftAutosave(params: {
  leadId: string;
  data: ProposalDraftData | null;
  enabled: boolean;
  // true = el draft ya existía al cargar (no re-guardar el estado inicial);
  // false = no existía (el primer autosave lo crea con los defaults).
  draftExisted: boolean;
}) {
  const { leadId, data, enabled, draftExisted } = params;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  const latest = useRef<ProposalDraftData | null>(data);
  latest.current = data;
  const inFlight = useRef(false);
  const pending = useRef(false);
  const savedJson = useRef<string | null>(null);
  const seeded = useRef(false);
  const retries = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed del baseline: si el draft ya existía, su estado inicial no se re-guarda.
  useEffect(() => {
    if (seeded.current || !data) return;
    seeded.current = true;
    if (draftExisted) savedJson.current = JSON.stringify(data);
  }, [data, draftExisted]);

  const doSave = useCallback(async () => {
    if (!enabled || !latest.current) return;
    const json = JSON.stringify(latest.current);
    if (json === savedJson.current) return; // sin cambios reales
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    try {
      await proposalsV2BuilderApi.putDraft(leadId, latest.current);
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
  }, [enabled, leadId]);

  // Programa el save ante cada cambio (debounce).
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
