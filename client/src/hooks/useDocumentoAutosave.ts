// Autosave y vista previa genéricos para generadores de documentos con borrador
// (mismo comportamiento que useProformaAutosave / useProformaPreview, pero
// recibiendo las llamadas a la API). Los usa el documento del plan de granizo.

import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AutosaveStatus } from "./useDraftAutosave";
import type { PreviewStatus } from "./useDraftPreview";

const DEBOUNCE_MS = 1500;
const MAX_RETRIES = 3;

export function useDocumentoAutosave<T>(params: {
  data: T | null;
  enabled: boolean;
  draftExisted: boolean;
  save: (data: T) => Promise<void>;
}) {
  const { data, enabled, draftExisted, save } = params;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  const latest = useRef<T | null>(data);
  latest.current = data;
  const saveRef = useRef(save);
  saveRef.current = save;
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
      await saveRef.current(latest.current);
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
      retryTimer.current = setTimeout(() => void doSave(), Math.min(30_000, 1000 * 2 ** (retries.current - 1)));
    }
  }, [enabled]);

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

export function useDocumentoPreview(params: { savedTick: number; enabled: boolean; fetchBlob: () => Promise<Blob> }) {
  const { savedTick, enabled, fetchBlob } = params;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const currentUrl = useRef<string | null>(null);
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDone = useRef(false);

  const fetchPreview = useCallback(async () => {
    setStatus("loading");
    try {
      const url = URL.createObjectURL(await fetchRef.current());
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = url;
      setBlobUrl(url);
      setStatus("ready");
      setErrorMsg(null);
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.status : undefined;
      setErrorMsg(
        code === 400
          ? "Completá los campos obligatorios para ver la vista previa."
          : "No se pudo generar la vista previa. Probá de nuevo en unos segundos.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const delay = firstDone.current ? 2500 : 0;
    firstDone.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchPreview(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
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
