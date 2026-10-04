import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 30 * 60 * 1000;

// La app instalada guarda una copia para abrir rápido. Cuando se publica una versión
// nueva se avisa aquí en lugar de recargar sola (podría interrumpir un cobro).
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Las tablets pueden quedarse abiertas todo el turno: revisar de vez en cuando
      if (registration) setInterval(() => registration.update().catch(() => {}), CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;

  // En cuanto la versión nueva toma el control, recargar para usarla
  const update = () => {
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    updateServiceWorker(true);
  };

  return (
    <div className="fixed z-[200] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 w-[calc(100%-2rem)] max-w-md bg-zinc-800 border border-blue-500/40 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
      <span className="text-2xl">✨</span>
      <p className="flex-1 text-zinc-100 font-medium leading-tight">Hay una versión nueva de la app.</p>
      <button
        onClick={() => setNeedRefresh(false)}
        className="px-3 py-2 rounded-xl text-zinc-400 hover:text-white font-bold"
      >
        Después
      </button>
      <button
        onClick={update}
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
      >
        Actualizar
      </button>
    </div>
  );
}
