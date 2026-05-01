import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { changePassword, getMe } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function ChangePassword() {
  const navigate = useNavigate();
  const { user, token, setAuth, permissions } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isForced = !!user?.passwordTemporary;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      // Refrescamos para que `passwordTemporary` quede en false en el store.
      const me = await getMe();
      if (token && user) {
        setAuth(
          token,
          { ...user, passwordTemporary: me.passwordTemporary ?? false },
          permissions,
        );
      }
      toast.success('Contraseña actualizada');
      if (user?.role === 'CLIENT') navigate('/portal', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErr(err) ?? 'No pudimos cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Cambiar contraseña
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {isForced
                ? 'Por seguridad, necesitamos que definas una contraseña propia antes de continuar.'
                : 'Ingresá tu contraseña actual y la nueva.'}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Contraseña actual
              </label>
              <input
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Mínimo 8 caracteres</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
