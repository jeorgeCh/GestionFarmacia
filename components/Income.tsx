
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
    cantidad: 1,
    costo_unitario: 0, 
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

  const totalFactura = formData.cantidad * formData.costo_unitario;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !formData.proveedor_id) return;
    
    setLoading(true);
    try {
      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: user.id,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: formData.cantidad,
        costo_unitario: formData.costo_unitario, 
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
      
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('productos').update(updatePayload).eq('id', selectedProduct.id);
      }
      
      await supabase.rpc('deduct_stock', { p_id: selectedProduct.id, p_qty: -formData.cantidad });

      setSuccess(true);
      setFormData({ proveedor_id: '', cantidad: 1, costo_unitario: 0, lote: '', laboratorio: '', fecha_vencimiento: '' });
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

  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => {
        const search = searchTerm.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(search) || 
          p.codigo_barras.includes(search) ||
          (p.laboratorio && p.laboratorio.toLowerCase().includes(search))
        );
      })
    : [];

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearchTerm('');
    
    setFormData({ 
      proveedor_id: '',
      cantidad: 1,
      costo_unitario: 0,
      lote: '',
      fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '',
      laboratorio: p.laboratorio || '',
    });
    
    setTimeout(() => {
      if (quantityInputRef.current) quantityInputRef.current.focus();
    }, 250);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-10 px-4 md:px-0">
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-slate-900 p-8 lg:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-white">
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">Entrada de Mercancía</h2>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-2">Localización inteligente de inventario</p>
          </div>
        </div>
        
        <div className="p-8 lg:p-12">
          {!selectedProduct ? (
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Producto a Ingresar</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-14 py-6 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 outline-none font-bold text-lg uppercase focus:border-indigo-600 focus:bg-white transition-all shadow-inner"
                  placeholder="Escribe nombre o escanea..."
                  value={searchTerm}
                  onKeyDown={handleKeyDown}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="flex flex-col text-left p-6 rounded-[2.2rem] border-2 border-slate-50 bg-white hover:border-indigo-600 transition-all hover:shadow-xl"
                  >
                    <p className="font-black uppercase text-sm text-slate-900 truncate">{p.nombre}</p>
                    <p className="text-[9px] font-black text-indigo-600 uppercase mt-1 tracking-widest">{p.laboratorio || 'S/L'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
                       <span className="text-[9px] font-black text-slate-400">Stock: {p.stock}</span>
                       <span className="text-[9px] font-black text-slate-400">📍 {p.ubicacion || '---'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                 <div>
                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Cargando unidades para</span>
                   <h3 className="text-2xl font-black uppercase">{selectedProduct.nombre}</h3>
                 </div>
                 <button type="button" onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-white/10 rounded-2xl font-black text-[10px] uppercase hover:bg-rose-500 transition-all">Cambiar</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Proveedor</label>
                    <select required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-bold" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                      <option value="">Elegir...</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Cantidad</label>
                    <input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-xl" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Costo Unit.</label>
                    <input type="number" required step="0.01" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-xl" value={formData.costo_unitario} onChange={e => setFormData({...formData, costo_unitario: Number(e.target.value)})} />
                 </div>
              </div>

              <div className="flex justify-between items-center pt-8 border-t">
                 <div className="text-xl font-black uppercase text-slate-900">Total: ${totalFactura.toLocaleString()}</div>
                 <button type="submit" disabled={loading} className="px-12 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all">
                   Confirmar Ingreso
                 </button>
              </div>
            </form>
          )}

          {success && <div className="mt-8 bg-emerald-500 text-white p-6 rounded-3xl text-center font-black uppercase">¡Registro exitoso!</div>}
        </div>
      </div>
    </div>
  );
};

export default Income;
