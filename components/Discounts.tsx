
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Descuento } from '../types';

const Discounts: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [discounts, setDiscounts] = useState<Descuento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Descuento | null>(null);
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
      const { data: dData } = await supabase.from('descuentos').select('*, productos(*)').order('id', { ascending: false });
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

  const handleOpenNew = () => {
    setIsEditing(false);
    setEditingDiscount(null);
    setSelectedProductId(null);
    setPorcentaje(10);
    setProductSearch('');
    setShowModal(true);
  };

  const handleOpenEdit = (discount: Descuento) => {
    setIsEditing(true);
    setEditingDiscount(discount);
    setSelectedProductId(discount.producto_id);
    setPorcentaje(discount.porcentaje);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || isSaving) return;
    setIsSaving(true);
    
    try {
      let error;
      if (isEditing && editingDiscount) {
        const { error: updateError } = await supabase.from('descuentos').update({ 
          porcentaje: Number(porcentaje) 
        }).eq('id', editingDiscount.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('descuentos').upsert({
          producto_id: selectedProductId,
          porcentaje: Number(porcentaje),
          activo: true
        }, { onConflict: 'producto_id' });
        error = insertError;
      }

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
    !discounts.some(d => d.producto_id === p.id) &&
    p.nombre.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 100);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const basePrice = useMemo(() => {
      if (!selectedProduct) return 0;
      return selectedProduct.precio_unidad > 0 ? selectedProduct.precio_unidad : selectedProduct.precio;
  }, [selectedProduct]);

  const finalPrice = useMemo(() => {
      return basePrice * (1 - porcentaje / 100);
  }, [basePrice, porcentaje]);

  const handleFinalPriceChange = (priceStr: string) => {
    const price = parseFloat(priceStr);
    if (!isNaN(price) && basePrice > 0 && price < basePrice) {
        const newPercentage = ((basePrice - price) / basePrice) * 100;
        setPorcentaje(Math.round(Math.max(1, Math.min(95, newPercentage))));
    }
  }

  return (
    <div className="space-y-10 animate-slide-up pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100">
        <div className="flex-1 w-full relative">
          <input
            type="text"
            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-bold text-sm focus:bg-white focus:border-rose-500 transition-all shadow-inner"
            placeholder="Buscar descuento por nombre de producto..."
            value={discountSearch}
            onChange={(e) => setDiscountSearch(e.target.value)}
          />
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
        </div>
        <button 
          onClick={handleOpenNew}
          className="w-full lg:w-auto bg-slate-950 text-white px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-rose-600 hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Nuevo Descuento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDiscounts.map(d => (
          <div key={d.id} className={`bg-white rounded-[2rem] border transition-all group relative overflow-hidden flex flex-col ${d.activo ? 'border-slate-100 shadow-lg' : 'border-slate-100 opacity-60 grayscale'}`}>
            <div className="p-5 bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-center">
                    <h4 className="font-black text-slate-800 text-[10px] uppercase leading-normal truncate pr-4" title={d.productos?.nombre}>{d.productos?.nombre}</h4>
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${d.activo ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                        {d.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{d.productos?.laboratorio || 'General'}</p>
            </div>
            
            <div className="flex-1 p-5 flex flex-col justify-center items-center text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descuento</p>
                <div className="flex items-baseline gap-1 text-rose-500 my-1">
                    <p className="text-5xl font-black tracking-tighter">{Math.round(d.porcentaje)}</p>
                    <p className="text-xl font-black">%</p>
                </div>
            </div>

            <div className="p-3 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button 
                    onClick={() => handleToggleActive(d.id, d.activo)} 
                    className={`py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${d.activo ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                    {d.activo ? 'Desactivar' : 'Activar'}
                </button>
                 <button 
                    onClick={() => handleOpenEdit(d)} 
                    className="py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 bg-slate-800 text-white hover:bg-rose-600">
                    Editar
                </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
            <div className="p-8 border-b border-slate-100 shrink-0">
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                {isEditing ? 'Editar' : 'Nuevo'} <span className="text-rose-500">Descuento</span>
              </h3>
            </div>

            <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
              {isEditing || selectedProductId ? (
                <div className="space-y-6 animate-in zoom-in-95">
                  <div className="p-6 bg-slate-900 text-white rounded-2xl flex justify-between items-center shadow-lg">
                    <div>
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Producto Seleccionado</p>
                      <h4 className="font-black uppercase text-base tracking-tight leading-none">{selectedProduct?.nombre}</h4>
                    </div>
                    {!isEditing && (
                      <button type="button" onClick={() => setSelectedProductId(null)} className="p-3 bg-white/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                     <div className="flex justify-around items-center bg-slate-50 p-4 rounded-xl text-center">
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio Original</span>
                            <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">${basePrice.toLocaleString()}</p>
                        </div>
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        <div>
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Precio Final</span>
                            <p className="text-2xl font-black text-emerald-600 tracking-tight mt-1">${finalPrice.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="pt-4 space-y-4">
                        <div className="text-center">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajustar Porcentaje</label>
                            <div className="flex items-baseline justify-center gap-1 text-rose-500 mt-2">
                               <p className="text-7xl font-black tracking-tighter">{porcentaje}%</p>
                            </div>
                        </div>
                        <div className="px-4">
                          <input type="range" min="1" max="95" className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-rose-500" value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} />
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest"><span>1%</span><span>95%</span></div>
                        </div>
                    </div>

                     <div className="relative text-center py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                        <div className="relative inline-block px-4 bg-white text-slate-400 text-xs font-bold">O</div>
                    </div>

                    <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ajustar Precio Final</label>
                         <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input type="number" className="w-full pl-8 pr-5 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-black text-lg focus:border-rose-500 transition-all" value={finalPrice.toFixed(2)} onChange={(e) => handleFinalPriceChange(e.target.value)} />
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                 <div className="space-y-6 animate-in slide-in-from-bottom-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Buscar producto a afectar</label>
                    <input type="text" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-base focus:bg-white focus:border-rose-500 transition-all shadow-inner" placeholder="Escribe el nombre del medicamento..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                  </div>
                  <div className="space-y-2 h-72 overflow-y-auto custom-scrollbar pr-2">
                    {availableProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => setSelectedProductId(p.id)} className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-left font-black uppercase text-[10px] hover:border-rose-500 hover:bg-rose-50/50 transition-all flex justify-between items-center group shadow-sm">
                        <div className="flex flex-col">
                          <span>{p.nombre}</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-bold">Lab: {p.laboratorio || 'N/A'}</span>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-rose-500 font-black tracking-widest transition-all -translate-x-2 group-hover:translate-x-0">→</span>
                      </button>
                    ))}
                    {productSearch && availableProducts.length === 0 && <div className="py-16 text-center text-slate-300 font-black uppercase text-[9px] tracking-[0.3em] bg-slate-50 rounded-2xl border border-dashed border-slate-200">Sin productos para ofertar</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-4 shrink-0">
                <button onClick={() => setShowModal(false)} className="w-1/3 py-4 bg-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-300 transition-all">Cancelar</button>
                <button onClick={handleSave} disabled={isSaving || !selectedProductId} className="w-2/3 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none">
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discounts;
