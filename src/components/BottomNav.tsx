import React from 'react';
import { Home, Share2, Wallet, User } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export type TabType = 'home' | 'invite' | 'wallet' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const handleSelect = (tab: TabType) => {
    triggerHaptic('light');
    onTabChange(tab);
  };

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'invite',
      label: 'Invite',
      icon: <Share2 className="w-5 h-5" />,
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-[420px] bg-white/95 backdrop-blur-xl rounded-full py-2 px-3 shadow-2xl shadow-sky-950/30 flex items-center justify-between border border-white/80">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`flex flex-col items-center justify-center transition-all duration-200 select-none ${
                isActive
                  ? 'bg-[#38bdf8]/20 text-[#0284c7] px-5 py-1.5 rounded-full font-bold'
                  : 'text-slate-500 hover:text-slate-700 px-3 py-1 font-medium'
              }`}
            >
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110 text-[#0284c7]' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[11px] leading-tight mt-0.5 tracking-tight ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
