import { useQuery } from "@tanstack/react-query";
import { CloudHail, Download, Eye, FileSignature, FileText, Landmark } from "lucide-react";
import toast from "react-hot-toast";

import { apiClient } from "../api/axios";
import {
  getPortalDocumentos,
  portalDocumentoPath,
  type PortalDocArchivo,
  type PortalPlanEstado,
  type PortalPlanGranizo,
} from "../api/portal.api";
import { Spinner } from "../components/ui/Spinner";
import { downloadAuthenticated } from "../hooks/useAuthBlobUrl";

// "Mis documentos": lo que el cliente firmó (contrato con Voltia, papeles de
// UTE) y, si lo tiene, su Plan de Protección contra Granizo con los plazos.
// Al cliente nunca se le dice "seguro": es el Plan de Protección.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "YYYY-MM-DD" o ISO → "5 de marzo de 2026", sin que la zona horaria corra el día. */
function fecha(d: string | null): string {
  if (!d) return "—";
  const [a, m, dd] = d.slice(0, 10).split("-").map(Number);
  return `${dd} de ${MESES[m - 1]} de ${a}`;
}
const usd = (n: number) => `US$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;

/**
 * Abre el documento en otra pestaña. La pestaña se abre antes de pedir el
 * archivo: si se abre después, el celular la bloquea como ventana emergente.
 */
async function abrir(f: PortalDocArchivo) {
  const ventana = window.open("", "_blank");
  try {
    const res = await apiClient.get(portalDocumentoPath(f.id), { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    ventana?.close();
    toast.error("No pudimos abrir el documento. Probá de nuevo en un rato.");
  }
}

function FilaArchivo({ f, detalle }: { f: PortalDocArchivo; detalle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--color-text-primary)]">{f.nombre}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{detalle ?? `Cargado el ${fecha(f.cargadoEl)}`}</p>
      </div>
      <button
        type="button"
        onClick={() => abrir(f)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-card-hover)]"
      >
        <Eye className="h-3.5 w-3.5" /> Ver
      </button>
      <button
        type="button"
        onClick={() =>
          downloadAuthenticated(portalDocumentoPath(f.id), f.nombre).catch(() =>
            toast.error("No se pudo descargar el documento"),
          )
        }
        aria-label={`Descargar ${f.nombre}`}
        className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Tarjeta({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[var(--color-accent)]">{icono}</span>
        <h2 className="font-display font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--color-text-muted)]">{children}</p>;
}

// Cómo se le cuenta al cliente cada estado del plan.
const ESTADO: Record<PortalPlanEstado, { texto: string; tono: "ok" | "info" | "alerta" | "apagado" }> = {
  PENDIENTE_INICIO: { texto: "Empieza con la puesta en marcha", tono: "info" },
  PENDIENTE_ACTIVACION: { texto: "Falta activarlo", tono: "alerta" },
  EN_CARENCIA: { texto: "En período de espera", tono: "info" },
  VIGENTE: { texto: "Vigente", tono: "ok" },
  POR_VENCER: { texto: "Vence pronto", tono: "alerta" },
  EN_GRACIA: { texto: "Vencido: en período de gracia", tono: "alerta" },
  SUSPENDIDA: { texto: "Suspendido", tono: "alerta" },
  VENCIDA: { texto: "Vencido", tono: "alerta" },
  CANCELADA: { texto: "Dado de baja", tono: "apagado" },
};
const TONO = {
  ok: "bg-emerald-500/15 text-emerald-400",
  info: "bg-blue-500/15 text-blue-400",
  alerta: "bg-amber-500/15 text-amber-300",
  apagado: "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]",
};

/** La frase que explica el estado, con sus fechas. */
function explicacion(p: PortalPlanGranizo): string | null {
  switch (p.estado) {
    case "PENDIENTE_INICIO":
      return "Tu plan arranca el día que tu planta se pone en marcha, sin período de espera.";
    case "PENDIENTE_ACTIVACION": {
      const falta = [p.faltaFirma && "la solicitud de adhesión (Anexo A) firmada", p.faltaPago && "el pago del primer año"].filter(Boolean);
      return `Para que tu planta quede protegida falta ${falta.join(" y ") || "completar el alta"}.`;
    }
    case "EN_CARENCIA":
      return `Tu planta queda protegida desde el ${fecha(p.coberturaDesde)}: son 30 días de espera desde el pago.`;
    case "VIGENTE":
      return `Tu planta está protegida hasta el ${fecha(p.vencimiento)}.`;
    case "POR_VENCER":
      return `Tu plan vence el ${fecha(p.vencimiento)}. Para que siga sin cortes, pagá el año siguiente antes de esa fecha.`;
    case "EN_GRACIA":
      return `Tu plan venció el ${fecha(p.vencimiento)}. Seguís protegido unos días más: si pagás dentro de los 15 días del vencimiento, sigue sin cortes.`;
    case "SUSPENDIDA":
      return "Tu plan está suspendido porque no se pagó a tiempo. Al pagar se reactiva, con 30 días de espera.";
    case "VENCIDA":
      return `Tu plan venció el ${fecha(p.vencimiento)}.`;
    case "CANCELADA":
      return "Tu plan está dado de baja.";
  }
}

function PlanGranizo({ p }: { p: PortalPlanGranizo }) {
  const e = ESTADO[p.estado];
  const datos: [string, string][] = [
    ["Protegido desde", fecha(p.coberturaDesde)],
    ["Hasta", fecha(p.vencimiento)],
    ["Paneles protegidos", String(p.cantidadPaneles)],
    ["Costo por año", usd(p.montoAnualUsd)],
  ];
  if (p.proximoCobro?.fecha && p.estado !== "CANCELADA") {
    datos.push(["Próximo pago", `${fecha(p.proximoCobro.fecha)} · ${usd(p.proximoCobro.montoUsd)}`]);
  }
  if (p.deudaUsd > 0) datos.push(["Pendiente de pago", usd(p.deudaUsd)]);

  return (
    <Tarjeta icono={<CloudHail className="h-4 w-4" />} titulo="Plan de Protección contra Granizo">
      <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${TONO[e.tono]}`}>{e.texto}</span>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{explicacion(p)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-[var(--color-text-muted)]">{k}</dt>
            <dd className="text-sm font-medium text-[var(--color-text-primary)]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-2">
        {p.anexo ? (
          <FilaArchivo f={p.anexo} detalle={`Solicitud de adhesión (Anexo A), firmada el ${fecha(p.anexo.firmadoEl)}`} />
        ) : (
          <Vacio>La solicitud de adhesión (Anexo A) firmada todavía no está cargada.</Vacio>
        )}
        {p.condiciones && <FilaArchivo f={p.condiciones} detalle="Condiciones del plan" />}
      </div>
    </Tarjeta>
  );
}

