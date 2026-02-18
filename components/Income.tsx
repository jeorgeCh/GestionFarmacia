
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
  
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Estado para el modal rápido de proveedor
  const [showQuickProvider, setShowQuickProvider] = useState(false);
  const [quickProvider, setQuickProvider] = useState({ nombre: '', nit: '', telefono: '' });
  const [quickLoading, setQuickLoading] = useState(false);

  const [formData, setFormData] = useState({
    proveedor_id: '',
    cantidad_cajas: 1,      
    unidades_por_caja: 1,   
    costo_caja: 0,          
    lote: '',
    laboratorio: '',
    fecha_vencimiento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    if (searchInputRef.current) searchInputRef.current.focus();
    return () => stopScanner();
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

  const handleQuickProviderSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProvider.nombre) return;
    setQuickLoading(true);
    try {
      const { data, error } = await supabase.from('proveedores').insert([quickProvider]).select().single();
      if (error) throw error;
      if (data) {
        setProviders(prev => [...prev, data]);
        setFormData(prev => ({ ...prev, proveedor_id: data.id.toString() }));
        setShowQuickProvider(false);
        setQuickProvider({ nombre: '', nit: '', telefono: '' });
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setQuickLoading(false);
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128'] });
          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current?.readyState === 4) {
              const codes = await barcodeDetector.detect(videoRef.current);
              if (codes.length > 0) {
                const codeValue = codes[0].rawValue;
                setSearchTerm(codeValue);
                const found = products.find(p => p.codigo_barras === codeValue);
                if (found) handleSelectProduct(found);
                stopScanner();
              }
            }
          }, 500);
        }
      }
    } catch (err) {
      setIsScanning(false);
      alert("Cámara no disponible");
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsScanning(false);
  };

  const totalUnidadesReales = formData.cantidad_cajas * formData.unidades_por_caja;
  const costoTotalCompra = formData.cantidad_cajas * formData.costo_caja;
  const costoUnitarioReal = formData.unidades_por_caja > 0 ? (formData.costo_caja / formData.unidades_por_caja) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const userId = Number(user?.id);
    if (!userId) {
      alert("Sesión inválida.");
      window.location.reload();
      return;
    }

    if (!selectedProduct || !formData.proveedor_id || !formData.lote.trim() || !formData.fecha_vencimiento) {
      setFormError("⚠️ Faltan datos críticos.");
      return;
    }
    
    setLoading(true);
    try {
      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: userId,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: totalUnidadesReales, 
        costo_unitario: costoUnitarioReal, 
        total: costoTotalCompra,
        lote: formData.lote.trim().toUpperCase(),
        fecha_vencimiento: formData.fecha_vencimiento || null
      });

      if (incomeError) throw incomeError;

      const updatePayload: any = {
        unidades_por_caja: formData.unidades_por_caja
      };
      
      if (formData.fecha_vencimiento) updatePayload.fecha_vencimiento = formData.fecha_vencimiento;
      if (formData.laboratorio) updatePayload.laboratorio = formData.laboratorio.trim().toUpperCase();
      
      await supabase.from('productos').update(updatePayload).eq('id', selectedProduct.id);
      await supabase.rpc('deduct_stock', { p_id: selectedProduct.id, p_qty: -totalUnidadesReales });

      setSuccess(true);
      setFormData({ 
        proveedor_id: '', 
        cantidad_cajas: 1, 
        unidades_por_caja: 1, 
        costo_caja: 0, 
        lote: '', 
        laboratorio: '', 
        fecha_vencimiento: '' 
      });
      setSelectedProduct(null);
      setSearchTerm('');
      fetchData(); 
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || "Error al procesar ingreso");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => {
        const search = searchTerm.toLowerCase();
        return (p.nombre.toLowerCase().includes(search) || p.codigo_barras.includes(search));
      })
    : [];

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearchTerm('');
    setFormData({ 
      proveedor_id: '', 
      cantidad_cajas: 1, 
      unidades_por_caja: p.unidades_por_caja || 1, 
      costo_caja: 0, 
      lote: '', 
      fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '', 
      laboratorio: p.laboratorio || '' 
    });
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus(); }, 250);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Entrada de Mercancía</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Carga masiva de inventario</p>
        </div>
        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-100">SISTEMA PRO</div>
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 lg:p-12">
          {formError && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center">{formError}</div>}
          
          {!selectedProduct ? (
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Medicamento a Ingresar</label>
                <div className="relative group">
                  <input ref={searchInputRef} type="text" className="w-full pl-14 pr-20 py-6 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 outline-none font-bold text-lg uppercase focus:bg-white focus:border-indigo-600 shadow-inner" placeholder="BUSCAR POR NOMBRE O CÓDIGO..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
                  <button onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 14.5v-3.5m0 0v-1m0 1h.01"/></svg></button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => handleSelectProduct(p)} className="flex flex-col text-left p-6 rounded-[2.2rem] border-2 border-slate-50 bg-white shadow-sm hover:border-indigo-600 transition-all group active:scale-95">
                    <p className="font-black uppercase text-sm text-slate-800 group-hover:text-indigo-600 truncate">{p.nombre}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between w-full"><span className="text-[9px] font-black text-slate-400 uppercase">En Stock</span><span className="text-[11px] font-black text-slate-900">{p.stock} Uds</span></div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm font-black text-2xl">💊</div>
                   <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stock para:</span><h3 className="text-xl lg:text-2xl font-black uppercase text-slate-900 leading-none">{selectedProduct.nombre}</h3></div>
                 </div>
                 <button type="button" onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[10px] uppercase border border-slate-200">Cambiar</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                      Proveedor * 
                      <button type="button" onClick={() => setShowQuickProvider(true)} className="text-emerald-600 hover:underline">+ Crear Nuevo</button>
                    </label>
                    <div className="flex gap-2">
                      <select required className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                 </div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lote *</label><input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black uppercase text-slate-900 outline-none" placeholder="L-0000" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimiento *</label><input type="date" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cajas Ingresadas *</label><input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.cantidad_cajas} onChange={e => setFormData({...formData, cantidad_cajas: Number(e.target.value)})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidades por Caja *</label><input type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.unidades_por_caja} onChange={e => setFormData({...formData, unidades_por_caja: Number(e.target.value)})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo por Caja ($) *</label><input type="number" required step="0.01" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.costo_caja} onChange={e => setFormData({...formData, costo_caja: Number(e.target.value)})} /></div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 flex flex-col lg:flex-row justify-between items-center gap-8 shadow-xl">
                 <div className="flex flex-col sm:flex-row items-center gap-8 text-white">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Costo Real Unitario</p><p className="text-xl font-black">${costoUnitarioReal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                    <div className="h-10 w-px bg-slate-700 hidden sm:block"></div>
                    <div><p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Total Compra</p><p className="text-3xl font-black text-emerald-400 tracking-tighter">${costoTotalCompra.toLocaleString()}</p></div>
                 </div>
                 <button type="submit" disabled={loading} className="w-full lg:w-auto px-16 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50">{loading ? 'Procesando...' : 'Cargar Inventario'}</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* QUICK PROVIDER MODAL */}
      {showQuickProvider && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
          <form onSubmit={handleQuickProviderSave} className="bg-white rounded-[3rem] w-full max-w-lg p-10 space-y-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Proveedor</h3>
            <div className="space-y-4">
               <div><label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nombre / Laboratorio *</label><input type="text" required className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-black text-sm uppercase outline-none focus:bg-white border border-transparent focus:border-emerald-600" value={quickProvider.nombre} onChange={e => setQuickProvider({...quickProvider, nombre: e.target.value.toUpperCase()})} /></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">NIT</label><input type="text" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:bg-white border border-transparent focus:border-emerald-600" value={quickProvider.nit} onChange={e => setQuickProvider({...quickProvider, nit: e.target.value})} /></div>
                 <div><label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Teléfono</label><input type="text" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:bg-white border border-transparent focus:border-emerald-600" value={quickProvider.telefono} onChange={e => setQuickProvider({...quickProvider, telefono: e.target.value})} /></div>
               </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowQuickProvider(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
              <button type="submit" disabled={quickLoading} className="flex-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-500">{quickLoading ? 'Creando...' : 'Crear Proveedor'}</button>
            </div>
          </form>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-emerald-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center"><div className="w-64 h-64 border-2 border-emerald-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 animate-scan"></div></div></div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-slate-900 px-12 py-5 rounded-full font-black text-xs uppercase">Cerrar</button>
          <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
        </div>
      )}
      {success && <div className="fixed bottom-10 right-10 bg-emerald-600 text-white px-8 py-5 rounded-3xl font-black uppercase shadow-2xl animate-in slide-in-from-bottom-10 z-50">¡Carga exitosa!</div>}
    </div>
  );
};

export default Income;
