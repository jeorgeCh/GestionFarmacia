
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario, Producto } from '../types';

interface DashboardProps {
  user: Usuario;
  setView?: (view: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, setView }) => {
  const [stats, setStats] = useState({ 
    revenue: 0, 
    sales: 0, 
    stockLow: 0, 
    products: 0, 
    expiring: 0, 
    dailyCosts: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = Number(user.role_id) === 1;

  useEffect(() => {
    loadDailyStats();
  }, []);

  const getDayRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const loadDailyStats = async () => {
    if (!refreshing) setLoading(true);
    setRefreshing(true);
    try {
      const range = getDayRange();

      const [vRes, iRes, pRes, rsRes] = await Promise.all([
        supabase.from('ventas').select('total').gte('fecha', range.start).lte('fecha', range.end),
        supabase.from('ingresos').select('total').gte('fecha', range.start).lte('fecha', range.end),
        supabase.from('productos').select('*'),
        supabase.from('ventas')
          .select('*, productos(nombre, laboratorio)')
          .gte('fecha', range.start)
          .lte('fecha', range.end)
          .order('fecha', { ascending: false })
          .limit(10)
      ]);

      const salesToday = vRes.data || [];
      const incomesToday = iRes.data || [];
      const products = pRes.data || [];
      const rawSales = rsRes.data || [];

      // Agrupar por transaccion_id para contar ventas reales
      const grouped = rawSales.reduce((acc: any[], curr: any) => {
        const tId = curr.transaccion_id || `legacy-${curr.id}`;
        if (!acc.find(t => t.transaccion_id === tId)) {
          acc.push({
            transaccion_id: tId,
            fecha: curr.fecha,
            total: rawSales.filter(x => (x.transaccion_id || `legacy-${x.id}`) === tId).reduce((s,v) => s + Number(v.total), 0),
            nombre: curr.productos?.nombre,
            count: rawSales.filter(x => (x.transaccion_id || `legacy-${x.id}`) === tId).length
          });
        }
        return acc;
      }, []);

      setRecentTransactions(grouped);

      const revenue = salesToday.reduce((sum, v) => sum + Number(v.total || 0), 0);
      const stockLow = products.filter(p => (p.stock || 0) < 10).length;

      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 30);
      const expiring = products.filter(p => p.fecha_vencimiento && new Date(p.fecha_vencimiento) <= limitDate);

      setStats({ 
        revenue, 
        sales: grouped.length, 
        stockLow, 
        products: products.length, 
        expiring: expiring.length,
        dailyCosts: incomesToday.reduce((sum, i) => sum + Number(i.total || 0), 0)
      });
      setExpiringProducts(expiring.slice(0, 5));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading && !refreshing) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analizando indicadores...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12 animate-slide-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Estado de Hoy</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Corte: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <button 
          onClick={loadDailyStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refrescar Datos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 relative z-10">Facturación Hoy</p>
          <p className="text-4xl font-black text-white tracking-tighter leading-none relative z-10">${stats.revenue.toLocaleString()}</p>
        </div>
        
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-emerald-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventas Realizadas</p>
          <p className="text-4xl font-black text-emerald-600 tracking-tighter leading-none">{stats.sales}</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-amber-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Stock Bajo</p>
          <p className="text-4xl font-black text-amber-600 tracking-tighter leading-none">{stats.stockLow}</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-rose-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vencimientos</p>
          <p className="text-4xl font-black text-rose-500 tracking-tighter leading-none">{stats.expiring}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm min-h-[500px]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Actividad Reciente</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Filtrado solo por hoy</p>
            </div>
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-lg border border-emerald-100">Tiempo Real</div>
          </div>
          
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-32 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                 <p className="text-slate-300 font-black uppercase text-[10px] tracking-[0.2em]">Sin actividad comercial registrada hoy</p>
              </div>
            ) : recentTransactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl hover:bg-white border border-transparent hover:border-indigo-100 transition-all group shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm font-black text-sm border border-slate-100">
                     $
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-xs uppercase truncate mb-1">{t.nombre}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ticket #{t.transaccion_id.slice(0,6)} • {t.count} items</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 text-sm tracking-tight mb-0.5">${t.total.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{new Date(t.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-rose-600 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-50 mb-8 relative z-10 flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Alertas de Vencimiento
              </h3>
              <div className="space-y-4 relative z-10">
                {expiringProducts.length === 0 ? (
                  <p className="text-[9px] font-black uppercase opacity-80 tracking-widest italic py-4">Todo el inventario está vigente</p>
                ) : expiringProducts.map((p, i) => (
                  <div key={i} className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-md hover:bg-white/20 transition-all">
                    <p className="font-black text-[11px] uppercase truncate mb-1">{p.nombre}</p>
                    <div className="flex justify-between items-center">
                       <span className="text-[8px] font-black bg-rose-900/20 text-white px-2 py-0.5 rounded uppercase border border-white/10">Próximo</span>
                       <span className="text-[10px] font-black">{new Date(p.fecha_vencimiento!).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
