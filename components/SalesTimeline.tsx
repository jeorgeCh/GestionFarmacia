
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SalesTimeline: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, productos(nombre, laboratorio, tipo, precio, precio_unidad, codigo_barras), usuarios(username)')
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
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando bitácora financiera...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-slide-up px-2 sm:px-0">
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Historial de Operaciones</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Registro detallado de transacciones</p>
        </div>
        <button 
          onClick={fetchTimeline}
          className="w-full sm:w-auto px-6 py-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Actualizar</span>
        </button>
      </div>

      <div className="relative ml-4 sm:ml-8 border-l-2 border-slate-100 space-y-4 pl-8 sm:pl-12 py-4">
        {transactions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-50 opacity-40 font-black uppercase text-xs tracking-[0.4em]">Sin registros hoy</div>
        ) : transactions.slice(0, visibleCount).map((t, index) => (
          <div 
            key={t.transaccion_id} 
            onClick={() => setSelectedTransaction(t)}
            className="relative group cursor-pointer animate-in slide-in-from-left-4" 
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className={`absolute -left-[45px] sm:-left-[61px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-2xl border-4 border-white shadow-md z-10 flex items-center justify-center transition-transform group-hover:scale-110 ${t.metodo_pago === 'efectivo' ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={t.metodo_pago === 'efectivo' ? "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" : "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"} />
               </svg>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {new Date(t.fecha).toLocaleDateString()} • {new Date(t.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${t.metodo_pago === 'efectivo' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                    {t.metodo_pago}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 uppercase text-xs sm:text-sm truncate">
                  {t.items[0]?.productos?.nombre} 
                  {t.items.length > 1 && <span className="text-indigo-600 ml-2 text-[10px] font-bold">+ {t.items.length - 1} productos adicionales</span>}
                </h4>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-tight">Cajero: <span className="text-slate-600">{t.usuario || 'Sistema'}</span></p>
              </div>
              <div className="text-left sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-50 shrink-0">
                <p className="text-2xl font-black text-slate-900 tracking-tighter">${t.total_venta.toLocaleString()}</p>
                <p className="text-[8px] font-black text-slate-300 uppercase mt-0.5">ID: {t.transaccion_id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {transactions.length > visibleCount && (
        <div className="flex justify-center pt-6">
          <button 
            onClick={loadMore} 
            disabled={loadingMore}
            className="px-12 py-5 bg-white border-2 border-slate-100 rounded-3xl font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? 'Sincronizando...' : 'Cargar más registros'}
          </button>
        </div>
      )}

      {/* MODAL DE RECIBO REDISEÑADO - ALINEADO ARRIBA */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 bg-slate-950/90 backdrop-blur-xl p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-[400px] rounded-[1.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh] relative mb-10">
            
            {/* Cabecera del Ticket */}
            <div className="bg-slate-50 p-8 text-center border-b-2 border-dashed border-slate-200 shrink-0 relative">
               <button onClick={() => setSelectedTransaction(null)} className="absolute top-4 right-4 w-8 h-8 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 transition-all shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
               </button>
               
               <div className="mb-4">
                  <span className="block font-black text-xl tracking-tighter text-slate-900 uppercase">Droguería Pro</span>
                  <span className="text-[8px] font-black uppercase text-indigo-600 tracking-[0.3em]">Copia de Cliente</span>
               </div>
               
               <div className="space-y-1">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(selectedTransaction.fecha).toLocaleDateString()} — {new Date(selectedTransaction.fecha).toLocaleTimeString()}</p>
                 <p className="text-[9px] text-slate-900 font-black uppercase">Ref: #{selectedTransaction.transaccion_id.slice(0, 12).toUpperCase()}</p>
               </div>
            </div>

            {/* Cuerpo del Ticket */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  <span>Detalle de Ítem</span>
                  <span>Total</span>
                </div>
                
                {selectedTransaction.items.map((item: any, idx: number) => (
                  <div key={idx} className="space-y-1 py-2 border-b border-slate-50 last:border-0">
                    <p className="font-black text-slate-900 text-[11px] uppercase leading-tight">{item.productos?.nombre}</p>
                    <div className="flex justify-between items-end">
                       <p className="text-[10px] text-slate-400 font-bold uppercase">
                         {item.cantidad} {item.es_unidad ? 'UNIDAD(ES)' : 'CAJA(S)'} x ${Number(item.total / item.cantidad).toLocaleString()}
                       </p>
                       <p className="font-black text-slate-900 text-[12px] font-mono tracking-tighter">${Number(item.total).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totales y Pago */}
              <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-100 space-y-6">
                 <div className="flex justify-between items-center px-1">
                   <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Total a Pagar</span>
                   <span className="text-4xl font-black text-slate-900 tracking-tighter">${selectedTransaction.total_venta.toLocaleString()}</span>
                 </div>

                 <div className="space-y-3">
                   {selectedTransaction.metodo_pago === 'efectivo' ? (
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Recibido</p>
                          <p className="font-black text-slate-900 text-sm font-mono">${Number(selectedTransaction.dinero_recibido).toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                          <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">Vueltas</p>
                          <p className="font-black text-emerald-700 text-sm font-mono">${Number(selectedTransaction.cambio).toLocaleString()}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-4 rounded-2xl bg-indigo-600 text-white text-center shadow-lg shadow-indigo-200">
                        <p className="text-[9px] font-black uppercase tracking-widest">Pago con Transferencia</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 mt-0.5">Operación Aprobada</p>
                     </div>
                   )}
                 </div>
              </div>

              {/* Pie de Recibo */}
              <div className="mt-10 text-center space-y-4">
                <div className="inline-block p-4 border-2 border-slate-100 rounded-3xl">
                   <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Atendido por: {selectedTransaction.usuario || 'Sistema'}</p>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Gracias por su compra</p>
                </div>
              </div>
            </div>
            
            {/* Botón de Cierre con efecto de corte */}
            <div className="p-8 pt-4 bg-white relative">
               <div className="absolute -top-3 left-0 right-0 flex justify-around opacity-10">
                  {[...Array(20)].map((_,i) => <div key={i} className="w-2 h-2 bg-slate-900 rotate-45"></div>)}
               </div>
               <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-emerald-600 transition-all active:scale-95 shadow-xl"
              >
                Cerrar Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTimeline;
