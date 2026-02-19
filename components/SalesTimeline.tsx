
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SalesTimeline: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      
      const { data, error } = await supabase
        .from('ventas')
        .select('*, productos(nombre, laboratorio), usuarios(username)')
        .gte('fecha', startOfDay)
        .lte('fecha', endOfDay)
        .order('fecha', { ascending: false });
        
      if (error) throw error;
      
      const grouped = (data || []).reduce((acc: any[], current: any) => {
        const tId = current.transaccion_id || `legacy-${current.id}`;
        const existing = acc.find(item => item.transaccion_id === tId);
        if (existing) {
          existing.items.push(current);
          existing.total_venta += Number(current.total);
        } else {
          acc.push({
            transaccion_id: tId,
            fecha: current.fecha,
            metodo_pago: current.metodo_pago,
            usuario: current.usuarios?.username,
            total_venta: Number(current.total),
            items: [current]
          });
        }
        return acc;
      }, []);
      setTransactions(grouped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-24 text-center flex flex-col items-center gap-6">
      <div className="w-14 h-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em]">Auditando Ventas de Hoy...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24 animate-slide-up">
      <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
        <div className="relative z-10">
          <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800 leading-none">Historial de Hoy</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Bitácora en tiempo real
          </p>
        </div>
        <div className="text-center md:text-right relative z-10">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Caja Registrada</p>
          <p className="text-5xl font-black text-indigo-600 tracking-tighter">${transactions.reduce((s,t) => s+t.total_venta, 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-5">
        {transactions.length === 0 ? (
          <div className="bg-white p-28 rounded-[4rem] border border-dashed border-slate-200 text-center">
            <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">No se registran transacciones el día de hoy</p>
          </div>
        ) : transactions.map(t => (
          <div 
            key={t.transaccion_id} 
            onClick={() => setSelectedTransaction(t)} 
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-center group active:scale-[0.98] gap-6"
          >
            <div className="flex items-center gap-6 w-full">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white font-black shadow-lg shrink-0 transition-transform group-hover:scale-105 ${t.metodo_pago === 'efectivo' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-indigo-400 to-indigo-600'}`}>
                {t.metodo_pago === 'efectivo' ? '$' : '📱'}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">{new Date(t.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="font-black text-slate-800 text-lg uppercase truncate leading-tight">
                  {t.items[0]?.productos?.nombre} {t.items.length > 1 ? `+${t.items.length-1} items` : ''}
                </p>
                <div className="flex items-center gap-3 mt-2">
                   <span className="text-[8px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{t.usuario || 'Operador'}</span>
                   <span className="text-[8px] text-slate-400 font-black uppercase tracking-tighter">REF: {t.transaccion_id.slice(0,8)}</span>
                </div>
              </div>
            </div>
            <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-0 pt-4 sm:pt-0">
              <p className="font-black text-slate-800 text-2xl tracking-tighter leading-none">${t.total_venta.toLocaleString()}</p>
              <div className="flex items-center justify-end gap-2 mt-2">
                 <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full border ${t.metodo_pago === 'efectivo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                   {t.metodo_pago}
                 </span>
                 <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-white/20">
            <div className="p-10 bg-slate-900 text-white relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
               <div className="relative z-10 text-center">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Comprobante Digital</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Voucher #{selectedTransaction.transaccion_id.slice(0,8)}</h3>
                  <p className="text-[9px] text-slate-500 font-bold mt-2 opacity-80">{new Date(selectedTransaction.fecha).toLocaleString()}</p>
               </div>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                {selectedTransaction.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs group">
                    <div className="flex-1">
                      <p className="font-black text-slate-800 uppercase group-hover:text-indigo-600 transition-colors">{item.productos?.nombre}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{item.cantidad} {item.es_unidad ? 'U.' : 'C.'} x ${(item.total/item.cantidad).toLocaleString()}</p>
                    </div>
                    <span className="font-black text-slate-800 text-sm tracking-tight">${item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t-2 border-dashed border-slate-100 flex justify-between items-end">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Total Cobrado</span>
                  <span className="text-4xl font-black text-slate-800 tracking-tighter leading-none">${selectedTransaction.total_venta.toLocaleString()}</span>
              </div>

              <button 
                onClick={() => setSelectedTransaction(null)} 
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all hover:bg-indigo-600"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTimeline;
