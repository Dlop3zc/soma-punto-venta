import type { Order } from '../store/useCartStore';
import type { InventoryRecord } from '../store/useInventoryStore';

export const LOW_STOCK_THRESHOLD = 5;

export type AvailabilityStatus = 'ok' | 'low' | 'out' | 'disabled';

export interface Availability {
  status: AvailabilityStatus;
  remaining: number | null; // null = sin control de stock
}

// Piezas apartadas en cuentas abiertas que todavía no se descuentan del inventario
// (el stock se descuenta al enviar a cocina o al cobrar).
export function reservedQuantity(orders: Order[], productId: string): number {
  return orders.reduce((sum, order) =>
    sum + order.items
      .filter(item => item.id === productId && item.status === 'nuevo')
      .reduce((s, item) => s + item.quantity, 0)
  , 0);
}

export function getAvailability(record: InventoryRecord, reserved: number): Availability {
  if (!record.available) return { status: 'disabled', remaining: 0 };
  if (!record.tracked) return { status: 'ok', remaining: null };

  const remaining = Math.max(0, record.stock - reserved);
  if (remaining <= 0) return { status: 'out', remaining: 0 };
  if (remaining <= LOW_STOCK_THRESHOLD) return { status: 'low', remaining };
  return { status: 'ok', remaining };
}
