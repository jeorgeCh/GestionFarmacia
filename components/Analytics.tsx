
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Venta, Ingreso } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

type Period = 7 | 30 | 90;
type SortKey = 'nombre' | 'revenue' | 'estimatedProfit' | 'roi';

interface ProductStat extends Producto {
  unitsSold: number;
  revenue: number;
  totalCost: number;
  estimatedProfit: number;
  roi: number;
}

const SortableHeader: React.FC<{ title: string; sortKey: SortKey; sortConfig: any; setSortConfig: any; className?: string; }> = 
({ title, sortKey, sortConfig, setSortConfig, className }) => {
  const isSorted = sortConfig.key === sortKey;
  const isAsc = isSorted && sortConfig.direction === 'asc';

  const handleClick = () => {
    const direction = isSorted && isAsc ? 'desc' : 'asc';
    setSortConfig({ key: sortKey, direction });
  };

  return (
    <th className={`px-6 py-5 cursor-pointer hover:bg-slate-50 transition-colors ${className}`}>
        <div onClick={handleClick} className="flex items-center justify-center gap-2">
            {title}
            <div className="flex flex-col">
                <svg className={`w-2 h-2 -mb-0.5 ${isSorted && !isAsc ? 'text-slate-900' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M10 3l-6 8h12L10 3z"/></svg>
                <svg className={`w-2 h-2 ${isSorted && isAsc ? 'text-slate-900' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M10 17l6-8H4l6 8z"/></svg>
            </div>
        </div>
    </th>
  );
};


const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(7);
  const [rawVentas, setRawVentas] = useState<Venta[]>([]);
  const [rawIngresos, setRawIngresos] = useState<Ingreso[]>([]);
  const [rawProductos, setRawProductos] = useState<Producto[]>([]);
  const [profitabilitySearch, setProfitabilitySearch] = useState('');
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<{key: SortKey, direction: 'asc' | 'desc'}>({ key: 'estimatedProfit', direction: 'desc' });


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

  const { periodVentas, periodIngresos } = useMemo(() => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - period);
    fromDate.setHours(0, 0, 0, 0);

    return {
      periodVentas: rawVentas.filter(v => new Date(v.fecha) >= fromDate),
      periodIngresos: rawIngresos.filter(i => new Date(i.fecha) >= fromDate)
    };
  }, [rawVentas, rawIngresos, period]);


  const totals = useMemo(() => {
    const totalSales = periodVentas.reduce((sum, v) => sum + Number(v.total), 0);
    const totalCosts = periodIngresos.reduce((sum, i) => sum + Number(i.total), 0);
    return { totalSales, totalCosts, profit: totalSales - totalCosts };
  }, [periodVentas, periodIngresos]);


  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    const formatOptions: Intl.DateTimeFormatOptions = period === 7 
        ? { weekday: 'short' } 
        : { day: 'numeric', month: 'numeric' };

    const dateLabels = Array.from({ length: period }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (period - 1 - i));
      return d.toLocaleDateString('es-ES', formatOptions);
    });

    dateLabels.forEach(label => { map[label] = 0; });

    periodVentas.forEach(v => {
      const label = new Date(v.fecha).toLocaleDateString('es-ES', formatOptions);
      if (label in map) {
          map[label] += Number(v.total);
      }
    });

    return dateLabels.map(label => ({
       name: label.toUpperCase().replace('.', ''),
       total: map[label]
    }));
  }, [periodVentas, period]);

  const { topVolumeProducts, profitableProducts } = useMemo(() => {
    const productStats: Record<number, ProductStat> = {};

    for (const p of rawProductos) {
      productStats[p.id] = { 
        ...p,
        unitsSold: 0, 
        revenue: 0, 
        totalCost: 0, 
        estimatedProfit: 0,
        roi: 0
      };
    }

    const productCosts: Record<string, { totalCost: number, totalQuantity: number }> = {};
    for (const ingreso of rawIngresos) {
        if (!productCosts[ingreso.producto_id]) {
            productCosts[ingreso.producto_id] = { totalCost: 0, totalQuantity: 0 };
        }
        productCosts[ingreso.producto_id].totalCost += Number(ingreso.total);
        productCosts[ingreso.producto_id].totalQuantity += ingreso.cantidad;
    }

    for (const venta of periodVentas) {
      if (productStats[venta.producto_id]) {
        productStats[venta.producto_id].unitsSold += venta.cantidad;
        productStats[venta.producto_id].revenue += Number(venta.total);
      }
    }

    for (const id in productStats) {
      const p = productStats[id];
      if (p.unitsSold > 0 && productCosts[id] && productCosts[id].totalQuantity > 0) {
        const avgCostPerUnit = productCosts[id].totalCost / productCosts[id].totalQuantity;
        p.totalCost = avgCostPerUnit * p.unitsSold;
        p.estimatedProfit = p.revenue - p.totalCost;
        p.roi = p.totalCost > 0 ? (p.estimatedProfit / p.totalCost) * 100 : Infinity;
      }
    }

    const allProducts = Object.values(productStats).filter(p => p.estimatedProfit > 0) as ProductStat[];

    const filtered = allProducts.filter(p => p.nombre.toLowerCase().includes(profitabilitySearch.toLowerCase()));

    const sorted = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const topVolume = [...Object.values(productStats) as ProductStat[]].sort((a,b) => b.unitsSold - a.unitsSold).slice(0, 5);
    
    return { topVolumeProducts: topVolume, profitableProducts: sorted.slice(0, limit) };
  }, [rawProductos, periodVentas, rawIngresos, sortConfig, limit, profitabilitySearch]);


  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Procesando Big Data...</p>
    </div>
  );

  const renderRoi = (roi: number) => {
    if (roi === Infinity) return <span className="font-mono text-xs text-indigo-500">NUEVO</span>;
    const roiColor = roi > 100 ? "text-emerald-500" : roi > 50 ? "text-amber-500" : "text-rose-500";
    return <span className={`font-mono font-black ${roiColor}`}>{`+${roi.toFixed(0)}%`}</span>
  }

  return (
    <div className="space-y-10 animate-slide-up pb-24">
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Dashboard Financiero</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Análisis de rentabilidad y ventas</p>
            </div>
            <div className="flex bg-slate-50 p-1.5 rounded-[1.8rem] border border-slate-100 shadow-inner">
              {[7, 30, 90].map(p => (
                <button 
                  key={p}
                  onClick={() => setPeriod(p as Period)} 
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  {p} DÍAS
                </button>
              ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas del Periodo</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">${totals.totalSales.toLocaleString()}</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
          <div className="w-12 h-12 bg-white/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Utilidad Bruta Estimada</p>
          <p className="text-4xl font-black text-white tracking-tighter leading-none relative z-10">${totals.profit.toLocaleString()}</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 group">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo de Compras</p>
          <p className="text-4xl font-black text-rose-500 tracking-tighter leading-none">${totals.totalCosts.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-8">Ventas por Día (Periodo de {period} Días)</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} 
                dy={10}
                interval={period > 10 ? Math.floor(period / 10) : 0}
              />
              <YAxis hide={true} />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 10}}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
                        <p className="text-lg font-black tracking-tighter">${(payload[0].value as number).toLocaleString()}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="total" radius={[10, 10, 10, 10]} barSize={period === 7 ? 35 : (period === 30 ? 20 : 10) }>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.total > 0 ? '#e2e8f0' : '#f8fafc'} className="hover:fill-indigo-500 transition-all cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Análisis de Rentabilidad</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Explora los productos más rentables en los últimos {period} días</p>
            </div>
            <div className="w-full lg:w-auto flex items-center gap-3">
                <input type="text" placeholder="Buscar producto..." value={profitabilitySearch} onChange={e => setProfitabilitySearch(e.target.value)} className="flex-1 lg:flex-none w-full lg:w-48 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm"/>
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm">
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={25}>Top 25</option>
                    <option value={999}>Todos</option>
                </select>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <SortableHeader title="Producto" sortKey="nombre" sortConfig={sortConfig} setSortConfig={setSortConfig} className="text-left px-8" />
                <SortableHeader title="Total Vendido" sortKey="revenue" sortConfig={sortConfig} setSortConfig={setSortConfig} />
                <th className="px-6 py-5 text-center">Costo Estimado</th>
                <SortableHeader title="Ganancia Estimada" sortKey="estimatedProfit" sortConfig={sortConfig} setSortConfig={setSortConfig} />
                <SortableHeader title="ROI" sortKey="roi" sortConfig={sortConfig} setSortConfig={setSortConfig} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profitableProducts.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">No hay datos de rentabilidad para el filtro actual</td></tr>
              ) : profitableProducts.map((p: ProductStat) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-5 max-w-[250px]">
                    <p className="font-black text-slate-800 text-xs uppercase leading-tight truncate">{p.nombre}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{p.laboratorio || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-slate-600 text-sm">${p.revenue.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center font-bold text-rose-500 text-sm">${p.totalCost.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center font-black text-emerald-600 text-base">${p.estimatedProfit.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center text-base">{renderRoi(p.roi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-10 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Top 5 Productos (por Volumen)</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ranking por unidades vendidas en los últimos {period} días</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-10 py-6">Medicamento</th>
                <th className="px-10 py-6 text-center">Und. Vendidas</th>
                <th className="px-10 py-6 text-center">Ingresos ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topVolumeProducts.length === 0 ? (
                <tr><td colSpan={3} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin registros de facturación</td></tr>
              ) : topVolumeProducts.map((p: ProductStat, i: number) => (
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
                  <td className="px-10 py-8 text-center font-black text-slate-900 text-2xl">{p.unitsSold.toLocaleString()}</td>
                  <td className="px-10 py-8 text-center font-black text-indigo-600 text-lg">${p.revenue.toLocaleString()}</td>
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
