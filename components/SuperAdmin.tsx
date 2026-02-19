
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AuditLog } from '../types';

const SuperAdmin: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'profit'>('audit');
  
  // Estados para Rentabilidad
  const [profitStats, setProfitStats] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'audit') fetchLogs();
    if (activeTab === 'profit') fetchProfitability();
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, usuarios(username, role_id)')
        .in('accion', ['LOGIN', 'LOGOUT']) // FILTRO SOLO ACCESOS
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfitability = async () => {
    setLoading(true);
    try {
      const { data: productos } = await supabase.from('productos').select('*');
      const { data: ingresos } = await supabase.from('ingresos').select('*').order('fecha', { ascending: false });
      
      if (productos) {
        // Calcular rentabilidad estimada: (Precio Venta - Último Costo Unitario)
        const stats = productos.map(p => {
          // Buscar último costo registrado para este producto
          const lastIncome = ingresos?.find(i => i.producto_id === p.id);
          const costoUnitario = lastIncome ? Number(lastIncome.costo_unitario) : 0;
          
          // Precio venta base (asumiendo venta individual como referencia principal)
          const precioVenta = p.precio_unidad > 0 ? p.precio_unidad : (p.precio / (p.unidades_por_caja || 1));
          
          const gananciaUnitaria = precioVenta - costoUnitario;
          const margen = costoUnitario > 0 ? (gananciaUnitaria / costoUnitario) * 100 : 100;

          return {
            ...p,
            costoUnitario,
            gananciaUnitaria,
            margen
          };
        }).sort((a, b) => b.gananciaUnitaria - a.gananciaUnitaria); // Ordenar por mayor ganancia

        setProfitStats(stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black uppercase tracking-tight">Zona Super Usuario</h2>
          <p className="text-[10px] text-violet-400 font-bold uppercase tracking-[0.3em] mt-2">Control Total & Auditoría</p>
        </div>
        
        <div className="flex bg-white/10 p-1.5 rounded-[2rem] border border-white/10 backdrop-blur-md relative z-10">
           <button 
             onClick={() => setActiveTab('audit')} 
             className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}
           >
             Asistencia
           </button>
           <button 
             onClick={() => setActiveTab('profit')} 
             className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profit' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
           >
             Rentabilidad
           </button>
        </div>
      </div>

      {activeTab === 'audit' && (
        <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px] animate-in slide-in-from-bottom-5">
           <div className="p-8 border-b border-slate-50 flex justify-between items-center">
             <div>
               <h3 className="font-black text-slate-900 uppercase tracking-tight">Control de Entradas y Salidas</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registro de Fichaje</p>
             </div>
             <button onClick={fetchLogs} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-all">
               <svg className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
             </button>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                   <th className="px-8 py-5">Hora</th>
                   <th className="px-8 py-5">Fecha</th>
                   <th className="px-8 py-5">Usuario</th>
                   <th className="px-8 py-5 text-center">Tipo de Evento</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {loading ? (
                   <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Cargando registros...</td></tr>
                 ) : logs.length === 0 ? (
                   <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin actividad de acceso registrada</td></tr>
                 ) : logs.map(log => (
                   <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-8 py-5 font-mono text-sm font-bold text-slate-700">
                        {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </td>
                     <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">
                        {new Date(log.created_at).toLocaleDateString()}
                     </td>
                     <td className="px-8 py-5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                             {log.usuarios?.username.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-xs uppercase">{log.usuarios?.username}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">ID: {log.usuario_id}</p>
                          </div>
                       </div>
                     </td>
                     <td className="px-8 py-5 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 w-fit mx-auto ${log.accion === 'LOGIN' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                           <span className={`w-1.5 h-1.5 rounded-full ${log.accion === 'LOGIN' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                           {log.accion === 'LOGIN' ? 'Entrada' : 'Salida'}
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === 'profit' && (
        <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px] animate-in slide-in-from-bottom-5">
           <div className="p-8 border-b border-slate-50 bg-emerald-50/30">
             <h3 className="font-black text-emerald-900 uppercase tracking-tight">Análisis de Rentabilidad Unitaria</h3>
             <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Comparativa: Precio Venta vs. Último Costo de Compra</p>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-8 py-5">Producto</th>
                    <th className="px-8 py-5 text-center">Costo Unit. (Último)</th>
                    <th className="px-8 py-5 text-center">PVP Venta</th>
                    <th className="px-8 py-5 text-center">Ganancia Neta</th>
                    <th className="px-8 py-5 text-center">Margen</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {profitStats.map(p => (
                   <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors group">
                     <td className="px-8 py-5">
                        <p className="font-black text-slate-900 text-xs uppercase">{p.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{p.laboratorio}</p>
                     </td>
                     <td className="px-8 py-5 text-center font-mono text-xs text-rose-500 font-bold">
                        ${p.costoUnitario.toLocaleString(undefined, {minimumFractionDigits: 0})}
                     </td>
                     <td className="px-8 py-5 text-center font-mono text-xs text-slate-600 font-bold">
                        ${(p.precio_unidad || 0).toLocaleString()}
                     </td>
                     <td className="px-8 py-5 text-center">
                        <span className={`text-sm font-black ${p.gananciaUnitaria > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                           ${p.gananciaUnitaria.toLocaleString(undefined, {minimumFractionDigits: 0})}
                        </span>
                     </td>
                     <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                           <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.margen > 30 ? 'bg-emerald-500' : p.margen > 15 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{width: `${Math.min(p.margen, 100)}%`}}></div>
                           </div>
                           <span className="text-[9px] font-black text-slate-500">{p.margen.toFixed(0)}%</span>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
