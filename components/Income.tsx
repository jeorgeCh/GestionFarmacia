
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
  const [recentIncomes, setRecentIncomes] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

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
      const [pRes, prRes, iRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre', { ascending: true }),
        supabase.from('proveedores').select('*').order('nombre', { ascending: true }),
        supabase.from('ingresos')
          .select('*, productos(nombre, unidades_por_caja, laboratorio), proveedores(nombre)')
          .order('fecha', { ascending: false })
          .limit(10)
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (prRes.data) setProviders(prRes.data);
      if (iRes.data) setRecentIncomes(iRes.data);
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

  const totalUnidadesReales = formData.cantidad_cajas * formData.unidades_por_caja;
  const costoTotalCompra = formData.cantidad_cajas * formData.costo_caja;
  const costoUnitarioReal = formData.unidades_por_caja > 0 ? (formData.costo_caja / formData.unidades_por_caja) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // VALIDACIÓN DE SESIÓN PARA EVITAR ERROR DE LLAVE FORÁNEA
    const userId = Number(user?.id);
    if (!userId) {
      alert("Sesión inválida. Vuelve a iniciar sesión.");
      window.location.reload();
      return;
    }

    if (!selectedProduct || !formData.proveedor_id || !formData.lote.trim() || !formData.fecha_vencimiento) {
      setFormError("⚠️ FALTAN DATOS: Revisa Proveedor, Lote y Vencimiento.");
      return;
    }

    if (formData.cantidad_cajas <= 0 || formData.unidades_por_caja <= 0 || formData.costo_caja <= 0) {
      setFormError("⚠️ VALORES INVÁLIDOS: Cajas, Unidades y Costo deben ser mayores a 0.");
      return;
    }
    
    setLoading(true);
    try {
      const { error: incomeError } = await supabase.from('ingresos').insert({
        usuario_id: userId, // Usar el ID casteado
        producto_id: selectedProduct.id,
        proveedor_id: Number(formData.proveedor_id),
        cantidad: totalUnidadesReales, 
        costo_unitario: costoUnitarioReal, 
        total: costoTotalCompra,
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
      updatePayload.unidades_por_caja = formData.unidades_por_caja;
      
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('productos').update(updatePayload).eq('id', selectedProduct.id);
      }
      
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
      console.error("Error en ingreso:", err);
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
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-10 px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Entrada de Mercancía</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Gestión de Lotes y Costos</p>
        </div>
        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-100 shadow-sm">Sistema de Ingresos</div>
      </div>
      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 lg:p-12">
          {formError && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center animate-bounce">{formError}</div>}
          {!selectedProduct ? (
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Buscar Medicamento</label>
                <div className="relative group">
                  <input ref={searchInputRef} type="text" className="w-full pl-14 pr-20 py-6 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 outline-none font-bold text-lg uppercase focus:bg-white focus:border-indigo-600 shadow-inner text-slate-900 placeholder:text-slate-300" placeholder="Escanea o escribe nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
                  <button onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 14.5v-3.5m0 0v-1m0 1h.01m5-5.3a1.9 1.9 0 00-2.66 0 1.9 1.9 0 00-2.66 0m-4.24 0a1.9 1.9 0 012.66 0 1.9 1.9 0 012.66 0"/></svg></button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => handleSelectProduct(p)} className="flex flex-col text-left p-6 rounded-[2.2rem] border-2 border-slate-50 bg-white shadow-sm hover:border-indigo-600 transition-all group active:scale-95">
                    <p className="font-black uppercase text-sm text-slate-800 group-hover:text-indigo-600 truncate">{p.nombre}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{p.laboratorio || 'S/L'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between w-full"><span className="text-[9px] font-black text-slate-400 uppercase">Stock actual</span><span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{p.stock}</span></div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
                   <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cargando Stock Para:</span><h3 className="text-xl lg:text-2xl font-black uppercase text-slate-900 leading-none">{selectedProduct.nombre}</h3></div>
                 </div>
                 <button type="button" onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[10px] uppercase border border-slate-200">Cambiar Producto</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor *</label>
                    <select required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none" value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})}>
                        <option value="">Seleccionar Proveedor...</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificador de Lote *</label><input type="text" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black uppercase text-slate-900 focus:border-indigo-600 outline-none" placeholder="EJ: L-9088" value={formData.lote} onChange={e => setFormData({...formData, lote: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimiento *</label><input type="date" required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 focus:border-indigo-600 outline-none" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cajas *</label><input ref={quantityInputRef} type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.cantidad_cajas} onChange={e => setFormData({...formData, cantidad_cajas: Number(e.target.value)})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Uds x Caja *</label><input type="number" required min="1" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.unidades_por_caja} onChange={e => setFormData({...formData, unidades_por_caja: Number(e.target.value)})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Caja ($) *</label><input type="number" required step="0.01" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-xl outline-none" value={formData.costo_caja} onChange={e => setFormData({...formData, costo_caja: Number(e.target.value)})} /></div>
              </div>
              <div className="bg-slate-900 rounded-[2.5rem] p-8 flex flex-col lg:flex-row justify-between items-center gap-8 shadow-xl">
                 <div className="flex flex-col sm:flex-row items-center gap-8 text-white text-center sm:text-left">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Costo Unidad</p><p className="text-xl font-black">${costoUnitarioReal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                    <div className="h-10 w-px bg-slate-700 hidden sm:block"></div>
                    <div><p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Total Factura</p><p className="text-3xl font-black text-emerald-400 tracking-tighter">${costoTotalCompra.toLocaleString()}</p></div>
                 </div>
                 <button type="submit" disabled={loading} className="w-full lg:w-auto px-16 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50">{loading ? 'Guardando...' : 'Confirmar Ingreso'}</button>
              </div>
            </form>
          )}
          {success && <div className="fixed bottom-10 right-10 bg-emerald-600 text-white px-8 py-5 rounded-3xl font-black uppercase shadow-2xl animate-in slide-in-from-bottom-10 z-50">¡Stock actualizado correctamente!</div>}
        </div>
      </div>
    </div>
  );
};

export default Income;
