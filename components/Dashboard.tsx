
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario, Producto } from '../types';

interface DashboardProps {
  user: Usuario;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSalesCount: 0,
    stockLow: 0,
    productsCount: 0,
    expiringSoonCount: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<any[]>([]);
  const [expiringSoonProducts, setExpiringSoonProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const isAdmin = user.role_id === 1;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      // 1. Obtener todas las ventas
      const { data: salesRes, error: sErr } = await supabase
        .from('ventas')
        .select('*, productos(nombre, codigo_barras)')
        .order('fecha', { ascending: false });

      if (sErr) throw sErr;

      // 2. Obtener productos
      const { data: productsRes, error: pErr } = await supabase
        .from('productos')
        .select('*');

      if (pErr) throw pErr;

      const allSales = salesRes || [];
      const products = productsRes || [];

      // Cálculos para Top Productos (SOLO SI ES ADMIN)
      if (isAdmin) {
        const salesMap: Record<number, { nombre: string, total: number, code: string }> = {};
        allSales.forEach(s => {
          const pid = s.producto_id;
          if (!salesMap[pid]) {
            salesMap[pid] = { 
              nombre: s.productos?.nombre || 'Producto', 
              total: 0,
              code: s.productos?.codigo_barras || ''
            };
          }
          salesMap[pid].total += s.cantidad;
        });

        const sortedTop = Object.values(salesMap)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setTopSellingProducts(sortedTop);
      }

      // Cálculos de fechas
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);

      const expiringSoon = products.filter(p => {
        if (!p.fecha_vencimiento) return false;
        const expiryDate = new Date(p.fecha_vencimiento);
        return expiryDate <= nextMonth;
      });

      const totalRevenue = allSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const lowStock = products.filter(p => (p.stock || 0) < 10).length;
      
      setRecentSales(allSales.slice(0, 15));
      setExpiringSoonProducts(expiringSoon.sort((a, b) => 
        new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime()
      ));

      setStats({
        totalRevenue: totalRevenue,
        totalSalesCount: allSales.length,
        stockLow: lowStock,
        productsCount: products.length,
        expiringSoonCount: expiringSoon.length
      });

    } catch (err: any) {
      console.error("Dashboard Error:", err);
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Business Intelligence...</p>
    </div>
  );

  const statCards = [
    { title: 'Ingresos Totales', value: `$${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50', show: true },
    { title: 'Transacciones', value: stats.totalSalesCount, icon: '🧾', color: 'text-indigo-600', bg: 'bg-indigo-50', show: true },
    { title: 'Artículos', value: stats.productsCount, icon: '📦', color: 'text-slate-600', bg: 'bg-slate-50', show: true },
    { title: 'Stock Crítico', value: stats.stockLow, icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50', show: true },
    { title: 'Vencimientos', value: stats.expiringSoonCount, icon: '📅', color: 'text-rose-600', bg: 'bg-rose-50', show: isAdmin }
  ].filter(card => card.show);

  return (
    <div className="space-y-8 pb-20">
      {/* Grid de KPIs Superiores */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${statCards.length} gap-6`}>
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.2rem] shadow-sm border border-slate-100 group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center text-lg mb-4 group-hover:rotate-6 transition-transform`}>{card.icon}</div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest leading-none">{card.title}</p>
            <p className="text-2xl font-black text-slate-900 mt-1.5">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Ventas y Top (si es admin) */}
        <div className={`${isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-8`}>
          <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Actividad Transaccional</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Últimos movimientos de hoy</p>
              </div>
            </div>

            <div className="space-y-3">
              {recentSales.map((sale, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:border-emerald-100 transition-all duration-300">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <div className="truncate">
                      <p className="font-black text-slate-900 text-sm truncate uppercase leading-none">{sale.productos?.nombre || 'Articulo'}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {new Date(sale.fecha).toLocaleDateString()} &middot; {new Date(sale.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-sm">${Number(sale.total).toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sale.cantidad} uds</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking de Productos (Solo Admin) */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Top Más Vendidos</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Ranking histórico por volumen</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topSellingProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-5 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-indigo-300 transition-all">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400 border border-slate-200'
                    }`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-xs uppercase truncate leading-none">{p.nombre}</h4>
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-1">{p.code || 'S/C'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-600 leading-none">{p.total}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Uds.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lado Derecho: Alertas (Solo Admin) */}
        {isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Alertas de Vencimiento</h3>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Próximos 30 días</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {expiringSoonProducts.map((p, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-black text-slate-900 text-[10px] uppercase truncate mb-1.5">{p.nombre}</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-rose-600 text-[9px] font-black uppercase tracking-widest">EXP: {new Date(p.fecha_vencimiento!).toLocaleDateString()}</span>
                      <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">{p.stock} uds</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">Resumen de Almacén</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-black">{stats.stockLow}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Artículos en stock bajo</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje Informativo para Vendedor (Si aplica) */}
        {!isAdmin && (
           <div className="lg:col-span-12">
             <div className="bg-indigo-600 p-8 rounded-[3rem] shadow-xl text-white flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Control de Disponibilidad</p>
                  <p className="text-2xl font-black mt-1">Hay {stats.stockLow} artículos con pocas unidades</p>
                  <p className="text-xs opacity-70 mt-1">Revisa el inventario para reponer stock si es necesario.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
