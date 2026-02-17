
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
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('productos').select('*').order('nombre');
    const { data: dData } = await supabase.from('descuentos').select('*, productos(*)');
    
    if (pData) setProducts(pData);
    if (dData) setDiscounts(dData);
    setLoading(false);
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

    // Usamos upsert basado en producto_id para evitar errores de unicidad
    // Si ya existe el producto_id, Supabase actualizará el registro existente
    const { error } = await supabase.from('descuentos').upsert({
      producto_id: Number(selectedProductId),
      porcentaje: Number(porcentaje),
      activo: true
    }, { onConflict: 'producto_id' });

    if (error) {
      console.error(error);
      if (error.code === '42501') {
        setSaveError("Error de Permisos: Debes ejecutar 'GRANT USAGE ON ALL SEQUENCES' en Supabase.");
      } else {
        setSaveError(error.message);
      }
    } else {
      setShowModal(false);
      fetchData();
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Eliminar esta promoción de forma permanente?")) {
      await supabase.from('descuentos').delete().eq('id', id);
      fetchData();
    }
  };

  const existingDiscountForSelected = discounts.find(d => d.producto_id === Number(selectedProductId));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estrategia de Precios</h2>
          <p className="text-slate-400 text-sm font-medium">Gestiona ofertas y promociones temporales.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-emerald-900/10 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Nueva Promoción
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest">Sincronizando promociones...</div>
        ) : discounts.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem] opacity-40">
            <p className="font-black text-[10px] uppercase tracking-[0.3em]">No hay campañas activas</p>
          </div>
        ) : (
          discounts.map(d => (
            <div key={d.id} className={`bg-white p-8 rounded-[2.5rem] border transition-all relative overflow-hidden group ${d.activo ? 'border-emerald-100 shadow-xl shadow-emerald-900/5' : 'border-slate-100 grayscale opacity-60'}`}>
              <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-2">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${d.activo ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-200 text-slate-500'}`}>
                   <span className="text-lg leading-none">-{Math.round(d.porcentaje)}%</span>
                </div>
              </div>

              <div className="pr-16 mb-8">
                <h4 className="text-xl font-black text-slate-900 leading-tight uppercase truncate">{d.productos?.nombre}</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">EAN: {d.productos?.codigo_barras}</p>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Normal</p>
                  <p className="text-sm font-bold text-slate-400 line-through">${Number(d.productos?.precio).toLocaleString()}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Precio Promo</p>
                  <p className="text-xl font-black text-emerald-600">${(Number(d.productos?.precio) * (1 - d.porcentaje / 100)).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2 relative z-10">
                <button 
                  onClick={() => handleToggleActive(d.id, d.activo)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${d.activo ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'}`}
                >
                  {d.activo ? 'Pausar' : 'Activar'}
                </button>
                <button 
                  onClick={() => handleOpenModal(d)}
                  className="px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                  title="Editar Porcentaje"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button 
                  onClick={() => handleDelete(d.id)}
                  className="px-4 py-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <form onSubmit={handleSave} className="bg-white rounded-[3rem] w-full max-w-xl p-10 space-y-8 shadow-2xl animate-in zoom-in-95">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{isEditing ? 'Editar Descuento' : 'Aplicar Descuento'}</h3>
              <p className="text-slate-400 text-sm font-medium">Define el porcentaje de ahorro para este producto.</p>
            </div>

            {saveError && (
              <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Error de Base de Datos</p>
                <p className="text-xs text-rose-500 font-medium">{saveError}</p>
                {saveError.includes("Permisos") && (
                   <pre className="mt-3 p-3 bg-slate-900 text-slate-300 text-[9px] rounded-lg overflow-x-auto">
                     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
                   </pre>
                )}
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Producto a Promocionar</label>
                <select 
                  required 
                  disabled={isEditing}
                  className={`w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 outline-none font-bold transition-all appearance-none ${isEditing ? 'opacity-50 cursor-not-allowed' : 'focus:bg-white focus:ring-[6px] focus:ring-emerald-500/5 focus:border-emerald-600 cursor-pointer'}`}
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="">Elegir de inventario...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} (${Number(p.precio).toLocaleString()})</option>
                  ))}
                </select>
                {!isEditing && existingDiscountForSelected && (
                  <p className="text-[10px] font-black text-indigo-600 uppercase mt-2 px-4 py-2 bg-indigo-50 rounded-xl">
                    ✨ Este producto ya tiene una oferta activa.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rebaja Porcentual (%)</label>
                <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <input 
                    type="range" 
                    min="1" 
                    max="90" 
                    step="1" 
                    className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                    value={porcentaje}
                    onChange={e => setPorcentaje(e.target.value)}
                  />
                  <span className="w-16 text-center font-black text-emerald-600 text-2xl">{porcentaje}%</span>
                </div>
              </div>

              {selectedProductId && (
                <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">PVP Sugerido en POS</p>
                  <p className="text-2xl font-black text-rose-900">
                    ${(Number(products.find(p => p.id === Number(selectedProductId))?.precio || 0) * (1 - Number(porcentaje) / 100)).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border border-slate-100 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Cerrar</button>
              <button type="submit" className="flex-2 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 transition-all active:scale-95">
                {isEditing ? 'Actualizar Oferta' : 'Lanzar Promoción'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Discounts;
