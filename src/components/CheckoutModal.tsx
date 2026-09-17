import { useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { ArrowLeft } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { orders, activeOrderId, payActiveOrder } = useCartStore();
  const [view, setView] = useState<'selection' | 'cash'>('selection');
  const [cashTendered, setCashTendered] = useState<string>('');

  const activeOrder = orders.find(o => o.id === activeOrderId);
  const total = activeOrder?.total || 0;

  if (!isOpen) return null;

  const handleClose = () => {
    setView('selection');
    setCashTendered('');
    onClose();
  };

  const handleCardPayment = () => {
    payActiveOrder('Tarjeta');
    handleClose();
  };

  const handleCashConfirm = () => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < total) return;
    
    payActiveOrder('Efectivo', tendered, tendered - total);
    handleClose();
  };

  const renderSelectionView = () => (
    <>
      <div className="p-10 text-center border-b border-zinc-800">
        <h2 className="text-4xl font-bold text-zinc-400 mb-4">Total a Cobrar</h2>
        <div className="text-7xl font-extrabold text-white">${total.toFixed(2)}</div>
      </div>
      
      <div className="p-10 grid grid-cols-2 gap-6 bg-zinc-950">
        <button
          onClick={() => setView('cash')}
          className="flex flex-col items-center justify-center gap-4 py-16 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-2xl transition-colors shadow-lg shadow-emerald-600/20"
        >
          <span className="text-4xl font-black tracking-wider">EFECTIVO</span>
        </button>
        
        <button
          onClick={handleCardPayment}
          className="flex flex-col items-center justify-center gap-4 py-16 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-4xl font-black tracking-wider">TARJETA</span>
        </button>
      </div>

      <button
        onClick={handleClose}
        className="py-6 text-xl font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
      >
        Cancelar
      </button>
    </>
  );

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const change = tenderedAmount - total;
  const isCashValid = tenderedAmount >= total;

  const quickAmounts = [
    total,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  const renderCashView = () => (
    <>
      <div className="p-6 border-b border-zinc-800 flex items-center bg-zinc-950">
        <button 
          onClick={() => setView('selection')}
          className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-300 transition-colors"
        >
          <ArrowLeft size={28} />
        </button>
        <h2 className="text-3xl font-bold text-zinc-100 flex-1 text-center pr-12">Pago en Efectivo</h2>
      </div>

      <div className="p-8 grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-zinc-400 text-xl font-medium mb-2">Total a Pagar</p>
            <p className="text-5xl font-bold text-white">${total.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-zinc-400 text-lg font-medium mb-2">Monto Recibido</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-bold text-zinc-500">$</span>
              <input 
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                className="w-full bg-zinc-800 border-2 border-zinc-700 text-white text-5xl font-bold rounded-2xl py-6 pl-16 pr-6 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickAmounts.map(amount => (
              <button
                key={amount}
                onClick={() => setCashTendered(amount.toString())}
                className="py-4 bg-zinc-800 hover:bg-zinc-700 text-xl font-bold text-zinc-200 rounded-xl transition-colors border border-zinc-700"
              >
                ${amount.toFixed(2)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div className={`p-8 rounded-3xl border-2 text-center transition-colors ${
            isCashValid 
              ? 'bg-emerald-950/30 border-emerald-500/50' 
              : 'bg-zinc-950 border-zinc-800'
          }`}>
            <p className={`text-2xl font-medium mb-4 ${isCashValid ? 'text-emerald-400' : 'text-zinc-500'}`}>
              Cambio a Devolver
            </p>
            <p className={`text-7xl font-black ${isCashValid ? 'text-emerald-400' : 'text-zinc-600'}`}>
              ${isCashValid ? change.toFixed(2) : '0.00'}
            </p>
          </div>

          <button
            onClick={handleCashConfirm}
            disabled={!isCashValid}
            className={`w-full py-8 text-3xl font-black rounded-2xl uppercase tracking-wider transition-all mt-6 ${
              isCashValid
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-xl shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            Confirmar Cobro
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
        {view === 'selection' ? renderSelectionView() : renderCashView()}
      </div>
    </div>
  );
}
