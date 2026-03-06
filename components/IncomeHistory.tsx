
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface SimplifiedIngreso {
  id: number;
  fecha: string;
  productos: {
    nombre: string;
    codigo_barras: string | null;
  } | null;
}

interface IncomeHistoryProps {
  canEdit: boolean; // Prop is kept for compatibility, but actions are removed from this simplified view
}

const IncomeHistory: React.FC<IncomeHistoryProps> = ({ canEdit }) => {
  const [history, setHistory] = useState<SimplifiedIngreso[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const isSearching = !!(searchTerm || searchDate);

  useEffect(() => {
    fetchHistory();
  }, [searchTerm, searchDate]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ingresos')
        .select('id, fecha, productos!inner(nombre, codigo_barras)')
        .order('fecha', { ascending: false });

      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,codigo_barras.ilike.%${searchTerm}%`, { referencedTable: 'productos' });
      }
      
      if (searchDate) {
        const dayStart = `${searchDate}T00:00:00`;
        const dayEnd = `${searchDate}T23:59:59`;
        query = query.gte('fecha', dayStart).lte('fecha', dayEnd);
      }

      // Apply limit only if not searching
      if (!isSearching) {
        query = query.limit(5);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setHistory(data as any);

    } catch (e) {
      console.error("Error fetching history", e);
    } finally {
      setLoading(false);
    }
  };
  
  const colSpan = 3;

  return (
    <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10">
      <div className="p-10 bg-violet-50/50 border-b border-violet-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-xl font-black text-violet-900 uppercase tracking-tight">Historial de Compras</h3>
          <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mt-1">
            Últimos 5 ingresos. Filtre para ver todos los resultados.
          </p>
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 border-b border-slate-100">
          <input 
            type="text" 
            placeholder="Buscar por producto o código..."
            className="md:col-span-2 w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <input 
            type="date" 
            className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase focus:border-indigo-600 outline-none transition-all shadow-sm"
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            title="Filtrar por fecha de ingreso"
          />
      </div>

      <div className="overflow-x-auto">
         <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                 <th className="px-8 py-5">Producto</th>
                 <th className="px-8 py-5">Código de Barras</th>
                 <th className="px-8 py-5 text-right">Fecha de Ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={colSpan} className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Buscando...</td></tr>
              ) : history.length > 0 ? (
                history.map(h => (
                  <tr key={h.id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-8 py-5">
                       <p className="font-black text-slate-900 text-xs uppercase">{h.productos?.nombre}</p>
                    </td>
                    <td className="px-8 py-5">
                       <p className="font-mono text-slate-500 text-xs font-semibold">{h.productos?.codigo_barras || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <p className="font-bold text-slate-600 text-xs">{new Date(h.fecha).toLocaleDateString()}</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={colSpan} className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">{isSearching ? 'No se encontraron registros' : 'No hay ingresos recientes'}</td></tr>
              )}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default IncomeHistory;
