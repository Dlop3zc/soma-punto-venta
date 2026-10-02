import { useCartStore, type Order, type PaidOrder } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';
import KitchenTimer from './KitchenTimer';

export default function KitchenView() {
  const { orders, paidOrders, lastCutTime, markAsReady } = useCartStore();
  const { activeUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');

  // Pendientes: ordenes que tienen al menos un item 'preparando'
  const kitchenOrders = orders.filter(o => 
    o.items.some(item => item.status === 'preparando')
  );

  // Historial: items 'listo' de orders y paidOrders cuyo finishedAt es mayor a lastCutTime
  const historyItems: { orderName: string; waiter: string; name: string; quantity: number; finishedAt: number; timeTaken: number }[] = [];
  
  const extractHistory = (o: Order | PaidOrder) => {
    o.items.forEach(item => {
      if (item.status === 'listo' && item.finishedAt && item.finishedAt >= lastCutTime) {
        historyItems.push({
          orderName: o.name,
          waiter: o.waiter,
          name: item.name,
          quantity: item.quantity,
          finishedAt: item.finishedAt,
          timeTaken: item.finishedAt - (item.sentToKitchenAt || item.finishedAt)
        });
      }
    });
  };

  orders.forEach(extractHistory);
  paidOrders.forEach(extractHistory);

  // Ordenar historial por más reciente
  historyItems.sort((a, b) => b.finishedAt - a.finishedAt);

  return (
    <div className="flex-1 h-full bg-zinc-900 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>👨‍🍳</span> Vista Por Cocinar
          </h1>
          <div className="text-zinc-400 font-medium">
            {kitchenOrders.length} orden(es) pendiente(s)
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('pendientes')}
            className={`px-6 py-2 rounded-xl font-bold transition-colors ${
              activeTab === 'pendientes'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`px-6 py-2 rounded-xl font-bold transition-colors ${
              activeTab === 'historial'
                ? 'bg-zinc-200 text-black shadow-lg shadow-zinc-200/20'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            Historial de Hoy
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'pendientes' && (
          <>
            {kitchenOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                <span className="text-6xl">🍽️</span>
                <p className="text-2xl font-medium">No hay órdenes pendientes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {kitchenOrders.map(order => {
                  const preparingItems = order.items.filter(item => item.status === 'preparando');

                  return (
                    <div 
                      key={order.id} 
                      className="bg-zinc-800 rounded-2xl overflow-hidden flex flex-col border border-zinc-700 shadow-xl"
                    >
                      <div className="p-4 bg-orange-600/20 border-b border-orange-500/30 flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold text-white">{order.name}</h2>
                          <p className="text-orange-400 text-sm font-medium">👤 {order.waiter}</p>
                        </div>
                        <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full font-bold">
                          Pendiente
                        </span>
                      </div>
                      
                      <div className="flex-1 p-4 overflow-y-auto min-h-[150px]">
                        <ul className="space-y-4">
                          {preparingItems.map(item => (
                            <li key={item.cartItemId} className="flex justify-between items-start border-b border-zinc-700/50 pb-3 last:border-0">
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-100 text-lg">{item.quantity}x</span>
                                  <span className="text-zinc-300 text-lg">{item.name}</span>
                                </div>
                                {item.note && (
                                  <span className="text-amber-300 font-bold">📝 {item.note}</span>
                                )}
                                <KitchenTimer sentAt={item.sentToKitchenAt} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {activeUser?.role !== 'waiter' && (
                        <div className="p-4 bg-zinc-900 border-t border-zinc-700">
                          <button
                            onClick={() => markAsReady(order.id)}
                            className="w-full py-4 rounded-xl text-xl font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <span>✅</span> Orden Lista
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'historial' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Platillos Preparados Hoy</h2>
              <span className="text-zinc-400">{historyItems.length} items</span>
            </div>
            
            {historyItems.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 font-medium">
                No hay historial de platillos terminados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-400 text-sm">
                      <th className="p-4 font-medium border-b border-zinc-800">Hora</th>
                      <th className="p-4 font-medium border-b border-zinc-800">Platillo</th>
                      <th className="p-4 font-medium border-b border-zinc-800">Cuenta</th>
                      <th className="p-4 font-medium border-b border-zinc-800">Mesero</th>
                      <th className="p-4 font-medium border-b border-zinc-800">Tiempo Prep.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((item, idx) => {
                      const m = Math.floor(item.timeTaken / 60000);
                      const s = Math.floor((item.timeTaken % 60000) / 1000);
                      const isLate = item.timeTaken > 900000; // > 15 minutos

                      return (
                        <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="p-4 text-zinc-300">
                            {new Date(item.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-white font-medium">
                            <span className="text-emerald-400 mr-2">{item.quantity}x</span>
                            {item.name}
                          </td>
                          <td className="p-4 text-zinc-400">{item.orderName}</td>
                          <td className="p-4 text-zinc-400">{item.waiter}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                              isLate ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-800 text-zinc-300'
                            }`}>
                              {m}:{s.toString().padStart(2, '0')} min
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
