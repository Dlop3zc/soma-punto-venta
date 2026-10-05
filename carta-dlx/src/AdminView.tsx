import { useEffect, useState, type FormEvent } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { app, db } from './firebase';
import { useMenuStore } from './useMenuStore';
import MenuEditorView from './MenuEditorView';
import SomaLogo from './SomaLogo';

// /admin: editor de la carta para DLX. Entra con una cuenta de Firebase Authentication de SOMA
// que además tenga un documento `menuEditors/{uid}` con `active: true` (se crea a mano en la
// consola; ver README). Esas cuentas no pueden entrar al punto de venta ni ver sus datos.

// Solo el editor carga Firebase Auth; la carta pública no lo necesita
const auth = getAuth(app);

type Session =
  | { state: 'loading' }
  | { state: 'out'; error?: string }
  | { state: 'in'; user: User };

async function isMenuEditor(uid: string) {
  try {
    const snap = await getDoc(doc(db, 'menuEditors', uid));
    return snap.exists() && snap.data().active === true;
  } catch {
    return false;
  }
}

export default function AdminView() {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(() => {
    document.title = 'Editar carta · Terraza SOMA';
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSession(s => (s.state === 'out' ? s : { state: 'out' }));
        return;
      }
      if (await isMenuEditor(user.uid)) {
        setSession({ state: 'in', user });
      } else {
        await signOut(auth);
        setSession({ state: 'out', error: 'Esta cuenta no tiene permiso para editar la carta.' });
      }
    });
  }, []);

  // Escuchar la carta solo con sesión de editor
  const signedIn = session.state === 'in';
  useEffect(() => {
    if (!signedIn) return;
    return useMenuStore.getState().initMenuListener();
  }, [signedIn]);

  if (session.state === 'loading') {
    return <div className="h-[100dvh] grid place-items-center text-zinc-500">Cargando…</div>;
  }
  if (session.state === 'out') return <LoginForm initialError={session.error} />;
  return <MenuEditorView userEmail={session.user.email || ''} onLogout={() => signOut(auth)} />;
}

function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(code === 'auth/too-many-requests'
        ? 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
        : code === 'auth/network-request-failed'
          ? 'Sin conexión a internet.'
          : 'Correo o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-200';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center mb-6">
          <SomaLogo className="w-32 text-amber-200" />
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-400">Editar carta</p>
        </div>
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" className={inputClass} />
        <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className={inputClass} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-amber-200 text-zinc-950 font-bold disabled:opacity-50">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
