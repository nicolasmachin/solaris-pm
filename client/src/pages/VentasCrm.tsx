import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, Star, Trash2, UserRound, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  borrarContacto,
  borrarEmpresa,
  crearContacto,
  crearEmpresa,
  desvincularContacto,
  editarContacto,
  editarEmpresa,
  getContacto,
  getContactos,
  getEmpresa,
  getEmpresas,
  telefonoLindo,
  vincularContacto,
  type CrmLeadRef,
  type CrmProyectoRef,
  type DatosContacto,
  type DatosEmpresa,
} from "../api/crm.api";
import { Button } from "../components/ui/Button";
import { CanAccess } from "../components/ui/CanAccess";
import { Sheet } from "../components/ui/Sheet";
import { Spinner } from "../components/ui/Spinner";
import { usePermission } from "../hooks/usePermission";
import { STAGE_LABELS } from "../types/leads.types";
import { Elegir, INPUT, useBusqueda } from "../components/crm/Elegir";

// CRM de Ventas: Contactos (personas) y Empresas, con su vínculo. Los leads y
// proyectos apuntan a un contacto y, si el cliente es una empresa, a la empresa.

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function Encabezado({ titulo, icono, texto, setTexto, onNuevo }: { titulo: string; icono: ReactNode; texto: string; setTexto: (v: string) => void; onNuevo: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="mr-auto">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Ventas</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[var(--color-text-primary)]">
          {icono} {titulo}
        </h1>
      </div>
      <div className="relative w-full sm:w-72">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input className={`${INPUT} pl-9`} placeholder="Buscar…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <CanAccess module="VENTAS" action="CREATE">
        <Button onClick={onNuevo}>
          <Plus size={16} /> Nuevo
        </Button>
      </CanAccess>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}

/** Leads y proyectos del contacto o la empresa. */
function Vinculados({ leads, projects }: { leads: CrmLeadRef[]; projects: CrmProyectoRef[] }) {
  if (leads.length + projects.length === 0) return <p className="text-[13px] text-[var(--color-text-muted)]">Todavía no tiene leads ni proyectos.</p>;
  return (
    <ul className="space-y-1 text-[13px]">
      {leads.map((l) => (
        <li key={l.id}>
          <Link to={`/ventas?lead=${l.id}`} className="text-[var(--color-accent)] hover:underline">
            Lead · {l.clientName}
          </Link>{" "}
          <span className="text-[var(--color-text-muted)]">· {STAGE_LABELS[l.stage as keyof typeof STAGE_LABELS] ?? l.stage}</span>
        </li>
      ))}
      {projects.map((p) => (
        <li key={p.id}>
          <Link to={`/projects/${p.id}`} className="text-[var(--color-accent)] hover:underline">
            Proyecto {p.code} · {p.clientName}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─── Contactos ───────────────────────────────────────────────────────────────

const CONTACTO_VACIO: DatosContacto = { nombre: "", telefono: "", email: "", documento: "", notas: "" };

function FormContacto({ valor, onChange, soloLectura }: { valor: DatosContacto; onChange: (v: DatosContacto) => void; soloLectura: boolean }) {
  const set = (k: keyof DatosContacto) => (e: { target: { value: string } }) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo label="Nombre">
        <input className={INPUT} value={valor.nombre} onChange={set("nombre")} disabled={soloLectura} />
      </Campo>
      <Campo label="Teléfono">
        <input className={INPUT} value={valor.telefono ?? ""} onChange={set("telefono")} disabled={soloLectura} placeholder="099 123 456" />
      </Campo>
      <Campo label="Mail">
        <input className={INPUT} value={valor.email ?? ""} onChange={set("email")} disabled={soloLectura} />
      </Campo>
      <Campo label="Cédula">
        <input className={INPUT} value={valor.documento ?? ""} onChange={set("documento")} disabled={soloLectura} />
      </Campo>
      <div className="sm:col-span-2">
        <Campo label="Notas">
          <textarea className={INPUT} rows={3} value={valor.notas ?? ""} onChange={set("notas")} disabled={soloLectura} />
        </Campo>
      </div>
    </div>
  );
}

function FichaContacto({ id, onClose }: { id: string | "nuevo"; onClose: () => void }) {
  const qc = useQueryClient();
  const nuevo = id === "nuevo";
  const puedeEditar = usePermission("VENTAS", nuevo ? "CREATE" : "EDIT");
  const puedeBorrar = usePermission("VENTAS", "DELETE");
  const { data, isLoading } = useQuery({ queryKey: ["crm-contacto", id], queryFn: () => getContacto(id), enabled: !nuevo });
  const [form, setForm] = useState<DatosContacto>(CONTACTO_VACIO);
  const [vinculando, setVinculando] = useState(false);
  useEffect(() => {
    if (data) setForm({ nombre: data.nombre, telefono: telefonoLindo(data.telefono), email: data.email ?? "", documento: data.documento ?? "", notas: data.notas ?? "" });
  }, [data]);
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["crm-contactos"] });
    qc.invalidateQueries({ queryKey: ["crm-empresas"] });
    qc.invalidateQueries({ queryKey: ["crm-contacto", id] });
  };

  const guardar = useMutation({
    mutationFn: () => (nuevo ? crearContacto(form) : editarContacto(id, form)),
    onSuccess: () => {
      refrescar();
      toast.success(nuevo ? "Contacto creado" : "Contacto guardado");
      if (nuevo) onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo guardar"),
  });
  const borrar = useMutation({
    mutationFn: () => borrarContacto(id),
    onSuccess: () => {
      refrescar();
      toast.success("Contacto borrado");
      onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo borrar"),
  });
  const vincular = useMutation({
    mutationFn: (empresaId: string) => vincularContacto(empresaId, id),
    onSuccess: () => {
      refrescar();
      setVinculando(false);
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo vincular"),
  });
  const desvincular = useMutation({
    mutationFn: (empresaId: string) => desvincularContacto(empresaId, id),
    onSuccess: refrescar,
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo desvincular"),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={nuevo ? "Nuevo contacto" : (data?.nombre ?? "Contacto")}
      size="wide"
      footer={
        puedeEditar ? (
          <div className="flex items-center gap-2">
            {!nuevo && puedeBorrar && data && data._count.leads + data._count.projects === 0 && (
              <Button variant="secondary" onClick={() => confirm("¿Borrar el contacto?") && borrar.mutate()}>
                <Trash2 size={15} /> Borrar
              </Button>
            )}
            <Button className="ml-auto" onClick={() => guardar.mutate()} disabled={guardar.isPending || !form.nombre.trim()}>
              {nuevo ? "Crear contacto" : "Guardar"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!nuevo && isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <FormContacto valor={form} onChange={setForm} soloLectura={!puedeEditar} />
          {!nuevo && data && (
            <>
              <Seccion
                titulo="Empresas"
                accion={
                  puedeEditar && !vinculando ? (
                    <button className="text-[12px] text-[var(--color-accent)] hover:underline" onClick={() => setVinculando(true)}>
                      + Vincular a una empresa
                    </button>
                  ) : undefined
                }
              >
                {vinculando && (
                  <Elegir
                    buscar={getEmpresas}
                    etiqueta={(e) => e.razonSocial}
                    excluir={data.empresas.map((e) => e.empresa.id)}
                    onElegir={(e) => vincular.mutate(e.id)}
                    placeholder="Buscar empresa…"
                  />
                )}
                {data.empresas.length === 0 && !vinculando && <p className="text-[13px] text-[var(--color-text-muted)]">No está vinculado a ninguna empresa.</p>}
                <ul className="space-y-1">
                  {data.empresas.map((e) => (
                    <li key={e.empresa.id} className="flex items-center gap-2 text-[13px]">
                      <Building2 size={14} className="text-[var(--color-text-muted)]" />
                      <Link to={`/ventas/empresas?id=${e.empresa.id}`} className="text-[var(--color-text-primary)] hover:underline">
                        {e.empresa.razonSocial}
                      </Link>
                      {e.cargo && <span className="text-[var(--color-text-muted)]">· {e.cargo}</span>}
                      {e.principal && <Star size={12} className="text-[var(--color-accent)]" />}
                      {puedeEditar && (
                        <button className="ml-auto text-[var(--color-text-muted)] hover:text-red-400" title="Desvincular" onClick={() => desvincular.mutate(e.empresa.id)}>
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Seccion>
              <Seccion titulo="Leads y proyectos">
                <Vinculados leads={data.leads} projects={data.projects} />
              </Seccion>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function VentasContactos() {
  const [texto, q, setTexto] = useBusqueda();
  const [params, setParams] = useSearchParams();
  const abierto = params.get("id");
  const { data = [], isLoading } = useQuery({ queryKey: ["crm-contactos", q], queryFn: () => getContactos(q) });
  const abrir = (id: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) n.set("id", id);
      else n.delete("id");
      return n;
    });

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <Encabezado titulo="Contactos" icono={<UserRound className="h-6 w-6 text-[var(--color-accent)]" />} texto={texto} setTexto={setTexto} onNuevo={() => abrir("nuevo")} />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--color-bg-card)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Teléfono</th>
                <th className="hidden px-4 py-2 md:table-cell">Mail</th>
                <th className="hidden px-4 py-2 lg:table-cell">Empresa</th>
                <th className="px-4 py-2 text-right">Leads · Proyectos</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    {q ? "No hay contactos que coincidan." : "Todavía no hay contactos."}
                  </td>
                </tr>
              )}
              {data.map((c) => (
                <tr key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{c.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-[var(--color-text-secondary)]">{telefonoLindo(c.telefono)}</td>
                  <td className="hidden px-4 py-2 text-[var(--color-text-secondary)] md:table-cell">{c.email}</td>
                  <td className="hidden px-4 py-2 text-[var(--color-text-secondary)] lg:table-cell">{c.empresas.map((e) => e.empresa.razonSocial).join(", ")}</td>
                  <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">
                    {c._count.leads} · {c._count.projects}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierto && <FichaContacto key={abierto} id={abierto} onClose={() => abrir(null)} />}
    </div>
  );
}

// ─── Empresas ────────────────────────────────────────────────────────────────

const EMPRESA_VACIA: DatosEmpresa = { razonSocial: "", nombreFantasia: "", rut: "", telefono: "", email: "", direccion: "", notas: "" };

function FormEmpresa({ valor, onChange, soloLectura }: { valor: DatosEmpresa; onChange: (v: DatosEmpresa) => void; soloLectura: boolean }) {
  const set = (k: keyof DatosEmpresa) => (e: { target: { value: string } }) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo label="Razón social">
        <input className={INPUT} value={valor.razonSocial} onChange={set("razonSocial")} disabled={soloLectura} />
      </Campo>
      <Campo label="Nombre de fantasía">
        <input className={INPUT} value={valor.nombreFantasia ?? ""} onChange={set("nombreFantasia")} disabled={soloLectura} />
      </Campo>
      <Campo label="RUT">
        <input className={INPUT} value={valor.rut ?? ""} onChange={set("rut")} disabled={soloLectura} />
      </Campo>
      <Campo label="Teléfono">
        <input className={INPUT} value={valor.telefono ?? ""} onChange={set("telefono")} disabled={soloLectura} />
      </Campo>
      <Campo label="Mail">
        <input className={INPUT} value={valor.email ?? ""} onChange={set("email")} disabled={soloLectura} />
      </Campo>
      <Campo label="Dirección">
        <input className={INPUT} value={valor.direccion ?? ""} onChange={set("direccion")} disabled={soloLectura} />
      </Campo>
      <div className="sm:col-span-2">
        <Campo label="Notas">
          <textarea className={INPUT} rows={3} value={valor.notas ?? ""} onChange={set("notas")} disabled={soloLectura} />
        </Campo>
      </div>
    </div>
  );
}

function FichaEmpresa({ id, onClose }: { id: string | "nuevo"; onClose: () => void }) {
  const qc = useQueryClient();
  const nuevo = id === "nuevo";
  const puedeEditar = usePermission("VENTAS", nuevo ? "CREATE" : "EDIT");
  const puedeBorrar = usePermission("VENTAS", "DELETE");
  const { data, isLoading } = useQuery({ queryKey: ["crm-empresa", id], queryFn: () => getEmpresa(id), enabled: !nuevo });
  const [form, setForm] = useState<DatosEmpresa>(EMPRESA_VACIA);
  const [vinculando, setVinculando] = useState(false);
  useEffect(() => {
    if (data)
      setForm({
        razonSocial: data.razonSocial,
        nombreFantasia: data.nombreFantasia ?? "",
        rut: data.rut ?? "",
        telefono: telefonoLindo(data.telefono),
        email: data.email ?? "",
        direccion: data.direccion ?? "",
        notas: data.notas ?? "",
      });
  }, [data]);
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["crm-empresas"] });
    qc.invalidateQueries({ queryKey: ["crm-contactos"] });
    qc.invalidateQueries({ queryKey: ["crm-empresa", id] });
  };

  const guardar = useMutation({
    mutationFn: () => (nuevo ? crearEmpresa(form) : editarEmpresa(id, form)),
    onSuccess: () => {
      refrescar();
      toast.success(nuevo ? "Empresa creada" : "Empresa guardada");
      if (nuevo) onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo guardar"),
  });
  const borrar = useMutation({
    mutationFn: () => borrarEmpresa(id),
    onSuccess: () => {
      refrescar();
      toast.success("Empresa borrada");
      onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo borrar"),
  });
  const vincular = useMutation({
    mutationFn: (v: { contactoId: string; cargo?: string | null; principal?: boolean }) =>
      vincularContacto(id, v.contactoId, { cargo: v.cargo, principal: v.principal }),
    onSuccess: () => {
      refrescar();
      setVinculando(false);
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo vincular"),
  });
  const desvincular = useMutation({
    mutationFn: (contactoId: string) => desvincularContacto(id, contactoId),
    onSuccess: refrescar,
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo desvincular"),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={nuevo ? "Nueva empresa" : (data?.razonSocial ?? "Empresa")}
      size="wide"
      footer={
        puedeEditar ? (
          <div className="flex items-center gap-2">
            {!nuevo && puedeBorrar && data && data._count.leads + data._count.projects === 0 && (
              <Button variant="secondary" onClick={() => confirm("¿Borrar la empresa?") && borrar.mutate()}>
                <Trash2 size={15} /> Borrar
              </Button>
            )}
            <Button className="ml-auto" onClick={() => guardar.mutate()} disabled={guardar.isPending || !form.razonSocial.trim()}>
              {nuevo ? "Crear empresa" : "Guardar"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!nuevo && isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <FormEmpresa valor={form} onChange={setForm} soloLectura={!puedeEditar} />
          {!nuevo && data && (
            <>
              <Seccion
                titulo="Contactos"
                accion={
                  puedeEditar && !vinculando ? (
                    <button className="text-[12px] text-[var(--color-accent)] hover:underline" onClick={() => setVinculando(true)}>
                      + Agregar contacto
                    </button>
                  ) : undefined
                }
              >
                {vinculando && (
                  <Elegir
                    buscar={getContactos}
                    etiqueta={(c) => `${c.nombre}${c.telefono ? ` · ${telefonoLindo(c.telefono)}` : ""}`}
                    excluir={data.contactos.map((c) => c.contacto.id)}
                    onElegir={(c) => vincular.mutate({ contactoId: c.id, principal: data.contactos.length === 0 })}
                    placeholder="Buscar contacto…"
                  />
                )}
                {data.contactos.length === 0 && !vinculando && <p className="text-[13px] text-[var(--color-text-muted)]">La empresa no tiene contactos.</p>}
                <ul className="space-y-1.5">
                  {data.contactos.map((c) => (
                    <li key={c.contacto.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <UserRound size={14} className="text-[var(--color-text-muted)]" />
                      <Link to={`/ventas/contactos?id=${c.contacto.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                        {c.contacto.nombre}
                      </Link>
                      <span className="text-[var(--color-text-muted)]">{telefonoLindo(c.contacto.telefono)}</span>
                      {puedeEditar ? (
                        <input
                          className="w-40 rounded border border-transparent bg-transparent px-1 text-[12px] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
                          placeholder="Cargo"
                          defaultValue={c.cargo ?? ""}
                          onBlur={(e) => e.target.value !== (c.cargo ?? "") && vincular.mutate({ contactoId: c.contacto.id, cargo: e.target.value })}
                        />
                      ) : (
                        c.cargo && <span className="text-[var(--color-text-muted)]">· {c.cargo}</span>
                      )}
                      <button
                        className={c.principal ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"}
                        title={c.principal ? "Contacto principal" : "Marcar como principal"}
                        disabled={!puedeEditar || c.principal}
                        onClick={() => vincular.mutate({ contactoId: c.contacto.id, principal: true })}
                      >
                        <Star size={13} fill={c.principal ? "currentColor" : "none"} />
                      </button>
                      {puedeEditar && (
                        <button className="ml-auto text-[var(--color-text-muted)] hover:text-red-400" title="Desvincular" onClick={() => desvincular.mutate(c.contacto.id)}>
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Seccion>
              <Seccion titulo="Leads y proyectos">
                <Vinculados leads={data.leads} projects={data.projects} />
              </Seccion>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function VentasEmpresas() {
  const [texto, q, setTexto] = useBusqueda();
  const [params, setParams] = useSearchParams();
  const abierto = params.get("id");
  const { data = [], isLoading } = useQuery({ queryKey: ["crm-empresas", q], queryFn: () => getEmpresas(q) });
  const abrir = (id: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) n.set("id", id);
      else n.delete("id");
      return n;
    });

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <Encabezado titulo="Empresas" icono={<Building2 className="h-6 w-6 text-[var(--color-accent)]" />} texto={texto} setTexto={setTexto} onNuevo={() => abrir("nuevo")} />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--color-bg-card)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2">Razón social</th>
                <th className="hidden px-4 py-2 md:table-cell">RUT</th>
                <th className="px-4 py-2">Contacto principal</th>
                <th className="px-4 py-2 text-right">Leads · Proyectos</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    {q ? "No hay empresas que coincidan." : "Todavía no hay empresas."}
                  </td>
                </tr>
              )}
              {data.map((e) => {
                const principal = e.contactos.find((c) => c.principal) ?? e.contactos[0];
                return (
                  <tr key={e.id} onClick={() => abrir(e.id)} className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]">
                    <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">
                      {e.razonSocial}
                      {e.nombreFantasia && <span className="font-normal text-[var(--color-text-muted)]"> · {e.nombreFantasia}</span>}
                    </td>
                    <td className="hidden px-4 py-2 text-[var(--color-text-secondary)] md:table-cell">{e.rut}</td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                      {principal ? `${principal.contacto.nombre}${e.contactos.length > 1 ? ` (+${e.contactos.length - 1})` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">
                      {e._count.leads} · {e._count.projects}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {abierto && <FichaEmpresa key={abierto} id={abierto} onClose={() => abrir(null)} />}
    </div>
  );
}
