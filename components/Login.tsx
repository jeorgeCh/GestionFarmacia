
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
      // Intento de login con consulta directa
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
          throw new Error('Permiso denegado: El acceso a la tabla o secuencias está bloqueado en Supabase.');
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-[460px] bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 p-10 md:p-14 relative overflow-hidden">
        
        {/* Header con estilo distinguido */}
        <div className="text-center mb-12 relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-slate-900 text-white mb-6 shadow-2xl shadow-slate-300 transform -rotate-3 hover:rotate-0 transition-all duration-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Droguería Pro</h1>
          <p className="text-slate-400 font-bold text-[11px] tracking-[0.25em] uppercase">Enterprise Management</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Corporativo</label>
            <input
              type="email"
              required
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-[6px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-medium placeholder:text-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@farmacia.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-[6px] focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-medium placeholder:text-slate-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-5 rounded-3xl text-[13px] font-bold text-center animate-in fade-in slide-in-from-top-2 duration-300">
              <p>{error}</p>
              
              {showSqlFix && (
                <div className="mt-4 p-4 bg-white rounded-2xl border border-red-200 text-left overflow-hidden">
                  <p className="text-[10px] text-red-400 uppercase mb-2">Ejecuta esto en Supabase SQL Editor:</p>
                  <pre className="text-[9px] bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto font-mono leading-relaxed">
{`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.usuarios TO anon;`}
                  </pre>
                  <p className="text-[9px] mt-2 text-slate-400 italic font-normal">Esto otorgará permisos de lectura y uso de IDs automáticos.</p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-2xl transition-all shadow-2xl shadow-slate-200 active:scale-[0.97] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3 mt-4"
          >
            {loading ? (
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-60">
          PRO-SERIES &middot; CLOUD MANAGEMENT &middot; V2.5
        </p>
      </div>
    </div>
  );
};

export default Login;
