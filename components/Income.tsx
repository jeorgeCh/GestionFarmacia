
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
  
  // Cámara
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

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

  const totalFactura = formData.cantidad * formData.costo_unitario;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // VALIDACIÓN ESTRICTA
    if (!selectedProduct || !formData.proveedor_id || !formData.lote.trim() || !formData.fecha_vencimiento || formData.costo_unitario <= 0) {
      setFormError("⚠️ COMPLETA TODOS LOS CAMPOS: Proveedor, Cantidad, Costo, Lote y Vencimiento son obligatorios.");
      return;
    }
    
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
      setFormError(err.message || "Error al procesar ingreso");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => {
        const search = searchTerm.toLowerCase();
        return (p.nombre.toLowerCase().includes(search) || p.codigo_barras.includes(search) || (p.laboratorio && p.laboratorio.toLowerCase().includes(search)));
      })
    : [];

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearchTerm('');
    setFormData({ proveedor_id: '', cantidad: 1, costo_unitario: 0, lote: '', fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '', laboratorio: p.laboratorio || '' });
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus(); }, 250);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-10 px-4 md:px-0">
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-slate-900 p-8 lg:p-12">
          <div className="text-white">
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">Entrada de Mercancía</h2>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-2">Gestión de Proveedores y Lotes</p>
          </div>
        </div>
        
        <div className="p-8 lg:p-12">
          {formError && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center">{formError}</div>}
          
          {!selectedProduct ? (
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Medicamento a Cargar</label>
                <div className="relative group">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full pl-14 pr-20 py-6 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 outline-none font-bold text-lg uppercase focus:border-indigo-600 focus:bg-white transition-all shadow-inner"
                    placeholder="Escribe nombre o escanea..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <button onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-950 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => handleSelectProduct(p)} className="flex flex-col text-left p-6 rounded-[2.2rem] border-2 border-slate-50 bg-white hover:border-indigo-600 transition-all hover:shadow-xl group">
                    <p className="font-black uppercase text-sm text-slate-900 group-hover:text-indigo-600 truncate">{p.nombre}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{p.laboratorio || 'S/L'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
                       <span className="text-[9px] font-black text-slate-300">Stock actual: {p.stock}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                 <div>
                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Registrando ingreso para</span>
                   <h3 className="text-2xl font-black uppercase tracking-tight">{selectedProduct.nombre}</h3>
                 </div>
                 <button type="button" onClick={() => setSelectedProduct(null)} className="px-8 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase hover:bg-rose-500 transition-all">Cambiar Producto</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor *</label>
                    <select required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-bold bg-white focus:border-indigo-600 outline-none" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                      <option value="">Elegir Proveedor...</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificador de Lote *</label>
                    <input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black uppercase focus:border-indigo-600 outline-none" placeholder="EJ: L-9088" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Vencimiento *</label>
                    <input type="date" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-bold focus:border-indigo-600 outline-none" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad Recibida *</label>
                    <input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-xl focus:border-indigo-600 outline-none" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Unitario ($) *</label>
                    <input type="number" required step="0.01" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-xl focus:border-indigo-600 outline-none" value={formData.costo_unitario} onChange={e => setFormData({...formData, costo_unitario: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lab / Fabricante (Opcional)</label>
                    <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black uppercase focus:border-indigo-600 outline-none" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} />
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t gap-6">
                 <div className="text-2xl font-black uppercase text-slate-900 tracking-tight">Costo Total: ${totalFactura.toLocaleString()}</div>
                 <button type="submit" disabled={loading} className="w-full sm:w-auto px-16 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-20">
                   {loading ? 'Sincronizando...' : 'Confirmar Registro'}
                 </button>
              </div>
            </form>
          )}

          {isScanning && (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
              <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-indigo-500/30">
                 <video ref={videoRef} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-indigo-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-indigo-500 animate-scan"></div>
                    </div>
                 </div>
              </div>
              <button onClick={stopScanner} className="mt-10 bg-rose-600 text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest">Detener Cámara</button>
              <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
            </div>
          )}

          {success && <div className="mt-8 bg-emerald-500 text-white p-6 rounded-3xl text-center font-black uppercase animate-in zoom-in">¡Mercancía ingresada correctamente al Stock!</div>}
        </div>
      </div>
    </div>
  );
};

export default Income;
