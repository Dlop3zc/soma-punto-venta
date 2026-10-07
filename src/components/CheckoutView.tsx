import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePrinterStore, selectCanPrint } from '../store/usePrinterStore';
import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import SplitBillModal, { type SplitMode } from './SplitBillModal';

export default function CheckoutView() {
  const { orders, setActiveOrder, deleteEmptyOrder } = useCartStore();
  const { activeUser } = useAuthStore();
  const printPreBill = usePrinterStore(s => s.printPreBill);
  const canPrint = usePrinterStore(selectCanPrint);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [splitBillOrderId, setSplitBillOrderId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('productos');

  // Consider all open accounts, filter if waiter
  const openOrders = activeUser?.role === 'waiter' 
    ? orders.filter(o => o.waiter === activeUser.name)
    : orders;

  const handleCheckout = (orderId: string) => {
    setActiveOrder(orderId);
    setCheckoutOrderId(orderId);
  };

  const handleSplitBill = (orderId: string, mode: SplitMode = 'productos') => {
    setActiveOrder(orderId);
    setSplitMode(mode);
    setSplitBillOrderId(orderId);
  };

  const handleDelete = async (orderId: string, name: string) => {
    if (!window.confirm(`¿Eliminar la cuenta vacía "${name}"?`)) return;
    try {
      await deleteEmptyOrder(orderId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
    }
  };

  const handlePreBill = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setPrintingId(orderId);
    const ok = await printPreBill(order);
    setPrintingId(null);
    if (!ok) window.alert(usePrinterStore.getState().lastError || 'No se pudo imprimir.');
  };

  return (
    <div className="flex-1 h-full bg-zinc-900 flex flex-col overflow-hidden">
      <div className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">
          <span>💰</span> Módulo de Caja
        </h1>
        <div className="text-zinc-400 font-medium text-sm md:text-base whitespace-nowrap">
          {openOrders.length} abierta{openOrders.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {openOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
            <span className="text-6xl">🧾</span>
            <p className="text-2xl font-medium">No hay cuentas abiertas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {openOrders.map(order => (
              <div 
                key={order.id} 
                className="bg-zinc-800 rounded-2xl overflow-hidden flex flex-col border border-zinc-700 shadow-xl"
              >
                <div className="p-4 bg-blue-600/20 border-b border-blue-500/30 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-white">{order.name}</h2>
                    <p className="text-blue-400 text-sm font-medium">👤 {order.waiter}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Total</p>
                      <p className="text-xl font-bold text-emerald-400">${order.total.toFixed(2)}</p>
                    </div>
                    {order.items.length === 0 && (
                      <button
                        onClick={() => handleDelete(order.id, order.name)}
                        className="p-2 rounded-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-colors"
                        title="Eliminar cuenta vacía"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto min-h-[150px]">
                  <ul className="space-y-3">
                    {order.items.map(item => (
                      <li key={item.cartItemId} className="flex justify-between items-start border-b border-zinc-700/50 pb-2 last:border-0">
                        <div className="flex-1">
                          <span className="font-bold text-zinc-100">{item.quantity}x</span>
                          <span className="text-zinc-300 ml-2">{item.name}</span>
                          {item.note && <div className="text-xs text-amber-300 mt-1">📝 {item.note}</div>}
                          <div className="text-xs text-zinc-500 mt-1">
                            {item.status === 'nuevo' && 'Tomando orden...'}
                            {item.status === 'preparando' && 'En cocina...'}
                            {item.status === 'listo' && 'Entregado'}
                          </div>
                        </div>
                        <span className="font-medium text-emerald-400/80">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-4 bg-zinc-900 border-t border-zinc-700 flex flex-col gap-3">
                  <button
                    onClick={() => handleSplitBill(order.id)}
                    disabled={order.items.length === 0}
                    className={`w-full py-3 rounded-xl text-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                      order.items.length === 0
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    <span>✂️</span> Separar Cuenta
                  </button>
                  {canPrint && (
                    <button
                      onClick={() => handlePreBill(order.id)}
                      disabled={order.items.length === 0 || printingId === order.id}
                      className="w-full py-3 rounded-xl text-lg font-bold transition-colors flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Printer size={20} /> {printingId === order.id ? 'Imprimiendo...' : 'Imprimir Pre-cuenta'}
                    </button>
                  )}
                  {order.equalSplit ? (
                    <button
                      onClick={() => handleSplitBill(order.id, 'iguales')}
                      className="w-full py-4 rounded-xl text-xl font-bold transition-colors flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                    >
                      <span>💳</span> Cobrar partes ({order.equalSplit.paidCount}/{order.equalSplit.people} pagaron)
                    </button>
                  ) : (
                  <button
                    onClick={() => handleCheckout(order.id)}
                    disabled={order.items.length === 0}
                    className={`w-full py-4 rounded-xl text-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                      order.items.length === 0
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    <span>💳</span> Cobrar Total
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {checkoutOrderId && (
        <CheckoutModal
          orderId={checkoutOrderId}
          onClose={() => setCheckoutOrderId(null)}
        />
      )}

      <SplitBillModal
        isOpen={!!splitBillOrderId}
        initialMode={splitMode}
        onClose={() => setSplitBillOrderId(null)}
      />
    </div>
  );
}
