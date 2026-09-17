import { useState } from 'react';
import { mockProducts, categories, type Category } from '../data/mockProducts';
import { useCartStore } from '../store/useCartStore';

export default function ProductCatalog() {
  const [activeCategory, setActiveCategory] = useState<Category>('Todo');
  const addToCart = useCartStore((state) => state.addToCart);

  const filteredProducts = mockProducts.filter(
    (product) => activeCategory === 'Todo' || product.category === activeCategory
  );

  return (
    <div className="h-full flex flex-col p-4 bg-zinc-900 overflow-hidden">
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
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors p-6 rounded-2xl flex flex-col items-center justify-center text-center aspect-square shadow-md border border-zinc-700 hover:border-blue-500"
            >
              <span className="text-2xl font-bold text-zinc-100 mb-2 line-clamp-2">
                {product.name}
              </span>
              <span className="text-xl font-medium text-emerald-400">
                ${product.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
