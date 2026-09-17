import { useCartStore } from '../store/useCartStore';

interface WaiterSelectorModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
}

export default function WaiterSelectorModal({ isOpen, onClose, title = "¿Quién eres?" }: WaiterSelectorModalProps) {
  const { waiters, currentWaiter, setCurrentWaiter } = useCartStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col p-8">
        
        <h2 className="text-4xl font-bold text-center text-zinc-100 mb-8">{title}</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {waiters.map(waiter => (
            <button
              key={waiter}
              onClick={() => {
                setCurrentWaiter(waiter);
                if (onClose) onClose();
              }}
              className={`py-8 text-2xl font-bold rounded-2xl border-2 transition-all ${
                currentWaiter === waiter
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {waiter}
            </button>
          ))}
        </div>

        {onClose && (
          <div className="mt-8 text-center">
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 text-xl font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
