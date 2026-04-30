import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiClient } from "../api/axios";
import { getGoals, upsertGoal, deleteGoal } from "../api/metrics.api";
import { getSubcategories, createSubcategory, deleteSubcategory } from "../api/finance.api";
import { getTeams, createTeam, patchTeam, deleteTeam, type Team } from "../api/teams.api";
import {
  getRoles,
  getPermissionsCatalog,
  createRole,
  patchRole,
  deleteRole,
  type RoleData,
  type PermissionCatalogEntry,
  type PermissionEntry,
} from "../api/roles.api";
import {
  getPipelineTemplate,
  putPipelineTemplate,
  resetPipelineTemplate,
  type PipelineStage,
} from "../api/pipelineTemplate.api";
import type { GoalArea, GoalMetric, GoalPeriod, GoalData } from "../types/api.types";
import type { CategoriaPrincipal } from "../types/finance.types";
import { CATEGORIA_LABEL } from "../types/finance.types";
import { TabMateriales } from "./AdminMateriales";
import { TabCuentas } from "./AdminCuentas";
import { TabDeadlineRules } from "./AdminDeadlineRules";
import { FinanceHealthWidget } from "../components/finance/FinanceHealthWidget";

// ─── Types ────────────────────────────────────────────────────────────────────

// Los roles ahora son dinámicos (tabla roles). UserRole es simplemente el
// name del rol como string. Los valores "clásicos" siguen existiendo como
// roles isSystem=true pero ya no son un enum cerrado.
type UserRole = string;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface SystemSetting {
  id: string;
  key: string;
  value: string;
}

interface UserMePermissionEntry {
  module: string;
  actions: string[];
}

interface UserMe {
  permissions: UserMePermissionEntry[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  ASESOR_COMERCIAL: "Asesor Comercial",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
};

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  ADMIN: { bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  ASESOR_COMERCIAL: { bg: "var(--color-info-bg)", color: "var(--color-info-text)" },
  INGENIERIA: { bg: "var(--color-state-done-bg)", color: "var(--color-state-done-text)" },
  OPERACIONES: { bg: "var(--color-state-active-bg)", color: "var(--color-state-active-text)" },
};

const ALL_MODULES = ["VENTAS", "ONBOARDING", "INGENIERIA", "OPERACIONES", "HABILITACION", "POSTVENTA", "METRICAS", "CONFIGURACION", "USUARIOS"];
const ALL_ROLES: UserRole[] = ["ADMIN", "ASESOR_COMERCIAL", "INGENIERIA", "OPERACIONES"];
const ALL_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "COMPLETE", "COMMENT"];

// ─── API helpers ──────────────────────────────────────────────────────────────

const fetchUsers = () => apiClient.get<AdminUser[]>("/api/users").then(r => r.data);
const fetchSystemSettings = () => apiClient.get<SystemSetting[]>("/api/settings/system").then(r => r.data);
const fetchAllPermissions = () =>
  Promise.all(ALL_ROLES.map(role =>
    apiClient.get<UserMe>(`/api/users/me`).then(() =>
      // For the matrix we use a dedicated call per role via a workaround:
      // GET /api/users/me returns current user's permissions.
      // For the read-only matrix, we reconstruct from the seed data shape.
      null
    )
  ));

// We'll use a simpler approach: fetch all users' me permissions by querying a static endpoint
const fetchPermissionMatrix = () =>
  apiClient.get<{ matrix: Record<string, Record<string, string[]>> }>("/api/permissions/matrix")
    .then(r => r.data.matrix)
    .catch(() => null); // endpoint may not exist yet — gracefully degrade

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-app)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--color-text-primary)",
  fontSize: 13,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_COLORS[role] ?? { bg: "var(--color-bg-card-hover)", color: "var(--color-text-muted)" };
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontFamily: "var(--font-mono)",
      fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── User Modal ───────────────────────────────────────────────────────────────

function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "OPERACIONES");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Roles dinámicos desde la tabla roles
  const { data: rolesData } = useQuery({ queryKey: ["admin-roles-select"], queryFn: getRoles });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.patch(`/api/users/${user!.id}`, { name, email, role });
        toast.success("Usuario actualizado");
      } else {
        await apiClient.post("/api/users", { name, email, role, password });
        toast.success("Usuario creado");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al guardar usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 400 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 20 }}>
          {isEdit ? "Editar usuario" : "Nuevo usuario"}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {!isEdit && (
            <div>
              <label style={labelStyle}>Contraseña *</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Mín. 8 caracteres" />
            </div>
          )}
          <div>
            <label style={labelStyle}>Rol *</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={role} onChange={e => setRole(e.target.value)}>
              {(rolesData ?? []).map(r => (
                <option key={r.id} value={r.name}>{r.label}</option>
              ))}
              {/* Si el rol actual del usuario no está en la lista (edge case: rol borrado), mostrarlo */}
              {isEdit && role && !(rolesData ?? []).some(r => r.name === role) && (
                <option value={role}>{role} (desconocido)</option>
              )}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Guardando..." : isEdit ? "Guardar" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch(`/api/users/${userId}/password`, { newPassword });
      toast.success("Contraseña actualizada");
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al cambiar contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 360 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 20 }}>
          Cambiar contraseña
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nueva contraseña *</label>
            <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Mín. 8 caracteres" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Guardando..." : "Cambiar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab 1: Usuarios ──────────────────────────────────────────────────────────

