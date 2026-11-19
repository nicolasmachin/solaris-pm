import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Download, FileText, Package, Plus, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  ESTADO_LABEL,
  borrarCotizacion,
  buscarDestinatarios,
  cambiarEstadoCotizacion,
  crearArticuloVenta,
  crearCotizacion,
  duplicarCotizacion,
  editarArticuloVenta,
  editarCotizacion,
  getArticulosVenta,
  getCotizacion,
  getCotizaciones,
  pdfCotizacion,
  vistaPreviaCotizacion,
  type ArticuloVenta,
  type ContenidoCotizacion,
  type CotizacionEstado,
  type CotizacionFicha,
  type CotizacionFila,
  type DatosArticulo,
  type Destinatario,
  type DestinoCotizacion,
  type Moneda,
  type Renglon,
} from "../api/cotizaciones.api";
import { Button } from "../components/ui/Button";
import { CanAccess } from "../components/ui/CanAccess";
import { LargeModal } from "../components/ui/LargeModal";
import { Sheet } from "../components/ui/Sheet";
import { Spinner } from "../components/ui/Spinner";
import { UserSelect } from "../components/ui/UserSelect";
import { INPUT, useBusqueda } from "../components/crm/Elegir";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/auth.store";

// Cotizaciones a medida: lo que se cotiza a mano (ampliaciones, cargadores,
// trabajos sueltos), fuera del cotizador solar. Para un proyecto, un lead, un
// contacto o una empresa, o para un cliente nuevo que se da de alta al guardar.

const INPUT_CHICO = INPUT.replace("w-full", "w-auto");

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sumarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const plata = (n: number, moneda: Moneda) =>
  `${moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_COLOR: Record<CotizacionEstado | "VENCIDA", string> = {
  BORRADOR: "bg-slate-500/15 text-[var(--color-text-secondary)]",
  ENVIADA: "bg-blue-500/15 text-blue-500",
  ACEPTADA: "bg-emerald-500/15 text-emerald-500",
  RECHAZADA: "bg-red-500/15 text-red-500",
  VENCIDA: "bg-amber-500/15 text-amber-500",
};

function EstadoChip({ estado, validaHasta }: { estado: CotizacionEstado; validaHasta: string }) {
  const vencida = estado === "ENVIADA" && validaHasta.slice(0, 10) < hoyIso();
  const clave = vencida ? "VENCIDA" : estado;
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_COLOR[clave]}`}>
      {vencida ? "Vencida" : ESTADO_LABEL[estado]}
    </span>
  );
}

/** A qué está atada la cotización, en una línea. */
function vinculoTexto(c: CotizacionFila): string {
  if (c.project) return `Proyecto ${c.project.code}`;
  if (c.lead) return `Lead${c.lead.code ? ` ${c.lead.code}` : ""}`;
  if (c.empresa) return `Empresa · ${c.empresa.razonSocial}`;
  if (c.contacto) return "Contacto";
  return "—";
}

