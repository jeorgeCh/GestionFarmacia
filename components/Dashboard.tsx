
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario, Producto } from '../types';

interface DashboardProps {
  user: Usuario;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState({ 
    revenue: 0, 
    sales: 0, 
    stockLow: 0, 
    products: 0, 
    expiring: 0, 
    dailyCosts: 0,
    totalRevenueAllTime: 0 
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user.role_id === 1;

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
    setLoading(true);
    try {
      const range = getDayRange();

      const [vRes, iRes, pRes, rsRes, allVRes] = await Promise.all([
        supabase.from('ventas').select('total').gte('fecha', range.start).lte('fecha', range.end),
        supabase.from('ingresos').select('total').gte('fecha', range.start).lte('fecha', range.end),
        supabase.from('productos').select('*'),
        supabase.from('ventas')
          .select('*, productos(nombre, laboratorio)')
          .order('fecha', { ascending: false })
          .limit(30), // Traemos más para agrupar
        supabase.from('ventas').select('total')
      ]);

      const rawSales = rsRes.data || [];
      
      // Agrupar ventas por transaccion_id para el Dashboard
      const grouped = rawSales.reduce((acc: any[], curr: any) => {
        const tId = curr.transaccion_id || `legacy-${curr.id}`;
        const existing = acc.find(t => t.transaccion_id === tId);
        if (existing) {
          existing.total += Number(curr.total);
          existing.count += 1;
        } else {
          acc.push({
            transaccion_id: tId,
            fecha: curr.fecha,
            total: Number(curr.total),
            nombre: curr.productos?.nombre,
            laboratorio: curr.productos?.laboratorio,
            count: 1
          });
        }
        return acc;
      }, []);

      setRecentTransactions(grouped.slice(0, 8));

      const salesToday = vRes.data || [];
      const incomesToday = iRes.data || [];
      const products = pRes.data || [];
      const allSalesData = allVRes.data || [];
      
      const revenue = salesToday.reduce((sum, v) => sum + Number(v.total || 0), 0);
      const costs = incomesToday.reduce((sum, i) => sum + Number(i.total || 0), 0);
      const totalRevenueAllTime = allSalesData.reduce((sum, v) => sum + Number(v.total || 0), 0);
      const stockLow = products.filter(p => (p.stock || 0) < 10).length;

      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 30);
      const expiring = products.filter(p => p.fecha_vencimiento && new Date(p.fecha_vencimiento) <= limitDate);

      setStats({ 
        revenue, 
        sales: grouped.filter(t => new Date(t.fecha) >= new Date(range.start)).length, 
        stockLow, 
        products: products.length, 
        expiring: expiring.length,
        dailyCosts: costs,
        totalRevenueAllTime
      });
      
      setExpiringProducts(expiring.slice(0, 5));

    } catch (e: any) {
      console.error("Error cargando estadísticas:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando droguería...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 animate-slide-up">
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-2'} gap-4`}>
        {isAdmin && (
          <>
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl lg:col-span-1">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Ventas Históricas</p>
              <p className="text-xl font-black text-white">${stats.totalRevenueAllTime.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas Hoy</p>
              <p className="text-xl font-black text-emerald-600">${stats.revenue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Hoy</p>
              <p className="text-xl font-black text-slate-900">${stats.dailyCosts.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilidad Bruta</p>
              <p className="text-xl font-black text-indigo-600">${(stats.revenue - stats.dailyCosts).toLocaleString()}</p>
            </div>
          </>
        )}
        
        <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm`}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Bajo</p>
          <p className="text-xl font-black text-amber-600">{stats.stockLow} Refs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Actividad de Ventas</h3>
              <button onClick={loadDailyStats} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Refrescar</button>
            </div>
            <div className="space-y-4">
              {recentTransactions.length === 0 ? (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Sin transacciones recientes</p>
              ) : recentTransactions.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm shrink-0 font-black text-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                       ${t.total.toLocaleString()}
                    </div>
                    <div className="truncate">
                      <p className="font-black text-slate-800 text-xs uppercase truncate mb-1">
                        {t.nombre} {t.count > 1 ? `+ ${t.count - 1} items` : ''}
                      </p>
                      <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest">Lab: {t.laboratorio || '---'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-[10px] text-slate-900 font-black uppercase tracking-tight">{new Date(t.fecha).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(t.fecha).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-8 relative z-10">Cronograma Vencimientos</h3>
              <div className="space-y-4 relative z-10">
                {expiringProducts.length === 0 ? (
                  <p className="text-[10px] font-bold uppercase opacity-40 italic">Ningún producto próximo a vencer</p>
                ) : expiringProducts.map((p, i) => (
                  <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                    <p className="font-black text-[11px] uppercase truncate mb-1">{p.nombre}</p>
                    <p className="text-[8px] text-indigo-400 font-black uppercase tracking-widest">Lab: {p.laboratorio || 'S/L'}</p>
                    <p className="text-[10px] font-black mt-2 text-rose-400 uppercase tracking-tighter">Expira: {new Date(p.fecha_vencimiento!).toLocaleDateString()}</p>
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
