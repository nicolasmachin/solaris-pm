import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link2, RefreshCw, Smartphone } from "lucide-react";

import {
  actualizarWhatsAppNumero,
  conectarWhatsAppNumero,
  getWhatsAppNumeros,
  getWhatsAppRegistro,
  sincronizarWhatsAppNumero,
  type WhatsAppNumero,
  type WhatsAppRegistroConfig,
} from "../../api/whatsapp.api";
import { getAssignableUsers } from "../../api/users.api";
import { Button } from "../../components/ui/Button";

// Números de WhatsApp de Voltia conectados a Voltia PM con el registro integrado
// de Meta. El dueño del número escanea un código QR con WhatsApp Business y el
// número sigue andando en su celular (coexistencia). Ver docs/manual/15-whatsapp.md.

type SesionMeta = { phone_number_id?: string; waba_id?: string; business_id?: string };

type FBLoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FBSdk = {
  init: (opts: Record<string, unknown>) => void;
  login: (cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

let sdkPromesa: Promise<FBSdk> | null = null;

/** Carga el SDK de Facebook una sola vez por página. */
function cargarSdk(cfg: WhatsAppRegistroConfig): Promise<FBSdk> {
  if (sdkPromesa) return sdkPromesa;
  sdkPromesa = new Promise<FBSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: cfg.appId, autoLogAppEvents: true, xfbml: false, version: cfg.graphVersion });
      resolve(window.FB!);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => {
      sdkPromesa = null;
      reject(new Error("No se pudo cargar el SDK de Meta"));
    };
    document.body.appendChild(s);
  });
  return sdkPromesa;
}

/**
 * Abre la ventana de Meta y devuelve el código de un solo uso y los ids del
 * número. Los ids llegan por postMessage desde facebook.com; el código, en el
 * callback del login. No siempre llegan en el mismo orden: se esperan los dos.
 */
