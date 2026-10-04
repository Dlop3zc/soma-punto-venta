import { describe, test, expect } from 'vitest';
import { calcTotal, buildPaidOrder, splitItems, stockToConsume } from './orders';
import { item, order } from '../test/fixtures';

describe('calcTotal', () => {
  test('suma precio por cantidad', () => {
    expect(calcTotal([item({ price: 85, quantity: 2 }), item({ price: 120, quantity: 1 })])).toBe(290);
  });

  test('redondea a centavos sin errores de punto flotante', () => {
    // 0.1 * 3 = 0.30000000000000004 en JavaScript
    expect(calcTotal([item({ price: 0.1, quantity: 3 })])).toBe(0.3);
  });

  test('cuenta vacía vale 0', () => {
    expect(calcTotal([])).toBe(0);
  });
});

describe('buildPaidOrder', () => {
  const meta = { paidAt: 1000, paidBy: 'Ana' };

  test('tarjeta con propina: la propina no se suma a la venta', () => {
    const paid = buildPaidOrder(order([item({ price: 100, quantity: 2 })]), { method: 'Tarjeta', discount: 0, tip: 30, tipPercent: 15 }, meta);
    expect(paid.total).toBe(200);
    expect(paid.tip).toBe(30);
    expect(paid.tipPercent).toBe(15);
    expect(paid.cashTendered).toBeUndefined();
    expect(paid.change).toBeUndefined();
    expect(paid.paidBy).toBe('Ana');
  });

  test('efectivo guarda lo recibido y el cambio', () => {
    const paid = buildPaidOrder(order([item({ price: 85 })]), { method: 'Efectivo', discount: 0, tip: 0, cashTendered: 100, change: 15 }, meta);
    expect(paid.cashTendered).toBe(100);
    expect(paid.change).toBe(15);
  });

  test('el descuento se aplica a la venta', () => {
    const paid = buildPaidOrder(order([item({ price: 100 })]), { method: 'Tarjeta', discount: 20, tip: 0 }, meta);
    expect(paid.total).toBe(80);
    expect(paid.discount).toBe(20);
  });

  test('un descuento negativo se ignora (no puede subir el cobro)', () => {
    const paid = buildPaidOrder(order([item({ price: 100 })]), { method: 'Tarjeta', discount: -50, tip: 0 }, meta);
    expect(paid.total).toBe(100);
    expect(paid.discount).toBe(0);
  });

  test('el descuento no puede ser mayor que la cuenta', () => {
    const paid = buildPaidOrder(order([item({ price: 100 })]), { method: 'Tarjeta', discount: 500, tip: 0 }, meta);
    expect(paid.total).toBe(0);
    expect(paid.discount).toBe(100);
  });

  test('una propina negativa se guarda como 0', () => {
    const paid = buildPaidOrder(order([item({ price: 100 })]), { method: 'Efectivo', discount: 0, tip: -10 }, meta);
    expect(paid.tip).toBe(0);
  });

  test('el total se recalcula de los productos, no del total guardado', () => {
    const o = order([item({ price: 50, quantity: 2 })], { total: 999 });
    expect(buildPaidOrder(o, { method: 'Tarjeta', discount: 0, tip: 0 }, meta).total).toBe(100);
  });
});

describe('splitItems', () => {
  let n = 0;
  const newId = () => `nuevo${++n}`;

  test('mueve piezas a la cuenta nueva y descuenta de la original', () => {
    const corona = item({ cartItemId: 'a', quantity: 3 });
    const chelada = item({ id: 'mich-1', name: 'Chelada', price: 120, cartItemId: 'b', quantity: 1 });
    const { remaining, moved } = splitItems([corona, chelada], [{ id: 'a', quantity: 2 }], newId);

    expect(remaining.map(i => [i.cartItemId, i.quantity])).toEqual([['a', 1], ['b', 1]]);
    expect(moved).toHaveLength(1);
    expect(moved[0].quantity).toBe(2);
    expect(moved[0].cartItemId).not.toBe('a');
  });

  test('si se mueve todo un renglón, desaparece de la original', () => {
    const { remaining, moved } = splitItems([item({ cartItemId: 'a', quantity: 2 })], [{ id: 'a', quantity: 2 }], newId);
    expect(remaining).toEqual([]);
    expect(moved[0].quantity).toBe(2);
  });

  test('no se pueden mover más piezas de las que hay', () => {
    const { remaining, moved } = splitItems([item({ cartItemId: 'a', quantity: 2 })], [{ id: 'a', quantity: 10 }], newId);
    expect(moved[0].quantity).toBe(2);
    expect(remaining).toEqual([]);
  });

  test('identifica renglones por cartItemId aunque el producto se repita', () => {
    // El mismo producto en dos renglones: uno ya en cocina y otro nuevo
    const enCocina = item({ cartItemId: 'a', quantity: 1, status: 'preparando' });
    const nuevo = item({ cartItemId: 'b', quantity: 1, status: 'nuevo' });
    const { remaining, moved } = splitItems([enCocina, nuevo], [{ id: 'b', quantity: 1 }], newId);
    expect(moved[0].status).toBe('nuevo');
    expect(remaining.map(i => i.cartItemId)).toEqual(['a']);
  });

  test('ids inexistentes o cantidades no válidas no mueven nada', () => {
    const items = [item({ cartItemId: 'a', quantity: 2 })];
    const { remaining, moved } = splitItems(items, [{ id: 'zzz', quantity: 1 }, { id: 'a', quantity: -3 }], newId);
    expect(moved).toEqual([]);
    expect(remaining[0].quantity).toBe(2);
  });

  test('no modifica los productos originales', () => {
    const items = [item({ cartItemId: 'a', quantity: 3 })];
    splitItems(items, [{ id: 'a', quantity: 1 }], newId);
    expect(items[0].quantity).toBe(3);
  });
});

describe('stockToConsume', () => {
  test('agrupa por producto y solo cuenta los que tienen control de stock', () => {
    const items = [
      item({ id: 'cag-1', quantity: 2 }),
      item({ id: 'cag-1', quantity: 1 }),
      item({ id: 'snk-1', quantity: 4 }),
    ];
    expect(stockToConsume(items, id => id === 'cag-1')).toEqual({ 'cag-1': 3 });
  });
});
