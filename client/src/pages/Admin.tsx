import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiClient } from "../api/axios";
import { getGoals, upsertGoal, deleteGoal } from "../api/metrics.api";
import type { GoalArea, GoalMetric, GoalPeriod, GoalData } from "../types/api.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "ADMIN" | "ASESOR_COMERCIAL" | "INGENIERIA" | "OPERACIONES";

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

interface PermissionEntry {
  module: string;
  actions: string[];
}

interface UserMe {
  permissions: PermissionEntry[];
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
            <select style={{ ...inputStyle, cursor: "pointer" }} value={role} onChange={e => setRole(e.target.value as UserRole)}>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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

// ─── Tab 2: Permisos ──────────────────────────────────────────────────────────

// Hard-coded matrix based on seed data (read-only display)
const PERMISSIONS_MATRIX: Record<string, Record<string, string[]>> = {
  ADMIN:            { VENTAS: ["VIEW","CREATE","EDIT","DELETE","COMMENT"], ONBOARDING: ["VIEW","CREATE","EDIT","DELETE","COMPLETE","COMMENT"], INGENIERIA: ["VIEW","CREATE","EDIT","DELETE","COMPLETE","COMMENT"], OPERACIONES: ["VIEW","CREATE","EDIT","DELETE","COMPLETE","COMMENT"], HABILITACION: ["VIEW","CREATE","EDIT","DELETE","COMPLETE","COMMENT"], POSTVENTA: ["VIEW","CREATE","EDIT","DELETE","COMPLETE","COMMENT"], METRICAS: ["VIEW"], CONFIGURACION: ["VIEW","EDIT"], USUARIOS: ["VIEW","CREATE","EDIT","DELETE"] },
  ASESOR_COMERCIAL: { VENTAS: ["VIEW","CREATE","EDIT","COMMENT"], ONBOARDING: ["VIEW","COMMENT"], INGENIERIA: ["VIEW"], OPERACIONES: ["VIEW"], HABILITACION: ["VIEW"], POSTVENTA: ["VIEW"], METRICAS: ["VIEW"] },
  INGENIERIA:       { VENTAS: ["VIEW"], ONBOARDING: ["VIEW","COMMENT"], INGENIERIA: ["VIEW","CREATE","EDIT","COMPLETE","COMMENT"], OPERACIONES: ["VIEW","COMMENT"], HABILITACION: ["VIEW","COMMENT"], POSTVENTA: ["VIEW"], METRICAS: ["VIEW"] },
  OPERACIONES:      { VENTAS: ["VIEW"], ONBOARDING: ["VIEW","COMMENT"], INGENIERIA: ["VIEW"], OPERACIONES: ["VIEW","CREATE","EDIT","COMPLETE","COMMENT"], HABILITACION: ["VIEW","CREATE","EDIT","COMPLETE","COMMENT"], POSTVENTA: ["VIEW","COMMENT"], METRICAS: ["VIEW"] },
};

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  VIEW:     { bg: "var(--color-info-bg)", color: "var(--color-info-text)" },
  CREATE:   { bg: "var(--color-state-done-bg)", color: "var(--color-state-done-text)" },
  EDIT:     { bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  DELETE:   { bg: "var(--color-danger-bg)", color: "var(--color-danger-text)" },
  COMPLETE: { bg: "var(--color-state-active-bg)", color: "var(--color-state-active-text)" },
  COMMENT:  { bg: "var(--color-bg-card-hover)", color: "var(--color-text-primary)" },
};

function TabPermisos() {
  return (
    <div>
      <div style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-accent)", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "var(--color-warning-text)" }}>
        La edición de permisos estará disponible próximamente
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                Módulo
              </th>
              {ALL_ROLES.map(role => (
                <th key={role} style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  <RoleBadge role={role} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_MODULES.map(mod => (
              <tr key={mod} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "10px 12px", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {mod}
                </td>
                {ALL_ROLES.map(role => {
                  const actions = PERMISSIONS_MATRIX[role]?.[mod] ?? [];
                  return (
                    <td key={role} style={{ padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
                        {actions.length === 0 ? (
                          <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>—</span>
                        ) : (
                          actions.map(a => {
                            const c = ACTION_COLORS[a] ?? { bg: "var(--color-bg-card-hover)", color: "var(--color-text-muted)" };
                            return (
                              <span key={a} style={{ background: c.bg, color: c.color, padding: "1px 5px", borderRadius: 3, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                                {a}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
              <input style={inputStyle} type="number" step="0.01" value={addValue} onChange={e => setAddValue(e.target.value)} placeholder="0" />
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

type Tab = "usuarios" | "permisos" | "configuracion" | "objetivos";

export function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");

  const tabs: { id: Tab; label: string }[] = [
    { id: "usuarios", label: "Usuarios" },
    { id: "permisos", label: "Permisos" },
    { id: "configuracion", label: "Configuración del sistema" },
    { id: "objetivos", label: "Objetivos" },
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
      {activeTab === "permisos" && <TabPermisos />}
      {activeTab === "configuracion" && <TabConfiguracion />}
      {activeTab === "objetivos" && <TabObjetivos />}
    </div>
  );
}
