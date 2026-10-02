import { useState, useEffect } from 'react';
import { useCartStore } from '../store/useCartStore';
import { Minus, Plus, Scissors, X } from 'lucide-react';

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SplitBillModal({ isOpen, onClose }: SplitBillModalProps) {
  const { orders, activeOrderId, splitOrder } = useCartStore();
  
  // Track quantities to move: { productId: quantity }
  const [selections, setSelections] = useState<Record<string, number>>({});

  const activeOrder = orders.find(o => o.id === activeOrderId);

  // Reset selections when modal opens or active order changes
  useEffect(() => {
    if (isOpen) {
      setSelections({});
    }
  }, [isOpen, activeOrderId]);

  if (!isOpen || !activeOrder || activeOrder.items.length === 0) return null;

  const handleIncrement = (productId: string, maxQuantity: number) => {
    setSelections(prev => {
      const current = prev[productId] || 0;
      if (current >= maxQuantity) return prev;
      return { ...prev, [productId]: current + 1 };
    });
  };

  const handleDecrement = (productId: string) => {
    setSelections(prev => {
      const current = prev[productId] || 0;
      if (current <= 0) return prev;
      const next = { ...prev, [productId]: current - 1 };
      if (next[productId] === 0) delete next[productId];
      return next;
    });
  };

  const handleSelectAll = (productId: string, quantity: number) => {
    setSelections(prev => ({ ...prev, [productId]: quantity }));
  };

  const itemsToMoveList = Object.entries(selections).map(([id, quantity]) => ({ id, quantity }));
  const isAnythingSelected = itemsToMoveList.length > 0;

  // Calculate totals
  const totalToMove = activeOrder.items.reduce((sum, item) => {
    const qtyToMove = selections[item.cartItemId] || 0;
    return sum + (item.price * qtyToMove);
  }, 0);
  const totalRemaining = activeOrder.total - totalToMove;

  const handleSplit = () => {
    if (isAnythingSelected) {
      splitOrder(activeOrder.id, itemsToMoveList);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Scissors size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Separar Cuenta</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 bg-zinc-900 flex-1 overflow-y-auto">
          <p className="text-zinc-400 mb-6">
            Selecciona los productos que deseas mover a una <strong className="text-white">nueva cuenta separada</strong>.
          </p>

          <div className="space-y-4">
            {activeOrder.items.map(item => {
              const selectedQty = selections[item.cartItemId] || 0;
              const isFullySelected = selectedQty === item.quantity;
              
              return (
                <div 
                  key={item.cartItemId} 
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${
                    selectedQty > 0 
                      ? 'bg-emerald-950/20 border-emerald-500/30' 
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{item.name}</h3>
                    {item.note && <p className="text-amber-300 text-sm">📝 {item.note}</p>}
                    <p className="text-zinc-500 text-sm">
                      Disponible: {item.quantity} x ${item.price.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleSelectAll(item.cartItemId, item.quantity)}
                      className={`text-sm font-bold px-3 py-1 rounded-lg transition-colors ${
                        isFullySelected 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      TODOS
                    </button>
                    
                    <div className="flex items-center gap-3 bg-zinc-800 p-1.5 rounded-xl">
                      <button 
                        onClick={() => handleDecrement(item.cartItemId)}
                        disabled={selectedQty === 0}
                        className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Minus size={20} />
                      </button>
                      <span className="w-6 text-center font-bold text-xl text-white">
                        {selectedQty}
                      </span>
                      <button 
                        onClick={() => handleIncrement(item.cartItemId, item.quantity)}
                        disabled={selectedQty === item.quantity}
                        className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-sm font-medium">Cuenta Original quedará en:</p>
            <p className="text-2xl font-bold text-zinc-300">${totalRemaining.toFixed(2)}</p>
          </div>
          
          <button
            onClick={handleSplit}
            disabled={!isAnythingSelected}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black uppercase tracking-wider transition-all ${
              isAnythingSelected
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <span>Crear Cuenta por ${totalToMove.toFixed(2)}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
