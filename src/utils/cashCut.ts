import type { PaidOrder } from '../store/useCartStore';

export type CancellationReason = 'Cliente ya no lo quiso' | 'Error al capturar' | 'Tardó demasiado' | 'Otro';

export const CANCELLATION_REASONS: CancellationReason[] = [
  'Cliente ya no lo quiso', 'Error al capturar', 'Tardó demasiado', 'Otro',
];

// Registro de un producto quitado de una cuenta después de enviarse a cocina.
// Queda guardado para el corte: quién lo quitó, cuándo y por qué.
export interface Cancellation {
  id: string;
  orderId: string;
  orderName: string;
  waiter: string;        // mesero de la cuenta
  cancelledBy: string;   // quien lo quitó
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  status: 'preparando' | 'listo'; // en qué estado estaba al cancelarse
  reason: string;
  restocked: boolean;    // las piezas regresaron al inventario
  createdAt: number;
}

export interface WaiterSummary {
  waiter: string;
  orders: number;
  sales: number;
  tips: number;
}

// Totales de un turno: todo lo cobrado entre `from` (exclusivo) y `to` (inclusivo)
export interface ShiftSummary {
  from: number;
  to: number;
  orderCount: number;
  sales: number;      // ventas netas (ya con descuento, sin propina)
  cashSales: number;
  cardSales: number;
  discounts: number;
  tips: number;
  cashTips: number;
  cardTips: number;
  byWaiter: WaiterSummary[];
  cancelledItems: number;
  cancelledAmount: number;
}

// Corte de caja guardado en `cashCuts/{id}`
export interface CashCut extends ShiftSummary {
  id: string;
  createdAt: number;
  madeBy: string;
  openOrders: number;        // cuentas abiertas que pasan al siguiente turno
  openingFloat: number;      // fondo de caja al iniciar el turno
  expectedCash: number;      // fondo + ventas en efectivo + propinas en efectivo
  countedCash: number | null;
  difference: number | null; // contado - esperado (negativo = faltante)
  notes: string;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const inShift = (ts: number, from: number, to = Infinity) => ts > from && ts <= to;

export function summarizeShift(
  paidOrders: PaidOrder[],
  cancellations: Cancellation[],
  from: number,
  to: number,
): ShiftSummary {
  const orders = paidOrders.filter(o => inShift(o.paidAt, from, to));
  const cancelled = cancellations.filter(c => inShift(c.createdAt, from, to));

  let sales = 0, cashSales = 0, cardSales = 0, discounts = 0, tips = 0, cashTips = 0, cardTips = 0;
  const waiters: Record<string, WaiterSummary> = {};

  orders.forEach(o => {
    const tip = o.tip || 0;
    sales += o.total;
    discounts += o.discount || 0;
    tips += tip;
    if (o.paymentMethod === 'Efectivo') {
      cashSales += o.total;
      cashTips += tip;
    } else {
      cardSales += o.total;
      cardTips += tip;
    }
    const name = o.waiter || 'Desconocido';
    const w = waiters[name] ||= { waiter: name, orders: 0, sales: 0, tips: 0 };
    w.orders += 1;
    w.sales += o.total;
    w.tips += tip;
  });

  return {
    from,
    to,
    orderCount: orders.length,
    sales: round2(sales),
    cashSales: round2(cashSales),
    cardSales: round2(cardSales),
    discounts: round2(discounts),
    tips: round2(tips),
    cashTips: round2(cashTips),
    cardTips: round2(cardTips),
    byWaiter: Object.values(waiters)
      .map(w => ({ ...w, sales: round2(w.sales), tips: round2(w.tips) }))
      .sort((a, b) => b.sales - a.sales),
    cancelledItems: cancelled.reduce((n, c) => n + c.quantity, 0),
    cancelledAmount: round2(cancelled.reduce((n, c) => n + c.quantity * c.unitPrice, 0)),
  };
}

export const expectedCash = (summary: ShiftSummary, openingFloat: number) =>
  round2(openingFloat + summary.cashSales + summary.cashTips);
