import { create } from 'zustand';
import { db } from './firebase';
import {
  collection, deleteDoc, doc, onSnapshot, runTransaction, writeBatch, setDoc,
} from 'firebase/firestore';
import { defaultCategories, defaultProducts, type Product } from './cartaInicial';

// Editor de la carta de DLX sobre la base de SOMA (`products` y `config/menu`).
// El punto de venta lee estos mismos documentos para vender; las reglas de SOMA solo
// dejan escribirlos a los usuarios de `menuEditors`. Los campos deben coincidir con
// `validProduct` en firestore.rules de SOMA.

// Producto de la carta en `products/{id}`
export interface MenuProduct extends Product {
  visible: boolean;  // aparece en la carta y en el punto de venta
  position: number;  // orden dentro de su categoría
  updatedAt: number;
}

export interface ProductInput {
  name: string;
  price: number;
  category: string;
  visible: boolean;
}

export const MAX_NAME_LENGTH = 60;

const MENU_DOC = () => doc(db, 'config', 'menu');

// Solo los campos que se copian a la cuenta al pedir el producto
export const toOrderProduct = ({ id, name, price, category }: Product): Product => ({ id, name, price, category });

export function validateProduct(input: ProductInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Escribe el nombre del producto.';
  if (name.length > MAX_NAME_LENGTH) return `El nombre puede tener hasta ${MAX_NAME_LENGTH} caracteres.`;
  if (!Number.isFinite(input.price) || input.price < 0) return 'El precio debe ser un número mayor o igual a 0.';
  if (input.price > 100_000) return 'El precio es demasiado alto.';
  if (!input.category.trim()) return 'Elige una categoría.';
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface MenuState {
  products: MenuProduct[];     // ordenados por categoría y posición
  categories: string[];        // en el orden de la carta
  loaded: boolean;

  initMenuListener: () => () => void;
  seedDefaultMenu: () => Promise<boolean>;
  saveProduct: (id: string | null, input: ProductInput) => Promise<void>;
  setVisible: (id: string, visible: boolean) => Promise<void>;
  moveProduct: (id: string, direction: -1 | 1) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  renameCategory: (from: string, to: string) => Promise<void>;
  moveCategory: (name: string, direction: -1 | 1) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
}

function sortProducts(products: MenuProduct[], categories: string[]) {
  const rank = (c: string) => {
    const i = categories.indexOf(c);
    return i === -1 ? categories.length : i;
  };
  return [...products].sort((a, b) =>
    rank(a.category) - rank(b.category)
    || a.category.localeCompare(b.category)
    || a.position - b.position
    || a.name.localeCompare(b.name));
}

export const useMenuStore = create<MenuState>((set, get) => {
  let rawProducts: MenuProduct[] = [];
  let savedCategories: string[] = [];
  let gotProducts = false;
  let gotMenu = false;

  // Las categorías de `config/menu` dan el orden; si algún producto trae una que no
  // está en la lista (p. ej. un dato viejo) se agrega al final para no perderlo.
  const publish = () => {
    const categories = [...savedCategories];
    rawProducts.forEach(p => { if (!categories.includes(p.category)) categories.push(p.category); });
    set({
      categories,
      products: sortProducts(rawProducts, categories),
      loaded: gotProducts && gotMenu,
    });
  };

  const saveCategories = (categories: string[]) =>
    setDoc(MENU_DOC(), { categories, updatedAt: Date.now() }, { merge: true });

  return {
    products: [],
    categories: [],
    loaded: false,

    initMenuListener: () => {
      const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
        rawProducts = snapshot.docs.map(d => ({ visible: true, position: 0, ...d.data(), id: d.id }) as MenuProduct);
        gotProducts = true;
        publish();
      }, (error) => console.error("🔥 Error escuchando products:", error));

      const unsubMenu = onSnapshot(MENU_DOC(), (snap) => {
        savedCategories = (snap.data()?.categories as string[] | undefined) || [];
        gotMenu = true;
        publish();
      }, (error) => console.error("🔥 Error escuchando config/menu:", error));

      return () => {
        unsubProducts();
        unsubMenu();
        rawProducts = [];
        savedCategories = [];
        gotProducts = gotMenu = false;
        set({ products: [], categories: [], loaded: false });
      };
    },

    // Base nueva y vacía: copia la carta original. La transacción evita importarla
    // dos veces. Devuelve true si importó.
    seedDefaultMenu: async () => runTransaction(db, async (tx) => {
      const menu = await tx.get(MENU_DOC());
      if (menu.exists()) return false;
      const now = Date.now();
      defaultProducts.forEach((p, i) => {
        tx.set(doc(db, 'products', p.id), { ...p, visible: true, position: i, updatedAt: now });
      });
      tx.set(MENU_DOC(), { categories: defaultCategories, updatedAt: now });
      return true;
    }),

    saveProduct: async (id, input) => {
      const error = validateProduct(input);
      if (error) throw new Error(error);
      const { products, categories } = get();
      const category = input.category.trim();
      const data = {
        name: input.name.trim(),
        price: round2(input.price),
        category,
        visible: input.visible,
        updatedAt: Date.now(),
      };

      const existing = id ? products.find(p => p.id === id) : undefined;
      // Al llegar a otra categoría (o al crearlo) va al final de esa categoría
      const position = existing && existing.category === category
        ? existing.position
        : Math.max(-1, ...products.filter(p => p.category === category).map(p => p.position)) + 1;

      const ref = id ? doc(db, 'products', id) : doc(collection(db, 'products'));
      const batch = writeBatch(db);
      batch.set(ref, { ...data, id: ref.id, position }, { merge: true });
      if (!categories.includes(category)) {
        batch.set(MENU_DOC(), { categories: [...categories, category], updatedAt: Date.now() }, { merge: true });
      }
      await batch.commit();
    },

    setVisible: async (id, visible) => {
      await setDoc(doc(db, 'products', id), { visible, updatedAt: Date.now() }, { merge: true });
    },

    moveProduct: async (id, direction) => {
      const product = get().products.find(p => p.id === id);
      if (!product) return;
      const siblings = get().products.filter(p => p.category === product.category);
      const index = siblings.findIndex(p => p.id === id);
      const other = siblings[index + direction];
      if (!other) return;
      // Renumerar la categoría completa: así posiciones repetidas no traban el orden
      const reordered = [...siblings];
      reordered[index] = other;
      reordered[index + direction] = product;
      const batch = writeBatch(db);
      reordered.forEach((p, i) => {
        if (p.position !== i) batch.update(doc(db, 'products', p.id), { position: i });
      });
      await batch.commit();
    },

    // Las ventas pasadas guardan su propia copia del producto, así que el historial no se pierde.
    // Su registro de inventario se queda en SOMA (la carta no puede tocar el inventario).
    deleteProduct: async (id) => {
      await deleteDoc(doc(db, 'products', id));
    },

    addCategory: async (name) => {
      const trimmed = name.trim();
      const { categories } = get();
      if (!trimmed) throw new Error('Escribe el nombre de la categoría.');
      if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) throw new Error('Esa categoría ya existe.');
      await saveCategories([...categories, trimmed]);
    },

    renameCategory: async (from, to) => {
      const trimmed = to.trim();
      const { categories, products } = get();
      if (!trimmed) throw new Error('Escribe el nombre de la categoría.');
      if (trimmed === from) return;
      if (categories.some(c => c !== from && c.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Esa categoría ya existe.');
      }
      const affected = products.filter(p => p.category === from);
      // Un lote admite 500 escrituras; una categoría nunca debería acercarse
      if (affected.length > 450) throw new Error('La categoría tiene demasiados productos para renombrarla de una vez.');
      const batch = writeBatch(db);
      affected.forEach(p => batch.update(doc(db, 'products', p.id), { category: trimmed, updatedAt: Date.now() }));
      batch.set(MENU_DOC(), { categories: categories.map(c => (c === from ? trimmed : c)), updatedAt: Date.now() }, { merge: true });
      await batch.commit();
    },

    moveCategory: async (name, direction) => {
      const categories = [...get().categories];
      const i = categories.indexOf(name);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= categories.length) return;
      [categories[i], categories[j]] = [categories[j], categories[i]];
      await saveCategories(categories);
    },

    deleteCategory: async (name) => {
      const { categories, products } = get();
      if (products.some(p => p.category === name)) {
        throw new Error('Solo se pueden borrar categorías sin productos. Mueve o borra sus productos primero.');
      }
      await saveCategories(categories.filter(c => c !== name));
    },
  };
});

