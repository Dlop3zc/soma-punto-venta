import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';
import { useCartStore, type CartItem, type Order } from '../store/useCartStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { CANCELLATION_REASONS } from '../utils/cashCut';

interface CancelItemModalProps {
  order: Order;
  item: CartItem;
  onClose: () => void;
}

// Quitar un producto que ya se envió a cocina. Se monta solo cuando está abierto.
export default function CancelItemModal({ order, item, onClose }: CancelItemModalProps) {
  const cancelSentItem = useCartStore(s => s.cancelSentItem);
  const tracked = useInventoryStore(s => s.getRecord(item.id).tracked);

  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  // Si aún se estaba preparando, lo normal es que no se haya usado
  const [restock, setRestock] = useState(item.status === 'preparando');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalReason = reason === 'Otro' ? otherReason.trim() : reason;
  const canSave = !saving && finalReason.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await cancelSentItem(order.id, item.cartItemId, { quantity, reason: finalReason, restock: tracked && restock });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el producto.');
      setSaving(false);
    }
  };

  // Portal: el panel del carrito usa `transform`, lo que encerraría un modal `fixed` dentro de él
  return createPortal(
    <div className="modal-backdrop z-[60]">
      <form onSubmit={handleSubmit} className="modal-panel max-w-lg">
        <div className="p-5 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white">Quitar producto</h2>
            <p className="text-zinc-400 truncate">
              {item.name} · {order.name} · {item.status === 'listo' ? 'ya entregado' : 'en cocina'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-6 overflow-y-auto">
          {item.quantity > 1 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-lg text-zinc-300 font-medium">¿Cuántos quitar?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:text-zinc-700"
                >
                  <Minus size={22} />
                </button>
                <span className="text-2xl font-bold w-14 text-center">{quantity}<span className="text-zinc-500 text-base">/{item.quantity}</span></span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(item.quantity, q + 1))}
                  disabled={quantity >= item.quantity}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:text-zinc-700"
                >
                  <Plus size={22} />
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-lg text-zinc-300 font-medium mb-3">Motivo</p>
            <div className="grid grid-cols-2 gap-2">
              {CANCELLATION_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-3 rounded-xl font-bold text-sm transition-colors border ${
                    reason === r
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Otro' && (
              <input
                autoFocus
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={80}
                placeholder="Escribe el motivo"
                className="mt-3 w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
              />
            )}
          </div>

          {tracked && (
            <label className="flex items-start gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                className="mt-1 w-5 h-5 accent-emerald-500"
              />
              <span>
                <span className="block text-zinc-100 font-bold">Regresar al inventario</span>
                <span className="block text-zinc-400 text-sm">Márcalo si no se llegó a usar. Si ya se preparó o se sirvió, déjalo sin marcar.</span>
              </span>
            </label>
          )}

          <p className="text-sm text-zinc-500">
            Se restan ${(item.price * quantity).toFixed(2)} de la cuenta. La cancelación queda registrada en el corte de caja.
          </p>

          {error && <p className="text-red-400 font-medium">{error}</p>}
        </div>

        <div className="p-5 md:p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <button
            type="submit"
            disabled={!canSave}
            className="w-full py-4 rounded-2xl text-xl font-bold bg-red-600 hover:bg-red-500 active:bg-red-700 text-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
          >
            {saving ? 'Quitando…' : `Quitar ${quantity} de la cuenta`}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
