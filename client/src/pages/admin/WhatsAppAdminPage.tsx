import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, MessageCircle, Plus } from "lucide-react";

import {
  crearWhatsAppPlantilla,
  getWhatsAppEstado,
  getWhatsAppPlantillas,
  type WhatsAppPlantilla,
} from "../../api/whatsapp.api";
import { Button } from "../../components/ui/Button";
import { WhatsAppNumeros } from "./WhatsAppNumeros";

// Administración → WhatsApp: solo configuración. Los números conectados (y en qué
// bandeja se usa cada uno) y las plantillas. Las conversaciones están en la
// bandeja de cada área (Experiencia Solar → WhatsApp). Ver docs/manual/15-whatsapp.md.

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

  const plantillasQ = useQuery({
    queryKey: ["whatsapp-plantillas"],
    queryFn: getWhatsAppPlantillas,
    enabled: configurado,
  });
  const plantillas = plantillasQ.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <MessageCircle size={18} /> WhatsApp
        </h2>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Los números conectados y las plantillas. Las conversaciones se ven en la bandeja de cada área: Experiencia
          Solar → WhatsApp.
        </p>
      </div>

      {estado && !configurado && (
        <div className="flex gap-2 rounded-lg border border-[var(--color-warning-border,var(--color-border))] bg-[var(--color-warning-bg)] p-3 text-[12px] text-[var(--color-warning-text)]">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Falta configurar en el servidor: {estado.faltan.join(", ")}. Hasta entonces no se puede mandar nada.</span>
        </div>
      )}

      <WhatsAppNumeros />

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
