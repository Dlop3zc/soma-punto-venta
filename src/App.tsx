import { useState, useEffect } from 'react';
import ProductCatalog from './components/ProductCatalog';
import Cart from './components/Cart';
import PaidOrdersHistory from './components/PaidOrdersHistory';
import KitchenView from './components/KitchenView';
import CheckoutView from './components/CheckoutView';
import DashboardView from './components/DashboardView';
import LoginView from './components/LoginView';
import AdminUsersView from './components/AdminUsersView';
import { useCartStore } from './store/useCartStore';
import { useAuthStore } from './store/useAuthStore';
import SomaLogo from './components/icons/SomaLogo';

function App() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeView, setActiveView] = useState<'pos' | 'kitchen' | 'checkout' | 'dashboard' | 'users'>('pos');

  const { orders, activeOrderId, initListeners, alerts, dismissAlert } = useCartStore();
  const { activeUser, initUsersListener, logout } = useAuthStore();

  useEffect(() => {
    const unsubUsers = initUsersListener();
    const unsubCart = initListeners();
    return () => {
      unsubUsers();
      unsubCart();
    };
  }, []);

  // Enforce role access on view change
  useEffect(() => {
    if (activeUser) {
      if (activeUser.role === 'kitchen' && activeView !== 'kitchen') {
        setActiveView('kitchen');
      } else if (activeUser.role === 'waiter' && (activeView === 'dashboard' || activeView === 'users')) {
        setActiveView('pos');
      }
    }
  }, [activeUser, activeView]);

  if (!activeUser) {
    return <LoginView />;
  }

  const currentOrder = orders.find(o => o.id === activeOrderId);
  const itemCount = currentOrder?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  // Find the first unread alert for the current waiter (or all if admin)
  const activeAlert = alerts.find(a => !a.read && (a.waiter === activeUser.name || activeUser.role === 'admin'));

  const handleLogout = () => {
    if (window.confirm("¿Seguro que deseas cerrar sesión?")) {
      logout();
    }
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden flex-col">
      {/* Top Navigation / Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4 lg:px-6 shrink-0">
        <div className="flex items-center gap-4">
          <SomaLogo className="w-24 text-white" />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-zinc-200 font-bold text-sm">{activeUser.name}</p>
            <p className="text-zinc-500 text-xs uppercase font-medium">{activeUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Cerrar Sesión"
          >
            🚪
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {activeView === 'kitchen' ? (
          <KitchenView />
        ) : activeView === 'checkout' && activeUser.role !== 'kitchen' ? (
          <CheckoutView />
        ) : activeView === 'dashboard' && activeUser.role === 'admin' ? (
          <DashboardView />
        ) : activeView === 'users' && activeUser.role === 'admin' ? (
          <AdminUsersView />
        ) : activeUser.role !== 'kitchen' ? (
          <>
            <main className="flex-1 overflow-y-auto">
              <ProductCatalog />
            </main>

            {/* Cart Panel - Hidden on mobile unless toggled, always visible on md+ */}
            <aside
              className={`absolute inset-0 z-40 bg-black md:static md:w-[400px] lg:w-[450px] border-l border-zinc-800 shrink-0 transform transition-transform duration-300 ease-in-out ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
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
                  <Cart />
                </div>
              </div>
            </aside>
          </>
        ) : (
           <KitchenView /> // Fallback for kitchen
        )}

        {/* Right Fixed Sidebar for Menus */}
        <aside className="w-20 md:w-24 bg-zinc-950 border-l border-zinc-800 flex flex-col items-center py-6 gap-6 shrink-0 z-50 shadow-2xl overflow-y-auto">
          
          {/* Menú View Toggle - Not for kitchen */}
          {activeUser.role !== 'kitchen' && (
            <button
              onClick={() => setActiveView('pos')}
              className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${activeView === 'pos'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
            >
              <span className="text-2xl">🍽️</span>
              <span className="text-[10px] md:text-xs font-bold">Menú</span>
            </button>
          )}

          {/* Cocina View Toggle */}
          <button
            onClick={() => setActiveView('kitchen')}
            className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${activeView === 'kitchen'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
          >
            <span className="text-2xl">👨‍🍳</span>
            <span className="text-[10px] md:text-xs font-bold">Por Cocinar</span>
          </button>
          
          {/* Caja View Toggle - Not for kitchen */}
          {activeUser.role !== 'kitchen' && (
            <button
              onClick={() => setActiveView('checkout')}
              className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${activeView === 'checkout'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
            >
              <span className="text-2xl">💰</span>
              <span className="text-[10px] md:text-xs font-bold">Caja</span>
            </button>
          )}

          {/* Dashboard View Toggle - Only for Admin */}
          {activeUser.role === 'admin' && (
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${activeView === 'dashboard'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
            >
              <span className="text-2xl">📊</span>
              <span className="text-[10px] md:text-xs font-bold">Resumen</span>
            </button>
          )}

          {/* Users Admin Toggle - Only for Admin */}
          {activeUser.role === 'admin' && (
            <button
              onClick={() => setActiveView('users')}
              className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${activeView === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
            >
              <span className="text-2xl">👥</span>
              <span className="text-[10px] md:text-xs font-bold">Usuarios</span>
            </button>
          )}

          {/* Cuentas (Mobile Cart Toggle) - Not for kitchen */}
          {activeUser.role !== 'kitchen' && (
            <button
              onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
              className={`md:hidden w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors relative border ${isMobileCartOpen
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-transparent'
                }`}
              disabled={activeView !== 'pos'}
            >
              <span className="text-2xl">🧾</span>
              <span className="text-[10px] md:text-xs font-bold">Cuentas</span>
              {itemCount > 0 && activeView === 'pos' && (
                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          )}

          <div className="mt-auto flex flex-col gap-6">
            {/* Pagadas (Historial) - Only Admin */}
            {activeUser.role === 'admin' && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-2xl transition-colors"
                title="Corte de Caja"
              >
                <span className="text-2xl">✂️</span>
                <span className="text-[10px] md:text-xs font-bold">Corte</span>
              </button>
            )}

            {/* Profile Indicator */}
            <div
              className={`w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors border bg-blue-600/20 text-blue-400 border-blue-500/30 cursor-default`}
              title={activeUser.name}
            >
              <span className="text-2xl">👤</span>
              <span className="text-[10px] md:text-xs font-bold truncate w-full px-1 text-center">
                {activeUser.username}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      {activeUser.role === 'admin' && (
        <PaidOrdersHistory
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Alert Popup (Toast/Modal) */}
      {activeAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <span className="text-6xl">✅</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">¡Atención {activeAlert.waiter}!</h2>
            <p className="text-xl text-zinc-300 mb-8 leading-relaxed">
              {activeAlert.message}
            </p>

            <button
              onClick={() => dismissAlert(activeAlert.id)}
              className="w-full py-4 rounded-xl text-xl font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
