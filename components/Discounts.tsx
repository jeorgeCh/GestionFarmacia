
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Descuento } from '../types';

const Discounts: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [discounts, setDiscounts] = useState<Descuento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | string>('');
  const [porcentaje, setPorcentaje] = useState<number | string>(10);
  const [precioOferta, setPrecioOferta] = useState<number | string>('');
  const [isEditing, setIsEditing] = useState(false);
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

  const selectedProduct = products.find(p => p.id === Number(selectedProductId));

  useEffect(() => {
    if (selectedProduct) {
      const pBase = Number(selectedProduct.precio);
      const nuevoPrecio = pBase * (1 - Number(porcentaje) / 100);
      setPrecioOferta(nuevoPrecio.toFixed(0));
    }
  }, [porcentaje, selectedProductId, products]);

  const handlePrecioOfertaChange = (val: string) => {
    setPrecioOferta(val);
    if (selectedProduct && val) {
      const pBase = Number(selectedProduct.precio);
      const pOferta = Number(val);
      if (pBase > 0) {
        const nuevoPorcentaje = ((pBase - pOferta) / pBase) * 100;
        setPorcentaje(Math.min(Math.max(nuevoPorcentaje, 0), 100).toFixed(1));
      }
    }
  };

  const handleOpenModal = (discount?: Descuento) => {
    setSaveError(null);
    if (discount) {
      setSelectedProductId(discount.producto_id);
      setPorcentaje(discount.porcentaje);
      setIsEditing(true);
    } else {
      setSelectedProductId('');
      setPorcentaje(10);
      setPrecioOferta('');
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    await supabase.from('descuentos').update({ activo: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    setSaveError(null);

    const { error } = await supabase.from('descuentos').upsert({
      producto_id: Number(selectedProductId),
      porcentaje: Number(porcentaje),
      activo: true
    }, { onConflict: 'producto_id' });

    if (error) {
      setSaveError(error.message);
    } else {
      setShowModal(false);
      fetchData();
    }
  };

  return (
    <div className="space-y-8 animate-slide-up pb-10">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div className="px-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Campañas de Oferta</h2>
          <p className="text-slate-400 text-sm font-medium">Configure descuentos automáticos para el POS.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Nueva Promoción
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 font-black uppercase text-xs">Consultando campañas...</div>
        ) : discounts.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem] opacity-40">
            <p className="font-black text-[10px] uppercase tracking-widest px-4">No hay descuentos vigentes actualmente</p>
          </div>
        ) : (
          discounts.map(d => (
            <div key={d.id} className={`bg-white p-8 rounded-[2.5rem] border transition-all relative overflow-hidden group ${d.activo ? 'border-emerald-100 shadow-xl' : 'border-slate-100 grayscale opacity-60'}`}>
              <div className="absolute top-0 right-0 p-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black ${d.activo ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-200 text-slate-500'}`}>
                   <span className="text-lg">-{Math.round(d.porcentaje)}%</span>
                </div>
              </div>

              <div className="pr-16 mb-8">
                <h4 className="text-xl font-black text-slate-900 uppercase truncate leading-none mb-1">{d.productos?.nombre}</h4>
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Lab: {d.productos?.laboratorio || 'N/A'}</p>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Base</p>
                  <p className="text-sm font-bold text-slate-400 line-through">${Number(d.productos?.precio).toLocaleString()}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Oferta</p>
                  <p className="text-2xl font-black text-emerald-600 tracking-tighter">${(Number(d.productos?.precio) * (1 - d.porcentaje / 100)).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleToggleActive(d.id, d.activo)} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${d.activo ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white shadow-emerald-200'}`}>{d.activo ? 'Pausar' : 'Activar'}</button>
                <button onClick={() => handleOpenModal(d)} className="px-5 py-4 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <form onSubmit={handleSave} className="bg-white rounded-[3.5rem] w-full max-w-xl p-8 md:p-12 space-y-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Definir Campaña</h3>
              <p className="text-slate-400 text-sm font-medium">Ajuste el valor final de venta del medicamento.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Producto a Ofertar</label>
                <select 
                  required 
                  disabled={isEditing}
                  className={`w-full px-6 py-5 rounded-2xl border-2 border-slate-50 bg-slate-50 outline-none font-bold appearance-none transition-all ${isEditing ? 'opacity-50' : 'focus:bg-white focus:border-emerald-600'}`}
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="">Seleccione un medicamento...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre} (Lab: {p.laboratorio || 'S/L'})</option>)}
                </select>
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Precio Actual</p>
                      <p className="text-xl font-black text-slate-900">${Number(selectedProduct.precio).toLocaleString()}</p>
                   </div>
                   <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-2">Precio de Oferta</p>
                      <input 
                        type="number" 
                        required
                        className="w-full bg-transparent border-none outline-none font-black text-xl text-emerald-700 p-0"
                        value={precioOferta}
                        onChange={e => handlePrecioOfertaChange(e.target.value)}
                      />
                   </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Control de Porcentaje</label>
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                  <input 
                    type="range" 
                    min="1" 
                    max="90" 
                    step="0.5" 
                    className="flex-1 accent-emerald-600 w-full"
                    value={porcentaje}
                    onChange={e => setPorcentaje(e.target.value)}
                  />
                  <span className="w-16 text-center font-black text-emerald-600 text-2xl">{porcentaje}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border-2 border-slate-100 rounded-[2rem] text-slate-400 font-black text-xs uppercase tracking-widest">Cerrar</button>
              <button type="submit" className="flex-2 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl">Aplicar Oferta</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Discounts;
