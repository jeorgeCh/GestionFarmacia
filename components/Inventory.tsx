
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
      setSaveError("Error de sincronización con la base de datos.");
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
        videoRef.current.play();
        
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code']
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                if (target === 'search') setSearchTerm(code);
                else setFormData(prev => ({ ...prev, codigo_barras: code }));
                stopScanner();
              }
            }
          }, 500);
        }
      }
    } catch (err) {
      alert("Permiso de cámara denegado.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsScanning(false);
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
        descripcion: p.descripcion || '',
        ubicacion: p.ubicacion || '',
        fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : ''
      });
    } else {
      setFormData({ 
        id: undefined, tipo: 'producto', nombre: '', codigo_barras: '', 
        laboratorio: '', precio: '', precio_unidad: '', 
        descripcion: '', ubicacion: '', fecha_vencimiento: '' 
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // VALIDACIÓN ESTRICTA: BLOQUEO SI FALTA CUALQUIER CAMPO
    const { nombre, codigo_barras, laboratorio, precio, ubicacion, descripcion, fecha_vencimiento, tipo, precio_unidad } = formData;
    
    if (
      !nombre.trim() || 
      !codigo_barras.trim() || 
      !laboratorio.trim() || 
      !precio || 
      !ubicacion.trim() || 
      !descripcion.trim() || 
      !fecha_vencimiento
    ) {
      setSaveError("⚠️ CAMPOS FALTANTES: Debes completar Nombre, Laboratorio, Código, Precio, Ubicación, Descripción y Vencimiento.");
      return;
    }

    if (tipo === 'pastillas' && !precio_unidad) {
      setSaveError("⚠️ PRECIO FRACCIÓN: Es obligatorio para productos tipo Pastillas.");
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const productData = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        codigo_barras: formData.codigo_barras.trim(),
        laboratorio: formData.laboratorio.trim().toUpperCase(),
        descripcion: formData.descripcion.trim(),
        ubicacion: formData.ubicacion.trim().toUpperCase(),
        fecha_vencimiento: formData.fecha_vencimiento,
        precio: parseFloat(formData.precio),
        precio_unidad: formData.tipo === 'pastillas' ? parseFloat(formData.precio_unidad) : 0
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
      setSaveError("Error de servidor: " + (err.message || "Verifica la conexión"));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    p.laboratorio?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            className="w-full pl-14 pr-12 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-600 shadow-inner"
            placeholder="Buscar por nombre, lab o escanea..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={() => startScanner('search')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all">
            + Registro Completo
          </button>
        )}
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-6">Medicamento y Detalle</th>
                <th className="px-6 py-6 text-center">Ubicación</th>
                <th className="px-6 py-6 text-center">Stock</th>
                <th className="px-6 py-6 text-right">Precio</th>
                <th className="px-10 py-6">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center font-black uppercase text-slate-300">Cargando datos...</td></tr>
              ) : filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 uppercase text-xs mb-0.5">{p.nombre}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mb-2">Lab: {p.laboratorio}</div>
                    <div className="text-[9px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl inline-block max-w-[250px] truncate italic">
                      {p.descripcion || 'Sin descripción'}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[9px] font-black uppercase">
                      📍 {p.ubicacion}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-2xl text-[11px] font-black border ${p.stock <= 5 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-600'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right font-black text-slate-900 text-sm">${p.precio.toLocaleString()}</td>
                  <td className="px-10 py-6">
                    <button onClick={() => handleOpenModal(p)} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-950 hover:text-white transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tight">{formData.id ? 'Editar' : 'Nuevo'} Registro</h3>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-rose-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50/20">
              {saveError && (
                <div className="p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center animate-bounce">
                  {saveError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Medicamento *</label>
                  <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-sm uppercase focus:border-indigo-600 outline-none" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="NOMBRE Y PRESENTACIÓN" />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Laboratorio *</label>
                  <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase focus:border-indigo-600 outline-none" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} placeholder="EJ: MK, GENFAR, ETC" />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Código EAN *</label>
                  <div className="flex gap-2">
                    <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs focus:border-indigo-600 outline-none" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} placeholder="LEER CÓDIGO" />
                    <button type="button" onClick={() => startScanner('form')} className="w-14 h-14 bg-slate-950 text-white rounded-2xl flex items-center justify-center shrink-0">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData({...formData, tipo: 'producto'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'producto' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-400'}`}>Empaque General</button>
                    <button type="button" onClick={() => setFormData({...formData, tipo: 'pastillas'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.tipo === 'pastillas' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>Por Pastillas</button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Precio Venta (Caja) *</label>
                      <input type="number" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-black text-lg focus:bg-white outline-none" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} placeholder="0.00" />
                    </div>
                    {formData.tipo === 'pastillas' && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Precio Fracción *</label>
                        <input type="number" className="w-full px-6 py-4 bg-indigo-50/30 rounded-2xl font-black text-lg focus:bg-white outline-none" value={formData.precio_unidad} onChange={e => setFormData({...formData, precio_unidad: e.target.value})} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Ubicación Pasillo *</label>
                  <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase focus:border-indigo-600 outline-none" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="EJ: ESTANTE B-4" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Vencimiento *</label>
                  <input type="date" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-600" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Descripción Detallada *</label>
                  <textarea rows={3} required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-3xl font-bold text-xs uppercase focus:border-indigo-600 outline-none shadow-sm" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Escribe las indicaciones, componentes o notas obligatorias..." />
                </div>
              </div>

              <div className="flex gap-4 pt-6 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-slate-950 text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-xl hover:bg-emerald-600 disabled:opacity-50">
                  {isSaving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-indigo-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-indigo-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-indigo-500 animate-scan shadow-[0_0_15px_#6366f1]"></div>
                </div>
             </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-rose-600 text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest">Cerrar Cámara</button>
          <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
        </div>
      )}
    </div>
  );
};

export default Inventory;
