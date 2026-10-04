import { useMemo, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import type { Product } from '../data/defaultMenu';
import { useMenuStore } from '../store/useMenuStore';
import { useCartStore } from '../store/useCartStore';
import { useInventoryStore, DEFAULT_INVENTORY, type InventoryRecord } from '../store/useInventoryStore';
import { getAvailability, reservedQuantity, LOW_STOCK_THRESHOLD, type AvailabilityStatus } from '../utils/stock';

type Filter = 'todos' | 'alertas' | 'controlados';

const STATUS_STYLE: Record<AvailabilityStatus, { label: string; className: string }> = {
  ok: { label: 'Disponible', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  low: { label: 'Stock bajo', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  out: { label: 'Agotado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  disabled: { label: 'No disponible', className: 'bg-zinc-700 text-zinc-300 border-zinc-600' },
};

export default function InventoryView() {
  const orders = useCartStore(s => s.orders);
  const { inventory, setStock, adjustStock, setTracked, setAvailable } = useInventoryStore();
  const { products, categories: menuCategories } = useMenuStore();
  const categories = ['Todo', ...menuCategories];
  const [category, setCategory] = useState('Todo');
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => products.map(product => {
    const record = inventory[product.id] ?? DEFAULT_INVENTORY;
    const reserved = reservedQuantity(orders, product.id);
    return { product, record, reserved, availability: getAvailability(record, reserved) };
  }), [products, inventory, orders]);

  const visible = rows.filter(({ product, record, availability }) => {
    if (category !== 'Todo' && product.category !== category) return false;
    if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'alertas') return availability.status !== 'ok';
    if (filter === 'controlados') return record.tracked;
    return true;
  });

  const alertCount = rows.filter(r => r.availability.status !== 'ok').length;

  const run = async (action: Promise<void>) => {
    try {
      setError(null);
      await action;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    }
  };

  const handleStockInput = (product: Product, value: string) => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 0) run(setStock(product.id, n));
  };

  // Controles de existencia (se usan en la tabla y en las tarjetas de teléfono)
  const stockEditor = (product: Product, record: InventoryRecord, reserved: number) => (
    record.tracked ? (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => run(adjustStock(product.id, -1))}
          disabled={record.stock <= 0}
          className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <input
          key={record.stock}
          type="number"
          min={0}
          defaultValue={Math.max(0, record.stock)}
          onBlur={(e) => e.target.value !== String(Math.max(0, record.stock)) && handleStockInput(product, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-center font-bold focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => run(adjustStock(product.id, 1))}
          className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => {
            const value = window.prompt(`¿Cuántas piezas de "${product.name}" llegaron?`);
            const n = value ? parseInt(value, 10) : NaN;
            if (Number.isFinite(n) && n > 0) run(adjustStock(product.id, n));
          }}
          className="px-3 h-9 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-sm font-bold"
        >
          + Entrada
        </button>
        {reserved > 0 && (
          <span className="text-xs text-zinc-500 ml-1">{reserved} apartada(s) en cuentas</span>
        )}
      </div>
    ) : (
      <span className="text-zinc-600">—</span>
    )
  );

  return (
    <div className="flex-1 h-full bg-zinc-900 flex flex-col overflow-hidden">
      <div className="page-header flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="page-title">
            <span>📦</span> Inventario
          </h1>
          <p className="hidden md:block text-zinc-400 text-sm max-w-xl">
            El stock se descuenta al enviar a cocina (o al cobrar si nunca se envió). Lo que se marque como agotado o
            no disponible aparece bloqueado en la carta. Stock bajo: {LOW_STOCK_THRESHOLD} piezas o menos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white"
          >
            {categories.map(c => <option key={c} value={c}>{c === 'Todo' ? 'Todas las categorías' : c}</option>)}
          </select>
          {([
            ['todos', 'Todos'],
            ['alertas', `Alertas (${alertCount})`],
            ['controlados', 'Con control de stock'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-bold transition-colors ${
                filter === key ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 font-medium">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Teléfono: tarjetas */}
        <div className="md:hidden space-y-3">
          {visible.map(({ product, record, reserved, availability }) => {
            const style = STATUS_STYLE[availability.status];
            return (
              <div key={product.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-bold leading-tight">{product.name}</p>
                    <p className="text-zinc-500 text-sm">{product.category} · ${product.price.toFixed(2)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${style.className}`}>
                    {style.label}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-zinc-400">
                  <label className="flex items-center gap-2">
                    <Toggle checked={record.available} onChange={(v) => run(setAvailable(product.id, v))} label="En carta" />
                    En carta
                  </label>
                  <label className="flex items-center gap-2">
                    <Toggle checked={record.tracked} onChange={(v) => run(setTracked(product.id, v))} label="Contar piezas" />
                    Contar piezas
                  </label>
                </div>
                {record.tracked && stockEditor(product, record, reserved)}
              </div>
            );
          })}
          {visible.length === 0 && <p className="p-12 text-center text-zinc-500">No hay productos con ese filtro.</p>}
        </div>

        {/* Tablet y computadora: tabla */}
        <div className="hidden md:block bg-zinc-950 border border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-zinc-900 text-zinc-400 text-sm">
                <th className="p-4 font-medium border-b border-zinc-800">Producto</th>
                <th className="p-4 font-medium border-b border-zinc-800">Estado</th>
                <th className="p-4 font-medium border-b border-zinc-800 text-center">En carta</th>
                <th className="p-4 font-medium border-b border-zinc-800 text-center">Contar piezas</th>
                <th className="p-4 font-medium border-b border-zinc-800">Existencia</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ product, record, reserved, availability }) => {
                const style = STATUS_STYLE[availability.status];
                return (
                  <tr key={product.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="p-4">
                      <p className="text-white font-bold">{product.name}</p>
                      <p className="text-zinc-500 text-sm">{product.category} · ${product.price.toFixed(2)}</p>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${style.className}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Toggle
                        checked={record.available}
                        onChange={(v) => run(setAvailable(product.id, v))}
                        label={record.available ? 'Visible para venta' : 'Bloqueado en la carta'}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <Toggle
                        checked={record.tracked}
                        onChange={(v) => run(setTracked(product.id, v))}
                        label={record.tracked ? 'Descuenta piezas' : 'Sin límite'}
                      />
                    </td>
                    <td className="p-4">
                      {stockEditor(product, record, reserved)}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-500">No hay productos con ese filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      title={label}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-zinc-700'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}
