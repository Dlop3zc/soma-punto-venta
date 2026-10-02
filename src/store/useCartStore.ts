import { create } from 'zustand';
import { db } from '../firebase';
import {
  collection, doc, setDoc, updateDoc, onSnapshot, writeBatch, getDocs,
  runTransaction, increment, type Transaction,
} from 'firebase/firestore';
import type { Product } from '../data/mockProducts';
import { useAuthStore } from './useAuthStore';
import { useInventoryStore } from './useInventoryStore';
import { getAvailability, reservedQuantity } from '../utils/stock';

export interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  status: 'nuevo' | 'preparando' | 'listo';
  note?: string;
  sentToKitchenAt?: number;
  finishedAt?: number;
}

export interface Order {
  id: string;
  name: string;
  waiter: string;
  items: CartItem[];
  total: number;
  createdAt: number;
}

export type PaymentMethod = 'Efectivo' | 'Tarjeta';

export interface PaidOrder extends Order {
  paymentMethod: PaymentMethod;
  paidAt: number;
  paidBy?: string;
  cashTendered?: number;
  change?: number;
  discount?: number;
  tip?: number;        // propina, no forma parte de `total` (ventas)
  tipPercent?: number; // porcentaje elegido cuando la propina se calculó por %
}

export interface PaymentInput {
  method: PaymentMethod;
  discount: number;
  tip: number;
  tipPercent?: number;
  cashTendered?: number;
  change?: number;
}

export interface Alert {
  id: string;
  orderId: string;
  orderName: string;
  waiter: string;
  message: string;
  read: boolean;
  createdAt: number;
}

export type AddToCartResult = 'ok' | 'no-order' | 'out-of-stock';

interface CartState {
  orders: Order[];
  paidOrders: PaidOrder[];
  alerts: Alert[];
  activeOrderId: string | null;
  lastCutTime: number;

  initListeners: () => () => void;
  createOrder: (name: string) => Promise<string>;
  renameOrder: (orderId: string, name: string) => Promise<void>;
  deleteEmptyOrder: (orderId: string) => Promise<void>;
  setActiveOrder: (id: string) => void;
  addToCart: (product: Product) => Promise<AddToCartResult>;
  updateQuantity: (cartItemId: string, delta: number) => Promise<AddToCartResult>;
  setItemNote: (cartItemId: string, note: string) => Promise<void>;
  removeSentItem: (orderId: string, cartItemId: string, quantity: number, restock: boolean) => Promise<void>;
  payOrder: (orderId: string, payment: PaymentInput) => Promise<PaidOrder | null>;
  splitOrder: (originalOrderId: string, itemsToMove: { id: string, quantity: number }[]) => Promise<void>;
  sendToKitchen: (orderId: string) => Promise<void>;
  markAsReady: (orderId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  clearData: () => Promise<void>;
}

const generateOrderId = () => Math.random().toString(36).substr(2, 9);

const round2 = (n: number) => Math.round(n * 100) / 100;

const calcTotal = (items: CartItem[]) =>
  round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

// Firestore no acepta campos `undefined`; el round-trip JSON los elimina.
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const currentUserName = () => useAuthStore.getState().activeUser?.name || 'Desconocido';

// Lee la orden dentro de una transacción, aplica `mutate` sobre una copia y la guarda.
// Así dos dispositivos editando la misma cuenta no se pisan los cambios.
async function mutateOrder(
  orderId: string,
  mutate: (order: Order, tx: Transaction) => void,
) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'orders', orderId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La cuenta ya no existe.');
    const order = clean(snap.data() as Order);
    mutate(order, tx);
    order.total = calcTotal(order.items);
    tx.update(ref, { items: clean(order.items), total: order.total });
  });
}

// Descuenta del inventario las piezas de los productos con control de stock.
function consumeStock(tx: Transaction, items: CartItem[]) {
  const { getRecord } = useInventoryStore.getState();
  const byProduct: Record<string, number> = {};
  items.forEach(item => {
    if (getRecord(item.id).tracked) {
      byProduct[item.id] = (byProduct[item.id] || 0) + item.quantity;
    }
  });
  Object.entries(byProduct).forEach(([productId, qty]) => {
    tx.set(doc(db, 'inventory', productId), { stock: increment(-qty), updatedAt: Date.now() }, { merge: true });
  });
}

function hasStockFor(productId: string, orders: Order[]): boolean {
  const record = useInventoryStore.getState().getRecord(productId);
  const { status } = getAvailability(record, reservedQuantity(orders, productId));
  return status === 'ok' || status === 'low';
}

