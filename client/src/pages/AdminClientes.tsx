import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Pencil, Power, KeyRound, Copy, Check } from 'lucide-react';
import {
  createClient,
  deleteClient,
  getClients,
  patchClient,
  type ClientUser,
  type ClientCreateInput,
  type ClientPatchInput,
} from '../api/clients.api';
import { getProjects } from '../api/projects.api';
import type { ProjectListItem } from '../types/api.types';

function klass(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(' ');
}
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inp =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl =
  'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';
const btnPrim =
  'inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50';
const btnSec =
  'inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]';

function generatePassword(length = 12): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = lower + upper + digits + symbols;
  const required = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(all[Math.floor(Math.random() * all.length)]);
  }
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function TabClientes() {
  return <AdminClientes />;
}

export function AdminClientes() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientUser | null>(null);
  const [resetting, setResetting] = useState<ClientUser | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    email: string;
    name: string;
    password: string;
  } | null>(null);

  const clientsQ = useQuery({ queryKey: ['admin-clients'], queryFn: getClients });
  const projectsQ = useQuery({
    queryKey: ['projects-for-client-assign'],
    queryFn: () => getProjects(),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Clientes del portal
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Usuarios con acceso al portal para ver el avance de su trámite UTE.
          </p>
        </div>
        <button className={btnPrim} onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Crear cliente
        </button>
      </header>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
            <tr className="text-left text-[11px] uppercase tracking-wider font-mono">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Proyectos</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Pass</th>
              <th className="px-3 py-2 w-px">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {clientsQ.isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  Cargando…
                </td>
              </tr>
            ) : clientsQ.data && clientsQ.data.length > 0 ? (
              clientsQ.data.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{c.name}</td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)] font-mono text-xs">
                    {c.email}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.projects.length === 0 ? (
                      <span className="text-[var(--color-text-muted)]">Sin proyectos</span>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">
                        {c.projects.map((p) => p.code).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={klass(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono uppercase',
                        c.active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]',
                      )}
                    >
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px] font-mono">
                    {c.passwordTemporary ? (
                      <span className="text-amber-400">Temporal</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditing(c)}
                        className="p-1.5 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setResetting(c)}
                        className="p-1.5 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                        title="Resetear contraseña"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <ToggleActiveButton
                        client={c}
                        onDone={() => qc.invalidateQueries({ queryKey: ['admin-clients'] })}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  Aún no hay clientes. Tocá "Crear cliente" para sumar el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateClientModal
          projects={projectsQ.data ?? []}
          existingClients={clientsQ.data ?? []}
          onClose={() => setCreateOpen(false)}
          onSuccess={(result) => {
            setCreateOpen(false);
            setCreatedResult(result);
            qc.invalidateQueries({ queryKey: ['admin-clients'] });
            qc.invalidateQueries({ queryKey: ['projects-for-client-assign'] });
          }}
        />
      )}

      {editing && (
        <EditClientModal
          client={editing}
          projects={projectsQ.data ?? []}
          existingClients={clientsQ.data ?? []}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin-clients'] });
            qc.invalidateQueries({ queryKey: ['projects-for-client-assign'] });
          }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          client={resetting}
          onClose={() => setResetting(null)}
          onSuccess={(password) => {
            setResetting(null);
            setCreatedResult({ email: resetting.email, name: resetting.name, password });
            qc.invalidateQueries({ queryKey: ['admin-clients'] });
          }}
        />
      )}

      {createdResult && (
        <CredentialsModal
          email={createdResult.email}
          name={createdResult.name}
          password={createdResult.password}
          onClose={() => setCreatedResult(null)}
        />
      )}
    </div>
  );
}

// ─── Modal: crear cliente ────────────────────────────────────────────────────

