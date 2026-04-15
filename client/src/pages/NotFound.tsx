import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-display font-bold text-[var(--color-text-muted)] mb-4">
          404
        </p>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Página no encontrada
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          La ruta que buscás no existe.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
