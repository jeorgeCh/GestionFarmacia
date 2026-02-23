
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Ajustamos la interfaz para usar el alias 'user' en lugar de 'usuarios'
interface TurnoConUsuario {
  id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  monto_final: number | null;
  estado: string;
  user: { // <-- Cambio de 'usuarios' a 'user'
    username: string;
  } | null;
}

const HistorialTurnos: React.FC = () => {
  const [turnos, setTurnos] = useState<TurnoConUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTurnos();
  }, []);

  const fetchTurnos = async () => {
    setLoading(true);
    setError(null);
    try {
      // Aplicamos un alias a la relación para evitar conflictos
      const { data, error } = await supabase
        .from('turnos')
        .select(`
          id,
          fecha_apertura,
          fecha_cierre,
          monto_inicial,
          monto_final,
          estado,
          user:usuarios (
            username
          )
        `)
        .order('fecha_apertura', { ascending: false });

      if (error) {
        throw error;
      }
      setTurnos(data as any[] || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching shift history:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
    return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Pendiente';
    return new Date(dateString).toLocaleString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-10 bg-red-50 text-red-700 p-4 rounded-xl">Error al cargar el historial: {error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 animate-slide-up">
      <div className="bg-white p-6 sm:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Historial de Cortes de Caja</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registros de todos los turnos del sistema</p>
          </div>
          <button
            onClick={fetchTurnos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            Refrescar
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50/70">
              <tr>
                <th scope="col" className="px-6 py-3 rounded-l-lg">Usuario</th>
                <th scope="col" className="px-6 py-3">Apertura</th>
                <th scope="col" className="px-6 py-3 text-right">Monto Inicial</th>
                <th scope="col" className="px-6 py-3">Cierre</th>
                <th scope="col" className="px-6 py-3 text-right">Monto Final</th>
                <th scope="col" className="px-6 py-3 text-center rounded-r-lg">Estado</th>
              </tr>
            </thead>
            <tbody>
              {turnos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs uppercase font-bold tracking-widest">No se han encontrado registros de turnos.</td>
                </tr>
              ) : (
                turnos.map((turno) => (
                  <tr key={turno.id} className="bg-white border-b last:border-b-0 hover:bg-slate-50/50">
                    {/* Ajustamos la celda para usar el alias 'user' */}
                    <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">{turno.user?.username || 'N/A'}</td>
                    <td className="px-6 py-4 text-xs">{formatDate(turno.fecha_apertura)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 text-right">{formatCurrency(turno.monto_inicial)}</td>
                    <td className="px-6 py-4 text-xs">{formatDate(turno.fecha_cierre)}</td>
                    <td className="px-6 py-4 font-bold text-rose-600 text-right">{formatCurrency(turno.monto_final)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 inline-flex text-[10px] leading-4 font-black uppercase tracking-wider rounded-full ${
                        turno.estado === 'ABIERTO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {turno.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistorialTurnos;
