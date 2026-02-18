
import React, { useState, useEffect } from 'react';
import { Usuario } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Income from './components/Income';
import Providers from './components/Providers';
import Discounts from './components/Discounts';
import Analytics from './components/Analytics';
import SalesTimeline from './components/SalesTimeline';

export type View = 'dashboard' | 'inventory' | 'pos' | 'income' | 'providers' | 'discounts' | 'analytics' | 'timeline';

const App: React.FC = () => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('drogueria_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          setUser(parsed);
        } else {
          localStorage.removeItem('drogueria_user');
        }
      }
    } catch (err) {
      console.error("Error cargando sesión:", err);
      localStorage.removeItem('drogueria_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: Usuario) => {
    setUser(userData);
    localStorage.setItem('drogueria_user', JSON.stringify(userData));
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('drogueria_user');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Iniciando Sistema...</p>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  const renderView = () => {
    if (!user) return null;
    switch (view) {
      case 'dashboard': return <Dashboard user={user} />;
      case 'inventory': return <Inventory user={user} />;
      case 'pos': return <POS user={user} />;
      case 'income': return <Income user={user} />;
      case 'providers': return <Providers />;
      case 'discounts': return user.role_id === 1 ? <Discounts /> : <div className="p-12 text-center text-rose-500 font-black uppercase tracking-widest text-xs">Acceso Denegado</div>;
      case 'analytics': return user.role_id === 1 ? <Analytics /> : <div className="p-12 text-center text-rose-500 font-black uppercase tracking-widest text-xs">Acceso Denegado</div>;
      case 'timeline': return user.role_id === 1 ? <SalesTimeline /> : <div className="p-12 text-center text-rose-500 font-black uppercase tracking-widest text-xs">Acceso Denegado</div>;
      default: return <Dashboard user={user} />;
    }
  };

  const isAdmin = user.role_id === 1;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} currentView={view} setView={setView} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
        <header className="mb-6 flex justify-between items-center bg-white p-5 lg:p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {view === 'pos' ? 'Ventas' : view === 'income' ? 'Ingresos' : view === 'inventory' ? 'Inventario' : view === 'discounts' ? 'Descuentos' : view === 'providers' ? 'Proveedores' : view === 'analytics' ? 'Rentabilidad' : view === 'timeline' ? 'Historial de Ventas' : 'Panel'}
            </h1>
            <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest">Hola, {user.username || 'Usuario'} 👋</p>
          </div>
          <div className="flex items-center gap-3">
             <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
               {isAdmin ? 'Admin' : 'POS'}
             </div>
             <div className="lg:hidden">
               <button onClick={handleLogout} className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg>
               </button>
             </div>
          </div>
        </header>

        <div className="pb-24 lg:pb-0">
          {renderView()}
        </div>
      </main>

      {/* Navegación Móvil Mejorada con Scroll Horizontal */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 py-3 flex items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-md overflow-x-auto custom-scrollbar px-4 gap-6 no-scrollbar">
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'dashboard' ? 'text-slate-900 font-black' : 'text-slate-300'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          <span className="text-[7px] uppercase tracking-tighter">Panel</span>
        </button>
        
        <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'pos' ? 'text-emerald-600 font-black' : 'text-slate-300'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          <span className="text-[7px] uppercase tracking-tighter">POS</span>
        </button>

        <button onClick={() => setView('inventory')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'inventory' ? 'text-indigo-600 font-black' : 'text-slate-300'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          <span className="text-[7px] uppercase tracking-tighter">Stock</span>
        </button>

        <button onClick={() => setView('income')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'income' ? 'text-amber-600 font-black' : 'text-slate-300'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/></svg>
          <span className="text-[7px] uppercase tracking-tighter">Carga</span>
        </button>

        {isAdmin && (
           <>
            <button onClick={() => setView('analytics')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'analytics' ? 'text-indigo-600 font-black' : 'text-slate-300'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <span className="text-[7px] uppercase tracking-tighter">Balance</span>
            </button>
            <button onClick={() => setView('discounts')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'discounts' ? 'text-rose-600 font-black' : 'text-slate-300'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              <span className="text-[7px] uppercase tracking-tighter">Ofertas</span>
            </button>
            <button onClick={() => setView('timeline')} className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${view === 'timeline' ? 'text-indigo-600 font-black' : 'text-slate-300'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className="text-[7px] uppercase tracking-tighter">Ventas</span>
            </button>
          </>
        )}
      </nav>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
