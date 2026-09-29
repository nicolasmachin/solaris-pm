// Inversores distintos: una fila por inversor con su marca, su potencia y sus
// paneles. Los paneles se reparten solos en proporción a la potencia (el valor
// automático se ve como placeholder); escribir un número lo fija a mano y
// borrarlo lo vuelve al automático.
//
// El precio de cada inversor y de su instalación eléctrica lo calcula el
// servidor con los paneles de ESE inversor; acá solo se arma la lista y se deja
// cantidad / potencia / marca clásicas sincronizadas (sincronizarSistemaInversores).

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "../ui/Button";
import { NumberField, TextField } from "./fields";
import {
  describirInversores,
  resolverPanelesInversores,
  sincronizarSistemaInversores,
} from "../../lib/inversores";
import type { ProposalDraftData, ProposalInversor } from "../../types/proposals-v2";

type Sistema = ProposalDraftData["sistema"];

const labelCls = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";

/** Paneles del inversor: vacío = automático (se muestra como placeholder). */
function PanelesInput({
  valor,
  automatico,
  onChange,
}: {
  valor: number | undefined;
  automatico: number;
  onChange: (v: number | undefined) => void;
}) {
  // Texto local para no pelear con el usuario mientras tipea.
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor === undefined ? "" : String(valor));
  return (
    <label className="block">
      <span className={labelCls}>Paneles</span>
      <input
        type="number"
        min={0}
        step={1}
        value={mostrado}
        placeholder={`${automatico} (automático)`}
        onChange={(e) => {
          setTexto(e.target.value);
          const v = e.target.value.trim();
          if (v === "") onChange(undefined);
          else if (Number.isFinite(Number(v))) onChange(Math.max(0, Math.trunc(Number(v))));
        }}
        onBlur={() => setTexto(null)}
        className={`w-full rounded-md border bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] ${
          valor !== undefined ? "border-[var(--color-accent)] font-semibold" : "border-[var(--color-border)]"
        }`}
      />
      <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">
        {valor === undefined ? "Se reparte por potencia." : "Cargado a mano. Borralo para volver al automático."}
      </span>
    </label>
  );
}

export function InversoresDistintosField({
  sistema,
  onChange,
  marcaEditable,
  error,
}: {
  sistema: Sistema;
  onChange: (next: Sistema) => void;
  /** Si administración fijó la marca del inversor, no se puede cambiar por fila. */
  marcaEditable: boolean;
  error?: boolean;
}) {
  const lista: ProposalInversor[] = sistema.inversores ?? [];
  const resueltos = resolverPanelesInversores(sistema.cantidadPaneles, lista);
  const asignados = resueltos.reduce((a, i) => a + i.paneles, 0);
  const descuadre = asignados - Math.trunc(sistema.cantidadPaneles);
  const totalKw = lista.reduce((a, i) => a + (i.potenciaKw || 0), 0);

  const setLista = (next: ProposalInversor[]) =>
    onChange(sincronizarSistemaInversores({ ...sistema, inversores: next }));

  const update = (idx: number, p: Partial<ProposalInversor>) =>
    setLista(
      lista.map((inv, i) => {
        if (i !== idx) return inv;
        const n = { ...inv, ...p };
        // `undefined` borra la clave: si quedara, el autosave la mandaría igual.
        if (n.paneles === undefined) delete n.paneles;
        return n;
      }),
    );

  return (
    <div className="mt-3 space-y-3">
      {lista.map((inv, idx) => (
        <div key={idx} className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">Inversor {idx + 1}</span>
            <button
              type="button"
              onClick={() => setLista(lista.filter((_, i) => i !== idx))}
              disabled={lista.length <= 2}
              title={lista.length <= 2 ? "Con inversores distintos van al menos dos" : "Quitar este inversor"}
              className="text-[var(--color-text-muted)] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--color-text-muted)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField
              label="Marca"
              value={inv.marca}
              onChange={(v) => update(idx, { marca: v })}
              disabled={!marcaEditable}
              hint={marcaEditable ? undefined : "Fijado por administración"}
              error={!inv.marca.trim() ? "Requerido" : undefined}
            />
            <NumberField
              label="Potencia (kW)"
              value={inv.potenciaKw}
              onChange={(v) => update(idx, { potenciaKw: v })}
              min={0}
              step={0.1}
              error={!(inv.potenciaKw > 0) ? "Requerido" : undefined}
            />
            <PanelesInput
              valor={inv.paneles}
              automatico={resueltos[idx]?.paneles ?? 0}
              onChange={(v) => update(idx, { paneles: v })}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const ultimo = lista[lista.length - 1];
            setLista([...lista, { marca: ultimo?.marca ?? "", potenciaKw: 0 }]);
          }}
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> Agregar inversor
        </Button>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {describirInversores(lista) || "—"} · {String(Math.round(totalKw * 100) / 100).replace(".", ",")} kW en total ·{" "}
          {asignados} de {sistema.cantidadPaneles} paneles
        </p>
      </div>

      {descuadre !== 0 ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          {descuadre > 0 ? (
            <>
              Los paneles de los inversores suman <b>{asignados}</b> y el sistema tiene{" "}
              <b>{sistema.cantidadPaneles}</b>: sobran <b>{descuadre}</b>.
            </>
          ) : (
            <>
              Los paneles de los inversores suman <b>{asignados}</b> y el sistema tiene{" "}
              <b>{sistema.cantidadPaneles}</b>: faltan <b>{-descuadre}</b>.
            </>
          )}{" "}
          Corregí los paneles de algún inversor o dejá alguno vacío para que se reparta solo. Así no se
          puede publicar.
        </div>
      ) : error ? (
        <p className="text-[11px] text-red-400">Completá la marca y la potencia de cada inversor.</p>
      ) : null}
    </div>
  );
}
