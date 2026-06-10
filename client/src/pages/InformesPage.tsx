import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import type { InformeBox } from "../api/informes.api";
import { useAuthStore } from "../store/auth.store";
import { usePermission } from "../hooks/usePermission";
import { useInforme, useInformesList } from "../hooks/useInformes";
import { InformesListSidebar } from "../modules/informes/components/InformesListSidebar";
import { InformeDocument } from "../modules/informes/components/InformeDocument";
import { InformeReviewPanel } from "../modules/informes/components/InformeReviewPanel";
import { InformeCreateModal } from "../modules/informes/components/InformeCreateModal";

export default function InformesPage() {
  const user = useAuthStore((s) => s.user);
  const canCreate = usePermission("INFORMES", "CREATE");
  const isAdmin = user?.role === "ADMIN";

  const [box, setBox] = useState<InformeBox>("recibidos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "nuevo" | "editar">(null);

  const { data: informes = [], isLoading } = useInformesList({
    box,
    search: debouncedSearch || undefined,
  });
  const { data: informe } = useInforme(selectedId);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Si el seleccionado deja de estar en la lista (cambió de box/filtro), lo deseleccionamos.
  useEffect(() => {
    if (selectedId && !isLoading && !informes.some((i) => i.id === selectedId)) {
      setSelectedId(null);
    }
  }, [informes, isLoading, selectedId]);

  return (
    <div className="-mx-6 -mt-6 -mb-10 flex h-[calc(100vh-52px)] overflow-hidden">
      <InformesListSidebar
        box={box}
        onBoxChange={(b) => setBox(b)}
        search={search}
        onSearchChange={setSearch}
        informes={informes}
        loading={isLoading}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNuevo={() => setModal("nuevo")}
        canCreate={canCreate}
        showTodos={isAdmin}
      />

      <main className="flex-1 overflow-y-auto bg-[var(--color-bg-app)]">
        {!informe ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Elegí un informe de la lista</p>
          </div>
        ) : (
          <InformeDocument
            informe={informe}
            onEditar={() => setModal("editar")}
            onBorrado={() => setSelectedId(null)}
          />
        )}
      </main>

      {informe && informe.estado !== "BORRADOR" && user && (
        <InformeReviewPanel informe={informe} currentUserId={user.id} />
      )}

      {modal && user && (
        <InformeCreateModal
          initial={modal === "editar" ? informe : null}
          currentUserId={user.id}
          onClose={() => setModal(null)}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
