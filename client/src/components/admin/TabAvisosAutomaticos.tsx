import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Mail, MessageCircle, Pause, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";

import {
  activarAviso,
  borrarAviso,
  crearAviso,
  editarAviso,
  getAvisos,
  getAvisosCatalogo,
  getAvisosEnvios,
  mandarAvisoAMeta,
  pausarAviso,
  quitarAdjuntoAviso,
  subirAdjuntoAviso,
  type Aviso,
  type AvisoCanal,
  type AvisoDatos,
  type AvisoEstado,
  type AvisosCatalogo,
} from "../../api/avisos.api";
import { usePermission } from "../../hooks/usePermission";
import { Button } from "../ui/Button";

// Administración → Avisos automáticos: mensajes que Voltia PM le manda solo al
// cliente cuando pasa un hecho del flujo. Se arma eligiendo el disparador y el
// mensaje; en WhatsApp el mensaje es una plantilla que Meta aprueba antes de
// poder activarla. Ver docs/manual/20-avisos-automaticos.md.

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
/** Para los campos que van dentro de una frase: sin el ancho completo. */
const inpLinea = inp.replace("w-full", "");
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

const ESTADO: Record<AvisoEstado, { texto: string; clase: string }> = {
  BORRADOR: { texto: "Borrador", clase: "bg-[var(--color-border)] text-[var(--color-text-secondary)]" },
  EN_REVISION: { texto: "En revisión de Meta", clase: "bg-amber-500/15 text-amber-500" },
  RECHAZADO: { texto: "Rechazado por Meta", clase: "bg-red-500/15 text-red-500" },
  LISTO: { texto: "Aprobado, sin activar", clase: "bg-sky-500/15 text-sky-500" },
  ACTIVO: { texto: "Activo", clase: "bg-emerald-500/15 text-emerald-500" },
  PAUSADO: { texto: "Pausado", clase: "bg-[var(--color-border)] text-[var(--color-text-secondary)]" },
};

const ESTADO_ENVIO: Record<string, string> = {
  ENVIADO: "Enviado",
  FALLIDO: "Falló",
  OMITIDO: "No se mandó",
  PROGRAMADO: "Programado",
  PROCESANDO: "Enviando",
};
const ESTADO_WA: Record<string, string> = { accepted: "aceptado", sent: "enviado", delivered: "entregado", read: "leído", failed: "no entregado" };

