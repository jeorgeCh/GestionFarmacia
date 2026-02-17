
import React, { useState, useEffect } from 'react';
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

  useEffect(() => { fetchProducts(); }, []);

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
    if (stock <= 5) return 'text-rose-600 bg-rose-50 ring-1 ring-rose-200';
    if (stock <= 15) return 'text-amber-600 bg-amber-50 ring-1 ring-amber-200';
    return 'text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200';
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.laboratorio && p.laboratorio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] outline-none font-medium text-sm shadow-sm focus:border-indigo-500"
            placeholder="Buscar por nombre, laboratorio o EAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute inset-y-0 left-5 flex items-center">
             <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Nuevo Medicamento
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle Producto</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ubicación</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimiento</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-xs">Cargando...</td></tr>
              ) : filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-8 py-6 max-w-md">
                    <div className="font-black text-slate-900 uppercase text-sm leading-none mb-1.5">{product.nombre}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex flex-wrap gap-2">
                      <span className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm">Laboratorio: {product.laboratorio || 'N/A'}</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">EAN: {product.codigo_barras}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${product.tipo === 'pastillas' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {product.tipo === 'pastillas' ? 'Píldoras' : 'Unidad'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {product.ubicacion ? (
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg font-black text-[9px] uppercase tracking-tighter">
                        📍 {product.ubicacion}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-300 font-bold uppercase">No asignada</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="text-[10px] font-black text-slate-600 uppercase">
                      {product.fecha_vencimiento ? product.fecha_vencimiento.split('T')[0] : '---'}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black inline-block min-w-[60px] ${getStockColor(product.stock)}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900">
                    ${Number(product.precio).toLocaleString()}
                  </td>
                  <td className="px-8 py-6">
                    <button onClick={() => handleOpenModal(product)} className="w-10 h-10 bg-white text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all border border-slate-100 shadow-sm">
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{formData.id ? 'Ficha Técnica' : 'Alta de Producto'}</h3>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-rose-50 text-slate-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">Nombre Comercial</label>
                  <input type="text" required className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm transition-all uppercase focus:border-indigo-600" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">Fabricante (Laboratorio)</label>
                  <input type="text" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm transition-all uppercase focus:border-indigo-600" value={formData.laboratorio} onChange={e => setFormData({...formData, laboratorio: e.target.value})} placeholder="PFIZER, GENFAR, ETC..." />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">EAN / Código de Barras</label>
                  <input type="text" required className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm transition-all focus:border-indigo-600" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">Fecha Vencimiento</label>
                  <input type="date" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm transition-all focus:border-indigo-600" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">Ubicación Estante</label>
                  <input type="text" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm uppercase focus:border-indigo-600" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="PASILLO A - NIVEL 3" />
                </div>

                <div className="md:col-span-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase block mb-2">Descripción (Opcional)</label>
                   <textarea className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm h-24 resize-none focus:border-indigo-600" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Indicaciones o notas adicionales..."></textarea>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border-2 border-slate-100 rounded-[2rem] text-slate-400 font-black text-xs uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-2 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-700">
                  {isSaving ? 'Guardando...' : 'Confirmar Cambios'}
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
