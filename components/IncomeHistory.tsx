
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Ingreso } from '../types';

interface IncomeHistoryProps {
  canEdit: boolean;
}

const IncomeHistory: React.FC<IncomeHistoryProps> = ({ canEdit }) => {
  const [history, setHistory] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isSearching = !!(searchTerm || startDate || endDate);

  useEffect(() => {
    fetchHistory();
  }, [searchTerm, startDate, endDate]);

  const fetchHistory = async () => {
    setLoading(true);
    const limit = isSearching ? 100 : 3;

    try {
      let query = supabase
        .from('ingresos')
        .select('*, productos!inner(nombre, laboratorio), proveedores(nombre), usuarios(username)')
        .order('fecha', { ascending: false });

      if (searchTerm) {
        query = query.ilike('productos.nombre', `%${searchTerm}%`);
      }
      if (startDate) {
        query = query.gte('fecha', startDate);
      }
      if (endDate) {
        query = query.lte('fecha', endDate);
      }

      const { data, error } = await query.limit(limit);
      
      if (error) throw error;
      if (data) setHistory(data);
    } catch (e) {
      console.error("Error fetching history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro? Esta acción es irreversible.')) {
      try {
        const { error } = await supabase.from('ingresos').delete().eq('id', id);
        if (error) throw error;
        fetchHistory();
      } catch (error: any) {
        alert('Error al eliminar el registro: ' + error.message);
      }
    }
  };

  return (
    <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10">
      <div className="p-10 bg-violet-50/50 border-b border-violet-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-xl font-black text-violet-900 uppercase tracking-tight">Historial de Compras</h3>
          <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mt-1">
            Filtre por producto o por rango de fechas de adquisición.
          </p>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-violet-100 flex items-center justify-center text-violet-600 font-black">
          $$
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 border-b border-slate-100">
          <input 
            type="text" 
            placeholder="Buscar por producto..."
            className="md:col-span-1 w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <input 
              type="date" 
              className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Fecha de inicio de adquisición"
            />
            <input 
              type="date" 
              className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="Fecha de fin de adquisición"
            />
          </div>
      </div>

      <div className="overflow-x-auto">
         <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                 <th className="px-8 py-5">Fecha / Operario</th>
                 <th className="px-8 py-5">Proveedor</th>
                 <th className="px-8 py-5">Producto</th>
                 <th className="px-8 py-5 text-center">Cantidad</th>
                 <th className="px-8 py-5 text-right">Costo Total</th>
                 {canEdit && <th className="px-8 py-5 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={canEdit ? 6 : 5} className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Buscando...</td></tr>
              ) : history.length > 0 ? (
                history.map(h => (
                  <tr key={h.id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-8 py-5">
                       <p className="font-black text-slate-900 text-xs">{new Date(h.fecha).toLocaleDateString()}</p>
                       <p className="text-[9px] text-slate-400 font-bold uppercase">{h.usuarios?.username || 'Sist'}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">{h.proveedores?.nombre}</span>
                    </td>
                    <td className="px-8 py-5">
                       <p className="font-black text-slate-900 text-xs uppercase">{h.productos?.nombre}</p>
                       <p className="text-[9px] text-slate-400 font-bold uppercase">Lote: {h.lote}</p>
                    </td>
                    <td className="px-8 py-5 text-center font-black text-slate-600 text-sm">
                       {h.cantidad} Uds
                    </td>
                    <td className="px-8 py-5 text-right font-black text-violet-600 text-sm">
                       ${h.total.toLocaleString()}
                    </td>
                    {canEdit && (
                      <td className="px-8 py-5 text-center">
                        <button onClick={() => handleDelete(h.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={canEdit ? 6 : 5} className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">{isSearching ? 'No se encontraron registros para esta búsqueda' : 'No hay ingresos recientes'}</td></tr>
              )}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default IncomeHistory;
