import type { PaidOrder } from '../store/useCartStore';
import type { InventoryRecord } from '../store/useInventoryStore';
import type { Product } from '../data/defaultMenu';

// ---------- Periodos ----------

export type PeriodPreset = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'personalizado';

export interface Range {
  start: number; // inclusivo (ms)
  end: number;   // exclusivo (ms)
}

const DAY = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function rangeForPreset(preset: PeriodPreset, now = new Date(), custom?: { from: string; to: string }): Range {
  const today = startOfDay(now);
  switch (preset) {
    case 'hoy': return { start: today, end: today + DAY };
    case 'ayer': return { start: today - DAY, end: today };
    case '7d': return { start: today - 6 * DAY, end: today + DAY };
    case '30d': return { start: today - 29 * DAY, end: today + DAY };
    case 'mes': return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: today + DAY };
    case 'personalizado': {
      const from = custom?.from ? startOfDay(new Date(custom.from + 'T00:00:00')) : today;
      const to = custom?.to ? startOfDay(new Date(custom.to + 'T00:00:00')) + DAY : today + DAY;
      return { start: Math.min(from, to - DAY), end: to };
    }
  }
}

// El periodo inmediatamente anterior, de la misma duración
export const previousRange = (r: Range): Range => ({ start: r.start - (r.end - r.start), end: r.start });

export const inRange = (orders: PaidOrder[], r: Range) =>
  orders.filter(o => o.paidAt >= r.start && o.paidAt < r.end);

export const rangeDays = (r: Range) => Math.max(1, Math.round((r.end - r.start) / DAY));

// ---------- KPIs ----------

export interface Kpis {
  revenue: number;      // ventas netas (después de descuento, sin propina)
  tickets: number;
  avgTicket: number;
  tips: number;
  tipRate: number;      // propina / ventas
  discounts: number;
  itemsSold: number;
  itemsPerTicket: number;
  cardShare: number;    // % de ventas cobradas con tarjeta
}

export function computeKpis(orders: PaidOrder[]): Kpis {
  const revenue = sum(orders, o => o.total);
  const tickets = orders.length;
  const tips = sum(orders, o => o.tip || 0);
  const itemsSold = sum(orders, o => sum(o.items, i => i.quantity));
  const card = sum(orders.filter(o => o.paymentMethod === 'Tarjeta'), o => o.total);
  return {
    revenue,
    tickets,
    avgTicket: tickets ? revenue / tickets : 0,
    tips,
    tipRate: revenue ? tips / revenue : 0,
    discounts: sum(orders, o => o.discount || 0),
    itemsSold,
    itemsPerTicket: tickets ? itemsSold / tickets : 0,
    cardShare: revenue ? card / revenue : 0,
  };
}

// Variación relativa; null cuando no hay base para comparar
export const delta = (current: number, previous: number): number | null =>
  previous === 0 ? null : (current - previous) / previous;

// ---------- Serie de tiempo ----------

export interface TimePoint {
  key: number;        // índice del bucket
  label: string;
  actual: number;
  anterior: number;
}

// Ventas por hora (periodos de 1 día) o por día, comparadas con el periodo anterior alineado
export function salesTimeline(orders: PaidOrder[], r: Range): { points: TimePoint[]; unit: 'hora' | 'día' } {
  const prev = previousRange(r);
  const days = rangeDays(r);

  if (days === 1) {
    const points: TimePoint[] = Array.from({ length: 24 }, (_, h) => ({ key: h, label: `${h}:00`, actual: 0, anterior: 0 }));
    inRange(orders, r).forEach(o => { points[new Date(o.paidAt).getHours()].actual += o.total; });
    inRange(orders, prev).forEach(o => { points[new Date(o.paidAt).getHours()].anterior += o.total; });
    // Recortar horas sin actividad en ambos extremos
    const active = points.filter(p => p.actual || p.anterior);
    if (!active.length) return { points: [], unit: 'hora' };
    return { points: points.slice(active[0].key, active[active.length - 1].key + 1), unit: 'hora' };
  }

  const points: TimePoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(r.start + i * DAY);
    return { key: i, label: `${d.getDate()}/${d.getMonth() + 1}`, actual: 0, anterior: 0 };
  });
  const bucket = (ts: number, base: number) => Math.round((startOfDay(new Date(ts)) - base) / DAY);
  inRange(orders, r).forEach(o => { const i = bucket(o.paidAt, r.start); if (points[i]) points[i].actual += o.total; });
  inRange(orders, prev).forEach(o => { const i = bucket(o.paidAt, prev.start); if (points[i]) points[i].anterior += o.total; });
  return { points, unit: 'día' };
}

// ---------- Mapa de calor día × hora ----------

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export interface Heatmap {
  hours: number[];             // horas con actividad (columnas)
  cells: number[][];           // [día 0=lunes][índice de hora] = ventas
  tickets: number[][];
  max: number;
}

export function salesHeatmap(orders: PaidOrder[]): Heatmap {
  const sales = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const tickets = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  orders.forEach(o => {
    const d = new Date(o.paidAt);
    const day = (d.getDay() + 6) % 7; // lunes = 0
    sales[day][d.getHours()] += o.total;
    tickets[day][d.getHours()] += 1;
  });
  const hours = Array.from({ length: 24 }, (_, h) => h).filter(h => sales.some(row => row[h] > 0));
  return {
    hours,
    cells: sales.map(row => hours.map(h => row[h])),
    tickets: tickets.map(row => hours.map(h => row[h])),
    max: Math.max(0, ...sales.flat()),
  };
}

// ---------- Productos (ABC / Pareto) ----------

export interface ProductStat {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;   // a precio de lista (antes de descuentos de la cuenta)
  share: number;     // % del ingreso de productos
  cumulative: number;
  abc: 'A' | 'B' | 'C';
  tickets: number;   // en cuántas cuentas aparece
}

