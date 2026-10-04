import { describe, test, expect } from 'vitest';
import {
  rangeForPreset, previousRange, inRange, rangeDays, computeKpis, delta, salesTimeline, salesHeatmap,
  productStats, categoryStats, topPairs, waiterStats, paymentSplit, kitchenStats, stockCoverage, LATE_MS,
} from './analytics';
import { item, paid } from '../test/fixtures';
import type { Product } from '../data/mockProducts';

// Jueves 2 de octubre de 2026, 23:00 (zona del negocio)
const NOW = new Date('2026-10-02T23:00:00');
const localDate = (ts: number) => new Date(ts).toLocaleString('sv-SE').slice(0, 16);

const corona = (q = 1) => item({ id: 'cag-1', name: 'Corona', price: 85, category: 'Caguama', quantity: q });
const chelada = (q = 1) => item({ id: 'mich-1', name: 'Chelada', price: 120, category: 'Michelada', quantity: q });
const papas = (q = 1) => item({ id: 'snk-1', name: 'Papas', price: 65, category: 'Snacks', quantity: q });

describe('periodos', () => {
  test('"hoy" va de medianoche a medianoche', () => {
    const r = rangeForPreset('hoy', NOW);
    expect(localDate(r.start)).toBe('2026-10-02 00:00');
    expect(localDate(r.end)).toBe('2026-10-03 00:00');
  });

  test('"7 días" incluye hoy y los 6 anteriores', () => {
    const r = rangeForPreset('7d', NOW);
    expect(localDate(r.start)).toBe('2026-09-26 00:00');
    expect(rangeDays(r)).toBe(7);
  });

  test('"este mes" empieza el día 1', () => {
    expect(localDate(rangeForPreset('mes', NOW).start)).toBe('2026-10-01 00:00');
  });

  test('personalizado con fechas invertidas no queda vacío', () => {
    const r = rangeForPreset('personalizado', NOW, { from: '2026-09-10', to: '2026-09-05' });
    expect(r.end).toBeGreaterThan(r.start);
  });

  test('el periodo anterior tiene la misma duración y termina donde empieza el actual', () => {
    const r = rangeForPreset('7d', NOW);
    const p = previousRange(r);
    expect(p.end).toBe(r.start);
    expect(p.end - p.start).toBe(r.end - r.start);
  });

  test('inRange incluye el inicio y excluye el final', () => {
    const r = rangeForPreset('hoy', NOW);
    const orders = [
      paid('2026-10-02 00:00', [corona()]),
      paid('2026-10-02 23:59', [corona()]),
      paid('2026-10-03 00:00', [corona()]),
      paid('2026-10-01 23:59', [corona()]),
    ];
    expect(inRange(orders, r)).toHaveLength(2);
  });
});

describe('indicadores', () => {
  const orders = [
    paid('2026-10-02 20:00', [corona(2)], { total: 170, tip: 17, paymentMethod: 'Tarjeta' }),
    paid('2026-10-02 21:00', [chelada(), papas()], { total: 165, discount: 20, tip: 0, paymentMethod: 'Efectivo' }),
  ];

  test('ventas, tickets, promedio, propinas y descuentos', () => {
    const k = computeKpis(orders);
    expect(k.revenue).toBe(335);
    expect(k.tickets).toBe(2);
    expect(k.avgTicket).toBe(167.5);
    expect(k.tips).toBe(17);
    expect(k.discounts).toBe(20);
    expect(k.itemsSold).toBe(4);
    expect(k.itemsPerTicket).toBe(2);
    expect(k.cardShare).toBeCloseTo(170 / 335);
  });

  test('sin ventas no divide entre cero', () => {
    const k = computeKpis([]);
    expect(k.avgTicket).toBe(0);
    expect(k.tipRate).toBe(0);
    expect(k.cardShare).toBe(0);
  });

  test('variación contra el periodo anterior', () => {
    expect(delta(150, 100)).toBe(0.5);
    expect(delta(50, 100)).toBe(-0.5);
    expect(delta(100, 0)).toBeNull();
  });
});

describe('tendencia', () => {
  test('un solo día se agrupa por hora, recortando horas sin ventas', () => {
    const r = rangeForPreset('hoy', NOW);
    const orders = [
      paid('2026-10-02 18:10', [corona()], { total: 85 }),
      paid('2026-10-02 18:50', [corona()], { total: 85 }),
      paid('2026-10-02 21:30', [chelada()], { total: 120 }),
      paid('2026-10-01 19:00', [papas()], { total: 65 }), // ayer, para comparar
    ];
    const { points, unit } = salesTimeline(orders, r);
    expect(unit).toBe('hora');
    expect(points[0].label).toBe('18:00');
    expect(points.at(-1)!.label).toBe('21:00');
    expect(points.find(p => p.label === '18:00')!.actual).toBe(170);
    expect(points.find(p => p.label === '19:00')!.anterior).toBe(65);
  });

  test('varios días se agrupan por día y se alinean con el periodo anterior', () => {
    const r = rangeForPreset('7d', NOW);
    const orders = [
      paid('2026-09-26 20:00', [corona()], { total: 85 }), // primer día del periodo
      paid('2026-09-19 20:00', [corona()], { total: 40 }), // primer día del anterior
    ];
    const { points, unit } = salesTimeline(orders, r);
    expect(unit).toBe('día');
    expect(points).toHaveLength(7);
    expect(points[0]).toMatchObject({ label: '26/9', actual: 85, anterior: 40 });
  });
});

