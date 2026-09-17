import { useCartStore } from '../store/useCartStore';
import { Minus, Plus, Trash2 } from 'lucide-react';
import OrderTabs from './OrderTabs';

interface CartProps {
  onCheckout: () => void;
}

export default function Cart({ onCheckout }: CartProps) {
  const { orders, activeOrderId, updateQuantity } = useCartStore();
  
  const activeOrder = orders.find(o => o.id === activeOrderId);
  const cartItems = activeOrder?.items || [];
  const total = activeOrder?.total || 0;

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
            <div key={item.id} className="bg-zinc-900 p-4 rounded-xl flex items-center justify-between border border-zinc-800">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-zinc-100">{item.name}</h3>
                <p className="text-emerald-400 font-medium">${item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-full flex items-center justify-center text-zinc-300 transition-colors"
                >
                  {item.quantity === 1 ? <Trash2 className="text-red-400" size={24} /> : <Minus size={24} />}
                </button>
                <span className="text-2xl font-bold w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-12 h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Total */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800">
        <div className="flex justify-between items-end mb-6">
          <span className="text-2xl text-zinc-400 font-medium">Total</span>
          <span className="text-5xl font-bold text-white">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={!activeOrder || cartItems.length === 0}
          className={`w-full py-6 rounded-2xl text-3xl font-bold uppercase tracking-wider transition-all ${
            !activeOrder || cartItems.length === 0
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-xl shadow-emerald-500/20'
          }`}
        >
          Cobrar
        </button>
      </div>
    </div>
  );
}
