import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { X, Printer, FileDown, AlertTriangle } from 'lucide-react';
import { useCartStore, type PaidOrder } from '../store/useCartStore';
import { useShiftStore } from '../store/useShiftStore';
import { usePrinterStore, selectCanPrint } from '../store/usePrinterStore';
import { exportPaidOrdersToCSV } from '../utils/exportToCSV';
import {
  summarizeShift, expectedCash, inShift, round2, type CashCut, type ShiftSummary,
} from '../utils/cashCut';

const money = (n: number) => `$${n.toFixed(2)}`;

const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

// "1,234.50" o "1234,5" -> número; vacío -> null
function parseAmount(value: string): number | null {
  const clean = value.replace(/[$\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

const FLOAT_KEY = 'soma-opening-float';
const loadFloat = () => {
  try { return localStorage.getItem(FLOAT_KEY) || ''; } catch { return ''; }
};
const saveFloat = (v: string) => {
  try { localStorage.setItem(FLOAT_KEY, v); } catch { /* sin almacenamiento */ }
};

type Tab = 'turno' | 'cortes';

export default function CashCutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('turno');
  const [closing, setClosing] = useState(false);
  const [doneCut, setDoneCut] = useState<CashCut | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setClosing(false);
    setDoneCut(null);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-4xl">
        <div className="p-4 md:p-6 border-b border-zinc-800 bg-zinc-950 shrink-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Corte de Caja</h2>
            <button
              onClick={handleClose}
              className="w-11 h-11 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-300 transition-colors shrink-0"
              title="Cerrar"
            >
              <X size={24} />
            </button>
          </div>
          {!closing && !doneCut && (
            <div className="flex gap-2">
              {([['turno', 'Turno actual'], ['cortes', 'Cortes anteriores']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                    tab === key ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {doneCut ? (
          <CutDone cut={doneCut} onClose={handleClose} />
        ) : closing ? (
          <CloseShiftForm onCancel={() => setClosing(false)} onDone={setDoneCut} />
        ) : tab === 'turno' ? (
          <CurrentShift onStartCut={() => setClosing(true)} />
        ) : (
          <PastCuts />
        )}
      </div>
    </div>
  );
}

// ---------- Turno actual ----------

function useCurrentShift() {
  const { paidOrders, orders, lastCutTime } = useCartStore();
  const cancellations = useShiftStore(s => s.cancellations);

  return useMemo(() => {
    const summary = summarizeShift(paidOrders, cancellations, lastCutTime, Infinity);
    return {
      summary,
      lastCutTime,
      shiftOrders: paidOrders.filter(o => inShift(o.paidAt, lastCutTime)).sort((a, b) => b.paidAt - a.paidAt),
      shiftCancellations: cancellations.filter(c => inShift(c.createdAt, lastCutTime)).reverse(),
      openOrders: orders,
      openTotal: round2(orders.reduce((n, o) => n + o.total, 0)),
    };
  }, [paidOrders, orders, cancellations, lastCutTime]);
}

function CurrentShift({ onStartCut }: { onStartCut: () => void }) {
  const { summary, lastCutTime, shiftOrders, shiftCancellations, openOrders, openTotal } = useCurrentShift();

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5">
        <p className="text-zinc-400">
          Turno desde <span className="text-zinc-200 font-bold">{lastCutTime ? formatDateTime(lastCutTime) : 'el inicio'}</span>
        </p>

        <SummaryCards summary={summary} />

        {openOrders.length > 0 && (
          <div className="flex gap-3 items-start bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-amber-200">
            <AlertTriangle className="shrink-0 mt-0.5" size={20} />
            <p>
              Hay <b>{openOrders.length} cuenta{openOrders.length === 1 ? '' : 's'} abierta{openOrders.length === 1 ? '' : 's'}</b> ({money(openTotal)}).
              No se borran al hacer el corte: se cobran en el siguiente turno.
            </p>
          </div>
        )}

        <WaiterTable summary={summary} />

        {shiftCancellations.length > 0 && (
          <Section title={`Cancelaciones (${summary.cancelledItems} pzs · ${money(summary.cancelledAmount)})`}>
            <div className="divide-y divide-zinc-800">
              {shiftCancellations.map(c => (
                <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-zinc-100 font-bold">{c.quantity}x {c.productName} <span className="text-zinc-500 font-normal">· {c.orderName}</span></p>
                    <p className="text-sm text-zinc-400">
                      {formatTime(c.createdAt)} · {c.cancelledBy} · {c.reason}
                      {c.status === 'listo' && ' · ya entregado'}
                      {c.restocked && ' · regresó a inventario'}
                    </p>
                  </div>
                  <span className="text-red-400 font-bold">-{money(c.quantity * c.unitPrice)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <PaidOrdersList orders={shiftOrders} />
      </div>

      <div className="p-4 md:p-5 border-t border-zinc-800 bg-zinc-950 flex flex-wrap gap-3 shrink-0">
        {shiftOrders.length > 0 && (
          <button
            onClick={() => exportPaidOrdersToCSV(shiftOrders)}
            className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <FileDown size={20} /> CSV
          </button>
        )}
        <button
          onClick={onStartCut}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl transition-colors"
        >
          ✂️ Hacer corte
        </button>
      </div>
    </>
  );
}

function SummaryCards({ summary }: { summary: ShiftSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="col-span-2 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-5">
        <p className="text-blue-400 font-medium uppercase tracking-wider text-sm">Ventas</p>
        <p className="text-4xl md:text-5xl font-black text-white">{money(summary.sales)}</p>
        <p className="text-blue-300/80 mt-1">
          {summary.orderCount} cuenta{summary.orderCount === 1 ? '' : 's'}
          {summary.discounts > 0 && ` · descuentos ${money(summary.discounts)}`}
        </p>
      </div>
      <Stat label="💵 Efectivo" value={money(summary.cashSales)} className="text-emerald-400" />
      <Stat label="💳 Tarjeta" value={money(summary.cardSales)} className="text-blue-400" />
      <Stat label="Propinas" value={money(summary.tips)} className="text-sky-300" note="No incluidas en ventas" />
      <Stat label="Propinas efectivo" value={money(summary.cashTips)} className="text-emerald-300" />
      <Stat label="Propinas tarjeta" value={money(summary.cardTips)} className="text-blue-300" />
      <Stat label="Cancelado" value={money(summary.cancelledAmount)} className="text-red-400" note={`${summary.cancelledItems} piezas`} />
    </div>
  );
}

function Stat({ label, value, className, note }: { label: string; value: string; className: string; note?: string }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 min-w-0">
      <p className="text-zinc-400 text-sm">{label}</p>
      <p className={`text-xl md:text-2xl font-bold truncate ${className}`}>{value}</p>
      {note && <p className="text-zinc-500 text-xs mt-0.5">{note}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 md:p-5">
      <h3 className="text-lg font-bold text-zinc-200 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function WaiterTable({ summary }: { summary: ShiftSummary }) {
  if (!summary.byWaiter.length) return null;
  return (
    <Section title="Por mesero">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 items-center">
        <span className="text-xs font-bold uppercase text-zinc-500">Mesero</span>
        <span className="text-xs font-bold uppercase text-zinc-500 text-right">Ventas</span>
        <span className="text-xs font-bold uppercase text-zinc-500 text-right">Propinas</span>
        {summary.byWaiter.map(w => (
          <div key={w.waiter} className="contents">
            <span className="text-zinc-300 font-medium truncate">👤 {w.waiter} <span className="text-zinc-500 text-sm">({w.orders})</span></span>
            <span className="text-white font-bold text-right">{money(w.sales)}</span>
            <span className="text-sky-300 font-bold text-right">{money(w.tips)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PaidOrdersList({ orders }: { orders: PaidOrder[] }) {
  const printReceipt = usePrinterStore(s => s.printReceipt);
  const canPrint = usePrinterStore(selectCanPrint);

  const handleReprint = async (order: PaidOrder) => {
    const ok = await printReceipt(order, true);
    if (!ok) window.alert(usePrinterStore.getState().lastError || 'No se pudo imprimir.');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-zinc-300 px-1">Cuentas cobradas en el turno</h3>
      {orders.length === 0 ? (
        <div className="text-center py-10 bg-zinc-800/20 rounded-2xl border border-zinc-800 border-dashed text-zinc-500">
          Todavía no se cobra ninguna cuenta en este turno
        </div>
      ) : orders.map(order => (
        <div key={order.id} className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-bold text-zinc-100">{order.name}</h4>
              <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded-md font-bold">👤 {order.waiter}</span>
            </div>
            <p className="text-zinc-400 text-sm">
              {order.items.reduce((n, i) => n + i.quantity, 0)} artículos · {formatTime(order.paidAt)}
              {!!order.discount && <span className="text-amber-400"> · desc. -{money(order.discount)}</span>}
              {!!order.tip && <span className="text-sky-300"> · propina {money(order.tip)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              order.paymentMethod === 'Efectivo'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {order.paymentMethod}
            </span>
            <span className="text-2xl font-bold text-white">{money(order.total)}</span>
            {canPrint && (
              <button
                onClick={() => handleReprint(order)}
                className="p-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                title="Reimprimir ticket"
              >
                <Printer size={20} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Cerrar turno ----------

function CloseShiftForm({ onCancel, onDone }: { onCancel: () => void; onDone: (cut: CashCut) => void }) {
  const { summary, openOrders } = useCurrentShift();
  const performCut = useShiftStore(s => s.performCut);
  const [floatText, setFloatText] = useState(loadFloat);
  const [countedText, setCountedText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openingFloat = parseAmount(floatText) ?? 0;
  const counted = parseAmount(countedText);
  const invalid = Number.isNaN(openingFloat) || Number.isNaN(counted);
  const expected = Number.isNaN(openingFloat) ? 0 : expectedCash(summary, openingFloat);
  const difference = counted === null || Number.isNaN(counted) ? null : round2(counted - expected);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid || saving) return;
    if (!window.confirm('¿Cerrar el turno? Las ventas de este turno quedarán guardadas en el corte y el siguiente turno empezará en cero.')) return;
    setSaving(true);
    setError(null);
    try {
      saveFloat(floatText);
      onDone(await performCut({ openingFloat, countedCash: counted, notes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo hacer el corte.');
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-xl text-white focus:outline-none focus:border-emerald-500';

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Ventas del turno" value={money(summary.sales)} className="text-white" note={`${summary.orderCount} cuentas`} />
          <Stat label="Propinas" value={money(summary.tips)} className="text-sky-300" />
        </div>

        <label className="block">
          <span className="block text-zinc-300 font-medium mb-2">Fondo de caja (con lo que se abrió)</span>
          <input inputMode="decimal" value={floatText} onChange={e => setFloatText(e.target.value)} placeholder="0.00" className={inputClass} />
        </label>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 space-y-1">
          <Row label="Fondo de caja" value={money(Number.isNaN(openingFloat) ? 0 : openingFloat)} />
          <Row label="+ Ventas en efectivo" value={money(summary.cashSales)} />
          <Row label="+ Propinas en efectivo" value={money(summary.cashTips)} />
          <div className="border-t border-zinc-700 pt-2 mt-2">
            <Row label="Efectivo esperado en caja" value={money(expected)} bold />
          </div>
          {summary.cardTips > 0 && (
            <p className="text-sm text-zinc-500 pt-1">Las propinas con tarjeta ({money(summary.cardTips)}) no están en la caja.</p>
          )}
        </div>

        <label className="block">
          <span className="block text-zinc-300 font-medium mb-2">Efectivo contado (opcional)</span>
          <input inputMode="decimal" value={countedText} onChange={e => setCountedText(e.target.value)} placeholder="Cuenta billetes y monedas" className={inputClass} />
        </label>

        {difference !== null && (
          <div className={`rounded-2xl p-4 border text-lg font-bold ${
            difference === 0
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : difference > 0
                ? 'bg-sky-950/40 border-sky-500/30 text-sky-300'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}>
            {difference === 0 ? '✅ La caja cuadra' : difference > 0 ? `Sobrante: ${money(difference)}` : `Faltante: ${money(-difference)}`}
          </div>
        )}

        <label className="block">
          <span className="block text-zinc-300 font-medium mb-2">Notas (opcional)</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} rows={2} className={`${inputClass} text-base`} />
        </label>

        {openOrders.length > 0 && (
          <p className="text-amber-300">
            ⚠️ {openOrders.length} cuenta{openOrders.length === 1 ? '' : 's'} abierta{openOrders.length === 1 ? '' : 's'} pasará{openOrders.length === 1 ? '' : 'n'} al siguiente turno.
          </p>
        )}
        {invalid && <p className="text-red-400">Revisa las cantidades: solo números.</p>}
        {error && <p className="text-red-400 font-medium">{error}</p>}
      </div>

      <div className="p-4 md:p-5 border-t border-zinc-800 bg-zinc-950 flex gap-3 shrink-0">
        <button type="button" onClick={onCancel} className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl">
          Volver
        </button>
        <button
          type="submit"
          disabled={invalid || saving}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-lg font-bold rounded-xl transition-colors"
        >
          {saving ? 'Cerrando…' : 'Cerrar turno'}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'text-white font-bold text-lg' : 'text-zinc-300'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------- Corte terminado / cortes anteriores ----------

function usePrintCut() {
  const printCashCut = usePrinterStore(s => s.printCashCut);
  const canPrint = usePrinterStore(selectCanPrint);
  const print = async (cut: CashCut) => {
    const ok = await printCashCut(cut);
    if (!ok) window.alert(usePrinterStore.getState().lastError || 'No se pudo imprimir.');
  };
  return { canPrint, print };
}

function DifferenceBadge({ cut }: { cut: CashCut }) {
  if (cut.difference === null) return <span className="text-zinc-500 text-sm">Sin conteo</span>;
  if (cut.difference === 0) return <span className="text-emerald-400 font-bold text-sm">Cuadró</span>;
  return cut.difference > 0
    ? <span className="text-sky-300 font-bold text-sm">Sobrante {money(cut.difference)}</span>
    : <span className="text-red-400 font-bold text-sm">Faltante {money(-cut.difference)}</span>;
}

function CutDone({ cut, onClose }: { cut: CashCut; onClose: () => void }) {
  const { canPrint, print } = usePrintCut();
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-5xl">✅</p>
          <p className="text-2xl font-bold text-white">Turno cerrado</p>
          <p className="text-zinc-400">{cut.from ? formatDateTime(cut.from) : 'Inicio'} → {formatDateTime(cut.to)}</p>
          <DifferenceBadge cut={cut} />
        </div>
        <SummaryCards summary={cut} />
        <WaiterTable summary={cut} />
      </div>
      <div className="p-4 md:p-5 border-t border-zinc-800 bg-zinc-950 flex gap-3 shrink-0">
        {canPrint && (
          <button onClick={() => print(cut)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
            <Printer size={20} /> Imprimir corte
          </button>
        )}
        <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl">
          Listo
        </button>
      </div>
    </>
  );
}

function PastCuts() {
  const cashCuts = useShiftStore(s => s.cashCuts);
  const paidOrders = useCartStore(s => s.paidOrders);
  const { canPrint, print } = usePrintCut();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!cashCuts.length) {
    return (
      <div className="flex-1 p-10 text-center text-zinc-500">Todavía no hay cortes guardados.</div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-3">
      {cashCuts.map(cut => {
        const isOpen = openId === cut.id;
        const orders = paidOrders.filter(o => inShift(o.paidAt, cut.from, cut.to));
        return (
          <div key={cut.id} className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : cut.id)}
              className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-zinc-100 font-bold">{formatDateTime(cut.to)}</p>
                <p className="text-sm text-zinc-400">
                  {cut.orderCount} cuentas · {cut.madeBy} · <DifferenceBadge cut={cut} />
                </p>
              </div>
              <span className="text-2xl font-bold text-white">{money(cut.sales)}</span>
            </button>
            {isOpen && (
              <div className="p-4 border-t border-zinc-700 space-y-4">
                <p className="text-zinc-400 text-sm">
                  {cut.from ? formatDateTime(cut.from) : 'Inicio'} → {formatDateTime(cut.to)}
                  {' · '}Fondo {money(cut.openingFloat)} · Esperado {money(cut.expectedCash)}
                  {cut.countedCash !== null && ` · Contado ${money(cut.countedCash)}`}
                </p>
                <SummaryCards summary={cut} />
                <WaiterTable summary={cut} />
                {cut.notes && <p className="text-zinc-300">📝 {cut.notes}</p>}
                <div className="flex flex-wrap gap-3">
                  {canPrint && (
                    <button onClick={() => print(cut)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2">
                      <Printer size={18} /> Imprimir
                    </button>
                  )}
                  {orders.length > 0 && (
                    <button onClick={() => exportPaidOrdersToCSV(orders)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-bold rounded-xl flex items-center gap-2">
                      <FileDown size={18} /> CSV ({orders.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
