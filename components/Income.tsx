
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Proveedor, Usuario } from '../types';

interface IncomeProps {
  user: Usuario;
}

const Income: React.FC<IncomeProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    proveedor_id: '',
    num_cajas: 1,
    blisters_por_caja: 1, 
    unids_por_blister: 1,
    costo_por_caja: 0, 
    lote: '',
    laboratorio: '',
    fecha_vencimiento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, prRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre', { ascending: true }),
        supabase.from('proveedores').select('*').order('nombre', { ascending: true })
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (prRes.data) setProviders(prRes.data);
    } catch (e) {
      console.error("Fetch Data Error:", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      if (filteredProducts.length > 0) {
        handleSelectProduct(filteredProducts[0]);
        e.preventDefault();
      }
    }
  };

  const totalBlisters = formData.num_cajas * formData.blisters_por_caja;
  const totalPastillasIngreso = totalBlisters * formData.unids_por_blister;
  const totalFactura = formData.num_cajas * formData.costo_por_caja;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !formData.proveedor_id) return;
    
    setLoading(true);
    try {
      const isPills = selectedProduct.tipo === 'pastillas';
      const cantidadFinalStock = isPills ? totalPastillasIngreso : formData.num_cajas;

      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: user.id,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: cantidadFinalStock,
        costo_unitario: formData.costo_por_caja, 
        total: totalFactura,
        lote: formData.lote.trim().toUpperCase(),
        fecha_vencimiento: formData.fecha_vencimiento || null
      });

      if (incomeError) throw incomeError;

      const updatePayload: any = {};
      if (formData.fecha_vencimiento && formData.fecha_vencimiento !== (selectedProduct.fecha_vencimiento?.split('T')[0])) {
        updatePayload.fecha_vencimiento = formData.fecha_vencimiento;
      }
      if (formData.laboratorio && formData.laboratorio.trim().toUpperCase() !== selectedProduct.laboratorio) {
        updatePayload.laboratorio = formData.laboratorio.trim().toUpperCase();
      }
      
      if (isPills) {
        updatePayload.blisters_por_caja = formData.blisters_por_caja;
        updatePayload.unidades_por_caja = totalPastillasIngreso / formData.num_cajas;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('productos').update(updatePayload).eq('id', selectedProduct.id);
      }
      
      await supabase.rpc('deduct_stock', { p_id: selectedProduct.id, p_qty: -cantidadFinalStock });

      setSuccess(true);
      setFormData({ proveedor_id: '', num_cajas: 1, blisters_por_caja: 1, unids_por_blister: 1, costo_por_caja: 0, lote: '', laboratorio: '', fecha_vencimiento: '' });
      setSelectedProduct(null);
      setSearchTerm('');
      fetchData(); 
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert("Error en el ingreso: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado Multicriterio mejorado para "Relacionados"
  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => {
        const search = searchTerm.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(search) || 
          p.codigo_barras.includes(search) ||
          (p.laboratorio && p.laboratorio.toLowerCase().includes(search)) ||
          (p.ubicacion && p.ubicacion.toLowerCase().includes(search)) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(search))
        );
      })
    : [];

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearchTerm('');
    
    setFormData({ 
      proveedor_id: '',
      num_cajas: 1,
      costo_por_caja: 0,
      lote: '',
      fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '',
      laboratorio: p.laboratorio || '',
      blisters_por_caja: p.blisters_por_caja || 1,
      unids_por_blister: p.blisters_por_caja ? Math.floor((p.unidades_por_caja || 1) / p.blisters_por_caja) : 1
    });
    
    setTimeout(() => {
      if (quantityInputRef.current) quantityInputRef.current.focus();
    }, 250);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-10 px-4 md:px-0">
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
        {/* Header Principal */}
        <div className="bg-slate-900 p-8 lg:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-white">
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">Entrada de Mercancía</h2>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-2">Buscador inteligente de productos relacionados</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <div className="w-14 h-14 bg-white/5 rounded-[1.5rem] flex items-center justify-center text-indigo-400 border border-white/10 backdrop-blur-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
             </div>
          </div>
        </div>
        
        <div className="p-8 lg:p-12">
          {!selectedProduct && (
            <div className="space-y-6">
              {/* Barra de búsqueda con feedback visual */}
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">¿Qué deseas ingresar hoy?</label>
                <div className="relative group">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full px-14 py-7 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/50 outline-none font-bold text-lg transition-all uppercase focus:border-indigo-600 focus:bg-white focus:shadow-2xl focus:shadow-indigo-500/5 shadow-inner"
                    placeholder="Escribe nombre, laboratorio, ubicación o EAN..."
                    value={searchTerm}
                    onKeyDown={handleKeyDown}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </span>
                  {searchTerm.length > 0 && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid de Productos Relacionados */}
              {searchTerm.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between px-2 mb-4">
                     <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em]">Productos Relacionados ({filteredProducts.length})</h3>
                     <span className="text-[9px] font-bold text-slate-400 uppercase">Presiona Enter para elegir el primero</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.length === 0 ? (
                      <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron productos relacionados con "{searchTerm}"</p>
                      </div>
                    ) : (
                      filteredProducts.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className={`flex flex-col text-left p-6 rounded-[2.2rem] border-2 transition-all hover:shadow-xl group relative overflow-hidden ${idx === 0 ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                        >
                          {idx === 0 && (
                            <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest">Relevante</div>
                          )}
                          
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-colors ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}>
                              {p.nombre.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black uppercase text-sm leading-tight truncate text-slate-900">{p.nombre}</p>
                              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest truncate">{p.laboratorio || 'S/L'}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 group-hover:border-slate-200">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Ubicación</span>
                               <span className="text-[10px] font-black text-slate-900 uppercase">{p.ubicacion ? `📍 ${p.ubicacion}` : '---'}</span>
                            </div>
                            <div className="text-right">
                               <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Stock Actual</span>
                               <span className={`block text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${p.stock <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                 {p.stock} UDS
                               </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Formulario de Carga (Cuando ya hay selección) */}
          {selectedProduct && (
            <form onSubmit={handleSubmit} className="animate-in slide-in-from-bottom-6 duration-500 space-y-10">
              <div className="bg-slate-900 p-8 lg:p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-40 -mt-40 transition-transform group-hover:scale-110"></div>
                 
                 <div className="flex items-center gap-8 relative z-10">
                   <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center text-indigo-300 border border-white/10 backdrop-blur-md shadow-2xl">
                      <span className="font-black text-3xl">{selectedProduct.nombre.charAt(0)}</span>
                   </div>
                   <div className="flex-1">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] block mb-2">Medicamento Confirmado</span>
                     <h3 className="font-black text-white text-3xl uppercase leading-none tracking-tight">{selectedProduct.nombre}</h3>
                     <div className="flex flex-wrap items-center gap-4 mt-4">
                        <span className="bg-white/10 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5">LAB: {selectedProduct.laboratorio || '---'}</span>
                        <span className="bg-white/10 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5">EAN: {selectedProduct.codigo_barras}</span>
                        {selectedProduct.ubicacion && (
                          <span className="bg-white/10 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5">📍 {selectedProduct.ubicacion}</span>
                        )}
                     </div>
                   </div>
                 </div>

                 <div className="relative z-10 shrink-0">
                   <button type="button" onClick={() => setSelectedProduct(null)} className="group/close flex items-center gap-3 bg-white/5 hover:bg-rose-500 px-6 py-4 rounded-[1.5rem] border border-white/10 transition-all shadow-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest">Cambiar Selección</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6"/></svg>
                   </button>
                 </div>
              </div>

              {/* Grid de Inputs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Paso 1: Logística */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-lg">01</div>
                    <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Procedencia</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Proveedor Distribuidor</label>
                      <select
                        required
                        className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white outline-none font-bold text-sm focus:border-indigo-600 focus:shadow-xl transition-all appearance-none"
                        value={formData.proveedor_id}
                        onChange={e => setFormData({...formData, proveedor_id: e.target.value})}
                      >
                        <option value="">Elegir Proveedor...</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Verificar Laboratorio</label>
                      <input
                        type="text"
                        required
                        className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white outline-none font-bold text-sm uppercase focus:border-indigo-600 transition-all"
                        value={formData.laboratorio}
                        onChange={e => setFormData({...formData, laboratorio: e.target.value})}
                        placeholder="FABRICANTE"
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 2: Calidad */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-lg">02</div>
                    <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Seguridad</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Lote</label>
                      <input type="text" required className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white outline-none font-bold text-sm uppercase focus:border-indigo-600" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} placeholder="Ej: L-2024-X" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de Vencimiento</label>
                      <input type="date" required className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white outline-none font-black text-sm focus:border-indigo-600" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Paso 3: Costos */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-lg">03</div>
                    <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Carga y Stock</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cant. Cajas</label>
                        <input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl text-indigo-600 focus:border-indigo-600 transition-all" value={formData.num_cajas} onChange={e => setFormData({...formData, num_cajas: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Costo Unit/Caja</label>
                        <input type="number" required step="0.01" className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl text-emerald-600 focus:border-emerald-500" value={formData.costo_por_caja || ''} onChange={e => setFormData({...formData, costo_por_caja: Number(e.target.value)})} placeholder="0.00" />
                      </div>
                    </div>

                    {selectedProduct.tipo === 'pastillas' && (
                      <div className="p-6 rounded-[2.2rem] bg-indigo-50 border border-indigo-100 animate-in zoom-in-95">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">Blisters por Caja</label>
                            <input type="number" required min="1" className="w-full px-4 py-3 rounded-xl border border-indigo-200 bg-white font-black text-sm focus:border-indigo-600" value={formData.blisters_por_caja} onChange={e => setFormData({...formData, blisters_por_caja: Number(e.target.value)})} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">Unids por Blister</label>
                            <input type="number" required min="1" className="w-full px-4 py-3 rounded-xl border border-indigo-200 bg-white font-black text-sm focus:border-indigo-600" value={formData.unids_por_blister} onChange={e => setFormData({...formData, unids_por_blister: Number(e.target.value)})} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer con Totales y Acción */}
              <div className="pt-10 border-t border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-8">
                 <div className="flex gap-6 w-full lg:w-auto">
                   <div className="flex-1 lg:flex-none bg-slate-100 px-8 py-6 rounded-[2.5rem] shadow-inner border border-slate-200/50 text-center lg:text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Stock a Cargar</span>
                      <span className="font-black text-2xl text-slate-900 tracking-tighter">
                        {selectedProduct.tipo === 'pastillas' ? totalPastillasIngreso : formData.num_cajas}
                        <span className="text-xs text-slate-400 ml-2 font-bold uppercase tracking-widest">Unidades</span>
                      </span>
                   </div>
                   <div className="flex-1 lg:flex-none bg-emerald-50 px-8 py-6 rounded-[2.5rem] border-2 border-emerald-100 text-center lg:text-left shadow-lg shadow-emerald-900/5">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Inversión Facturada</span>
                      <span className="font-black text-emerald-700 text-3xl tracking-tighter">
                        ${totalFactura.toLocaleString()}
                      </span>
                   </div>
                 </div>

                 <button
                    type="submit"
                    disabled={loading}
                    className="w-full lg:w-auto lg:px-20 py-7 bg-slate-900 text-white rounded-[2.8rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-4"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Procesando...
                      </>
                    ) : (
                      'Finalizar Registro'
                    )}
                  </button>
              </div>
            </form>
          )}

          {/* Toast de Éxito */}
          {success && (
            <div className="bg-emerald-600 text-white p-8 rounded-[3rem] text-center text-xs font-black uppercase tracking-[0.4em] shadow-2xl animate-in zoom-in-95 duration-500">
               <div className="flex items-center justify-center gap-4">
                 <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                 </div>
                 Mercancía cargada al sistema con éxito
               </div>
            </div>
          )}
        </div>
      </div>

      {!selectedProduct && !success && !searchTerm && (
        <div className="text-center py-20 opacity-30 select-none animate-pulse">
          <p className="font-black text-xs uppercase tracking-[0.5em] text-slate-400">Utiliza el buscador para localizar productos relacionados</p>
        </div>
      )}
    </div>
  );
};

export default Income;
