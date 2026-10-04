import type { CartItem, Order, PaidOrder } from '../store/useCartStore';

// Datos de ejemplo para las pruebas. Cada función acepta cambios puntuales.

let seq = 0;
const nextId = () => `id${++seq}`;

export function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'cag-1',
    name: 'Corona 1.2 LT',
    price: 85,
    category: 'Caguama',
    cartItemId: nextId(),
    quantity: 1,
    status: 'nuevo',
    ...overrides,
  };
}

export function order(items: CartItem[], overrides: Partial<Order> = {}): Order {
  return {
    id: nextId(),
    name: 'Mesa 1',
    waiter: 'Ana',
    items,
    total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    createdAt: 0,
    ...overrides,
  };
}

// Venta cobrada en una fecha local "AAAA-MM-DD HH:mm" (zona del negocio)
export function paid(at: string, items: CartItem[], overrides: Partial<PaidOrder> = {}): PaidOrder {
  const paidAt = new Date(at.replace(' ', 'T') + ':00').getTime();
  const base = order(items);
  return {
    ...base,
    paymentMethod: 'Tarjeta',
    paidAt,
    createdAt: paidAt - 3_600_000,
    ...overrides,
  };
}
