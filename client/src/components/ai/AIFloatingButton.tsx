import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { AIAssistantPanel } from './AIAssistantPanel';

/** Botón flotante violeta abajo a la derecha. Sólo visible para usuarios ADMIN. */
export function AIFloatingButton() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente IA"
        title="Asistente Voltia"
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-colors"
      >
        <Sparkles className="w-5 h-5" />
      </button>
      {open && <AIAssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
}
