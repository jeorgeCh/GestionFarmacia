
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SalesTimeline: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const [dayTotal, setDayTotal] = useState(0);
  const [currentDateStr, setCurrentDateStr] = useState(new Date().toDateString());

  useEffect(() => {
    fetchTimeline();

    // Verificador de cambio de día para auto-reinicio
    const timer = setInterval(() => {
      const nowStr = new Date().toDateString();
      if (nowStr !== currentDateStr) {
        setCurrentDateStr(nowStr);
        fetchTimeline();
      }
    }, 60000); // Revisar cada minuto

    return () => clearInterval(timer);
  }, [currentDateStr]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      // Cálculo del inicio del día actual (00:00:00 local)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      
      const { data, error } = await supabase
        .from('ventas')
        .select('*, productos(nombre, laboratorio, tipo, precio, precio_unidad, codigo_barras), usuarios(username)')
        .gte('fecha', startOfDay) // FILTRO DE REINICIO DIARIO: Solo ventas de hoy
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
            dinero_recibido: current.dinero_recibido || 0,
            cambio: current.cambio || 0,
            usuario: current.usuarios?.username,
            total_venta: Number(current.total),
            items: [current]
          });
        }
        return acc;
      }, []);

      setTransactions(grouped);
      
      const total = grouped.reduce((sum, t) => sum + t.total_venta, 0);
      setDayTotal(total);

    } catch (err) {
      console.error("Error cargando línea de tiempo:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 15);
      setLoadingMore(false);
    }, 400);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando bitácora de hoy...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-slide-up px-2 sm:px-0">
      
      {/* CABECERA CON TOTAL DEL DÍA */}
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
               <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Ventas de Hoy</h3>
               <span className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg tracking-widest animate-pulse">En Vivo</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">El historial se reinicia automáticamente a las 12:00 AM</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center sm:items-end">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Recaudado Hoy</span>
           <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">${dayTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="relative ml-4 sm:ml-8 border-l-2 border-slate-100 space-y-4 pl-8 sm:pl-12 py-4">
        {transactions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 opacity-60 flex flex-col items-center justify-center">
             <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             </div>
             <p className="font-black uppercase text-[10px] tracking-[0.3em] text-slate-400">No hay ventas registradas hoy</p>
          </div>
        ) : transactions.slice(0, visibleCount).map((t, index) => (
          <div 
            key={t.transaccion_id} 
            onClick={() => setSelectedTransaction(t)}
            className="relative group cursor-pointer animate-in slide-in-from-left-4" 
            style={{ animationDelay: `${index * 30}ms` }}
          >
            {/* Punto en la línea de tiempo */}
            <div className={`absolute -left-[45px] sm:-left-[61px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-2xl border-4 border-white shadow-md z-10 flex items-center justify-center transition-transform group-hover:scale-110 ${t.metodo_pago === 'efectivo' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`}>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                    {new Date(t.fecha).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                  <p className="font-black text-slate-900 text-xs uppercase truncate max-w-[200px]">
                    {t.items[0]?.productos?.nombre} {t.items.length > 1 ? `y ${t.items.length - 1} más...` : ''}
                  </p>
                  <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest mt-0.5">Vendido por: {t.usuario || '---'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Ticket</p>
                  <p className="text-xl font-black text-slate-900 tracking-tighter">${t.total_venta.toLocaleString()}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${t.metodo_pago === 'efectivo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                  {t.metodo_pago}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {transactions.length > visibleCount && (
        <div className="flex justify-center pt-8">
           <button 
             onClick={loadMore} 
             disabled={loadingMore}
             className="px-10 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
           >
             {loadingMore ? (
               <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
             ) : 'Cargar más registros'}
           </button>
        </div>
      )}

      {/* MODAL DETALLE DE TICKET */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Detalle de Ticket</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">ID: {selectedTransaction.transaccion_id.split('-')[0]}</p>
              </div>
              <button onClick={() => setSelectedTransaction(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-6 custom-scrollbar bg-slate-50/50">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hora Venta</span>
                   <span className="text-sm font-black text-slate-900 uppercase">{new Date(selectedTransaction.fecha).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                 </div>
                 <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pago</span>
                   <span className="text-sm font-black text-slate-900 uppercase">{selectedTransaction.metodo_pago}</span>
                 </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Productos Vendidos</span>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                   {selectedTransaction.items.map((item: any, i: number) => (
                     <div key={i} className="p-5 flex justify-between items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 pr-4">
                          <p className="font-black text-slate-900 text-xs uppercase leading-tight mb-0.5">{item.productos?.nombre}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {item.cantidad} {item.es_unidad ? 'unid' : 'caja'}(s) • ${item.total / item.cantidad} c/u
                          </p>
                        </div>
                        <p className="font-black text-slate-900 text-sm tracking-tighter">${item.total.toLocaleString()}</p>
                     </div>
                   ))}
                </div>
              </div>

              <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-4 shadow-xl">
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Recibido</span>
                   <span className="font-bold">${selectedTransaction.dinero_recibido.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Cambio</span>
                   <span className="font-bold text-emerald-400">${selectedTransaction.cambio.toLocaleString()}</span>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Cobrado</span>
                    <span className="text-4xl font-black tracking-tighter leading-none">${selectedTransaction.total_venta.toLocaleString()}</span>
                 </div>
              </div>
            </div>
            
            <div className="p-8 shrink-0 bg-white border-t border-slate-100">
               <button onClick={() => setSelectedTransaction(null)} className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Cerrar Detalle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTimeline;
