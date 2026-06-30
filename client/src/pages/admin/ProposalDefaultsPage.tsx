import { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { CoverSection } from "../../components/admin/proposal-defaults/CoverSection";
import { ProposalDefaultsForm } from "../../components/admin/proposal-defaults/ProposalDefaultsForm";
import { useProposalDefaults, useUpdateProposalDefaults } from "../../hooks/useProposalDefaults";
import { usePermission } from "../../hooks/usePermission";
import { useAuthStore } from "../../store/auth.store";
import type { CoverOverlay, ProposalDefaultsData } from "../../types/proposals-v2";

// Pestaña Admin → "Defaults de propuestas". Ver = VENTAS:VIEW; editar = ADMIN.
export function ProposalDefaultsPage() {
  const canView = usePermission("VENTAS", "VIEW");
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const { data: defaults, isLoading } = useProposalDefaults();
  const updateMut = useUpdateProposalDefaults();

  const [data, setData] = useState<ProposalDefaultsData>({});
  const [coverOverlay, setCoverOverlay] = useState<CoverOverlay | null>(null);

  // Inicializa el form UNA sola vez, recién cuando hay datos válidos (seeded).
  // A partir de ahí el estado local es la fuente de verdad: actualizaciones
  // posteriores de la cache (tras guardar una sección) NO pisan los inputs en
  // progreso de la otra. Ojo el orden: marcar el ref solo después de setear.
  const initialized = useRef(false);
  useEffect(() => {
    if (defaults?.seeded && !initialized.current) {
      setData(defaults.data);
      setCoverOverlay(defaults.coverOverlay);
      initialized.current = true;
    }
  }, [defaults]);

  if (!canView) {
    return <p className="text-sm text-[var(--color-text-muted)]">No tenés acceso a esta sección.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--color-text-secondary)]">
        <Spinner size={18} /> Cargando defaults…
      </div>
    );
  }

  if (!defaults?.seeded) {
    return (
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-[var(--color-text-primary)]">Defaults de propuestas</h2>
        <div className="rounded-lg border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/20 p-4 text-sm text-[var(--color-warning-text)]">
          Todavía no se cargaron los defaults. Corré el seed inicial una vez:
          <code className="ml-1 rounded bg-[var(--color-bg-app)] px-1.5 py-0.5 font-mono text-xs">
            docker compose exec server npx tsx prisma/scripts/seed-proposal-defaults.ts
          </code>
        </div>
      </div>
    );
  }

  // Cada botón guarda SOLO su sección (payload parcial → no pisa la otra en BD).
  function handleSaveData() {
    updateMut.mutate({ data });
  }
  function handleSaveCover() {
    if (!coverOverlay) return;
    updateMut.mutate({ coverOverlay });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-text-primary)]">Defaults de propuestas</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Valores y costos del generador de propuestas. El switch define si cada variable la puede
            modificar el asesor o queda fija desde administración.
          </p>
          {!isAdmin && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Solo lectura — únicamente un administrador puede editar.</p>
          )}
        </div>
        {isAdmin && (
          <Button onClick={handleSaveData} loading={updateMut.isPending}>
            Guardar cambios
          </Button>
        )}
      </div>

      <CoverSection
        coverOverlay={coverOverlay}
        coverPdfAttachmentId={defaults.coverPdfAttachmentId}
        updatedAt={defaults.updatedAt}
        isAdmin={isAdmin}
        onChangeOverlay={setCoverOverlay}
        onSaveConfig={handleSaveCover}
        savingConfig={updateMut.isPending}
      />

      <ProposalDefaultsForm data={data} onChange={setData} disabled={!isAdmin} />
    </div>
  );
}
