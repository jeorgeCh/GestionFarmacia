
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
    fecha_vencimiento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  const fetchData = async () => {
    const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    const { data: pr } = await supabase.from('proveedores').select('*').order('nombre', { ascending: true });
    if (p) setProducts(p);
    if (pr) setProviders(pr);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      const exactMatch = products.find(p => p.codigo_barras === searchTerm.trim());
      if (exactMatch) {
        handleSelectProduct(exactMatch);
        e.preventDefault();
      } else if (filteredProducts.length === 1) {
        handleSelectProduct(filteredProducts[0]);
        e.preventDefault();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !formData.proveedor_id) return;
    
    setLoading(true);
    try {
      // 1. Registrar el ingreso con fecha de vencimiento
      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: user.id,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: formData.cantidad,
        costo_unitario: formData.costo_unitario,
        total: formData.cantidad * formData.costo_unitario,
        fecha_vencimiento: formData.fecha_vencimiento || null
      });

      if (incomeError) throw incomeError;

      // 2. Actualizar la fecha de vencimiento en el maestro de productos
      if (formData.fecha_vencimiento) {
        await supabase.from('productos')
          .update({ fecha_vencimiento: formData.fecha_vencimiento })
          .eq('id', selectedProduct.id);
      }
      
      setSuccess(true);
      setFormData({ proveedor_id: '', cantidad: 1, costo_unitario: 0, fecha_vencimiento: '' });
      setSelectedProduct(null);
      setSearchTerm('');
      fetchData(); 
      setTimeout(() => {
        setSuccess(false);
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 3000);
    } catch (err) {
      alert("Error al registrar el ingreso");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.codigo_barras.includes(searchTerm)
      ).slice(0, 5)
    : [];

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearchTerm('');
    setFormData(prev => ({ 
      ...prev, 
      fecha_vencimiento: p.fecha_vencimiento || '',
      costo_unitario: 0 
    }));
    setTimeout(() => {
      if (quantityInputRef.current) quantityInputRef.current.focus();
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-[3rem] shadow-[0_20px_80px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
        <div className="bg-slate-50/50 p-10 border-b border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Entrada de Mercancía</h2>
          <p className="text-slate-400 text-sm font-medium mt-1">Registra nuevos lotes y actualiza fechas de vencimiento.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="space-y-6">
            <div className="relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Buscar o Escanear Producto</label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-12 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-[6px] focus:ring-emerald-500/5 focus:border-emerald-600 outline-none font-bold text-slate-700 transition-all"
                  placeholder="Código de barras..."
                  value={searchTerm}
                  onKeyDown={handleKeyDown}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="absolute inset-y-0 left-5 flex items-center">
                  <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </span>
              </div>

              {filteredProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center justify-between p-5 hover:bg-emerald-600 hover:text-white transition-all border-b border-slate-50 last:border-0 group"
                    >
                      <div className="text-left">
                        <p className="font-black text-slate-900 group-hover:text-white text-sm uppercase">{p.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-bold group-hover:text-white/70">EAN: {p.codigo_barras}</p>
                      </div>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl group-hover:bg-emerald-500 group-hover:text-white">STOCK: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="bg-indigo-50/50 rounded-3xl p-8 border border-indigo-100 flex items-center justify-between animate-in zoom-in-95">
                <div className="space-y-1">
                  <h4 className="font-black text-indigo-900 uppercase tracking-tight">{selectedProduct.nombre}</h4>
                  <div className="flex gap-4">
                    <p className="text-[9px] font-black text-indigo-400 uppercase">Ubicación: {selectedProduct.ubicacion || 'N/A'}</p>
                    <p className="text-[9px] font-black text-rose-500 uppercase">Vence: {selectedProduct.fecha_vencimiento || 'No registra'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 text-indigo-300 hover:text-rose-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6"/></svg>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor</label>
                <select
                  required
                  className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                  value={formData.proveedor_id}
                  onChange={e => setFormData({...formData, proveedor_id: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad</label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  required
                  min="1"
                  className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700"
                  value={formData.cantidad}
                  onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Unit. ($)</label>
                <input
                  type="number"
                  required
                  step="100"
                  className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700"
                  value={formData.costo_unitario || ''}
                  onChange={e => setFormData({...formData, costo_unitario: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Vence Lote</label>
                <div className="date-input-container">
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 cursor-pointer"
                    value={formData.fecha_vencimiento}
                    onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})}
                    onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                    onFocus={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                  />
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedProduct}
            className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.25em] transition-all shadow-xl shadow-emerald-900/10 active:scale-95 flex items-center justify-center gap-3"
          >
            {loading ? 'Procesando...' : 'Cargar Entrada a Inventario'}
          </button>
          
          {success && (
            <div className="bg-emerald-500 text-white p-5 rounded-2xl text-center text-xs font-black uppercase tracking-[0.3em] animate-in zoom-in">
              ¡Inventario Sincronizado Exitosamente!
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Income;
