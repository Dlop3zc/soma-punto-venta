import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import type { Product } from '../data/mockProducts';

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  name: string;
  waiter: string;
  items: CartItem[];
  total: number;
  createdAt: number;
}

export interface PaidOrder extends Order {
  paymentMethod: 'Efectivo' | 'Tarjeta';
  paidAt: number;
  cashTendered?: number;
  change?: number;
}

interface CartState {
  waiters: string[];
  currentWaiter: string | null;
  setCurrentWaiter: (name: string) => void;
  
  orders: Order[];
  paidOrders: PaidOrder[];
  activeOrderId: string | null;
  
  initListeners: () => void;
  createOrder: () => Promise<string>;
  setActiveOrder: (id: string) => void;
  addToCart: (product: Product) => Promise<void>;
  updateQuantity: (productId: string, delta: number) => Promise<void>;
  payActiveOrder: (method: 'Efectivo' | 'Tarjeta', cashTendered?: number, change?: number) => Promise<void>;
  clearData: () => Promise<void>;
}

const generateOrderId = () => Math.random().toString(36).substr(2, 9);

export const useCartStore = create<CartState>((set, get) => ({
  waiters: ['Ana', 'Carlos', 'Luis', 'Marta', 'Jorge'],
  currentWaiter: null,
  setCurrentWaiter: (name) => set({ currentWaiter: name }),

  orders: [],
  paidOrders: [],
  activeOrderId: null,

  initListeners: () => {
    // Listen to active orders
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order).sort((a,b) => a.createdAt - b.createdAt);
      set({ orders });
      // If active order is deleted, reset activeOrderId
      const currentActive = get().activeOrderId;
      if (currentActive && !orders.find(o => o.id === currentActive)) {
        set({ activeOrderId: orders.length > 0 ? orders[orders.length - 1].id : null });
      }
    });

    // Listen to paid orders
    onSnapshot(collection(db, 'paidOrders'), (snapshot) => {
      const paidOrders = snapshot.docs.map(doc => doc.data() as PaidOrder).sort((a,b) => a.createdAt - b.createdAt);
      set({ paidOrders });
    });
  },

  createOrder: async () => {
    const id = generateOrderId();
    const currentOrdersCount = get().orders.length + get().paidOrders.length;
    const waiter = get().currentWaiter || 'Desconocido';
    
    const newOrder: Order = {
      id,
      name: `Cuenta ${currentOrdersCount + 1}`,
      waiter,
      items: [],
      total: 0,
      createdAt: Date.now(),
    };
    
    set({ activeOrderId: id }); // Set active locally immediately
    await setDoc(doc(db, 'orders', id), newOrder);
    return id;
  },

  setActiveOrder: (id) => set({ activeOrderId: id }),

  addToCart: async (product) => {
    let currentOrderId = get().activeOrderId;
    const orders = get().orders;
    const waiter = get().currentWaiter || 'Desconocido';

    let orderIndex = orders.findIndex(o => o.id === currentOrderId);
    let order: Order;

    if (!currentOrderId || orderIndex === -1) {
      currentOrderId = generateOrderId();
      order = {
        id: currentOrderId,
        name: `Cuenta ${orders.length + get().paidOrders.length + 1}`,
        waiter,
        items: [],
        total: 0,
        createdAt: Date.now(),
      };
      set({ activeOrderId: currentOrderId });
    } else {
      order = JSON.parse(JSON.stringify(orders[orderIndex]));
    }

    const existingItemIndex = order.items.findIndex((item: CartItem) => item.id === product.id);

    if (existingItemIndex >= 0) {
      order.items[existingItemIndex].quantity += 1;
    } else {
      order.items.push({ ...product, quantity: 1 });
    }

    order.total = order.items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

    await setDoc(doc(db, 'orders', order.id), order);
  },

  updateQuantity: async (productId, delta) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return;

    const orderIndex = orders.findIndex(o => o.id === activeOrderId);
    if (orderIndex === -1) return;

    const order: Order = JSON.parse(JSON.stringify(orders[orderIndex]));
    order.items = order.items.map((item: CartItem) => {
      if (item.id === productId) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter((item: CartItem) => item.quantity > 0);

    order.total = order.items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
    await updateDoc(doc(db, 'orders', order.id), { items: order.items, total: order.total });
  },

  payActiveOrder: async (method, cashTendered, change) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return;

    const orderToPay = orders.find(o => o.id === activeOrderId);
    if (!orderToPay) return;

    const newPaidOrder: PaidOrder = {
      ...orderToPay,
      paymentMethod: method,
      paidAt: Date.now(),
      ...(method === 'Efectivo' && cashTendered !== undefined && { cashTendered }),
      ...(method === 'Efectivo' && change !== undefined && { change }),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'paidOrders', orderToPay.id), newPaidOrder);
    batch.delete(doc(db, 'orders', orderToPay.id));
    await batch.commit();
  },

  clearData: async () => {
    const batch = writeBatch(db);
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    ordersSnapshot.forEach(d => batch.delete(d.ref));
    
    const paidSnapshot = await getDocs(collection(db, 'paidOrders'));
    paidSnapshot.forEach(d => batch.delete(d.ref));

    await batch.commit();
  }
}));
