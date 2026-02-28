
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

interface AuditTrailProps {
  title: string;
  subtitle: string;
  actions: string[];
}

const AuditTrail: React.FC<AuditTrailProps> = ({ title, subtitle, actions }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState('');

  const fetchAuditLogs = useCallback(async (isDateSearch = false) => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('id, created_at, accion, modulo, detalles, usuarios(username)')
        .in('accion', actions)
        .order('created_at', { ascending: false });

      if (isDateSearch && searchDate) {
        const localDate = new Date(searchDate + 'T00:00:00'); // Adjust for timezone
        const startOfDay = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0, 0).toISOString();
        const endOfDay = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 23, 59, 59, 999).toISOString();
        
        query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
        query = query.limit(500); // A larger limit for date range searches
      } else {
        query = query.limit(5); // Default: show only the 5 most recent
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error(`Error fetching audit trail for actions ${actions.join(', ')}:`, error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actions, searchDate]);

  useEffect(() => {
    fetchAuditLogs(false);
  }, [actions]); // Initial fetch only depends on actions

  const handleSearch = () => {
    if (searchDate) {
      fetchAuditLogs(true);
    } else {
      alert('Por favor, selecciona una fecha para buscar.');
    }
  };
  
  const handleClear = () => {
    setSearchDate('');
    fetchAuditLogs(false);
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'LOGOUT': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'CREACION_PRODUCTO': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'EDICION_PRODUCTO': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 animate-slide-up">
      <div className="bg-white p-6 sm:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
          <button onClick={handleClear} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50">
            {loading ? 'Cargando...' : 'Refrescar / Ver Últimos 5'}
          </button>
        </div>

        {/* Date Filter Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Buscar por día:</p>
            <div className="flex-1">
                <input 
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
            <button onClick={handleSearch} disabled={loading || !searchDate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 w-full sm:w-auto shrink-0">
                Buscar
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
               <tr className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <th className="px-6 py-4">Fecha y Hora</th>
                 <th className="px-6 py-4">Usuario</th>
                 <th className="px-6 py-4">Acción</th>
                 <th className="px-6 py-4">Módulo</th>
                 <th className="px-6 py-4">Detalles</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">Cargando registros...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">No se encontraron registros para los criterios seleccionados.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono text-xs text-slate-600 whitespace-nowrap">{new Date(log.created_at).toLocaleString('es-CO')}</td>
                    <td className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">{log.usuarios?.username || 'Sistema'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getActionStyle(log.accion)}`}>{log.accion.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold uppercase text-indigo-500 whitespace-nowrap">{log.modulo}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{log.detalles}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
