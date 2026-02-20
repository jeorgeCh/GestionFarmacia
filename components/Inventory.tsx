
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario } from '../types';

interface InventoryProps { 
  user: Usuario; 
  setView?: (view: any) => void; 
}

const Inventory: React.FC<InventoryProps> = ({ user, setView }) => {
  const [allProducts, setAllProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('nombre'); // 'nombre', 'vencimiento', 'stock'
  const [showModal, setShowModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [managementMode, setManagementMode] = useState<'simple' | 'box'>('box');

  const [formData, setFormData] = useState<Partial<Producto>>({
    id: undefined,
    codigo_barras: '',
    tipo: 'producto',
    nombre: '',
    laboratorio: '',
    precio: 0, 
    precio_unidad: 0, 
    unidades_por_caja: 1, 
    descripcion: '',
    ubicacion: ''
  });

  const userRole = Number(user.role_id);
  const isAdmin = userRole === 1;
  const isSuperUser = userRole === 3;
  const isSeller = userRole === 2;

  const canManageProducts = isAdmin || isSuperUser || isSeller;
  const canEditPrices = isAdmin || isSuperUser;

  useEffect(() => { 
    fetchProducts(); 
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      if (data) setAllProducts(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (p?: Producto) => {
    setSaveError(null);
    if (p) {
      const isSimple = (p.unidades_por_caja || 1) <= 1;
      setManagementMode(isSimple ? 'simple' : 'box');
      setFormData(p);
    } else {
      setManagementMode('box');
      setFormData({ 
        id: undefined,
        codigo_barras: '',
        tipo: 'producto',
        nombre: '',
        laboratorio: '',
        precio: 0, 
        precio_unidad: 0, 
        unidades_por_caja: 1, 
        descripcion: '',
        ubicacion: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const isSimple = managementMode === 'simple';
      
      const payload: Partial<Producto> = {
        ...formData,
        nombre: formData.nombre?.trim().toUpperCase(),
        laboratorio: formData.laboratorio?.trim().toUpperCase(),
        descripcion: formData.descripcion?.trim(),
        ubicacion: formData.ubicacion?.trim().toUpperCase(),
        precio: isSimple ? 0 : (Number(formData.precio) || 0), 
        precio_unidad: Number(formData.precio_unidad) || 0,
        unidades_por_caja: isSimple ? 1 : (Number(formData.unidades_por_caja) || 1)
      };

      if (!canEditPrices && formData.id) {
        delete payload.precio;
        delete payload.precio_unidad;
        delete payload.unidades_por_caja;
      }

      if (formData.id) {
        const { error } = await supabase.from('productos').update(payload).eq('id', formData.id);
        if (error) throw error;
        
        await supabase.from('audit_logs').insert({
            usuario_id: user.id,
            accion: 'EDICION_PRODUCTO',
            modulo: 'INVENTARIO',
            detalles: `Actualizó: ${payload.nombre}. PVP U: $${payload.precio_unidad}`
        });

      } else {
        const { error } = await supabase.from('productos').insert([{ ...payload, stock: 0 }]);
        if (error) throw error;

        await supabase.from('audit_logs').insert({
            usuario_id: user.id,
            accion: 'CREACION_PRODUCTO',
            modulo: 'INVENTARIO',
            detalles: `Creó: ${payload.nombre}. Lab: ${payload.laboratorio}`
        });
      }
      
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setSaveError(err.message || "Error al guardar producto.");
    } finally {
      setIsSaving(false);
    }
  };

  const { totalRefs, totalStock, lowStock } = useMemo(() => {
    return allProducts.reduce((acc, p) => {
        acc.totalStock += p.stock || 0;
        if ((p.stock || 0) < 10 && (p.stock || 0) > 0) {
            acc.lowStock += 1;
        }
        return acc;
    }, { totalStock: 0, lowStock: 0, totalRefs: allProducts.length });
  }, [allProducts]);

  const getVencimientoStatus = (fecha: string | null) => {
      if (!fecha) return { text: 'Sin Fecha', color: 'text-slate-400' };
      
      const hoy = new Date();
      const vencimiento = new Date(fecha);
      const diffTime = vencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const formatted = vencimiento.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

      if (diffDays < 0) return { text: `Vencido (${formatted})`, color: 'text-white bg-red-700' };
      if (diffDays <= 30) return { text: `${formatted}`, color: 'text-red-600 font-black' };
      if (diffDays <= 90) return { text: `${formatted}`, color: 'text-amber-600 font-bold' };
      
      return { text: formatted, color: 'text-slate-600' };
  };

  const displayedProducts = useMemo(() => {
    let products = [...allProducts];

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        products = products.filter(p =>
            p.nombre.toLowerCase().includes(lowercasedTerm) ||
            (p.laboratorio && p.laboratorio.toLowerCase().includes(lowercasedTerm)) ||
            (p.codigo_barras && p.codigo_barras.includes(lowercasedTerm))
        );
    } 

    if (filterType === 'vencimiento') {
        products.sort((a, b) => {
            if (!a.fecha_vencimiento) return 1;
            if (!b.fecha_vencimiento) return -1;
            return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
        });
    } else if (filterType === 'stock') {
        products.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    } else { // 'nombre'
        products.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    if (!searchTerm) {
        return products.slice(0, 5);
    }

    return products;
  }, [allProducts, searchTerm, filterType]);

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform"></div>
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Productos Registrados</p>
                <p className="text-4xl font-black">{totalRefs}</p>
             </div>
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm">💊</div>
        </div>
        
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-emerald-200 transition-all">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Unidades en Stock</p>
                <p className="text-3xl font-black text-emerald-600">{totalStock.toLocaleString()}</p>
             </div>
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📦</div>
        </div>

         <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-amber-200 transition-all">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Stock Bajo / Crítico</p>
                <p className="text-3xl font-black text-amber-500">{lowStock}</p>
             </div>
             <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">⚠️</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full">
              <input type="text" className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-600" placeholder="Buscar medicamento, lab o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
            </div>
            {canManageProducts && (
              <button onClick={() => handleOpenModal()} className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all">
                + Nuevo Producto
              </button>
            )}
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Filtros:</p>
            <button onClick={() => setFilterType('nombre')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'nombre' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>A-Z</button>
            <button onClick={() => setFilterType('vencimiento')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'vencimiento' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Próximos a Vencer</button>
            <button onClick={() => setFilterType('stock')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'stock' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Por Agotarse</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-6 text-left">Medicamento</th>
                <th className="px-8 py-6 text-left">Información</th>
                <th className="px-8 py-6 text-center">Stock (Cajas + Unid)</th>
                <th className="px-8 py-6 text-center">Vencimiento</th>
                <th className="px-8 py-6 text-center">PVP Caja</th>
                <th className="px-8 py-6 text-center">PVP Unidad</th>
                <th className="px-10 py-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.3em]">Cargando inventario...</td></tr>
              ) : displayedProducts.length > 0 ? (
                displayedProducts.map(p => {
                  const unitsPerBox = p.unidades_por_caja || 1;
                  const boxes = Math.floor((p.stock || 0) / unitsPerBox);
                  const leftovers = (p.stock || 0) % unitsPerBox;
                  const vencimiento = getVencimientoStatus(p.fecha_vencimiento || null);
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-6">
                        <p className="font-black text-slate-900 text-xs uppercase">{p.nombre}</p>
                        <p className="text-[8px] text-slate-300 font-bold mt-1 bg-slate-100 px-2 py-0.5 rounded w-fit">{p.codigo_barras || 'Sin Código'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-wider mb-1">{p.laboratorio || 'GENÉRICO'}</p>
                        {p.descripcion ? (
                          <p className="text-[9px] text-slate-500 font-medium italic line-clamp-2 max-w-[180px] leading-tight mb-1">{p.descripcion}</p>
                        ) : (
                          <span className="text-[8px] text-slate-300 italic block mb-1">Sin notas</span>
                        )}
                        <p className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                          {p.ubicacion || 'General'}
                        </p>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className={`inline-flex flex-col items-center px-4 py-2 rounded-xl border ${(p.stock || 0) < unitsPerBox ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                          <span className="text-sm font-black whitespace-nowrap">
                            {unitsPerBox > 1 ? `${boxes} Caja(s) + ${leftovers} Unid` : `${p.stock || 0} Unid`}
                          </span>
                          <span className="text-[8px] font-black uppercase opacity-60">Total: {p.stock || 0} Unid</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-mono ${vencimiento.color}`}>{vencimiento.text}</span>
                      </td>
                      <td className="px-8 py-6 text-center font-black text-slate-900 text-sm">
                        {(p.precio || 0) > 0 ? `$${(p.precio || 0).toLocaleString()}` : '---'}
                      </td>
                      <td className="px-8 py-6 text-center font-black text-indigo-600 text-sm">
                        ${(p.precio_unidad || 0).toLocaleString()}
                      </td>
                      <td className="px-10 py-6 text-center">
                        {canManageProducts && (
                            <button onClick={() => handleOpenModal(p)} className="p-3 bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.3em]">{!searchTerm ? 'No hay productos registrados' : 'No se encontraron productos para esta búsqueda'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight leading-none">
                  {formData.id ? 'Ficha de Medicamento' : 'Nuevo Medicamento'}
                </h3>
                <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] mt-2">Configuración de Precios y Presentación</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50/20">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modalidad de Venta</label>
                    <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                       <button 
                        type="button" 
                        disabled={!!formData.id}
                        onClick={() => setManagementMode('simple')}
                        className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${managementMode === 'simple' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'} ${formData.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         Solo Individual
                       </button>
                       <button 
                        type="button" 
                        disabled={!!formData.id}
                        onClick={() => setManagementMode('box')}
                        className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${managementMode === 'box' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'} ${formData.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         Caja + Individual
                       </button>
                    </div>
                    {formData.id && (
                      <p className="text-[8px] text-amber-500 font-black uppercase tracking-widest ml-2 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                         La modalidad de venta no puede cambiarse tras el registro inicial.
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Código de Barras *</label>
                    <input type="text" required className="w-full px-7 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-600 outline-none transition-all shadow-sm" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} placeholder="Escanee o asigne un código único" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nombre Comercial *</label>
                    <input type="text" required className="w-full px-7 py-5 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-sm uppercase focus:border-indigo-600 outline-none transition-all shadow-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="EJ: ACETAMINOFEN 500MG" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Descripción / Notas</label>
                    <textarea className="w-full px-7 py-4 bg-white border-2 border-slate-100 rounded-[2rem] font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm min-h-[80px] resize-none" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Ej: Contraindicaciones, dosis recomendada..." />
                  </div>
                  
                  <div className={`p-8 bg-white rounded-[3rem] border border-slate-100 md:col-span-2 grid grid-cols-1 ${managementMode === 'box' ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-8 transition-all shadow-inner`}>
                    {managementMode === 'box' && (
                      <>
                        <div className="animate-in slide-in-from-left-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Unid. x Caja *</label>
                          <input disabled={!canEditPrices && !!formData.id} type="number" min="2" required className="w-full px-6 py-5 bg-slate-50 rounded-2xl font-black text-2xl outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 disabled:bg-slate-200 disabled:text-slate-400" value={formData.unidades_por_caja} onChange={e => setFormData({...formData, unidades_por_caja: Number(e.target.value)})} />
                        </div>
                        <div className="animate-in slide-in-from-bottom-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">PVP Caja ($) *</label>
                          <input disabled={!canEditPrices && !!formData.id} type="number" step="0.01" required className="w-full px-6 py-5 bg-slate-50 rounded-2xl font-black text-2xl outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 disabled:bg-slate-200 disabled:text-slate-400" value={formData.precio} onChange={e => setFormData({...formData, precio: Number(e.target.value)})} placeholder="0.00" />
                        </div>
                      </>
                    )}
                    <div className="animate-in zoom-in-95">
                      <label className="text-[9px] font-black text-indigo-500 uppercase block mb-1 tracking-widest">PVP Unidad ($) *</label>
                      <input disabled={!canEditPrices && !!formData.id} type="number" step="0.01" required className="w-full px-6 py-5 bg-indigo-50/20 rounded-2xl font-black text-2xl text-indigo-600 outline-none focus:border-white border-2 border-indigo-100 focus:border-indigo-300 disabled:bg-slate-200 disabled:text-slate-400" value={formData.precio_unidad} onChange={e => setFormData({...formData, precio_unidad: Number(e.target.value)})} placeholder="0.00" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest ml-1">Laboratorio</label>
                    <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase shadow-sm outline-none focus:border-indigo-600" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} placeholder="MK, GENFAR..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest ml-1">Ubicación</label>
                    <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase shadow-sm outline-none focus:border-indigo-600" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="ESTANTE A-1" />
                  </div>
               </div>

               {saveError && <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-50 py-4 rounded-2xl border border-rose-100 animate-bounce">{saveError}</p>}

               <div className="flex gap-4 pt-6 shrink-0">
                 <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all">Cancelar</button>
                 <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50">
                   {isSaving ? 'Guardando...' : 'Confirmar Registro'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
