
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Proveedor, Usuario } from '../types';
import IncomeHistory from './IncomeHistory';

interface IncomeProps {
  user: Usuario;
}

const Income: React.FC<IncomeProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  const userRole = Number(user.role_id);
  const isAdmin = userRole === 1;
  const isSuperUser = userRole === 3;

  const canEdit = isAdmin || isSuperUser;

  const [formData, setFormData] = useState({
    proveedor_id: '',
    codigo_barras: '',
    cantidad_cajas: 1, 
    unidades_por_caja: 1,
    costo_por_caja: 0,
    lote: '',
    fecha_vencimiento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, prRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('proveedores').select('*').order('nombre')
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (prRes.data) setProviders(prRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        codigo_barras: selectedProduct.codigo_barras || '',
        unidades_por_caja: selectedProduct.unidades_por_caja || 1,
      }));
    }
  }, [selectedProduct]);

  const totalUnidadesEntrantes = formData.cantidad_cajas * formData.unidades_por_caja;
  const costoTotalFactura = formData.cantidad_cajas * formData.costo_por_caja;
  const costoUnitarioCompra = formData.unidades_por_caja > 0 
    ? (formData.costo_por_caja / formData.unidades_por_caja) 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || loading) return;

    setLoading(true);
    try {
      await supabase.from('ingresos').insert({
        usuario_id: user.id,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: totalUnidadesEntrantes,
        costo_unitario: costoUnitarioCompra,
        total: costoTotalFactura,
        lote: formData.lote.toUpperCase(),
        fecha_vencimiento: formData.fecha_vencimiento || null
      });

      await supabase.from('productos').update({
        codigo_barras: formData.codigo_barras.trim(),
        fecha_vencimiento: formData.fecha_vencimiento || selectedProduct.fecha_vencimiento,
      }).eq('id', selectedProduct.id);

      await supabase.rpc('deduct_stock', { 
        p_id: selectedProduct.id, 
        p_qty: -totalUnidadesEntrantes 
      });

      await supabase.from('audit_logs').insert({
          usuario_id: user.id,
          accion: 'INGRESO_MERCANCIA',
          modulo: 'INVENTARIO',
          detalles: `Carga de ${totalUnidadesEntrantes} unids de ${selectedProduct.nombre}. Lote: ${formData.lote}`
      });

      setSuccess(true);
      setSelectedProduct(null);
      setSearchTerm('');
      setFormData({ 
        proveedor_id: '', 
        codigo_barras: '',
        cantidad_cajas: 1, 
        unidades_por_caja: 1, 
        costo_por_caja: 0, 
        lote: '', 
        fecha_vencimiento: '' 
      });
      fetchData();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert("Error al procesar la carga: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(searchTerm))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-slide-up pb-20">
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ingreso de Mercancía</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Gestión por bultos y asignación de códigos</p>
        </div>
        {selectedProduct && (
          <button onClick={() => setSelectedProduct(null)} className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all">
            Escoger otro producto
          </button>
        )}
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
        <div className="p-8 lg:p-12">
          {!selectedProduct ? (
             <div className="space-y-6">
                <div className="relative">
                  <input type="text" className="w-full px-8 py-6 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-black text-lg uppercase focus:bg-white focus:border-indigo-600 transition-all shadow-sm" placeholder="Buscar medicamento para cargar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => setSelectedProduct(p)} className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] hover:border-indigo-500 transition-all text-left flex justify-between items-center group shadow-sm hover:shadow-md">
                       <div>
                         <p className="font-black text-slate-800 uppercase text-xs group-hover:text-indigo-600 transition-colors">{p.nombre}</p>
                         <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Stock Actual: {p.stock} Unid ({Math.floor(p.stock / (p.unidades_por_caja || 1))} Cajas)</p>
                       </div>
                       <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all font-black">→</div>
                    </button>
                  ))}
                </div>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl border border-slate-800">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/5">📦</div>
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase block mb-1 tracking-widest">Panel de Carga</span>
                      <h4 className="text-2xl font-black text-white uppercase tracking-tight">{selectedProduct.nombre}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Laboratorio: {selectedProduct.laboratorio || 'N/A'}</p>
                    </div>
                 </div>
                 <div className="hidden md:block">
                    <div className="px-5 py-2 rounded-xl bg-white/5 border border-white/10">
                       <p className="text-[8px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-0.5">Gestión por Caja</p>
                       <p className="text-[10px] font-bold text-white uppercase">Actualización de Stock</p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Código de Barras (EAN/UPC) *</label>
                   <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-indigo-100 rounded-2xl font-black text-sm outline-none focus:border-indigo-600 shadow-sm" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} placeholder="Escanee o escriba el código..." />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Proveedor *</label>
                   <select required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-indigo-600" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                      <option value="">Seleccionar Proveedor...</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Lote *</label>
                   <input type="text" required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black uppercase outline-none focus:bg-white focus:border-indigo-600" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} placeholder="EJ: L-2024" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Vencimiento *</label>
                   <input type="date" required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-indigo-600" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                 </div>
                 
                 <div className="p-8 bg-indigo-50/40 rounded-[3rem] border border-indigo-100 space-y-6 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Cantidad de Cajas *</label>
                      <input type="number" required min="1" className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-2xl font-black text-2xl outline-none focus:border-indigo-600 shadow-sm" value={formData.cantidad_cajas} onChange={e => setFormData({...formData, cantidad_cajas: Number(e.target.value)})} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Unid. por Caja *</label>
                      <input type="number" required min="1" className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-2xl font-black text-2xl outline-none focus:border-indigo-600 shadow-sm" value={formData.unidades_por_caja} onChange={e => setFormData({...formData, unidades_por_caja: Number(e.target.value)})} />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block ml-1">Costo por Caja ($) *</label>
                      <input type="number" required step="0.01" className="w-full px-6 py-5 bg-white border-2 border-emerald-100 rounded-2xl font-black text-2xl text-emerald-600 outline-none focus:border-emerald-500 shadow-sm" value={formData.costo_por_caja} onChange={e => setFormData({...formData, costo_por_caja: Number(e.target.value)})} placeholder="0.00" />
                    </div>
                 </div>
              </div>

              <div className="p-10 bg-slate-950 rounded-[3rem] flex flex-col lg:flex-row justify-between items-center gap-10 border border-slate-800 shadow-2xl">
                 <div className="flex flex-col sm:flex-row gap-12 text-white">
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Unidades</p>
                      <p className="text-4xl font-black text-white tracking-tighter">
                        {totalUnidadesEntrantes.toLocaleString()} <span className="text-sm text-slate-500 font-bold uppercase">Uds</span>
                      </p>
                    </div>
                    <div className="hidden sm:block w-px h-12 bg-slate-800"></div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Costo Unitario</p>
                      <p className="text-3xl font-black text-emerald-400 tracking-tighter">
                        ${costoUnitarioCompra.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                 </div>
                 <button type="submit" disabled={loading} className="w-full lg:w-auto px-14 py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/40 active:scale-95 disabled:opacity-50">
                    {loading ? 'Procesando...' : 'Confirmar Ingreso'}
                 </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {canEdit && <IncomeHistory canEdit={canEdit} />}

      {success && (
        <div className="fixed bottom-10 right-10 z-[100] bg-emerald-600 text-white px-10 py-6 rounded-[2.5rem] font-black uppercase shadow-2xl animate-in slide-in-from-right-10 flex items-center gap-4">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-black">✓</div>
          ¡Stock actualizado correctamente!
        </div>
      )}
    </div>
  );
};

export default Income;