function Campo({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}

// ─── Lista ───────────────────────────────────────────────────────────────────

export function VentasCotizaciones() {
  const [texto, q, setTexto] = useBusqueda();
  const [estado, setEstado] = useState<CotizacionEstado | "">("");
  const [params, setParams] = useSearchParams();
  const abierta = params.get("id");
  const { data = [], isLoading } = useQuery({
    queryKey: ["cotizaciones", q, estado],
    queryFn: () => getCotizaciones({ q: q || undefined, estado: estado || undefined }),
  });
  const abrir = (id: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) n.set("id", id);
      else n.delete("id");
      return n;
    });

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Ventas</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[var(--color-text-primary)]">
            <FileText className="h-6 w-6 text-[var(--color-accent)]" /> Cotizaciones a medida
          </h1>
        </div>
        <select className={INPUT_CHICO} value={estado} onChange={(e) => setEstado(e.target.value as CotizacionEstado | "")}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABEL) as CotizacionEstado[]).map((k) => (
            <option key={k} value={k}>
              {ESTADO_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input className={`${INPUT} pl-9`} placeholder="Número, cliente, proyecto…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <CanAccess module="VENTAS" action="CREATE">
          <Button onClick={() => abrir("nueva")}>
            <Plus size={16} /> Nueva
          </Button>
        </CanAccess>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--color-bg-card)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="hidden px-4 py-2 lg:table-cell">Qué se cotiza</th>
                <th className="hidden px-4 py-2 md:table-cell">Vinculada a</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    {q || estado ? "No hay cotizaciones que coincidan." : "Todavía no hay cotizaciones a medida."}
                  </td>
                </tr>
              )}
              {data.map((c) => (
                <tr key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[var(--color-text-secondary)]">{c.numero}</td>
                  <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{c.clienteNombre}</td>
                  <td className="hidden max-w-[320px] truncate px-4 py-2 text-[var(--color-text-secondary)] lg:table-cell">{c.primerItem ?? "—"}</td>
                  <td className="hidden px-4 py-2 text-[var(--color-text-secondary)] md:table-cell">{vinculoTexto(c)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-[var(--color-text-secondary)]">{fechaCorta(c.fecha)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-[var(--color-text-primary)]">{plata(Number(c.total), c.moneda)}</td>
                  <td className="px-4 py-2">
                    <EstadoChip estado={c.estado} validaHasta={c.validaHasta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierta && <Constructor key={abierta} id={abierta === "nueva" ? null : abierta} onAbrir={abrir} onClose={() => abrir(null)} />}
    </div>
  );
}

// ─── Constructor ─────────────────────────────────────────────────────────────

type Para =
  | { modo: "existente"; titulo: string; subtitulo: string | null; vinculo: DestinoCotizacion }
  | { modo: "nuevo"; nombre: string; telefono: string; email: string };

const ITEM_VACIO: Renglon = { tipo: "item", descripcion: "", detalle: "", cantidad: 1, unidad: "", precioUnitario: 0 };

function contenidoNuevo(vendedorId: string | null): ContenidoCotizacion {
  const fecha = hoyIso();
  return {
    clienteNombre: "",
    clienteDireccion: "",
    clienteCiudad: "",
    clienteTelefono: "",
    clienteEmail: "",
    fecha,
    validaHasta: sumarDias(fecha, 30),
    moneda: "USD",
    vendedorId,
    formaTrabajo: "",
    alcanceTitulo: "",
    alcanceTexto: "",
    items: [{ ...ITEM_VACIO }],
    ivaTasa: 22,
    condicionesPago: "",
    plazoEntrega: "",
    incluye: "",
    noIncluye: "",
    observaciones: "",
  };
}

/** El "para quién" de una cotización guardada. */
function paraDe(c: CotizacionFicha): Para {
  const vinculo = { leadId: c.leadId, contactoId: c.contactoId, empresaId: c.empresaId, projectId: c.projectId };
  if (c.project) return { modo: "existente", titulo: `Proyecto ${c.project.code} · ${c.project.clientName}`, subtitulo: null, vinculo };
  if (c.lead) return { modo: "existente", titulo: `Lead · ${c.lead.clientName}`, subtitulo: null, vinculo };
  if (c.empresa) return { modo: "existente", titulo: `Empresa · ${c.empresa.razonSocial}`, subtitulo: c.contacto?.nombre ?? null, vinculo };
  if (c.contacto) return { modo: "existente", titulo: `Contacto · ${c.contacto.nombre}`, subtitulo: null, vinculo };
  return { modo: "existente", titulo: "Sin vínculo", subtitulo: null, vinculo };
}

const TIPO_LABEL: Record<Destinatario["tipo"], string> = { proyecto: "Proyecto", lead: "Lead", contacto: "Contacto", empresa: "Empresa" };

/** Buscador unificado de proyectos, leads, contactos y empresas, más "Cliente nuevo". */
function ElegirPara({ onElegir, onNuevo }: { onElegir: (d: Destinatario) => void; onNuevo: () => void }) {
  const [texto, q, setTexto] = useBusqueda();
  const { data = [], isFetching } = useQuery({ queryKey: ["cotiz-destinatarios", q], queryFn: () => buscarDestinatarios(q), enabled: q.length >= 2 });
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className={INPUT} placeholder="Buscar proyecto, lead, contacto o empresa…" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <Button variant="secondary" onClick={onNuevo} className="shrink-0">
          <UserPlus size={15} /> Cliente nuevo
        </Button>
      </div>
      {q.length >= 2 && (
        <ul className="max-h-64 overflow-auto rounded-lg border border-[var(--color-border)]">
          {data.length === 0 && <li className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{isFetching ? "Buscando…" : "Sin resultados. Si es alguien nuevo, usá «Cliente nuevo»."}</li>}
          {data.map((d) => (
            <li key={`${d.tipo}-${d.id}`}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--color-bg-card-hover)]"
                onClick={() => onElegir(d)}
              >
                <span className="w-16 shrink-0 font-mono text-[10px] uppercase text-[var(--color-text-muted)]">{TIPO_LABEL[d.tipo]}</span>
                <span className="text-[var(--color-text-primary)]">{d.titulo}</span>
                {d.subtitulo && <span className="truncate text-[var(--color-text-muted)]">· {d.subtitulo}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Desplegable para sumar un artículo de venta como ítem. */
function AgregarArticulo({ onElegir }: { onElegir: (a: ArticuloVenta) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const { data = [] } = useQuery({ queryKey: ["articulos-venta", false], queryFn: () => getArticulosVenta(false), enabled: abierto });
  const lista = data.filter((a) => a.nombre.toLowerCase().includes(filtro.trim().toLowerCase())).slice(0, 30);
  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setAbierto((v) => !v)}>
        <Package size={14} /> Desde artículos
      </Button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 shadow-xl">
          <input className={INPUT} placeholder="Buscar artículo…" value={filtro} onChange={(e) => setFiltro(e.target.value)} autoFocus />
          <ul className="mt-1 max-h-64 overflow-auto">
            {lista.length === 0 && (
              <li className="px-2 py-2 text-[12px] text-[var(--color-text-muted)]">
                {data.length === 0 ? "No hay artículos cargados. Se cargan en Ventas → Artículos de venta." : "Sin resultados."}
              </li>
            )}
            {lista.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-bg-card-hover)]"
                  onClick={() => {
                    onElegir(a);
                    setAbierto(false);
                    setFiltro("");
                  }}
                >
                  <span className="text-[var(--color-text-primary)]">{a.nombre}</span>
                  <span className="whitespace-nowrap text-[12px] text-[var(--color-text-muted)]">{plata(Number(a.precio), a.moneda)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function num(v: string): number {
  // "1.234,5" o "1234,5" con coma decimal; si no hay coma, el punto es el decimal.
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Número editable como texto, para poder tipear "12,5" sin que se pierda la coma. */
function NumInput({ value, onChange, disabled, className = "", ariaLabel }: { value: number; onChange: (n: number) => void; disabled?: boolean; className?: string; ariaLabel?: string }) {
  const [t, setT] = useState(String(value).replace(".", ","));
  useEffect(() => {
    if (num(t) !== value) setT(String(value).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={`${INPUT} ${className}`}
      inputMode="decimal"
      value={t}
      aria-label={ariaLabel}
      onChange={(e) => {
        setT(e.target.value);
        onChange(num(e.target.value));
      }}
      disabled={disabled}
    />
  );
}

/** Editor de renglones: ítems con precio y títulos de sección. */
function EditorItems({ items, moneda, onChange, soloLectura }: { items: Renglon[]; moneda: Moneda; onChange: (r: Renglon[]) => void; soloLectura: boolean }) {
  const set = (i: number, r: Renglon) => onChange(items.map((x, j) => (j === i ? r : x)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i));
  const btn = "rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-30";

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-[13px] text-[var(--color-text-muted)]">Sin ítems todavía.</p>}
      {items.map((r, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
          <div className="min-w-0 flex-1 space-y-2">
            {r.tipo === "seccion" ? (
              <input
                className={`${INPUT} font-semibold uppercase tracking-wide text-[var(--color-accent)]`}
                placeholder="Título de la sección (ej. Materiales)"
                value={r.descripcion}
                onChange={(e) => set(i, { ...r, descripcion: e.target.value })}
                disabled={soloLectura}
              />
            ) : (
              <>
                <input className={INPUT} placeholder="Descripción" value={r.descripcion} onChange={(e) => set(i, { ...r, descripcion: e.target.value })} disabled={soloLectura} />
                <textarea
                  className={`${INPUT} text-[12px]`}
                  rows={1}
                  placeholder="Detalle (opcional, sale en letra chica debajo)"
                  value={r.detalle ?? ""}
                  onChange={(e) => set(i, { ...r, detalle: e.target.value })}
                  disabled={soloLectura}
                />
                <div className="grid grid-cols-[1fr_1fr_1.4fr_1.4fr] gap-2">
                  <Campo label="Cant.">
                    <NumInput value={r.cantidad} onChange={(n) => set(i, { ...r, cantidad: n })} disabled={soloLectura} />
                  </Campo>
                  <Campo label="Unidad">
                    <input className={INPUT} placeholder="un" value={r.unidad ?? ""} onChange={(e) => set(i, { ...r, unidad: e.target.value })} disabled={soloLectura} />
                  </Campo>
                  <Campo label="Precio unit.">
                    <NumInput value={r.precioUnitario} onChange={(n) => set(i, { ...r, precioUnitario: n })} disabled={soloLectura} />
                  </Campo>
                  <Campo label="Subtotal">
                    <div className="py-2 text-right text-[13px] font-medium text-[var(--color-text-primary)]">{plata(r.cantidad * r.precioUnitario, moneda)}</div>
                  </Campo>
                </div>
              </>
            )}
          </div>
          {!soloLectura && (
            <div className="flex flex-col">
              <button type="button" className={btn} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                <ArrowUp size={14} />
              </button>
              <button type="button" className={btn} onClick={() => mover(i, 1)} disabled={i === items.length - 1} aria-label="Bajar">
                <ArrowDown size={14} />
              </button>
              <button type="button" className={btn} onClick={() => quitar(i)} aria-label="Quitar">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const FORMAS_TRABAJO = ["Servicios profesionales", "Suministro de materiales", "Suministro e instalación"];

function Constructor({ id, onClose, onAbrir }: { id: string | null; onClose: () => void; onAbrir: (id: string) => void }) {
  const qc = useQueryClient();
  const yo = useAuthStore((s) => s.user);
  const puedeGuardar = usePermission("VENTAS", id ? "EDIT" : "CREATE");
  const puedeEditarEstado = usePermission("VENTAS", "EDIT");
  const puedeDuplicar = usePermission("VENTAS", "CREATE");
  const puedeBorrar = usePermission("VENTAS", "DELETE");

  const ficha = useQuery({ queryKey: ["cotizacion", id], queryFn: () => getCotizacion(id!), enabled: !!id });
  const [c, setC] = useState<ContenidoCotizacion | null>(id ? null : contenidoNuevo(yo?.id ?? null));
  const [para, setPara] = useState<Para | null>(null);
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    if (ficha.data && !c) {
      setC(ficha.data.contenido);
      setPara(paraDe(ficha.data));
    }
  }, [ficha.data, c]);

  const cambiar = (patch: Partial<ContenidoCotizacion>) => {
    setC((v) => (v ? { ...v, ...patch } : v));
    setSucio(true);
  };
  const txt = (k: keyof ContenidoCotizacion) => ({
    value: (c?.[k] as string | null | undefined) ?? "",
    onChange: (e: { target: { value: string } }) => cambiar({ [k]: e.target.value } as Partial<ContenidoCotizacion>),
    disabled: !puedeGuardar,
  });

  const elegirExistente = (d: Destinatario) => {
    setPara({ modo: "existente", titulo: `${TIPO_LABEL[d.tipo]} · ${d.titulo}`, subtitulo: d.subtitulo, vinculo: d.vinculo });
    cambiar({
      clienteNombre: d.cliente.nombre,
      clienteDireccion: d.cliente.direccion ?? "",
      clienteCiudad: d.cliente.ciudad ?? "",
      clienteTelefono: d.cliente.telefono ?? "",
      clienteEmail: d.cliente.email ?? "",
    });
  };
  const setNuevo = (patch: Partial<{ nombre: string; telefono: string; email: string }>) => {
    setPara((p) => {
      const base = p?.modo === "nuevo" ? p : { modo: "nuevo" as const, nombre: "", telefono: "", email: "" };
      return { ...base, ...patch };
    });
    const m: Partial<ContenidoCotizacion> = {};
    if (patch.nombre !== undefined) m.clienteNombre = patch.nombre;
    if (patch.telefono !== undefined) m.clienteTelefono = patch.telefono;
    if (patch.email !== undefined) m.clienteEmail = patch.email;
    cambiar(m);
  };

  // Totales en pantalla (el servidor los vuelve a calcular al guardar).
  const totales = useMemo(() => {
    const subtotal = (c?.items ?? []).reduce((s, r) => (r.tipo === "item" ? s + r.cantidad * r.precioUnitario : s), 0);
    const iva = (subtotal * (c?.ivaTasa ?? 0)) / 100;
    return { subtotal, iva, total: subtotal + iva };
  }, [c?.items, c?.ivaTasa]);

  // Vista previa del PDF, un segundo después del último cambio.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const urlRef = useRef<string | null>(null);
  const clave = c ? JSON.stringify(c) : "";
  useEffect(() => {
    if (!c) return;
    const t = setTimeout(async () => {
      setGenerando(true);
      try {
        const blob = await vistaPreviaCotizacion({ ...c, clienteNombre: c.clienteNombre.trim() || "—", numero: ficha.data?.numero ?? null });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPdfUrl(url);
      } catch {
        // Si falla la vista previa no se interrumpe la edición.
      } finally {
        setGenerando(false);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ficha.data?.numero]);
  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), []);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    qc.invalidateQueries({ queryKey: ["cotizacion", id] });
  };

  const guardar = useMutation({
    mutationFn: () => {
      if (!c || !para) throw new Error("Falta elegir para quién es la cotización.");
      const destino: DestinoCotizacion =
        para.modo === "nuevo"
          ? { clienteNuevo: { nombre: para.nombre.trim(), telefono: para.telefono.trim() || null, email: para.email.trim() || null } }
          : para.vinculo;
      const body = { ...c, ...destino };
      return id ? editarCotizacion(id, body) : crearCotizacion(body);
    },
    onSuccess: (r) => {
      setSucio(false);
      invalidar();
      if (para?.modo === "nuevo") qc.invalidateQueries({ queryKey: ["crm-contactos"] });
      if (id) {
        // Al editar, el vínculo queda como quedó en el servidor (el cliente nuevo pasa a ser contacto).
        qc.invalidateQueries({ queryKey: ["cotizacion", id] }).then(() => {
          const f = qc.getQueryData<CotizacionFicha>(["cotizacion", id]);
          if (f) setPara(paraDe(f));
        });
        toast.success("Cotización guardada");
      } else {
        toast.success(`Cotización ${r.numero} creada`);
        onAbrir(r.id);
      }
    },
    onError: (e) => toast.error(getApiErr(e) ?? (e as Error).message ?? "No se pudo guardar"),
  });

  const estado = useMutation({
    mutationFn: (e: CotizacionEstado) => cambiarEstadoCotizacion(id!, e),
    onSuccess: () => {
      invalidar();
      toast.success("Estado actualizado");
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo cambiar el estado"),
  });

  const duplicar = useMutation({
    mutationFn: () => duplicarCotizacion(id!),
    onSuccess: (r) => {
      invalidar();
      toast.success(`Copia creada: ${r.numero}`);
      onAbrir(r.id);
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo duplicar"),
  });

  const borrar = useMutation({
    mutationFn: () => borrarCotizacion(id!),
    onSuccess: () => {
      invalidar();
      toast.success("Cotización borrada");
      onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo borrar"),
  });

  const descargar = async () => {
    if (!id || !ficha.data) return;
    try {
      const blob = await pdfCotizacion(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cotizacion_Voltia_${ficha.data.numero}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      toast.error(getApiErr(e) ?? "No se pudo bajar el PDF");
    }
  };

  const cerrar = () => {
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Cerrar igual?")) return;
    onClose();
  };

  const listo = !!c && (!id || !!para);
  const soloLectura = !puedeGuardar;
  const faltaPara = !para || (para.modo === "nuevo" && !para.nombre.trim());

  return (
    <LargeModal open onClose={cerrar} ariaLabel="Cotización a medida">
      {!listo ? (
        <div className="p-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid h-full grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Formulario */}
          <div className="min-h-0 overflow-y-auto px-5 pt-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-display text-xl font-bold text-[var(--color-text-primary)]">
                {id ? `Cotización ${ficha.data?.numero ?? ""}` : "Nueva cotización"}
              </h2>
              {id && ficha.data && (
                <select
                  className={INPUT_CHICO}
                  value={ficha.data.estado}
                  onChange={(e) => estado.mutate(e.target.value as CotizacionEstado)}
                  disabled={!puedeEditarEstado || estado.isPending}
                  aria-label="Estado"
                >
                  {(Object.keys(ESTADO_LABEL) as CotizacionEstado[]).map((k) => (
                    <option key={k} value={k}>
                      {ESTADO_LABEL[k]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-4">
              {/* Para quién */}
              <div className="space-y-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Para quién es</h3>
                {para?.modo === "existente" ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px]">
                    <span className="font-medium text-[var(--color-text-primary)]">{para.titulo}</span>
                    {para.subtitulo && <span className="text-[var(--color-text-muted)]">· {para.subtitulo}</span>}
                    {!soloLectura && (
                      <button type="button" className="ml-auto rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" onClick={() => setPara(null)} aria-label="Cambiar">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : para?.modo === "nuevo" ? (
                  <div className="space-y-2 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-bg-card)] p-3">
                    <div className="flex items-center">
                      <span className="text-[12px] font-semibold text-[var(--color-accent)]">Cliente nuevo · se da de alta como contacto al guardar</span>
                      <button type="button" className="ml-auto rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" onClick={() => setPara(null)} aria-label="Cancelar">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Campo label="Nombre *">
                        <input className={INPUT} value={para.nombre} onChange={(e) => setNuevo({ nombre: e.target.value })} autoFocus />
                      </Campo>
                      <Campo label="Teléfono">
                        <input className={INPUT} value={para.telefono} onChange={(e) => setNuevo({ telefono: e.target.value })} placeholder="099 123 456" />
                      </Campo>
                      <Campo label="Mail">
                        <input className={INPUT} value={para.email} onChange={(e) => setNuevo({ email: e.target.value })} />
                      </Campo>
                    </div>
                  </div>
                ) : (
                  <ElegirPara onElegir={elegirExistente} onNuevo={() => setNuevo({})} />
                )}
              </div>

              <Seccion titulo="Datos del cliente en la cotización">
                <p className="-mt-1 text-[12px] text-[var(--color-text-muted)]">Se copian de la ficha; cambiarlos acá no toca la ficha del cliente.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Nombre">
                    <input className={INPUT} {...txt("clienteNombre")} />
                  </Campo>
                  <Campo label="Celular">
                    <input className={INPUT} {...txt("clienteTelefono")} />
                  </Campo>
                  <Campo label="Dirección">
                    <input className={INPUT} {...txt("clienteDireccion")} />
                  </Campo>
                  <Campo label="Ciudad">
                    <input className={INPUT} {...txt("clienteCiudad")} />
                  </Campo>
                  <Campo label="Mail" className="sm:col-span-2">
                    <input className={INPUT} {...txt("clienteEmail")} />
                  </Campo>
                </div>
              </Seccion>

              <Seccion titulo="Datos de la cotización">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Fecha">
                    <input type="date" className={INPUT} {...txt("fecha")} />
                  </Campo>
                  <Campo label="Válida hasta">
                    <input type="date" className={INPUT} {...txt("validaHasta")} />
                  </Campo>
                  <Campo label="Moneda">
                    <select className={INPUT} value={c!.moneda} onChange={(e) => cambiar({ moneda: e.target.value as Moneda })} disabled={soloLectura}>
                      <option value="USD">Dólares (US$)</option>
                      <option value="UYU">Pesos ($)</option>
                    </select>
                  </Campo>
                  <Campo label="Vendedor">
                    <UserSelect value={c!.vendedorId ?? null} onChange={(v) => cambiar({ vendedorId: v })} disabled={soloLectura} unassignedLabel="Sin vendedor" />
                  </Campo>
                  <Campo label="Forma de trabajo" className="sm:col-span-2">
                    <input className={INPUT} list="formas-trabajo" placeholder="Opcional" {...txt("formaTrabajo")} />
                    <datalist id="formas-trabajo">
                      {FORMAS_TRABAJO.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </Campo>
                </div>
              </Seccion>

              <Seccion titulo="Alcance (opcional)">
                <Campo label="Título">
                  <input className={INPUT} placeholder="Alcance del trabajo" {...txt("alcanceTitulo")} />
                </Campo>
                <textarea className={INPUT} rows={3} placeholder="Qué se va a hacer, en un párrafo. **negrita** para resaltar." {...txt("alcanceTexto")} />
              </Seccion>

              <Seccion
                titulo="Detalle"
                accion={
                  !soloLectura && (
                    <div className="flex flex-wrap gap-2">
                      <AgregarArticulo
                        onElegir={(a) => {
                          if (a.moneda !== c!.moneda) toast(`«${a.nombre}» tiene el precio en ${a.moneda === "USD" ? "dólares" : "pesos"}: revisalo.`, { icon: "⚠️" });
                          cambiar({
                            items: [
                              ...c!.items,
                              { tipo: "item", descripcion: a.nombre, detalle: a.detalle ?? "", cantidad: 1, unidad: a.unidad, precioUnitario: Number(a.precio), articuloId: a.id },
                            ],
                          });
                        }}
                      />
                      <Button size="sm" variant="secondary" onClick={() => cambiar({ items: [...c!.items, { ...ITEM_VACIO }] })}>
                        <Plus size={14} /> Ítem
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cambiar({ items: [...c!.items, { tipo: "seccion", descripcion: "" }] })}>
                        <Plus size={14} /> Sección
                      </Button>
                    </div>
                  )
                }
              >
                <EditorItems items={c!.items} moneda={c!.moneda} onChange={(items) => cambiar({ items })} soloLectura={soloLectura} />
                <div className="ml-auto w-full max-w-xs space-y-1 text-[13px]">
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{plata(totales.subtotal, c!.moneda)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1">
                      IVA
                      <NumInput className="w-16 py-1 text-right" value={c!.ivaTasa} onChange={(n) => cambiar({ ivaTasa: Math.min(100, n) })} disabled={soloLectura} ariaLabel="Tasa de IVA" />
                      %
                    </span>
                    <span>{plata(totales.iva, c!.moneda)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-bold text-[var(--color-text-primary)]">
                    <span>Total</span>
                    <span>{plata(totales.total, c!.moneda)}</span>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Condiciones">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Condiciones de pago">
                    <textarea className={INPUT} rows={2} placeholder="Ej. 50% al aceptar, 50% al terminar" {...txt("condicionesPago")} />
                  </Campo>
                  <Campo label="Plazo de entrega">
                    <textarea className={INPUT} rows={2} placeholder="Ej. 10 días hábiles desde la aceptación" {...txt("plazoEntrega")} />
                  </Campo>
                  <Campo label="Incluye (uno por línea)">
                    <textarea className={INPUT} rows={3} {...txt("incluye")} />
                  </Campo>
                  <Campo label="No incluye (uno por línea)">
                    <textarea className={INPUT} rows={3} {...txt("noIncluye")} />
                  </Campo>
                  <Campo label="Observaciones" className="sm:col-span-2">
                    <textarea className={INPUT} rows={3} {...txt("observaciones")} />
                  </Campo>
                </div>
              </Seccion>
            </div>

            {/* Acciones */}
            <div className="sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-app)] px-5 py-3">
              {puedeGuardar && (
                <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || faltaPara || !c!.clienteNombre.trim()}>
                  <Save size={15} /> {guardar.isPending ? "Guardando…" : id ? "Guardar" : "Crear cotización"}
                </Button>
              )}
              {id && (
                <Button variant="secondary" onClick={descargar} disabled={sucio} title={sucio ? "Guardá primero los cambios" : undefined}>
                  <Download size={15} /> Bajar PDF
                </Button>
              )}
              {id && puedeDuplicar && (
                <Button variant="secondary" onClick={() => duplicar.mutate()} disabled={duplicar.isPending || sucio}>
                  <Copy size={15} /> Duplicar
                </Button>
              )}
              {id && puedeBorrar && (
                <Button
                  variant="ghost"
                  className="ml-auto text-red-500"
                  onClick={() => window.confirm("¿Borrar esta cotización?") && borrar.mutate()}
                  disabled={borrar.isPending}
                >
                  <Trash2 size={15} /> Borrar
                </Button>
              )}
              {faltaPara && !soloLectura && <span className="text-[12px] text-[var(--color-text-muted)]">Falta elegir para quién es.</span>}
            </div>
          </div>

          {/* Vista previa */}
          <div className="hidden min-h-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-card)] lg:flex">
            <div className="flex h-9 shrink-0 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <span>Vista previa</span>
              {generando && <span>Actualizando…</span>}
            </div>
            {pdfUrl ? (
              <iframe title="Vista previa de la cotización" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 flex-1 bg-white" />
            ) : (
              <div className="p-10">
                <Spinner />
              </div>
            )}
          </div>
        </div>
      )}
    </LargeModal>
  );
}

// ─── Artículos de venta ──────────────────────────────────────────────────────

const ARTICULO_VACIO: DatosArticulo = { nombre: "", detalle: "", unidad: "un", precio: 0, moneda: "USD", activo: true };

function FichaArticulo({ articulo, onClose }: { articulo: ArticuloVenta | null; onClose: () => void }) {
  const qc = useQueryClient();
  const puedeEditar = usePermission("VENTAS", "EDIT");
  const [d, setD] = useState<DatosArticulo>(
    articulo
      ? { nombre: articulo.nombre, detalle: articulo.detalle ?? "", unidad: articulo.unidad, precio: Number(articulo.precio), moneda: articulo.moneda, activo: articulo.activo }
      : ARTICULO_VACIO,
  );
  const [precioTxt, setPrecioTxt] = useState(String(d.precio));
  const guardar = useMutation({
    mutationFn: () => {
      const datos = { ...d, nombre: d.nombre.trim(), detalle: d.detalle?.trim() || null, precio: num(precioTxt) };
      return articulo ? editarArticuloVenta(articulo.id, datos) : crearArticuloVenta(datos);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articulos-venta"] });
      toast.success("Artículo guardado");
      onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo guardar"),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={articulo ? articulo.nombre : "Nuevo artículo de venta"}
      footer={
        puedeEditar && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || !d.nombre.trim() || !d.unidad.trim()}>
              Guardar
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3 p-1">
        <Campo label="Nombre (sale como descripción del ítem)">
          <input className={INPUT} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} disabled={!puedeEditar} autoFocus />
        </Campo>
        <Campo label="Detalle (opcional, letra chica debajo)">
          <textarea className={INPUT} rows={3} value={d.detalle ?? ""} onChange={(e) => setD({ ...d, detalle: e.target.value })} disabled={!puedeEditar} />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Unidad">
            <input className={INPUT} value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value })} disabled={!puedeEditar} />
          </Campo>
          <Campo label="Precio sin IVA">
            <input className={INPUT} inputMode="decimal" value={precioTxt} onChange={(e) => setPrecioTxt(e.target.value)} disabled={!puedeEditar} />
          </Campo>
          <Campo label="Moneda">
            <select className={INPUT} value={d.moneda} onChange={(e) => setD({ ...d, moneda: e.target.value as Moneda })} disabled={!puedeEditar}>
              <option value="USD">US$</option>
              <option value="UYU">$</option>
            </select>
          </Campo>
        </div>
        {articulo && (
          <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={d.activo ?? true} onChange={(e) => setD({ ...d, activo: e.target.checked })} disabled={!puedeEditar} />
            Activo (los inactivos no aparecen al cotizar)
          </label>
        )}
      </div>
    </Sheet>
  );
}

export function VentasArticulos() {
  const [filtro, setFiltro] = useState("");
  const [abierto, setAbierto] = useState<ArticuloVenta | "nuevo" | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["articulos-venta", true], queryFn: () => getArticulosVenta(true) });
  const lista = data.filter((a) => a.nombre.toLowerCase().includes(filtro.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Ventas</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[var(--color-text-primary)]">
            <Package className="h-6 w-6 text-[var(--color-accent)]" /> Artículos de venta
          </h1>
          <p className="text-[12px] text-[var(--color-text-muted)]">Ítems con precio de venta (sin IVA) para sumar rápido a las cotizaciones a medida.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input className={`${INPUT} pl-9`} placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </div>
        <CanAccess module="VENTAS" action="EDIT">
          <Button onClick={() => setAbierto("nuevo")}>
            <Plus size={16} /> Nuevo
          </Button>
        </CanAccess>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--color-bg-card)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2">Artículo</th>
                <th className="px-4 py-2">Unidad</th>
                <th className="px-4 py-2 text-right">Precio sin IVA</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    {filtro ? "No hay artículos que coincidan." : "Todavía no hay artículos de venta."}
                  </td>
                </tr>
              )}
              {lista.map((a) => (
                <tr key={a.id} onClick={() => setAbierto(a)} className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-4 py-2">
                    <div className="font-medium text-[var(--color-text-primary)]">{a.nombre}</div>
                    {a.detalle && <div className="truncate text-[12px] text-[var(--color-text-muted)]">{a.detalle}</div>}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-text-secondary)]">{a.unidad}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-[var(--color-text-primary)]">{plata(Number(a.precio), a.moneda)}</td>
                  <td className="px-4 py-2 text-[12px] text-[var(--color-text-muted)]">{a.activo ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierto && <FichaArticulo key={abierto === "nuevo" ? "nuevo" : abierto.id} articulo={abierto === "nuevo" ? null : abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
}
