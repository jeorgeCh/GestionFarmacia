
import React from 'react';
import { View } from '../App';
import { Usuario } from '../types';

interface MobileNavProps {
  user: Usuario;
  currentView: View;
  setView: (view: View) => void;
  onLogout: () => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ user, currentView, setView, onLogout }) => {
  const isSuperUser = Number(user.role_id) === 3;
  const isAdmin = Number(user.role_id) === 1 || isSuperUser;

  const allMenuItems = [
    { id: 'dashboard', label: 'Panel', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
    { id: 'pos', label: 'Vender', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg> },
    { id: 'inventory', label: 'Stock', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> },
    { id: 'income', label: 'Ingresos', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/></svg> }
  ];

  const adminItems = [
    { id: 'analytics', label: 'Análisis', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
    { id: 'timeline', label: 'Historial', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    { id: 'providers', label: 'Proveedores', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { id: 'discounts', label: 'Descuentos', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg> },
  ];
  
  let navItems = allMenuItems;
  if (isAdmin) {
      navItems = [...allMenuItems, ...adminItems];
  }

  if (isSuperUser) {
    navItems.push({ id: 'superadmin', label: 'Super', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> });
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 shadow-lg z-50">
      <div className="flex justify-between items-center h-20 overflow-x-auto custom-scrollbar px-2">
        {navItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id as View)}
            className={`flex flex-col items-center justify-center text-center transition-all flex-shrink-0 w-24 h-full ${
              currentView === item.id ? 'text-emerald-400' : 'text-slate-500'
            }`}>
            <div className={`p-2 rounded-full transition-all ${currentView === item.id ? 'bg-emerald-500/10' : ''}`}>
                {item.icon}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tighter uppercase">{item.label}</span>
          </button>
        ))}
         <button 
            onClick={onLogout}
            className={`flex flex-col items-center justify-center text-center transition-all flex-shrink-0 w-24 h-full text-slate-500 hover:text-rose-500`}>
            <div className={`p-2 rounded-full transition-all`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tighter uppercase">Salir</span>
          </button>
      </div>
    </div>
  );
};

export default MobileNav;
