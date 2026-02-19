
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Venta, Ingreso } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from 'recharts';

type TimeFrame = 'day' | 'week' | 'month';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeFrame>('day');
  const [rawVentas, setRawVentas] = useState<Venta[]>([]);
  const [rawIngresos, setRawIngresos] = useState<Ingreso[]>([]);
  const [rawProductos, setRawProductos] = useState<Producto[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ventasRes, ingresosRes, productosRes] = await Promise.all([
        supabase.from('ventas').select('*'),
        supabase.from('ingresos').select('*'),
        supabase.from('productos').select('*')
      ]);
      setRawVentas(ventasRes.data || []);
      setRawIngresos(ingresosRes.data || []);
      setRawProductos(productosRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalSales = rawVentas.reduce((sum, v) => sum + Number(v.total), 0);
    const totalCosts = rawIngresos.reduce((sum, i) => sum + Number(i.total), 0);
    return { totalSales, totalCosts, profit: totalSales - totalCosts };
  }, [rawVentas, rawIngresos]);

  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();

    if (timeframe === 'day') {
      // Últimos 7 días
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString('es-ES', { weekday: 'short' });
      }).reverse();

      rawVentas.forEach(v => {
        const date = new Date(v.fecha);
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          const label = date.toLocaleDateString('es-ES', { weekday: 'short' });
          map[label] = (map[label] || 0) + Number(v.total);
        }
      });

      return days.map(label => ({ name: label.toUpperCase(), total: map[label] || 0 }));
    } else if (timeframe === 'week') {
      // Últimas 4 semanas
      const weeks = ['SEM 4', 'SEM 3', 'SEM 2', 'SEM 1'];
      rawVentas.forEach(v => {
        const date = new Date(v.fecha);
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks < 4) {
          const label = `SEM ${4 - diffWeeks}`;
          map[label] = (map[label] || 0) + Number(v.total);
        }
      });
      return weeks.map(label => ({ name: label, total: map[label] || 0 }));
    } else {
      // Meses del año actual
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      rawVentas.forEach(v => {
        const date = new Date(v.fecha);
        if (date.getFullYear() === now.getFullYear()) {
          const label = months[date.getMonth()];
          map[label] = (map[label] || 0) + Number(v.total);
        }
      });
      return months.map(label => ({ name: label, total: map[label] || 0 }));
    }
  }, [rawVentas, timeframe]);

  const topProductsPerformance = useMemo(() => {
    const productStats = rawProductos.map(p => {
      const sales = rawVentas.filter(v => v.producto_id === p.id);
      const units = sales.reduce((sum, v) => sum + v.cantidad, 0);
      const revenue = sales.reduce((sum, v) => sum + Number(v.total), 0);
      const contribution = totals.totalSales > 0 ? (revenue / totals.totalSales) * 100 : 0;
      return { 
        id: p.id, 
        nombre: p.nombre, 
        laboratorio: p.laboratorio, 
        units, 
        revenue,
        contribution
      };
    });

    return productStats
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [rawProductos, rawVentas, totals.totalSales]);

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Calculando Rendimiento...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-slide-up pb-24">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-xl transition-all">
          <div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Facturación Total</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">${totals.totalSales.toLocaleString()}</p>
          </div>
          <div className="mt-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-emerald-600 uppercase">Corte a la Fecha</span>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
          <div>
            <div className="w-12 h-12 bg-white/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Utilidad Bruta</p>
            <p className="text-4xl font-black text-white tracking-tighter leading-none relative z-10">${totals.profit.toLocaleString()}</p>
          </div>
          <div className="mt-6 relative z-10">
            <span className="px-2 py-0.5 bg-indigo-500/20 rounded text-[8px] font-black uppercase border border-indigo-500/30">Margen Sugerido</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-xl transition-all">
          <div>
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo de Ventas</p>
            <p className="text-4xl font-black text-rose-500 tracking-tighter leading-none">${totals.totalCosts.toLocaleString()}</p>
          </div>
          <p className="mt-6 text-[9px] font-bold text-slate-400 uppercase tracking-tight italic">Basado en costos de ingreso</p>
        </div>
      </div>

      {/* Gráfica con Selector de Tiempo */}
      <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Flujo de Caja Histórico</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Análisis por periodos dinámicos</p>
          </div>
          
          <div className="flex bg-slate-50 p-1.5 rounded-[1.8rem] border border-slate-100 shadow-inner">
            <button 
              onClick={() => setTimeframe('day')} 
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'day' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              Día
            </button>
            <button 
              onClick={() => setTimeframe('week')} 
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'week' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              Semana
            </button>
            <button 
              onClick={() => setTimeframe('month')} 
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === 'month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              Mes
            </button>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8', dy: 10}} 
              />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 15}}
                contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.06)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', padding: '20px'}}
              />
              <Bar dataKey="total" radius={[15, 15, 15, 15]} barSize={timeframe === 'month' ? 25 : 45}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#4f46e5' : '#e2e8f0'} className="hover:fill-indigo-500 transition-all cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de Productos Más Vendidos */}
      <div className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-10 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Top Productos (Rendimiento)</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ranking por volumen y peso financiero</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                <th className="px-10 py-6">Medicamento</th>
                <th className="px-10 py-6 text-center">Und. Vendidas</th>
                <th className="px-10 py-6 text-center">Ingresos ($)</th>
                <th className="px-10 py-6 text-center">Peso en Ventas</th>
                <th className="px-10 py-6 text-center">Desempeño</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topProductsPerformance.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin registros de facturación</td></tr>
              ) : topProductsPerformance.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">#{i+1}</div>
                       <div>
                         <p className="font-black text-slate-900 text-sm uppercase leading-none mb-1 truncate max-w-[200px]">{p.nombre}</p>
                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{p.laboratorio || 'N/A'}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center font-black text-slate-900 text-sm">{p.units.toLocaleString()}</td>
                  <td className="px-10 py-8 text-center font-black text-slate-900 text-sm">${p.revenue.toLocaleString()}</td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.contribution}%` }}></div>
                       </div>
                       <span className="text-[9px] font-black text-indigo-600">{p.contribution.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                     <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${p.units > 15 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                       {p.units > 15 ? 'Alta Demanda' : 'Rotación Media'}
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
