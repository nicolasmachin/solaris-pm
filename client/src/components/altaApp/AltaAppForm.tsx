import { useEffect, useState } from "react";
import axios from "axios";

import type { Disponibilidad, LinksApp } from "../../api/altaApp.api";

// El formulario con que el cliente crea su acceso a la aplicación del inversor.
// Lo usan la página del link (sin login) y el portal. Las reglas son las de
// Growatt: usuario sin espacios ni caracteres especiales, contraseña de 6 o más.

const ESPECIALES = /[`~!#$%^&*()+<>?:"{},/;'\\\s]/;

function errorDe(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const m = (e.response?.data as { message?: string } | undefined)?.message;
    if (m) return m;
  }
  return "No se pudo crear el acceso. Probá de nuevo en un rato.";
}

export function AltaAppForm(props: {
  planta: string;
  emailInicial: string;
  disponible: (usuario: string) => Promise<Disponibilidad>;
  completar: (datos: { usuario: string; password: string; email: string }) => Promise<{ usuario: string; links: LinksApp }>;
  links: LinksApp;
}) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState(props.emailInicial);
  const [disp, setDisp] = useState<Disponibilidad | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  // Disponibilidad del usuario, medio segundo después de dejar de escribir.
  useEffect(() => {
    setDisp(null);
    const u = usuario.trim();
    if (u.length < 3 || ESPECIALES.test(u)) return;
    const t = setTimeout(() => {
      props.disponible(u).then(setDisp).catch(() => setDisp(null));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const u = usuario.trim();
  const errUsuario =
    u && u.length < 3 ? "Al menos 3 caracteres." : u && ESPECIALES.test(u) ? "Sin espacios ni caracteres especiales." : null;
  const errPass = password && password.length < 6 ? "Al menos 6 caracteres." : null;
  const errPass2 = password2 && password2 !== password ? "Las contraseñas no coinciden." : null;
  const puede =
    u.length >= 3 && !errUsuario && password.length >= 6 && password === password2 && /\S+@\S+\.\S+/.test(email) && disp?.disponible !== false;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puede || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await props.completar({ usuario: u, password, email: email.trim() });
      setListo(r.usuario);
    } catch (err) {
      setError(errorDe(err));
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="text-base font-semibold text-[var(--color-text-primary)]">¡Listo, ya podés entrar!</div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Tu usuario es <strong>{listo}</strong> y la contraseña es la que elegiste. Con eso entrás a la aplicación y
            ves tu planta, <strong>{props.planta}</strong>.
          </p>
        </div>
        <Descargas links={props.links} />
      </div>
    );
  }

  const campo = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2.5 text-base text-[var(--color-text-primary)]";
  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div>
        <label htmlFor="aa-usuario" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
          Elegí tu usuario
        </label>
        <input
          id="aa-usuario"
          className={campo}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="por ejemplo: jperez"
        />
        <div className="mt-1 min-h-[1.25rem] text-xs">
          {errUsuario ? (
            <span className="text-red-400">{errUsuario}</span>
          ) : disp?.disponible === false ? (
            <span className="text-red-400">{disp.motivo}</span>
          ) : disp?.disponible ? (
            <span className="text-emerald-400">Disponible</span>
          ) : null}
        </div>
      </div>
      <div>
        <label htmlFor="aa-pass" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
          Elegí tu contraseña
        </label>
        <input id="aa-pass" type="password" className={campo} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <div className="mt-1 min-h-[1.25rem] text-xs text-red-400">{errPass}</div>
      </div>
      <div>
        <label htmlFor="aa-pass2" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
          Repetila
        </label>
        <input id="aa-pass2" type="password" className={campo} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
        <div className="mt-1 min-h-[1.25rem] text-xs text-red-400">{errPass2}</div>
      </div>
      <div>
        <label htmlFor="aa-mail" className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
          Tu mail
        </label>
        <input id="aa-mail" type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Growatt lo pide para la cuenta.</p>
      </div>
      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <button
        type="submit"
        disabled={!puede || enviando}
        className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-black disabled:opacity-40"
      >
        {enviando ? "Creando tu acceso…" : "Crear mi acceso"}
      </button>
      <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
        La contraseña va directo a Growatt: Voltia no la guarda ni la puede ver. Anotala en un lugar seguro.
      </p>
    </form>
  );
}

export function Descargas({ links }: { links: LinksApp }) {
  const btn = "flex w-full items-center justify-center rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]";
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[var(--color-text-secondary)]">Bajate la aplicación (se llama ShinePhone):</div>
      <a className={btn} href={links.iphone} target="_blank" rel="noreferrer">App para iPhone</a>
      <a className={btn} href={links.android} target="_blank" rel="noreferrer">App para Android</a>
      <a className={btn} href={links.web} target="_blank" rel="noreferrer">Entrar desde la computadora</a>
    </div>
  );
}
