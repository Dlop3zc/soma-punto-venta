import { useState, type ReactNode } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { useCartStore, type PaidOrder, type PaymentInput, type PaymentMethod, type SplitShare } from '../store/useCartStore';
import { usePrinterStore, selectCanPrint, printingEnabled, TIP_PERCENTAGES } from '../store/usePrinterStore';

interface CheckoutModalProps {
  orderId: string;
  onClose: () => void;
  // Cobro de una persona en una cuenta dividida en partes iguales
  split?: SplitShare & { part: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;
const parse = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Se monta solo cuando hay una cuenta por cobrar, así el estado empieza limpio cada vez.
export default function CheckoutModal({ orderId, onClose, split }: CheckoutModalProps) {
  const { orders, payOrder, paySplitShare } = useCartStore();
  const pay = split
    ? (id: string, payment: PaymentInput) => paySplitShare(id, split, payment)
    : payOrder;
  const { settings, printReceipt } = usePrinterStore();
  const canPrint = usePrinterStore(selectCanPrint);

  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  // Tarjeta: propina por porcentaje. Efectivo: propina por monto.
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customPercent, setCustomPercent] = useState('');
  const [cashTipInput, setCashTipInput] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [shouldPrint, setShouldPrint] = useState(settings.autoPrintOnPay);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidOrder, setPaidOrder] = useState<PaidOrder | null>(null);
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'ok' | 'failed'>('idle');

  const openOrder = orders.find(o => o.id === orderId);
  // En partes iguales se cobra solo la parte de esta persona
  const order = openOrder && split
    ? { ...openOrder, name: `${openOrder.name} · Persona ${split.part} de ${split.people}`, total: split.amount }
    : openOrder;

  // Ya no se capturan descuentos/promociones al cobrar; las ventas pasadas conservan el suyo.
  const total = order?.total || 0;

  const effectivePercent = customPercent !== '' ? parse(customPercent) : tipPercent;
  const tip = method === 'Tarjeta'
    ? round2(total * effectivePercent / 100)
    : round2(parse(cashTipInput));
  const grandTotal = round2(total + tip);

  const tendered = parse(cashTendered);
  const change = round2(tendered - grandTotal);
  const cashValid = tendered >= grandTotal;
  const canPay = !paying && (method === 'Tarjeta' || cashValid);

  const quickCash = [grandTotal, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500]
    .filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  const doPrint = async (paid: PaidOrder, reprint = false) => {
    setPrintStatus('printing');
    const ok = await printReceipt(paid, reprint);
    setPrintStatus(ok ? 'ok' : 'failed');
  };

