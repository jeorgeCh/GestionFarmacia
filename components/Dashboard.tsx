
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
      // 1. Obtener todas las ventas para estadísticas y cálculos
      const { data: salesRes, error: sErr } = await supabase
        .from('ventas')
        .select('*, productos(nombre, codigo_barras)')
        .order('fecha', { ascending: false });

      if (sErr) throw sErr;

      // 2. Obtener productos para contador de stock bajo y vencimiento
      const { data: productsRes, error: pErr } = await supabase
        .from('productos')
        .select('*');

      if (pErr) throw pErr;

      const allSales = salesRes || [];
      const products = productsRes || [];

      // Cálculos de productos más vendidos (Solo si es Admin procesamos esto a fondo)
      const salesMap: Record<number, { nombre: string, total: number, code: string }> = {};
      allSales.forEach(s => {
        const pid = s.producto_id;
        if (!salesMap[pid]) {
          salesMap[pid] = { 
            nombre: s.productos?.nombre || 'Desconocido', 
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

      // Cálculos de fechas para vencimiento
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
      console.error("Error cargando dashboard:", err);
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Business Intelligence...</p>
    </div>
  );

  const statCards = [
    { title: 'Ingresos Totales', value: `$${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50', show: true },
    { title: 'Ventas Realizadas', value: stats.totalSalesCount, icon: '🧾', color: 'text-indigo-600', bg: 'bg-indigo-50', show: true },
    { title: 'Catálogo', value: stats.productsCount, icon: '📦', color: 'text-slate-600', bg: 'bg-slate-50', show: true },
    { title: 'Stock Bajo', value: stats.stockLow, icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50', show: true },
    { title: 'Por Vencer', value: stats.expiringSoonCount, icon: '📅', color: 'text-rose-600', bg: 'bg-rose-50', show: isAdmin }
  ].filter(card => card.show);

  return (
    <div className="space-y-8 pb-20">
      {dbError && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-4 animate-shake">
          <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Fallo de Conexión</p>
            <p className="text-sm font-medium text-rose-500">{dbError}</p>
          </div>
          <button onClick={fetchDashboardData} className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase rounded-xl">Reintentar</button>
        </div>
      )}

      {/* Tarjetas Superiores */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${statCards.length} gap-6`}>
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center text-lg mb-4`}>{card.icon}</div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{card.title}</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Ventas Recientes */}
        <div className={`${isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-8`}>
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Actividad de Ventas</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Historial transaccional</p>
              </div>
              <button onClick={fetchDashboardData} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>

            <div className="space-y-3">
              {recentSales.length > 0 ? (
                recentSales.map((sale, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-slate-50 shrink-0">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <div className="truncate">
                        <p className="font-black text-slate-900 text-sm truncate uppercase">{sale.productos?.nombre || 'Producto'}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          {new Date(sale.fecha).toLocaleDateString()} · {new Date(sale.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-emerald-600 text-sm">${Number(sale.total).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sale.cantidad} uds</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-30">
                  <p className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">Sin movimientos registrados</p>
                </div>
              )}
            </div>
          </div>

          {/* Sección de Productos más vendidos (Solo Admin) */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Top Productos Más Vendidos</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Rendimiento por volumen de unidades</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topSellingProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-5 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all group">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-colors ${
                      i === 0 ? 'bg-amber-100 text-amber-600' : 
                      i === 1 ? 'bg-slate-200 text-slate-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'
                    }`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-xs uppercase truncate">{p.nombre}</h4>
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest">EAN: {p.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-600 leading-none">{p.total}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Uds. Vendidas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Alertas de Admin */}
        {isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Vencimientos Próximos</h3>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Próximos 30 días</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {expiringSoonProducts.length > 0 ? (
                  expiringSoonProducts.map((p, i) => {
                    const expiry = new Date(p.fecha_vencimiento!);
                    const isExpired = expiry < new Date();
                    return (
                      <div key={i} className={`p-4 rounded-2xl border transition-all ${isExpired ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isExpired ? 'text-rose-600' : 'text-amber-600'}`}>
                            {isExpired ? '⚠️ CADUCADO' : '⏳ POR VENCER'}
                          </p>
                          <span className="text-[11px] font-black text-slate-900 bg-white/50 px-2 py-0.5 rounded-lg">{p.stock} uds</span>
                        </div>
                        <h4 className="font-black text-slate-900 text-xs uppercase truncate mb-1">{p.nombre}</h4>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          <span>Expira: {expiry.toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center opacity-30 italic text-xs font-bold text-slate-400">
                    Control de caducidad al día.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white">
              <div className="flex items-center justify-between mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Alertas de Stock</p>
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
              </div>
              <p className="text-3xl font-black mb-1">{stats.stockLow}</p>
              <p className="text-xs font-medium text-slate-400">Artículos con disponibilidad crítica (menor a 10 unidades).</p>
            </div>
          </div>
        )}
        
        {/* Vista Alternativa para Vendedor: Solo Stock si no hay panel lateral */}
        {!isAdmin && (
           <div className="lg:col-span-12">
             <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Control de Almacén</p>
                  <p className="text-3xl font-black mt-2">{stats.stockLow} <span className="text-xs font-normal text-slate-400 ml-2 uppercase tracking-widest">Productos en stock bajo</span></p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
