import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, increment } from 'firebase/firestore';

// Documento en la colección `inventory`, con el id del producto como id del documento.
// Si un producto no tiene documento, se considera disponible y sin control de stock.
export interface InventoryRecord {
  tracked: boolean;   // true = se cuentan piezas y se descuentan al consumir
  stock: number;      // piezas en existencia (solo aplica si tracked)
  available: boolean; // interruptor manual del admin (p. ej. "86" de un producto)
  updatedAt?: number;
}

export const DEFAULT_INVENTORY: InventoryRecord = { tracked: false, stock: 0, available: true };

interface InventoryState {
  inventory: Record<string, InventoryRecord>;
  initInventoryListener: () => () => void;
  getRecord: (productId: string) => InventoryRecord;
  setStock: (productId: string, stock: number) => Promise<void>;
  adjustStock: (productId: string, delta: number) => Promise<void>;
  setTracked: (productId: string, tracked: boolean) => Promise<void>;
  setAvailable: (productId: string, available: boolean) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  inventory: {},

  initInventoryListener: () => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const inventory: Record<string, InventoryRecord> = {};
      snapshot.docs.forEach(d => {
        inventory[d.id] = { ...DEFAULT_INVENTORY, ...(d.data() as Partial<InventoryRecord>) };
      });
      set({ inventory });
    }, (error) => {
      console.error("🔥 Error escuchando inventory:", error);
    });
    return () => unsub();
  },

  getRecord: (productId) => get().inventory[productId] || DEFAULT_INVENTORY,

  setStock: async (productId, stock) => {
    await setDoc(doc(db, 'inventory', productId), {
      ...get().getRecord(productId),
      stock: Math.max(0, Math.floor(stock)),
      updatedAt: Date.now(),
    }, { merge: true });
  },

  adjustStock: async (productId, delta) => {
    const current = get().getRecord(productId);
    // Si el stock quedó negativo por ventas sin existencia, reabastecer parte de 0
    if (delta > 0 && current.stock < 0) {
      await get().setStock(productId, delta);
      return;
    }
    await setDoc(doc(db, 'inventory', productId), {
      ...current,
      stock: increment(delta),
      updatedAt: Date.now(),
    }, { merge: true });
  },

  setTracked: async (productId, tracked) => {
    await setDoc(doc(db, 'inventory', productId), {
      ...get().getRecord(productId),
      tracked,
      updatedAt: Date.now(),
    }, { merge: true });
  },

  setAvailable: async (productId, available) => {
    await setDoc(doc(db, 'inventory', productId), {
      ...get().getRecord(productId),
      available,
      updatedAt: Date.now(),
    }, { merge: true });
  },
}));
