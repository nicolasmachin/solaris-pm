import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../store/auth.store";
import { apiClient } from "../api/axios";
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from "../api/deadline.api";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "ADMIN" | "ASESOR_COMERCIAL" | "INGENIERIA" | "OPERACIONES";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  ASESOR_COMERCIAL: "Asesor Comercial",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
};

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  ADMIN:            { bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  ASESOR_COMERCIAL: { bg: "var(--color-info-bg)", color: "var(--color-info-text)" },
  INGENIERIA:       { bg: "var(--color-state-done-bg)", color: "var(--color-state-done-text)" },
  OPERACIONES:      { bg: "var(--color-state-active-bg)", color: "var(--color-state-active-text)" },
};

interface UserSetting {
  id: string;
  key: string;
  value: string;
}

const USER_PREF_META: Record<string, { label: string; type: "select" | "toggle"; options?: { value: string; label: string }[] }> = {
  DEFAULT_CURRENCY:       { label: "Moneda preferida", type: "select", options: [{ value: "USD", label: "USD — Dólar" }, { value: "UYU", label: "UYU — Peso uruguayo" }, { value: "ARS", label: "ARS — Peso argentino" }] },
  DATE_FORMAT:            { label: "Formato de fecha", type: "select", options: [{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }] },
  NOTIFICATIONS_EMAIL:    { label: "Notificaciones por email", type: "toggle" },
  NOTIFICATIONS_WHATSAPP: { label: "Notificaciones por WhatsApp", type: "toggle" },
};

// ─── Shared styles ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-app)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "8px 10px",
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

const sectionStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: 24,
  marginBottom: 20,
  maxWidth: 520,
};

// ─── Change Password Modal ─────────────────────────────────────────────────

function ChangePasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("La contraseña nueva debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/api/users/${userId}/password`, { currentPassword, newPassword });
      toast.success("Contraseña actualizada");
      onClose();
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (code?.code === "INVALID_CURRENT_PASSWORD") {
        toast.error("La contraseña actual no es correcta");
      } else {
        toast.error(code?.message ?? "Error al cambiar contraseña");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 380 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 20 }}>
          Cambiar contraseña
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Contraseña actual *</label>
            <input
              style={inputStyle}
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="Tu contraseña actual"
            />
          </div>
          <div>
            <label style={labelStyle}>Nueva contraseña *</label>
            <input
              style={inputStyle}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mín. 8 caracteres"
            />
          </div>
          <div>
            <label style={labelStyle}>Confirmar nueva contraseña *</label>
            <input
              style={inputStyle}
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Repetí la nueva contraseña"
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Section 1: Mi Perfil ─────────────────────────────────────────────────

