
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Proveedor } from '../types';

const Providers: React.FC = () => {
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Partial<Proveedor>>({ nombre: '', nit: '', telefono: '', email: '' });
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('proveedores').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      if (data) setProviders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      if (current.id) {
        await supabase.from('proveedores').update(current).eq('id', current.id);
      } else {
        await supabase.from('proveedores').insert([current]);
      }
      setShowModal(false);
      fetchProviders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const filtered = providers.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.nit && p.nit.includes(searchTerm))
  );

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando directorio...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-slide-up pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Aliados Comerciales</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2 bg-indigo-50 w-fit px-3 py-1 rounded-full">Gestión de Laboratorios</p>
        </div>
        <div className="flex-1 w-full max-w-xl relative">
           <input
             type="text"
             className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-400 transition-all shadow-inner"
             placeholder="Buscar laboratorio o distribuidor..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
           <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
           </div>
        </div>
        <button 
          onClick={() => { setCurrent({ nombre: '', nit: '', telefono: '', email: '' }); setShowModal(true); }}
          className="w-full lg:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          Nuevo Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(p => (
          <div key={p.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-indigo-100 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[250px]">
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-indigo-50/50 transition-colors"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                </div>
                <button onClick={() => { setCurrent(p); setShowModal(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-90 border border-transparent hover:border-indigo-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-1 uppercase truncate leading-tight group-hover:text-indigo-600 transition-colors tracking-tight">{p.nombre}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">NIT: {p.nit || 'S.D.'}</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm group-hover:bg-white transition-all">
                  <div className="w-8 h-8 rounded-xl bg-white text-indigo-500 flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  </div>
                  <span className="text-xs font-black text-slate-700">{p.telefono || 'Sin contacto'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <form onSubmit={handleSave} className="bg-white rounded-[3.5rem] w-full max-w-xl p-10 lg:p-12 space-y-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Gestión de <span className="text-indigo-600">Aliado</span></h3>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre Comercial</label>
                <input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none font-black text-sm uppercase transition-all shadow-inner" value={current.nombre} onChange={e => setCurrent({...current, nombre: e.target.value})} placeholder="EJ: LABORATORIOS MK" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">NIT / ID</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none font-bold text-sm transition-all shadow-inner" value={current.nit} onChange={e => setCurrent({...current, nit: e.target.value})} placeholder="900.000.000" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Teléfono</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none font-bold text-sm transition-all shadow-inner" value={current.telefono} onChange={e => setCurrent({...current, telefono: e.target.value})} placeholder="310 000 0000" />
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all">Cancelar</button>
              <button type="submit" disabled={saveLoading} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50">
                {saveLoading ? 'Sincronizando...' : 'Guardar Aliado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Providers;
