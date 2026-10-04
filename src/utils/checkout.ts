import type { PaymentMethod } from '../store/useCartStore';
import { round2 } from './orders';

// Convierte lo que escribe el cajero en un monto; vacío, negativo o inválido = 0
export const parseAmount = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export interface CheckoutInput {
  subtotal: number;
  method: PaymentMethod;
  discountInput: string;
  tipPercent: number;     // botón elegido (tarjeta)
  customPercent: string;  // "Otro %" (tarjeta); tiene prioridad si no está vacío
  cashTipInput: string;   // monto de propina (efectivo)
  tenderedInput: string;  // efectivo recibido
}

export interface CheckoutSummary {
  discount: number;
  discountExceeds: boolean;
  total: number;            // venta después del descuento
  tipPercent: number;       // porcentaje aplicado (0 en efectivo)
  tip: number;
  grandTotal: number;       // venta + propina
  tendered: number;
  change: number;
  cashValid: boolean;
}

// Tarjeta: propina por porcentaje sobre la venta con descuento.
// Efectivo: propina por monto; el cambio se calcula sobre venta + propina.
export function computeCheckout(input: CheckoutInput): CheckoutSummary {
  const requestedDiscount = parseAmount(input.discountInput);
  const discount = round2(Math.min(requestedDiscount, input.subtotal));
  const total = round2(input.subtotal - discount);

  const isCard = input.method === 'Tarjeta';
  const tipPercent = isCard ? (input.customPercent !== '' ? parseAmount(input.customPercent) : input.tipPercent) : 0;
  const tip = isCard ? round2(total * tipPercent / 100) : round2(parseAmount(input.cashTipInput));
  const grandTotal = round2(total + tip);

  const tendered = parseAmount(input.tenderedInput);
  return {
    discount,
    discountExceeds: requestedDiscount > input.subtotal,
    total,
    tipPercent,
    tip,
    grandTotal,
    tendered,
    change: round2(tendered - grandTotal),
    cashValid: tendered >= grandTotal,
  };
}

// Atajos de "efectivo recibido": exacto y los siguientes billetes redondos
export function quickCashAmounts(grandTotal: number): number[] {
  return [grandTotal, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500]
    .filter((v, i, a) => v > 0 && a.indexOf(v) === i);
}
