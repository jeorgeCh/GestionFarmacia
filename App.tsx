
import React, { useState, useEffect } from 'react';
import { Usuario } from './types';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Income from './components/Income';
import Providers from './components/Providers';
import Discounts from './components/Discounts';
import SalesTimeline from './components/SalesTimeline';
import Analytics from './components/Analytics';
import SuperAdmin from './components/SuperAdmin';

export type View = 'dashboard' | 'inventory' | 'pos' | 'income' | 'providers' | 'discounts' | 'timeline' | 'analytics' | 'superadmin';

const App: React.FC = () => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPersistedSession();
  }, []);

  const checkPersistedSession = async () => {
    try {
      const savedUser = localStorage.getItem('drogueria_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          const { data, error } = await supabase.from('usuarios').select('id, role_id, activo, username').eq('id', parsed.id).maybeSingle();
          if (error || !data || !data.activo) {
            handleLogout();
          } else {
            setUser({ ...parsed, ...data });
          }
        }
      }
    } catch (err) {
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: Usuario) => {
    setUser(userData);
    localStorage.setItem('drogueria_user', JSON.stringify(userData));
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('drogueria_user');
    setView('dashboard');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando...</p>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  const userRole = Number(user.role_id);
  const isSuperUser = userRole === 3;
  const isAdmin = userRole === 1 || isSuperUser;
  const isSeller = userRole === 2;

  const renderView = () => {
    const deniedAccess = <div className="p-12 text-center text-rose-500 font-black uppercase tracking-widest text-xs">Acceso Denegado</div>;

    switch (view) {
      case 'dashboard': return <Dashboard user={user} setView={setView} />;
      case 'pos': return <POS user={user} />;
      case 'inventory': return isAdmin || isSeller ? <Inventory user={user} setView={setView} /> : deniedAccess;
      case 'income': return isAdmin || isSeller ? <Income user={user} /> : deniedAccess;
      case 'analytics': return isAdmin ? <Analytics /> : deniedAccess;
      case 'providers': return isAdmin ? <Providers /> : deniedAccess;
      case 'discounts': return isAdmin ? <Discounts /> : deniedAccess;
      case 'timeline': return isAdmin ? <SalesTimeline /> : deniedAccess;
      case 'superadmin': return isSuperUser ? <SuperAdmin /> : deniedAccess;
      default: return <Dashboard user={user} setView={setView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} currentView={view} setView={setView} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
        <header className="mb-6 flex justify-between items-center bg-white p-5 lg:p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">
              {view.replace('_', ' ')}
            </h1>
            <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Hola, {user.username || 'Usuario'} 👋</p>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hidden lg:block ${isSuperUser ? 'bg-violet-50 text-violet-600 border border-violet-100' : isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {isSuperUser ? 'Super Usuario' : isAdmin ? 'Admin' : 'Operador'}
          </div>
        </header>

        <div className="pb-28 lg:pb-0">
          {renderView()}
        </div>
      </main>

      <MobileNav user={user} currentView={view} setView={setView} onLogout={handleLogout} />
    </div>
  );
};

export default App;
