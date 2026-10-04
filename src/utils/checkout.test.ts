import { describe, test, expect } from 'vitest';
import { computeCheckout, quickCashAmounts, parseAmount, type CheckoutInput } from './checkout';

const base: CheckoutInput = {
  subtotal: 290,
  method: 'Tarjeta',
  discountInput: '',
  tipPercent: 0,
  customPercent: '',
  cashTipInput: '',
  tenderedInput: '',
};

describe('parseAmount', () => {
  test.each([
    ['100', 100],
    ['12.5', 12.5],
    ['', 0],
    ['abc', 0],
    ['-20', 0],
  ])('"%s" → %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('cobro con tarjeta', () => {
  test('propina del 15% sobre la venta', () => {
    const r = computeCheckout({ ...base, tipPercent: 15 });
    expect(r.tip).toBe(43.5);
    expect(r.grandTotal).toBe(333.5);
    expect(r.tipPercent).toBe(15);
  });

  test('"Otro %" tiene prioridad sobre el botón elegido', () => {
    const r = computeCheckout({ ...base, tipPercent: 10, customPercent: '12' });
    expect(r.tip).toBe(34.8);
    expect(r.tipPercent).toBe(12);
  });

  test('la propina se calcula después del descuento', () => {
    const r = computeCheckout({ ...base, subtotal: 200, discountInput: '50', tipPercent: 10 });
    expect(r.total).toBe(150);
    expect(r.tip).toBe(15);
    expect(r.grandTotal).toBe(165);
  });

  test('con tarjeta se ignora la propina capturada para efectivo', () => {
    const r = computeCheckout({ ...base, cashTipInput: '50' });
    expect(r.tip).toBe(0);
  });

  test('redondea la propina a centavos', () => {
    const r = computeCheckout({ ...base, subtotal: 33.33, tipPercent: 15 });
    expect(r.tip).toBe(5);
  });
});

describe('cobro en efectivo', () => {
  const cash = { ...base, method: 'Efectivo' as const };

  test('el cambio considera venta + propina', () => {
    const r = computeCheckout({ ...cash, subtotal: 60, cashTipInput: '6', tenderedInput: '100' });
    expect(r.grandTotal).toBe(66);
    expect(r.change).toBe(34);
    expect(r.cashValid).toBe(true);
  });

  test('no se puede cobrar si falta efectivo', () => {
    const r = computeCheckout({ ...cash, subtotal: 290, tenderedInput: '200' });
    expect(r.cashValid).toBe(false);
  });

  test('pago exacto es válido y el cambio es 0', () => {
    const r = computeCheckout({ ...cash, subtotal: 290, tenderedInput: '290' });
    expect(r.cashValid).toBe(true);
    expect(r.change).toBe(0);
  });

  test('en efectivo no se usa el porcentaje de tarjeta', () => {
    const r = computeCheckout({ ...cash, tipPercent: 20, cashTipInput: '' });
    expect(r.tip).toBe(0);
    expect(r.tipPercent).toBe(0);
  });
});

describe('descuentos', () => {
  test('negativo se ignora', () => {
    const r = computeCheckout({ ...base, discountInput: '-50' });
    expect(r.discount).toBe(0);
    expect(r.total).toBe(290);
  });

  test('mayor que la cuenta se limita al total y avisa', () => {
    const r = computeCheckout({ ...base, discountInput: '500' });
    expect(r.discount).toBe(290);
    expect(r.total).toBe(0);
    expect(r.discountExceeds).toBe(true);
  });
});

describe('quickCashAmounts', () => {
  test('exacto y los siguientes billetes redondos, sin repetir', () => {
    expect(quickCashAmounts(290)).toEqual([290, 300, 500]);
    expect(quickCashAmounts(66)).toEqual([66, 100, 500]);
    expect(quickCashAmounts(500)).toEqual([500]);
  });

  test('sin monto no ofrece atajos', () => {
    expect(quickCashAmounts(0)).toEqual([]);
  });
});
