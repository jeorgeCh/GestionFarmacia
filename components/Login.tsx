
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
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email.trim())
        .eq('password_plano', password.trim())
        .eq('activo', true);

      if (queryError) throw new Error(`Error: ${queryError.message}`);

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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-[420px] bg-white rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.06)] border border-slate-100 p-10 md:p-12 relative overflow-hidden">
        
        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-900 text-white mb-6 shadow-xl shadow-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Acceso al Sistema</h1>
          <p className="text-slate-400 font-bold text-[9px] tracking-[0.3em] uppercase">Droguería Pro Edition</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail corporativo</label>
            <input
              type="email"
              required
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-[6px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@farmacia.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-[6px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[11px] font-bold text-center animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4.5 rounded-2xl transition-all shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4 text-[11px] uppercase tracking-[0.2em]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Entrar al Panel'
            )}
          </button>
        </form>
      </div>

      <div className="mt-10 opacity-30">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">
          Powered by Supabase & Cloud Infrastructure
        </p>
      </div>
    </div>
  );
};

export default Login;
