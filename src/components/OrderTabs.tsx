import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import OrderNameModal from './OrderNameModal';

export default function OrderTabs() {
  const { orders, activeOrderId, setActiveOrder, createOrder } = useCartStore();
  const { activeUser } = useAuthStore();
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);

  const visibleOrders = activeUser?.role === 'waiter' 
    ? orders.filter(o => o.waiter === activeUser.name)
    : orders;

  return (
    <div className="bg-zinc-950 border-b border-zinc-800 p-4 pb-0 flex gap-2 overflow-x-auto scrollbar-hide">
      {visibleOrders.map(order => {
        const isActive = activeOrderId === order.id;
        return (
          <button
            key={order.id}
            onClick={() => setActiveOrder(order.id)}
            className={`px-4 py-3 min-w-[140px] border-b-2 font-bold transition-colors text-left flex flex-col ${
              isActive 
                ? 'border-blue-500 text-blue-500 bg-blue-500/10' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span className="text-sm md:text-base truncate w-full">{order.name}</span>
            <span className={`text-xs truncate w-full ${isActive ? 'text-blue-400' : 'text-zinc-500'}`}>
              👤 {order.waiter}
            </span>
          </button>
        );
      })}
      <button
        onClick={() => setIsNameModalOpen(true)}
        className="px-4 py-3 rounded-t-xl bg-zinc-900/30 text-emerald-500 hover:bg-zinc-900 hover:text-emerald-400 transition-colors flex items-center justify-center border-t border-x border-transparent"
        title="Nueva Cuenta"
      >
        <Plus size={24} />
      </button>

      {isNameModalOpen && (
        <OrderNameModal
          title="Nueva Cuenta"
          confirmLabel="Abrir Cuenta"
          onConfirm={async (name) => { await createOrder(name); }}
          onClose={() => setIsNameModalOpen(false)}
        />
      )}
    </div>
  );
}
