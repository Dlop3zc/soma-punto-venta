import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';

interface OrderNameModalProps {
  title: string;
  confirmLabel: string;
  initialName?: string;
  excludeOrderId?: string; // al renombrar, no contar la propia cuenta como duplicada
  onConfirm: (name: string) => Promise<void> | void;
  onClose: () => void;
}

const QUICK_NAMES = ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Barra', 'Para llevar'];

// Se monta solo cuando está abierto, así el estado se reinicia cada vez.
export default function OrderNameModal({ title, confirmLabel, initialName = '', excludeOrderId, onConfirm, onClose }: OrderNameModalProps) {
  const orders = useCartStore(s => s.orders);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const takenNames = new Set(
    orders.filter(o => o.id !== excludeOrderId).map(o => o.name.trim().toLowerCase())
  );
  const isDuplicate = takenNames.has(trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !isDuplicate && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  // Portal: el panel del carrito usa `transform`, lo que encerraría un modal `fixed` dentro de él
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-zinc-400 font-medium mb-2">Nombre de la cuenta (mesa o cliente)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder="Ej. Mesa 4, Juan, Terraza 2"
              className="w-full bg-zinc-800 border-2 border-zinc-700 text-white text-2xl font-bold rounded-xl py-4 px-4 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {isDuplicate && (
              <p className="text-amber-400 text-sm mt-2">Ya hay una cuenta abierta con ese nombre.</p>
            )}
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_NAMES.filter(n => !takenNames.has(n.toLowerCase())).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setName(n)}
                className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border-t border-zinc-800">
          <button
            type="submit"
            disabled={!canSave}
            className={`w-full py-4 rounded-xl text-xl font-bold transition-colors ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {saving ? 'Guardando...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
