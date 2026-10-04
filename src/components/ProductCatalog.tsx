import { useState, useEffect } from 'react';
import type { Product } from '../data/defaultMenu';
import { useMenuStore } from '../store/useMenuStore';
import { useCartStore } from '../store/useCartStore';
import { useInventoryStore, DEFAULT_INVENTORY } from '../store/useInventoryStore';
import { getAvailability, reservedQuantity } from '../utils/stock';
import OrderNameModal from './OrderNameModal';

const ALL = 'Todo';

export default function ProductCatalog() {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { orders, addToCart, createOrder } = useCartStore();
  const inventory = useInventoryStore(s => s.inventory);
  const { products, categories: allCategories, loaded } = useMenuStore();

  const visibleProducts = products.filter(p => p.visible);
  // Solo categorías con algo que vender
  const categories = [ALL, ...allCategories.filter(c => visibleProducts.some(p => p.category === c))];

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const filteredProducts = visibleProducts.filter(
    (product) => activeCategory === ALL || !categories.includes(activeCategory) || product.category === activeCategory
  );
  const selectedCategory = categories.includes(activeCategory) ? activeCategory : ALL;

  const handleAdd = async (product: Product) => {
    try {
      const result = await addToCart(product);
      if (result === 'no-order') setPendingProduct(product);
      else if (result === 'out-of-stock') setMessage(`${product.name}: sin existencias`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo agregar el producto.');
    }
  };

  return (
    <div className="h-full flex flex-col p-3 md:p-4 bg-zinc-900 overflow-hidden relative">
      {/* Category Pills */}
      <div className="flex gap-2 md:gap-3 mb-3 md:mb-5 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide shrink-0">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`shrink-0 px-4 py-2 md:px-6 md:py-3 rounded-full text-base md:text-lg font-bold transition-colors whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto -mr-1 pr-1 pb-24 md:pb-2">
        {filteredProducts.length === 0 && (
          <div className="h-full flex items-center justify-center text-center text-zinc-500 text-xl px-4">
            {loaded ? 'No hay productos en la carta. El administrador puede agregarlos en "Carta".' : 'Cargando carta…'}
          </div>
        )}
        <div className="grid gap-2.5 md:gap-4 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(165px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {filteredProducts.map((product) => {
            const record = inventory[product.id] ?? DEFAULT_INVENTORY;
            const { status, remaining } = getAvailability(record, reservedQuantity(orders, product.id));
            const blocked = status === 'out' || status === 'disabled';

            return (
              <button
                key={product.id}
                onClick={() => handleAdd(product)}
                disabled={blocked}
                className={`relative transition-colors px-3 pt-7 pb-4 md:px-4 rounded-2xl flex flex-col items-center justify-center text-center min-h-[112px] md:min-h-[150px] xl:min-h-[180px] shadow-md border ${
                  blocked
                    ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-zinc-700 hover:border-blue-500'
                }`}
              >
                <span className="text-base md:text-xl xl:text-2xl font-bold text-zinc-100 mb-1 md:mb-2 line-clamp-2 leading-tight">
                  {product.name}
                </span>
                <span className="text-base md:text-lg xl:text-xl font-medium text-emerald-400">
                  ${product.price.toFixed(2)}
                </span>

                {status === 'out' && (
                  <span className="absolute top-2 right-2 text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    AGOTADO
                  </span>
                )}
                {status === 'disabled' && (
                  <span className="absolute top-2 right-2 text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                    NO DISPONIBLE
                  </span>
                )}
                {status === 'low' && (
                  <span className="absolute top-2 right-2 text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Quedan {remaining}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white font-bold px-5 py-3 rounded-xl shadow-2xl max-w-[90%] text-center">
          {message}
        </div>
      )}

      {pendingProduct && (
        <OrderNameModal
          title="Nombre de la nueva cuenta"
          confirmLabel={`Abrir y agregar ${pendingProduct.name}`}
          onConfirm={async (name) => {
            await createOrder(name);
            await handleAdd(pendingProduct);
          }}
          onClose={() => setPendingProduct(null)}
        />
      )}
    </div>
  );
}
