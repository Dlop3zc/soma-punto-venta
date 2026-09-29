import { useCartStore } from '../store/useCartStore';
import { Minus, Plus, Trash2 } from 'lucide-react';
import OrderTabs from './OrderTabs';

export default function Cart() {
  const { orders, activeOrderId, updateQuantity, sendToKitchen } = useCartStore();
  
  const activeOrder = orders.find(o => o.id === activeOrderId);
  const cartItems = activeOrder?.items || [];
  const total = activeOrder?.total || 0;

  const hasNewItems = cartItems.some(item => item.status === 'nuevo');

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800">
      {/* Order Tabs Section */}
      <OrderTabs />

      <div className="p-6 border-b border-zinc-800">
        <h2 className="text-3xl font-bold text-zinc-100">
          {activeOrder ? activeOrder.name : 'Cuenta Actual'}
        </h2>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeOrder ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xl font-medium text-center px-4">
            No hay ninguna cuenta abierta.<br/>Agrega un producto o presiona + para empezar.
          </div>
        ) : cartItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xl font-medium">
            La orden está vacía
          </div>
        ) : (
          cartItems.map((item) => (
            <div key={item.cartItemId} className="bg-zinc-900 p-4 rounded-xl flex items-center justify-between border border-zinc-800">
              <div className="flex-1">
                <div className="flex items-center gap-2">
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
                  onClick={() => updateQuantity(item.cartItemId, -1)}
                  disabled={item.status !== 'nuevo'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    item.status !== 'nuevo' 
                      ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed' 
                      : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300'
                  }`}
                >
                  {item.quantity === 1 ? <Trash2 className={item.status === 'nuevo' ? "text-red-400" : ""} size={24} /> : <Minus size={24} />}
                </button>
                <span className="text-2xl font-bold w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.cartItemId, 1)}
                  disabled={item.status !== 'nuevo'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                    item.status !== 'nuevo'
                      ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white'
                  }`}
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Total */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800 flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-2xl text-zinc-400 font-medium">Total</span>
          <span className="text-5xl font-bold text-white">${total.toFixed(2)}</span>
        </div>
        
        <button
          onClick={() => sendToKitchen(activeOrder!.id)}
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
    </div>
  );
}
