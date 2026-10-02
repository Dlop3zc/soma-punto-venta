import { useState, useEffect } from 'react';
import { useCartStore, type CartItem } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { Minus, Plus, Trash2, Pencil, StickyNote } from 'lucide-react';
import OrderTabs from './OrderTabs';
import OrderNameModal from './OrderNameModal';

export default function Cart() {
  const {
    orders, activeOrderId, updateQuantity, sendToKitchen, renameOrder,
    deleteEmptyOrder, setItemNote, removeSentItem,
  } = useCartStore();
  const isAdmin = useAuthStore(s => s.activeUser?.role === 'admin');
  const getRecord = useInventoryStore(s => s.getRecord);

  const [isRenaming, setIsRenaming] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const activeOrder = orders.find(o => o.id === activeOrderId);
  const cartItems = activeOrder?.items || [];
  const total = activeOrder?.total || 0;

  const hasNewItems = cartItems.some(item => item.status === 'nuevo');

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ocurrió un error.');
    }
  };

  const handleIncrement = (item: CartItem) => run(async () => {
    const result = await updateQuantity(item.cartItemId, 1);
    if (result === 'out-of-stock') setMessage(`${item.name}: sin existencias`);
  });

  // Productos ya enviados a cocina: solo el admin puede quitarlos
  const handleRemoveSent = (item: CartItem) => {
    if (!activeOrder) return;
    const label = item.status === 'listo' ? 'ya fue entregado' : 'ya está en cocina';
    if (!window.confirm(`"${item.name}" ${label}.\n\n¿Quitar 1 de la cuenta ${activeOrder.name}?`)) return;
    const restock = getRecord(item.id).tracked
      && window.confirm('¿Regresar esa pieza al inventario?\n\nAceptar = sí (no se usó)\nCancelar = no (se desperdició)');
    run(() => removeSentItem(activeOrder.id, item.cartItemId, 1, restock));
  };

  const handleDeleteOrder = () => {
    if (!activeOrder) return;
    if (!window.confirm(`¿Eliminar la cuenta vacía "${activeOrder.name}"?`)) return;
    run(() => deleteEmptyOrder(activeOrder.id));
  };

  const startNoteEdit = (item: CartItem) => {
    setEditingNoteId(item.cartItemId);
    setNoteDraft(item.note || '');
  };

  const saveNote = (cartItemId: string) => {
    setEditingNoteId(null);
    run(() => setItemNote(cartItemId, noteDraft));
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 relative">
      {/* Order Tabs Section */}
      <OrderTabs />

      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <h2 className="text-3xl font-bold text-zinc-100 flex-1 truncate">
          {activeOrder ? activeOrder.name : 'Cuenta Actual'}
        </h2>
        {activeOrder && (
          <>
            <button
              onClick={() => setIsRenaming(true)}
              className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Cambiar nombre"
            >
              <Pencil size={20} />
            </button>
            {cartItems.length === 0 && (
              <button
                onClick={handleDeleteOrder}
                className="p-3 rounded-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-colors"
                title="Eliminar cuenta vacía"
              >
                <Trash2 size={20} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeOrder ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xl font-medium text-center px-4">
            No hay ninguna cuenta abierta.<br/>Presiona + o elige un producto para abrir una.
          </div>
        ) : cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-500 text-xl font-medium">
            La orden está vacía
            <button
              onClick={handleDeleteOrder}
              className="text-base px-4 py-2 rounded-xl bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-400 transition-colors"
            >
              Eliminar cuenta
            </button>
          </div>
        ) : (
          cartItems.map((item) => {
            const isNew = item.status === 'nuevo';
            const canDecrease = isNew || isAdmin;

            return (
              <div key={item.cartItemId} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-zinc-100">{item.name}</h3>
                      {item.status === 'preparando' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30">
                          Por Cocinar
                        </span>
                      )}
                      {item.status === 'listo' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Listo
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-400 font-medium">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => isNew ? run(() => updateQuantity(item.cartItemId, -1)) : handleRemoveSent(item)}
                      disabled={!canDecrease}
                      title={isNew ? undefined : 'Quitar producto enviado (admin)'}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        !canDecrease
                          ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed'
                          : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {item.quantity === 1 ? <Trash2 className={canDecrease ? "text-red-400" : ""} size={24} /> : <Minus size={24} />}
                    </button>
                    <span className="text-2xl font-bold w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleIncrement(item)}
                      disabled={!isNew}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                        !isNew
                          ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed shadow-none'
                          : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white'
                      }`}
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                </div>

                {/* Nota para cocina */}
                {editingNoteId === item.cartItemId ? (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => { e.preventDefault(); saveNote(item.cartItemId); }}
                  >
                    <input
                      autoFocus
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      maxLength={80}
                      placeholder="Ej. sin hielo, extra limón"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <button type="submit" className="px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">
                      OK
                    </button>
                  </form>
                ) : item.note ? (
                  <button
                    onClick={() => isNew && startNoteEdit(item)}
                    className={`mt-2 text-sm text-amber-300 flex items-center gap-1 text-left ${isNew ? 'hover:underline' : 'cursor-default'}`}
                  >
                    <StickyNote size={14} /> {item.note}
                  </button>
                ) : isNew && (
                  <button
                    onClick={() => startNoteEdit(item)}
                    className="mt-2 text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                  >
                    <StickyNote size={14} /> Agregar nota
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Total */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800 flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-2xl text-zinc-400 font-medium">Total</span>
          <span className="text-5xl font-bold text-white">${total.toFixed(2)}</span>
        </div>

        <button
          onClick={() => activeOrder && run(() => sendToKitchen(activeOrder.id))}
          disabled={!hasNewItems}
          className={`w-full py-4 rounded-2xl text-2xl font-bold transition-all ${
            !hasNewItems
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white shadow-lg shadow-orange-600/20'
          }`}
        >
          🔥 Por Cocinar
        </button>
      </div>

      {message && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white font-bold px-6 py-3 rounded-xl shadow-2xl whitespace-nowrap">
          {message}
        </div>
      )}

      {isRenaming && activeOrder && (
        <OrderNameModal
          title="Cambiar nombre"
          confirmLabel="Guardar"
          initialName={activeOrder.name}
          excludeOrderId={activeOrder.id}
          onConfirm={(name) => renameOrder(activeOrder.id, name)}
          onClose={() => setIsRenaming(false)}
        />
      )}
    </div>
  );
}
