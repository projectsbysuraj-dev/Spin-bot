import React, { useState, useEffect } from 'react';
import { Send, Check, Copy, Users, RefreshCw } from 'lucide-react';
import { AppSettings, UserProfile, Transaction } from '../types';
import { getReferralTransactions, subscribeRealtime } from '../services/store';
import { triggerHaptic, openExternalOrTelegramLink } from '../services/telegram';

interface InviteScreenProps {
  user: UserProfile;
  settings: AppSettings;
}

export const InviteScreen: React.FC<InviteScreenProps> = ({ user, settings }) => {
  const [copiedBot, setCopiedBot] = useState(false);
  const [referralHistory, setReferralHistory] = useState<Transaction[]>(getReferralTransactions(user.id));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const botUsername = settings.botUsername || 'RohitGiveawayBot';
  const botReferralLink = `https://t.me/${botUsername}?start=ref_${user.id}`;

  useEffect(() => {
    const unsub = subscribeRealtime(() => {
      setReferralHistory(getReferralTransactions(user.id));
    });
    return unsub;
  }, [user.id]);

  const handleCopyBot = () => {
    triggerHaptic('light');
    try {
      navigator.clipboard.writeText(botReferralLink);
      setCopiedBot(true);
      setTimeout(() => setCopiedBot(false), 2000);
    } catch (e) {
      // fallback
    }
  };

  const handleShareTelegram = () => {
    triggerHaptic('medium');
    const text = encodeURIComponent(
      `🎁 Join ${settings.appTitle || 'Rohit Giveaway'}! Spin the Lucky Wheel to win instant real cash directly into your UPI/Bank! 100% Guaranteed Cash Win!`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botReferralLink)}&text=${text}`;
    openExternalOrTelegramLink(shareUrl);
  };

  const handleRefreshData = () => {
    triggerHaptic('light');
    setIsRefreshing(true);
    setReferralHistory(getReferralTransactions(user.id));
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in">
      {/* Top Banner Card */}
      <div className="w-full bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] rounded-[26px] p-6 text-white text-center shadow-xl shadow-sky-950/20 border border-white/20">
        <div className="text-4xl mb-2 filter drop-shadow">🤝</div>
        <h2 className="font-['Outfit'] font-black text-2xl tracking-tight leading-tight mb-1.5">
          Invite & Earn Lucky Spins
        </h2>
        <p className="text-sky-100 text-xs font-medium leading-relaxed max-w-[290px] mx-auto">
          Get <strong>1 Lucky Spin</strong> for every friend who joins! Plus, every friend also gets <strong>1 Free Sign Up Spin</strong>!
        </p>
      </div>

      {/* Referral Link Card */}
      <div className="w-full bg-white rounded-[26px] p-5 shadow-xl shadow-sky-950/10 border border-white flex flex-col gap-3.5">
        {/* Header with live sync */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            YOUR REFERRAL LINK
          </span>
          <button
            onClick={handleRefreshData}
            className="flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
            <span>Fetch Data</span>
          </button>
        </div>

        {/* Telegram Bot Link */}
        <div className="w-full">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
            <span className="flex items-center gap-1">
              <Send className="w-3 h-3 text-[#0284c7]" />
              <span>Telegram Bot Referral Link</span>
            </span>
          </div>
          <div className="w-full border border-sky-300 bg-sky-50/70 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0369a1] truncate font-mono select-all">
              {botReferralLink}
            </span>
            <button
              onClick={handleCopyBot}
              className={`font-['Outfit'] font-black text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                copiedBot
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0284c7] hover:bg-[#0369a1] text-white active:scale-95 shadow-sm'
              }`}
            >
              {copiedBot ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBot ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
        </div>

        {/* Big Telegram Share Button */}
        <button
          onClick={handleShareTelegram}
          className="w-full bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Send className="w-4 h-4 fill-white" />
          <span>Invite Friends on Telegram 🚀</span>
        </button>
      </div>

      {/* Referral Statistics Section */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-[#38bdf8] rounded-full"></span>
            <h2 className="font-['Outfit'] font-extrabold text-white text-lg tracking-tight">
              Referral Statistics
            </h2>
          </div>
          <span className="text-xs font-bold text-sky-200">
            Realtime Synced
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Card 1: Friends Joined */}
          <div className="bg-white rounded-[22px] p-4 text-center shadow-lg shadow-sky-950/5 border border-white">
            <span className="font-['Outfit'] font-black text-3xl text-[#0284c7] block leading-tight">
              {user.friendsJoined || 0}
            </span>
            <span className="text-xs text-slate-500 font-semibold tracking-tight mt-1 block">
              Friends Joined
            </span>
          </div>

          {/* Card 2: Spins Earned */}
          <div className="bg-white rounded-[22px] p-4 text-center shadow-lg shadow-sky-950/5 border border-white">
            <span className="font-['Outfit'] font-black text-3xl text-[#0284c7] block leading-tight">
              {user.spinsEarned || 0}
            </span>
            <span className="text-xs text-slate-500 font-semibold tracking-tight mt-1 block">
              Spins Earned
            </span>
          </div>
        </div>

        {/* Live Referral Log Activity */}
        <div className="w-full bg-white rounded-[22px] p-4 shadow-lg shadow-sky-950/5 border border-white">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="font-['Outfit'] font-bold text-xs text-slate-800 uppercase tracking-wider">
                Recent Referral Activity
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              {referralHistory.length} Joined
            </span>
          </div>

          {referralHistory.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              <p className="font-medium mb-1">No referrals yet.</p>
              <p className="text-[11px] text-slate-400">
                Share your link above to invite friends and earn lucky spins!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {referralHistory.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                      🎁
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block text-xs leading-tight">
                        {t.description}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <span className="font-['Outfit'] font-black text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    +1 Spin
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteScreen;
