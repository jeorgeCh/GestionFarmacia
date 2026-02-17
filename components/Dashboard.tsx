
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario, Producto } from '../types';

interface DashboardProps {
  user: Usuario;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState({ revenue: 0, sales: 0, stockLow: 0, products: 0, expiring: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user.role_id === 1;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, productsRes] = await Promise.all([
        supabase.from('ventas').select('*, productos(nombre, codigo_barras)').order('fecha', { ascending: false }),
        supabase.from('productos').select('*')
      ]);

      const allSales = salesRes.data || [];
      const allProducts = productsRes.data || [];

      // Cálculo de KPI simplificado
      const revenue = allSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const stockLow = allProducts.filter(p => (p.stock || 0) < 10).length;

      // Cálculo de vencimientos (30 días)
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 30);
      const expiring = allProducts.filter(p => p.fecha_vencimiento && new Date(p.fecha_vencimiento) <= limitDate);

      // Top Productos (Solo Admin)
      if (isAdmin) {
        const counts: Record<number, any> = {};
        allSales.forEach(s => {
          if (!counts[s.producto_id]) counts[s.producto_id] = { nombre: s.productos?.nombre, total: 0 };
          counts[s.producto_id].total += s.cantidad;
        });
        setTopProducts(Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 5));
      }

      setStats({ revenue, sales: allSales.length, stockLow, products: allProducts.length, expiring: expiring.length });
      setRecentSales(allSales.slice(0, 8));
      setExpiringProducts(expiring.sort((a, b) => new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime()));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <div className="w-8 h-8 border-3 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando...</p>
    </div>
  );

  const kpis = [
    { label: 'Ventas Hoy', val: `$${stats.revenue.toLocaleString()}`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Stock Bajo', val: stats.stockLow, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Vencimientos', val: stats.expiring, color: 'text-rose-600', bg: 'bg-rose-50', hide: !isAdmin }
  ].filter(k => !k.hide);

  return (
    <div className="space-y-6 pb-24 lg:pb-8 animate-slide-up">
      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
              <p className={`text-xl font-black ${k.color}`}>{k.val}</p>
            </div>
            <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center text-lg shadow-sm`}>
              {k.label.includes('Ventas') ? '💰' : k.label.includes('Stock') ? '⚠️' : '📅'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ventas Recientes */}
        <div className="lg:col-span-8 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Actividad</h3>
            <button onClick={loadData} className="text-slate-300 hover:text-slate-900 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>
          <div className="space-y-3">
            {recentSales.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div className="truncate">
                    <p className="font-black text-slate-800 text-xs truncate uppercase leading-none">{s.productos?.nombre}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{s.cantidad} unidades</p>
                  </div>
                </div>
                <div className="font-black text-slate-900 text-sm shrink-0">${Number(s.total).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar de Alertas (Admin) */}
        {isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Vencimientos
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                {expiringProducts.map((p, i) => (
                  <div key={i} className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <p className="font-black text-slate-800 text-[10px] uppercase truncate">{p.nombre}</p>
                    <p className="text-[9px] text-rose-600 font-black uppercase mt-0.5">Vence: {new Date(p.fecha_vencimiento!).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Top Vendido</p>
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px] font-bold py-1 border-b border-white/5 last:border-0">
                    <span className="truncate pr-2 opacity-80 uppercase">{p.nombre}</span>
                    <span className="text-emerald-400 shrink-0">{p.total} uds</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