function SectionPerfil() {
  const { user, setAuth, token, permissions } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Track dirty state
  useEffect(() => {
    setDirty(name !== (user?.name ?? "") || email !== (user?.email ?? ""));
  }, [name, email, user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await apiClient.patch(`/api/users/me`, { name, email });
      // Update auth store with new name/email
      setAuth(token!, { ...user, name: data.name, email: data.email }, permissions);
      toast.success("Perfil actualizado");
      setDirty(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al actualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  const role = user?.role as UserRole;
  const roleColor = ROLE_COLORS[role] ?? { bg: "#0f1425", color: "#93a7c6" };

  return (
    <div style={sectionStyle}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 18 }}>
        Mi perfil
      </p>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={1}
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Rol</label>
          <span style={{
            display: "inline-block",
            background: roleColor.bg,
            color: roleColor.color,
            padding: "4px 10px",
            borderRadius: 5,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <button
            type="submit"
            disabled={saving || !dirty}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              background: "var(--color-accent)", color: "#000",
              fontSize: 13, fontWeight: 600,
              cursor: (saving || !dirty) ? "not-allowed" : "pointer",
              opacity: (saving || !dirty) ? 0.5 : 1,
            }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            style={{
              padding: "7px 16px", borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "none", color: "var(--color-text-secondary)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            Cambiar contraseña
          </button>
        </div>
      </form>

      {showPasswordModal && user && (
        <ChangePasswordModal userId={user.id} onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

// ─── Section 2: Mis Preferencias ──────────────────────────────────────────

function SectionPreferencias() {
  const { data: settings = [], isLoading } = useQuery<UserSetting[]>({
    queryKey: ["user-settings"],
    queryFn: () => apiClient.get<UserSetting[]>("/api/settings/user/me").then(r => r.data),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const current = { ...settingsMap, ...values };

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (changed: { key: string; value: string }[]) =>
      apiClient.patch("/api/settings/user/me", changed),
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      setValues({});
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al guardar preferencias");
    },
  });

  function setValue(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    const changed = Object.entries(values).map(([key, value]) => ({ key, value }));
    if (changed.length === 0) { toast("Sin cambios"); return; }
    save(changed);
  }

  if (isLoading) return (
    <div style={sectionStyle}>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Cargando preferencias...</p>
    </div>
  );

  return (
    <div style={sectionStyle}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 18 }}>
        Mis preferencias
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {Object.entries(USER_PREF_META).map(([key, meta]) => {
          const val = current[key] ?? "";
          return (
            <div key={key}>
              <label style={labelStyle}>{meta.label}</label>
              {meta.type === "toggle" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setValue(key, val === "true" ? "false" : "true")}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: val === "true" ? "var(--color-accent)" : "var(--color-border)",
                      border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: val === "true" ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#fff", transition: "left 0.2s",
                    }} />
                  </button>
                  <span style={{ fontSize: 12, color: val === "true" ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                    {val === "true" ? "Activadas" : "Desactivadas"}
                  </span>
                </div>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={val}
                  onChange={e => setValue(key, e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {meta.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || Object.keys(values).length === 0}
        style={{
          marginTop: 22,
          padding: "7px 16px", borderRadius: 6, border: "none",
          background: "var(--color-accent)", color: "#000",
          fontSize: 13, fontWeight: 600,
          cursor: (saving || Object.keys(values).length === 0) ? "not-allowed" : "pointer",
          opacity: (saving || Object.keys(values).length === 0) ? 0.5 : 1,
        }}
      >
        {saving ? "Guardando..." : "Guardar preferencias"}
      </button>
    </div>
  );
}

// ─── Section 3: Notificaciones de proyecto (G.3) ──────────────────────────

function NotificationCheckbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
    </label>
  );
}

function SectionNotificaciones() {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  useEffect(() => { if (prefs) setLocal(prefs); }, [prefs]);

  const dirty = !!(prefs && local && JSON.stringify(prefs) !== JSON.stringify(local));

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => {
      if (!local) throw new Error("no prefs");
      const { id: _id, userId: _u, ...rest } = local;
      void _id; void _u;
      return updateNotificationPreferences(rest);
    },
    onSuccess: (data) => {
      qc.setQueryData(["notification-preferences"], data);
      setLocal(data);
      toast.success("Preferencias de notificación guardadas");
    },
    onError: () => toast.error("Error al guardar preferencias"),
  });

  if (isLoading || !local) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Cargando preferencias...</p>
      </div>
    );
  }

  function set<K extends keyof NotificationPreferences>(k: K, v: NotificationPreferences[K]) {
    setLocal((p) => (p ? { ...p, [k]: v } : p));
  }

  return (
    <div style={sectionStyle}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 18 }}>
        Notificaciones de proyecto
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Bloque 1: deadline warning */}
        <div>
          <NotificationCheckbox
            label="Recibir alerta 3 días antes de un deadline"
            checked={local.deadlineWarning}
            onChange={(v) => set("deadlineWarning", v)}
          />
          <div style={{ marginTop: 8, marginLeft: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Canales
            </p>
            <NotificationCheckbox label="In-app" checked={local.deadlineWarningInApp} onChange={(v) => set("deadlineWarningInApp", v)} disabled={!local.deadlineWarning} />
            <NotificationCheckbox label="Email" checked={local.deadlineWarningEmail} onChange={(v) => set("deadlineWarningEmail", v)} disabled={!local.deadlineWarning} />
            <NotificationCheckbox label="WhatsApp" checked={local.deadlineWarningWhatsapp} onChange={(v) => set("deadlineWarningWhatsapp", v)} disabled={!local.deadlineWarning} />
          </div>
        </div>

        {/* Bloque 2: subetapa anterior completada */}
        <div>
          <NotificationCheckbox
            label="Recibir aviso cuando se completa una subetapa anterior a la mía"
            checked={local.prevSubstageCompleted}
            onChange={(v) => set("prevSubstageCompleted", v)}
          />
          <div style={{ marginTop: 8, marginLeft: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Canales
            </p>
            <NotificationCheckbox label="In-app" checked={local.prevSubstageCompletedInApp} onChange={(v) => set("prevSubstageCompletedInApp", v)} disabled={!local.prevSubstageCompleted} />
            <NotificationCheckbox label="Email" checked={local.prevSubstageCompletedEmail} onChange={(v) => set("prevSubstageCompletedEmail", v)} disabled={!local.prevSubstageCompleted} />
            <NotificationCheckbox label="WhatsApp" checked={local.prevSubstageCompletedWhatsapp} onChange={(v) => set("prevSubstageCompletedWhatsapp", v)} disabled={!local.prevSubstageCompleted} />
          </div>
        </div>
      </div>

      <button
        onClick={() => save()}
        disabled={saving || !dirty}
        style={{
          marginTop: 22,
          padding: "7px 16px", borderRadius: 6, border: "none",
          background: "var(--color-accent)", color: "#000",
          fontSize: 13, fontWeight: 600,
          cursor: (saving || !dirty) ? "not-allowed" : "pointer",
          opacity: (saving || !dirty) ? 0.5 : 1,
        }}
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>

      <p style={{ marginTop: 14, fontSize: 11, color: "var(--color-text-muted)" }}>
        Para recibir notificaciones por WhatsApp tu usuario debe tener un teléfono cargado.
      </p>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────

export function Settings() {
  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, fontFamily: "var(--font-display)" }}>
          Configuración
        </h1>
        <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
          Gestioná tu perfil y preferencias personales
        </p>
      </div>

      <SectionPerfil />
      <SectionPreferencias />
      <SectionNotificaciones />
    </div>
  );
}
