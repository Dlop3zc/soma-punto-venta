import { describe, test, expect } from 'vitest';
import { getAvailability, reservedQuantity, LOW_STOCK_THRESHOLD } from './stock';
import { item, order } from '../test/fixtures';

const tracked = (stock: number) => ({ tracked: true, stock, available: true });
const untracked = { tracked: false, stock: 0, available: true };

describe('reservedQuantity', () => {
  test('cuenta solo piezas "nuevo" de ese producto en todas las cuentas abiertas', () => {
    const orders = [
      order([item({ id: 'cag-1', quantity: 2 }), item({ id: 'cag-1', quantity: 1, status: 'preparando' })]),
      order([item({ id: 'cag-1', quantity: 3 }), item({ id: 'snk-1', quantity: 5 })]),
    ];
    // Las que ya se enviaron a cocina ya se descontaron del inventario
    expect(reservedQuantity(orders, 'cag-1')).toBe(5);
    expect(reservedQuantity(orders, 'otro')).toBe(0);
  });
});

describe('getAvailability', () => {
  test('sin control de stock siempre está disponible', () => {
    expect(getAvailability(untracked, 1000)).toEqual({ status: 'ok', remaining: null });
  });

  test('marcado como no disponible por el admin', () => {
    expect(getAvailability({ ...tracked(50), available: false }, 0).status).toBe('disabled');
  });

  test('descuenta lo apartado en cuentas', () => {
    expect(getAvailability(tracked(20), 5)).toEqual({ status: 'ok', remaining: 15 });
  });

  test(`stock bajo con ${LOW_STOCK_THRESHOLD} o menos`, () => {
    expect(getAvailability(tracked(LOW_STOCK_THRESHOLD), 0).status).toBe('low');
    expect(getAvailability(tracked(LOW_STOCK_THRESHOLD + 1), 0).status).toBe('ok');
  });

  test('agotado cuando lo apartado alcanza la existencia', () => {
    expect(getAvailability(tracked(3), 3)).toEqual({ status: 'out', remaining: 0 });
  });

  test('stock negativo (vendido sin existencia) se muestra como agotado, no como número negativo', () => {
    expect(getAvailability(tracked(-2), 0)).toEqual({ status: 'out', remaining: 0 });
  });
});
