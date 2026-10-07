import { useState, useEffect } from 'react';
import { useCartStore, isSeparatedOrder, splitEqually, nextSplitShare, type SplitShare } from '../store/useCartStore';
import { Check, Minus, Plus, Scissors, Users, X } from 'lucide-react';
import CheckoutModal from './CheckoutModal';

export type SplitMode = 'productos' | 'iguales';

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 30;

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: SplitMode;
}

export default function SplitBillModal({ isOpen, onClose, initialMode = 'productos' }: SplitBillModalProps) {
  const { orders, activeOrderId, splitOrder, setSplitPeople } = useCartStore();
  
  // Track quantities to move: { productId: quantity }
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<SplitMode>('productos');
  const [people, setPeople] = useState(MIN_PEOPLE);
  // Persona que se está cobrando ahora (abre la pantalla de cobro con su parte)
  const [charging, setCharging] = useState<(SplitShare & { part: number; orderId: string }) | null>(null);

  const activeOrder = orders.find(o => o.id === activeOrderId);

  // Reset selections when modal opens or active order changes
  useEffect(() => {
    if (isOpen) {
      setSelections({});
      setMode(initialMode);
      setPeople(MIN_PEOPLE);
      setCharging(null);
    }
  }, [isOpen, activeOrderId, initialMode]);

  if (isOpen && charging) {
    return (
      <CheckoutModal
        orderId={charging.orderId}
        split={charging}
        onClose={() => {
          setCharging(null);
          // Pagó la última persona: la cuenta ya no existe
          if (!orders.some(o => o.id === charging.orderId)) onClose();
        }}
      />
    );
  }

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

  const canSplitEqually = !isSeparatedOrder(activeOrder);
  const split = activeOrder.equalSplit;
  const paidCount = split?.paidCount || 0;
  const effectivePeople = split ? split.people : people;
  const minPeople = Math.max(MIN_PEOPLE, paidCount + 1);
  const next = nextSplitShare(activeOrder, effectivePeople);
  const pendingShares = splitEqually(Math.max(0, next.remaining), next.left);
  const sameShares = pendingShares.every(s => s === pendingShares[0]);
  // Ya pagó alguien: ya no se pueden mover productos a otra cuenta
  const currentMode: SplitMode = split ? 'iguales' : mode;

  const changePeople = (n: number) => {
    const value = Math.min(MAX_PEOPLE, Math.max(minPeople, n));
    if (split) setSplitPeople(activeOrder.id, value);
    else setPeople(value);
  };

  const chargeNext = () => {
    setCharging({ orderId: activeOrder.id, people: effectivePeople, amount: next.amount, part: next.part });
  };

  const handleSplit = () => {
    if (isAnythingSelected) {
      splitOrder(activeOrder.id, itemsToMoveList);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-2xl">
        
        {/* Header */}
        <div className="px-4 py-3 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
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

        <div className="px-4 pt-4 md:px-6 bg-zinc-900 shrink-0">
          <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-xl">
            {([['productos', 'Por productos'], ['iguales', 'Partes iguales']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                disabled={!!split && value === 'productos'}
                className={`py-2.5 rounded-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  currentMode === value ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {currentMode === 'iguales' ? (
          <div className="p-4 md:p-6 bg-zinc-900 flex-1 min-h-0 overflow-y-auto">
            {canSplitEqually ? (
              <>
                <p className="text-zinc-400 mb-6">
                  {split
                    ? <>Faltan por pagar <strong className="text-white">${next.remaining.toFixed(2)}</strong> de ${activeOrder.total.toFixed(2)}. Cada persona paga con su método y su propina.</>
                    : <>Divide lo que queda en esta cuenta (<strong className="text-white">${activeOrder.total.toFixed(2)}</strong>) entre las personas de la mesa. Cada persona paga con su método y su propina.</>}
                </p>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 mb-6">
                  <div className="flex items-center gap-3 text-white">
                    <Users size={24} className="text-emerald-400" />
                    <span className="text-xl font-bold">Personas</span>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-800 p-1.5 rounded-xl">
                    <button
                      onClick={() => changePeople(effectivePeople - 1)}
                      disabled={effectivePeople <= minPeople}
                      className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Minus size={20} />
                    </button>
                    <span className="w-8 text-center font-bold text-2xl text-white">{effectivePeople}</span>
                    <button
                      onClick={() => changePeople(effectivePeople + 1)}
                      disabled={effectivePeople >= MAX_PEOPLE}
                      className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-zinc-400 text-lg font-medium">{sameShares ? 'Cada persona paga' : 'Siguiente persona paga'}</p>
                  <p className="text-5xl md:text-6xl font-black text-emerald-400">${next.amount.toFixed(2)}</p>
                  <p className="text-zinc-500 text-sm mt-1">Más su propina</p>
                </div>

                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: effectivePeople }, (_, i) => {
                    const isPaid = i < paidCount;
                    return (
                      <li
                        key={i}
                        className={`flex justify-between items-center px-3 py-2 rounded-xl border ${
                          isPaid ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <span>Persona {i + 1}</span>
                        {isPaid
                          ? <span className="flex items-center gap-1 font-bold"><Check size={16} /> Pagó</span>
                          : <span className="font-bold text-white">${pendingShares[i - paidCount].toFixed(2)}</span>}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-zinc-400 text-center py-10">
                Esta cuenta ya se separó de otra, así que no se puede dividir en partes iguales.
                Se cobra completa.
              </p>
            )}
          </div>
        ) : (
        <div className="p-4 md:p-6 bg-zinc-900 flex-1 min-h-0 overflow-y-auto">
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
        )}

        {/* Footer */}
        {currentMode === 'iguales' ? (
        <div className="p-4 md:p-6 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-zinc-500 text-sm font-medium">{split ? 'Falta por pagar:' : 'Total de la cuenta:'}</p>
            <p className="text-2xl font-bold text-zinc-300">${next.remaining.toFixed(2)}</p>
          </div>
          {canSplitEqually ? (
            <button
              onClick={chargeNext}
              disabled={next.amount <= 0}
              className="px-6 md:px-8 py-4 rounded-xl font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cobrar persona {next.part}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-8 py-4 rounded-xl font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
            >
              Cerrar
            </button>
          )}
        </div>
        ) : (
        <div className="p-4 md:p-6 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
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
        )}

      </div>
    </div>
  );
}
