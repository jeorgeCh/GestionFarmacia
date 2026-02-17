
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario } from '../types';

interface InventoryProps {
  user: Usuario;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    nombre: '',
    codigo_barras: '',
    precio: '',
    stock: '',
    descripcion: '',
    ubicacion: '',
    fecha_vencimiento: ''
  });

  const isAdmin = user.role_id === 1;

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });
    
    if (error) {
      console.error("Error cargando productos:", error);
    }
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleOpenModal = (p?: Producto) => {
    setSaveError(null);
    if (p) {
      setFormData({
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras,
        precio: String(p.precio),
        stock: String(p.stock),
        descripcion: p.descripcion || '',
        ubicacion: p.ubicacion || '',
        fecha_vencimiento: p.fecha_vencimiento || ''
      });
    } else {
      setFormData({
        id: undefined,
        nombre: '',
        codigo_barras: '',
        precio: '',
        stock: '',
        descripcion: '',
        ubicacion: '',
        fecha_vencimiento: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    const productToSave: any = {
      nombre: formData.nombre,
      codigo_barras: formData.codigo_barras,
      descripcion: formData.descripcion,
      ubicacion: formData.ubicacion,
      fecha_vencimiento: formData.fecha_vencimiento || null
    };

    if (isAdmin) {
      productToSave.precio = parseFloat(formData.precio) || 0;
      productToSave.stock = parseInt(formData.stock) || 0;
    }
    
    try {
      let error;
      if (formData.id) {
        const { error: updateError } = await supabase
          .from('productos')
          .update(productToSave)
          .eq('id', formData.id);
        error = updateError;
      } else {
        if (!isAdmin) {
          productToSave.precio = 0;
          productToSave.stock = 0;
        }
        const { error: insertError } = await supabase
          .from('productos')
          .insert([productToSave]);
        error = insertError;
      }

      if (error) {
        throw new Error(error.message);
      }

      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      console.error("Error al guardar:", err);
      setSaveError(err.message || "Error desconocido al conectar con Supabase");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.ubicacion && p.ubicacion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-[6px] focus:ring-emerald-500/5 focus:border-emerald-600 outline-none transition-all font-medium"
            placeholder="Buscar por nombre, código o ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute inset-y-0 left-5 flex items-center">
             <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-900/10 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Nuevo Producto
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Producto</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ubicación</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vencimiento</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">P.V.P</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-8 py-24 text-center text-slate-300 font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-24 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No hay resultados</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 leading-tight uppercase">{product.nombre}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-1 italic line-clamp-1">{product.codigo_barras}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                        </span>
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{product.ubicacion || 'Sin ubicar'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`text-[11px] font-bold ${
                        product.fecha_vencimiento && new Date(product.fecha_vencimiento) < new Date() ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {product.fecha_vencimiento ? new Date(product.fecha_vencimiento).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6 font-black text-indigo-600 tracking-tight">${Number(product.precio).toLocaleString()}</td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        product.stock < 10 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {product.stock} Unds
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleOpenModal(product)} 
                        className="p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formData.id ? 'Actualizar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowModal(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-rose-500 hover:text-white text-slate-400 shadow-sm transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-6">
              {saveError && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-600 text-[11px] font-bold">
                  <p className="uppercase mb-1 tracking-widest">⚠️ Error al Guardar:</p>
                  <p className="font-mono">{saveError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Comercial</label>
                  <input type="text" required className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5 outline-none font-bold text-slate-700 transition-all" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción Detallada</label>
                  <textarea rows={2} className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5 outline-none font-bold text-slate-700 transition-all" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Código de Barras</label>
                  <input type="text" required className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5 outline-none font-bold text-slate-700 transition-all" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ubicación (Estante)</label>
                  <input type="text" className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5 outline-none font-bold text-slate-700 transition-all" placeholder="Ej: A-4" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fecha de Vencimiento</label>
                  <div className="date-input-container">
                    <input 
                      type="date" 
                      className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5 outline-none font-bold text-slate-700 transition-all cursor-pointer" 
                      value={formData.fecha_vencimiento} 
                      onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} 
                      onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                      onFocus={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                    />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${!isAdmin ? 'text-slate-300' : 'text-slate-400'}`}>Precio de Venta ($)</label>
                  <input 
                    type="number" 
                    step="100"
                    required 
                    disabled={!isAdmin}
                    className={`w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl outline-none font-bold ${!isAdmin ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5'} transition-all`} 
                    value={formData.precio} 
                    onChange={e => setFormData({...formData, precio: e.target.value})} 
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${!isAdmin ? 'text-slate-300' : 'text-slate-400'}`}>Stock Inicial</label>
                  <input 
                    type="number" 
                    required 
                    disabled={!isAdmin}
                    className={`w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl outline-none font-bold ${!isAdmin ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 focus:bg-white focus:ring-[8px] focus:ring-emerald-500/5'} transition-all`} 
                    value={formData.stock} 
                    onChange={e => setFormData({...formData, stock: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border border-slate-100 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-colors">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-2 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : 'Guardar Cambios'}
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
