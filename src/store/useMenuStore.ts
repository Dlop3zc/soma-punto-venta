import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import type { Product } from '../data/defaultMenu';

// Producto de la carta en `products/{id}`. La carta (productos, precios, categorías y su
// orden) la administra DLX desde carta-dlx/; el punto de venta solo la lee para vender.
export interface MenuProduct extends Product {
  visible: boolean;  // aparece en la carta para los meseros
  position: number;  // orden dentro de su categoría
  updatedAt: number;
}

const MENU_DOC = () => doc(db, 'config', 'menu');

// Solo los campos que se copian a la cuenta al pedir el producto
export const toOrderProduct = ({ id, name, price, category }: Product): Product => ({ id, name, price, category });

interface MenuState {
  products: MenuProduct[];     // ordenados por categoría y posición
  categories: string[];        // en el orden de la carta
  loaded: boolean;

  initMenuListener: () => () => void;
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

export const useMenuStore = create<MenuState>((set) => {
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
  };
});
