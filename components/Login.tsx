
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario } from '../types';

interface LoginProps {
  onLogin: (user: Usuario) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSqlFix, setShowSqlFix] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowSqlFix(false);

    try {
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email.trim())
        .eq('password_plano', password.trim())
        .eq('activo', true);

      if (queryError) {
        console.error('Error de Supabase:', queryError);
        if (queryError.message.includes('permission denied') || queryError.code === '42501') {
          setShowSqlFix(true);
          throw new Error('Permiso denegado: El acceso a la tabla está bloqueado.');
        }
        throw new Error(`Error de base de datos: ${queryError.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Credenciales incorrectas o cuenta inactiva');
      }

      onLogin(data[0] as Usuario);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-[440px] bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] border border-slate-200 p-10 md:p-12 relative overflow-hidden">
        
        {/* Decoración sutil de fondo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>

        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-slate-900 text-white mb-6 shadow-xl shadow-slate-200 transform hover:scale-110 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Droguería Pro</h1>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase">Gestión de Inventario</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-white focus:ring-[5px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-300 shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@admin.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-white focus:ring-[5px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-300 shadow-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[12px] font-bold text-center animate-in fade-in slide-in-from-top-1">
              {error}
              {showSqlFix && (
                <div className="mt-3 text-left">
                  <p className="text-[9px] text-rose-400 uppercase mb-1">Fix SQL:</p>
                  <pre className="text-[8px] bg-slate-900 text-slate-300 p-2 rounded-lg font-mono">
                    GRANT SELECT ON public.usuarios TO anon;
                  </pre>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-2 text-sm uppercase tracking-widest"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>

      <div className="mt-10 text-center">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-40">
          SECURE ACCESS &middot; CLOUD INFRASTRUCTURE
        </p>
      </div>
    </div>
  );
};

export default Login;
