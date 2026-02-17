
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario } from '../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('usuarios').select('*, roles(nombre)');
    if (data) setUsers(data);
    setLoading(false);
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    await supabase.from('usuarios').update({ activo: !currentStatus }).eq('id', id);
    fetchUsers();
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-[0_8px_40px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
      <div className="p-10 border-b border-slate-50 bg-slate-50/30">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Control de Personal</h2>
        <p className="text-slate-400 text-sm font-medium">Gestión de accesos y roles del sistema.</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white border-b border-slate-50">
              <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identidad</th>
              <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Contacto</th>
              <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Nivel de Acceso</th>
              <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Estatus</th>
              <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="px-10 py-24 text-center text-slate-300 font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando nómina...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                      {u.username.charAt(0)}
                    </div>
                    <div className="font-black text-slate-900">{u.username}</div>
                  </div>
                </td>
                <td className="px-10 py-6 font-bold text-slate-500 text-sm">{u.email}</td>
                <td className="px-10 py-6">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    u.roles?.nombre === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {u.roles?.nombre || 'vendedor'}
                  </span>
                </td>
                <td className="px-10 py-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    u.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    {u.activo ? 'Operativo' : 'Restringido'}
                  </div>
                </td>
                <td className="px-10 py-6">
                  <button 
                    onClick={() => toggleStatus(u.id, u.activo)}
                    className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                      u.activo 
                      ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' 
                      : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {u.activo ? 'Desactivar Access' : 'Restaurar Acceso'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
