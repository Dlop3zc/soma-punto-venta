import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import SomaLogo from './icons/SomaLogo';

export default function LoginView() {
  const { login, loading } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    const success = await login(username.trim(), password.trim());
    if (!success) {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-white text-xl animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black bg-gradient-to-br from-zinc-900 to-black p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-8 shadow-2xl flex flex-col items-center">
        
        <div className="mb-8">
          <SomaLogo className="w-48 text-white" />
        </div>
        <p className="text-zinc-400 mb-8 text-center">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-zinc-400 text-sm font-bold mb-2">Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Ej: admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-sm font-bold mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-4 transition-colors shadow-lg shadow-blue-600/20"
          >
            Iniciar Sesión
          </button>
        </form>

      </div>
    </div>
  );
}
