
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Descuento } from '../types';

const Discounts: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [discounts, setDiscounts] = useState<Descuento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [discountSearch, setDiscountSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [porcentaje, setPorcentaje] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pData } = await supabase.from('productos').select('*').order('nombre');
      const { data: dData } = await supabase.from('descuentos').select('*, productos(*)');
      if (pData) setProducts(pData);
      if (dData) setDiscounts(dData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    await supabase.from('descuentos').update({ activo: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || isSaving) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('descuentos').upsert({
        producto_id: selectedProductId,
        porcentaje: Number(porcentaje),
        activo: true
      }, { onConflict: 'producto_id' });
      if (error) throw error;
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.productos?.nombre.toLowerCase().includes(discountSearch.toLowerCase())
  );

  const availableProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-10 animate-slide-up pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100">
        <div className="flex-1 w-full relative">
          <input
            type="text"
            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] outline-none font-bold text-sm focus:bg-white focus:border-rose-500 transition-all shadow-inner"
            placeholder="Buscar en el catálogo de ofertas vigentes..."
            value={discountSearch}
            onChange={(e) => setDiscountSearch(e.target.value)}
          />
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
        </div>
        <button 
          onClick={() => { setSelectedProductId(null); setPorcentaje(10); setShowModal(true); }} 
          className="w-full lg:w-auto bg-slate-950 text-white px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-rose-600 hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <div className="bg-white/20 p-1.5 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          </div>
          Nueva Promoción
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredDiscounts.map(d => (
          <div key={d.id} className={`bg-white p-10 rounded-[4rem] border-2 flex flex-col justify-between transition-all group relative overflow-hidden ${d.activo ? 'border-rose-100 shadow-2xl shadow-rose-500/5' : 'border-slate-100 opacity-50 grayscale'}`}>
            {d.activo && (
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl"></div>
            )}
            
            <div className="flex justify-between items-start mb-8 relative z-10">
               <div className="bg-rose-50 text-rose-500 w-16 h-16 rounded-[2rem] flex items-center justify-center font-black text-2xl shadow-inner border border-rose-100">%</div>
               <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${d.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                 {d.activo ? 'Vigente' : 'Inactivo'}
               </span>
            </div>
            
            <div className="relative z-10">
              <h4 className="text-xl font-black text-slate-900 uppercase truncate leading-tight mb-2 tracking-tight group-hover:text-rose-500 transition-colors">{d.productos?.nombre}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">{d.productos?.laboratorio || 'Medicamento General'}</p>
              <div className="flex items-end gap-1 mb-10">
                <p className="text-7xl font-black text-rose-500 tracking-tighter leading-none">-{Math.round(d.porcentaje)}</p>
                <p className="text-3xl font-black text-rose-500 mb-1">%</p>
              </div>
            </div>

            <div className="flex gap-4 relative z-10">
              <button 
                onClick={() => handleToggleActive(d.id, d.activo)} 
                className={`flex-1 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 ${d.activo ? 'bg-slate-900 text-white hover:bg-rose-600' : 'bg-emerald-600 text-white'}`}
              >
                {d.activo ? 'Suspender' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="bg-white rounded-[4.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col p-12 lg:p-16 space-y-10 border border-white/20">
            <h3 className="text-4xl font-black uppercase tracking-tight text-slate-900 leading-none">Configurar <span className="text-rose-500 underline decoration-rose-200 underline-offset-8">Oferta</span></h3>
            
            {!selectedProductId ? (
              <div className="space-y-8 animate-in slide-in-from-bottom-5">
                <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscador de Inventario</label>
                   <input type="text" className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none font-black text-lg focus:bg-white focus:border-rose-500 transition-all shadow-inner" placeholder="Escribe el nombre del medicamento..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                </div>
                <div className="space-y-3">
                  {availableProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => setSelectedProductId(p.id)} className="w-full p-6 bg-white border-2 border-slate-50 rounded-[2rem] text-left font-black uppercase text-xs hover:border-rose-500 hover:bg-rose-50/30 transition-all flex justify-between items-center group shadow-sm">
                      <div className="flex flex-col">
                        <span>{p.nombre}</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-bold">Lab: {p.laboratorio}</span>
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 text-rose-500 font-black tracking-widest transition-all translate-x-4 group-hover:translate-x-0">Asignar →</span>
                    </button>
                  ))}
                  {availableProducts.length === 0 && <div className="py-16 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.3em] bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">Resultados insuficientes</div>}
                </div>
              </div>
            ) : (
              <div className="space-y-12 animate-in zoom-in-95">
                <div className="p-10 bg-gradient-to-br from-slate-950 to-slate-800 text-white rounded-[3rem] flex justify-between items-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Medicamento Seleccionado</p>
                    <h4 className="font-black uppercase text-2xl tracking-tight leading-none">{selectedProduct?.nombre}</h4>
                  </div>
                  <button type="button" onClick={() => setSelectedProductId(null)} className="relative z-10 p-4 bg-white/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                  </button>
                </div>
                
                <div className="space-y-8">
                  <div className="flex justify-between items-end px-4">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Descuento Final</label>
                    <div className="flex items-end gap-1">
                      <span className="text-8xl font-black text-rose-500 tracking-tighter leading-none">{porcentaje}</span>
                      <span className="text-3xl font-black text-rose-500 mb-2">%</span>
                    </div>
                  </div>
                  <div className="px-4">
                    <input type="range" min="1" max="95" className="w-full h-4 bg-slate-100 rounded-full appearance-none cursor-pointer accent-rose-600" value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} />
                    <div className="flex justify-between text-[11px] font-black text-slate-300 uppercase mt-4 tracking-widest"><span>Min: 1%</span><span>Máx: 95%</span></div>
                  </div>
                </div>

                <div className="flex gap-5">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Descartar</button>
                  <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-6 bg-rose-600 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] shadow-2xl shadow-rose-900/30 active:scale-95 transition-all">
                    {isSaving ? 'Procesando...' : 'Habilitar Oferta'}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setShowModal(false)} className="w-full text-center text-slate-300 font-black uppercase text-[9px] tracking-[0.5em] hover:text-rose-500 transition-colors">Cerrar Ventana</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discounts;