export function PortalDocumentos() {
  const { data: proyectos = [], isLoading, isError } = useQuery({
    queryKey: ["portal-documentos"],
    queryFn: getPortalDocumentos,
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Mis documentos</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Lo que firmaste con Voltia y para UTE, para tenerlo siempre a mano.
        </p>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No pudimos cargar tus documentos. Refrescá la página en un rato.
        </div>
      ) : (
        proyectos.map((p) => {
          const variasCuentas = p.ute.length > 1;
          return (
            <div key={p.projectId} className="space-y-4">
              {proyectos.length > 1 && (
                <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  {p.nombre} · {p.capacityKwp} kWp
                </h2>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta icono={<FileSignature className="h-4 w-4" />} titulo="Contrato con Voltia">
                  {p.contrato ? (
                    <FilaArchivo f={p.contrato} />
                  ) : (
                    <Vacio>Tu contrato firmado todavía no está cargado. Si lo necesitás, escribinos.</Vacio>
                  )}
                </Tarjeta>

                <Tarjeta icono={<Landmark className="h-4 w-4" />} titulo="Papeles de UTE">
                  {p.ute.length === 0 ? (
                    <Vacio>Los papeles que firmaste para UTE se cargan acá después de la instalación.</Vacio>
                  ) : (
                    <div className="space-y-3">
                      {p.ute.map((g) => (
                        <div key={g.suministro} className="space-y-2">
                          {variasCuentas && (
                            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                              Cuenta UTE {g.suministro}
                            </p>
                          )}
                          {g.archivos.map((f) => (
                            <FilaArchivo key={f.id} f={f} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Tarjeta>
              </div>

              {p.plan && <PlanGranizo p={p.plan} />}
            </div>
          );
        })
      )}
    </div>
  );
}
