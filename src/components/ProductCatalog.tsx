import { useState, useEffect } from 'react';
import { mockProducts, categories, type Category, type Product } from '../data/mockProducts';
import { useCartStore } from '../store/useCartStore';
import { useInventoryStore, DEFAULT_INVENTORY } from '../store/useInventoryStore';
import { getAvailability, reservedQuantity } from '../utils/stock';
import OrderNameModal from './OrderNameModal';

export default function ProductCatalog() {
  const [activeCategory, setActiveCategory] = useState<Category>('Todo');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { orders, addToCart, createOrder } = useCartStore();
  const inventory = useInventoryStore(s => s.inventory);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const filteredProducts = mockProducts.filter(
    (product) => activeCategory === 'Todo' || product.category === activeCategory
  );

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
    <div className="h-full flex flex-col p-4 bg-zinc-900 overflow-hidden relative">
      {/* Category Pills */}
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-8 py-4 rounded-full text-xl font-bold transition-colors whitespace-nowrap ${
              activeCategory === category
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto pr-2 pb-24 md:pb-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const record = inventory[product.id] ?? DEFAULT_INVENTORY;
            const { status, remaining } = getAvailability(record, reservedQuantity(orders, product.id));
            const blocked = status === 'out' || status === 'disabled';

            return (
              <button
                key={product.id}
                onClick={() => handleAdd(product)}
                disabled={blocked}
                className={`relative transition-colors p-6 rounded-2xl flex flex-col items-center justify-center text-center aspect-square shadow-md border ${
                  blocked
                    ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-zinc-700 hover:border-blue-500'
                }`}
              >
                <span className="text-2xl font-bold text-zinc-100 mb-2 line-clamp-2">
                  {product.name}
                </span>
                <span className="text-xl font-medium text-emerald-400">
                  ${product.price.toFixed(2)}
                </span>

                {status === 'out' && (
                  <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    AGOTADO
                  </span>
                )}
                {status === 'disabled' && (
                  <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full bg-zinc-700 text-zinc-300">
                    NO DISPONIBLE
                  </span>
                )}
                {status === 'low' && (
                  <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Quedan {remaining}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white font-bold px-6 py-3 rounded-xl shadow-2xl">
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
