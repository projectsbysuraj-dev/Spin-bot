import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { TabType } from './BottomNav';
import { WithdrawModal } from './WithdrawModal';
import { openExternalOrTelegramLink } from '../services/telegram';
import { AppLogo } from './AppLogo';

interface ProfileScreenProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: TabType) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  settings,
  onNavigate,
}) => {
  const [showWithdraw, setShowWithdraw] = useState(false);

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in">
      {/* Profile Card matching Screenshot 4 */}
      <div className="w-full bg-white rounded-[26px] p-5 shadow-xl shadow-sky-950/10 border border-white flex items-center gap-4">
        {/* App Logo Avatar */}
        <div className="relative shrink-0">
          <AppLogo className="w-16 h-16 filter drop-shadow-md" />
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h2 className="font-['Outfit'] font-black text-xl text-slate-800 tracking-tight leading-tight truncate">
            {user.name}
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 mb-1.5 font-mono">
            User ID: #{user.id}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-[#0284c7] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider">
              <ShieldCheck className="w-3 h-3 text-[#0284c7]" />
              <span>VERIFIED TELEGRAM USER</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Quick Actions */}
      <div className="w-full">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="w-1.5 h-5 bg-[#38bdf8] rounded-full"></span>
          <h2 className="font-['Outfit'] font-extrabold text-white text-lg tracking-tight">
            Quick Actions
          </h2>
        </div>

        {/* Action List matching user panel without any admin button */}
        <div className="bg-white rounded-[26px] shadow-xl shadow-sky-950/10 border border-white overflow-hidden divide-y divide-slate-100">
          {/* Action 1: Lucky Spin Wheel */}
          <button
            onClick={() => onNavigate('home')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🎡</span>
              <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                Lucky Spin Wheel
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 2: Refer Friends */}
          <button
            onClick={() => onNavigate('invite')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🤝</span>
              <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                Refer Friends (1 Refer = 1 Spin)
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 3: Withdraw Cash */}
          <button
            onClick={() => setShowWithdraw(true)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💸</span>
              <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                Withdraw Cash (Bank / UPI)
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 4: Official Telegram Channel */}
          <button
            onClick={() => openExternalOrTelegramLink(settings.telegramChannelUrl)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💬</span>
              <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                Official Telegram Channel
              </span>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 5: Contact for cheap bot website app creation */}
          <button
            onClick={() => openExternalOrTelegramLink('https://t.me/lakhsmiiiii')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">🚀</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 truncate">
                  Contact for cheap bot website app creation
                </span>
                <span className="text-[11px] font-bold text-sky-600">
                  @lakhsmiiiii
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 6: Any problem DM karo */}
          <button
            onClick={() => openExternalOrTelegramLink('https://t.me/Rohit79041')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">🆘</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 truncate">
                  Any problem dm kro
                </span>
                <span className="text-[11px] font-bold text-amber-600">
                  @Rohit79041
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {showWithdraw && (
        <WithdrawModal
          user={user}
          settings={settings}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => setShowWithdraw(false)}
        />
      )}
    </div>
  );
};

export default ProfileScreen;