function TabUsuarios() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [changingPasswordFor, setChangingPasswordFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });

  const { mutate: deleteUser, isPending: deleting } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/users/${id}`),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmDelete(null);
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (code?.code === "LAST_ADMIN") {
        toast.error("No podés eliminar el único administrador");
      } else {
        toast.error(code?.message ?? "Error al eliminar usuario");
      }
      setConfirmDelete(null);
    },
  });

  function refetch() { qc.invalidateQueries({ queryKey: ["admin-users"] }); }

  const thStyle: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px",
    fontSize: 10, fontFamily: "var(--font-mono)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => { setEditingUser(null); setShowModal(true); }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nuevo usuario
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Cargando...</p>
      ) : (
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Alta</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-card-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-primary)" }}>{u.name}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>{u.email}</td>
                  <td style={{ padding: "10px 12px" }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    {new Date(u.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditingUser(u); setShowModal(true); }}
                        style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}>
                        Editar
                      </button>
                      <button onClick={() => setChangingPasswordFor(u.id)}
                        style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}>
                        Password
                      </button>
                      <button onClick={() => setConfirmDelete(u)}
                        style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #7f1d1d", background: "none", color: "#f87171", fontSize: 11, cursor: "pointer" }}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showModal) && (
        <UserModal user={editingUser} onClose={() => setShowModal(false)} onSaved={refetch} />
      )}
      {changingPasswordFor && (
        <ChangePasswordModal userId={changingPasswordFor} onClose={() => setChangingPasswordFor(null)} />
      )}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 360 }}>
            <p style={{ fontSize: 14, color: "var(--color-text-primary)", marginBottom: 8 }}>¿Eliminar a <strong>{confirmDelete.name}</strong>?</p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 20 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => deleteUser(confirmDelete.id)} disabled={deleting} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Permisos (matriz editable + gestión de roles) ────────────────────

const ACTION_LABELS: Record<string, string> = {
  VIEW: "Ver",
  CREATE: "Crear",
  EDIT: "Editar",
  DELETE: "Eliminar",
  COMPLETE: "Completar",
  COMMENT: "Comentar",
};

const MODULE_LABELS: Record<string, string> = {
  VENTAS: "Ventas",
  ONBOARDING: "Onboarding",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  HABILITACION: "Habilitación UTE",
  POSTVENTA: "Postventa",
  METRICAS: "Métricas",
  CONFIGURACION: "Configuración",
  USUARIOS: "Usuarios",
  FINANZAS: "Finanzas",
  STOCK: "Stock",
};

// Key compuesta role+module+action → bool activo
type PermsMap = Record<string, Record<string, Record<string, boolean>>>;

function buildPermsMap(roles: RoleData[]): PermsMap {
  const map: PermsMap = {};
  for (const r of roles) {
    map[r.id] = {};
    for (const mp of r.permissions) {
      map[r.id]![mp.module] = {};
      for (const action of mp.actions) {
        map[r.id]![mp.module]![action] = true;
      }
    }
  }
  return map;
}

function rolePermsToArray(rolePerms: Record<string, Record<string, boolean>> | undefined): PermissionEntry[] {
  if (!rolePerms) return [];
  const out: PermissionEntry[] = [];
  for (const mod of Object.keys(rolePerms)) {
    for (const act of Object.keys(rolePerms[mod]!)) {
      if (rolePerms[mod]![act]) out.push({ module: mod, action: act });
    }
  }
  return out;
}

function TabPermisos() {
  const qc = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: getRoles });
  const catalogQuery = useQuery({ queryKey: ["admin-perms-catalog"], queryFn: getPermissionsCatalog });

  const [draft, setDraft] = useState<PermsMap | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoleData | null>(null);

  // Hydrate draft cuando llegan los roles, si no hay cambios pendientes
  useEffect(() => {
    if (!rolesQuery.data) return;
    const built = buildPermsMap(rolesQuery.data);
    const snap = JSON.stringify(built);
    if (draft === null || JSON.stringify(draft) === originalSnapshot) {
      setDraft(built);
      setOriginalSnapshot(snap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesQuery.data]);

  const saveMut = useMutation({
    mutationFn: async (changes: Array<{ roleId: string; permissions: PermissionEntry[] }>) => {
      for (const c of changes) {
        await patchRole(c.roleId, { permissions: c.permissions });
      }
    },
    onSuccess: () => {
      toast.success("Permisos guardados");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudieron guardar los permisos");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      toast.success("Rol eliminado");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      setConfirmDelete(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar el rol");
    },
  });

  if (rolesQuery.isLoading || catalogQuery.isLoading || !rolesQuery.data || !catalogQuery.data || !draft) {
    return <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Cargando permisos…</p>;
  }

  const roles = rolesQuery.data;
  const catalog = catalogQuery.data;

  const adminRole = roles.find((r) => r.name === "ADMIN");
  const editableRoles = roles.filter((r) => r.name !== "ADMIN");

  const currentSnapshot = JSON.stringify(draft);
  const isDirty = currentSnapshot !== originalSnapshot;

  // Toggle individual
  function toggle(roleId: string, module: string, action: string) {
    if (roles.find((r) => r.id === roleId)?.name === "ADMIN") return; // ADMIN siempre ON
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next[roleId] = { ...next[roleId] };
      next[roleId]![module] = { ...(next[roleId]![module] ?? {}) };
      next[roleId]![module]![action] = !next[roleId]![module]![action];
      return next;
    });
  }

  // Marcar / desmarcar todas las acciones de un módulo para un rol
  function toggleModule(roleId: string, module: string, allowedActions: string[]) {
    const role = roles.find((r) => r.id === roleId);
    if (role?.name === "ADMIN") return;
    const currentAll = allowedActions.every((a) => draft?.[roleId]?.[module]?.[a]);
    const next = !currentAll;
    setDraft((prev) => {
      if (!prev) return prev;
      const out = { ...prev };
      out[roleId] = { ...out[roleId] };
      out[roleId]![module] = { ...(out[roleId]![module] ?? {}) };
      for (const a of allowedActions) out[roleId]![module]![a] = next;
      return out;
    });
  }

  // Marcar / desmarcar TODO para un rol
  function toggleAllForRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (role?.name === "ADMIN") return;
    const totalActions = catalog.reduce((s, m) => s + m.actions.length, 0);
    const currentCount = rolePermsToArray(draft?.[roleId]).length;
    const setAll = currentCount < totalActions;
    setDraft((prev) => {
      if (!prev) return prev;
      const out = { ...prev };
      const roleMap: Record<string, Record<string, boolean>> = {};
      if (setAll) {
        for (const m of catalog) {
          roleMap[m.module] = {};
          for (const a of m.actions) roleMap[m.module]![a] = true;
        }
      }
      out[roleId] = roleMap;
      return out;
    });
  }

  function discard() {
    if (rolesQuery.data) {
      const fresh = buildPermsMap(rolesQuery.data);
      setDraft(fresh);
      setOriginalSnapshot(JSON.stringify(fresh));
    }
  }

  function save() {
    if (!draft) return;
    // Calcular qué roles cambiaron
    const origMap = buildPermsMap(roles);
    const changes: Array<{ roleId: string; permissions: PermissionEntry[] }> = [];
    for (const role of editableRoles) {
      const before = JSON.stringify(origMap[role.id] ?? {});
      const after = JSON.stringify(draft[role.id] ?? {});
      if (before !== after) {
        changes.push({ roleId: role.id, permissions: rolePermsToArray(draft[role.id]) });
      }
    }
    if (changes.length === 0) return;
    saveMut.mutate(changes);
  }

  const pendingCount = (() => {
    const origMap = buildPermsMap(roles);
    let c = 0;
    for (const role of editableRoles) {
      const before = JSON.stringify(origMap[role.id] ?? {});
      const after = JSON.stringify(draft[role.id] ?? {});
      if (before !== after) c++;
    }
    return c;
  })();

  return (
    <div>
      {/* Admin notice + botón nuevo rol */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>
            Matriz de permisos por rol. Los cambios se aplican al clickear "Guardar".
            El rol <strong>ADMIN</strong> tiene acceso completo y no se puede modificar.
          </p>
          {adminRole && (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
              ADMIN: {adminRole.permissions.reduce((s, p) => s + p.actions.length, 0)} permisos · {adminRole.userCount} usuario(s)
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ background: "var(--color-accent)", color: "var(--color-bg-app)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + Nuevo rol
        </button>
      </div>

      {/* Tabla matriz */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--color-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--color-bg-card)", borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", width: 200 }}>
                Módulo / Acción
              </th>
              {editableRoles.map((r) => (
                <th key={r.id} style={{ padding: "8px 10px", minWidth: 130 }}>
                  <RoleHeaderCell
                    role={r}
                    onEdit={() => setEditingRole(r)}
                    onDelete={() => setConfirmDelete(r)}
                    onToggleAll={() => toggleAllForRole(r.id)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.map((mod) => {
              return (
                <>
                  {/* Fila del módulo (con checkboxes de módulo completo) */}
                  <tr key={`mod-${mod.module}`} style={{ background: "var(--color-bg-app)", borderTop: "1px solid var(--color-border)" }}>
                    <td colSpan={1} style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                      {MODULE_LABELS[mod.module] ?? mod.module}
                    </td>
                    {editableRoles.map((r) => {
                      const allChecked = mod.actions.every((a) => draft[r.id]?.[mod.module]?.[a]);
                      const someChecked = mod.actions.some((a) => draft[r.id]?.[mod.module]?.[a]);
                      return (
                        <td key={`mod-${mod.module}-${r.id}`} style={{ padding: "6px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = !allChecked && someChecked;
                            }}
                            onChange={() => toggleModule(r.id, mod.module, mod.actions)}
                            title={`Marcar/desmarcar todo ${MODULE_LABELS[mod.module] ?? mod.module}`}
                            style={{ cursor: "pointer", accentColor: "var(--color-accent)" }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  {/* Filas por acción */}
                  {mod.actions.map((action) => (
                    <tr key={`${mod.module}-${action}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "7px 14px 7px 30px", fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {ACTION_LABELS[action] ?? action}
                      </td>
                      {editableRoles.map((r) => {
                        const checked = draft[r.id]?.[mod.module]?.[action] ?? false;
                        return (
                          <td key={`${mod.module}-${action}-${r.id}`} style={{ padding: "4px 10px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(r.id, mod.module, action)}
                              style={{ cursor: "pointer", accentColor: "var(--color-accent)" }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra flotante de cambios pendientes */}
      {isDirty && (
        <div
          style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-accent)",
            borderRadius: 8,
            padding: "10px 16px",
            display: "flex", gap: 12, alignItems: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 40,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
            Tenés {pendingCount} rol{pendingCount === 1 ? "" : "es"} con cambios sin guardar
          </span>
          <button
            onClick={discard}
            style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
          >
            Descartar
          </button>
          <button
            onClick={save}
            disabled={saveMut.isPending}
            style={{ background: "var(--color-accent)", color: "var(--color-bg-app)", padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: saveMut.isPending ? "not-allowed" : "pointer", opacity: saveMut.isPending ? 0.5 : 1 }}
          >
            {saveMut.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}

      {showCreateModal && (
        <RoleCreateModal
          catalog={catalog}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin-roles"] });
            setShowCreateModal(false);
          }}
        />
      )}

      {editingRole && (
        <RoleEditModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-roles"] });
            setEditingRole(null);
          }}
        />
      )}

      {confirmDelete && (
        <RoleDeleteConfirm
          role={confirmDelete}
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function RoleHeaderCell({
  role,
  onEdit,
  onDelete,
  onToggleAll,
}: {
  role: RoleData;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAll: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontSize: 11, color: "var(--color-text-primary)", fontWeight: 600,
            whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis",
          }}
          title={`${role.label} (${role.name})`}
        >
          {role.label}
        </span>
        <button
          onClick={onEdit}
          title="Editar etiqueta y descripción"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 11, padding: 0 }}
        >
          ✎
        </button>
        {!role.isSystem && (
          <button
            onClick={onDelete}
            title="Eliminar rol"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger-text)", fontSize: 11, padding: 0 }}
          >
            🗑
          </button>
        )}
      </div>
      <div style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
        {role.userCount} user{role.userCount === 1 ? "" : "s"}
      </div>
      <button
        onClick={onToggleAll}
        title="Marcar / desmarcar todo"
        style={{
          background: "none", border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)", padding: "2px 6px", borderRadius: 3,
          fontSize: 9, cursor: "pointer", fontFamily: "var(--font-mono)",
        }}
      >
        Todos
      </button>
    </div>
  );
}

