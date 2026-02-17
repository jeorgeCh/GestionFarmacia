
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario } from '../types';

interface InventoryProps { user: Usuario; }

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para el Escáner
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'form'>('search');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    tipo: 'producto' as 'producto' | 'pastillas',
    nombre: '',
    codigo_barras: '',
    laboratorio: '',
    precio: '', 
    precio_unidad: '',
    blisters_por_caja: '1',
    unids_por_blister: '1',
    descripcion: '',
    ubicacion: '',
    fecha_vencimiento: ''
  });

  const isAdmin = user.role_id === 1;

  useEffect(() => { 
    fetchProducts(); 
    return () => stopScanner();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      if (data) setProducts(data);
    } catch (err: any) {
      console.error("Error al cargar productos:", err);
      setSaveError("Error al cargar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async (target: 'search' | 'form') => {
    setScanTarget(target);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a']
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  handleBarcodeDetected(code, target);
                }
              } catch (e) {
                console.error("Barcode detection error:", e);
              }
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error("Error cámara:", err);
      alert("No se pudo abrir la cámara");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const handleBarcodeDetected = (code: string, target: 'search' | 'form') => {
    if (target === 'search') {
      setSearchTerm(code);
    } else {
      setFormData(prev => ({ ...prev, codigo_barras: code }));
    }
    stopScanner();
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const handleOpenModal = (p?: Producto) => {
    setSaveError(null);
    if (p) {
      const fechaLimpia = p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '';
      setFormData({
        id: p.id,
        tipo: p.tipo || 'producto',
        nombre: p.nombre,
        codigo_barras: p.codigo_barras,
        laboratorio: p.laboratorio || '',
        precio: String(p.precio || 0),
        precio_unidad: String(p.precio_unidad || 0),
        blisters_por_caja: String(p.blisters_por_caja || 1),
        unids_por_blister: String(Math.floor((p.unidades_por_caja || 1) / (p.blisters_por_caja || 1)) || 1),
        descripcion: p.descripcion || '',
        ubicacion: p.ubicacion || '',
        fecha_vencimiento: fechaLimpia
      });
    } else {
      setFormData({
        id: undefined,
        tipo: 'producto',
        nombre: '',
        codigo_barras: '',
        laboratorio: '',
        precio: '',
        precio_unidad: '',
        blisters_por_caja: '1',
        unids_por_blister: '1',
        descripcion: '',
        ubicacion: '',
        fecha_vencimiento: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    const isPills = formData.tipo === 'pastillas';
    const productData: any = {
      tipo: formData.tipo,
      nombre: formData.nombre.trim(),
      codigo_barras: formData.codigo_barras.trim(),
      laboratorio: formData.laboratorio.trim().toUpperCase(),
      descripcion: formData.descripcion?.trim() || null,
      ubicacion: formData.ubicacion?.trim().toUpperCase() || null,
      fecha_vencimiento: formData.fecha_vencimiento || null,
      precio: parseFloat(formData.precio) || 0,
      precio_unidad: isPills ? (parseFloat(formData.precio_unidad) || 0) : 0,
      blisters_por_caja: parseInt(formData.blisters_por_caja) || 1,
      unidades_por_caja: (parseInt(formData.blisters_por_caja) || 1) * (parseInt(formData.unids_por_blister) || 1)
    };

    try {
      const { error } = formData.id 
        ? await supabase.from('productos').update(productData).eq('id', formData.id)
        : await supabase.from('productos').insert([{ ...productData, stock: 0 }]);

      if (error) throw error;
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setSaveError(err.message || "Error al guardar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStockColor = (stock: number) => {
    if (stock <= 5) return 'text-rose-700 bg-rose-50 border-rose-200';
    if (stock <= 15) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.laboratorio && p.laboratorio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 group flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-[2.5rem] outline-none font-bold text-sm shadow-sm focus:border-indigo-500 transition-all"
              placeholder="Buscar por nombre o escanea código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute inset-y-0 left-6 flex items-center text-slate-300">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
          </div>
          <button 
            onClick={() => startScanner('search')}
            className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="bg-emerald-600 text-white px-8 py-5 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-emerald-700 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Nuevo Registro
          </button>
        )}
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Medicamento / Lab</th>
                <th className="px-8 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Forma</th>
                <th className="px-8 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Pasillo</th>
                <th className="px-8 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Expira</th>
                <th className="px-8 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                <th className="px-8 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">P. Venta</th>
                <th className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-8 py-32 text-center text-slate-300 font-black uppercase text-xs tracking-[0.5em] animate-pulse">Sincronizando Inventario...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-bold uppercase text-xs">No se encontraron productos</td></tr>
              ) : filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-indigo-50/30 transition-all group">
                  <td className="px-10 py-7">
                    <div className="font-black text-slate-900 uppercase text-[13px] leading-tight mb-1">{product.nombre}</div>
                    <div className="flex gap-2">
                       <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{product.laboratorio || 'GENÉRICO'}</span>
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">#{product.codigo_barras}</span>
                    </div>
                  </td>
                  <td className="px-8 py-7 text-center">
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${product.tipo === 'pastillas' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {product.tipo === 'pastillas' ? 'Caja/Blister' : 'Unidad'}
                    </span>
                  </td>
                  <td className="px-8 py-7 text-center">
                    {product.ubicacion ? (
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-black text-[9px] uppercase tracking-tighter">
                        📍 {product.ubicacion}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-300 font-bold uppercase">N/A</span>
                    )}
                  </td>
                  <td className="px-8 py-7 text-center">
                    <div className={`text-[10px] font-black uppercase ${!product.fecha_vencimiento ? 'text-slate-300' : (new Date(product.fecha_vencimiento) < new Date() ? 'text-rose-600 animate-pulse' : 'text-slate-600')}`}>
                      {product.fecha_vencimiento ? product.fecha_vencimiento.split('T')[0] : '---'}
                    </div>
                  </td>
                  <td className="px-8 py-7 text-center">
                    <span className={`px-4 py-1.5 rounded-2xl text-[11px] font-black inline-block min-w-[65px] border ${getStockColor(product.stock)} shadow-sm`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-8 py-7 text-right font-black text-slate-900 text-[15px] tracking-tighter">
                    ${Number(product.precio).toLocaleString()}
                  </td>
                  <td className="px-10 py-7">
                    <button onClick={() => handleOpenModal(product)} className="w-11 h-11 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR/NUEVO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">{formData.id ? 'Ficha de Medicamento' : 'Nuevo Ingreso'}</h3>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Registro oficial de inventario</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-14 h-14 rounded-3xl bg-white/10 flex items-center justify-center hover:bg-rose-500 transition-all">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-12 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-2">Nombre Comercial del Medicamento</label>
                  <input type="text" required className="w-full px-8 py-5 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-lg transition-all uppercase focus:border-indigo-600 bg-white" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="EJ: AMODIL 500MG" />
                </div>
                
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-2">Laboratorio Fabricante</label>
                  <input type="text" className="w-full px-8 py-5 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-sm transition-all uppercase focus:border-indigo-600 bg-white" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} placeholder="PFIZER, GENFAR, ETC..." />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-2">Código EAN (Barras)</label>
                  <div className="flex gap-3">
                    <input type="text" required className="w-full px-8 py-5 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-sm transition-all focus:border-indigo-600 bg-white" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} placeholder="770..." />
                    <button type="button" onClick={() => startScanner('form')} className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-lg active:scale-90 transition-all shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 space-y-6">
                   <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-3 mb-4">Configuración de Venta</h4>
                   <div className="flex gap-4 mb-4">
                      <button type="button" onClick={() => setFormData({...formData, tipo: 'producto'})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'producto' ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>Unidad</button>
                      <button type="button" onClick={() => setFormData({...formData, tipo: 'pastillas'})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'pastillas' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>Píldoras</button>
                   </div>
                   <div className="space-y-4">
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">$</span>
                        <input type="number" required className="w-full pl-12 pr-6 py-5 bg-slate-50 rounded-2xl font-black text-xl text-slate-900 outline-none border-2 border-transparent focus:border-emerald-500" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} placeholder="P. Caja" />
                      </div>
                      {formData.tipo === 'pastillas' && (
                        <div className="relative animate-in zoom-in-95">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-lg">$</span>
                          <input type="number" className="w-full pl-12 pr-6 py-5 bg-indigo-50 rounded-2xl font-black text-xl text-indigo-900 outline-none border-2 border-transparent focus:border-indigo-500" value={formData.precio_unidad} onChange={e => setFormData({...formData, precio_unidad: e.target.value})} placeholder="P. Unidad" />
                        </div>
                      )}
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 space-y-6">
                   <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-50 pb-3 mb-4">Logística y Ubicación</h4>
                   <div className="space-y-4">
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-400">📍</span>
                        <input type="text" className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-2xl font-black text-sm uppercase outline-none border-2 border-transparent focus:border-amber-500" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="UBICACIÓN FÍSICA" />
                      </div>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
                        <input type="date" className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:border-indigo-500" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex gap-6 pt-10">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-7 border-2 border-slate-100 rounded-[2.5rem] text-slate-400 font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-100 transition-all">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-2 py-7 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-20">
                  {isSaving ? 'Guardando Datos...' : 'Confirmar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-indigo-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-indigo-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-indigo-500 shadow-[0_0_25px_rgba(99,102,241,1)] animate-scan-line"></div>
                </div>
             </div>
             <div className="absolute bottom-10 left-0 right-0 text-center">
                <p className="text-white font-black uppercase text-[10px] tracking-widest bg-black/60 px-8 py-3 rounded-full inline-block backdrop-blur-md">Detectando Código de Barras...</p>
             </div>
          </div>
          <button 
            onClick={stopScanner}
            className="mt-14 bg-white/10 hover:bg-rose-600 text-white px-14 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] backdrop-blur-xl transition-all border border-white/10"
          >
            Detener Escáner
          </button>
          <style>{`
            @keyframes scan-line { 0% { top: 0; } 100% { top: 100%; } }
            .animate-scan-line { animation: scan-line 2.5s infinite ease-in-out; }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default Inventory;
