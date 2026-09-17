import { useMemo } from 'react';
import { useCartStore } from '../store/useCartStore';
import { exportPaidOrdersToCSV } from '../utils/exportToCSV';

export default function PaidOrdersHistory({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { paidOrders, clearData } = useCartStore();

  const totalSales = useMemo(() => {
    return paidOrders.reduce((sum, order) => sum + order.total, 0);
  }, [paidOrders]);

  const salesByWaiter = useMemo(() => {
    const breakdown: Record<string, number> = {};
    paidOrders.forEach(order => {
      const waiter = order.waiter || 'Desconocido';
      breakdown[waiter] = (breakdown[waiter] || 0) + order.total;
    });
    return breakdown;
  }, [paidOrders]);

  const handleClearData = () => {
    if (window.confirm("⚠️ ADVERTENCIA: Estás a punto de hacer el Corte de Caja y borrar TODAS las ventas y cuentas abiertas del dispositivo.\n\n¿Ya descargaste el Reporte CSV?\n\nPresiona OK para borrar todo.")) {
      clearData();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="p-6 md:p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-zinc-100">Corte de Caja</h2>
            <p className="text-zinc-500 mt-1">Historial de cuentas pagadas</p>
          </div>
          <div className="flex items-center gap-3">
            {paidOrders.length > 0 && (
              <button 
                onClick={() => exportPaidOrdersToCSV(paidOrders)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
              >
                📊 Exportar a CSV
              </button>
            )}
            <button 
              onClick={handleClearData}
              className="px-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white font-bold rounded-xl transition-colors border border-red-500/30"
              title="Borrar todos los datos y reiniciar la caja"
            >
              Corte (Limpiar Caja)
            </button>
            <button 
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-300 transition-colors ml-2"
            >
              <span className="text-2xl font-bold">✕</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* Summary Section */}
          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-blue-400 font-medium uppercase tracking-wider text-sm mb-1">Ventas Totales</p>
              <p className="text-5xl font-black text-white">${totalSales.toFixed(2)}</p>
              <p className="text-blue-300/80 mt-2">{paidOrders.length} cuentas cobradas</p>
            </div>
            
            {Object.keys(salesByWaiter).length > 0 && (
              <div className="bg-black/40 rounded-xl p-4 w-full md:w-64 border border-white/10">
                <p className="text-zinc-400 text-xs font-bold uppercase mb-3 border-b border-white/10 pb-2">Por Mesero</p>
                <div className="space-y-2">
                  {Object.entries(salesByWaiter).map(([waiter, total]) => (
                    <div key={waiter} className="flex justify-between items-center">
                      <span className="text-zinc-300 font-medium flex items-center gap-2">
                        <span className="text-xs">👤</span> {waiter}
                      </span>
                      <span className="text-white font-bold">${total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tickets List */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-zinc-300 mb-4 px-2">Cuentas Recientes</h3>
            
            {paidOrders.length === 0 ? (
              <div className="text-center py-12 bg-zinc-800/20 rounded-2xl border border-zinc-800 border-dashed">
                <p className="text-zinc-500 text-lg">No hay cuentas pagadas aún</p>
              </div>
            ) : (
              paidOrders.map((order) => (
                <div key={order.id} className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-zinc-800 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-zinc-100">{order.name}</h3>
                      <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded-md font-bold">
                        👤 {order.waiter}
                      </span>
                    </div>
                    <p className="text-zinc-400">
                      {order.items.reduce((acc, item) => acc + item.quantity, 0)} artículos • {new Date(order.paidAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    
                    {order.paymentMethod === 'Efectivo' && order.cashTendered !== undefined && order.change !== undefined && (
                      <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-700">
                        <span className="text-zinc-400">Recibido: <span className="text-zinc-200">${order.cashTendered.toFixed(2)}</span></span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-zinc-400">Cambio: <span className="text-emerald-400">${order.change.toFixed(2)}</span></span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
                      order.paymentMethod === 'Efectivo' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {order.paymentMethod}
                    </span>
                    <span className="text-3xl font-bold text-white w-32 text-right">
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            ).reverse()}
          </div>
          
        </div>
      </div>
    </div>
  );
}
