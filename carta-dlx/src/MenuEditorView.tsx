import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Search, Trash2, X, FolderCog, ExternalLink, LogOut } from 'lucide-react';
import { useMenuStore, validateProduct, MAX_NAME_LENGTH, type MenuProduct } from './useMenuStore';

const ALL = 'Todas';

// "85", "85.5", "1,250.00" o "$85" -> número
function parsePrice(value: string): number {
  const clean = value.replace(/[$\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return clean === '' ? NaN : Number(clean);
}

export default function MenuEditorView({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const { products, categories, loaded, setVisible, moveProduct, seedDefaultMenu } = useMenuStore();
  const [importing, setImporting] = useState(false);
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MenuProduct | 'new' | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = category === ALL || categories.includes(category) ? category : ALL;
  const query = search.trim().toLowerCase();
  const visible = products.filter(p =>
    (selected === ALL || p.category === selected) && (!query || p.name.toLowerCase().includes(query)));
  const groups = categories
    .map(c => ({ category: c, items: visible.filter(p => p.category === c) }))
    .filter(g => g.items.length > 0 || (selected === g.category && !query));

  const run = async (action: Promise<void>) => {
    try {
      setError(null);
      await action;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    }
  };

  const hiddenCount = products.filter(p => !p.visible).length;

  return (
    <div className="h-[100dvh] bg-zinc-900 flex flex-col overflow-hidden">
      <div className="page-header flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="page-title">
            <span>📋</span> Carta
          </h1>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center gap-2"
            >
              <ExternalLink size={18} /> Ver carta
            </a>
            <button
              onClick={() => setManagingCategories(true)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center gap-2"
            >
              <FolderCog size={18} /> Categorías
            </button>
            <button
              onClick={() => setEditing('new')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus size={18} /> Producto
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3 items-center">
          <div className="relative w-full sm:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={selected}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white"
          >
            <option value={ALL}>Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-zinc-500 text-sm">
            {products.length} productos{hiddenCount > 0 && ` · ${hiddenCount} oculto${hiddenCount === 1 ? '' : 's'}`}
          </span>
        </div>
        <p className="text-zinc-500 text-sm">
          Los cambios se ven al momento en la carta y en el punto de venta de SOMA. Las existencias y lo agotado se manejan en el Inventario de SOMA.
          {' '}<span className="whitespace-nowrap">{userEmail} · <button onClick={onLogout} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white font-medium"><LogOut size={14} /> Salir</button></span>
        </p>
        {error && <p className="text-red-400 font-medium">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6">
        {!loaded ? (
          <p className="text-zinc-500 text-center py-12">Cargando carta…</p>
        ) : products.length === 0 && categories.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-zinc-500">La carta está vacía. Agrega tu primer producto o importa la carta original de Terraza SOMA.</p>
            <button
              onClick={() => { setImporting(true); run(seedDefaultMenu().then(() => undefined)).finally(() => setImporting(false)); }}
              disabled={importing}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold disabled:opacity-50"
            >
              {importing ? 'Importando…' : 'Importar carta inicial'}
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">
            {query ? 'Ningún producto coincide con la búsqueda.' : 'La carta está vacía. Agrega tu primer producto.'}
          </p>
        ) : groups.map(group => (
          <section key={group.category}>
            <h2 className="text-lg font-bold text-zinc-300 mb-2 px-1">
              {group.category} <span className="text-zinc-600 font-medium">({group.items.length})</span>
            </h2>
            {group.items.length === 0 ? (
              <p className="text-zinc-600 px-1">Sin productos.</p>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 overflow-hidden">
                {group.items.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 ${p.visible ? '' : 'opacity-60'}`}>
                    {!query && (
                      <div className="flex flex-col shrink-0">
                        <button
                          onClick={() => run(moveProduct(p.id, -1))}
                          disabled={i === 0}
                          className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                          title="Subir"
                        >
                          <ChevronUp size={18} />
                        </button>
                        <button
                          onClick={() => run(moveProduct(p.id, 1))}
                          disabled={i === group.items.length - 1}
                          className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                          title="Bajar"
                        >
                          <ChevronDown size={18} />
                        </button>
                      </div>
                    )}
                    <button onClick={() => setEditing(p)} className="flex-1 min-w-0 text-left">
                      <p className="text-zinc-100 font-bold truncate">{p.name}</p>
                      {!p.visible && <p className="text-xs text-zinc-500">Oculto en la carta</p>}
                    </button>
                    <span className="text-emerald-400 font-bold shrink-0">${p.price.toFixed(2)}</span>
                    <button
                      onClick={() => run(setVisible(p.id, !p.visible))}
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        p.visible ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-600'
                      }`}
                      title={p.visible ? 'Ocultar de la carta' : 'Mostrar en la carta'}
                    >
                      {p.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shrink-0"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          defaultCategory={selected === ALL ? categories[0] || '' : selected}
          onClose={() => setEditing(null)}
        />
      )}
      {managingCategories && <CategoriesModal onClose={() => setManagingCategories(false)} />}
    </div>
  );
}

// ---------- Alta / edición de producto ----------

function ProductModal({ product, defaultCategory, onClose }: {
  product: MenuProduct | null;
  defaultCategory: string;
  onClose: () => void;
}) {
  const { products, categories, saveProduct, deleteProduct } = useMenuStore();
  const [name, setName] = useState(product?.name || '');
  const [priceText, setPriceText] = useState(product ? String(product.price) : '');
  const [category, setCategory] = useState(product?.category || defaultCategory);
  const [newCategory, setNewCategory] = useState('');
  const [visible, setVisible] = useState(product?.visible ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const NEW = '__nueva__';
  const finalCategory = category === NEW || categories.length === 0 ? newCategory.trim() : category;
  const price = parsePrice(priceText);
  const duplicate = products.some(p =>
    p.id !== product?.id && p.category === finalCategory && p.name.trim().toLowerCase() === name.trim().toLowerCase());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { name, price, category: finalCategory, visible };
    const invalid = validateProduct(input);
    if (invalid) return setError(invalid);
    if (duplicate) return setError('Ya hay un producto con ese nombre en la categoría.');
    setSaving(true);
    setError(null);
    try {
      await saveProduct(product?.id || null, input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm(`¿Borrar "${product.name}" de la carta?\n\nLas ventas anteriores no se pierden. Si solo quieres dejar de venderlo por un tiempo, mejor ocúltalo.`)) return;
    setSaving(true);
    try {
      await deleteProduct(product.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-lg text-white focus:outline-none focus:border-blue-500';

  return createPortal(
    <div className="modal-backdrop z-[60]">
      <form onSubmit={handleSubmit} className="modal-panel max-w-lg">
        <div className="p-5 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
          <h2 className="text-2xl font-bold text-white">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" onClick={onClose} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-5 overflow-y-auto">
          <label className="block">
            <span className="block text-zinc-300 font-medium mb-2">Nombre</span>
            <input autoFocus={!product} value={name} onChange={e => setName(e.target.value)} maxLength={MAX_NAME_LENGTH} placeholder="Ej. Margarita de mango" className={inputClass} />
          </label>

          <label className="block">
            <span className="block text-zinc-300 font-medium mb-2">Precio</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">$</span>
              <input inputMode="decimal" value={priceText} onChange={e => setPriceText(e.target.value)} placeholder="0.00" className={`${inputClass} pl-8`} />
            </div>
            {product && Number.isFinite(price) && price !== product.price && (
              <span className="block text-sm text-zinc-500 mt-1">Las cuentas ya abiertas conservan el precio anterior.</span>
            )}
          </label>

          <label className="block">
            <span className="block text-zinc-300 font-medium mb-2">Categoría</span>
            {categories.length > 0 && (
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value={NEW}>+ Nueva categoría…</option>
              </select>
            )}
            {(category === NEW || categories.length === 0) && (
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} maxLength={40} placeholder="Nombre de la categoría" className={`${inputClass} mt-2`} />
            )}
          </label>

          <label className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 cursor-pointer">
            <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} className="w-5 h-5 accent-blue-500" />
            <span>
              <span className="block text-zinc-100 font-bold">Visible en la carta</span>
              <span className="block text-zinc-400 text-sm">Si lo desmarcas, no aparece en la carta ni en el punto de venta, pero se conserva para volver a activarlo.</span>
            </span>
          </label>

          {duplicate && <p className="text-amber-300">Ya hay un producto con ese nombre en la categoría.</p>}
          {error && <p className="text-red-400 font-medium">{error}</p>}
        </div>

        <div className="p-5 md:p-6 border-t border-zinc-800 bg-zinc-950 flex gap-3 shrink-0">
          {product && (
            <button type="button" onClick={handleDelete} disabled={saving} className="p-4 rounded-2xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white" title="Borrar producto">
              <Trash2 size={22} />
            </button>
          )}
          <button type="submit" disabled={saving} className="flex-1 py-4 rounded-2xl text-xl font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-800 disabled:text-zinc-600">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

// ---------- Categorías ----------

function CategoriesModal({ onClose }: { onClose: () => void }) {
  const { products, categories, addCategory, renameCategory, moveCategory, deleteCategory } = useMenuStore();
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    }
  };

  const count = (c: string) => products.filter(p => p.category === c).length;

  return createPortal(
    <div className="modal-backdrop z-[60]">
      <div className="modal-panel max-w-lg">
        <div className="p-5 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Categorías</h2>
            <p className="text-zinc-400 text-sm">El orden aquí es el orden de la carta.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-2">
          {categories.map((c, i) => (
            <div key={c} className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-xl px-2 py-2">
              <div className="flex flex-col shrink-0">
                <button onClick={() => run(() => moveCategory(c, -1))} disabled={i === 0} className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20" title="Subir">
                  <ChevronUp size={18} />
                </button>
                <button onClick={() => run(() => moveCategory(c, 1))} disabled={i === categories.length - 1} className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20" title="Bajar">
                  <ChevronDown size={18} />
                </button>
              </div>
              {renaming === c ? (
                <form
                  className="flex-1 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(() => renameCategory(c, renameText))) setRenaming(null);
                  }}
                >
                  <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)} maxLength={40} className="flex-1 min-w-0 bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                  <button type="submit" className="px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">OK</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0 truncate text-zinc-100 font-bold">
                    {c} <span className="text-zinc-500 font-medium">({count(c)})</span>
                  </span>
                  <button onClick={() => { setRenaming(c); setRenameText(c); }} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300" title="Cambiar nombre">
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => window.confirm(`¿Borrar la categoría "${c}"?`) && run(() => deleteCategory(c))}
                    disabled={count(c) > 0}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-red-600 text-red-400 hover:text-white disabled:opacity-25 disabled:hover:bg-zinc-800 disabled:hover:text-red-400"
                    title={count(c) > 0 ? 'Solo se pueden borrar categorías vacías' : 'Borrar categoría'}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
          {error && <p className="text-red-400 font-medium pt-2">{error}</p>}
        </div>

        <form
          className="p-4 md:p-5 border-t border-zinc-800 bg-zinc-950 flex gap-2 shrink-0"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => addCategory(newName))) setNewName('');
          }}
        >
          <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} placeholder="Nueva categoría" className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" />
          <button type="submit" disabled={!newName.trim()} className="px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:bg-zinc-800 disabled:text-zinc-600">
            Agregar
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
