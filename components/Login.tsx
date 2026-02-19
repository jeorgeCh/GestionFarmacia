
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
      // 1. Validar Credenciales
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('*, roles(nombre)')
        .eq('email', email.trim())
        .eq('password_plano', password.trim())
        .eq('activo', true)
        .maybeSingle();

      if (queryError) throw queryError;
      if (!data) throw new Error('Credenciales incorrectas o usuario inactivo.');

      const usuarioLogueado = data as Usuario;

      // 2. Registrar Auditoría (Login)
      // Usamos un bloque try-catch interno para que el login no falle si falla el log, 
      // pero lo mostramos en consola.
      try {
        const { error: auditError } = await supabase.from('audit_logs').insert({
          usuario_id: usuarioLogueado.id,
          accion: 'LOGIN',
          modulo: 'SISTEMA',
          detalles: `Acceso web: ${new Date().toLocaleTimeString()}`
        });
        
        if (auditError) {
          console.error("❌ ERROR AL GUARDAR LOG LOGIN:", auditError);
        } else {
          console.log("✅ Log LOGIN guardado correctamente");
        }
      } catch (logErr) {
        console.error("❌ EXCEPCION AL GUARDAR LOG:", logErr);
      }

      onLogin(usuarioLogueado);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.05)] border border-slate-100 p-8 md:p-12 animate-in fade-in zoom-in-95">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white mb-6 shadow-xl shadow-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Droguería Pro</h1>
          <p className="text-slate-400 font-bold text-[9px] tracking-[0.3em] uppercase">Gestión en la nube</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-sm font-semibold placeholder:text-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-sm font-semibold placeholder:text-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-[10px] font-black text-center border border-rose-100 animate-slide-up flex items-center justify-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4 text-[10px] uppercase tracking-widest"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
