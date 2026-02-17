
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
      const { data, error } = await supabase
        .from('ventas')
        .select('*, productos(nombre, laboratorio, tipo, precio, precio_unidad, codigo_barras), usuarios(username)')
        .order('fecha', { ascending: false });
      
      if (error) throw error;
      
      // Lógica de Agrupación robusta por transaccion_id
      const grouped = (data || []).reduce((acc: any[], current: any) => {
        // Fallback para ventas viejas que no tienen ID de transacción
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

      setTransactions(grouped.slice(0, 50));
    } catch (err) {
      console.error("Error cargando línea de tiempo:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Bitácora...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Historial de Ventas</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ventas agrupadas por factura</p>
        </div>
        <button 
          onClick={fetchTimeline}
          className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {transactions.length === 0 ? (
          <div className="text-center py-20 opacity-30 font-black uppercase text-xs tracking-[0.4em]">No hay ventas hoy</div>
        ) : transactions.map((t, index) => (
          <div 
            key={t.transaccion_id} 
            onClick={() => setSelectedTransaction(t)}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in slide-in-from-bottom-4 cursor-pointer" 
            style={{ animationDelay: `${index * 40}ms` }}
          >
            {/* Nodo Cronológico */}
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 group-hover:scale-110 transition-transform ${t.metodo_pago === 'efectivo' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
               <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
            </div>

            {/* Tarjeta de Venta Unificada */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm group-hover:shadow-md transition-all group-hover:border-indigo-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-slate-400 uppercase text-[8px] tracking-widest">
                   {new Date(t.fecha).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-lg ${t.metodo_pago === 'efectivo' ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50'}`}>
                  {t.metodo_pago}
                </span>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="max-w-[70%]">
                  <h4 className="font-black text-slate-900 uppercase text-[11px] truncate">
                    {t.items[0]?.productos?.nombre} 
                    {t.items.length > 1 && <span className="text-indigo-600 ml-1"> + {t.items.length - 1} prods.</span>}
                  </h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Atendido por: {t.usuario || '---'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-slate-900 tracking-tighter">${t.total_venta.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Detalle Compacto (Lista todos los productos de la misma venta) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-[320px] rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 p-6 text-center border-b border-dashed border-slate-200 shrink-0">
               <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
               </div>
               <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Resumen de Cobro</h4>
               <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Factura Grupal</p>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
              <div className="space-y-2">
                {selectedTransaction.items.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div className="max-w-[70%]">
                      <p className="font-black text-slate-900 text-[10px] uppercase truncate">{item.productos?.nombre}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">
                        {item.cantidad} {item.es_unidad ? 'unid' : 'cj'} x ${(item.total / item.cantidad).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-black text-slate-900 text-[11px] shrink-0">${Number(item.total).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3">
                 <div className="flex justify-between items-center px-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gran Total</span>
                   <span className="text-xl font-black text-slate-900 tracking-tighter">${selectedTransaction.total_venta.toLocaleString()}</span>
                 </div>

                 {selectedTransaction.metodo_pago === 'efectivo' ? (
                   <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[7px] font-black text-emerald-400 uppercase">Recibido</p>
                          <p className="font-black text-slate-900 text-[11px]">${Number(selectedTransaction.dinero_recibido).toLocaleString()}</p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="text-[7px] font-black text-emerald-400 uppercase">Cambio</p>
                          <p className="font-black text-emerald-600 text-[11px]">${Number(selectedTransaction.cambio).toLocaleString()}</p>
                        </div>
                   </div>
                 ) : (
                   <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                     <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Pago por Transferencia</span>
                   </div>
                 )}
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-900 text-white rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-black text-[10px] uppercase">
                   {selectedTransaction.usuario?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[7px] font-bold uppercase opacity-60 mb-0.5 leading-none">Cajero</p>
                  <p className="text-[9px] font-black uppercase truncate leading-none">{selectedTransaction.usuario || 'Sistema'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-bold uppercase opacity-60 mb-0.5 leading-none">Hora</p>
                  <p className="text-[8px] font-black leading-none">{new Date(selectedTransaction.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cerrar Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTimeline;
