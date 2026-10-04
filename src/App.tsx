import { useState, useEffect } from 'react';
import ProductCatalog from './components/ProductCatalog';
import Cart from './components/Cart';
import PaidOrdersHistory from './components/PaidOrdersHistory';
import KitchenView from './components/KitchenView';
import CheckoutView from './components/CheckoutView';
import AnalyticsView from './components/AnalyticsView';
import LoginView from './components/LoginView';
import AdminUsersView from './components/AdminUsersView';
import InventoryView from './components/InventoryView';
import PrinterSettingsView from './components/PrinterSettingsView';
import { useCartStore } from './store/useCartStore';
import { useAuthStore, type UserRole } from './store/useAuthStore';
import { useInventoryStore } from './store/useInventoryStore';
import { usePrinterStore } from './store/usePrinterStore';
import SomaLogo from './components/icons/SomaLogo';

type View = 'pos' | 'kitchen' | 'checkout' | 'dashboard' | 'users' | 'inventory' | 'printer';

interface NavItem {
  key: View | 'corte';
  icon: string;
  label: string;
  roles: UserRole[];
  activeClass: string;
}

// Orden = prioridad: en teléfono los primeros caben en la barra inferior y el resto va en "Más"
const NAV_ITEMS: NavItem[] = [
  { key: 'pos', icon: '🍽️', label: 'Menú', roles: ['admin', 'waiter'], activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' },
  { key: 'kitchen', icon: '👨‍🍳', label: 'Por Cocinar', roles: ['admin', 'waiter', 'kitchen'], activeClass: 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' },
  { key: 'checkout', icon: '💰', label: 'Caja', roles: ['admin', 'waiter'], activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' },
  { key: 'dashboard', icon: '📈', label: 'Analítica', roles: ['admin'], activeClass: 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' },
  { key: 'inventory', icon: '📦', label: 'Inventario', roles: ['admin'], activeClass: 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' },
  { key: 'users', icon: '👥', label: 'Usuarios', roles: ['admin'], activeClass: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' },
  { key: 'printer', icon: '🖨️', label: 'Impresora', roles: ['admin'], activeClass: 'bg-slate-600 text-white shadow-lg shadow-slate-600/20' },
  { key: 'corte', icon: '✂️', label: 'Corte', roles: ['admin'], activeClass: '' },
];

const MOBILE_SLOTS = 4;

function App() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>('pos');

  const { orders, activeOrderId, initListeners, alerts, dismissAlert } = useCartStore();
  const { activeUser, initUsersListener, logout } = useAuthStore();
  const initInventoryListener = useInventoryStore(s => s.initInventoryListener);
  const printerConnected = usePrinterStore(s => !!s.transport);

  useEffect(() => {
    const unsubUsers = initUsersListener();
    const unsubCart = initListeners();
    const unsubInventory = initInventoryListener();
    // Reconectar sola la impresora autorizada previamente en este navegador
    usePrinterStore.getState().reconnect();
    return () => {
      unsubUsers();
      unsubCart();
      unsubInventory();
    };
  }, []);

  // Enforce role access on view change
  useEffect(() => {
    if (activeUser) {
      if (activeUser.role === 'kitchen' && activeView !== 'kitchen') {
        setActiveView('kitchen');
      } else if (activeUser.role === 'waiter' && ['dashboard', 'users', 'inventory', 'printer'].includes(activeView)) {
        setActiveView('pos');
      }
    }
  }, [activeUser, activeView]);

  if (!activeUser) {
    return <LoginView />;
  }

  const currentOrder = orders.find(o => o.id === activeOrderId);
  const itemCount = currentOrder?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const visibleOrders = activeUser.role === 'waiter' ? orders.filter(o => o.waiter === activeUser.name) : orders;
  const kitchenPending = orders.filter(o => o.items.some(i => i.status === 'preparando')).length;

  // Find the first unread alert for the current waiter (or all if admin)
  const activeAlert = alerts.find(a => !a.read && (a.waiter === activeUser.name || activeUser.role === 'admin'));

  const navItems = NAV_ITEMS.filter(i => i.roles.includes(activeUser.role));
  const needsMore = navItems.length > MOBILE_SLOTS + 1;
  const mobilePrimary = needsMore ? navItems.slice(0, MOBILE_SLOTS) : navItems;
  const mobileMore = needsMore ? navItems.slice(MOBILE_SLOTS) : [];
  const showNav = navItems.length > 1;

  const handleNav = (key: NavItem['key']) => {
    setIsMoreOpen(false);
    setIsMobileCartOpen(false);
    if (key === 'corte') setIsHistoryOpen(true);
    else setActiveView(key);
  };

  const handleLogout = () => {
    if (window.confirm("¿Seguro que deseas cerrar sesión?")) {
      logout();
    }
  };

  const badgeFor = (key: NavItem['key']) => (key === 'kitchen' && kitchenPending > 0 ? kitchenPending : 0);

  return (
    <div className="flex h-dvh bg-black overflow-hidden flex-col">
      {/* Top Navigation / Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 shrink-0 pt-safe">
        <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6">
          <SomaLogo className="w-16 md:w-24 text-white" />
          <div className="flex items-center gap-2 md:gap-4">
            {activeUser.role !== 'kitchen' && (
              <span
                className={`text-xs font-bold px-2.5 md:px-3 py-1 rounded-full border ${
                  printerConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}
                title={printerConnected ? 'Impresora conectada' : 'Sin impresora en este equipo'}
              >
                🖨️<span className="hidden sm:inline"> {printerConnected ? 'Lista' : 'Sin impresora'}</span>
              </span>
            )}
            <div className="text-right">
              <p className="text-zinc-200 font-bold text-sm leading-tight max-w-[40vw] truncate">{activeUser.name}</p>
              <p className="text-zinc-500 text-[10px] md:text-xs uppercase font-medium">{activeUser.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Cerrar Sesión"
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {activeView === 'kitchen' ? (
          <KitchenView />
        ) : activeView === 'checkout' && activeUser.role !== 'kitchen' ? (
          <CheckoutView />
        ) : activeView === 'dashboard' && activeUser.role === 'admin' ? (
          <AnalyticsView />
        ) : activeView === 'users' && activeUser.role === 'admin' ? (
          <AdminUsersView />
        ) : activeView === 'inventory' && activeUser.role === 'admin' ? (
          <InventoryView />
        ) : activeView === 'printer' && activeUser.role === 'admin' ? (
          <PrinterSettingsView />
        ) : activeUser.role !== 'kitchen' ? (
          <>
            <main className="flex-1 min-w-0 overflow-hidden">
              <ProductCatalog />
            </main>

            {/* Teléfono: barra flotante con la cuenta actual; abre el carrito a pantalla completa */}
            {!isMobileCartOpen && !isMoreOpen && (
              <button
                onClick={() => setIsMobileCartOpen(true)}
                className="md:hidden absolute left-3 right-3 bottom-3 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-600 active:bg-blue-700 text-white shadow-2xl shadow-black/60"
              >
                <span className="relative text-2xl">
                  🧾
                  {itemCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-white text-blue-700 text-xs font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block font-bold truncate">
                    {currentOrder ? currentOrder.name : 'Cuentas abiertas'}
                  </span>
                  <span className="block text-xs text-blue-100">
                    {currentOrder ? `${itemCount} artículo${itemCount === 1 ? '' : 's'}` : `${visibleOrders.length} abierta${visibleOrders.length === 1 ? '' : 's'}`}
                  </span>
                </span>
                {currentOrder && <span className="text-xl font-black">${currentOrder.total.toFixed(2)}</span>}
                <span className="text-xl">›</span>
              </button>
            )}

            {/* Cart Panel - pantalla completa en teléfono, panel lateral desde tablet */}
            <aside
              className={`absolute inset-0 z-40 bg-black md:static md:w-[340px] lg:w-[400px] xl:w-[450px] border-l border-zinc-800 shrink-0 transform transition-transform duration-300 ease-in-out ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
                }`}
            >
              <div className="h-full flex flex-col">
                {/* Mobile Cart Header with Close button */}
                <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
                  <button
                    onClick={() => setIsMobileCartOpen(false)}
                    className="flex items-center gap-1 text-blue-400 font-bold py-2"
                  >
                    ‹ Seguir agregando
                  </button>
                  <button
                    onClick={() => setIsMobileCartOpen(false)}
                    className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full text-white font-bold text-lg"
                    aria-label="Cerrar cuenta"
                  >
                    ✕
                  </button>
                </div>

                {/* The actual Cart */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Cart />
                </div>
              </div>
            </aside>
          </>
        ) : (
           <KitchenView /> // Fallback for kitchen
        )}

        {/* Barra lateral (tablet y computadora) */}
        {showNav && (
          <aside className="hidden md:flex w-20 lg:w-24 bg-zinc-950 border-l border-zinc-800 flex-col items-center py-4 gap-3 lg:gap-4 shrink-0 z-30 overflow-y-auto">
            {navItems.map(item => (
              <RailButton
                key={item.key}
                item={item}
                active={item.key === activeView}
                badge={badgeFor(item.key)}
                onClick={() => handleNav(item.key)}
                className={item.key === 'corte' ? 'mt-auto' : ''}
              />
            ))}
          </aside>
        )}
      </div>

      {/* Barra inferior (teléfono) */}
      {showNav && (
        <nav className="md:hidden relative shrink-0 bg-zinc-950 border-t border-zinc-800 flex pb-safe z-30">
          {mobilePrimary.map(item => (
            <BottomButton
              key={item.key}
              item={item}
              active={item.key === activeView && !isMoreOpen}
              badge={badgeFor(item.key)}
              onClick={() => handleNav(item.key)}
            />
          ))}
          {needsMore && (
            <BottomButton
              item={{ key: 'pos', icon: '☰', label: 'Más', roles: [], activeClass: '' }}
              active={isMoreOpen || mobileMore.some(i => i.key === activeView)}
              onClick={() => setIsMoreOpen(o => !o)}
            />
          )}
        </nav>
      )}

      {/* Menú "Más" (teléfono) */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-end" onClick={() => setIsMoreOpen(false)}>
          <div
            className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-4 pb-24 grid grid-cols-3 gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="col-span-3 mx-auto w-10 h-1.5 rounded-full bg-zinc-700 mb-1" />
            {mobileMore.map(item => (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`flex flex-col items-center gap-1 py-4 rounded-2xl font-bold text-sm ${
                  item.key === activeView ? item.activeClass : 'bg-zinc-800 text-zinc-200 active:bg-zinc-700'
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <span className="text-5xl md:text-6xl">✅</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">¡Atención {activeAlert.waiter}!</h2>
            <p className="text-lg md:text-xl text-zinc-300 mb-6 md:mb-8 leading-relaxed">
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

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[11px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
      {count}
    </span>
  );
}

function RailButton({ item, active, badge, onClick, className = '' }: {
  item: NavItem; active: boolean; badge: number; onClick: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      className={`relative w-16 h-16 lg:w-[72px] lg:h-[72px] shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${className} ${
        active ? item.activeClass : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
      }`}
    >
      <span className="text-2xl leading-none">{item.icon}</span>
      <span className="text-[10px] lg:text-xs font-bold leading-tight text-center px-0.5">{item.label}</span>
      <Badge count={badge} />
    </button>
  );
}

function BottomButton({ item, active, badge = 0, onClick }: {
  item: NavItem; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
        active ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
      }`}
    >
      <span className={`relative text-xl leading-none px-3 py-1 rounded-full ${active ? 'bg-zinc-800' : ''}`}>
        {item.icon}
        <Badge count={badge} />
      </span>
      <span className="text-[11px] font-bold truncate max-w-full">{item.label}</span>
    </button>
  );
}

export default App;