export const useCartStore = create<CartState>((set, get) => ({

  orders: [],
  paidOrders: [],
  alerts: [],
  activeOrderId: null,
  lastCutTime: 0,

  initListeners: () => {
    // Listen to active orders
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order).sort((a,b) => a.createdAt - b.createdAt);
      set({ orders });
      // If active order is deleted, reset activeOrderId
      const currentActive = get().activeOrderId;
      if (currentActive && !orders.find(o => o.id === currentActive)) {
        set({ activeOrderId: orders.length > 0 ? orders[orders.length - 1].id : null });
      }
    }, (error) => {
      console.error("🔥 Error escuchando orders:", error);
    });

    // Listen to paid orders
    const unsubPaid = onSnapshot(collection(db, 'paidOrders'), (snapshot) => {
      const paidOrders = snapshot.docs.map(doc => doc.data() as PaidOrder).sort((a,b) => a.createdAt - b.createdAt);
      set({ paidOrders });
    }, (error) => {
      console.error("🔥 Error escuchando paidOrders:", error);
    });

    // Listen to alerts
    const unsubAlerts = onSnapshot(collection(db, 'alerts'), (snapshot) => {
      const alerts = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as Alert;
      }).sort((a,b) => a.createdAt - b.createdAt);
      set({ alerts });
    }, (error) => {
      console.error("🔥 Error escuchando alerts:", error);
    });

    // Listen to config
    const unsubConfig = onSnapshot(doc(db, 'config', 'store'), (docSnap) => {
      if (docSnap.exists()) {
        set({ lastCutTime: docSnap.data().lastCutTime || 0 });
      }
    }, (error) => {
      console.error("🔥 Error escuchando config:", error);
    });

    // Retornamos una función para limpiar los listeners
    return () => {
      unsubOrders();
      unsubPaid();
      unsubAlerts();
      unsubConfig();
    };
  },

  createOrder: async (name) => {
    const id = generateOrderId();
    const newOrder: Order = {
      id,
      name: name.trim(),
      waiter: currentUserName(),
      items: [],
      total: 0,
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'orders', id), newOrder);
    set({ activeOrderId: id });
    return id;
  },

  renameOrder: async (orderId, name) => {
    await updateDoc(doc(db, 'orders', orderId), { name: name.trim() });
  },

  deleteEmptyOrder: async (orderId) => {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'orders', orderId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      if ((snap.data() as Order).items.length > 0) {
        throw new Error('Solo se pueden eliminar cuentas vacías.');
      }
      tx.delete(ref);
    });
  },

  setActiveOrder: (id) => set({ activeOrderId: id }),

  addToCart: async (product) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId || !orders.some(o => o.id === activeOrderId)) return 'no-order';
    if (!hasStockFor(product.id, orders)) return 'out-of-stock';

    await mutateOrder(activeOrderId, (order) => {
      const existing = order.items.find(item => item.id === product.id && item.status === 'nuevo' && !item.note);
      if (existing) {
        existing.quantity += 1;
      } else {
        order.items.push({
          ...product,
          cartItemId: generateOrderId(),
          quantity: 1,
          status: 'nuevo',
        });
      }
    });
    return 'ok';
  },

  updateQuantity: async (cartItemId, delta) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return 'no-order';

    const item = orders.find(o => o.id === activeOrderId)?.items.find(i => i.cartItemId === cartItemId);
    if (!item) return 'ok';
    if (delta > 0 && !hasStockFor(item.id, orders)) return 'out-of-stock';

    await mutateOrder(activeOrderId, (order) => {
      order.items = order.items.map(i =>
        i.cartItemId === cartItemId && i.status === 'nuevo' ? { ...i, quantity: i.quantity + delta } : i
      ).filter(i => i.quantity > 0);
    });
    return 'ok';
  },

  setItemNote: async (cartItemId, note) => {
    const { activeOrderId } = get();
    if (!activeOrderId) return;
    await mutateOrder(activeOrderId, (order) => {
      const item = order.items.find(i => i.cartItemId === cartItemId);
      if (!item || item.status !== 'nuevo') return;
      const trimmed = note.trim();
      if (trimmed) item.note = trimmed;
      else delete item.note;
    });
  },

  // Quita piezas que ya se enviaron a cocina (solo admin). Opcionalmente las regresa al inventario.
  removeSentItem: async (orderId, cartItemId, quantity, restock) => {
    await mutateOrder(orderId, (order, tx) => {
      const item = order.items.find(i => i.cartItemId === cartItemId);
      if (!item || item.status === 'nuevo') return;
      const qty = Math.min(quantity, item.quantity);
      item.quantity -= qty;
      order.items = order.items.filter(i => i.quantity > 0);

      if (restock && useInventoryStore.getState().getRecord(item.id).tracked) {
        tx.set(doc(db, 'inventory', item.id), { stock: increment(qty), updatedAt: Date.now() }, { merge: true });
      }
    });
  },

  payOrder: async (orderId, payment) => {
    let paid: PaidOrder | null = null;

    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'orders', orderId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('La cuenta ya fue cobrada o eliminada.');
      const order = clean(snap.data() as Order);

      const subtotal = calcTotal(order.items);
      const discount = round2(Math.min(Math.max(0, payment.discount), subtotal));
      const tip = round2(Math.max(0, payment.tip));

      paid = clean<PaidOrder>({
        ...order,
        total: round2(subtotal - discount),
        discount,
        tip,
        tipPercent: payment.tipPercent,
        paymentMethod: payment.method,
        paidAt: Date.now(),
        paidBy: currentUserName(),
        cashTendered: payment.method === 'Efectivo' ? payment.cashTendered : undefined,
        change: payment.method === 'Efectivo' ? payment.change : undefined,
      });

      // Lo que nunca pasó por cocina (p. ej. bebidas servidas directo) se descuenta al cobrar
      consumeStock(tx, order.items.filter(i => i.status === 'nuevo'));

      tx.set(doc(db, 'paidOrders', order.id), paid);
      tx.delete(ref);
    });

    return paid;
  },

  splitOrder: async (originalOrderId, itemsToMove) => {
    const activeUser = useAuthStore.getState().activeUser;
    const newOrderId = generateOrderId();

    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'orders', originalOrderId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('La cuenta ya no existe.');
      const originalOrder = clean(snap.data() as Order);
      const newItems: CartItem[] = [];

      itemsToMove.forEach(moveRequest => {
        const item = originalOrder.items.find(i => i.cartItemId === moveRequest.id);
        if (!item) return;
        const quantityToMove = Math.min(item.quantity, moveRequest.quantity);
        if (quantityToMove > 0) {
          newItems.push({ ...item, cartItemId: generateOrderId(), quantity: quantityToMove });
          item.quantity -= quantityToMove;
        }
      });

      if (newItems.length === 0) return;

      originalOrder.items = originalOrder.items.filter(item => item.quantity > 0);

      if (originalOrder.items.length === 0) {
        tx.delete(ref);
      } else {
        tx.update(ref, { items: originalOrder.items, total: calcTotal(originalOrder.items) });
      }

      const newOrder: Order = {
        id: newOrderId,
        name: `${originalOrder.name} (Separada)`,
        waiter: activeUser?.name || originalOrder.waiter,
        items: newItems,
        total: calcTotal(newItems),
        createdAt: Date.now(),
      };
      tx.set(doc(db, 'orders', newOrderId), clean(newOrder));
    });

    set({ activeOrderId: newOrderId }); // Switch to the new order to pay it immediately
  },

  clearData: async () => {
    const batch = writeBatch(db);
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    ordersSnapshot.forEach(d => batch.delete(d.ref));

    const alertsSnapshot = await getDocs(collection(db, 'alerts'));
    alertsSnapshot.forEach(d => batch.delete(d.ref));

    // Guardar el tiempo del último corte
    batch.set(doc(db, 'config', 'store'), { lastCutTime: Date.now() }, { merge: true });

    await batch.commit();
  },

  sendToKitchen: async (orderId) => {
    await mutateOrder(orderId, (order, tx) => {
      const newItems = order.items.filter(item => item.status === 'nuevo');
      if (newItems.length === 0) return;
      const now = Date.now();
      newItems.forEach(item => {
        item.status = 'preparando';
        item.sentToKitchenAt = now;
      });
      consumeStock(tx, newItems);
    });
  },

  markAsReady: async (orderId) => {
    const { orders } = get();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = JSON.parse(JSON.stringify(orders[orderIndex]));
    let hasChanges = false;
    order.items.forEach((item: CartItem) => {
      if (item.status === 'preparando') {
        item.status = 'listo';
        item.finishedAt = Date.now();
        hasChanges = true;
      }
    });

    if (!hasChanges) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', order.id), { items: order.items });

    const newAlertRef = doc(collection(db, 'alerts'));
    const newAlert: Alert = {
      id: newAlertRef.id,
      orderId: order.id,
      orderName: order.name,
      waiter: order.waiter,
      message: `La orden ${order.name} ya está lista para llevar al cliente.`,
      read: false,
      createdAt: Date.now(),
    };
    batch.set(newAlertRef, newAlert);

    await batch.commit();
  },

  dismissAlert: async (alertId) => {
    await updateDoc(doc(db, 'alerts', alertId), { read: true });
  }
}));
