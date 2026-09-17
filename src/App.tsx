import { useState, useEffect } from 'react';
import ProductCatalog from './components/ProductCatalog';
import Cart from './components/Cart';
import PaidOrdersHistory from './components/PaidOrdersHistory';
import WaiterSelectorModal from './components/WaiterSelectorModal';
import CheckoutModal from './components/CheckoutModal';
import { useCartStore } from './store/useCartStore';

function App() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWaiterSelectorOpen, setIsWaiterSelectorOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const { currentWaiter, orders, activeOrderId, initListeners } = useCartStore();

  useEffect(() => {
    initListeners();
  }, []);

  const currentOrder = orders.find(o => o.id === activeOrderId);
  const total = currentOrder?.total || 0;
  const itemCount = currentOrder?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  return (
    <div className="flex h-screen bg-black overflow-hidden flex-col">
      {/* Top Navigation / Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4 lg:px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white tracking-wide">POS <span className="text-blue-500">PRO</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-full font-medium transition-colors border border-zinc-700"
          >
            <span className="text-xl">🕒</span>
            <span className="hidden md:inline">Historial</span>
          </button>
          
          <button
            onClick={() => setIsWaiterSelectorOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors border ${
              currentWaiter 
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30' 
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
            }`}
          >
            <span className="text-xl">👤</span>
            <span>{currentWaiter || 'Seleccionar Mesero'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto">
          <ProductCatalog />
        </main>
        
        {/* Cart Panel - Hidden on mobile unless toggled, always visible on md+ */}
        <aside 
          className={`absolute inset-0 z-40 bg-black md:static md:w-[400px] lg:w-[450px] border-l border-zinc-800 shrink-0 transform transition-transform duration-300 ease-in-out ${
            isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Mobile Cart Header with Close button */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
              <h2 className="text-xl font-bold text-white">Cuenta Actual</h2>
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full text-white font-bold text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* The actual Cart */}
            <div className="flex-1 overflow-hidden">
              <Cart onCheckout={() => setIsCheckoutOpen(true)} />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Bar (visible only on small screens and when cart is closed) */}
      {!isMobileCartOpen && (
        <div className="md:hidden p-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 px-6 font-bold text-lg flex items-center justify-between transition-colors shadow-lg shadow-blue-600/20"
          >
            <div className="flex items-center gap-3">
              <span className="bg-black/20 px-3 py-1 rounded-full text-sm">{itemCount} items</span>
              <span>Ver Cuenta</span>
            </div>
            <span>${total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <PaidOrdersHistory 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
      />

      <WaiterSelectorModal 
        isOpen={currentWaiter === null || isWaiterSelectorOpen} 
        onClose={currentWaiter !== null ? () => setIsWaiterSelectorOpen(false) : undefined} 
        title={currentWaiter === null ? "Selecciona tu usuario para iniciar" : "Cambiar Mesero"}
      />

      <CheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}

export default App;
