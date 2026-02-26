
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Usuario } from '../types';

interface TurnoContextType {
  activeTurno: any | null;
  isTurnoLoading: boolean;
  showTurnoModal: boolean;
  startTurno: (initialAmount: number) => Promise<void>;
  closeTurno: (notes: string) => Promise<void>;
  checkActiveTurno: () => void;
  setShowTurnoModal: (show: boolean) => void;
}

const TurnoContext = createContext<TurnoContextType | undefined>(undefined);

export const TurnoProvider: React.FC<{ user: Usuario, children: React.ReactNode }> = ({ user, children }) => {
  const [activeTurno, setActiveTurno] = useState<any | null>(null);
  const [isTurnoLoading, setIsTurnoLoading] = useState(true);
  const [showTurnoModal, setShowTurnoModal] = useState(false);

  const checkActiveTurno = async () => {
    setIsTurnoLoading(true);
    try {
      const { data: turno, error } = await supabase
        .from('turnos')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('estado', 'ABIERTO')
        .single();
      
      if (turno && !error) {
        setActiveTurno(turno);
      } else {
        setActiveTurno(null);
        if (Number(user.role_id) === 2) { // Vendedor
          setShowTurnoModal(true);
        }
      }
    } catch (e) {
        setActiveTurno(null);
        if (Number(user.role_id) === 2) {
          setShowTurnoModal(true);
        }
    } finally {
      setIsTurnoLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkActiveTurno();
    }
  }, [user]);

  const startTurno = async (initialAmount: number) => {
    const { data: newTurno, error } = await supabase
      .from('turnos')
      .insert({ 
        usuario_id: user.id, 
        monto_inicial: initialAmount 
      })
      .select()
      .single();

    if (error) throw error;
    setActiveTurno(newTurno);
    setShowTurnoModal(false);
  };

  const closeTurno = async (notes: string) => {
    if (!activeTurno) return;

    // This logic needs access to sales data, might need to be passed in or handled differently
    // For now, let's assume we can calculate it or it's passed
    const finalAmount = activeTurno.monto_inicial; // Placeholder

    const { error } = await supabase
      .from('turnos')
      .update({ 
        monto_final: finalAmount,
        estado: 'CERRADO',
        fecha_cierre: new Date().toISOString(),
        notas: notes
      })
      .eq('id', activeTurno.id);

    if (error) throw error;
    setActiveTurno(null);
    setShowTurnoModal(true);
  };

  return (
    <TurnoContext.Provider value={{ activeTurno, isTurnoLoading, showTurnoModal, startTurno, closeTurno, checkActiveTurno, setShowTurnoModal }}>
      {children}
    </TurnoContext.Provider>
  );
};

export const useTurno = () => {
  const context = useContext(TurnoContext);
  if (context === undefined) {
    throw new Error('useTurno must be used within a TurnoProvider');
  }
  return context;
};
