import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, Check, CheckCheck, Clock, MessageCircle, Plus, Send, X } from "lucide-react";

import {
  crearWhatsAppPlantilla,
  enviarWhatsApp,
  getWhatsAppConversaciones,
  getWhatsAppEstado,
  getWhatsAppMensajes,
  getWhatsAppPlantillas,
  type WhatsAppMensaje,
  type WhatsAppPlantilla,
} from "../../api/whatsapp.api";
import { Button } from "../../components/ui/Button";
import { WhatsAppNumeros } from "./WhatsAppNumeros";

// Administración → WhatsApp: la conexión de Voltia PM con la Cloud API de Meta.
// Hoy sirve para probar la conexión y para grabar los videos que pide la revisión
// de Meta (mandar un mensaje y crear una plantilla). Ver docs/manual/15-whatsapp.md.

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

/** Los huecos {{1}}, {{2}}… de un texto de plantilla. */
function cantidadHuecos(texto: string | undefined): number {
  const nums = [...(texto ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function cuerpoDe(p: WhatsAppPlantilla | undefined): string | undefined {
  return p?.components?.find((c) => c.type === "BODY")?.text;
}

function hora(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Tildes({ m }: { m: WhatsAppMensaje }) {
  if (m.direccion !== "SALIENTE") return null;
  const titulo: Record<string, string> = {
    accepted: "Aceptado por Meta",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leído",
    failed: "No se entregó",
  };
  const t = titulo[m.estado ?? ""] ?? m.estado ?? "";
  if (m.estado === "failed") return <X size={13} className="text-[var(--color-danger-text)]" aria-label={t} />;
  if (m.estado === "read") return <CheckCheck size={13} className="text-sky-400" aria-label={t} />;
  if (m.estado === "delivered") return <CheckCheck size={13} className="opacity-70" aria-label={t} />;
  if (m.estado === "sent") return <Check size={13} className="opacity-70" aria-label={t} />;
  return <Clock size={12} className="opacity-60" aria-label={t} />;
}

function Burbuja({ m }: { m: WhatsAppMensaje }) {
  const saliente = m.direccion === "SALIENTE";
  return (
    <div className={`flex ${saliente ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
          saliente
            ? "rounded-br-sm bg-emerald-700/80 text-white"
            : "rounded-bl-sm bg-[var(--color-bg-card)] text-[var(--color-text-primary)]"
        }`}
      >
        {m.plantilla && (
          <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wide opacity-75">Plantilla · {m.plantilla}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.texto ?? (m.plantilla ? "" : `[${m.tipo}]`)}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
          {m.enviadoPor && <span>{m.enviadoPor} ·</span>}
          <span>{hora(m.ocurridoEn)}</span>
          <Tildes m={m} />
        </div>
        {m.error && <p className="mt-1 text-[11px] text-red-200">{m.error}</p>}
      </div>
    </div>
  );
}

function Conversacion({
  telefono,
  ventanaAbierta,
  plantillas,
}: {
  telefono: string;
  ventanaAbierta: boolean;
  plantillas: WhatsAppPlantilla[];
}) {
  const qc = useQueryClient();
  const { data: mensajes = [] } = useQuery({
    queryKey: ["whatsapp-mensajes", telefono],
    queryFn: () => getWhatsAppMensajes(telefono),
    refetchInterval: 3000,
  });

  const aprobadas = plantillas.filter((p) => p.status === "APPROVED");
  const [modo, setModo] = useState<"plantilla" | "texto">(ventanaAbierta ? "texto" : "plantilla");
  const [texto, setTexto] = useState("");
  const [plantillaId, setPlantillaId] = useState<string>("");
  const [variables, setVariables] = useState<string[]>([]);
  const plantilla = aprobadas.find((p) => p.id === plantillaId) ?? aprobadas[0];
  const huecos = cantidadHuecos(cuerpoDe(plantilla));

  useEffect(() => {
    setVariables((v) => Array.from({ length: huecos }, (_, i) => v[i] ?? ""));
  }, [huecos]);

  const fin = useRef<HTMLDivElement>(null);
  // Con llaves y sin devolver nada: en los Chrome nuevos scrollIntoView devuelve
  // una promesa, y un efecto que devuelve algo que no es una función rompe React.
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const enviar = useMutation({
    mutationFn: () =>
      modo === "texto"
        ? enviarWhatsApp({ tipo: "texto", telefono, texto })
        : enviarWhatsApp({
            tipo: "plantilla",
            telefono,
            plantilla: plantilla!.name,
            idioma: plantilla!.language,
            variables,
          }),
    onSuccess: () => {
      setTexto("");
      toast.success("Mensaje enviado a Meta");
      qc.invalidateQueries({ queryKey: ["whatsapp-mensajes", telefono] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversaciones"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo mandar el mensaje"),
  });

  const puedeEnviar =
    !enviar.isPending &&
    (modo === "texto" ? ventanaAbierta && texto.trim() !== "" : !!plantilla && variables.every((v) => v.trim() !== ""));

  return (
    <div className="flex min-h-[460px] flex-col">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <p className="font-medium text-[var(--color-text-primary)]">+{telefono}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {ventanaAbierta
            ? "Escribió en las últimas 24 horas: se le puede mandar texto libre."
            : "No escribió en las últimas 24 horas: solo se le puede mandar una plantilla aprobada."}
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-[var(--color-bg-app)] p-4">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-[12px] text-[var(--color-text-muted)]">Todavía no hay mensajes.</p>
        )}
        {mensajes.map((m) => (
          <Burbuja key={m.id} m={m} />
        ))}
        <div ref={fin} />
      </div>

      <div className="space-y-2 border-t border-[var(--color-border)] p-3">
        <div className="flex gap-1 text-[12px]">
          {(["plantilla", "texto"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setModo(k)}
              className={`rounded-md px-2.5 py-1 ${
                modo === k
                  ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
              }`}
            >
              {k === "plantilla" ? "Plantilla" : "Texto libre"}
            </button>
          ))}
        </div>

        {modo === "plantilla" ? (
          aprobadas.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">No hay plantillas aprobadas todavía.</p>
          ) : (
            <div className="space-y-2">
              <select className={INPUT} value={plantilla?.id ?? ""} onChange={(e) => setPlantillaId(e.target.value)}>
                {aprobadas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.language}
                  </option>
                ))}
              </select>
              {cuerpoDe(plantilla) && (
                <p className="rounded-lg bg-[var(--color-bg-card)] p-2 text-[12px] text-[var(--color-text-secondary)]">
                  {cuerpoDe(plantilla)}
                </p>
              )}
              {variables.map((v, i) => (
                <input
                  key={i}
                  className={INPUT}
                  placeholder={`Valor de {{${i + 1}}}`}
                  value={v}
                  onChange={(e) => setVariables((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
            </div>
          )
        ) : (
          <textarea
            className={`${INPUT} min-h-[64px] resize-none`}
            placeholder={ventanaAbierta ? "Escribí el mensaje…" : "La ventana de 24 horas está cerrada"}
            disabled={!ventanaAbierta}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => enviar.mutate()} disabled={!puedeEnviar}>
            <Send size={14} className="mr-1.5" />
            {enviar.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NuevaPlantilla() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [idioma, setIdioma] = useState("es");
  const [cuerpo, setCuerpo] = useState("");
  const [ejemplos, setEjemplos] = useState<string[]>([]);
  const huecos = cantidadHuecos(cuerpo);
  useEffect(() => {
    setEjemplos((e) => Array.from({ length: huecos }, (_, i) => e[i] ?? ""));
  }, [huecos]);

  const crear = useMutation({
    mutationFn: () => crearWhatsAppPlantilla({ nombre, categoria, idioma, cuerpo, ejemplos }),
    onSuccess: (r) => {
      toast.success(`Plantilla mandada a Meta: ${r.status}`);
      setNombre("");
      setCuerpo("");
      qc.invalidateQueries({ queryKey: ["whatsapp-plantillas"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo crear la plantilla"),
  });

  const nombreValido = /^[a-z0-9_]+$/.test(nombre);
  const listo = nombreValido && cuerpo.trim() !== "" && ejemplos.every((e) => e.trim() !== "") && !crear.isPending;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-4">
      <p className="font-medium text-[var(--color-text-primary)]">Nueva plantilla</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] text-[var(--color-text-muted)]">
          Nombre (minúsculas, números y _)
          <input className={INPUT} value={nombre} onChange={(e) => setNombre(e.target.value.toLowerCase())} placeholder="aviso_fecha_obra" />
        </label>
        <label className="text-[11px] text-[var(--color-text-muted)]">
          Tipo
          <select className={INPUT} value={categoria} onChange={(e) => setCategoria(e.target.value as "UTILITY" | "MARKETING")}>
            <option value="UTILITY">Aviso (utility)</option>
            <option value="MARKETING">Promoción (marketing)</option>
          </select>
        </label>
        <label className="text-[11px] text-[var(--color-text-muted)]">
          Idioma
          <select className={INPUT} value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            <option value="es">Español (es)</option>
            <option value="es_AR">Español de Argentina (es_AR)</option>
            <option value="es_ES">Español de España (es_ES)</option>
            <option value="es_MX">Español de México (es_MX)</option>
          </select>
        </label>
      </div>
      <label className="block text-[11px] text-[var(--color-text-muted)]">
        Texto. Los datos de cada cliente van como {"{{1}}"}, {"{{2}}"}…; no pueden ir al principio ni al final.
        <textarea
          className={`${INPUT} min-h-[90px] resize-y`}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder="Hola {{1}}, te confirmamos la instalación para el {{2}}. Cualquier duda, respondé este mensaje."
        />
      </label>
      {ejemplos.map((v, i) => (
        <input
          key={i}
          className={INPUT}
          placeholder={`Ejemplo para {{${i + 1}}} (Meta lo pide para revisar)`}
          value={v}
          onChange={(e) => setEjemplos((es) => es.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => crear.mutate()} disabled={!listo}>
          <Plus size={14} className="mr-1.5" />
          {crear.isPending ? "Mandando…" : "Mandar a aprobar"}
        </Button>
      </div>
    </div>
  );
}

const ESTADO_PLANTILLA: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Aprobada", cls: "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" },
  PENDING: { label: "En revisión", cls: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]" },
  REJECTED: { label: "Rechazada", cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]" },
  PAUSED: { label: "Pausada", cls: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]" },
  DISABLED: { label: "Desactivada", cls: "bg-[var(--color-bg-card)] text-[var(--color-text-muted)]" },
};

export function TabWhatsApp() {
  const { data: estado } = useQuery({ queryKey: ["whatsapp-estado"], queryFn: getWhatsAppEstado });
  const configurado = !!estado && estado.faltan.length === 0;

  const { data: conversaciones = [] } = useQuery({
    queryKey: ["whatsapp-conversaciones"],
    queryFn: getWhatsAppConversaciones,
    refetchInterval: 5000,
  });
  const plantillasQ = useQuery({
    queryKey: ["whatsapp-plantillas"],
    queryFn: getWhatsAppPlantillas,
    enabled: configurado,
  });
  const plantillas = plantillasQ.data ?? [];

  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [nuevoNumero, setNuevoNumero] = useState("");
  const activa = useMemo(
    () => conversaciones.find((c) => c.telefono === seleccion) ?? null,
    [conversaciones, seleccion],
  );

  function abrirNuevo() {
    let d = nuevoNumero.replace(/\D/g, "");
    if (d.length === 9 && d.startsWith("09")) d = `598${d.slice(1)}`;
    else if (d.length === 8 && d.startsWith("9")) d = `598${d}`;
    if (d.length < 10) {
      toast.error("Ingresá el número con código de país, por ejemplo 598 98 123 456");
      return;
    }
    setSeleccion(d);
    setNuevoNumero("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <MessageCircle size={18} /> WhatsApp
        </h2>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Conexión de Voltia PM con la API de WhatsApp de Meta. Mensajes enviados, respuestas y plantillas.
        </p>
      </div>

      {estado && !configurado && (
        <div className="flex gap-2 rounded-lg border border-[var(--color-warning-border,var(--color-border))] bg-[var(--color-warning-bg)] p-3 text-[12px] text-[var(--color-warning-text)]">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Falta configurar en el servidor: {estado.faltan.join(", ")}. Hasta entonces no se puede mandar nada.</span>
        </div>
      )}

      <WhatsAppNumeros />

      <div className="grid overflow-hidden rounded-xl border border-[var(--color-border)] md:grid-cols-[260px_1fr]">
        <div className="border-b border-[var(--color-border)] md:border-b-0 md:border-r">
          <div className="flex gap-1 border-b border-[var(--color-border)] p-2">
            <input
              className={INPUT}
              placeholder="Número nuevo"
              value={nuevoNumero}
              onChange={(e) => setNuevoNumero(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && abrirNuevo()}
            />
            <Button size="sm" variant="secondary" onClick={abrirNuevo} aria-label="Abrir conversación">
              <Plus size={14} />
            </Button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {conversaciones.length === 0 && (
              <li className="p-4 text-center text-[12px] text-[var(--color-text-muted)]">Sin conversaciones todavía.</li>
            )}
            {conversaciones.map((c) => (
              <li key={c.telefono}>
                <button
                  type="button"
                  onClick={() => setSeleccion(c.telefono)}
                  className={`w-full px-3 py-2.5 text-left ${
                    seleccion === c.telefono ? "bg-[var(--color-accent)]/15" : "hover:bg-[var(--color-bg-card)]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)]">+{c.telefono}</span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{hora(c.ultimoEn)}</span>
                  </div>
                  <p className="truncate text-[12px] text-[var(--color-text-secondary)]">
                    {c.ultimaDireccion === "SALIENTE" ? "Vos: " : ""}
                    {c.ultimoTexto}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {seleccion ? (
          <Conversacion
            key={seleccion}
            telefono={seleccion}
            ventanaAbierta={activa?.ventanaAbierta ?? false}
            plantillas={plantillas}
          />
        ) : (
          <div className="flex min-h-[460px] items-center justify-center p-6 text-[13px] text-[var(--color-text-muted)]">
            Elegí una conversación o abrí una con un número nuevo.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-[var(--color-text-primary)]">Plantillas</h3>
        {plantillasQ.isError && (
          <p className="text-[12px] text-[var(--color-danger-text)]">
            {getApiErr(plantillasQ.error) ?? "No se pudieron traer las plantillas de Meta."}
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-[12px]">
            <thead className="text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Idioma</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Texto</th>
              </tr>
            </thead>
            <tbody>
              {plantillas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-[var(--color-text-muted)]">
                    {configurado ? "Sin plantillas." : "Disponible cuando esté configurado."}
                  </td>
                </tr>
              )}
              {plantillas.map((p) => {
                const e = ESTADO_PLANTILLA[p.status] ?? { label: p.status, cls: "bg-[var(--color-bg-card)]" };
                return (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 align-top">
                    <td className="px-3 py-2 font-mono text-[var(--color-text-primary)]">{p.name}</td>
                    <td className="px-3 py-2">{p.category === "MARKETING" ? "Promoción" : p.category === "UTILITY" ? "Aviso" : p.category}</td>
                    <td className="px-3 py-2">{p.language}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${e.cls}`}>{e.label}</span>
                      {p.rejected_reason && p.rejected_reason !== "NONE" && (
                        <p className="mt-1 text-[11px] text-[var(--color-danger-text)]">{p.rejected_reason}</p>
                      )}
                    </td>
                    <td className="max-w-[360px] px-3 py-2 text-[var(--color-text-secondary)]">{cuerpoDe(p) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {configurado && <NuevaPlantilla />}
      </div>
    </div>
  );
}
