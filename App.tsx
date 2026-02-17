
import React, { useState, useEffect } from 'react';
import { Usuario } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Income from './components/Income';
import Providers from './components/Providers';
import Users from './components/Users';
import Discounts from './components/Discounts';

export type View = 'dashboard' | 'inventory' | 'pos' | 'income' | 'providers' | 'users' | 'discounts';

const App: React.FC = () => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('drogueria_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    setLoading(false);
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
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard user={user} />;
      case 'inventory': return <Inventory user={user} />;
      case 'pos': return <POS user={user} />;
      case 'income': return <Income user={user} />;
      case 'providers': return <Providers />;
      case 'discounts': return user.role_id === 1 ? <Discounts /> : <div className="p-8 text-center text-rose-500 font-bold">Acceso Denegado</div>;
      case 'users': return user.role_id === 1 ? <Users /> : <div className="p-8 text-center text-rose-500 font-bold">Acceso Denegado</div>;
      default: return <Dashboard user={user} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} currentView={view} setView={setView} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
        <header className="mb-6 flex justify-between items-center bg-white p-5 lg:p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {view === 'pos' ? 'Ventas' : view === 'income' ? 'Ingresos' : view === 'inventory' ? 'Inventario' : 'Panel'}
            </h1>
            <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest">Hola, {user.username} 👋</p>
          </div>
          <div className="flex items-center gap-3">
             <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${user.role_id === 1 ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
               {user.role_id === 1 ? 'Admin' : 'POS'}
             </div>
             <div className="lg:hidden">
               <button onClick={handleLogout} className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg>
               </button>
             </div>
          </div>
        </header>

        {renderView()}
      </main>

      {/* Navegación Móvil (Solo Visible en pantallas pequeñas) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <button onClick={() => setView('dashboard')} className={`p-2 rounded-xl ${view === 'dashboard' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        </button>
        <button onClick={() => setView('pos')} className={`p-2 rounded-xl ${view === 'pos' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </button>
        <button onClick={() => setView('inventory')} className={`p-2 rounded-xl ${view === 'inventory' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </button>
        <button onClick={() => setView('income')} className={`p-2 rounded-xl ${view === 'income' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/></svg>
        </button>
      </nav>
    </div>
  );
};

export default App;
