
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Descuento } from '../types';

const Discounts: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [discounts, setDiscounts] = useState<Descuento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Estados para la búsqueda y creación
  const [discountSearch, setDiscountSearch] = useState(''); // Buscar en la lista de descuentos existentes
  const [productSearch, setProductSearch] = useState('');   // Buscar productos para aplicar nuevo descuento
  
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [porcentaje, setPorcentaje] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const activeDiscountsCount = discounts.filter(d => d.activo).length;
  const avgDiscount = discounts.length > 0 
    ? (discounts.reduce((sum, d) => sum + Number(d.porcentaje), 0) / discounts.length).toFixed(1)
    : 0;

  const handleOpenModal = (discount?: Descuento) => {
    setSaveError(null);
    setProductSearch('');
    if (discount) {
      setSelectedProductId(discount.producto_id);
      setPorcentaje(discount.porcentaje);
    } else {
      setSelectedProductId(null);
      setPorcentaje(10);
    }
    setShowModal(true);
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    await supabase.from('descuentos').update({ activo: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setSaveError("Debes seleccionar un producto.");
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);

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
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.productos?.nombre.toLowerCase().includes(discountSearch.toLowerCase()) ||
    d.productos?.laboratorio?.toLowerCase().includes(discountSearch.toLowerCase())
  );

  const availableProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.laboratorio?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5); // Mostrar solo top 5 sugerencias en el buscador del modal

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-8 animate-slide-up pb-20 px-2 sm:px-0">
      
      {/* ESPACIO DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
              {discounts.length}
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ofertas Totales</p>
              <p className="text-lg font-black text-slate-900 leading-none">Configuradas</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
              {avgDiscount}%
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ahorro Medio</p>
              <p className="text-lg font-black text-slate-900 leading-none">Para el Cliente</p>
            </div>
         </div>
         <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center font-black">
              {activeDiscountsCount}
            </div>
            <div>
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">En Vivo</p>
              <p className="text-lg font-black text-white leading-none">Promos Activas</p>
            </div>
         </div>
      </div>

      {/* HEADER Y BUSCADOR DE LA LISTA */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-600 shadow-inner"
            placeholder="Buscar dentro de mis ofertas actuales..."
            value={discountSearch}
            onChange={(e) => setDiscountSearch(e.target.value)}
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Crear Oferta
        </button>
      </div>

      {/* GRID DE DESCUENTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-xs animate-pulse">Sincronizando campañas...</div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-[3rem] opacity-40">
            <p className="font-black text-[10px] uppercase tracking-widest">No hay descuentos que coincidan</p>
          </div>
        ) : (
          filteredDiscounts.map(d => (
            <div key={d.id} className={`bg-white p-8 rounded-[3rem] border-2 transition-all group relative overflow-hidden flex flex-col justify-between ${d.activo ? 'border-emerald-50 shadow-lg' : 'border-slate-100 grayscale opacity-60'}`}>
              
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-rose-500 text-white flex items-center justify-center font-black text-xl rotate-12 shadow-xl group-hover:rotate-0 transition-transform">
                -{Math.round(d.porcentaje)}%
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase truncate leading-none mb-1 pr-14">{d.productos?.nombre}</h4>
                <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest mb-6">Lab: {d.productos?.laboratorio || 'N/A'}</p>

                <div className="flex items-center gap-4 mb-8 bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Antes</p>
                    <p className="text-sm font-bold text-slate-400 line-through">${Number(d.productos?.precio).toLocaleString()}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="flex-1 text-right">
                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Hoy</p>
                    <p className="text-2xl font-black text-emerald-600 tracking-tighter">${(Number(d.productos?.precio) * (1 - d.porcentaje / 100)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => handleToggleActive(d.id, d.activo)} 
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${d.activo ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'}`}
                >
                  {d.activo ? 'Pausar' : 'Reactivar'}
                </button>
                <button 
                  onClick={() => handleOpenModal(d)} 
                  className="px-6 py-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN PROFESIONAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center shrink-0">
               <div>
                 <h3 className="text-2xl font-black uppercase tracking-tight">Configurar Oferta</h3>
                 <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Estimula la venta con precios competitivos</p>
               </div>
               <button onClick={() => setShowModal(false)} className="w-12 h-12 flex items-center justify-center text-white/50 hover:text-rose-500 transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
               </button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/20">
              
              {saveError && (
                <div className="p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center animate-bounce">{saveError}</div>
              )}

              {/* BUSCADOR DE PRODUCTO DENTRO DEL MODAL */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicamento para la campaña</label>
                {!selectedProductId ? (
                  <div className="space-y-4">
                    <div className="relative group">
                      <input 
                        type="text" 
                        autoFocus
                        className="w-full px-7 py-5 bg-white border-2 border-slate-100 rounded-3xl outline-none font-bold text-sm focus:border-indigo-600 shadow-sm transition-all" 
                        placeholder="Escribe nombre o laboratorio..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {availableProducts.map(p => (
                        <button 
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProductId(p.id)}
                          className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-600 hover:shadow-lg transition-all text-left"
                        >
                          <div>
                            <p className="font-black text-slate-900 text-xs uppercase">{p.nombre}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{p.laboratorio || 'S/L'}</p>
                          </div>
                          <p className="font-black text-slate-900 text-sm tracking-tighter">${p.precio.toLocaleString()}</p>
                        </button>
                      ))}
                      {productSearch.length > 0 && availableProducts.length === 0 && (
                        <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron coincidencias</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] flex justify-between items-center shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Producto Seleccionado</span>
                      <h4 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{selectedProduct?.nombre}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Precio Base: ${selectedProduct?.precio.toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedProductId(null)} className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white hover:bg-rose-500/20 transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
                    </button>
                  </div>
                )}
              </div>

              {selectedProductId && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intensidad del Descuento</label>
                      <span className="text-3xl font-black text-rose-500 tracking-tighter">-{porcentaje}%</span>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-8">
                       <input 
                         type="range" 
                         min="1" 
                         max="90" 
                         step="1" 
                         className="flex-1 h-3 bg-slate-100 rounded-full appearance-none accent-rose-500 cursor-pointer"
                         value={porcentaje}
                         onChange={(e) => setPorcentaje(Number(e.target.value))}
                       />
                    </div>
                  </div>

                  <div className="p-8 bg-emerald-50 rounded-[3rem] border border-emerald-100 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm">
                    <div className="text-center sm:text-left">
                       <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Nuevo Precio de Venta</p>
                       <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none">
                         ${(Number(selectedProduct?.precio || 0) * (1 - porcentaje / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                       </p>
                    </div>
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-6 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !selectedProductId}
                  className="flex-[2] py-5 bg-slate-950 text-white rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-xl hover:bg-emerald-600 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSaving ? 'Aplicando...' : 'Lanzar Oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discounts;
