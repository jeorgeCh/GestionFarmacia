
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Proveedor } from '../types';

const Providers: React.FC = () => {
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<Partial<Proveedor>>({ nombre: '', nit: '', telefono: '', email: '' });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    const { data } = await supabase.from('proveedores').select('*');
    if (data) setProviders(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (current.id) {
      await supabase.from('proveedores').update(current).eq('id', current.id);
    } else {
      await supabase.from('proveedores').insert([current]);
    }
    setShowModal(false);
    fetchProviders();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Directorio Logístico</h2>
          <p className="text-slate-400 text-sm font-medium">Relación de laboratorios y distribuidores autorizados.</p>
        </div>
        <button 
          onClick={() => { setCurrent({ nombre: '', nit: '', telefono: '', email: '' }); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-indigo-900/10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Añadir Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {providers.map(p => (
          <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgb(0,0,0,0.02)] border border-slate-100 hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="bg-slate-50 p-4 rounded-2xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              </div>
              <button onClick={() => { setCurrent(p); setShowModal(true); }} className="p-2 text-slate-300 hover:text-indigo-600 rounded-xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            </div>
            
            <h4 className="text-xl font-black text-slate-900 mb-2 relative z-10">{p.nombre}</h4>
            <div className="inline-flex px-3 py-1 bg-slate-100 rounded-lg mb-6 relative z-10">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">NIT: {p.nit || 'NO REGISTRADO'}</p>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent group-hover:border-slate-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                </div>
                <span className="text-sm font-bold text-slate-600">{p.telefono || 'Sin teléfono'}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent group-hover:border-slate-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </div>
                <span className="text-sm font-bold text-slate-600 truncate">{p.email || 'Sin correo'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <form onSubmit={handleSave} className="bg-white rounded-[3rem] w-full max-w-xl p-12 space-y-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{current.id ? 'Actualizar' : 'Vincular'} Proveedor</h3>
              <p className="text-slate-400 text-sm font-medium">Completa la información corporativa.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razón Social</label>
                <input type="text" required className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-[6px] focus:ring-indigo-500/5 focus:border-indigo-600 outline-none font-bold transition-all" value={current.nombre} onChange={e => setCurrent({...current, nombre: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIT / Identificación Fiscal</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-[6px] focus:ring-indigo-500/5 focus:border-indigo-600 outline-none font-bold transition-all" value={current.nit} onChange={e => setCurrent({...current, nit: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Línea Directa</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-[6px] focus:ring-indigo-500/5 focus:border-indigo-600 outline-none font-bold transition-all" value={current.telefono} onChange={e => setCurrent({...current, telefono: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input type="email" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-[6px] focus:ring-indigo-500/5 focus:border-indigo-600 outline-none font-bold transition-all" value={current.email} onChange={e => setCurrent({...current, email: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border border-slate-100 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
              <button type="submit" className="flex-2 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/10">Guardar Registro</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Providers;
