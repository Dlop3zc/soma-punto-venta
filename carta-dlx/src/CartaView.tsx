import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import SomaLogo from './SomaLogo';

// Carta digital para comensales: solo lectura y sin sesión, sobre la base de SOMA.
// Las reglas de SOMA dejan leer sin sesión los productos visibles, `config/menu` e `inventory`.
// Los campos de abajo son los que escribe el punto de venta; si allá cambian, cambiar aquí.

interface MenuProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  position: number;
}

// `inventory/{idDelProducto}`. Sin documento = disponible y sin control de existencias.
interface InventoryRecord {
  tracked: boolean;   // se cuentan piezas
  stock: number;
  available: boolean; // interruptor manual "En carta"
}

const DEFAULT_INVENTORY: InventoryRecord = { tracked: false, stock: 0, available: true };

const formatPrice = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Igual que en el punto de venta (utils/stock.ts), sin descontar lo apartado en cuentas abiertas:
// sin sesión no se pueden leer
const isSoldOut = (record: InventoryRecord) =>
  !record.available || (record.tracked && record.stock <= 0);

export default function PublicMenuView() {
  const [products, setProducts] = useState<MenuProduct[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryRecord>>({});
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: unknown) => {
      console.error('🔥 Error leyendo la carta pública:', e);
      setError(true);
    };
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('visible', '==', true)),
      (snap) => setProducts(snap.docs.map(d => ({ position: 0, ...d.data(), id: d.id }) as MenuProduct)),
      onError,
    );
    const unsubMenu = onSnapshot(
      doc(db, 'config', 'menu'),
      (snap) => setCategories((snap.data()?.categories as string[] | undefined) || []),
      onError,
    );
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      const next: Record<string, InventoryRecord> = {};
      snap.docs.forEach(d => { next[d.id] = { ...DEFAULT_INVENTORY, ...(d.data() as Partial<InventoryRecord>) }; });
      setInventory(next);
    }, onError);
    return () => {
      unsubProducts();
      unsubMenu();
      unsubInventory();
    };
  }, []);

  // Secciones en el orden de la carta; las categorías sin productos visibles no aparecen
  const sections = useMemo(() => {
    if (!products) return [];
    const order = [...categories];
    products.forEach(p => { if (!order.includes(p.category)) order.push(p.category); });
    return order
      .map(category => ({
        category,
        items: products
          .filter(p => p.category === category)
          .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
      }))
      .filter(s => s.items.length > 0);
  }, [products, categories]);

  const goTo = (category: string, chip: HTMLElement) => {
    setActiveCategory(category);
    chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    document.getElementById(sectionId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-zinc-950 text-zinc-50 select-text">
      <header className="px-4 pt-8 pb-4 flex flex-col items-center text-center">
        <SomaLogo className="w-36 text-amber-200" />
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-400">Carta</p>
      </header>

      {sections.length > 1 && (
        <nav className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-y border-zinc-800">
          <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            {sections.map(({ category }) => (
              <button
                key={category}
                onClick={(e) => goTo(category, e.currentTarget)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  activeCategory === category
                    ? 'bg-amber-200 text-zinc-950 border-amber-200'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="max-w-2xl mx-auto px-4 pb-16" style={{ paddingBottom: 'max(4rem, env(safe-area-inset-bottom))' }}>
        {error ? (
          <p className="mt-16 text-center text-zinc-400">No pudimos cargar la carta. Revisa tu conexión e intenta de nuevo.</p>
        ) : !products ? (
          <p className="mt-16 text-center text-zinc-500">Cargando la carta…</p>
        ) : sections.length === 0 ? (
          <p className="mt-16 text-center text-zinc-400">La carta no está disponible por el momento.</p>
        ) : (
          sections.map(({ category, items }) => (
            <section key={category} id={sectionId(category)} className="scroll-mt-20 pt-8">
              <h2 className="text-lg font-bold text-amber-200 uppercase tracking-wider mb-2">{category}</h2>
              <ul className="divide-y divide-zinc-800/80">
                {items.map(p => {
                  const soldOut = isSoldOut(inventory[p.id] || DEFAULT_INVENTORY);
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-4 py-3">
                      <span className={`min-w-0 ${soldOut ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'}`}>
                        {p.name}
                      </span>
                      {soldOut ? (
                        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-red-300 bg-red-500/10 border border-red-500/30 rounded-full px-2.5 py-1">
                          Agotado
                        </span>
                      ) : (
                        <span className="shrink-0 font-semibold tabular-nums text-zinc-100">{formatPrice(p.price)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        {sections.length > 0 && (
          <p className="mt-10 text-center text-xs text-zinc-500">Precios en pesos mexicanos.</p>
        )}
      </main>
    </div>
  );
}

const sectionId = (category: string) => `cat-${encodeURIComponent(category)}`;
