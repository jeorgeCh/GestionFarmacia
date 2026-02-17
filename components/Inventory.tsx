
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
  
  const [isScanning, setIsScanning] = useState(false);
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
                if (target === 'search') setSearchTerm(codes[0].rawValue);
                else setFormData(prev => ({ ...prev, codigo_barras: codes[0].rawValue }));
                stopScanner();
              }
            }
          }, 500);
        }
      }
    } catch (err) {
      setIsScanning(false);
      alert("Permiso de cámara denegado.");
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
      setFormData({ id: undefined, tipo: 'producto', nombre: '', codigo_barras: '', laboratorio: '', precio: '', precio_unidad: '', descripcion: '', ubicacion: '', fecha_vencimiento: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // VALIDACIÓN ESTRICTA: No permitir campos vacíos obligatorios
    if (!formData.nombre.trim() || !formData.codigo_barras.trim() || !formData.precio || !formData.laboratorio.trim()) {
      setSaveError("Por favor completa todos los campos obligatorios (*)");
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
        descripcion: formData.descripcion?.trim() || null,
        ubicacion: formData.ubicacion?.trim().toUpperCase() || null,
        fecha_vencimiento: formData.fecha_vencimiento || null,
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
      setSaveError(err.message || "Error al guardar. Verifica la conexión.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <input
          type="text"
          className="flex-1 w-full px-8 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-indigo-600 shadow-inner"
          placeholder="Buscar medicamento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="w-full lg:w-auto bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">
            Nuevo Registro
          </button>
        )}
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-6">Producto</th>
                <th className="px-6 py-6 text-center">Tipo</th>
                <th className="px-6 py-6 text-center">Stock</th>
                <th className="px-6 py-6 text-right">Precio</th>
                <th className="px-10 py-6">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center font-black uppercase text-slate-300">Cargando...</td></tr>
              ) : filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 uppercase text-xs">{p.nombre}</div>
                    <div className="text-[9px] text-indigo-500 font-bold uppercase">{p.laboratorio}</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase">{p.tipo}</span>
                  </td>
                  <td className="px-6 py-6 text-center font-black text-slate-600">{p.stock}</td>
                  <td className="px-6 py-6 text-right font-black text-slate-900">${p.precio.toLocaleString()}</td>
                  <td className="px-10 py-6">
                    <button onClick={() => handleOpenModal(p)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
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
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">{formData.id ? 'Editar' : 'Nuevo'} Registro</h3>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-rose-500 transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-6 overflow-y-auto bg-slate-50/20">
              {saveError && <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[11px] font-black uppercase text-center">{saveError}</div>}
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre Comercial <span className="text-rose-500">*</span></label>
                  <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold uppercase focus:border-indigo-600 outline-none" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Laboratorio <span className="text-rose-500">*</span></label>
                    <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold uppercase focus:border-indigo-600 outline-none" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Código EAN <span className="text-rose-500">*</span></label>
                    <input type="text" required className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-600 outline-none" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} />
                  </div>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData({...formData, tipo: 'producto'})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${formData.tipo === 'producto' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>General</button>
                    <button type="button" onClick={() => setFormData({...formData, tipo: 'pastillas'})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${formData.tipo === 'pastillas' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>Pastillas</button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Precio Caja/Venta <span className="text-rose-500">*</span></label>
                      <input type="number" required className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-black text-lg focus:bg-white outline-none" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} />
                    </div>
                    {formData.tipo === 'pastillas' && (
                      <div>
                        <label className="text-[9px] font-black text-indigo-400 uppercase mb-2 block">Precio Fracción</label>
                        <input type="number" className="w-full px-6 py-4 bg-indigo-50/30 rounded-2xl font-black text-lg focus:bg-white outline-none" value={formData.precio_unidad} onChange={e => setFormData({...formData, precio_unidad: e.target.value})} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Ubicación</label>
                    <input type="text" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold uppercase outline-none focus:border-indigo-600" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="PASILLO..." />
                   </div>
                   <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Vencimiento</label>
                    <input type="date" className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-600" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                   </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cerrar</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-600 disabled:opacity-50">
                  {isSaving ? 'Guardando...' : 'Confirmar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