function CreateClientModal({
  projects,
  existingClients,
  onClose,
  onSuccess,
}: {
  projects: ProjectListItem[];
  existingClients: ClientUser[];
  onClose: () => void;
  onSuccess: (result: { email: string; name: string; password: string }) => void;
}) {
  const [form, setForm] = useState<ClientCreateInput>({
    name: '',
    email: '',
    phone: '',
    temporaryPassword: generatePassword(),
    projectIds: [],
  });
  const [error, setError] = useState('');

  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of existingClients) for (const p of c.projects) set.add(p.id);
    return set;
  }, [existingClients]);
  const availableProjects = useMemo(
    () => projects.filter((p) => !assignedIds.has(p.id)),
    [projects, assignedIds],
  );

  const mut = useMutation({
    mutationFn: (input: ClientCreateInput) => createClient(input),
    onSuccess: (created) => {
      onSuccess({
        email: created.email,
        name: created.name,
        password: form.temporaryPassword,
      });
    },
    onError: (err) => setError(getApiErr(err) ?? 'Error al crear cliente'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.temporaryPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    mut.mutate({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      temporaryPassword: form.temporaryPassword,
      phone: form.phone?.trim() || null,
      projectIds: form.projectIds,
    });
  }

  return (
    <Modal title="Crear cliente" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={lbl}>Nombre completo *</label>
          <input
            className={inp}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <div>
          <label className={lbl}>Email *</label>
          <input
            type="email"
            className={inp}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className={lbl}>Teléfono</label>
          <input
            className={inp}
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Opcional, para enviarle el link por WhatsApp"
          />
        </div>
        <div>
          <label className={lbl}>Contraseña temporal *</label>
          <div className="flex gap-2">
            <input
              className={inp}
              value={form.temporaryPassword}
              onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, temporaryPassword: generatePassword() }))}
              className={btnSec}
            >
              Generar
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            El cliente la cambia en su primer login. Mínimo 8 caracteres.
          </p>
        </div>
        <div>
          <label className={lbl}>Asignar a proyecto(s)</label>
          <ProjectMultiSelect
            availableProjects={availableProjects}
            selectedIds={form.projectIds}
            onChange={(ids) => setForm((f) => ({ ...f, projectIds: ids }))}
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            Sólo aparecen proyectos sin cliente asignado.
          </p>
        </div>
        <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-[var(--color-text-secondary)]">
          Después de crear, te muestro un cuadro con el email + contraseña + link
          listo para copiar y pegar al cliente por WhatsApp/email.
        </div>
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSec}>
            Cancelar
          </button>
          <button type="submit" disabled={mut.isPending} className={btnPrim}>
            {mut.isPending ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: editar cliente ──────────────────────────────────────────────────

function EditClientModal({
  client,
  projects,
  existingClients,
  onClose,
  onSuccess,
}: {
  client: ClientUser;
  projects: ProjectListItem[];
  existingClients: ClientUser[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: client.name,
    email: client.email,
    phone: client.phone ?? '',
    projectIds: client.projects.map((p) => p.id),
  });
  const [error, setError] = useState('');

  const otherClientsAssigned = useMemo(() => {
    const set = new Set<string>();
    for (const c of existingClients) {
      if (c.id === client.id) continue;
      for (const p of c.projects) set.add(p.id);
    }
    return set;
  }, [existingClients, client.id]);
  const availableProjects = useMemo(
    () => projects.filter((p) => !otherClientsAssigned.has(p.id)),
    [projects, otherClientsAssigned],
  );

  const mut = useMutation({
    mutationFn: (input: ClientPatchInput) => patchClient(client.id, input),
    onSuccess: () => {
      toast.success('Cliente actualizado');
      onSuccess();
    },
    onError: (err) => setError(getApiErr(err) ?? 'Error al actualizar'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mut.mutate({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      projectIds: form.projectIds,
    });
  }

  return (
    <Modal title={`Editar ${client.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={lbl}>Nombre completo *</label>
          <input
            className={inp}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className={lbl}>Email *</label>
          <input
            type="email"
            className={inp}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className={lbl}>Teléfono</label>
          <input
            className={inp}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className={lbl}>Proyectos asignados</label>
          <ProjectMultiSelect
            availableProjects={availableProjects}
            selectedIds={form.projectIds}
            onChange={(ids) => setForm((f) => ({ ...f, projectIds: ids }))}
          />
        </div>
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSec}>
            Cancelar
          </button>
          <button type="submit" disabled={mut.isPending} className={btnPrim}>
            {mut.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: resetear contraseña ─────────────────────────────────────────────

function ResetPasswordModal({
  client,
  onClose,
  onSuccess,
}: {
  client: ClientUser;
  onClose: () => void;
  onSuccess: (password: string) => void;
}) {
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => patchClient(client.id, { newPassword: password }),
    onSuccess: () => {
      toast.success('Contraseña reseteada');
      onSuccess(password);
    },
    onError: (err) => setError(getApiErr(err) ?? 'Error al resetear'),
  });

  return (
    <Modal title={`Resetear contraseña — ${client.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Generamos una nueva contraseña temporal. El cliente la cambia en su próximo login.
        </p>
        <div>
          <label className={lbl}>Nueva contraseña temporal</label>
          <div className="flex gap-2">
            <input
              className={inp}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className={btnSec}
            >
              Generar
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSec}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || password.length < 8}
            className={btnPrim}
          >
            {mut.isPending ? 'Reseteando…' : 'Resetear y mostrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: credenciales (post-creación o post-reset) ───────────────────────

function CredentialsModal({
  email,
  name,
  password,
  onClose,
}: {
  email: string;
  name: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const portalUrl = `${window.location.origin}/portal`;
  const message = `Hola ${name.split(' ')[0]},

Te creamos un acceso al portal de Voltia para que veas el avance de tu trámite UTE.

Email: ${email}
Contraseña temporal: ${password}
Link: ${portalUrl}

Te pedirá cambiar la contraseña al ingresar.
Cualquier duda, escribinos.`;

  function copy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      toast.success('Mensaje copiado');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal title="Cliente listo" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400">
          Cliente creado/actualizado. Copiá el mensaje y enviáselo por WhatsApp o email.
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-xs font-mono space-y-1 text-[var(--color-text-primary)]">
          <div><span className="text-[var(--color-text-muted)]">Email:</span> {email}</div>
          <div><span className="text-[var(--color-text-muted)]">Pass:</span> {password}</div>
          <div><span className="text-[var(--color-text-muted)]">Link:</span> {portalUrl}</div>
        </div>
        <div>
          <label className={lbl}>Mensaje sugerido para WhatsApp</label>
          <textarea
            className={klass(inp, 'font-mono text-xs')}
            value={message}
            readOnly
            rows={9}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSec}>
            Cerrar
          </button>
          <button type="button" onClick={copy} className={btnPrim}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar para WhatsApp'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Toggle activar/desactivar ──────────────────────────────────────────────

function ToggleActiveButton({
  client,
  onDone,
}: {
  client: ClientUser;
  onDone: () => void;
}) {
  const mut = useMutation({
    mutationFn: async () => {
      if (client.active) {
        await deleteClient(client.id);
      } else {
        await patchClient(client.id, { active: true });
      }
    },
    onSuccess: () => {
      toast.success(client.active ? 'Cliente desactivado' : 'Cliente activado');
      onDone();
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error'),
  });
  return (
    <button
      onClick={() => {
        if (client.active && !confirm(`¿Desactivar a ${client.name}? No podrá loguearse.`)) {
          return;
        }
        mut.mutate();
      }}
      className={klass(
        'p-1.5 rounded hover:bg-[var(--color-bg-card-hover)]',
        client.active ? 'text-amber-400' : 'text-emerald-400',
      )}
      title={client.active ? 'Desactivar' : 'Activar'}
      disabled={mut.isPending}
    >
      <Power className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Project multi-select inline ────────────────────────────────────────────

function ProjectMultiSelect({
  availableProjects,
  selectedIds,
  onChange,
}: {
  availableProjects: ProjectListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return availableProjects;
    return availableProjects.filter(
      (p) => p.code.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q),
    );
  }, [availableProjects, search]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-2">
      <input
        className={inp}
        placeholder="Buscar por código o cliente…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] max-h-44 overflow-auto divide-y divide-[var(--color-border)]">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Sin coincidencias</p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className={klass(
                  'flex items-center gap-2 px-3 py-2 cursor-pointer text-xs',
                  checked && 'bg-[var(--color-bg-card-hover)]',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] w-24 shrink-0">
                  {p.code}
                </span>
                <span className="text-[var(--color-text-primary)] truncate">{p.clientName}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Modal genérico ─────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
