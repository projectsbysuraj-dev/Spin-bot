import React from 'react';
import { AppSettings, ThemeSettings, UserProfile } from '../types';
import { AppLogo } from './AppLogo';

interface HeaderProps {
  user: UserProfile;
  settings: AppSettings;
  theme: ThemeSettings;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, settings, onOpenAdmin }) => {
  const [tapCount, setTapCount] = React.useState(0);

  const handleLogoClick = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 3) {
      setTapCount(0);
      if (onOpenAdmin) {
        onOpenAdmin();
      } else if (typeof window !== 'undefined') {
        window.location.hash = '#admin';
      }
    }
  };

  return (
    <header className="w-full flex flex-col items-center pt-2 pb-1 relative z-20">
      {/* Main Top Header Bar */}
      <div className="w-full flex items-center justify-between px-1">
        {/* Left: Brand Icon + Title */}
        <div className="flex items-center gap-2.5">
          {/* Logo badge with the full quality Instant Cashback Logo */}
          <div
            onClick={handleLogoClick}
            className="relative group cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
            title="Rohit Giveaway"
          >
            <AppLogo className="w-[52px] h-[52px] filter drop-shadow-lg" />
          </div>

          <div>
            <h1 className="font-['Outfit'] font-black text-white text-xl tracking-tight leading-tight drop-shadow-sm">
              {settings.appTitle || 'Rohit Giveaway'}
            </h1>
          </div>
        </div>

        {/* Right: Balance Pill matching screenshot */}
        <div className="flex items-center bg-[#0088cc]/30 backdrop-blur-md border border-white/40 rounded-full px-4 py-1.5 shadow-sm shadow-black/10">
          <div className="w-5 h-5 rounded-full bg-[#0099ff] text-white flex items-center justify-center font-bold text-xs mr-1.5 shadow-sm">
            ₹
          </div>
          <span className="font-['Outfit'] font-black text-white text-base tracking-tight">
            {user.balance.toFixed(2)}
          </span>
        </div>
      </div>
    </header>
  );
};
