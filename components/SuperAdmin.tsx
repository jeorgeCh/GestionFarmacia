
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import AuditTrail from './AuditTrail'; // Reusable audit trail component

const SuperAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'access_control' | 'product_activity' | 'profit'>('access_control');
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [profitStats, setProfitStats] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'profit') {
      fetchProfitability();
    }
  }, [activeTab]);

  const fetchProfitability = async () => {
    setLoadingProfit(true);
    try {
      const { data: productos } = await supabase.from('productos').select('*');
      const { data: ingresos } = await supabase.from('ingresos').select('*').order('fecha', { ascending: false });
      
      if (productos) {
        const stats = productos.map(p => {
          const lastIncome = ingresos?.find(i => i.producto_id === p.id);
          const costoUnitario = lastIncome ? Number(lastIncome.costo_unitario) : 0;
          const precioVenta = p.precio_unidad > 0 ? p.precio_unidad : (p.precio / (p.unidades_por_caja || 1));
          const gananciaUnitaria = precioVenta - costoUnitario;
          const margen = costoUnitario > 0 ? (gananciaUnitaria / costoUnitario) * 100 : 100;

          return { ...p, costoUnitario, gananciaUnitaria, margen };
        }).sort((a, b) => b.gananciaUnitaria - a.gananciaUnitaria);

        setProfitStats(stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfit(false);
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
             onClick={() => setActiveTab('access_control')} 
             className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'access_control' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}
           >
             Control de Acceso
           </button>
           <button 
             onClick={() => setActiveTab('product_activity')} 
             className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'product_activity' ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/30' : 'text-slate-400 hover:text-white'}`}
           >
             Actividad de Productos
           </button>
           <button 
             onClick={() => setActiveTab('profit')} 
             className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profit' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
           >
             Rentabilidad
           </button>
        </div>
      </div>

      <div>
        {activeTab === 'access_control' && (
          <AuditTrail 
            title="Control de Acceso" 
            subtitle="Registro de entradas y salidas del personal" 
            actions={['LOGIN', 'LOGOUT']} 
          />
        )}

        {activeTab === 'product_activity' && (
          <AuditTrail 
            title="Actividad de Productos" 
            subtitle="Registro de creación y edición de productos" 
            actions={['CREACION_PRODUCTO', 'EDICION_PRODUCTO']} 
          />
        )}

        {activeTab === 'profit' && (
          <>
            {loadingProfit ? (
              <div className="text-center py-20"><p className="text-slate-400 font-bold">Cargando rentabilidad...</p></div>
            ) : (
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
                           <td className="px-8 py-5 text-center font-mono text-xs text-rose-500 font-bold">${p.costoUnitario.toLocaleString(undefined, {minimumFractionDigits: 0})}</td>
                           <td className="px-8 py-5 text-center font-mono text-xs text-slate-600 font-bold">${(p.precio_unidad || 0).toLocaleString()}</td>
                           <td className="px-8 py-5 text-center"><span className={`text-sm font-black ${p.gananciaUnitaria > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${p.gananciaUnitaria.toLocaleString(undefined, {minimumFractionDigits: 0})}</span></td>
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
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
