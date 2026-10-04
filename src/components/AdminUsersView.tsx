import { useState, type FormEvent, type ReactNode } from 'react';
import {
  useAuthStore, authErrorMessage, validateUsername, validatePassword, normalizeUsername,
  MIN_PASSWORD_LENGTH, type UserProfile, type UserRole,
} from '../store/useAuthStore';
import { adminFunctionsEnabled } from '../firebase';
import { Trash2, Edit2, Plus, X, KeyRound } from 'lucide-react';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  waiter: 'Mesero',
  kitchen: 'Cocina / Bar',
};

const ROLE_STYLE: Record<UserRole, { badge: string; avatar: string; icon: string }> = {
  admin: { badge: 'bg-purple-500/20 text-purple-400', avatar: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '🛡️' },
  kitchen: { badge: 'bg-orange-500/20 text-orange-400', avatar: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '👨‍🍳' },
  waiter: { badge: 'bg-blue-500/20 text-blue-400', avatar: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '🏃' },
};

const inputClass =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50';

type Modal =
  | { kind: 'new' }
  | { kind: 'edit'; user: UserProfile }
  | { kind: 'password'; user: UserProfile }
  | null;

export default function AdminUsersView() {
  const { users, activeUser, updateUser, deleteUser } = useAuthStore();
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState('');

  const handleToggleActive = async (user: UserProfile) => {
    const verb = user.active ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que deseas ${verb} a ${user.name}?${user.active ? '\n\nNo podrá iniciar sesión y se cerrará su sesión abierta.' : ''}`)) return;
    try {
      await updateUser(user.id, { active: !user.active });
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  const handleDelete = async (user: UserProfile) => {
    const note = adminFunctionsEnabled
      ? ''
      : '\n\nSu nombre de usuario no podrá volver a usarse. Si solo quieres bloquear el acceso, usa "Desactivar".';
    if (!window.confirm(`¿Eliminar al usuario ${user.name} (@${user.username})?${note}`)) return;
    try {
      await deleteUser(user.id);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <div className="flex-1 h-full bg-zinc-950 flex flex-col overflow-hidden">
      <div className="page-header flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">
            <span>👥</span> Gestión de Usuarios
          </h1>
          <p className="text-zinc-400 mt-1 hidden sm:block">Administra accesos y roles del sistema</p>
        </div>
        <button
          onClick={() => setModal({ kind: 'new' })}
          className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Nuevo Usuario</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium flex justify-between gap-3">
            {error}
            <button onClick={() => setError('')} aria-label="Cerrar"><X size={18} /></button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {users.map(user => {
            const style = ROLE_STYLE[user.role];
            const isSelf = user.id === activeUser?.id;
            return (
              <div
                key={user.id}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 flex flex-col relative shadow-xl ${user.active ? '' : 'opacity-60'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border ${style.avatar}`}>
                    {style.icon}
                  </div>
                  <div className="flex gap-1">
                    <IconButton title="Editar" onClick={() => setModal({ kind: 'edit', user })}>
                      <Edit2 size={18} />
                    </IconButton>
                    {adminFunctionsEnabled && !isSelf && (
                      <IconButton title="Restablecer contraseña" onClick={() => setModal({ kind: 'password', user })}>
                        <KeyRound size={18} />
                      </IconButton>
                    )}
                    {!isSelf && (
                      <IconButton title="Eliminar" danger onClick={() => handleDelete(user)}>
                        <Trash2 size={18} />
                      </IconButton>
                    )}
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white truncate">{user.name}</h2>
                <p className="text-zinc-400 font-mono text-sm mt-1">@{user.username}</p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${style.badge}`}>
                    {ROLE_LABEL[user.role]}
                  </span>
                  {isSelf ? (
                    <span className="text-xs text-zinc-500">Tú</span>
                  ) : (
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`text-xs font-bold px-2 py-1 rounded transition-colors ${
                        user.active
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-red-500/20 text-red-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                      }`}
                    >
                      {user.active ? 'Activo' : 'Desactivado'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!adminFunctionsEnabled && (
          <p className="text-zinc-500 text-sm mt-6 max-w-2xl">
            Para bloquear a alguien usa <b className="text-zinc-400">Desactivar</b>: pierde el acceso de inmediato.
            Cada persona cambia su propia contraseña desde el botón 🔑 de arriba. Para que el administrador pueda
            restablecer contraseñas olvidadas hay que activar las funciones de administración (plan Blaze de Firebase).
          </p>
        )}
      </div>

      {modal?.kind === 'new' && <UserFormModal onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <UserFormModal user={modal.user} onClose={() => setModal(null)} />}
      {modal?.kind === 'password' && <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />}
    </div>
  );
}

function IconButton({ title, danger, onClick, children }: { title: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-2 text-zinc-400 transition-colors ${danger ? 'hover:text-red-400' : 'hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md p-6 md:p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 -m-2 text-zinc-400 hover:text-white" aria-label="Cerrar">
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Alta (con contraseña) o edición (nombre y rol). El usuario de acceso no cambia
// porque es la identidad de la cuenta en Firebase Auth.
function UserFormModal({ user, onClose }: { user?: UserProfile; onClose: () => void }) {
  const { users, activeUser, createUser, updateUser } = useAuthStore();
  const isEdit = !!user;
  const isSelf = user?.id === activeUser?.id;
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'waiter');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let problem: string | null = name.trim() ? null : 'Escribe el nombre.';
    if (!isEdit) {
      problem = problem ?? validateUsername(username) ?? validatePassword(password)
        ?? (users.some(u => u.username === normalizeUsername(username)) ? 'Ese nombre de usuario ya existe.' : null);
    }
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) await updateUser(user.id, isSelf ? { name: name.trim() } : { name: name.trim(), role });
      else await createUser({ username, name, password, role });
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-zinc-400 text-sm font-medium mb-1">Nombre completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} placeholder="Ej. Juan Pérez" />
        </div>

        <div>
          <label className="block text-zinc-400 text-sm font-medium mb-1">Usuario de acceso</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isEdit}
            className={inputClass}
            placeholder="Ej. juan.perez"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {isEdit && <p className="text-zinc-600 text-xs mt-1">El usuario de acceso no se puede cambiar.</p>}
        </div>

        {!isEdit && (
          <div>
            <label className="block text-zinc-400 text-sm font-medium mb-1">Contraseña inicial (mínimo {MIN_PASSWORD_LENGTH})</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="off"
              placeholder="Entrégala en persona; luego la puede cambiar"
            />
          </div>
        )}

        <div>
          <label className="block text-zinc-400 text-sm font-medium mb-1">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={isSelf}
            className={`${inputClass} appearance-none`}
          >
            <option value="waiter">Mesero</option>
            <option value="kitchen">Cocina / Bartender</option>
            <option value="admin">Administrador</option>
          </select>
          {isSelf && <p className="text-zinc-600 text-xs mt-1">No puedes cambiar tu propio rol.</p>}
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium">{error}</div>
        )}

        <div className="pt-2 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors shadow-lg shadow-blue-600/20"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const setUserPassword = useAuthStore(s => s.setUserPassword);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validatePassword(password);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await setUserPassword(user.id, password);
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Contraseña de ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-zinc-400 text-sm">Se cerrará su sesión en todos los dispositivos.</p>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          autoComplete="off"
          placeholder={`Nueva contraseña (mínimo ${MIN_PASSWORD_LENGTH})`}
        />
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
    </ModalShell>
  );
}
