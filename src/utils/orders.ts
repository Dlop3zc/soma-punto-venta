import type { CartItem, PaidOrder, Order, PaymentInput } from '../store/useCartStore';

// Cálculos de cuentas sin Firebase, para poder probarlos.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const calcTotal = (items: Pick<CartItem, 'price' | 'quantity'>[]) =>
  round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

// Arma la venta cobrada. El descuento nunca es negativo ni mayor al subtotal,
// y la propina se guarda aparte del total de la venta.
export function buildPaidOrder(order: Order, payment: PaymentInput, meta: { paidAt: number; paidBy: string }): PaidOrder {
  const subtotal = calcTotal(order.items);
  const discount = round2(Math.min(Math.max(0, payment.discount), subtotal));
  const tip = round2(Math.max(0, payment.tip));
  const isCash = payment.method === 'Efectivo';

  return {
    ...order,
    total: round2(subtotal - discount),
    discount,
    tip,
    tipPercent: payment.tipPercent,
    paymentMethod: payment.method,
    paidAt: meta.paidAt,
    paidBy: meta.paidBy,
    cashTendered: isCash ? payment.cashTendered : undefined,
    change: isCash ? payment.change : undefined,
  };
}

// Separa piezas de una cuenta. `moves` usa el cartItemId de cada renglón.
export function splitItems(
  items: CartItem[],
  moves: { id: string; quantity: number }[],
  newId: () => string,
): { remaining: CartItem[]; moved: CartItem[] } {
  const remaining = items.map(item => ({ ...item }));
  const moved: CartItem[] = [];

  moves.forEach(move => {
    const item = remaining.find(i => i.cartItemId === move.id);
    if (!item) return;
    const quantity = Math.min(item.quantity, Math.max(0, Math.floor(move.quantity)));
    if (quantity > 0) {
      moved.push({ ...item, cartItemId: newId(), quantity });
      item.quantity -= quantity;
    }
  });

  return { remaining: remaining.filter(i => i.quantity > 0), moved };
}

// Piezas a descontar del inventario, agrupadas por producto (solo productos con control)
export function stockToConsume(items: Pick<CartItem, 'id' | 'quantity'>[], isTracked: (productId: string) => boolean) {
  const byProduct: Record<string, number> = {};
  items.forEach(item => {
    if (isTracked(item.id)) byProduct[item.id] = (byProduct[item.id] || 0) + item.quantity;
  });
  return byProduct;
}
