import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { cambiarVinculo, crearContacto, getContactos, getEmpresas, telefonoLindo, type CrmVinculo } from "../../api/crm.api";
import { Elegir } from "./Elegir";

// El cliente de un lead o un proyecto en el CRM: su contacto y, si es una
// empresa, la empresa. Se cambia desde acá; los datos de cada uno se editan en
// su ficha (Ventas → Contactos / Empresas).

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function TarjetaCliente({
  destino,
  vinculo,
  sugerencia,
  puedeEditar,
  queryKey,
}: {
  destino: { leadId: string } | { projectId: string };
  vinculo: CrmVinculo;
  /** Los datos sueltos del lead o proyecto, para crear el contacto si falta. */
  sugerencia: { nombre: string; telefono: string | null; email: string | null };
  puedeEditar: boolean;
  queryKey: unknown[];
}) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const cambiar = useMutation({
    mutationFn: (d: { contactoId?: string | null; empresaId?: string | null }) => cambiarVinculo(destino, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["crm-contactos"] });
      qc.invalidateQueries({ queryKey: ["crm-empresas"] });
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo cambiar"),
  });
  const crear = useMutation({
    mutationFn: () => crearContacto({ nombre: sugerencia.nombre, telefono: sugerencia.telefono, email: sugerencia.email }),
    onSuccess: (c) => cambiar.mutate({ contactoId: c.id, ...(vinculo.empresaCliente ? { empresaId: vinculo.empresaCliente.id } : {}) }),
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo crear el contacto"),
  });

  const { contacto, empresaCliente: empresa } = vinculo;
  const boton = "text-[12px] text-[var(--color-accent)] hover:underline";

  return (
    <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Cliente</p>
        {puedeEditar && (
          <button className={boton} onClick={() => setEditando((v) => !v)}>
            {editando ? "Listo" : "Cambiar"}
          </button>
        )}
      </div>
      <div className="space-y-1.5 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound size={14} className="text-[var(--color-text-muted)]" />
          {contacto ? (
            <>
              <Link to={`/ventas/contactos?id=${contacto.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                {contacto.nombre}
              </Link>
              <span className="text-[var(--color-text-muted)]">{telefonoLindo(contacto.telefono)}</span>
            </>
          ) : (
            <span className="text-[var(--color-text-muted)]">Sin contacto</span>
          )}
        </div>
        {(empresa || editando) && (
          <div className="flex flex-wrap items-center gap-2">
            <Building2 size={14} className="text-[var(--color-text-muted)]" />
            {empresa ? (
              <Link to={`/ventas/empresas?id=${empresa.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                {empresa.razonSocial}
              </Link>
            ) : (
              <span className="text-[var(--color-text-muted)]">Sin empresa (es una persona)</span>
            )}
          </div>
        )}
      </div>

      {editando && (
        <div className="mt-3 space-y-3 border-t border-[var(--color-border)] pt-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Contacto</p>
            <Elegir
              buscar={getContactos}
              etiqueta={(c) => `${c.nombre}${c.telefono ? ` · ${telefonoLindo(c.telefono)}` : ""}`}
              excluir={contacto ? [contacto.id] : []}
              // Si el cliente es una empresa, el contacto nuevo queda también como contacto de ella.
              onElegir={(c) => cambiar.mutate({ contactoId: c.id, ...(empresa ? { empresaId: empresa.id } : {}) })}
              placeholder="Buscar contacto por nombre o teléfono…"
            />
            {!contacto && sugerencia.nombre && (
              <button className={boton} disabled={crear.isPending} onClick={() => crear.mutate()}>
                + Crear contacto «{sugerencia.nombre}»{sugerencia.telefono ? ` con el ${sugerencia.telefono}` : ""}
              </button>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Empresa</p>
            <Elegir
              buscar={getEmpresas}
              etiqueta={(e) => e.razonSocial}
              excluir={empresa ? [empresa.id] : []}
              onElegir={(e) => cambiar.mutate({ empresaId: e.id, ...(contacto ? { contactoId: contacto.id } : {}) })}
              placeholder="Buscar empresa…"
            />
            {empresa && (
              <button className={boton} onClick={() => cambiar.mutate({ empresaId: null })}>
                Quitar la empresa (es una persona)
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Para crear una empresa nueva o corregir los datos de alguno, entrá a su ficha desde Ventas → Contactos o Empresas.
          </p>
        </div>
      )}
    </section>
  );
}
