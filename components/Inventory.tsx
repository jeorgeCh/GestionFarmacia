
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

  const handleDeleteProduct = async (id: number, nombre: string) => {
    if (!isAdmin) return;
    if (confirm(`¿Estás seguro de eliminar permanentemente el producto "${nombre}"? Esta acción no se puede deshacer.`)) {
      try {
        const { error } = await supabase.from('productos').delete().eq('id', id);
        if (error) throw error;
        fetchProducts();
      } catch (err: any) {
        alert("Error al eliminar: " + err.message);
      }
    }
  };

  const handleOpenModal = (p?: Producto) => {
    setSaveError(null);
    if (p) {
      setFormData({
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras,
        precio: String(p.precio),
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
      // El stock NO se guarda aquí, se maneja por Ingresos
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
        }
        // Al crear un producto nuevo, el stock inicia en 0 por defecto en la DB
        const { error: insertError } = await supabase
          .from('productos')
          .insert([productToSave]);
        error = insertError;
      }

      if (error) throw new Error(error.message);
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setSaveError(err.message || "Error al conectar con el servidor");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.ubicacion && p.ubicacion.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none font-medium transition-all text-sm lg:text-base"
            placeholder="Buscar por nombre, ubicación o descripción..."
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all"
          >
            Nuevo Producto
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Producto & Ubicación</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Datos Núm.</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Descripción Técnica</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-24 text-center text-slate-300 font-black animate-pulse uppercase tracking-widest text-[10px]">Sincronizando...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-24 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No se encontraron productos</td></tr>
              ) : filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-6 min-w-[200px]">
                    <div className="font-black text-slate-900 uppercase truncate text-sm">{product.nombre}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{product.codigo_barras}</span>
                      {product.ubicacion && (
                        <span className="text-[8px] bg-indigo-50 text-indigo-500 font-black px-1.5 py-0.5 rounded-md uppercase">📍 {product.ubicacion}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap text-center">
                    <div className="font-black text-indigo-600 text-sm">${Number(product.precio).toLocaleString()}</div>
                    <div className={`text-[9px] font-black uppercase mt-1 ${product.stock < 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {product.stock} Unidades
                    </div>
                  </td>
                  <td className="px-8 py-6 min-w-[300px] max-w-md">
                    {product.descripcion ? (
                      <p className="text-[10px] text-slate-500 italic font-medium leading-relaxed line-clamp-2">
                        {product.descripcion}
                      </p>
                    ) : (
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Sin detalles técnicos</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenModal(product)} className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Editar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDeleteProduct(product.id, product.nombre)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 lg:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-tight">{formData.id ? 'Actualizar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 lg:p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {saveError && <div className="bg-rose-50 p-4 rounded-xl text-rose-600 text-[10px] font-black uppercase tracking-widest">{saveError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Nombre Comercial / Genérico</label>
                  <input type="text" required className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:border-emerald-500 outline-none font-bold transition-all text-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Código de Barras (EAN)</label>
                  <input type="text" required className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:border-emerald-500 outline-none font-bold transition-all text-sm" value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Ubicación física</label>
                  <input type="text" placeholder="Ej: Estante B-4" className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:border-emerald-500 outline-none font-bold transition-all text-sm" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Precio de Venta ($)</label>
                  <input type="number" required disabled={!isAdmin} className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl outline-none font-bold disabled:opacity-50 transition-all focus:bg-white focus:border-emerald-500 text-sm" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Descripción / Indicaciones</label>
                  <textarea rows={3} className="w-full px-6 py-4 border border-slate-100 bg-slate-50 rounded-2xl focus:bg-white focus:border-emerald-500 outline-none font-bold transition-all resize-none text-sm" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Detalles del medicamento..." />
                </div>
              </div>

              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <p className="text-[9px] font-black text-amber-700 uppercase tracking-[0.2em] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Gestión de Existencias
                </p>
                <p className="text-[10px] text-amber-600 font-medium mt-1">El stock se actualiza automáticamente al registrar facturas en el módulo de <strong>Ingresos</strong>.</p>
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border border-slate-100 rounded-2xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-50 transition-all tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50 hover:bg-emerald-700 transition-all tracking-widest">
                  {isSaving ? 'Guardando...' : 'Guardar Producto'}
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
