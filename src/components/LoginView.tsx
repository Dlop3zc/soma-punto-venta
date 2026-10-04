import { useState, type FormEvent, type ReactNode } from 'react';
import {
  useAuthStore, authErrorMessage, validateUsername, validatePassword, MIN_PASSWORD_LENGTH,
} from '../store/useAuthStore';
import SomaLogo from './icons/SomaLogo';
import { environmentLabel } from '../firebase';

const inputClass =
  'w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors';

export default function LoginView() {
  const { loading, setupRequired } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-black">
        <div className="text-white text-xl animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-black bg-gradient-to-br from-zinc-900 to-black p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl flex flex-col items-center my-auto">
        <div className="mb-6 md:mb-8 flex flex-col items-center gap-3">
          <SomaLogo className="w-40 md:w-48 text-white" />
          {environmentLabel && (
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Base de {environmentLabel}
            </span>
          )}
        </div>
        {setupRequired ? <SetupForm /> : <LoginForm />}
      </div>
    </div>
  );
}

function LoginForm() {
  const { login, sessionError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }
    setSubmitting(true);
    const message = await login(username, password);
    setSubmitting(false);
    if (message) setError(message);
  };

  const shownError = error || sessionError;

  return (
    <>
      <p className="text-zinc-400 mb-6 md:mb-8 text-center">Ingresa tus credenciales para continuar</p>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <Field label="Usuario">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
            placeholder="Ej: mesero1"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        {shownError && <ErrorBox>{shownError}</ErrorBox>}

        <SubmitButton disabled={submitting}>{submitting ? 'Entrando...' : 'Iniciar Sesión'}</SubmitButton>
      </form>
    </>
  );
}

// Primera vez: no existe ningún administrador. Solo se puede hacer una vez.
function SetupForm() {
  const bootstrapAdmin = useAuthStore(s => s.bootstrapAdmin);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const problem = !name.trim() ? 'Escribe tu nombre.'
      : validateUsername(username) ?? validatePassword(password)
      ?? (password !== confirm ? 'Las contraseñas no coinciden.' : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await bootstrapAdmin({ name, username, password });
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-2">Configuración inicial</h1>
      <p className="text-zinc-400 mb-6 text-center text-sm">
        Crea la cuenta del administrador. Después podrás dar de alta a meseros y cocina desde
        <b className="text-zinc-300"> Usuarios</b>.
      </p>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <Field label="Tu nombre">
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Ej. Daniel López" autoComplete="name" />
        </Field>
        <Field label="Usuario de acceso">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label={`Contraseña (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar contraseña">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <SubmitButton disabled={submitting}>{submitting ? 'Creando...' : 'Crear administrador'}</SubmitButton>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-zinc-400 text-sm font-bold mb-2">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
      {children}
    </div>
  );
}

function SubmitButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl mt-2 transition-colors shadow-lg shadow-blue-600/20"
    >
      {children}
    </button>
  );
}
