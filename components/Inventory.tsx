
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
  
  // Estados para el Escáner de Cámara
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
      alert("No se pudo abrir la cámara. Asegúrate de dar permisos.");
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
      setFormData({
        id: p.id,
        tipo: p.tipo || 'producto',
        nombre: p.nombre,
        codigo_barras: p.codigo_barras,
        laboratorio: p.laboratorio || '',
        precio: String(p.precio || ''),
        precio_unidad: String(p.precio_unidad || ''),
        blisters_por_caja: String(p.blisters_por_caja || 1),
        unids_por_blister: String(p.unidades_por_caja && p.blisters_por_caja ? Math.floor(p.unidades_por_caja / p.blisters_por_caja) : 1),
        descripcion: p.descripcion || '',
        ubicacion: p.ubicacion || '',
        fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : ''
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

    try {
      const isPills = formData.tipo === 'pastillas';
      const parsedPrecio = parseFloat(formData.precio) || 0;
      const parsedPrecioUnidad = isPills ? (parseFloat(formData.precio_unidad) || 0) : 0;
      const parsedBlisters = parseInt(formData.blisters_por_caja) || 1;
      const parsedUnidsBlister = parseInt(formData.unids_por_blister) || 1;

      const productData: any = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        codigo_barras: formData.codigo_barras.trim(),
        laboratorio: formData.laboratorio.trim().toUpperCase(),
        descripcion: formData.descripcion?.trim() || null,
        ubicacion: formData.ubicacion?.trim().toUpperCase() || null,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        precio: parsedPrecio,
        precio_unidad: parsedPrecioUnidad,
        blisters_por_caja: parsedBlisters,
        unidades_por_caja: parsedBlisters * parsedUnidsBlister,
      };

      if (formData.id) {
        const { error } = await supabase.from('productos').update(productData).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('productos').insert([{ ...productData, stock: 0 }]);
        if (error) throw error;
      }

      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      console.error("Save Error:", err);
      setSaveError(err.message || "Error al procesar la solicitud. Verifica los datos.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (stock <= 10) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.laboratorio && p.laboratorio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* HEADER DE ACCIONES */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full group">
          <input
            type="text"
            className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm transition-all focus:bg-white focus:border-indigo-600 shadow-inner"
            placeholder="Buscar por nombre, laboratorio o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <button 
            onClick={() => startScanner('search')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()} 
            className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Nuevo Registro
          </button>
        )}
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-10 py-6">Información</th>
                <th className="px-6 py-6 text-center">Tipo</th>
                <th className="px-6 py-6 text-center">Pasillo</th>
                <th className="px-6 py-6 text-center">Expira</th>
                <th className="px-6 py-6 text-center">Stock</th>
                <th className="px-6 py-6 text-right">Precio Venta</th>
                <th className="px-10 py-6">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-10 py-32 text-center text-slate-300 font-black uppercase text-xs animate-pulse">Cargando base de datos...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-10 py-20 text-center text-slate-400 font-bold uppercase text-xs">No hay productos que coincidan</td></tr>
              ) : filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 uppercase text-[13px] mb-1">{product.nombre}</div>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">{product.laboratorio || 'GENÉRICO'}</span>
                       <span className="text-[9px] font-bold text-slate-300">#{product.codigo_barras}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border ${product.tipo === 'pastillas' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {product.tipo === 'pastillas' ? 'Blisters' : 'Unidad'}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    {product.ubicacion ? (
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-black text-[9px] uppercase tracking-tighter">
                        📍 {product.ubicacion}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-200 font-black uppercase">---</span>
                    )}
                  </td>
                  <td className="px-6 py-6 text-center font-bold text-[10px] text-slate-500">
                    {product.fecha_vencimiento ? product.fecha_vencimiento.split('T')[0] : '---'}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-2xl text-[11px] font-black border shadow-sm ${getStockBadge(product.stock)}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right font-black text-slate-900 text-[15px] tracking-tighter">
                    ${Number(product.precio).toLocaleString()}
                  </td>
                  <td className="px-10 py-6">
                    <button 
                      onClick={() => handleOpenModal(product)} 
                      className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REGISTRO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-950 text-white shrink-0">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">{formData.id ? 'Editar Producto' : 'Nuevo Registro'}</h3>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Gestión de Base de Datos</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-rose-500 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/20">
              {saveError && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-[10px] font-black uppercase border border-rose-100 text-center animate-bounce">
                  ⚠️ {saveError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nombre Comercial</label>
                  <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none font-black text-base uppercase focus:border-indigo-600 transition-all shadow-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="NOMBRE DEL MEDICAMENTO" />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Laboratorio</label>
                  <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none font-black text-xs uppercase focus:border-indigo-600 transition-all shadow-sm" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} placeholder="LABORATORIO" />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Código EAN</label>
                  <div className="flex gap-2">
                    <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none font-black text-xs focus:border-indigo-600 transition-all shadow-sm" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} placeholder="CÓDIGO DE BARRAS" />
                    <button type="button" onClick={() => startScanner('form')} className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 hover:bg-indigo-600 transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                   <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 mb-2">Precios de Venta</h4>
                   <div className="flex gap-2 mb-2">
                      <button type="button" onClick={() => setFormData({...formData, tipo: 'producto'})} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'producto' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-400'}`}>General</button>
                      <button type="button" onClick={() => setFormData({...formData, tipo: 'pastillas'})} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'pastillas' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>Pastillas</button>
                   </div>
                   <div className="space-y-4">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                        <input type="number" required className="w-full pl-8 pr-4 py-3 bg-slate-50 rounded-xl font-black text-lg text-slate-950 outline-none focus:bg-white transition-all" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} placeholder="P. Caja" />
                      </div>
                      {formData.tipo === 'pastillas' && (
                        <div className="relative animate-in zoom-in-95">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-sm">$</span>
                          <input type="number" className="w-full pl-8 pr-4 py-3 bg-indigo-50 rounded-xl font-black text-lg text-indigo-900 outline-none focus:bg-white transition-all" value={formData.precio_unidad} onChange={e => setFormData({...formData, precio_unidad: e.target.value})} placeholder="P. Unidad" />
                        </div>
                      )}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                   <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-50 pb-2 mb-2">Ubicación y Almacén</h4>
                   <div className="space-y-4">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 text-sm">📍</span>
                        <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl font-black text-xs uppercase outline-none focus:bg-white" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="PASILLO / ESTANTE" />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">📅</span>
                        <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl font-black text-xs outline-none focus:bg-white" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95">Cerrar</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-slate-950 text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-30">
                  {isSaving ? 'PROCESANDO...' : 'CONFIRMAR DATOS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER FLOTANTE */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-indigo-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-indigo-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-indigo-500 shadow-[0_0_25px_rgba(99,102,241,1)] animate-scan-line"></div>
                </div>
             </div>
             <div className="absolute bottom-10 left-0 right-0 text-center px-6">
                <p className="text-white font-black uppercase text-[10px] tracking-widest bg-black/60 px-8 py-3 rounded-full inline-block backdrop-blur-md">Detectando Código de Barras...</p>
             </div>
          </div>
          <button 
            onClick={stopScanner}
            className="mt-10 bg-white/10 hover:bg-rose-600 text-white px-10 py-5 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] backdrop-blur-xl transition-all border border-white/10 active:scale-90"
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
