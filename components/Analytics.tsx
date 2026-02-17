
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Venta, Ingreso } from '../types';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalSales: 0,
    totalCosts: 0,
    profit: 0,
    margin: 0,
    productFlow: [] as any[]
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [ventasRes, ingresosRes, productosRes] = await Promise.all([
        supabase.from('ventas').select('*'),
        supabase.from('ingresos').select('*'),
        supabase.from('productos').select('*')
      ]);

      const ventas = ventasRes.data || [];
      const ingresos = ingresosRes.data || [];
      const productos = productosRes.data || [];

      const totalSales = ventas.reduce((sum, v) => sum + Number(v.total), 0);
      const totalCosts = ingresos.reduce((sum, i) => sum + Number(i.total), 0);
      const profit = totalSales - totalCosts;
      const margin = totalCosts > 0 ? (totalSales / totalCosts) * 100 : 0;

      const productAnalysis = productos.map(p => {
        const pIngresos = ingresos.filter(i => i.producto_id === p.id);
        const pVentas = ventas.filter(v => v.producto_id === p.id);
        const totalPurchasedUnits = pIngresos.reduce((sum, i) => sum + i.cantidad, 0);
        const totalInvestment = pIngresos.reduce((sum, i) => sum + Number(i.total), 0);
        const totalSoldUnits = pVentas.reduce((sum, v) => sum + v.cantidad, 0);
        const totalRevenue = pVentas.reduce((sum, v) => sum + Number(v.total), 0);
        const netFlow = totalRevenue - totalInvestment;
        const roi = totalInvestment > 0 ? (totalRevenue / totalInvestment) * 100 : 0;

        return {
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          totalPurchasedUnits,
          totalInvestment,
          totalSoldUnits,
          totalRevenue,
          netFlow,
          roi
        };
      }).filter(p => p.totalInvestment > 0 || p.totalRevenue > 0);

      setData({
        totalSales,
        totalCosts,
        profit,
        margin,
        productFlow: productAnalysis.sort((a, b) => b.netFlow - a.netFlow)
      });

    } catch (err) {
      console.error("Error en analítica:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analizando historial financiero...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventas Totales Históricas</p>
          <p className="text-3xl font-black text-emerald-600">${data.totalSales.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Inversión Total</p>
          <p className="text-3xl font-black text-slate-900">${data.totalCosts.toLocaleString()}</p>
        </div>
        <div className={`p-8 rounded-[2.5rem] border shadow-xl ${data.profit >= 0 ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-rose-600 text-white border-rose-500'}`}>
          <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-2">Balance Neto Global</p>
          <p className="text-3xl font-black">${data.profit.toLocaleString()}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Rendimiento</span>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">{data.margin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Rentabilidad por Medicamento</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Histórico de Compra vs. Venta</p>
          </div>
          <button onClick={fetchAnalytics} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all text-slate-400 border border-slate-100">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-6">Medicamento</th>
                <th className="px-8 py-6 text-center">Inversión</th>
                <th className="px-8 py-6 text-center">Ingreso Venta</th>
                <th className="px-8 py-6 text-center">Neto</th>
                <th className="px-8 py-6 text-center">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.productFlow.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/30 transition-all">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 text-sm uppercase">{p.nombre}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase mt-1">Ventas: {p.totalSoldUnits} uds</p>
                  </td>
                  <td className="px-8 py-6 text-center font-bold text-slate-400">${p.totalInvestment.toLocaleString()}</td>
                  <td className="px-8 py-6 text-center font-black text-slate-900">${p.totalRevenue.toLocaleString()}</td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-xl font-black text-sm ${p.netFlow >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                      ${p.netFlow.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-flex px-4 py-1.5 rounded-xl font-black text-[10px] bg-slate-100 text-slate-500">
                      {p.roi.toFixed(1)}%
                    </div>
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
