
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
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

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

  const getViewTitle = () => {
    switch(view) {
      case 'pos': return 'Punto de Venta';
      case 'income': return 'Entrada de Mercancía';
      case 'inventory': return 'Control de Inventario';
      case 'providers': return 'Gestión de Proveedores';
      case 'users': return 'Gestión de Usuarios';
      case 'discounts': return 'Gestión de Descuentos';
      default: return 'Panel de Control';
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} currentView={view} setView={setView} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {getViewTitle()}
            </h1>
            <p className="text-sm text-slate-400 font-medium">Hola, {user.username} 👋</p>
          </div>
          <div className="flex items-center gap-4">
             <div className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest ${user.role_id === 1 ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
               {user.role_id === 1 ? 'Administrador' : 'Vendedor'}
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
             </div>
          </div>
        </header>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
