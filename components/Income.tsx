
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
    cantidad: 1, // Cantidad que trae el lote (Unidades totales)
    costo_total: 0, // Cuánto cuesta comprarlo (Total factura)
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

  // Cálculo del Costo Unitario basado en el Total de Compra / Cantidad
  const costoUnitarioCalculado = formData.cantidad > 0 ? formData.costo_total / formData.cantidad : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // VALIDACIÓN ESTRICTA
    if (!selectedProduct || !formData.proveedor_id || !formData.lote.trim() || !formData.fecha_vencimiento || formData.costo_total <= 0) {
      setFormError("⚠️ COMPLETA TODOS LOS CAMPOS: Proveedor, Cantidad, Costo Total, Lote y Vencimiento son obligatorios.");
      return;
    }
    
    setLoading(true);
    try {
      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: user.id,
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: formData.cantidad,
        costo_unitario: costoUnitarioCalculado, 
        total: formData.costo_total,
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
      
      // Stock aumenta
      await supabase.rpc('deduct_stock', { p_id: selectedProduct.id, p_qty: -formData.cantidad });

      setSuccess(true);
      setFormData({ proveedor_id: '', cantidad: 1, costo_total: 0, lote: '', laboratorio: '', fecha_vencimiento: '' });
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
    setFormData({ proveedor_id: '', cantidad: 1, costo_total: 0, lote: '', fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '', laboratorio: p.laboratorio || '' });
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus(); }, 250);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-10 px-4 md:px-0">
      
      {/* Header Limpio */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Entrada de Mercancía</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Gestión de Lotes y Costos</p>
        </div>
        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm">
          Sistema de Ingresos
        </div>
      </div>
        
      <div className="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-8 lg:p-12">
          {formError && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center animate-bounce">{formError}</div>}
          
          {!selectedProduct ? (
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Buscar Medicamento</label>
                <div className="relative group">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full pl-14 pr-20 py-6 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 outline-none font-bold text-lg uppercase focus:bg-white focus:border-indigo-600 transition-all shadow-inner text-slate-900 placeholder:text-slate-300"
                    placeholder="Escanea o escribe nombre..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  <button onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-500/30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 14.5v-3.5m0 0v-1m0 1h.01m5-5.3a1.9 1.9 0 00-2.66 0 1.9 1.9 0 00-2.66 0m-4.24 0a1.9 1.9 0 012.66 0 1.9 1.9 0 012.66 0"/></svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => handleSelectProduct(p)} className="flex flex-col text-left p-6 rounded-[2.2rem] border-2 border-slate-50 bg-white shadow-sm hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group active:scale-95">
                    <p className="font-black uppercase text-sm text-slate-800 group-hover:text-indigo-600 truncate">{p.nombre}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{p.laboratorio || 'S/L'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between w-full">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Stock actual</span>
                       <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{p.stock}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              
              {/* Product Info Card */}
              <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                   </div>
                   <div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cargando Stock Para:</span>
                     <h3 className="text-xl lg:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">{selectedProduct.nombre}</h3>
                   </div>
                 </div>
                 <button type="button" onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[10px] uppercase hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-200 hover:border-rose-200">Cambiar Producto</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor *</label>
                    <div className="relative">
                      <select required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none transition-all" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                        <option value="">Seleccionar Proveedor...</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificador de Lote *</label>
                    <input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black uppercase text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none placeholder:text-slate-300 transition-all" placeholder="EJ: L-9088" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Vencimiento *</label>
                    <input type="date" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad del Lote (Unidades) *</label>
                    <input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="0" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})} />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Total Compra ($) *</label>
                    <input type="number" required step="0.01" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="0.00" value={formData.costo_total} onChange={e => setFormData({...formData, costo_total: Number(e.target.value)})} />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lab / Fabricante (Opcional)</label>
                    <input type="text" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black uppercase text-slate-700 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none placeholder:text-slate-300 transition-all" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} />
                 </div>
              </div>

              {/* Resumen de Costos y Acciones */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 flex flex-col lg:flex-row justify-between items-center gap-8 shadow-xl shadow-slate-900/20">
                 <div className="flex items-center gap-8 w-full lg:w-auto text-white">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Unitario Calc.</p>
                       <p className="text-2xl font-black tracking-tight text-white">${costoUnitarioCalculado.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-700"></div>
                    <div>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                       <p className="text-3xl font-black text-emerald-400 tracking-tighter">${formData.costo_total.toLocaleString()}</p>
                    </div>
                 </div>

                 <button type="submit" disabled={loading} className="w-full lg:w-auto px-16 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                   {loading ? (
                     <>
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>Guardando...</span>
                     </>
                   ) : (
                     'Confirmar Ingreso'
                   )}
                 </button>
              </div>
            </form>
          )}

          {isScanning && (
            <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
              <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-emerald-500/30">
                 <video ref={videoRef} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-emerald-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 animate-scan shadow-[0_0_20px_#10b981]"></div>
                    </div>
                 </div>
              </div>
              <button onClick={stopScanner} className="mt-10 bg-white text-slate-900 px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Detener Escaneo</button>
              <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
            </div>
          )}

          {success && (
            <div className="fixed bottom-10 right-10 bg-emerald-600 text-white px-8 py-5 rounded-3xl font-black uppercase shadow-2xl animate-in slide-in-from-bottom-10 z-50 flex items-center gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✓</div>
              ¡Stock actualizado correctamente!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Income;
