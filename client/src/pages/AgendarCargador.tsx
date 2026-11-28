import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import {
  crearReservaCargador,
  describirFecha,
  mayuscula,
  getConfigPublicaCargadores,
  getDisponibilidadCargadores,
  type ConfigPublicaCargadores,
  type FranjaCargador,
} from "../api/cargadores.api";
import { Spinner } from "../components/ui/Spinner";
import { ORIGEN_LEAD_OPTIONS, type OrigenLead } from "../types/leads.types";

/**
 * Agenda pública para instalar un cargador de auto eléctrico (/agendar-cargador).
 *
 * Sin login: llega desde la web de Voltia. En la zona metropolitana el cliente
 * elige día y franja; fuera de ella deja sus datos y se le confirma la fecha.
 */

const OTRA = "__otra__";

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function AgendarCargador() {
  const configQ = useQuery({ queryKey: ["publico-cargadores-config"], queryFn: getConfigPublicaCargadores });
  const diasQ = useQuery({
    queryKey: ["publico-cargadores-dias"],
    queryFn: getDisponibilidadCargadores,
    enabled: !!configQ.data?.activa,
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 text-center">
          <img src="/logo-voltia.png" alt="Voltia" className="mx-auto mb-4 h-10" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
            Instalá el cargador de tu auto eléctrico
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Elegí el día que te queda cómodo y nuestro equipo va a tu casa a instalarlo.
          </p>
        </header>

        {configQ.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : configQ.isError || !configQ.data ? (
          <Aviso>No pudimos cargar la agenda. Probá de nuevo en un rato o escribinos.</Aviso>
        ) : !configQ.data.activa ? (
          <Aviso>Por ahora no estamos tomando reservas desde la web. Escribinos y te ayudamos a coordinar.</Aviso>
        ) : (
          <Formulario
            config={configQ.data}
            dias={diasQ.data ?? []}
            cargandoDias={diasQ.isLoading}
            onOcupado={() => void diasQ.refetch()}
          />
        )}
      </div>
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

function Formulario({
  config,
  dias,
  cargandoDias,
  onOcupado,
}: {
  config: ConfigPublicaCargadores;
  dias: Array<{ fecha: string; franjas: Array<{ franja: FranjaCargador; libres: number }> }>;
  cargandoDias: boolean;
  onOcupado: () => void;
}) {
  const [departamento, setDepartamento] = useState("Montevideo");
  const [localidadSel, setLocalidadSel] = useState("");
  const [localidadOtra, setLocalidadOtra] = useState("");
  const [fecha, setFecha] = useState<string | null>(null);
  const [franja, setFranja] = useState<FranjaCargador | null>(null);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tieneCargador, setTieneCargador] = useState<boolean | null>(null);
  const [modeloCargador, setModeloCargador] = useState("");
  const [modeloAuto, setModeloAuto] = useState("");
  const [notas, setNotas] = useState("");
  const [origen, setOrigen] = useState<OrigenLead | "">("");
  const [web, setWeb] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ estado: string; fecha: string | null; franja: FranjaCargador | null } | null>(
    null,
  );

  const deptoEntero = config.departamentosEnZona.some((d) => norm(d) === norm(departamento));
  const localidadesDepto = useMemo(
    () => config.localidadesEnZona.filter((l) => norm(l.departamento) === norm(departamento)).map((l) => l.localidad),
    [config.localidadesEnZona, departamento],
  );

  // Montevideo está entero en la zona: se pide el barrio, solo como dato.
  // En otro departamento, la localidad decide si se puede reservar.
  const localidad = deptoEntero
    ? localidadOtra.trim()
    : localidadSel && localidadSel !== OTRA
      ? localidadSel
      : localidadOtra.trim();
  const enZona = deptoEntero || (!!localidadSel && localidadSel !== OTRA);
  const localidadElegida = deptoEntero || localidadSel !== "";

  const franjasDelDia = dias.find((d) => d.fecha === fecha)?.franjas ?? [];

  function cambiarDepto(d: string) {
    setDepartamento(d);
    setLocalidadSel("");
    setLocalidadOtra("");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!localidad) return setError("Contanos la localidad o el barrio.");
    // Sin lugares libres el pedido entra igual, como "a confirmar".
    if (enZona && dias.length > 0 && (!fecha || !franja)) return setError("Elegí un día y una franja.");
    if (tieneCargador === null) return setError("Contanos si ya tenés el cargador.");
    setEnviando(true);
    try {
      const r = await crearReservaCargador({
        nombre,
        celular,
        email,
        direccion,
        departamento,
        localidad,
        fecha: enZona ? fecha : null,
        franja: enZona ? franja : null,
        tieneCargador,
        modeloCargador: tieneCargador ? modeloCargador || null : null,
        modeloAuto: modeloAuto || null,
        notas: notas || null,
        origen: origen || null,
        web,
      });
      setListo(r);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { code?: string; message?: string } | undefined;
        if (data?.code === "FRANJA_OCUPADA") {
          setFecha(null);
          setFranja(null);
          onOcupado();
        }
        setError(
          err.response?.status === 400 && !data?.code
            ? "Revisá los datos: algún campo quedó incompleto."
            : (data?.message ?? "No pudimos guardar tu reserva. Probá de nuevo."),
        );
      } else {
        setError("No pudimos guardar tu reserva. Probá de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <Aviso>
        {listo.estado === "RESERVADA" && listo.fecha && listo.franja ? (
          <>
            <p className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">¡Listo, quedó reservado!</p>
            <p>
              Te esperamos el <strong>{describirFecha(listo.fecha)}</strong> de{" "}
              {config.franjas[listo.franja].label.toLowerCase()} ({config.franjas[listo.franja].horario}).
            </p>
            <p className="mt-2">Te mandamos la confirmación por mail y te vamos a escribir antes de ir.</p>
          </>
        ) : (
          <>
            <p className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">¡Recibimos tu pedido!</p>
            <p>Vamos a revisar la agenda y te escribimos en los próximos días para coordinar la fecha.</p>
          </>
        )}
      </Aviso>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Seccion titulo="1. ¿Dónde lo instalamos?">
        <Campo label="Departamento">
          <select className={inputCls} value={departamento} onChange={(e) => cambiarDepto(e.target.value)}>
            {config.departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Campo>
        {deptoEntero ? (
          <Campo label="Barrio">
            <input className={inputCls} value={localidadOtra} onChange={(e) => setLocalidadOtra(e.target.value)} />
          </Campo>
        ) : (
          <>
            <Campo label="Localidad">
              <select className={inputCls} value={localidadSel} onChange={(e) => setLocalidadSel(e.target.value)}>
                <option value="">Elegí…</option>
                {localidadesDepto.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                <option value={OTRA}>{localidadesDepto.length > 0 ? "Otra localidad" : "Escribila abajo"}</option>
              </select>
            </Campo>
            {localidadSel === OTRA && (
              <Campo label="¿Qué localidad?">
                <input className={inputCls} value={localidadOtra} onChange={(e) => setLocalidadOtra(e.target.value)} />
              </Campo>
            )}
          </>
        )}
      </Seccion>

      {localidadElegida &&
        (enZona ? (
          <Seccion titulo="2. Elegí el día y el horario">
            {cargandoDias ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : dias.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No nos quedan lugares libres en las próximas semanas. Dejanos tus datos igual y te escribimos con la
                próxima fecha disponible.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {dias.map((d) => (
                    <button
                      key={d.fecha}
                      type="button"
                      onClick={() => {
                        setFecha(d.fecha);
                        setFranja(d.franjas.length === 1 ? d.franjas[0].franja : null);
                      }}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        fecha === d.fecha
                          ? "border-[var(--color-accent)] bg-[var(--color-info-bg)] text-[var(--color-text-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                      }`}
                    >
                      {mayuscula(describirFecha(d.fecha))}
                    </button>
                  ))}
                </div>
                {fecha && (
                  <div className="flex gap-2">
                    {franjasDelDia.map((f) => (
                      <button
                        key={f.franja}
                        type="button"
                        onClick={() => setFranja(f.franja)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          franja === f.franja
                            ? "border-[var(--color-accent)] bg-[var(--color-info-bg)] text-[var(--color-text-primary)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                        }`}
                      >
                        {config.franjas[f.franja].label}
                        <span className="block text-xs text-[var(--color-text-muted)]">
                          {config.franjas[f.franja].horario}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Seccion>
        ) : (
          <Seccion titulo="2. Fecha a coordinar">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tu localidad queda fuera de la zona metropolitana. Dejanos tus datos y te escribimos para coordinar la
              fecha de la instalación.
            </p>
          </Seccion>
        ))}

      {localidadElegida && (
        <Seccion titulo="3. Tus datos">
          <Campo label="Nombre y apellido">
            <input required minLength={2} className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Celular">
              <input
                required
                minLength={6}
                inputMode="tel"
                className={inputCls}
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
              />
            </Campo>
            <Campo label="Mail">
              <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
          </div>
          <Campo label="Dirección (calle y número)">
            <input required minLength={3} className={inputCls} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </Campo>
          <Campo label="¿Ya tenés el cargador?">
            <div className="flex gap-2">
              {[
                { v: true, t: "Sí, ya lo tengo" },
                { v: false, t: "No, necesito uno" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setTieneCargador(o.v)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    tieneCargador === o.v
                      ? "border-[var(--color-accent)] bg-[var(--color-info-bg)] text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </Campo>
          {tieneCargador && (
            <Campo label="Marca y modelo del cargador (si lo sabés)">
              <input className={inputCls} value={modeloCargador} onChange={(e) => setModeloCargador(e.target.value)} />
            </Campo>
          )}
          <Campo label="Marca y modelo del auto (opcional)">
            <input className={inputCls} value={modeloAuto} onChange={(e) => setModeloAuto(e.target.value)} />
          </Campo>
          <Campo label="¿Algo que tengamos que saber? (opcional)">
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Dónde querés el cargador, distancia al tablero, si es apartamento…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>
          <Campo label="¿Cómo nos conociste? (opcional)">
            <select className={inputCls} value={origen} onChange={(e) => setOrigen(e.target.value as OrigenLead | "")}>
              <option value="">—</option>
              {ORIGEN_LEAD_OPTIONS.filter((o) => o.value !== "CLIENTE_EXISTENTE").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="CLIENTE_EXISTENTE">Ya soy cliente de Voltia</option>
            </select>
          </Campo>
          {/* Trampa para bots: oculta para las personas. */}
          <input
            type="text"
            name="web"
            tabIndex={-1}
            autoComplete="off"
            value={web}
            onChange={(e) => setWeb(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />
        </Seccion>
      )}

      {error && <p className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-text)]">{error}</p>}

      {localidadElegida && (
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {enviando ? "Enviando…" : enZona ? "Reservar" : "Enviar pedido"}
        </button>
      )}
    </form>
  );
}