export function productStats(orders: PaidOrder[]): ProductStat[] {
  const map = new Map<string, { name: string; category: string; quantity: number; revenue: number; tickets: Set<string> }>();
  orders.forEach(o => o.items.forEach(i => {
    const s = map.get(i.id) ?? { name: i.name, category: i.category, quantity: 0, revenue: 0, tickets: new Set<string>() };
    s.quantity += i.quantity;
    s.revenue += i.price * i.quantity;
    s.tickets.add(o.id);
    map.set(i.id, s);
  }));

  const total = [...map.values()].reduce((a, s) => a + s.revenue, 0);
  let running = 0;
  return [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([id, s]) => {
      const share = total ? s.revenue / total : 0;
      const before = running;
      running += share;
      // A: lo que forma el primer 80 % del ingreso; B: hasta 95 %; C: el resto
      const abc = before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C';
      return { id, name: s.name, category: s.category, quantity: s.quantity, revenue: s.revenue, share, cumulative: running, abc, tickets: s.tickets.size };
    });
}

export function categoryStats(orders: PaidOrder[]): { category: string; revenue: number; quantity: number; share: number }[] {
  const map = new Map<string, { revenue: number; quantity: number }>();
  orders.forEach(o => o.items.forEach(i => {
    const s = map.get(i.category) ?? { revenue: 0, quantity: 0 };
    s.revenue += i.price * i.quantity;
    s.quantity += i.quantity;
    map.set(i.category, s);
  }));
  const total = [...map.values()].reduce((a, s) => a + s.revenue, 0);
  return [...map.entries()]
    .map(([category, s]) => ({ category, ...s, share: total ? s.revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Productos que más se piden juntos en la misma cuenta
export function topPairs(orders: PaidOrder[], limit = 5): { a: string; b: string; count: number }[] {
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  orders.forEach(o => {
    const ids = [...new Set(o.items.map(i => { names.set(i.id, i.name); return i.id; }))].sort();
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        const k = `${ids[x]}|${ids[y]}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  });
  return [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, count]) => { const [a, b] = k.split('|'); return { a: names.get(a)!, b: names.get(b)!, count }; });
}

// ---------- Meseros ----------

export interface WaiterStat {
  waiter: string;
  revenue: number;
  tickets: number;
  avgTicket: number;
  tips: number;
  tipRate: number;
  itemsPerTicket: number;
}

export function waiterStats(orders: PaidOrder[]): WaiterStat[] {
  const map = new Map<string, PaidOrder[]>();
  orders.forEach(o => {
    const w = o.waiter || 'Desconocido';
    map.set(w, [...(map.get(w) || []), o]);
  });
  return [...map.entries()].map(([waiter, list]) => {
    const k = computeKpis(list);
    return { waiter, revenue: k.revenue, tickets: k.tickets, avgTicket: k.avgTicket, tips: k.tips, tipRate: k.tipRate, itemsPerTicket: k.itemsPerTicket };
  }).sort((a, b) => b.revenue - a.revenue);
}

// ---------- Pagos ----------

export function paymentSplit(orders: PaidOrder[]) {
  const by = (m: 'Efectivo' | 'Tarjeta') => {
    const list = orders.filter(o => o.paymentMethod === m);
    return { method: m, revenue: sum(list, o => o.total), tickets: list.length, tips: sum(list, o => o.tip || 0) };
  };
  return [by('Tarjeta'), by('Efectivo')];
}

// ---------- Cocina ----------

export const LATE_MS = 15 * 60_000;

export function kitchenStats(orders: PaidOrder[]) {
  const map = new Map<string, { name: string; total: number; count: number; late: number }>();
  let total = 0, count = 0, late = 0;
  orders.forEach(o => o.items.forEach(i => {
    if (!i.sentToKitchenAt || !i.finishedAt) return;
    const t = i.finishedAt - i.sentToKitchenAt;
    if (t < 0) return;
    total += t; count += 1;
    if (t > LATE_MS) late += 1;
    const s = map.get(i.id) ?? { name: i.name, total: 0, count: 0, late: 0 };
    s.total += t; s.count += 1;
    if (t > LATE_MS) s.late += 1;
    map.set(i.id, s);
  }));
  return {
    avgMs: count ? total / count : 0,
    lateRate: count ? late / count : 0,
    count,
    slowest: [...map.values()]
      .map(s => ({ name: s.name, avgMs: s.total / s.count, count: s.count, late: s.late }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 6),
  };
}

// ---------- Inventario: cobertura ----------

export interface CoverageRow {
  id: string;
  name: string;
  stock: number;
  dailyAvg: number;        // piezas por día en el periodo
  daysLeft: number | null; // null = sin ventas en el periodo
}

export function stockCoverage(
  orders: PaidOrder[], r: Range, products: Product[], inventory: Record<string, InventoryRecord>,
): CoverageRow[] {
  const days = rangeDays(r);
  const sold = new Map<string, number>();
  orders.forEach(o => o.items.forEach(i => sold.set(i.id, (sold.get(i.id) || 0) + i.quantity)));
  return products
    .filter(p => inventory[p.id]?.tracked)
    .map(p => {
      const stock = Math.max(0, inventory[p.id].stock);
      const dailyAvg = (sold.get(p.id) || 0) / days;
      return { id: p.id, name: p.name, stock, dailyAvg, daysLeft: dailyAvg > 0 ? stock / dailyAvg : null };
    })
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
}

// ---------- utilidades ----------

function sum<T>(list: T[], f: (x: T) => number) {
  return list.reduce((a, x) => a + f(x), 0);
}

export const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: n >= 10_000 ? 0 : 2 });

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const minutes = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
};
