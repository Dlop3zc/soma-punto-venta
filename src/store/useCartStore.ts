import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import type { Product } from '../data/mockProducts';
import { useAuthStore } from './useAuthStore';

export interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  status: 'nuevo' | 'preparando' | 'listo';
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

export interface PaidOrder extends Order {
  paymentMethod: 'Efectivo' | 'Tarjeta';
  paidAt: number;
  cashTendered?: number;
  change?: number;
  discount?: number;
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

interface CartState {
  orders: Order[];
  paidOrders: PaidOrder[];
  alerts: Alert[];
  activeOrderId: string | null;
  lastCutTime: number;
  
  initListeners: () => () => void;
  createOrder: () => Promise<string>;
  setActiveOrder: (id: string) => void;
  addToCart: (product: Product) => Promise<void>;
  updateQuantity: (cartItemId: string, delta: number) => Promise<void>;
  payActiveOrder: (method: 'Efectivo' | 'Tarjeta', discount?: number, cashTendered?: number, change?: number) => Promise<void>;
  splitOrder: (originalOrderId: string, itemsToMove: { id: string, quantity: number }[]) => Promise<void>;
  sendToKitchen: (orderId: string) => Promise<void>;
  markAsReady: (orderId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  clearData: () => Promise<void>;
}

const generateOrderId = () => Math.random().toString(36).substr(2, 9);

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

  createOrder: async () => {
    const id = generateOrderId();
    const currentOrdersCount = get().orders.length + get().paidOrders.length;
    const activeUser = useAuthStore.getState().activeUser;
    const waiter = activeUser ? activeUser.name : 'Desconocido';
    
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
    const activeUser = useAuthStore.getState().activeUser;
    const waiter = activeUser ? activeUser.name : 'Desconocido';

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

    const existingItemIndex = order.items.findIndex((item: CartItem) => item.id === product.id && item.status === 'nuevo');

    if (existingItemIndex >= 0) {
      order.items[existingItemIndex].quantity += 1;
    } else {
      order.items.push({ 
        ...product, 
        cartItemId: generateOrderId(),
        quantity: 1,
        status: 'nuevo'
      });
    }

    order.total = order.items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

    await setDoc(doc(db, 'orders', order.id), order);
  },

  updateQuantity: async (cartItemId, delta) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return;

    const orderIndex = orders.findIndex(o => o.id === activeOrderId);
    if (orderIndex === -1) return;

    const order: Order = JSON.parse(JSON.stringify(orders[orderIndex]));
    order.items = order.items.map((item: CartItem) => {
      if (item.cartItemId === cartItemId && item.status === 'nuevo') {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter((item: CartItem) => item.quantity > 0);

    order.total = order.items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
    await updateDoc(doc(db, 'orders', order.id), { items: order.items, total: order.total });
  },

  payActiveOrder: async (method, discount = 0, cashTendered, change) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return;

    const orderToPay = orders.find(o => o.id === activeOrderId);
    if (!orderToPay) return;

    const newPaidOrder: PaidOrder = {
      ...orderToPay,
      total: Math.max(0, orderToPay.total - discount),
      discount,
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

  splitOrder: async (originalOrderId, itemsToMove) => {
    const { orders } = get();
    const activeUser = useAuthStore.getState().activeUser;
    const currentWaiter = activeUser ? activeUser.name : null;
    const orderIndex = orders.findIndex(o => o.id === originalOrderId);
    if (orderIndex === -1) return;

    // Deep clone to avoid mutating local state directly
    const originalOrder: Order = JSON.parse(JSON.stringify(orders[orderIndex]));
    const newItems: CartItem[] = [];

    // Process items to move
    itemsToMove.forEach(moveRequest => {
      const itemIndex = originalOrder.items.findIndex(i => i.cartItemId === moveRequest.id);
      if (itemIndex > -1) {
        const item = originalOrder.items[itemIndex];
        // Move the requested quantity
        const quantityToMove = Math.min(item.quantity, moveRequest.quantity);
        
        if (quantityToMove > 0) {
          // Add to new items
          newItems.push({ ...item, cartItemId: generateOrderId(), quantity: quantityToMove });
          // Deduct from original
          item.quantity -= quantityToMove;
        }
      }
    });

    // Remove items that now have 0 quantity in original order
    originalOrder.items = originalOrder.items.filter(item => item.quantity > 0);
    originalOrder.total = originalOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Create the new order
    const newOrderId = generateOrderId();
    const newOrder: Order = {
      id: newOrderId,
      name: `Cuenta ${orders.length + get().paidOrders.length + 1} (Separada)`,
      waiter: currentWaiter || originalOrder.waiter,
      items: newItems,
      total: newItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      createdAt: Date.now(),
    };

    const batch = writeBatch(db);
    
    // If the original order has no items left, we delete it, otherwise we update it
    if (originalOrder.items.length === 0) {
      batch.delete(doc(db, 'orders', originalOrder.id));
    } else {
      batch.update(doc(db, 'orders', originalOrder.id), { 
        items: originalOrder.items, 
        total: originalOrder.total 
      });
    }

    // Save the new order
    batch.set(doc(db, 'orders', newOrderId), newOrder);
    
    await batch.commit();
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
    const { orders } = get();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = JSON.parse(JSON.stringify(orders[orderIndex]));
    let hasChanges = false;
    order.items.forEach((item: CartItem) => {
      if (item.status === 'nuevo') {
        item.status = 'preparando';
        item.sentToKitchenAt = Date.now();
        hasChanges = true;
      }
    });

    if (hasChanges) {
      await updateDoc(doc(db, 'orders', order.id), { items: order.items });
    }
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
