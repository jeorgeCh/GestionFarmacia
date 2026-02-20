
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
  const isCajero = !isAdmin && !isSuperUser;

  let navItems = [
    { id: 'dashboard', label: 'Panel', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
    { id: 'pos', label: 'Vender', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg> },
  ];

  if (isAdmin) {
    navItems = [
      ...navItems,
      { id: 'inventory', label: 'Stock', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> },
    ];
  }
  
  if (isSuperUser) {
      navItems.push({ id: 'superadmin', label: 'Super', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> });
  }

  // Limit to 4 items for mobile view
  navItems = navItems.slice(0, 4);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 shadow-lg z-50">
      <div className="flex justify-around items-center h-20">
        {navItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id as View)}
            className={`flex flex-col items-center justify-center text-center transition-all w-full h-full ${
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
            className={`flex flex-col items-center justify-center text-center transition-all w-full h-full text-slate-500 hover:text-rose-500`}>
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