function RoleCreateModal({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: PermissionCatalogEntry[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [error, setError] = useState<string | null>(null);

  function toggle(module: string, action: string) {
    setPerms((prev) => ({
      ...prev,
      [module]: { ...(prev[module] ?? {}), [action]: !prev[module]?.[action] },
    }));
  }

  const mut = useMutation({
    mutationFn: () => {
      const permissions: PermissionEntry[] = [];
      for (const m of Object.keys(perms)) {
        for (const a of Object.keys(perms[m]!)) {
          if (perms[m]![a]) permissions.push({ module: m, action: a });
        }
      }
      return createRole({
        name: name.trim().toUpperCase().replace(/\s+/g, "_"),
        label: label.trim(),
        description: description.trim() || null,
        permissions,
      });
    },
    onSuccess: () => {
      toast.success("Rol creado");
      onCreated();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo crear el rol");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre interno es obligatorio");
      return;
    }
    if (!label.trim()) {
      setError("La etiqueta es obligatoria");
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(name.trim().toUpperCase().replace(/\s+/g, "_"))) {
      setError("El nombre interno debe empezar con letra y usar sólo MAYÚSCULAS, números y guión bajo");
      return;
    }
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-5 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">Nuevo rol</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label style={labelStyle}>Nombre interno (MAYÚSCULAS, sin espacios)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
              style={inputStyle}
              required
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Etiqueta visible</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={labelStyle}>Permisos iniciales</label>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 10, maxHeight: 300, overflowY: "auto" }}>
              {catalog.map((m) => (
                <div key={m.module} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                    {MODULE_LABELS[m.module] ?? m.module}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {m.actions.map((a) => (
                      <label key={a} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={perms[m.module]?.[a] ?? false}
                          onChange={() => toggle(m.module, a)}
                          style={{ accentColor: "var(--color-accent)" }}
                        />
                        <span style={{ color: "var(--color-text-secondary)" }}>{ACTION_LABELS[a] ?? a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              style={{ background: "var(--color-accent)", color: "var(--color-bg-app)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: mut.isPending ? 0.5 : 1 }}
            >
              {mut.isPending ? "Creando…" : "Crear rol"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleEditModal({
  role,
  onClose,
  onSaved,
}: {
  role: RoleData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => patchRole(role.id, { label: label.trim(), description: description.trim() || null }),
    onSuccess: () => {
      toast.success("Rol actualizado");
      onSaved();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo actualizar el rol");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">Editar rol</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!label.trim()) {
              setError("La etiqueta es obligatoria");
              return;
            }
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label style={labelStyle}>Nombre interno (no editable)</label>
            <input type="text" value={role.name} disabled style={{ ...inputStyle, opacity: 0.6 }} />
          </div>
          <div>
            <label style={labelStyle}>Etiqueta visible</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              style={{ background: "var(--color-accent)", color: "var(--color-bg-app)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: mut.isPending ? 0.5 : 1 }}
            >
              {mut.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleDeleteConfirm({
  role,
  loading,
  onCancel,
  onConfirm,
}: {
  role: RoleData;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-5 z-10">
        <h2 className="font-display font-bold text-sm text-[var(--color-text-primary)] mb-2">Eliminar rol</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          {role.userCount > 0
            ? `El rol "${role.label}" tiene ${role.userCount} usuario(s) asignado(s). Reasignalos a otro rol antes de eliminar.`
            : `¿Eliminar el rol "${role.label}"?`}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || role.userCount > 0}
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: role.userCount > 0 ? "not-allowed" : "pointer", opacity: loading || role.userCount > 0 ? 0.4 : 1 }}
          >
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Configuración del sistema ────────────────────────────────────────

const SETTING_META: Record<string, { label: string; type: "select" | "number" | "text" | "toggle"; options?: { value: string; label: string }[] }> = {
  DEFAULT_CURRENCY:       { label: "Moneda por defecto", type: "select", options: [{ value: "USD", label: "USD — Dólar" }, { value: "UYU", label: "UYU — Peso uruguayo" }, { value: "ARS", label: "ARS — Peso argentino" }] },
  DATE_FORMAT:            { label: "Formato de fecha", type: "select", options: [{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }] },
  TIMEZONE:               { label: "Zona horaria", type: "select", options: [{ value: "America/Argentina/Buenos_Aires", label: "Argentina (GMT-3)" }, { value: "America/Montevideo", label: "Uruguay (GMT-3)" }, { value: "America/Santiago", label: "Chile (GMT-4)" }, { value: "America/Lima", label: "Perú (GMT-5)" }] },
  NOTIFICATIONS_EMAIL:    { label: "Notificaciones por email", type: "toggle" },
  NOTIFICATIONS_WHATSAPP: { label: "Notificaciones por WhatsApp", type: "toggle" },
  SHOW_BUDGET_IN_PIPELINE:{ label: "Mostrar presupuesto en pipeline", type: "toggle" },
  DEFAULT_LANGUAGE:       { label: "Idioma", type: "select", options: [{ value: "es", label: "Español" }, { value: "en", label: "English" }] },
  CO2_FACTOR:             { label: "Factor CO₂ (ton/MWh)", type: "number" },
  PROPOSAL_SCRIPT_PATH:   { label: "Path del script de propuesta", type: "text" },
};

function TabConfiguracion() {
  const { data: settings = [], isLoading } = useQuery({ queryKey: ["system-settings"], queryFn: fetchSystemSettings });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { mutate: repairProjects, isPending: repairing } = useMutation({
    mutationFn: () => apiClient.post<{ fixed: number; total: number }>("/api/admin/repair-completed-projects").then(r => r.data),
    onSuccess: (data) => {
      if (data.fixed === 0) toast("No había proyectos para reparar");
      else toast.success(`${data.fixed} proyecto(s) reparado(s)`);
    },
    onError: () => toast.error("Error al reparar proyectos"),
  });

  // Initialize local state when settings load
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const currentValues = { ...settingsMap, ...values };

  function setValue(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changed = Object.entries(values).map(([key, value]) => ({ key, value }));
      if (changed.length === 0) { toast("Sin cambios"); setSaving(false); return; }
      await apiClient.patch("/api/settings/system", changed);
      toast.success("Configuración guardada");
      setValues({});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Cargando...</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {Object.entries(SETTING_META).map(([key, meta]) => {
          const val = currentValues[key] ?? "";
          return (
            <div key={key}>
              <label style={labelStyle}>{meta.label}</label>
              {meta.type === "toggle" ? (
                <button
                  onClick={() => setValue(key, val === "true" ? "false" : "true")}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: val === "true" ? "var(--color-accent)" : "var(--color-border)",
                    border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: val === "true" ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                  }} />
                </button>
              ) : meta.type === "select" ? (
                <select style={{ ...inputStyle, cursor: "pointer" }} value={val} onChange={e => setValue(key, e.target.value)}>
                  {meta.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : meta.type === "number" ? (
                <input style={inputStyle} type="number" step="0.01" value={val} onChange={e => setValue(key, e.target.value)} />
              ) : (
                <input style={inputStyle} type="text" value={val} onChange={e => setValue(key, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || Object.keys(values).length === 0}
        style={{
          marginTop: 24, padding: "9px 20px", borderRadius: 6, border: "none",
          background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600,
          cursor: (saving || Object.keys(values).length === 0) ? "not-allowed" : "pointer",
          opacity: (saving || Object.keys(values).length === 0) ? 0.5 : 1,
        }}
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>

      <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
        <p style={{ ...labelStyle, marginBottom: 8 }}>Mantenimiento de datos</p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          Repara proyectos con estado COMPLETADO que no tienen fecha real de fin registrada (necesario para que aparezcan en métricas de instalaciones).
        </p>
        <button
          onClick={() => repairProjects()}
          disabled={repairing}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-border)",
            background: "var(--color-bg-card)", color: "var(--color-text-primary)", fontSize: 12, fontWeight: 500,
            cursor: repairing ? "not-allowed" : "pointer", opacity: repairing ? 0.6 : 1,
          }}
        >
          {repairing ? "Reparando..." : "Reparar proyectos completados"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab 4: Objetivos ─────────────────────────────────────────────────────────

const METRIC_LABELS: Record<GoalMetric, string> = {
  INSTALLATIONS_COUNT: "Instalaciones",
  KWP_INSTALLED: "kWp instalados",
  LEADS_CREATED: "Leads creados",
  PROPOSALS_SENT: "Propuestas enviadas",
  CLOSED_WON: "Cierres ganados",
};

const AREA_LABELS: Record<GoalArea, string> = {
  VENTAS: "Ventas",
  OPERACIONES: "Operaciones",
};

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  ANNUAL: "Anual",
  QUARTERLY: "Trimestral",
};

const VENTAS_METRICS: GoalMetric[] = ["LEADS_CREATED", "PROPOSALS_SENT", "CLOSED_WON"];
const OPERACIONES_METRICS: GoalMetric[] = ["INSTALLATIONS_COUNT", "KWP_INSTALLED"];
const ALL_AREAS: GoalArea[] = ["VENTAS", "OPERACIONES"];
const ALL_PERIODS: GoalPeriod[] = ["ANNUAL", "QUARTERLY"];
const QUARTERS = [1, 2, 3, 4];

function GoalRow({
  goal,
  onDelete,
}: {
  goal: GoalData;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal.targetValue));
  const qc = useQueryClient();

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      upsertGoal({
        area: goal.area,
        metric: goal.metric,
        period: goal.period,
        year: goal.year,
        quarter: goal.quarter,
        targetValue: parseFloat(value),
      }),
    onSuccess: () => {
      toast.success("Objetivo actualizado");
      qc.invalidateQueries({ queryKey: ["admin-goals"] });
      setEditing(false);
    },
    onError: () => toast.error("Error al guardar objetivo"),
  });

  const tdStyle: React.CSSProperties = { padding: "9px 12px", fontSize: 13, color: "var(--color-text-primary)" };
  const monoStyle: React.CSSProperties = { ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-secondary)" };

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td style={monoStyle}>{AREA_LABELS[goal.area]}</td>
      <td style={tdStyle}>{METRIC_LABELS[goal.metric]}</td>
      <td style={monoStyle}>{PERIOD_LABELS[goal.period]}</td>
      <td style={monoStyle}>{goal.year}{goal.quarter ? ` Q${goal.quarter}` : ""}</td>
      <td style={{ padding: "9px 12px" }}>
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            style={{ ...inputStyle, width: 100, padding: "4px 8px" }}
            autoFocus
          />
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-accent)" }}>
            {goal.targetValue.toLocaleString("es-AR")}
          </span>
        )}
      </td>
      <td style={{ padding: "9px 12px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (
            <>
              <button
                onClick={() => save()}
                disabled={isPending}
                style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                {isPending ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => { setEditing(false); setValue(String(goal.targetValue)); }}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}
              >
                Editar
              </button>
              <button
                onClick={() => onDelete(goal.id)}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #7f1d1d", background: "none", color: "#f87171", fontSize: 11, cursor: "pointer" }}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function TabObjetivos() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear);

  // Add form state
  const [addArea, setAddArea] = useState<GoalArea>("VENTAS");
  const [addMetric, setAddMetric] = useState<GoalMetric>("LEADS_CREATED");
  const [addPeriod, setAddPeriod] = useState<GoalPeriod>("ANNUAL");
  const [addYear, setAddYear] = useState(currentYear);
  const [addQuarter, setAddQuarter] = useState<number>(1);
  const [addValue, setAddValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: goalsMap = {}, isLoading } = useQuery({
    queryKey: ["admin-goals", filterYear],
    queryFn: () => getGoals({ year: filterYear }),
  });

  const allGoals: GoalData[] = Object.values(goalsMap).flat();

  const hasGoalsForYear = allGoals.some(g => g.year === filterYear);

  const { mutate: addGoal, isPending: adding } = useMutation({
    mutationFn: () =>
      upsertGoal({
        area: addArea,
        metric: addMetric,
        period: addPeriod,
        year: addYear,
        quarter: addPeriod === "QUARTERLY" ? addQuarter : null,
        targetValue: parseFloat(addValue),
      }),
    onSuccess: () => {
      toast.success("Objetivo guardado");
      qc.invalidateQueries({ queryKey: ["admin-goals"] });
      setAddValue("");
      setAddOpen(false);
    },
    onError: () => toast.error("Error al guardar objetivo"),
  });

  const { mutate: removeGoal } = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      toast.success("Objetivo eliminado");
      qc.invalidateQueries({ queryKey: ["admin-goals"] });
    },
    onError: () => toast.error("Error al eliminar objetivo"),
  });

  const thStyle: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px",
    fontSize: 10, fontFamily: "var(--font-mono)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
  };

  const availableMetrics = addArea === "VENTAS" ? VENTAS_METRICS : OPERACIONES_METRICS;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Año</label>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            style={{ ...inputStyle, width: 100 }}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setAddOpen(v => !v)}
          style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Nuevo objetivo
        </button>
      </div>

      {/* Alert if no goals */}
      {!isLoading && !hasGoalsForYear && (
        <div style={{ background: "#14110a", border: "1px solid #78350f", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fbbf24" }}>
          No hay objetivos configurados para {filterYear}. Agregá objetivos para activar el seguimiento en métricas.
        </div>
      )}

      {/* Add form */}
      {addOpen && (
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 14 }}>
            Nuevo objetivo
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Área</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={addArea} onChange={e => { setAddArea(e.target.value as GoalArea); setAddMetric(e.target.value === "VENTAS" ? "LEADS_CREATED" : "INSTALLATIONS_COUNT"); }}>
                {ALL_AREAS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Métrica</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={addMetric} onChange={e => setAddMetric(e.target.value as GoalMetric)}>
                {availableMetrics.map(m => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Período</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={addPeriod} onChange={e => setAddPeriod(e.target.value as GoalPeriod)}>
                {ALL_PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: addPeriod === "QUARTERLY" ? "1fr 1fr" : "1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Año</label>
                <input style={inputStyle} type="number" value={addYear} onChange={e => setAddYear(Number(e.target.value))} />
              </div>
              {addPeriod === "QUARTERLY" && (
                <div>
                  <label style={labelStyle}>Trim.</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={addQuarter} onChange={e => setAddQuarter(Number(e.target.value))}>
                    {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Objetivo</label>
              <input style={inputStyle} type="number" step="0.01" value={addValue} onChange={e => setAddValue(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAddOpen(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              onClick={() => addGoal()}
              disabled={adding || !addValue}
              style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: (adding || !addValue) ? "not-allowed" : "pointer", opacity: (adding || !addValue) ? 0.5 : 1 }}
            >
              {adding ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Goals table */}
      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Cargando...</p>
      ) : allGoals.length === 0 ? null : (
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Área</th>
                <th style={thStyle}>Métrica</th>
                <th style={thStyle}>Período</th>
                <th style={thStyle}>Año / Trimestre</th>
                <th style={thStyle}>Objetivo</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {allGoals
                .sort((a, b) => a.area.localeCompare(b.area) || a.metric.localeCompare(b.metric) || a.year - b.year || (a.quarter ?? 0) - (b.quarter ?? 0))
                .map(goal => (
                  <GoalRow key={goal.id} goal={goal} onDelete={id => removeGoal(id)} />
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

// ─── Finance Subcategories Tab ────────────────────────────────────────────────

const CATEGORIAS_ORDENADAS: CategoriaPrincipal[] = [
  "PROYECTO_ENTRADA", "COBRO_CLIENTE",
  "PROYECTO_SALIDA", "COMPRA_STOCK", "CONSUMO_STOCK",
  "FIJO", "VARIABLE", "PAGO_PROVEEDOR", "OTRO",
];

function TabFinanzas() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [cat, setCat] = useState<CategoriaPrincipal>("VARIABLE");
  const [saving, setSaving] = useState(false);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["fin-subcategories"],
    queryFn: () => getSubcategories(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSubcategory(id),
    onSuccess: () => {
      toast.success("Subcategoría eliminada");
      qc.invalidateQueries({ queryKey: ["fin-subcategories"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await createSubcategory({ nombre: nombre.trim(), categoriaPrincipal: cat });
      toast.success("Subcategoría creada");
      setNombre("");
      qc.invalidateQueries({ queryKey: ["fin-subcategories"] });
    } catch {
      toast.error("Error al crear subcategoría");
    } finally {
      setSaving(false);
    }
  }

  const porCategoria = CATEGORIAS_ORDENADAS.reduce<Record<string, typeof subs>>((acc, c) => {
    acc[c] = subs.filter(s => s.categoriaPrincipal === c);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 700 }}>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
        Subcategorías para clasificar movimientos financieros, agrupadas por categoría principal.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
        />
        <select
          style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
          value={cat}
          onChange={e => setCat(e.target.value as CategoriaPrincipal)}
        >
          {CATEGORIAS_ORDENADAS.map(c => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "7px 16px", borderRadius: 6, border: "none",
            background: "var(--color-accent)", color: "#111", fontSize: 13,
            fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Agregando..." : "+ Agregar"}
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {CATEGORIAS_ORDENADAS.map(c => {
            const items = porCategoria[c];
            if (!items.length) return null;
            return (
              <div key={c}>
                <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {CATEGORIA_LABEL[c]}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                  {items.map(s => (
                    <span key={s.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--color-bg-card-hover)", border: "1px solid var(--color-border)",
                      borderRadius: 20, padding: "4px 12px",
                      fontSize: 12, color: "var(--color-text-secondary)",
                    }}>
                      {s.nombre}
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${s.nombre}"?`)) deleteMut.mutate(s.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1, padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Equipos instaladores ────────────────────────────────────────────────

const TEAM_COLORS: string[] = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#7F77DD",
  "#BA7517",
  "#888780",
];

const TEAM_TYPE_OPTIONS: Array<{ value: Team["type"]; label: string }> = [
  { value: "PROPIO", label: "Equipo propio" },
  { value: "TERCERIZADO", label: "Tercerizado" },
];

function TabEquipos() {
  const qc = useQueryClient();
  const { data: teams = [], isLoading } = useQuery({ queryKey: ["admin-teams"], queryFn: () => getTeams() });
  const [editing, setEditing] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Team | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      toast.success("Equipo eliminado");
      qc.invalidateQueries({ queryKey: ["admin-teams"] });
      qc.invalidateQueries({ queryKey: ["calendar-teams"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setConfirmDelete(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar");
    },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Equipos disponibles para asignar a instalaciones.
        </p>
        <button
          onClick={() => setCreating(true)}
          style={{
            background: "var(--color-accent)", color: "var(--color-bg-app)",
            padding: "7px 14px", border: "none", borderRadius: 6,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          + Nuevo equipo
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Cargando…</p>
      ) : teams.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Todavía no hay equipos. Creá uno para asignarlo a las instalaciones.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-card)", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Nombre
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Color
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tipo
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Notas
                </th>
                <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-primary)" }}>{team.name}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: team.color, border: "1px solid var(--color-border)" }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{team.color}</span>
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>
                    {team.type === "PROPIO" ? "Equipo propio" : "Tercerizado"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>
                    {team.notes ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button
                      onClick={() => setEditing(team)}
                      style={{ background: "none", border: "none", color: "var(--color-accent)", fontSize: 12, cursor: "pointer", marginRight: 8 }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(team)}
                      style={{ background: "none", border: "none", color: "var(--color-danger-text)", fontSize: 12, cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <TeamModal
          team={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-teams"] });
            qc.invalidateQueries({ queryKey: ["calendar-teams"] });
            qc.invalidateQueries({ queryKey: ["calendar"] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmTeamDelete
          team={confirmDelete}
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function TeamModal({ team, onClose, onSaved }: { team: Team | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = team !== null;
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? TEAM_COLORS[0]!);
  const [type, setType] = useState<Team["type"]>(team?.type ?? "PROPIO");
  const [notes, setNotes] = useState(team?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      isEdit
        ? patchTeam(team!.id, { name: name.trim(), color, type, notes: notes.trim() || null })
        : createTeam({ name: name.trim(), color, type, notes: notes.trim() || null }),
    onSuccess: () => {
      toast.success(isEdit ? "Equipo actualizado" : "Equipo creado");
      onSaved();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo guardar el equipo");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">
            {isEdit ? `Editar equipo: ${team!.name}` : "Nuevo equipo"}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || mut.isPending) return;
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label style={labelStyle}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color.toLowerCase() === c.toLowerCase()
                      ? "scale-110 ring-2 ring-[var(--color-accent)]"
                      : ""
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tipo de equipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Team["type"])}
              style={inputStyle}
            >
              {TEAM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mut.isPending}
              style={{ background: "var(--color-accent)", color: "var(--color-bg-app)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !name.trim() || mut.isPending ? 0.5 : 1 }}
            >
              {mut.isPending ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmTeamDelete({
  team,
  loading,
  onCancel,
  onConfirm,
}: {
  team: Team;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-5 z-10">
        <h2 className="font-display font-bold text-sm text-[var(--color-text-primary)] mb-2">
          Eliminar equipo
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          ¿Eliminar el equipo <strong>{team.name}</strong>? Las instalaciones existentes quedarán sin
          equipo asignado pero conservarán el nombre histórico.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)", padding: "7px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Pipeline template (etapas + subetapas + checklist precargados) ─────

const STAGE_LABELS_PIPELINE: Record<string, string> = {
  ONBOARDING: "Onboarding",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  HABILITACION_UTE: "Habilitación UTE",
  POSTVENTA: "Postventa",
};

// Lista fija de roles de negocio usada en el select de "Responsable" de subetapa.
// Si el valor almacenado no está en la lista, se muestra como opción adicional
// para no perder datos legacy.
const RESPONSIBLE_OPTIONS = [
  "Asesor Comercial",
  "Gerente de Operaciones",
  "Técnico de Relevamiento / Gerente de Operaciones",
  "Proyectista",
  "Ingeniería",
  "Equipo Postventa",
];

const MODALIDAD_OPTIONS: Array<{ value: "" | "CONTADO" | "FINANCIADO" | "DIRECTO_50_50"; label: string }> = [
  { value: "", label: "Todas las modalidades" },
  { value: "CONTADO", label: "Contado" },
  { value: "FINANCIADO", label: "Financiado" },
  { value: "DIRECTO_50_50", label: "Directo 50/50" },
];

const FIXED_STAGE_ORDER: PipelineStage["name"][] = [
  "ONBOARDING",
  "INGENIERIA",
  "OPERACIONES",
  "HABILITACION_UTE",
  "POSTVENTA",
];

// Tipos locales con IDs estables para React keys (se strippean antes de guardar)
let _localIdCounter = 1;
function genLocalId(): string {
  return `l${_localIdCounter++}`;
}

type DraftChecklistItem = {
  _localId: string;
  label: string;
  isRequired?: boolean;
  isBlocker?: boolean;
  appliesWhenModalidadPago?: "CONTADO" | "FINANCIADO" | "DIRECTO_50_50" | null;
};
type DraftSubstage = {
  _localId: string;
  order: number;
  name: string;
  sopCode?: string | null;
  responsableRol?: string | null;
  responsible: string;
  isSystem?: boolean;
  isActive?: boolean;
  operationVariant?: "PROPIA" | "TERCERIZADA" | null;
  checklist: DraftChecklistItem[];
};
type DraftStage = {
  order: number;
  name: PipelineStage["name"];
  label: string; // hidratado con fallback desde STAGE_LABELS_PIPELINE
  weight: number;
  substages: DraftSubstage[];
};

function hydrate(stages: PipelineStage[]): DraftStage[] {
  // Respeta el orden fijo por slug, no el order server (por las dudas)
  const byName = new Map(stages.map((s) => [s.name, s]));
  return FIXED_STAGE_ORDER.map((name, idx) => {
    const s = byName.get(name);
    if (!s) {
      return {
        order: idx + 1,
        name,
        label: STAGE_LABELS_PIPELINE[name] ?? name,
        weight: 0,
        substages: [],
      };
    }
    return {
      order: idx + 1,
      name: s.name,
      label: (s.label ?? "").trim() || STAGE_LABELS_PIPELINE[s.name] || s.name,
      weight: s.weight,
      substages: s.substages.map((sub) => ({
        _localId: genLocalId(),
        order: sub.order,
        name: sub.name,
        sopCode: sub.sopCode ?? null,
        responsableRol: sub.responsableRol ?? null,
        responsible: sub.responsible,
        isSystem: sub.isSystem,
        isActive: sub.isActive,
        operationVariant: sub.operationVariant ?? null,
        checklist: (sub.checklist ?? []).map((item) => ({
          _localId: genLocalId(),
          label: item.label,
          isRequired: item.isRequired,
          isBlocker: item.isBlocker,
          appliesWhenModalidadPago: item.appliesWhenModalidadPago ?? null,
        })),
      })),
    };
  });
}

function dehydrate(stages: DraftStage[]): PipelineStage[] {
  return stages.map((s, stageIdx) => ({
    order: stageIdx + 1,
    name: s.name,
    label: s.label.trim() || STAGE_LABELS_PIPELINE[s.name] || s.name,
    weight: s.weight,
    substages: s.substages.map((sub, subIdx) => ({
      order: subIdx + 1,
      name: sub.name.trim(),
      sopCode: sub.sopCode ?? null,
      responsableRol: sub.responsableRol ?? null,
      responsible: sub.responsible,
      isSystem: sub.isSystem,
      isActive: sub.isActive,
      operationVariant: sub.operationVariant ?? null,
      checklist: sub.checklist.map((item) => ({
        label: item.label.trim(),
        isRequired: item.isRequired,
        isBlocker: item.isBlocker,
        appliesWhenModalidadPago: item.appliesWhenModalidadPago ?? null,
      })),
    })),
  }));
}

// Comparación estable para detectar cambios por stage/substage
function serializeForDiff(stages: PipelineStage[]): string {
  return JSON.stringify(stages);
}

function TabPipeline() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-pipeline-template"],
    queryFn: getPipelineTemplate,
  });

  const [draft, setDraft] = useState<DraftStage[] | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState<string>("");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["ONBOARDING"]));
  const [expandedChecklist, setExpandedChecklist] = useState<Set<string>>(new Set());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteSubstage, setConfirmDeleteSubstage] = useState<
    | { stageIdx: number; substageIdx: number; name: string; checklistCount: number }
    | null
  >(null);

  // Hidratar draft cuando llegan datos del server, pero solo si el usuario no
  // tiene cambios pendientes (para no pisar su edición en caso de refetch).
  const currentSnapshot = draft ? serializeForDiff(dehydrate(draft)) : "";
  const isDirty = draft !== null && currentSnapshot !== originalSnapshot;

  useEffect(() => {
    if (!data) return;
    if (draft === null || !isDirty) {
      const hydrated = hydrate(data.stages);
      setDraft(hydrated);
      setOriginalSnapshot(serializeForDiff(dehydrate(hydrated)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (stages: PipelineStage[]) => putPipelineTemplate(stages),
    onSuccess: () => {
      toast.success("Template guardado correctamente");
      qc.invalidateQueries({ queryKey: ["admin-pipeline-template"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar el template");
    },
  });

  const resetMut = useMutation({
    mutationFn: () => resetPipelineTemplate(),
    onSuccess: () => {
      toast.success("Template restaurado al default");
      qc.invalidateQueries({ queryKey: ["admin-pipeline-template"] });
      setConfirmReset(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo restaurar");
    },
  });

  function toggleStageExpanded(name: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function toggleChecklistEditor(key: string) {
    setExpandedChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function discard() {
    if (data) {
      const hydrated = hydrate(data.stages);
      setDraft(hydrated);
      setOriginalSnapshot(serializeForDiff(dehydrate(hydrated)));
    }
    setConfirmDiscard(false);
  }

  function save() {
    if (!draft) return;
    // Validación cliente antes de enviar
    for (const stage of draft) {
      if (!stage.label.trim()) {
        toast.error(`La etapa ${STAGE_LABELS_PIPELINE[stage.name]} necesita un nombre visible`);
        return;
      }
      if (!Number.isInteger(stage.weight) || stage.weight < 0) {
        toast.error(`El weight de ${STAGE_LABELS_PIPELINE[stage.name]} debe ser entero ≥ 0`);
        return;
      }
      for (const sub of stage.substages) {
        if (!sub.name.trim()) {
          toast.error("Cada subetapa necesita un nombre");
          return;
        }
        if (!sub.responsible.trim()) {
          toast.error("Cada subetapa necesita un responsable");
          return;
        }
        for (const item of sub.checklist) {
          if (!item.label.trim()) {
            toast.error("Cada ítem de checklist necesita texto");
            return;
          }
        }
      }
    }
    saveMut.mutate(dehydrate(draft));
  }

  // Mutators del draft
  function updateStage(stageIdx: number, patch: Partial<DraftStage>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[stageIdx] = { ...next[stageIdx]!, ...patch };
      return next;
    });
  }
  function updateSubstage(stageIdx: number, subIdx: number, patch: Partial<DraftSubstage>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      const subs = [...stage.substages];
      subs[subIdx] = { ...subs[subIdx]!, ...patch };
      stage.substages = subs;
      next[stageIdx] = stage;
      return next;
    });
  }
  function addSubstage(stageIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      stage.substages = [
        ...stage.substages,
        {
          _localId: genLocalId(),
          order: stage.substages.length + 1,
          name: "Nueva subetapa",
          responsible: RESPONSIBLE_OPTIONS[0]!,
          sopCode: null,
          responsableRol: null,
          isSystem: false,
          isActive: true,
          operationVariant: null,
          checklist: [],
        },
      ];
      next[stageIdx] = stage;
      return next;
    });
  }
  function removeSubstage(stageIdx: number, subIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      stage.substages = stage.substages.filter((_, i) => i !== subIdx);
      next[stageIdx] = stage;
      return next;
    });
  }
  function moveSubstage(stageIdx: number, subIdx: number, direction: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const target = subIdx + direction;
      const stage = prev[stageIdx]!;
      if (target < 0 || target >= stage.substages.length) return prev;
      const next = [...prev];
      const subs = [...stage.substages];
      [subs[subIdx], subs[target]] = [subs[target]!, subs[subIdx]!];
      next[stageIdx] = { ...stage, substages: subs };
      return next;
    });
  }
  function updateChecklistItem(
    stageIdx: number,
    subIdx: number,
    itemIdx: number,
    patch: Partial<DraftChecklistItem>,
  ) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      const subs = [...stage.substages];
      const sub = { ...subs[subIdx]! };
      const checklist = [...sub.checklist];
      checklist[itemIdx] = { ...checklist[itemIdx]!, ...patch };
      sub.checklist = checklist;
      subs[subIdx] = sub;
      stage.substages = subs;
      next[stageIdx] = stage;
      return next;
    });
  }
  function addChecklistItem(stageIdx: number, subIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      const subs = [...stage.substages];
      const sub = { ...subs[subIdx]! };
      sub.checklist = [
        ...sub.checklist,
        { _localId: genLocalId(), label: "", isRequired: false, isBlocker: false, appliesWhenModalidadPago: null },
      ];
      subs[subIdx] = sub;
      stage.substages = subs;
      next[stageIdx] = stage;
      return next;
    });
  }
  function removeChecklistItem(stageIdx: number, subIdx: number, itemIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const stage = { ...next[stageIdx]! };
      const subs = [...stage.substages];
      const sub = { ...subs[subIdx]! };
      sub.checklist = sub.checklist.filter((_, i) => i !== itemIdx);
      subs[subIdx] = sub;
      stage.substages = subs;
      next[stageIdx] = stage;
      return next;
    });
  }
  function moveChecklistItem(stageIdx: number, subIdx: number, itemIdx: number, direction: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const stage = prev[stageIdx]!;
      const sub = stage.substages[subIdx]!;
      const target = itemIdx + direction;
      if (target < 0 || target >= sub.checklist.length) return prev;
      const next = [...prev];
      const subs = [...stage.substages];
      const nextSub = { ...sub };
      const checklist = [...nextSub.checklist];
      [checklist[itemIdx], checklist[target]] = [checklist[target]!, checklist[itemIdx]!];
      nextSub.checklist = checklist;
      subs[subIdx] = nextSub;
      next[stageIdx] = { ...stage, substages: subs };
      return next;
    });
  }

  if (isLoading || !data || !draft) {
    return <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Cargando template…</p>;
  }

  // Computar qué etapas están "modificadas" para mostrar badge
  const origStages = hydrate(data.stages);
  const stageDirtyFlags = draft.map((stage, idx) => {
    const orig = origStages[idx];
    return orig
      ? serializeForDiff([dehydrate([stage])[0]!]) !== serializeForDiff([dehydrate([orig])[0]!])
      : true;
  });

  return (
    <div>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 16, gap: 12,
          position: "sticky", top: 0, background: "var(--color-bg-app)", zIndex: 5, paddingBottom: 8,
        }}
      >
        <div>
          <p style={{ fontSize: 13, color: "var(--color-text-primary)", marginBottom: 4, fontWeight: 600 }}>
            Etapas precargadas al crear un nuevo proyecto
          </p>
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Los cambios no afectan proyectos existentes, sólo los nuevos.
            {data.isCustom ? " El template está personalizado." : " Usando el template default del sistema."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {isDirty && (
            <span style={{ fontSize: 10, color: "var(--color-warning-text)", fontFamily: "var(--font-mono)" }}>
              Hay cambios sin guardar
            </span>
          )}
          {data.isCustom && (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={isDirty}
              title={isDirty ? "Guardá o descartá los cambios primero" : undefined}
              style={{
                background: "none", border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6,
                fontSize: 12, cursor: isDirty ? "not-allowed" : "pointer",
                opacity: isDirty ? 0.4 : 1,
              }}
            >
              Volver al default
            </button>
          )}
          <button
            onClick={() => (isDirty ? setConfirmDiscard(true) : discard())}
            disabled={!isDirty}
            style={{
              background: "none", border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6,
              fontSize: 12, cursor: isDirty ? "pointer" : "not-allowed",
              opacity: isDirty ? 1 : 0.4,
            }}
          >
            Descartar cambios
          </button>
          <button
            onClick={save}
            disabled={!isDirty || saveMut.isPending}
            style={{
              background: "var(--color-accent)", color: "var(--color-bg-app)",
              padding: "7px 14px", border: "none", borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              cursor: isDirty && !saveMut.isPending ? "pointer" : "not-allowed",
              opacity: !isDirty || saveMut.isPending ? 0.5 : 1,
            }}
          >
            {saveMut.isPending ? "Guardando…" : "Guardar template"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {draft.map((stage, stageIdx) => (
          <StageCard
            key={stage.name}
            stage={stage}
            stageIdx={stageIdx}
            isModified={stageDirtyFlags[stageIdx] ?? false}
            expanded={expandedStages.has(stage.name)}
            expandedChecklist={expandedChecklist}
            onToggle={() => toggleStageExpanded(stage.name)}
            onToggleChecklist={toggleChecklistEditor}
            onUpdateStage={(patch) => updateStage(stageIdx, patch)}
            onAddSubstage={() => addSubstage(stageIdx)}
            onUpdateSubstage={(subIdx, patch) => updateSubstage(stageIdx, subIdx, patch)}
            onRequestDeleteSubstage={(subIdx) => {
              const sub = stage.substages[subIdx]!;
              setConfirmDeleteSubstage({
                stageIdx,
                substageIdx: subIdx,
                name: sub.name,
                checklistCount: sub.checklist.length,
              });
            }}
            onMoveSubstage={(subIdx, dir) => moveSubstage(stageIdx, subIdx, dir)}
            onUpdateChecklistItem={(subIdx, itemIdx, patch) =>
              updateChecklistItem(stageIdx, subIdx, itemIdx, patch)
            }
            onAddChecklistItem={(subIdx) => addChecklistItem(stageIdx, subIdx)}
            onRemoveChecklistItem={(subIdx, itemIdx) =>
              removeChecklistItem(stageIdx, subIdx, itemIdx)
            }
            onMoveChecklistItem={(subIdx, itemIdx, dir) =>
              moveChecklistItem(stageIdx, subIdx, itemIdx, dir)
            }
          />
        ))}
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Descartar cambios"
          message="Perderás todos los cambios que no guardaste. ¿Continuar?"
          confirmLabel="Sí, descartar"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={discard}
        />
      )}

      {confirmDeleteSubstage && (
        <ConfirmDialog
          title="Eliminar subetapa"
          message={
            confirmDeleteSubstage.checklistCount > 0
              ? `"${confirmDeleteSubstage.name}" tiene ${confirmDeleteSubstage.checklistCount} ítem(s) de checklist. ¿Eliminar de todos modos?`
              : `¿Eliminar "${confirmDeleteSubstage.name}"?`
          }
          confirmLabel="Sí, eliminar"
          danger
          onCancel={() => setConfirmDeleteSubstage(null)}
          onConfirm={() => {
            removeSubstage(confirmDeleteSubstage.stageIdx, confirmDeleteSubstage.substageIdx);
            setConfirmDeleteSubstage(null);
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Restaurar template"
          message="Esto borra el template personalizado y vuelve al template por defecto del código. Los proyectos ya creados no se ven afectados."
          confirmLabel={resetMut.isPending ? "Restaurando…" : "Sí, restaurar"}
          confirmDisabled={resetMut.isPending}
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => resetMut.mutate()}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes de la UI del pipeline ───────────────────────────────────

function StageCard({
  stage,
  stageIdx,
  isModified,
  expanded,
  expandedChecklist,
  onToggle,
  onToggleChecklist,
  onUpdateStage,
  onAddSubstage,
  onUpdateSubstage,
  onRequestDeleteSubstage,
  onMoveSubstage,
  onUpdateChecklistItem,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onMoveChecklistItem,
}: {
  stage: DraftStage;
  stageIdx: number;
  isModified: boolean;
  expanded: boolean;
  expandedChecklist: Set<string>;
  onToggle: () => void;
  onToggleChecklist: (key: string) => void;
  onUpdateStage: (patch: Partial<DraftStage>) => void;
  onAddSubstage: () => void;
  onUpdateSubstage: (subIdx: number, patch: Partial<DraftSubstage>) => void;
  onRequestDeleteSubstage: (subIdx: number) => void;
  onMoveSubstage: (subIdx: number, direction: -1 | 1) => void;
  onUpdateChecklistItem: (subIdx: number, itemIdx: number, patch: Partial<DraftChecklistItem>) => void;
  onAddChecklistItem: (subIdx: number) => void;
  onRemoveChecklistItem: (subIdx: number, itemIdx: number) => void;
  onMoveChecklistItem: (subIdx: number, itemIdx: number, direction: -1 | 1) => void;
}) {
  void stageIdx;
  return (
    <div
      style={{
        border: isModified ? "1px solid var(--color-warning-text)" : "1px solid var(--color-border)",
        borderRadius: 8,
        background: "var(--color-bg-card)",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
          color: "var(--color-text-primary)", fontSize: 13, fontWeight: 600,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {expanded ? "▾" : "▸"} {stage.label || STAGE_LABELS_PIPELINE[stage.name]}
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", fontWeight: 400 }}>
            {stage.name}
          </span>
          {isModified && <Badge label="modificado" variant="warning" />}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", fontWeight: 400 }}>
          weight {stage.weight} · {stage.substages.length} subetapa{stage.substages.length === 1 ? "" : "s"}
        </span>
      </button>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border)", padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Nombre visible</label>
              <input
                type="text"
                value={stage.label}
                onChange={(e) => onUpdateStage({ label: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Weight</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={stage.weight}
                onChange={(e) => onUpdateStage({ weight: parseInt(e.target.value, 10) || 0 })}
                style={inputStyle}
              />
            </div>
          </div>

          <p style={{ ...labelStyle, marginBottom: 6 }}>Subetapas</p>
          {stage.substages.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: 8 }}>
              Esta etapa no tiene subetapas todavía.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {stage.substages.map((sub, subIdx) => {
                const key = `${stage.name}-${sub._localId}`;
                const checklistOpen = expandedChecklist.has(key);
                return (
                  <SubstageRow
                    key={sub._localId}
                    substage={sub}
                    subIdx={subIdx}
                    isFirst={subIdx === 0}
                    isLast={subIdx === stage.substages.length - 1}
                    checklistOpen={checklistOpen}
                    onToggleChecklist={() => onToggleChecklist(key)}
                    onUpdate={(patch) => onUpdateSubstage(subIdx, patch)}
                    onDelete={() => onRequestDeleteSubstage(subIdx)}
                    onMove={(dir) => onMoveSubstage(subIdx, dir)}
                    onUpdateItem={(itemIdx, patch) => onUpdateChecklistItem(subIdx, itemIdx, patch)}
                    onAddItem={() => onAddChecklistItem(subIdx)}
                    onRemoveItem={(itemIdx) => onRemoveChecklistItem(subIdx, itemIdx)}
                    onMoveItem={(itemIdx, dir) => onMoveChecklistItem(subIdx, itemIdx, dir)}
                  />
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={onAddSubstage}
            style={{
              marginTop: 10, background: "none",
              border: "1px dashed var(--color-border)", color: "var(--color-accent)",
              padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
            }}
          >
            + Agregar subetapa
          </button>
        </div>
      )}
    </div>
  );
}

function SubstageRow({
  substage,
  subIdx,
  isFirst,
  isLast,
  checklistOpen,
  onToggleChecklist,
  onUpdate,
  onDelete,
  onMove,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onMoveItem,
}: {
  substage: DraftSubstage;
  subIdx: number;
  isFirst: boolean;
  isLast: boolean;
  checklistOpen: boolean;
  onToggleChecklist: () => void;
  onUpdate: (patch: Partial<DraftSubstage>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onUpdateItem: (itemIdx: number, patch: Partial<DraftChecklistItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemIdx: number) => void;
  onMoveItem: (itemIdx: number, direction: -1 | 1) => void;
}) {
  void subIdx;
  const customResponsible =
    substage.responsible && !RESPONSIBLE_OPTIONS.includes(substage.responsible);
  const checklistCount = substage.checklist.length;
  return (
    <li style={{ border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-bg-app)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 220px auto auto",
          gap: 8, alignItems: "center", padding: "8px 10px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <IconButton
            title="Mover arriba"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            ▲
          </IconButton>
          <IconButton
            title="Mover abajo"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            ▼
          </IconButton>
        </div>
        <input
          type="text"
          value={substage.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{ ...inputStyle, fontSize: 12 }}
        />
        <select
          value={substage.responsible}
          onChange={(e) => onUpdate({ responsible: e.target.value })}
          style={{ ...inputStyle, fontSize: 12 }}
        >
          {customResponsible && (
            <option value={substage.responsible}>{substage.responsible} (custom)</option>
          )}
          {RESPONSIBLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onToggleChecklist}
          title={checklistOpen ? "Cerrar checklist" : "Editar checklist"}
          style={{
            background: "none", border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)", padding: "5px 10px",
            borderRadius: 4, fontSize: 11, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {checklistOpen ? "▾" : "▸"} {checklistCount} check{checklistCount === 1 ? "" : "s"}
        </button>
        <IconButton title="Eliminar subetapa" danger onClick={onDelete}>
          🗑
        </IconButton>
      </div>
      {checklistOpen && (
        <ChecklistEditor
          items={substage.checklist}
          onUpdateItem={onUpdateItem}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
        />
      )}
    </li>
  );
}

function ChecklistEditor({
  items,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onMoveItem,
}: {
  items: DraftChecklistItem[];
  onUpdateItem: (itemIdx: number, patch: Partial<DraftChecklistItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemIdx: number) => void;
  onMoveItem: (itemIdx: number, direction: -1 | 1) => void;
}) {
  const [openAdvanced, setOpenAdvanced] = useState<Set<string>>(new Set());

  function toggleAdvanced(id: string) {
    setOpenAdvanced((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ borderTop: "1px dashed var(--color-border)", padding: "8px 10px 10px", background: "rgba(0,0,0,0.12)" }}>
      {items.length === 0 && (
        <p style={{ fontSize: 10, color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: 6 }}>
          Sin ítems de checklist todavía.
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item, itemIdx) => {
          const advancedOpen = openAdvanced.has(item._localId);
          return (
            <li key={item._localId} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto auto",
                  gap: 6, alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <IconButton
                    title="Mover arriba"
                    disabled={itemIdx === 0}
                    onClick={() => onMoveItem(itemIdx, -1)}
                    small
                  >
                    ▲
                  </IconButton>
                  <IconButton
                    title="Mover abajo"
                    disabled={itemIdx === items.length - 1}
                    onClick={() => onMoveItem(itemIdx, 1)}
                    small
                  >
                    ▼
                  </IconButton>
                </div>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onUpdateItem(itemIdx, { label: e.target.value })}
                  style={{ ...inputStyle, fontSize: 11, padding: "5px 8px" }}
                />
                <label
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 10, color: "var(--color-text-secondary)", cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.isRequired ?? false}
                    onChange={(e) => onUpdateItem(itemIdx, { isRequired: e.target.checked })}
                  />
                  Obligatorio
                </label>
                <IconButton
                  title={advancedOpen ? "Ocultar avanzado" : "Opciones avanzadas"}
                  onClick={() => toggleAdvanced(item._localId)}
                  small
                >
                  ⋯
                </IconButton>
                <IconButton
                  title="Eliminar ítem"
                  danger
                  onClick={() => onRemoveItem(itemIdx)}
                  small
                >
                  🗑
                </IconButton>
              </div>
              {advancedOpen && (
                <div
                  style={{
                    marginLeft: 32, padding: 8, borderLeft: "2px solid var(--color-border)",
                    display: "flex", flexDirection: "column", gap: 6,
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 10, color: "var(--color-text-secondary)", cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isBlocker ?? false}
                      onChange={(e) => onUpdateItem(itemIdx, { isBlocker: e.target.checked })}
                    />
                    Bloquea el cierre de la etapa si no está completo
                  </label>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>
                      Sólo aplica si la modalidad de pago es:
                    </label>
                    <select
                      value={item.appliesWhenModalidadPago ?? ""}
                      onChange={(e) =>
                        onUpdateItem(itemIdx, {
                          appliesWhenModalidadPago:
                            (e.target.value as DraftChecklistItem["appliesWhenModalidadPago"]) || null,
                        })
                      }
                      style={{ ...inputStyle, fontSize: 11, padding: "4px 8px", width: 220 }}
                    >
                      {MODALIDAD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onAddItem}
        style={{
          marginTop: 8, background: "none",
          border: "1px dashed var(--color-border)", color: "var(--color-accent)",
          padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer",
        }}
      >
        + Agregar ítem
      </button>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
  small,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  small?: boolean;
}) {
  const size = small ? 18 : 22;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size, height: size,
        background: "none",
        border: "1px solid var(--color-border)",
        color: danger ? "var(--color-danger-text)" : "var(--color-text-muted)",
        borderRadius: 4,
        fontSize: small ? 9 : 10,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ label, variant }: { label: string; variant: "neutral" | "danger" | "info" | "warning" }) {
  const styles: Record<string, { bg: string; color: string }> = {
    neutral: { bg: "var(--color-bg-card-hover)", color: "var(--color-text-muted)" },
    danger: { bg: "var(--color-danger-bg)", color: "var(--color-danger-text)" },
    info: { bg: "var(--color-info-bg)", color: "var(--color-info-text)" },
    warning: { bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  };
  const s = styles[variant];
  return (
    <span
      style={{
        background: s.bg, color: s.color,
        padding: "1px 6px", borderRadius: 3,
        fontSize: 9, fontFamily: "var(--font-mono)",
        fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmDisabled,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-5 z-10">
        <h2 className="font-display font-bold text-sm text-[var(--color-text-primary)] mb-2">{title}</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              background: danger ? "var(--color-danger-bg)" : "var(--color-accent)",
              color: danger ? "var(--color-danger-text)" : "var(--color-bg-app)",
              padding: "7px 14px", border: "none", borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              cursor: confirmDisabled ? "not-allowed" : "pointer",
              opacity: confirmDisabled ? 0.5 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = "usuarios" | "permisos" | "configuracion" | "objetivos" | "finanzas" | "equipos" | "pipeline" | "materiales" | "cuentas" | "deadlines";

export function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");

  const tabs: { id: Tab; label: string }[] = [
    { id: "usuarios", label: "Usuarios" },
    { id: "equipos", label: "Equipos instaladores" },
    { id: "pipeline", label: "Pipeline default" },
    { id: "permisos", label: "Permisos" },
    { id: "configuracion", label: "Configuración del sistema" },
    { id: "objetivos", label: "Objetivos" },
    { id: "finanzas", label: "Subcategorías" },
    { id: "materiales", label: "Materiales" },
    { id: "cuentas", label: "Cuentas" },
    { id: "deadlines", label: "Reglas de Deadlines" },
  ];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, fontFamily: "var(--font-display)" }}>
          Administración
        </h1>
        <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
          Gestión de usuarios, permisos y configuración del sistema
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FinanceHealthWidget />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-border)", marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 18px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--color-accent)" : "var(--color-text-secondary)",
              borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              marginBottom: -1, transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "usuarios" && <TabUsuarios />}
      {activeTab === "equipos" && <TabEquipos />}
      {activeTab === "pipeline" && <TabPipeline />}
      {activeTab === "permisos" && <TabPermisos />}
      {activeTab === "configuracion" && <TabConfiguracion />}
      {activeTab === "objetivos" && <TabObjetivos />}
      {activeTab === "finanzas" && <TabFinanzas />}
      {activeTab === "materiales" && <TabMateriales />}
      {activeTab === "cuentas" && <TabCuentas />}
      {activeTab === "deadlines" && <TabDeadlineRules />}
    </div>
  );
}