function errMsg(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo completar.";
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const VACIO: AvisoDatos = {
  nombre: "",
  disparador: "",
  dias: 1,
  demoraMinutos: null,
  condicion: null,
  canal: "WHATSAPP",
  asunto: "",
  cuerpo: "",
  cierraCheck: null,
  adjuntoTexto: "",
  adjuntoUnaVez: false,
};

const HORA = 60;
const DIA = 24 * HORA;

/** Si el video o la foto están completos y falta mandarlos a Meta. */
function adjuntoParaMandar(a: Aviso): boolean {
  return !!a.adjuntoArchivo && !!a.adjuntoTexto?.trim() && (!a.adjuntoPlantillaEstado || a.adjuntoPlantillaEstado === "REJECTED");
}

function estadoPlantillaAdjunto(a: Aviso): string {
  if (!a.adjuntoPlantillaEstado) return a.adjuntoArchivo && a.adjuntoTexto ? "sin mandar a Meta" : "incompleto";
  if (a.adjuntoPlantillaEstado === "APPROVED") return "aprobado por Meta";
  if (a.adjuntoPlantillaEstado === "REJECTED") return `rechazado por Meta${a.adjuntoPlantillaMotivo ? `: ${a.adjuntoPlantillaMotivo}` : ""}`;
  return "en revisión de Meta";
}

/** "2 horas", "1 día": la demora como se dice. */
export function demoraEnPalabras(minutos: number): string {
  if (minutos % DIA === 0) return `${minutos / DIA} día${minutos === DIA ? "" : "s"}`;
  if (minutos % HORA === 0) return `${minutos / HORA} hora${minutos === HORA ? "" : "s"}`;
  return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
}

export function TabAvisosAutomaticos() {
  const puedeEditar = usePermission("CONFIGURACION", "EDIT");
  const qc = useQueryClient();
  const { data: catalogo } = useQuery({ queryKey: ["avisos", "catalogo"], queryFn: getAvisosCatalogo });
  const { data: avisos = [], isLoading } = useQuery({ queryKey: ["avisos"], queryFn: getAvisos });
  const [editando, setEditando] = useState<Aviso | "nuevo" | null>(null);
  const [verEnvios, setVerEnvios] = useState<string | "todos" | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["avisos"] });
  };
  const accion = useMutation({
    mutationFn: async ({ tipo, id }: { tipo: "meta" | "activar" | "pausar" | "borrar"; id: string }) => {
      if (tipo === "meta") return mandarAvisoAMeta(id);
      if (tipo === "activar") return activarAviso(id);
      if (tipo === "pausar") return pausarAviso(id);
      return borrarAviso(id);
    },
    onSuccess: (_r, { tipo }) => {
      invalidar();
      toast.success(
        tipo === "meta"
          ? "Mandado a Meta. Cuando lo apruebe, se puede activar."
          : tipo === "activar"
            ? "Activo: sale con cada hecho nuevo desde ahora."
            : tipo === "pausar"
              ? "Pausado."
              : "Borrado.",
      );
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  const grupos = useMemo(() => {
    const m = new Map<string, Aviso[]>();
    for (const a of avisos) m.set(a.disparadorEtiqueta, [...(m.get(a.disparadorEtiqueta) ?? []), a]);
    return [...m.entries()];
  }, [avisos]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Avisos automáticos al cliente</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Cuando pasa algo en el proyecto (se confirma la fecha de obra, UTE habilita…), Voltia PM le manda solo un
            mensaje al cliente por WhatsApp o por mail. Solo cuentan los hechos que pasen después de activar cada aviso, y
            cada hecho manda el aviso una sola vez. Todo envío queda registrado y en la bitácora del cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setVerEnvios("todos")}>
            Registro de envíos
          </Button>
          {puedeEditar && (
            <Button size="sm" onClick={() => setEditando("nuevo")}>
              <Plus size={14} /> Nuevo aviso
            </Button>
          )}
        </div>
      </div>

      {editando && catalogo && (
        <Editor
          aviso={editando === "nuevo" ? null : editando}
          catalogo={catalogo}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            invalidar();
            setEditando(null);
          }}
          onRefrescar={invalidar}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
      ) : avisos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Todavía no hay avisos. Con «Nuevo aviso» se elige el disparador y se escribe el mensaje.
        </p>
      ) : (
        grupos.map(([grupo, lista]) => (
          <section key={grupo}>
            <h3 className={lbl}>{grupo}</h3>
            <div className="space-y-2">
              {lista.map((a) => (
                <div key={a.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.canal === "WHATSAPP" ? (
                      <MessageCircle size={15} className="text-emerald-500" aria-label="WhatsApp" />
                    ) : (
                      <Mail size={15} className="text-sky-500" aria-label="Mail" />
                    )}
                    <span className="font-medium text-[var(--color-text-primary)]">{a.nombre}</span>
                    {a.dias ? <span className="text-xs text-[var(--color-text-muted)]">· {a.dias} día(s) antes</span> : null}
                    {a.demoraMinutos ? (
                      <span className="text-xs text-[var(--color-text-muted)]">· sale {demoraEnPalabras(a.demoraMinutos)} después</span>
                    ) : null}
                    {a.condicion === "SIN_CONTACTO" ? (
                      <span className="text-xs text-[var(--color-text-muted)]">· si Experiencia Solar no le escribió</span>
                    ) : a.condicion === "PORTAL_CON_MAIL" ? (
                      <span className="text-xs text-[var(--color-text-muted)]">· clientes con mail</span>
                    ) : a.condicion === "PORTAL_SIN_MAIL" ? (
                      <span className="text-xs text-[var(--color-text-muted)]">· clientes sin mail</span>
                    ) : a.condicion === "MANTENIMIENTO_SIN_COSTO" ? (
                      <span className="text-xs text-[var(--color-text-muted)]">· solo los dos sin costo</span>
                    ) : null}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${ESTADO[a.estado].clase}`}>{ESTADO[a.estado].texto}</span>
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                      {a.envios.ENVIADO ?? 0} enviados
                      {a.envios.FALLIDO ? ` · ${a.envios.FALLIDO} fallidos` : ""}
                      {a.envios.OMITIDO ? ` · ${a.envios.OMITIDO} sin mandar` : ""}
                      {a.envios.PROGRAMADO ? ` · ${a.envios.PROGRAMADO} programados` : ""}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--color-text-secondary)]">{a.cuerpo}</p>
                  {(a.adjuntoArchivo || a.adjuntoTexto) && (
                    <div className="mt-2 rounded-md border border-dashed border-[var(--color-border)] p-2 text-[12px] text-[var(--color-text-secondary)]">
                      <p className="mb-1 text-[11px] text-[var(--color-text-muted)]">
                        Después, {a.adjuntoTipo === "IMAGEN" ? "una foto" : "un video"}
                        {a.adjuntoNombre ? ` («${a.adjuntoNombre}»)` : " (falta subir el archivo)"}
                        {a.adjuntoUnaVez ? " · solo la primera vez por cliente" : ""}
                        {" · "}
                        {estadoPlantillaAdjunto(a)}
                      </p>
                      <p className="whitespace-pre-wrap">{a.adjuntoTexto || "(falta el texto)"}</p>
                    </div>
                  )}
                  {a.estado === "RECHAZADO" && (
                    <p className="mt-2 text-xs text-red-500">
                      Meta lo rechazó{a.plantillaMotivo ? `: ${a.plantillaMotivo}` : ""}. Corregí el texto y mandalo de nuevo.
                    </p>
                  )}
                  {a.estado === "ACTIVO" && a.activadoEn && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Activo desde {fechaHora(a.activadoEn)}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {puedeEditar && (
                      <Button variant="ghost" size="sm" onClick={() => setEditando(a)}>
                        <Pencil size={13} /> Editar
                      </Button>
                    )}
                    {puedeEditar && a.canal === "WHATSAPP" && (a.estado === "BORRADOR" || a.estado === "RECHAZADO" || adjuntoParaMandar(a)) && (
                      <Button size="sm" loading={accion.isPending} onClick={() => accion.mutate({ tipo: "meta", id: a.id })}>
                        <Send size={13} /> Mandar a Meta
                      </Button>
                    )}
                    {puedeEditar &&
                      (a.estado === "LISTO" || a.estado === "PAUSADO" || (a.canal === "EMAIL" && a.estado === "BORRADOR")) && (
                        <Button size="sm" loading={accion.isPending} onClick={() => accion.mutate({ tipo: "activar", id: a.id })}>
                          <Play size={13} /> Activar
                        </Button>
                      )}
                    {puedeEditar && a.estado === "ACTIVO" && (
                      <Button variant="secondary" size="sm" onClick={() => accion.mutate({ tipo: "pausar", id: a.id })}>
                        <Pause size={13} /> Pausar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setVerEnvios(a.id)}>
                      Ver envíos
                    </Button>
                    {puedeEditar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Borrar el aviso «${a.nombre}»? Deja de mandarse; el registro de envíos se conserva.`)) {
                            accion.mutate({ tipo: "borrar", id: a.id });
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {verEnvios && <Envios avisoId={verEnvios === "todos" ? undefined : verEnvios} onCerrar={() => setVerEnvios(null)} />}
    </div>
  );
}

function Editor({
  aviso,
  catalogo,
  onCerrar,
  onGuardado,
  onRefrescar,
}: {
  aviso: Aviso | null;
  catalogo: AvisosCatalogo;
  onCerrar: () => void;
  onGuardado: () => void;
  /** Refresca la lista sin cerrar el editor (al subir o quitar el archivo). */
  onRefrescar: () => void;
}) {
  const [d, setD] = useState<AvisoDatos>(
    aviso
      ? {
          nombre: aviso.nombre,
          disparador: aviso.disparador,
          dias: aviso.dias ?? 1,
          demoraMinutos: aviso.demoraMinutos,
          condicion: aviso.condicion,
          canal: aviso.canal,
          asunto: aviso.asunto ?? "",
          cuerpo: aviso.cuerpo,
          cierraCheck: aviso.cierraCheck,
          adjuntoTexto: aviso.adjuntoTexto ?? "",
          adjuntoUnaVez: aviso.adjuntoUnaVez,
        }
      : VACIO,
  );
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  const disp = catalogo.disparadores.find((x) => x.clave === d.disparador);
  const variables = catalogo.variables.filter((v) => disp?.variables.includes(v.clave));
  const reinicia = !!aviso && aviso.canal === "WHATSAPP" && d.cuerpo.trim() !== aviso.cuerpo && aviso.estado !== "BORRADOR";

  const vista = useMemo(
    () =>
      d.cuerpo.replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (m, v: string) => catalogo.variables.find((x) => x.clave === v)?.ejemplo ?? m),
    [d.cuerpo, catalogo.variables],
  );

  const guardar = useMutation({
    mutationFn: async (yMeta: boolean) => {
      const datos = {
        ...d,
        dias: disp?.conDias ? d.dias : null,
        asunto: d.canal === "EMAIL" ? d.asunto : null,
        adjuntoTexto: d.canal === "WHATSAPP" ? d.adjuntoTexto : null,
      };
      const r = aviso ? await editarAviso(aviso.id, datos) : await crearAviso(datos);
      if (yMeta) await mandarAvisoAMeta(r.id);
      return yMeta;
    },
    onSuccess: (yMeta) => {
      toast.success(yMeta ? "Guardado y mandado a Meta para aprobar." : "Guardado.");
      onGuardado();
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  const insertar = (clave: string) => {
    const el = cuerpoRef.current;
    const marca = `{{${clave}}}`;
    if (!el) return setD({ ...d, cuerpo: d.cuerpo + marca });
    const ini = el.selectionStart ?? d.cuerpo.length;
    const fin = el.selectionEnd ?? ini;
    setD({ ...d, cuerpo: d.cuerpo.slice(0, ini) + marca + d.cuerpo.slice(fin) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  const gruposDisp = useMemo(() => {
    const m = new Map<string, typeof catalogo.disparadores>();
    for (const x of catalogo.disparadores) m.set(x.grupo, [...(m.get(x.grupo) ?? []), x]);
    return [...m.entries()];
  }, [catalogo]);

  const listo = d.nombre.trim().length >= 3 && !!d.disparador && d.cuerpo.trim().length > 0 && (d.canal !== "EMAIL" || !!d.asunto?.trim());

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-bg-card)] p-4">
      <h3 className="font-semibold text-[var(--color-text-primary)]">{aviso ? `Editar «${aviso.nombre}»` : "Nuevo aviso automático"}</h3>

      <div>
        <label className={lbl}>1 · Cuándo sale (disparador)</label>
        <select className={inp} value={d.disparador} onChange={(e) => setD({ ...d, disparador: e.target.value })}>
          <option value="">Elegí el hecho…</option>
          {gruposDisp.map(([g, lista]) => (
            <optgroup key={g} label={g}>
              {lista.map((x) => (
                <option key={x.clave} value={x.clave}>
                  {x.etiqueta}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {disp && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{disp.cuando}</p>}
        <Demora valor={d.demoraMinutos ?? null} onCambio={(m) => setD({ ...d, demoraMinutos: m })} />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          Condición
          <select
            className={`${inpLinea} w-auto`}
            value={d.condicion ?? ""}
            onChange={(e) => setD({ ...d, condicion: (e.target.value || null) as AvisoDatos["condicion"] })}
          >
            <option value="">Ninguna: sale siempre</option>
            {catalogo.condiciones.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
        {d.condicion === "SIN_CONTACTO" && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Se revisa al salir: si hay un WhatsApp nuestro (desde Voltia PM o desde el celular) o un contacto anotado en la
            bitácora, no sale. Los avisos automáticos no cuentan.
          </p>
        )}
        {disp?.conDias && (
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            Faltando
            <input
              type="number"
              min={1}
              max={30}
              className={`${inp} w-20`}
              value={d.dias ?? 1}
              onChange={(e) => setD({ ...d, dias: Number(e.target.value) })}
            />
            día(s) para el primer día de obra.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>2 · Por dónde</label>
          <div className="flex gap-2">
            {(["WHATSAPP", "EMAIL"] as AvisoCanal[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={!!aviso}
                onClick={() => setD({ ...d, canal: c })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  d.canal === c
                    ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                } disabled:cursor-not-allowed`}
              >
                {c === "WHATSAPP" ? "WhatsApp" : "Mail"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Nombre (para reconocerlo)</label>
          <input className={inp} value={d.nombre} maxLength={80} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Ej.: Fecha de obra confirmada" />
        </div>
      </div>

      {d.canal === "EMAIL" && (
        <div>
          <label className={lbl}>Asunto</label>
          <input className={inp} value={d.asunto ?? ""} onChange={(e) => setD({ ...d, asunto: e.target.value })} />
        </div>
      )}

      <div>
        <label className={lbl}>3 · El mensaje</label>
        {d.disparador && (
          <div className="mb-2 flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v.clave}
                type="button"
                title={`Ej.: ${v.ejemplo}`}
                onClick={() => insertar(v.clave)}
                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
              >
                + {v.etiqueta}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={cuerpoRef}
          rows={6}
          className={inp}
          value={d.cuerpo}
          onChange={(e) => setD({ ...d, cuerpo: e.target.value })}
          placeholder="Hola {{cliente.nombre}}, …"
        />
        {d.canal === "WHATSAPP" && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            En WhatsApp el mensaje es una plantilla: Meta la revisa antes de poder activarla (minutos u horas). No puede
            empezar ni terminar con un dato, ni llevar dos datos seguidos.
          </p>
        )}
        {d.cuerpo.trim() && (
          <div className="mt-2 rounded-lg bg-[var(--color-bg-app)] p-3">
            <p className={lbl}>Así le llega (con datos de ejemplo)</p>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--color-text-primary)]">{vista}</p>
          </div>
        )}
      </div>

      {d.canal === "WHATSAPP" && (
        <Adjunto
          aviso={aviso}
          texto={d.adjuntoTexto ?? ""}
          unaVez={!!d.adjuntoUnaVez}
          onTexto={(t) => setD({ ...d, adjuntoTexto: t })}
          onUnaVez={(v) => setD({ ...d, adjuntoUnaVez: v })}
          onCambio={onRefrescar}
        />
      )}

      <div>
        <label className={lbl}>Paso de Experiencia Solar que deja hecho (opcional)</label>
        <select className={inp} value={d.cierraCheck ?? ""} onChange={(e) => setD({ ...d, cierraCheck: e.target.value || null })}>
          <option value="">Ninguno</option>
          {catalogo.checks.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Cuando el aviso sale, ese paso del recorrido queda tildado, para que nadie le mande lo mismo a mano.
        </p>
      </div>

      {reinicia && (
        <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
          Cambiaste el texto: es una plantilla nueva para Meta. El aviso se apaga hasta que Meta apruebe el texto nuevo y se
          vuelva a activar.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="secondary" size="sm" disabled={!listo} loading={guardar.isPending} onClick={() => guardar.mutate(false)}>
          Guardar
        </Button>
        {d.canal === "WHATSAPP" && (!aviso || aviso.estado === "BORRADOR" || aviso.estado === "RECHAZADO" || reinicia) && (
          <Button size="sm" disabled={!listo} loading={guardar.isPending} onClick={() => guardar.mutate(true)}>
            <Send size={13} /> Guardar y mandar a Meta
          </Button>
        )}
      </div>
    </div>
  );
}

function Envios({ avisoId, onCerrar }: { avisoId?: string; onCerrar: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["avisos", "envios", avisoId ?? "todos"],
    queryFn: () => getAvisosEnvios({ avisoId }),
  });
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--color-text-primary)]">Registro de envíos{avisoId ? "" : " (todos los avisos)"}</h3>
        <Button variant="ghost" size="sm" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Todavía no se disparó ninguno.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1 pr-3">Cuándo</th>
                <th className="py-1 pr-3">Aviso</th>
                <th className="py-1 pr-3">Cliente</th>
                <th className="py-1 pr-3">A</th>
                <th className="py-1 pr-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-border)] align-top" title={e.texto ?? undefined}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fechaHora(e.createdAt)}</td>
                  <td className="py-1.5 pr-3">{e.aviso.nombre}</td>
                  <td className="py-1.5 pr-3">{e.project ? `${e.project.clientName} (${e.project.code})` : "—"}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{e.destino ?? "—"}</td>
                  <td className="py-1.5 pr-3">
                    <span className={e.estado === "ENVIADO" ? "text-emerald-500" : e.estado === "FALLIDO" ? "text-red-500" : "text-[var(--color-text-muted)]"}>
                      {ESTADO_ENVIO[e.estado] ?? e.estado}
                    </span>
                    {e.estadoWhatsApp && <span className="text-[var(--color-text-muted)]"> · {ESTADO_WA[e.estadoWhatsApp] ?? e.estadoWhatsApp}</span>}
                    {e.estado === "PROGRAMADO" && e.salirEn && !e.detalle && (
                      <p className="text-xs text-[var(--color-text-muted)]">Sale el {fechaHora(e.salirEn)}</p>
                    )}
                    {e.detalle && <p className="text-xs text-[var(--color-text-muted)]">{e.detalle}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** La demora del aviso: enseguida, o N horas / días después del hecho. */
function Demora({ valor, onCambio }: { valor: number | null; onCambio: (minutos: number | null) => void }) {
  const unidad = valor && valor % DIA === 0 ? DIA : HORA;
  const cantidad = valor ? valor / unidad : 0;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      Sale
      <select
        className={`${inpLinea} w-auto`}
        value={valor ? "despues" : "ya"}
        onChange={(e) => onCambio(e.target.value === "ya" ? null : DIA)}
      >
        <option value="ya">enseguida</option>
        <option value="despues">después de…</option>
      </select>
      {valor ? (
        <>
          <input
            type="number"
            min={1}
            max={unidad === DIA ? 60 : 72}
            className={`${inpLinea} w-20`}
            value={cantidad}
            onChange={(e) => onCambio(Math.max(1, Number(e.target.value) || 1) * unidad)}
          />
          <select className={`${inpLinea} w-auto`} value={unidad} onChange={(e) => onCambio(cantidad * Number(e.target.value))}>
            <option value={HORA}>horas</option>
            <option value={DIA}>días</option>
          </select>
          del hecho.
        </>
      ) : null}
    </div>
  );
}

/**
 * El video o la foto que sale en un segundo mensaje, un par de minutos después
 * del texto. Es otra plantilla de Meta, con su propio texto. El archivo se sube
 * con el aviso ya guardado.
 */
function Adjunto({
  aviso,
  texto,
  unaVez,
  onTexto,
  onUnaVez,
  onCambio,
}: {
  aviso: Aviso | null;
  texto: string;
  unaVez: boolean;
  onTexto: (t: string) => void;
  onUnaVez: (v: boolean) => void;
  onCambio: () => void;
}) {
  // Lo que devuelve el servidor al subir o quitar: el editor no se cierra.
  const [actual, setActual] = useState(aviso);
  const subir = useMutation({
    mutationFn: (f: File) => subirAdjuntoAviso(actual!.id, f),
    onSuccess: (a) => {
      toast.success("Archivo subido.");
      setActual(a);
      onCambio();
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const quitar = useMutation({
    mutationFn: () => quitarAdjuntoAviso(actual!.id),
    onSuccess: (a) => {
      toast.success("Se quitó el video o la foto.");
      setActual(a);
      onTexto("");
      onCambio();
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3">
      <label className={lbl}>Video o foto después del mensaje (opcional)</label>
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">
        Sale en un segundo mensaje, un par de minutos después del texto. Video MP4 de hasta 16 MB, o foto JPG o PNG de hasta 5
        MB. Es otra plantilla: Meta la revisa aparte, y el aviso se activa con las dos aprobadas.
      </p>
      {actual ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          {actual.adjuntoNombre ? (
            <span>
              {actual.adjuntoTipo === "IMAGEN" ? "Foto" : "Video"}: «{actual.adjuntoNombre}»
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">Sin archivo.</span>
          )}
          <label className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-hover)]">
            {subir.isPending ? "Subiendo…" : actual.adjuntoNombre ? "Reemplazar" : "Subir archivo"}
            <input
              type="file"
              accept="video/mp4,image/jpeg,image/png"
              className="hidden"
              disabled={subir.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subir.mutate(f);
                e.target.value = "";
              }}
            />
          </label>
          {(actual.adjuntoNombre || actual.adjuntoTexto) && (
            <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => quitar.mutate()}>
              Quitar
            </button>
          )}
        </div>
      ) : (
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">El archivo se sube después de guardar el aviso.</p>
      )}
      <textarea
        className={`${inp} min-h-[70px]`}
        placeholder="El texto que va con el video o la foto"
        value={texto}
        onChange={(e) => onTexto(e.target.value)}
      />
      <label className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <input type="checkbox" checked={unaVez} onChange={(e) => onUnaVez(e.target.checked)} />
        Solo la primera vez por cliente (por ejemplo, el video del primer reporte)
      </label>
    </div>
  );
}
