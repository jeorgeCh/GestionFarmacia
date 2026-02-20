
import React, { useState } from 'react';
import { View } from '../App';
import { Usuario } from '../types';
import { supabase } from '../supabaseClient';

interface SidebarProps {
  user: Usuario;
  currentView: View;
  setView: (view: View) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, currentView, setView, onLogout }) => {
  const [exiting, setExiting] = useState(false);
  const isSuperUser = Number(user.role_id) === 3;
  const isAdmin = Number(user.role_id) === 1 || isSuperUser;

  const allMenuItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
    )},
    { id: 'pos', label: 'Punto de Venta', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
    )},
    { id: 'inventory', label: 'Control Stock', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
    )},
    { id: 'income', label: 'Ingreso Mercancía', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/></svg>
    )},
  ];

  const adminItems = [
    { id: 'analytics', label: 'Análisis Pro', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
    { id: 'timeline', label: 'Historial Ventas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    { id: 'providers', label: 'Proveedores', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { id: 'discounts', label: 'Descuentos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg> },
  ];

  const menuItems = isAdmin ? allMenuItems : allMenuItems.filter(i => i.id === 'dashboard' || i.id === 'pos');

  const handleSignOut = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await supabase.from('audit_logs').insert({ usuario_id: user.id, accion: 'LOGOUT', modulo: 'SISTEMA', detalles: `Salida` });
    } catch(e) {}
    onLogout();
  };

  const username = user?.username || 'Usuario';

  return (
    <aside className="w-72 bg-slate-950 text-slate-300 flex flex-col hidden lg:flex border-r border-slate-900 shrink-0">
      <div className="p-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-900/20">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
          </div>
          <div>
            <span className="block font-black text-xl tracking-tight text-white leading-none">Droguería</span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">PRO EDITION</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        <p className="px-5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Operaciones</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[13px] uppercase tracking-tight ${
              currentView === item.id 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
              : 'hover:bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}>
            {item.icon}
            {item.label}
          </button>
        ))}

        {isAdmin && (
          <div className="pt-6">
            <p className="px-5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Administración</p>
            {adminItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[13px] uppercase tracking-tight ${
                  currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'hover:bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}

        {isSuperUser && (
           <div className="pt-6">
             <button
               onClick={() => setView('superadmin')}
               className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[13px] uppercase tracking-tight border-2 border-violet-500/30 ${
                 currentView === 'superadmin' 
                 ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' 
                 : 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
               }`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
               Super Usuario
             </button>
           </div>
        )}
      </nav>

      <div className="p-6 mt-auto border-t border-slate-900">
        <div className="bg-slate-900/50 rounded-3xl p-5 border border-slate-800/50 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs uppercase ${isSuperUser ? 'bg-violet-500/20 text-violet-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
              {username.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-black truncate text-xs">{username}</p>
              <p className={`text-[9px] uppercase tracking-widest font-bold ${isSuperUser ? 'text-violet-400' : isAdmin ? 'text-indigo-400' : 'text-emerald-400'}`}>{isSuperUser ? 'Super Usuario' : isAdmin ? 'Administrador' : 'Operario'}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={exiting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all font-black text-[9px] uppercase tracking-widest disabled:opacity-50">
          {exiting ? 'Cerrando...' : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg> Salir</>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
