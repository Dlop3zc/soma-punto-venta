import { useMemo, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function DashboardView() {
  const { paidOrders } = useCartStore();
  
  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return paidOrders.filter(order => {
      const orderDate = new Date(order.paidAt);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      
      return true;
    });
  }, [paidOrders, startDate, endDate]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + order.total, 0);
  }, [filteredOrders]);

  const totalTips = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + (order.tip || 0), 0);
  }, [filteredOrders]);

  const totalTickets = filteredOrders.length;
  const averageTicket = totalTickets > 0 ? totalRevenue / totalTickets : 0;

  // Chart 1: Sales over time (group by hour if same day, or by day)
  // For simplicity, let's just group by formatted date/time (e.g., DD/MM HH:mm)
  const salesData = useMemo(() => {
    const grouped = filteredOrders.reduce((acc, order) => {
      const date = new Date(order.paidAt);
      const label = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:00`;
      if (!acc[label]) {
        acc[label] = { name: label, total: 0 };
      }
      acc[label].total += order.total;
      return acc;
    }, {} as Record<string, { name: string; total: number }>);

    return Object.values(grouped);
  }, [filteredOrders]);

  // Chart 2: Top Selling Products
  const topProductsData = useMemo(() => {
    const productCounts = filteredOrders.reduce((acc, order) => {
      order.items.forEach(item => {
        if (!acc[item.name]) {
          acc[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        acc[item.name].quantity += item.quantity;
        acc[item.name].revenue += item.price * item.quantity;
      });
      return acc;
    }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

    // Sort by quantity descending and take top 5
    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredOrders]);

  return (
    <div className="flex-1 h-full bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>📊</span> Dashboard de Ventas
          </h1>
          <p className="text-zinc-400 mt-1">Análisis de rendimiento y ventas</p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-xl border border-zinc-700/50 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm font-medium ml-2">Desde:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-900 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm font-medium ml-2">Hasta:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-900 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="ml-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded-md transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500 text-6xl">
              💰
            </div>
            <p className="text-zinc-400 font-medium mb-1">Ingresos Totales</p>
            <h2 className="text-4xl font-bold text-emerald-400">${totalRevenue.toFixed(2)}</h2>
          </div>
          
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-sky-500 text-6xl">
              🤝
            </div>
            <p className="text-zinc-400 font-medium mb-1">Propinas</p>
            <h2 className="text-4xl font-bold text-sky-300">${totalTips.toFixed(2)}</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-500 text-6xl">
              🧾
            </div>
            <p className="text-zinc-400 font-medium mb-1">Tickets Pagados</p>
            <h2 className="text-4xl font-bold text-blue-400">{totalTickets}</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-500 text-6xl">
              📈
            </div>
            <p className="text-zinc-400 font-medium mb-1">Ticket Promedio</p>
            <h2 className="text-4xl font-bold text-purple-400">${averageTicket.toFixed(2)}</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-500 text-6xl">
              ⏱️
            </div>
            <p className="text-zinc-400 font-medium mb-1">Tiempo Promedio (min)</p>
            <h2 className="text-4xl font-bold text-orange-400">
              {(() => {
                let totalTime = 0;
                let count = 0;
                filteredOrders.forEach(o => {
                  o.items.forEach(i => {
                    if (i.finishedAt && i.sentToKitchenAt) {
                      totalTime += (i.finishedAt - i.sentToKitchenAt);
                      count++;
                    }
                  });
                });
                if (count === 0) return "0:00";
                const avgSeconds = Math.floor((totalTime / count) / 1000);
                const m = Math.floor(avgSeconds / 60);
                const s = avgSeconds % 60;
                return `${m}:${s.toString().padStart(2, '0')}`;
              })()}
            </h2>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg min-h-[400px] flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6">Tendencia de Ventas (por hora)</h3>
            <div className="flex-1 w-full h-[300px]">
              {salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#34d399' }}
                      formatter={(value: any) => [`$${value.toFixed(2)}`, 'Ventas']}
                    />
                    <Line type="monotone" dataKey="total" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </div>

          {/* Top Products Chart */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg min-h-[400px] flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6">Top 5 Productos Vendidos</h3>
            <div className="flex-1 w-full h-[300px]">
              {topProductsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                    <XAxis type="number" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#27272a' }}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                      formatter={(value: any, name: any) => [value, name === 'quantity' ? 'Vendidos' : name]}
                    />
                    <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
