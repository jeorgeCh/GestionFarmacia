
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
      console.error("Fetch Providers Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      if (current.id) {
        const { error } = await supabase.from('proveedores').update(current).eq('id', current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('proveedores').insert([current]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchProviders();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const filteredProviders = providers.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.nit && p.nit.includes(searchTerm))
  );

  return (
    <div className="space-y-8 animate-slide-up pb-20">
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-full lg:w-auto">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Directorio de Proveedores</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestión de Laboratorios y Aliados</p>
        </div>

        <div className="flex-1 w-full max-w-lg relative group">
           <input
             type="text"
             className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-600 shadow-inner transition-all"
             placeholder="Buscar por nombre o NIT..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
           <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
           </div>
        </div>

        <button 
          onClick={() => { setCurrent({ nombre: '', nit: '', telefono: '', email: '' }); setShowModal(true); }}
          className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl hover:shadow-emerald-500/20 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Vincular Nuevo
        </button>
      </div>

      {/* GRID DE PROVEEDORES */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando directorio...</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200 opacity-50">
           <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No se encontraron proveedores</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map(p => (
            <div key={p.id} className="bg-white p-8 rounded-[2.8rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-indigo-100 transition-all group relative overflow-hidden flex flex-col justify-between">
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  </div>
                  <button onClick={() => { setCurrent(p); setShowModal(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all hover:bg-indigo-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>
                
                <h4 className="text-xl font-black text-slate-900 mb-2 uppercase truncate leading-tight group-hover:text-indigo-600 transition-colors">{p.nombre}</h4>
                <div className="inline-flex px-3 py-1 bg-slate-100 rounded-lg mb-8">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">NIT: {p.nit || 'NO REGISTRADO'}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-transparent group-hover:bg-white group-hover:border-slate-100 transition-all">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    </div>
                    <span className="text-sm font-bold text-slate-600">{p.telefono || 'Sin teléfono'}</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-transparent group-hover:bg-white group-hover:border-slate-100 transition-all">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <span className="text-sm font-bold text-slate-600 truncate">{p.email || 'Sin correo'}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between relative z-10">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Activo desde</span>
                 <span className="text-[10px] font-black text-slate-400">{new Date(p.created_at).getFullYear()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE REGISTRO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <form onSubmit={handleSave} className="bg-white rounded-[3.5rem] w-full max-w-xl p-10 md:p-12 space-y-8 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden relative">
            
            <button type="button" onClick={() => setShowModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
            </button>

            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase leading-none">{current.id ? 'Actualizar' : 'Vincular'} Proveedor</h3>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Completa la ficha técnica del aliado comercial.</p>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razón Social / Nombre *</label>
                <input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none font-black text-sm uppercase transition-all" value={current.nombre} onChange={e => setCurrent({...current, nombre: e.target.value})} placeholder="EJ: LABORATORIOS MK" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIT / ID Fiscal</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none font-bold text-sm transition-all" value={current.nit} onChange={e => setCurrent({...current, nit: e.target.value})} placeholder="000.000.000-0" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono Directo</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none font-bold text-sm transition-all" value={current.telefono} onChange={e => setCurrent({...current, telefono: e.target.value})} placeholder="300 000 0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                  <input type="email" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none font-bold text-sm transition-all" value={current.email} onChange={e => setCurrent({...current, email: e.target.value})} placeholder="pedidos@lab.com" />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all">Cerrar</button>
              <button 
                type="submit" 
                disabled={saveLoading}
                className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
              >
                {saveLoading ? 'Procesando...' : 'Guardar Aliado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Providers;