async function abrirRegistro(cfg: WhatsAppRegistroConfig): Promise<{ code: string; sesion: SesionMeta }> {
  const FB = await cargarSdk(cfg);
  return new Promise((resolve, reject) => {
    let sesion: SesionMeta | null = null;
    let code: string | null = null;
    let terminado = false;

    const fin = (err?: Error) => {
      if (terminado) return;
      terminado = true;
      window.removeEventListener("message", oir);
      if (err) reject(err);
      else resolve({ code: code!, sesion: sesion ?? {} });
    };
    const intentar = () => {
      if (code && sesion) fin();
    };

    function oir(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      let data: { type?: string; event?: string; data?: SesionMeta & { current_step?: string; error_message?: string } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event?.startsWith("FINISH")) {
        sesion = data.data ?? {};
        intentar();
      } else if (data.event === "CANCEL") {
        fin(new Error(data.data?.error_message ?? "Se cerró la ventana de Meta sin terminar."));
      } else if (data.event === "ERROR") {
        fin(new Error(data.data?.error_message ?? "Meta informó un error en el registro."));
      }
    }
    window.addEventListener("message", oir);

    FB.login(
      (r) => {
        code = r.authResponse?.code ?? null;
        if (!code) return fin(new Error("Se cerró la ventana de Meta sin terminar."));
        intentar();
        // Si los ids no llegaron en unos segundos, se sigue sin ellos y el
        // server avisa: mejor que perder el código, que vence a los 30 s.
        setTimeout(() => (sesion ? intentar() : fin(new Error("Meta no informó qué número se conectó. Probá de nuevo."))), 5000);
      },
      {
        config_id: cfg.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  });
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function EstadoSync({ n }: { n: WhatsAppNumero }) {
  if (!n.coexistencia) return <span className="text-[var(--color-text-muted)]">Solo Voltia PM</span>;
  if (n.historialError) return <span className="text-[var(--color-warning-text)]">Historial no compartido: {n.historialError}</span>;
  if (n.syncError) return <span className="text-[var(--color-danger-text)]">Falló la sincronización: {n.syncError}</span>;
  if (!n.syncHistorialEn) return <span className="text-[var(--color-text-muted)]">Historial sin pedir</span>;
  if ((n.historialProgreso ?? 0) >= 100) return <span>Historial completo</span>;
  return <span>Trayendo historial… {n.historialProgreso ?? 0}%</span>;
}

function FilaNumero({ n, usuarios }: { n: WhatsAppNumero; usuarios: Array<{ id: string; name: string }> }) {
  const qc = useQueryClient();
  const actualizar = useMutation({
    mutationFn: (body: { etiqueta?: string | null; responsableId?: string | null }) => actualizarWhatsAppNumero(n.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] }),
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo guardar"),
  });
  const sincronizar = useMutation({
    mutationFn: () => sincronizarWhatsAppNumero(n.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] }),
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo sincronizar"),
  });

  return (
    <tr className="border-b border-[var(--color-border)] align-top last:border-0">
      <td className="px-3 py-2">
        <div className="font-medium text-[var(--color-text-primary)]">{n.telefono}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">{n.nombreVerificado ?? "—"}</div>
        {n.estado === "DESCONECTADO" && (
          <span className="mt-1 inline-block rounded bg-[var(--color-danger-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-danger-text)]">
            Desconectado
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          className={INPUT}
          defaultValue={n.etiqueta ?? ""}
          placeholder="Ventas, Experiencia Solar…"
          onBlur={(e) => e.target.value !== (n.etiqueta ?? "") && actualizar.mutate({ etiqueta: e.target.value || null })}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className={INPUT}
          value={n.responsable?.id ?? ""}
          onChange={(e) => actualizar.mutate({ responsableId: e.target.value || null })}
        >
          <option value="">Sin responsable</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
        <EstadoSync n={n} />
        {n.puedeSincronizar && (
          <Button size="sm" variant="secondary" className="mt-1" onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
            <RefreshCw size={12} /> Reintentar
          </Button>
        )}
      </td>
      <td className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        {fecha(n.conectadoEn)}
        {n.conectadoPor ? ` · ${n.conectadoPor}` : ""}
      </td>
    </tr>
  );
}

export function WhatsAppNumeros() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ["whatsapp-registro"], queryFn: getWhatsAppRegistro });
  const { data: numeros = [] } = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: getWhatsAppNumeros,
    // Mientras llega el historial, el avance se actualiza solo.
    refetchInterval: (q) => (q.state.data?.some((n) => n.coexistencia && n.syncHistorialEn && (n.historialProgreso ?? 0) < 100) ? 5000 : false),
  });
  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios-asignables"], queryFn: getAssignableUsers });

  const [etiqueta, setEtiqueta] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [conectando, setConectando] = useState(false);
  const listo = !!cfg && cfg.faltan.length === 0;

  async function conectar() {
    if (!cfg) return;
    setConectando(true);
    try {
      const { code, sesion } = await abrirRegistro(cfg);
      if (!sesion.phone_number_id || !sesion.waba_id) throw new Error("Meta no informó qué número se conectó.");
      const n = await conectarWhatsAppNumero({
        code,
        phoneNumberId: sesion.phone_number_id,
        wabaId: sesion.waba_id,
        businessId: sesion.business_id,
        etiqueta: etiqueta || undefined,
        responsableId: responsableId || undefined,
      });
      toast.success(`Número ${n.telefono} conectado`);
      setEtiqueta("");
      setResponsableId("");
      qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    } catch (e) {
      toast.error(getApiErr(e) ?? (e instanceof Error ? e.message : "No se pudo conectar el número"));
    } finally {
      setConectando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
          <Smartphone size={16} /> Números conectados
        </h3>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          El número sigue andando en el celular. Al conectarlo, el dueño escanea un código QR con WhatsApp Business y se
          traen sus chats de los últimos 6 meses. Los dispositivos vinculados (WhatsApp Web, la computadora) se
          desvinculan y hay que volver a vincularlos.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-[12px]">
          <thead className="text-[var(--color-text-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-3 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Para qué</th>
              <th className="px-3 py-2 font-medium">Responsable</th>
              <th className="px-3 py-2 font-medium">Historial</th>
              <th className="px-3 py-2 font-medium">Conectado</th>
            </tr>
          </thead>
          <tbody>
            {numeros.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-[var(--color-text-muted)]">
                  Todavía no hay números conectados.
                </td>
              </tr>
            )}
            {numeros.map((n) => (
              <FilaNumero key={n.id} n={n} usuarios={usuarios} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 rounded-xl border border-[var(--color-border)] p-3 md:grid-cols-[1fr_1fr_auto]">
        <input className={INPUT} placeholder="Para qué (ej. Ventas)" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
        <select className={INPUT} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
          <option value="">Responsable</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button onClick={conectar} disabled={!listo || conectando}>
          <Link2 size={14} /> {conectando ? "Conectando…" : "Conectar número"}
        </Button>
      </div>
    </div>
  );
}
