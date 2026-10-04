import { useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { useCartStore } from '../store/useCartStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useMenuStore } from '../store/useMenuStore';
import {
  rangeForPreset, previousRange, inRange, computeKpis, delta, salesTimeline, salesHeatmap, productStats,
  categoryStats, topPairs, waiterStats, paymentSplit, kitchenStats, stockCoverage, WEEKDAYS, LATE_MS,
  money, pct, minutes, type PeriodPreset,
} from '../utils/analytics';

// Paleta validada para el fondo oscuro de la app (zinc-900): categórica slots 1-2, rampa secuencial azul.
const C = {
  series1: '#3987e5',
  series2: '#d95926',
  previous: '#71717a',
  grid: '#27272a',
  axis: '#a1a1aa',
  surface: '#18181b',
};
const HEAT_RAMP = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4'];

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'personalizado', label: 'Personalizado' },
];

const tooltipStyle = {
  contentStyle: { backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: 12, color: '#fafafa' },
  labelStyle: { color: '#a1a1aa', marginBottom: 4 },
  itemStyle: { color: '#fafafa' },
  cursor: { stroke: '#52525b', strokeWidth: 1 },
};

const axisProps = {
  stroke: C.grid,
  tick: { fill: C.axis, fontSize: 12 },
  tickLine: false,
};

const compactMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k` : `$${Math.round(n)}`;

export default function AnalyticsView() {
  const paidOrders = useCartStore(s => s.paidOrders);
  const inventory = useInventoryStore(s => s.inventory);
  const products = useMenuStore(s => s.products);
  const [preset, setPreset] = useState<PeriodPreset>('7d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  const range = useMemo(() => rangeForPreset(preset, new Date(), custom), [preset, custom]);
  const prev = useMemo(() => previousRange(range), [range]);

  const data = useMemo(() => {
    const current = inRange(paidOrders, range);
    const previous = inRange(paidOrders, prev);
    return {
      current,
      kpis: computeKpis(current),
      prevKpis: computeKpis(previous),
      timeline: salesTimeline(paidOrders, range),
      heatmap: salesHeatmap(current),
      products: productStats(current),
      categories: categoryStats(current),
      pairs: topPairs(current),
      waiters: waiterStats(current),
      payments: paymentSplit(current),
      kitchen: kitchenStats(current),
      coverage: stockCoverage(current, range, products, inventory),
    };
  }, [paidOrders, inventory, products, range, prev]);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  const rangeLabel = range.end - range.start <= 86_400_000
    ? fmtDate(range.start)
    : `${fmtDate(range.start)} – ${fmtDate(range.end - 1)}`;
  const prevLabel = prev.end - prev.start <= 86_400_000
    ? fmtDate(prev.start)
    : `${fmtDate(prev.start)} – ${fmtDate(prev.end - 1)}`;

  const { kpis, prevKpis } = data;
  const empty = data.current.length === 0;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-zinc-950">
      {/* Encabezado y filtros */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-3 py-3 md:p-6 flex flex-col gap-3 md:gap-4">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="page-title"><span>📈</span> Analítica Avanzada</h1>
            <p className="text-zinc-400 mt-1 text-sm md:text-base">
              {rangeLabel} <span className="text-zinc-600">· comparado con {prevLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`shrink-0 px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-bold transition-colors ${
                preset === p.key ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'personalizado' && (
            <div className="shrink-0 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
              <input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom(c => ({ ...c, from: e.target.value }))}
                className="bg-transparent text-white outline-none [color-scheme:dark]"
              />
              <span className="text-zinc-500">a</span>
              <input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom(c => ({ ...c, to: e.target.value }))}
                className="bg-transparent text-white outline-none [color-scheme:dark]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="col-span-2 lg:col-span-1 lg:row-span-2 bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-800 flex flex-col justify-between">
            <div>
              <p className="text-zinc-400 font-medium">Ventas netas</p>
              <p className="text-4xl sm:text-5xl xl:text-6xl font-bold text-white mt-2 tracking-tight">{money(kpis.revenue)}</p>
              <Delta value={delta(kpis.revenue, prevKpis.revenue)} />
            </div>
            <p className="text-zinc-500 text-sm mt-4">
              Periodo anterior: {money(prevKpis.revenue)}. Sin propinas, después de descuentos.
            </p>
          </div>
          <Stat label="Tickets" value={kpis.tickets.toLocaleString('es-MX')} d={delta(kpis.tickets, prevKpis.tickets)} />
          <Stat label="Ticket promedio" value={money(kpis.avgTicket)} d={delta(kpis.avgTicket, prevKpis.avgTicket)} />
          <Stat label="Artículos por ticket" value={kpis.itemsPerTicket.toFixed(1)} d={delta(kpis.itemsPerTicket, prevKpis.itemsPerTicket)} />
          <Stat
            label="Propinas"
            value={money(kpis.tips)}
            sub={`${pct(kpis.tipRate, 1)} de las ventas`}
            d={delta(kpis.tips, prevKpis.tips)}
          />
          <Stat
            label="Descuentos otorgados"
            value={money(kpis.discounts)}
            sub={kpis.revenue ? `${pct(kpis.discounts / (kpis.revenue + kpis.discounts), 1)} del bruto` : undefined}
            d={delta(kpis.discounts, prevKpis.discounts)}
            upIsGood={false}
          />
          <Stat label="Cobrado con tarjeta" value={pct(kpis.cardShare)} sub={`${pct(1 - kpis.cardShare)} en efectivo`} />
        </div>

        {empty ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl p-16 text-center text-zinc-500 text-xl">
            No hay ventas cobradas en este periodo.
          </div>
        ) : (
          <>
            {/* Tendencia */}
            <Panel
              title={`Ventas por ${data.timeline.unit}`}
              subtitle="Periodo actual contra el periodo anterior de la misma duración"
              legend={[{ color: C.series1, label: 'Actual' }, { color: C.previous, label: 'Anterior' }]}
            >
              <div className="h-56 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeline.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...axisProps} axisLine={false} tickFormatter={compactMoney} width={56} />
                    <Tooltip {...tooltipStyle} formatter={(v) => money(Number(v))} />
                    <Line type="monotone" dataKey="anterior" name="Anterior" stroke={C.previous} strokeWidth={2} dot={false} strokeLinecap="round" />
                    <Line
                      type="monotone" dataKey="actual" name="Actual" stroke={C.series1} strokeWidth={2} strokeLinecap="round"
                      dot={false} activeDot={{ r: 5, stroke: C.surface, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {/* Mapa de calor */}
              <Panel title="Horas pico" subtitle="Ventas por día de la semana y hora del cobro">
                <HeatmapGrid heatmap={data.heatmap} />
              </Panel>

              {/* Categorías */}
              <Panel title="Ventas por categoría" subtitle="Ingreso a precio de carta">
                <div style={{ height: Math.max(160, data.categories.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categories} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="category" {...axisProps} axisLine={false} width={isNarrow ? 104 : 150} />
                      <Tooltip {...tooltipStyle} cursor={{ fill: '#27272a' }} formatter={(v) => money(Number(v))} />
                      <Bar dataKey="revenue" name="Ventas" fill={C.series1} radius={[0, 4, 4, 0]} maxBarSize={24}>
                        <LabelList dataKey="share" position="right" fill="#d4d4d8" fontSize={12} formatter={(v) => pct(Number(v))} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* Productos ABC */}
            <Panel
              title="Productos (análisis ABC)"
              subtitle="A = productos que generan el 80 % del ingreso · B = siguiente 15 % · C = último 5 %"
            >
              <ProductTable products={data.products} />
            </Panel>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {/* Meseros */}
              <Panel title="Desempeño por mesero">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[520px]">
                    <thead>
                      <tr className="text-zinc-500 text-sm border-b border-zinc-800">
                        <th className="py-2 font-medium">Mesero</th>
                        <Th>Ventas</Th><Th>Tickets</Th><Th>Promedio</Th><Th>Art./ticket</Th><Th>Propinas</Th><Th>% prop.</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.waiters.map(w => (
                        <tr key={w.waiter} className="border-b border-zinc-800/50">
                          <td className="py-3 text-white font-medium">{w.waiter}</td>
                          <Td strong>{money(w.revenue)}</Td>
                          <Td>{w.tickets}</Td>
                          <Td>{money(w.avgTicket)}</Td>
                          <Td>{w.itemsPerTicket.toFixed(1)}</Td>
                          <Td>{money(w.tips)}</Td>
                          <Td>{pct(w.tipRate, 1)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Pagos */}
              <Panel
                title="Métodos de pago"
                legend={[{ color: C.series1, label: 'Tarjeta' }, { color: C.series2, label: 'Efectivo' }]}
              >
                <PaymentBar payments={data.payments} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6">
                  {data.payments.map(p => (
                    <div key={p.method} className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                      <p className="text-zinc-400 text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.method === 'Tarjeta' ? C.series1 : C.series2 }} />
                        {p.method}
                      </p>
                      <p className="text-2xl font-bold text-white mt-1">{money(p.revenue)}</p>
                      <p className="text-zinc-500 text-sm">{p.tickets} tickets · propinas {money(p.tips)}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {/* Cocina */}
              <Panel title="Tiempos de cocina" subtitle={`Del envío a cocina a "Orden lista" · tarde = más de ${LATE_MS / 60000} min`}>
                {data.kitchen.count === 0 ? (
                  <p className="text-zinc-500">No hay platillos con tiempos registrados en este periodo.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                      <MiniStat label="Promedio" value={`${minutes(data.kitchen.avgMs)} min`} />
                      <MiniStat label="Platillos" value={data.kitchen.count.toLocaleString('es-MX')} />
                      <MiniStat
                        label="Tarde"
                        value={pct(data.kitchen.lateRate)}
                        warn={data.kitchen.lateRate > 0.1}
                      />
                    </div>
                    <p className="text-zinc-400 text-sm mb-2">Los más lentos</p>
                    <ul className="space-y-2">
                      {data.kitchen.slowest.map(s => (
                        <li key={s.name} className="flex items-center gap-3">
                          <span className="flex-1 text-zinc-200 truncate">{s.name}</span>
                          <span className="text-zinc-500 text-sm">{s.count} preparados</span>
                          {s.late > 0 && <span className="text-xs font-bold text-amber-400">⚠ {s.late} tarde</span>}
                          <span className="font-mono text-white w-16 text-right">{minutes(s.avgMs)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Panel>

              {/* Combinaciones */}
              <Panel title="Se piden juntos" subtitle="Pares de productos que más coinciden en la misma cuenta">
                {data.pairs.length === 0 ? (
                  <p className="text-zinc-500">Aún no hay combinaciones que se repitan.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.pairs.map(p => (
                      <li key={p.a + p.b} className="flex items-center gap-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                        <span className="flex-1 text-zinc-200">{p.a} <span className="text-zinc-500">+</span> {p.b}</span>
                        <span className="text-white font-bold">{p.count}</span>
                        <span className="text-zinc-500 text-sm">cuentas</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {/* Inventario */}
            {data.coverage.length > 0 && (
              <Panel
                title="Cobertura de inventario"
                subtitle="Días de existencia restantes al ritmo de venta del periodo seleccionado"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[480px]">
                    <thead>
                      <tr className="text-zinc-500 text-sm border-b border-zinc-800">
                        <th className="py-2 font-medium">Producto</th>
                        <Th>Existencia</Th><Th>Venta diaria</Th><Th>Alcanza para</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coverage.map(c => {
                        const critical = c.daysLeft !== null && c.daysLeft < 2;
                        const low = c.daysLeft !== null && c.daysLeft < 7;
                        return (
                          <tr key={c.id} className="border-b border-zinc-800/50">
                            <td className="py-3 text-white font-medium">{c.name}</td>
                            <Td>{c.stock}</Td>
                            <Td>{c.dailyAvg.toFixed(1)}</Td>
                            <td className="py-3 text-right">
                              {c.daysLeft === null ? (
                                <span className="text-zinc-500">Sin ventas</span>
                              ) : (
                                <span className={`font-bold ${critical ? 'text-red-400' : low ? 'text-amber-400' : 'text-zinc-200'}`}>
                                  {critical ? '⛔ ' : low ? '⚠ ' : ''}{c.daysLeft < 1 ? 'menos de 1 día' : `${c.daysLeft.toFixed(1)} días`}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Piezas ----------------

function Panel({ title, subtitle, legend, children }: {
  title: string; subtitle?: string; legend?: { color: string; label: string }[]; children: ReactNode;
}) {
  return (
    <section className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 min-w-0">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-zinc-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex items-center gap-4">
            {legend.map(l => (
              <span key={l.label} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="w-4 h-1 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Delta({ value, upIsGood = true }: { value: number | null; upIsGood?: boolean }) {
  if (value === null) return <p className="text-zinc-600 text-sm mt-2">Sin datos para comparar</p>;
  if (Math.abs(value) < 0.005) return <p className="text-zinc-400 text-sm mt-2 font-medium">= Sin cambio</p>;
  const up = value > 0;
  const good = up === upIsGood;
  return (
    <p className={`text-sm mt-2 font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {pct(Math.abs(value), 1)} <span className="text-zinc-500 font-medium">vs anterior</span>
    </p>
  );
}

function Stat({ label, value, sub, d, upIsGood }: { label: string; value: string; sub?: string; d?: number | null; upIsGood?: boolean }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800 min-w-0">
      <p className="text-zinc-400 text-xs md:text-sm font-medium">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-white mt-1 truncate">{value}</p>
      {sub && <p className="text-zinc-500 text-sm">{sub}</p>}
      {d !== undefined && <Delta value={d} upIsGood={upIsGood} />}
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-zinc-950 rounded-xl p-3 md:p-4 border border-zinc-800">
      <p className="text-zinc-500 text-sm">{label}</p>
      <p className={`text-lg md:text-2xl font-bold ${warn ? 'text-amber-400' : 'text-white'}`}>{warn ? '⚠ ' : ''}{value}</p>
    </div>
  );
}

const Th = ({ children }: { children: ReactNode }) => <th className="py-2 font-medium text-right">{children}</th>;
const Td = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <td className={`py-3 text-right tabular-nums ${strong ? 'text-white font-bold' : 'text-zinc-300'}`}>{children}</td>
);

function HeatmapGrid({ heatmap }: { heatmap: ReturnType<typeof salesHeatmap> }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  if (!heatmap.hours.length) return <p className="text-zinc-500">Sin datos.</p>;

  const color = (v: number) => {
    if (v <= 0) return '#27272a';
    const i = Math.min(HEAT_RAMP.length - 1, Math.floor((v / heatmap.max) * HEAT_RAMP.length));
    return HEAT_RAMP[i];
  };
  const hovered = hover && {
    day: WEEKDAYS[hover.d],
    hour: heatmap.hours[hover.h],
    sales: heatmap.cells[hover.d][hover.h],
    tickets: heatmap.tickets[hover.d][hover.h],
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-[2px] min-w-max"
          style={{ gridTemplateColumns: `40px repeat(${heatmap.hours.length}, minmax(28px, 1fr))` }}
          onMouseLeave={() => setHover(null)}
        >
          <div />
          {heatmap.hours.map(h => (
            <div key={h} className="text-[11px] text-zinc-500 text-center pb-1">{h}</div>
          ))}
          {WEEKDAYS.map((day, d) => (
            <div key={day} className="contents">
              <div className="text-xs text-zinc-400 flex items-center">{day}</div>
              {heatmap.cells[d].map((v, h) => (
                <button
                  key={h}
                  onMouseEnter={() => setHover({ d, h })}
                  onFocus={() => setHover({ d, h })}
                  aria-label={`${day} ${heatmap.hours[h]}:00 — ${money(v)}`}
                  className={`h-7 rounded-[4px] transition-transform ${hover?.d === d && hover?.h === h ? 'ring-2 ring-white scale-110 z-10' : ''}`}
                  style={{ background: color(v) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 gap-4 flex-wrap min-h-[24px]">
        <p className="text-sm text-zinc-300">
          {hovered
            ? <>{hovered.day} {hovered.hour}:00–{hovered.hour + 1}:00 · <b className="text-white">{money(hovered.sales)}</b> · {hovered.tickets} tickets</>
            : <span className="text-zinc-500">Pasa el cursor sobre una celda para ver el detalle</span>}
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          Menos
          <div className="flex gap-[2px]">
            {HEAT_RAMP.filter((_, i) => i % 2 === 0).map(c => <span key={c} className="w-4 h-3 rounded-sm" style={{ background: c }} />)}
          </div>
          Más
        </div>
      </div>
    </div>
  );
}

function PaymentBar({ payments }: { payments: ReturnType<typeof paymentSplit> }) {
  const total = payments.reduce((a, p) => a + p.revenue, 0);
  if (!total) return null;
  return (
    <div className="flex h-10 gap-[2px] rounded-lg overflow-hidden">
      {payments.filter(p => p.revenue > 0).map(p => {
        const share = p.revenue / total;
        return (
          <div
            key={p.method}
            title={`${p.method}: ${money(p.revenue)} (${pct(share)})`}
            className="flex items-center justify-center text-sm font-bold text-white min-w-0"
            style={{ width: `${share * 100}%`, background: p.method === 'Tarjeta' ? C.series1 : C.series2 }}
          >
            {share > 0.12 && pct(share)}
          </div>
        );
      })}
    </div>
  );
}

function ProductTable({ products }: { products: ReturnType<typeof productStats> }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? products : products.slice(0, 10);
  const maxRevenue = products[0]?.revenue || 1;
  const abcStyle = {
    A: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    B: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    C: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
  };
  const counts = { A: 0, B: 0, C: 0 };
  products.forEach(p => { counts[p.abc] += 1; });

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        {(['A', 'B', 'C'] as const).map(k => (
          <span key={k} className={`text-sm font-bold px-3 py-1 rounded-full border ${abcStyle[k]}`}>
            Clase {k}: {counts[k]} producto{counts[k] === 1 ? '' : 's'}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="text-zinc-500 text-sm border-b border-zinc-800">
              <th className="py-2 font-medium w-10">#</th>
              <th className="py-2 font-medium">Producto</th>
              <th className="py-2 font-medium w-[30%]">Ingreso</th>
              <Th>Piezas</Th><Th>% ingreso</Th><Th>% acum.</Th>
              <th className="py-2 font-medium text-center">Clase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id} className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-500">{i + 1}</td>
                <td className="py-3">
                  <p className="text-white font-medium">{p.name}</p>
                  <p className="text-zinc-500 text-xs">{p.category} · en {p.tickets} cuenta{p.tickets === 1 ? '' : 's'}</p>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-3 rounded-r-[4px]" style={{ width: `${(p.revenue / maxRevenue) * 100}%`, minWidth: 2, background: C.series1 }} />
                    </div>
                    <span className="text-zinc-200 text-sm tabular-nums whitespace-nowrap w-24 text-right">{money(p.revenue)}</span>
                  </div>
                </td>
                <Td>{p.quantity}</Td>
                <Td>{pct(p.share, 1)}</Td>
                <Td>{pct(p.cumulative)}</Td>
                <td className="py-3 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${abcStyle[p.abc]}`}>{p.abc}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length > 10 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
        >
          {showAll ? 'Ver solo top 10' : `Ver los ${products.length} productos`}
        </button>
      )}
    </div>
  );
}
