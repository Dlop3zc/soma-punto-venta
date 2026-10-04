import { useState } from 'react';
import { useAuthStore, type UserProfile } from '../store/useAuthStore';
import { Trash2, Edit2, Plus, X } from 'lucide-react';

export default function AdminUsersView() {
  const { users, activeUser, createUser, updateUser, deleteUser } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'waiter' | 'kitchen'>('waiter');
  
  const [error, setError] = useState('');

  const openNewUser = () => {
    setEditingUser(null);
    setUsername('');
    setName('');
    setPassword('');
    setRole('waiter');
    setError('');
    setIsModalOpen(true);
  };

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name);
    setPassword(user.password || '');
    setRole(user.role);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name || !password) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, { username, name, password, role });
      } else {
        // Prevent duplicate username
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
          setError('El nombre de usuario ya existe.');
          return;
        }
        await createUser({ username, name, password, role });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar el usuario.');
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (user.id === activeUser?.id) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${user.name}?`)) {
      await deleteUser(user.id);
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
          onClick={openNewUser}
          className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Nuevo Usuario</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 flex flex-col relative shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border ${
                  user.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                  user.role === 'kitchen' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {user.role === 'admin' ? '🛡️' : user.role === 'kitchen' ? '👨‍🍳' : '🏃'}
                </div>
                
                <div className="flex gap-2">
                  <button onClick={() => openEditUser(user)} className="p-2 -m-1 text-zinc-400 hover:text-white transition-colors" title="Editar">
                    <Edit2 size={18} />
                  </button>
                  {user.id !== activeUser?.id && (
                    <button onClick={() => handleDelete(user)} className="p-2 -m-1 text-zinc-400 hover:text-red-400 transition-colors" title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              
              <h2 className="text-xl font-bold text-white truncate">{user.name}</h2>
              <p className="text-zinc-400 font-mono text-sm mt-1">@{user.username}</p>
              
              <div className="mt-4 inline-flex">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                  user.role === 'kitchen' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {user.role === 'admin' ? 'Administrador' : user.role === 'kitchen' ? 'Cocina / Bar' : 'Mesero'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md p-6 md:p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-zinc-400 text-sm font-medium mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm font-medium mb-1">Usuario de Acceso</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ej. juan123"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm font-medium mb-1">Contraseña</label>
                <input 
                  type="text" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Contraseña segura"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm font-medium mb-1">Rol</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="waiter">Mesero</option>
                  <option value="kitchen">Cocina / Bartender</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