  const handlePay = async () => {
    if (!canPay || !order) return;
    setPaying(true);
    setError(null);
    try {
      const paid = await pay(order.id, {
        method,
        discount: 0,
        tip,
        tipPercent: method === 'Tarjeta' && effectivePercent > 0 ? effectivePercent : undefined,
        cashTendered: method === 'Efectivo' ? tendered : undefined,
        change: method === 'Efectivo' ? change : undefined,
      });
      if (!paid) throw new Error('No se pudo registrar el pago.');
      setPaidOrder(paid);
      if (shouldPrint && canPrint) doPrint(paid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setPaying(false);
    }
  };

  // La cuenta desapareció (cobrada en otro dispositivo) y no la cobramos aquí
  if (!order && !paidOrder) {
    return (
      <Shell onClose={onClose} title="Cobrar">
        <div className="p-10 text-center text-zinc-400 text-xl">Esta cuenta ya no está abierta.</div>
      </Shell>
    );
  }

  // ---------- Pantalla final ----------
  if (paidOrder) {
    return (
      <Shell onClose={onClose} title={`${paidOrder.name}${paidOrder.splitPart ? ` · Persona ${paidOrder.splitPart} de ${paidOrder.splitOf}` : ''} · Cobrada`}>
        <div className="p-6 md:p-10 flex flex-col items-center text-center gap-5 md:gap-6 overflow-y-auto">
          <CheckCircle2 size={72} className="text-emerald-400" />
          {paidOrder.paymentMethod === 'Efectivo' ? (
            <div>
              <p className="text-zinc-400 text-2xl font-medium">Cambio a devolver</p>
              <p className="text-6xl md:text-7xl font-black text-emerald-400">{money(paidOrder.change || 0)}</p>
            </div>
          ) : (
            <p className="text-3xl font-bold text-white">Pago con tarjeta registrado</p>
          )}
          <div className="text-zinc-400 text-lg">
            Venta {money(paidOrder.total)}
            {!!paidOrder.tip && <> · Propina {money(paidOrder.tip)}</>}
          </div>

          {canPrint ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => doPrint(paidOrder, printStatus === 'ok')}
                disabled={printStatus === 'printing'}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                <Printer size={20} />
                {printStatus === 'printing' ? 'Imprimiendo...' : printStatus === 'ok' ? 'Reimprimir ticket' : 'Imprimir ticket'}
              </button>
              {printStatus === 'failed' && (
                <p className="text-red-400 text-sm">{usePrinterStore.getState().lastError || 'No se pudo imprimir.'}</p>
              )}
            </div>
          ) : printingEnabled && (
            <p className="text-zinc-500 text-sm">Sin impresora conectada en este equipo.</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="py-5 md:py-6 text-2xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0"
        >
          Listo
        </button>
      </Shell>
    );
  }

  // ---------- Formulario de cobro ----------
  return (
    <Shell onClose={onClose} title={`Cobrar ${order!.name}`}>
      <div className="grid md:grid-cols-2 gap-5 md:gap-6 p-4 md:p-6 overflow-y-auto min-h-0">
        <div className="space-y-6">
          {/* Método */}
          <div className="grid grid-cols-2 gap-3">
            {(['Efectivo', 'Tarjeta'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-4 md:py-5 rounded-2xl text-xl md:text-2xl font-black tracking-wider transition-colors ${
                  method === m
                    ? m === 'Efectivo' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Propina */}
          <div>
            <label className="block text-zinc-400 font-medium mb-2">
              Propina {method === 'Tarjeta' ? '(porcentaje)' : '(monto en efectivo)'}
            </label>
            {method === 'Tarjeta' ? (
              <div className="grid grid-cols-5 gap-2">
                {[0, ...TIP_PERCENTAGES].map(p => (
                  <button
                    key={p}
                    onClick={() => { setTipPercent(p); setCustomPercent(''); }}
                    className={`py-3 rounded-xl font-bold transition-colors ${
                      customPercent === '' && tipPercent === p ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {p === 0 ? 'Sin' : `${p}%`}
                  </button>
                ))}
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={customPercent}
                    onChange={(e) => setCustomPercent(e.target.value)}
                    placeholder="Otro"
                    className={`w-full h-full bg-zinc-800 border-2 text-white font-bold rounded-xl px-2 pr-6 text-center focus:outline-none ${
                      customPercent !== '' ? 'border-blue-500' : 'border-zinc-700'
                    }`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">%</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-zinc-500">$</span>
                  <input
                    type="number"
                    min={0}
                    value={cashTipInput}
                    onChange={(e) => setCashTipInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border-2 border-zinc-700 text-white text-xl font-bold rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {TIP_PERCENTAGES.map(p => {
                    const amount = round2(total * p / 100);
                    return (
                      <button
                        key={p}
                        onClick={() => setCashTipInput(amount.toString())}
                        className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold"
                      >
                        {p}% = {money(amount)}
                      </button>
                    );
                  })}
                  {tendered > total && (
                    <button
                      onClick={() => setCashTipInput(round2(tendered - total).toString())}
                      className="px-3 py-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-900 text-emerald-300 text-sm font-bold"
                    >
                      Deja el cambio ({money(round2(tendered - total))})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Efectivo recibido */}
          {method === 'Efectivo' && (
            <div>
              <label className="block text-zinc-400 font-medium mb-2">Efectivo recibido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-zinc-500">$</span>
                <input
                  type="number"
                  min={0}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-800 border-2 border-zinc-700 text-white text-3xl font-bold rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {quickCash.map(a => (
                  <button
                    key={a}
                    onClick={() => setCashTendered(a.toString())}
                    className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
                  >
                    {money(a)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 md:p-6 space-y-2 md:space-y-3 text-base md:text-lg">
            <Row label="Total venta" value={money(total)} className="text-white font-bold" />
            <Row
              label={method === 'Tarjeta' && effectivePercent > 0 ? `Propina (${effectivePercent}%)` : 'Propina'}
              value={money(tip)}
              className="text-sky-300"
            />
            <div className="border-t border-zinc-800 pt-3">
              <Row label="Total a cobrar" value={money(grandTotal)} className="text-2xl md:text-3xl font-black text-white" />
            </div>
            {method === 'Efectivo' && (
              <Row
                label="Cambio"
                value={cashValid ? money(change) : 'Falta efectivo'}
                className={`text-2xl font-bold ${cashValid ? 'text-emerald-400' : 'text-zinc-600'}`}
              />
            )}
          </div>

          {canPrint && (
            <label className="flex items-center gap-3 text-zinc-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
              Imprimir ticket al cobrar
            </label>
          )}

          {error && <p className="text-red-400 font-medium">{error}</p>}

          <button
            onClick={handlePay}
            disabled={!canPay}
            className={`mt-auto w-full py-5 md:py-6 text-xl md:text-2xl font-black rounded-2xl uppercase tracking-wider transition-colors ${
              canPay
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-xl shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {paying ? 'Registrando...' : `Confirmar cobro ${money(grandTotal)}`}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-5xl">
        <div className="px-4 py-3 md:p-6 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950 shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white truncate">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, className = 'text-zinc-300' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between items-baseline ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
