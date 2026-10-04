import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAuthStore, authErrorMessage, validatePassword, MIN_PASSWORD_LENGTH } from '../store/useAuthStore';

const inputClass =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const changeOwnPassword = useAuthStore(s => s.changeOwnPassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = !current ? 'Escribe tu contraseña actual.'
      : validatePassword(next) ?? (next !== confirm ? 'Las contraseñas nuevas no coinciden.' : null)
      ?? (next === current ? 'La contraseña nueva debe ser distinta a la actual.' : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await changeOwnPassword(current, next);
      setDone(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? 'La contraseña actual no es correcta.'
        : authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md p-6 md:p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Cambiar mi contraseña</h2>
          <button onClick={onClose} className="p-2 -m-2 text-zinc-400 hover:text-white" aria-label="Cerrar">
            <X size={24} />
          </button>
        </div>

        {done ? (
          <div className="space-y-6">
            <p className="text-emerald-400 font-medium">Listo. Usa tu nueva contraseña la próxima vez que inicies sesión.</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-1">Contraseña actual</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-1">Nueva contraseña (mínimo {MIN_PASSWORD_LENGTH})</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} className={inputClass} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
            </div>
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium">{error}</div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
