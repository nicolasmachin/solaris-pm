import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Search, Upload, XCircle } from "lucide-react";

import {
  VINCULO_LABEL,
  listLegajos,
  listVencimientos,
  uploadDocumentoLegajo,
  type LegajoResumenFila,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { ChipsAlertas, cardClass, errorMsg, fmtFecha, fmtPeriodo, inputClass, periodoAnterior } from "./rrhhUi";

type Pestana = "personas" | "vencimientos" | "recibos";

// Recursos Humanos, mirada de gestión (RRHH:EDIT): todas las personas, sus
// vencimientos y la carga de recibos del mes.
export function RrhhHome() {
  const [pestana, setPestana] = useState<Pestana>("personas");
  const { data: legajos = [], isLoading } = useQuery({ queryKey: ["rrhh", "legajos"], queryFn: listLegajos });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Recursos Humanos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Legajos del equipo: datos, contratos, recibos y vencimientos. Solo lo ven gerencia y administración.
        </p>
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-sm">
        {(
          [
            ["personas", "Personas"],
            ["vencimientos", "Vencimientos"],
            ["recibos", "Cargar recibos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPestana(k)}
            className={`px-4 py-2 transition-colors ${
              pestana === k
                ? "bg-[var(--color-accent)] font-semibold text-gray-900"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : pestana === "personas" ? (
        <Personas legajos={legajos} />
      ) : pestana === "vencimientos" ? (
        <Vencimientos />
      ) : (
        <CargarRecibos legajos={legajos} />
      )}
    </div>
  );
}

// ─── Personas ───────────────────────────────────────────────────────────────

function tieneAlertas(l: LegajoResumenFila) {
  return l.pendientesValidar + l.vencidos.length + l.porVencer.length + l.faltantes.length > 0;
}

function Personas({ legajos }: { legajos: LegajoResumenFila[] }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  const filas = useMemo(() => {
    const t = normalizar(q.trim());
    return legajos
      .filter((l) => !soloAlertas || tieneAlertas(l))
      .filter((l) => !t || normalizar(`${l.nombre} ${l.rol} ${l.cargo ?? ""}`).includes(t))
      // Los que ya no están van al final.
      .sort((a, b) => Number(Boolean(a.fechaEgreso)) - Number(Boolean(b.fechaEgreso)));
  }, [legajos, q, soloAlertas]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            className={`${inputClass} pl-8`}
            placeholder="Buscar por nombre, rol o cargo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
          Solo con algo pendiente
        </label>
      </div>

      {filas.length === 0 ? (
        <EmptyState title="Nadie coincide con el filtro" />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {/* Escritorio: tabla. Celular: tarjetas. */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Vínculo</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Ingreso</th>
                <th className="px-4 py-3 font-medium">Pendiente</th>
                <th className="px-4 py-3 font-medium">Último recibo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((l) => (
                <tr
                  key={l.userId}
                  onClick={() => navigate(`/rrhh/legajos/${l.userId}`)}
                  className={`cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-card-hover)] ${
                    l.fechaEgreso ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {l.nombre}
                    {l.fechaEgreso && (
                      <span className="block text-[11px] text-[var(--color-text-muted)]">Egresó el {fmtFecha(l.fechaEgreso)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{l.rol}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{VINCULO_LABEL[l.vinculo]}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{l.cargo ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                    {fmtFecha(l.fechaIngreso)}
                  </td>
                  <td className="px-4 py-3">
                    <ChipsAlertas
                      pendientes={l.pendientesValidar}
                      vencidos={l.vencidos.length}
                      porVencer={l.porVencer.length}
                      faltantes={l.faltantes.length}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                    {l.vinculo === "TERCERIZADO" ? "—" : l.ultimoRecibo ? fmtPeriodo(l.ultimoRecibo) : "Ninguno"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="md:hidden">
            {filas.map((l) => (
              <button
                key={l.userId}
                onClick={() => navigate(`/rrhh/legajos/${l.userId}`)}
                className={`block w-full border-b border-[var(--color-border)] px-4 py-3 text-left last:border-b-0 ${
                  l.fechaEgreso ? "opacity-50" : ""
                }`}
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{l.nombre}</p>
                <p className="mb-1.5 text-[11px] text-[var(--color-text-muted)]">
                  {l.rol} · {VINCULO_LABEL[l.vinculo]}
                  {l.cargo ? ` · ${l.cargo}` : ""}
                </p>
                <ChipsAlertas
                  pendientes={l.pendientesValidar}
                  vencidos={l.vencidos.length}
                  porVencer={l.porVencer.length}
                  faltantes={l.faltantes.length}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vencimientos ───────────────────────────────────────────────────────────

function Vencimientos() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["rrhh", "vencimientos"], queryFn: listVencimientos });
  if (isLoading) return <Spinner />;
  if (data.length === 0)
    return <EmptyState title="Todo al día" description="Nadie tiene documentos vencidos, por vencer ni faltantes." />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-text-muted)]">
        Se avisa a cada persona y a administración 30 días antes de que venza algo, y el día que vence.
      </p>
      {data.map((v) => (
        <button
          key={v.userId}
          onClick={() => navigate(`/rrhh/legajos/${v.userId}`)}
          className={`${cardClass} block w-full p-4 text-left hover:border-[var(--color-accent)]`}
        >
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {v.nombre} <span className="text-[11px] font-normal text-[var(--color-text-muted)]">· {VINCULO_LABEL[v.vinculo]}</span>
          </p>
          <div className="mt-1 space-y-0.5 text-xs">
            {v.vencidos.length > 0 && <p className="text-red-400">Vencido: {v.vencidos.join(", ")}</p>}
            {v.porVencer.length > 0 && <p className="text-amber-400">Vence en menos de 30 días: {v.porVencer.join(", ")}</p>}
            {v.faltantes.length > 0 && <p className="text-[var(--color-text-secondary)]">Falta: {v.faltantes.join(", ")}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Carga de recibos en lote ───────────────────────────────────────────────

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * La persona cuyo nombre o apellido aparece en el nombre del archivo. Si hay
 * más de una (dos "Martín"), no se adivina: queda para elegir a mano.
 */
function adivinarPersona(filename: string, personas: LegajoResumenFila[]) {
  const archivo = normalizar(filename);
  const candidatas = personas.filter((p) =>
    normalizar(p.nombre)
      .split(/\s+/)
      .some((parte) => parte.length >= 3 && archivo.includes(parte)),
  );
  // Si una coincide con nombre Y apellido, gana esa.
  const completas = candidatas.filter((p) =>
    normalizar(p.nombre)
      .split(/\s+/)
      .filter((parte) => parte.length >= 3)
      .every((parte) => archivo.includes(parte)),
  );
  if (completas.length === 1) return completas[0].userId;
  return candidatas.length === 1 ? candidatas[0].userId : "";
}

type FilaRecibo = { file: File; userId: string; estado: "listo" | "subiendo" | "ok" | "error"; error?: string };

function CargarRecibos({ legajos }: { legajos: LegajoResumenFila[] }) {
  const qc = useQueryClient();
  const personas = useMemo(
    () => legajos.filter((l) => l.vinculo === "DEPENDIENTE" && !l.fechaEgreso),
    [legajos],
  );
  const [periodo, setPeriodo] = useState(periodoAnterior());
  const [filas, setFilas] = useState<FilaRecibo[]>([]);
  const [enCurso, setEnCurso] = useState(false);

  function elegirArchivos(files: FileList | null) {
    if (!files) return;
    setFilas(
      Array.from(files).map((file) => ({ file, userId: adivinarPersona(file.name, personas), estado: "listo" as const })),
    );
  }

  async function subirTodos() {
    setEnCurso(true);
    // De a uno, para ver el avance y que un error no frene al resto.
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (f.estado === "ok" || !f.userId) continue;
      setFilas((prev) => prev.map((x, j) => (j === i ? { ...x, estado: "subiendo" } : x)));
      try {
        await uploadDocumentoLegajo(f.userId, f.file, { tipo: "RECIBO_SUELDO", periodo });
        setFilas((prev) => prev.map((x, j) => (j === i ? { ...x, estado: "ok" } : x)));
      } catch (e) {
        setFilas((prev) =>
          prev.map((x, j) => (j === i ? { ...x, estado: "error", error: errorMsg(e, "No se pudo subir") } : x)),
        );
      }
    }
    setEnCurso(false);
    qc.invalidateQueries({ queryKey: ["rrhh"] });
  }

  const sinPersona = filas.filter((f) => !f.userId && f.estado !== "ok").length;
  const subidos = filas.filter((f) => f.estado === "ok").length;
  const asignadas = filas.map((f) => f.userId).filter(Boolean);
  const repetidas = new Set(asignadas.filter((id, i) => asignadas.indexOf(id) !== i));

  return (
    <div className={`${cardClass} space-y-4 p-4 sm:p-5`}>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Elegí el mes y todos los recibos juntos (un archivo por persona). Si el nombre del archivo tiene el nombre de la
        persona, queda asignado solo; revisá igual cada fila antes de subir. A cada uno le llega un aviso de que tiene su
        recibo en Mi legajo.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--color-text-muted)]">
          <span className="mb-1 block">Mes que liquida</span>
          <input type="month" className={inputClass} value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-hover)]">
          <Upload size={14} /> Elegir recibos
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              elegirArchivos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {filas.length > 0 && (
        <>
          <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {filas.map((f, i) => (
              <div key={`${f.file.name}-${i}`} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]" title={f.file.name}>
                  {f.file.name}
                </span>
                <select
                  className={`${inputClass} sm:w-64`}
                  value={f.userId}
                  disabled={f.estado === "ok" || f.estado === "subiendo"}
                  onChange={(e) =>
                    setFilas((prev) => prev.map((x, j) => (j === i ? { ...x, userId: e.target.value, estado: "listo" } : x)))
                  }
                >
                  <option value="">¿De quién es?</option>
                  {personas.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <span className="w-28 text-xs">
                  {f.estado === "subiendo" && <span className="text-[var(--color-text-muted)]">Subiendo…</span>}
                  {f.estado === "ok" && (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <CheckCircle2 size={12} /> Subido
                    </span>
                  )}
                  {f.estado === "error" && (
                    <span className="inline-flex items-center gap-1 text-red-400" title={f.error}>
                      <XCircle size={12} /> {f.error}
                    </span>
                  )}
                  {f.estado === "listo" && f.userId && repetidas.has(f.userId) && (
                    <span className="text-amber-400">Persona repetida</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {subidos > 0 && `${subidos} de ${filas.length} subidos. `}
              {sinPersona > 0 && `${sinPersona} sin persona asignada: no se suben.`}
            </span>
            <Button disabled={enCurso || !periodo || filas.every((f) => f.estado === "ok" || !f.userId)} onClick={subirTodos}>
              {enCurso ? "Subiendo…" : `Subir recibos de ${fmtPeriodo(periodo)}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