describe('horas pico', () => {
  test('acumula por día de la semana (lunes primero) y hora', () => {
    const h = salesHeatmap([
      paid('2026-09-28 20:15', [corona()], { total: 85 }),  // lunes
      paid('2026-09-28 20:45', [corona()], { total: 85 }),  // lunes
      paid('2026-10-04 22:00', [chelada()], { total: 120 }), // domingo
    ]);
    expect(h.hours).toEqual([20, 22]);
    expect(h.cells[0]).toEqual([170, 0]);
    expect(h.tickets[0]).toEqual([2, 0]);
    expect(h.cells[6]).toEqual([0, 120]);
    expect(h.max).toBe(170);
  });
});

describe('productos', () => {
  const orders = [
    paid('2026-10-02 20:00', [corona(10), chelada(2)]), // 850 + 240
    paid('2026-10-02 21:00', [corona(2), papas(1)]),    // 170 + 65
  ];

  test('ranking por ingreso con clasificación ABC', () => {
    const stats = productStats(orders);
    expect(stats.map(s => s.name)).toEqual(['Corona', 'Chelada', 'Papas']);
    expect(stats[0]).toMatchObject({ quantity: 12, revenue: 1020, tickets: 2, abc: 'A' });
    expect(stats.at(-1)!.cumulative).toBeCloseTo(1);
    // Corona solo ya es el 77% del ingreso; Chelada entra en el 80% → A; Papas al final → C
    expect(stats.map(s => s.abc)).toEqual(['A', 'A', 'C']);
  });

  test('ventas por categoría con su porcentaje', () => {
    const cats = categoryStats(orders);
    expect(cats[0]).toMatchObject({ category: 'Caguama', revenue: 1020, quantity: 12 });
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
  });

  test('se piden juntos: solo pares que se repiten', () => {
    const pairs = topPairs([
      paid('2026-10-02 20:00', [corona(), chelada()]),
      paid('2026-10-02 21:00', [chelada(), corona(), papas()]),
      paid('2026-10-02 22:00', [papas(), corona()]),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs.map(p => p.count)).toEqual([2, 2]);
    expect(pairs.flatMap(p => [p.a, p.b]).sort()).toEqual(['Chelada', 'Corona', 'Corona', 'Papas']);
  });
});

describe('meseros y pagos', () => {
  const orders = [
    paid('2026-10-02 20:00', [corona()], { waiter: 'Ana', total: 100, tip: 10, paymentMethod: 'Tarjeta' }),
    paid('2026-10-02 20:30', [corona()], { waiter: 'Ana', total: 100, tip: 0, paymentMethod: 'Efectivo' }),
    paid('2026-10-02 21:00', [corona()], { waiter: 'Luis', total: 300, tip: 45, paymentMethod: 'Tarjeta' }),
  ];

  test('desempeño por mesero, ordenado por ventas', () => {
    const w = waiterStats(orders);
    expect(w.map(x => x.waiter)).toEqual(['Luis', 'Ana']);
    expect(w[1]).toMatchObject({ revenue: 200, tickets: 2, avgTicket: 100, tips: 10, tipRate: 0.05 });
  });

  test('reparto tarjeta / efectivo con sus propinas', () => {
    expect(paymentSplit(orders)).toEqual([
      { method: 'Tarjeta', revenue: 400, tickets: 2, tips: 55 },
      { method: 'Efectivo', revenue: 100, tickets: 1, tips: 0 },
    ]);
  });
});

describe('cocina', () => {
  test('tiempo promedio, % tarde y los más lentos', () => {
    const sent = 1_000_000;
    const k = kitchenStats([
      paid('2026-10-02 20:00', [
        papas(1), corona(1),
      ].map((it, i) => ({ ...it, status: 'listo' as const, sentToKitchenAt: sent, finishedAt: sent + (i === 0 ? LATE_MS + 60_000 : 5 * 60_000) }))),
    ]);
    expect(k.count).toBe(2);
    expect(k.lateRate).toBe(0.5);
    expect(k.slowest[0].name).toBe('Papas');
    expect(k.avgMs).toBe((LATE_MS + 60_000 + 5 * 60_000) / 2);
  });

  test('ignora productos sin tiempos registrados', () => {
    expect(kitchenStats([paid('2026-10-02 20:00', [corona()])]).count).toBe(0);
  });
});

describe('cobertura de inventario', () => {
  test('días que alcanza la existencia al ritmo de venta del periodo', () => {
    const products = [
      { id: 'cag-1', name: 'Corona', price: 85, category: 'Caguama' },
      { id: 'snk-1', name: 'Papas', price: 65, category: 'Snacks' },
      { id: 'mich-1', name: 'Chelada', price: 120, category: 'Michelada' },
    ] as Product[];
    const inventory = {
      'cag-1': { tracked: true, stock: 14, available: true },
      'snk-1': { tracked: true, stock: 5, available: true },
      'mich-1': { tracked: false, stock: 0, available: true },
    };
    const r = rangeForPreset('7d', NOW);
    const rows = stockCoverage([paid('2026-10-01 20:00', [corona(14)])], r, products, inventory);

    expect(rows.map(x => x.id)).toEqual(['cag-1', 'snk-1']); // Chelada no tiene control
    expect(rows[0]).toMatchObject({ stock: 14, dailyAvg: 2, daysLeft: 7 });
    expect(rows[1].daysLeft).toBeNull(); // sin ventas en el periodo
  });
});
