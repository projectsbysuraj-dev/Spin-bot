import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Send, Sparkles, ChevronRight, Share2 } from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { TabType } from './BottomNav';
import { AppLogo } from './AppLogo';
import {
  decrementUserSpin,
  addBalanceToUser,
  creditReferralAfterFirstSpin,
} from '../services/store';
import { triggerHaptic, openExternalOrTelegramLink } from '../services/telegram';

interface HomeScreenProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: TabType) => void;
}

const WHEEL_SEGMENTS = [
  { value: 100, label: '₹100', color: '#00c2ff', textColor: '#ffffff', minDeg: 330, maxDeg: 390 }, // Top
  { value: 500, label: '₹500', color: '#ff3355', textColor: '#ffffff', minDeg: 270, maxDeg: 330 }, // Top-Right
  { value: 5, label: '₹5', color: '#0066ff', textColor: '#ffffff', minDeg: 210, maxDeg: 270 },   // Bottom-Right
  { value: 10, label: '₹10', color: '#8a2be2', textColor: '#ffffff', minDeg: 150, maxDeg: 210 },  // Bottom
  { value: 20, label: '₹20', color: '#e91e63', textColor: '#ffffff', minDeg: 90, maxDeg: 150 },   // Bottom-Left
  { value: 50, label: '₹50', color: '#ff9900', textColor: '#ffffff', minDeg: 30, maxDeg: 90 },    // Top-Left
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ user, settings, onNavigate }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonModal, setWonModal] = useState<{ amount: number } | null>(null);
  const [noSpinsModal, setNoSpinsModal] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const handleSpinClick = () => {
    if (isSpinning) return;

    if (user.spins <= 0) {
      triggerHaptic('error');
      setNoSpinsModal(true);
      return;
    }

    setIsSpinning(true);
    const decremented = decrementUserSpin(user.id);
    if (!decremented) {
      setIsSpinning(false);
      triggerHaptic('error');
      setNoSpinsModal(true);
      return;
    }

    triggerHaptic('heavy');

    // Guaranteed Win Logic: ALWAYS strictly spinWinAmount (default ₹5) every single spin!
    const winAmount = settings.spinWinAmount || 5;

    // Slice 2 is ₹5 (angles 120° to 180° clockwise from 12 o'clock). Center is at 150°.
    // To land under top pointer at 12 o'clock (0°), wheel must rotate to 360 - 150 = 210°.
    // Natural slight jitter within the slice (+/- 6 degrees)
    const naturalJitter = Math.floor(Math.random() * 12) - 6;
    const targetSliceAngle = 210 + naturalJitter;

    // 5 to 7 full extra rotations for exciting spin effect
    const fullSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const currentModulo = rotation % 360;
    const forwardDistance = (targetSliceAngle - currentModulo + 360) % 360;
    const nextRotation = rotation + fullSpins + (forwardDistance === 0 ? 360 : forwardDistance);

    setRotation(nextRotation);

    setTimeout(() => {
      setIsSpinning(false);
      triggerHaptic('success');

      // Add winAmount to balance and record exactly one clean spin_win transaction
      addBalanceToUser(user.id, winAmount, `Won ₹${winAmount} in Lucky Spin!`, true, 'spin_win');

      // Award +1 spin to referrer ONLY when this user completes their first spin!
      creditReferralAfterFirstSpin(user.id);

      // Confetti burst
      try {
        confetti({
          particleCount: 85,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00d2ff', '#ff3366', '#ffd700', '#00ffcc'],
        });
      } catch (e) {
        // Fallback
      }

      setWonModal({ amount: winAmount });
    }, 4200);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in">
      {/* Top Carousel Banner Card (Matching Screenshot 1 & 2) */}
      <div className="w-full relative">
        <div className="w-full bg-gradient-to-r from-white via-[#f0f9ff] to-[#e0f2fe] rounded-[24px] p-5 shadow-xl shadow-sky-950/15 relative overflow-hidden border border-white">
          <div className="pr-24 z-10 relative">
            <span className="text-[#0284c7] font-black text-sm tracking-wider uppercase block mb-1">
              🎁 1 SIGN UP = 1 SPIN • 1 REFER = 1 SPIN
            </span>
            <p className="text-slate-700 text-xs font-semibold leading-relaxed mb-3">
              Get 1 Free Spin on Sign Up + 1 Spin for every friend invited to @{settings.botUsername || 'RohitGiveawayBot'}!
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openExternalOrTelegramLink(settings.telegramChannelUrl)}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-md shadow-sky-700/25 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 fill-white" />
                <span>JOIN CHANNEL</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right graphic: App Logo with glowing badge */}
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center pointer-events-none">
            <div className="w-28 h-28 rounded-full bg-sky-200/50 flex items-center justify-center">
              <AppLogo className="w-24 h-24 filter drop-shadow-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 bg-[#38bdf8] rounded-full"></span>
          <h2 className="font-['Outfit'] font-extrabold text-white text-lg tracking-tight">
            Lucky Spin Wheel
          </h2>
        </div>
        <span className="text-xs font-bold text-sky-200 uppercase tracking-wider">
          1 REFER = 1 SPIN
        </span>
      </div>

      {/* Spin Section Card (Deep navy background matching Screenshot 1 & Screenshot_20260925-223333.png) */}
      <div className="w-full bg-[#0a192f] border border-sky-500/20 rounded-[28px] p-5 shadow-2xl shadow-sky-950/50 flex flex-col items-center text-center relative overflow-hidden">
        {/* Top 100% Guaranteed Cash Win Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-sky-950/80 border border-sky-400/40 rounded-full text-[11px] font-bold text-amber-300 shadow-sm mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>100% GUARANTEED CASH WIN</span>
        </div>

        <h3 className="font-['Outfit'] font-black text-2xl text-white tracking-tight leading-tight mb-1">
          Spin &amp; Win Direct Cash
        </h3>
        <p className="text-slate-300 text-xs leading-relaxed max-w-[280px] mb-4">
          1 Free Spin on Sign Up + 1 Spin per friend invite! Win instant real cash directly into your wallet.
        </p>

        {/* Spins Available Capsule */}
        <div className="bg-[#071324] border border-sky-800/60 rounded-full px-4 py-1.5 flex items-center gap-3 mb-6 shadow-inner">
          <span className="text-xs text-slate-300 font-medium">
            Spins Available:{' '}
            <strong className="text-[#38bdf8] font-['Outfit'] font-black text-sm ml-0.5">
              {user.spins}
            </strong>
          </span>
          <button
            onClick={() => onNavigate('invite')}
            className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-sm active:scale-95 transition-all"
          >
            + Invite
          </button>
        </div>

        {/* The Spin Wheel Assembly */}
        <div className="relative w-64 h-64 my-2 flex items-center justify-center select-none">
          {/* Top Pin / Pointer at 12 o'clock */}
          <div className="absolute -top-3 z-30 flex flex-col items-center pointer-events-none drop-shadow-md">
            <div className="w-5 h-8 bg-gradient-to-b from-red-500 to-rose-600 rounded-t-full rounded-b-md shadow-lg border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-rose-600 -mt-0.5"></div>
          </div>

          {/* Rotating Wheel Container */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-[#38bdf8] shadow-2xl shadow-sky-500/30 overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning
                ? 'transform 4.2s cubic-bezier(0.12, 0.88, 0.22, 1)'
                : 'none',
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full select-none">
              {WHEEL_SEGMENTS.map((seg, idx) => {
                const startAngle = idx * 60;
                const endAngle = (idx + 1) * 60;
                const rad1 = (startAngle * Math.PI) / 180;
                const rad2 = (endAngle * Math.PI) / 180;
                const x1 = (100 + 98 * Math.sin(rad1)).toFixed(2);
                const y1 = (100 - 98 * Math.cos(rad1)).toFixed(2);
                const x2 = (100 + 98 * Math.sin(rad2)).toFixed(2);
                const y2 = (100 - 98 * Math.cos(rad2)).toFixed(2);

                const midAngle = idx * 60 + 30; // 30°, 90°, 150°, 210°, 270°, 330°
                const radMid = (midAngle * Math.PI) / 180;
                const tx = (100 + 60 * Math.sin(radMid)).toFixed(2);
                const ty = (100 - 60 * Math.cos(radMid)).toFixed(2);

                return (
                  <g key={idx}>
                    {/* Slice Wedge */}
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                      fill={seg.color}
                    />
                    {/* Crisp Dividing Spoke between Slices */}
                    <line
                      x1="100"
                      y1="100"
                      x2={x1}
                      y2={y1}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="1.5"
                    />
                    {/* Amount Label Exactly in Center (Beech Me) of Slice */}
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontWeight: 900,
                        fontSize: '11.5px',
                        letterSpacing: '-0.3px',
                        filter: 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.7))',
                      }}
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Center SPIN Button Hub */}
          <button
            onClick={handleSpinClick}
            disabled={isSpinning}
            className={`absolute w-16 h-16 rounded-full bg-white shadow-2xl border-4 border-[#38bdf8] z-20 flex items-center justify-center font-['Outfit'] font-black text-[#0284c7] text-sm tracking-wider transition-transform ${
              isSpinning ? 'scale-95 opacity-90' : 'active:scale-90 hover:scale-105'
            }`}
          >
            SPIN
          </button>
        </div>

        {/* Big Blue Button: REFER FRIENDS TO GET SPINS (Matching Screenshot_20260925-223333.png) */}
        <div className="w-full mt-4 flex flex-col items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('medium');
              onNavigate('invite');
            }}
            className="w-full bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider"
          >
            <span className="text-base">🎯</span>
            <span>REFER FRIENDS TO GET SPINS</span>
          </button>
          <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
            <span>💡</span>
            <span>1 Friend Invite via Bot = 1 Free Lucky Spin Chance</span>
          </p>
        </div>
      </div>

      {/* How to Earn & Withdraw Section Card (Matching Screenshot_20260925-223333.png) */}
      <div className="w-full bg-white rounded-[26px] p-5 shadow-xl shadow-sky-950/10 border border-white">
        <h3 className="font-['Outfit'] font-extrabold text-slate-800 text-sm flex items-center gap-2 mb-4">
          <span className="text-base">📋</span>
          <span>How to Earn &amp; Withdraw:</span>
        </h3>

        <div className="space-y-3.5">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#38bdf8] bg-sky-50 text-[#0284c7] flex items-center justify-center font-['Outfit'] font-black text-xs shrink-0 mt-0.5 shadow-sm">
              1
            </div>
            <div>
              <h4 className="font-['Outfit'] font-black text-xs text-slate-800 leading-tight">
                Share Spin the Win Referral Link
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                Share your unique bot link with friends on Telegram
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100" />

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#38bdf8] bg-sky-50 text-[#0284c7] flex items-center justify-center font-['Outfit'] font-black text-xs shrink-0 mt-0.5 shadow-sm">
              2
            </div>
            <div>
              <h4 className="font-['Outfit'] font-black text-xs text-slate-800 leading-tight">
                Get 1 Spin per Referral
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                When your friend opens the bot mini app, you get +1 Spin
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100" />

          {/* Step 3 */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#38bdf8] bg-sky-50 text-[#0284c7] flex items-center justify-center font-['Outfit'] font-black text-xs shrink-0 mt-0.5 shadow-sm">
              3
            </div>
            <div>
              <h4 className="font-['Outfit'] font-black text-xs text-slate-800 leading-tight">
                Spin Wheel &amp; Win Cash
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                Spin the wheel to win real wallet cash every time
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100" />

          {/* Step 4 */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#38bdf8] bg-sky-50 text-[#0284c7] flex items-center justify-center font-['Outfit'] font-black text-xs shrink-0 mt-0.5 shadow-sm">
              4
            </div>
            <div>
              <h4 className="font-['Outfit'] font-black text-xs text-slate-800 leading-tight">
                Instant Withdrawal (Min ₹{settings.minWithdrawalLimit})
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                Direct payout to your Bank Account or UPI ID
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* No Spins Modal / Bottom Notification */}
      {noSpinsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-scale-up">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
              🎡
            </div>
            <h3 className="font-['Outfit'] font-black text-xl text-slate-800 mb-1">
              No Spins Available!
            </h3>
            <p className="text-slate-500 text-xs mb-5">
              Invite your friends to Rohit Giveaway to get 1 Free Lucky Spin for every friend who joins!
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setNoSpinsModal(false);
                  onNavigate('invite');
                }}
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30"
              >
                <Share2 className="w-4 h-4" />
                <span>Invite Friends to Get Spins</span>
              </button>
              <button
                onClick={() => setNoSpinsModal(false)}
                className="w-full bg-slate-100 text-slate-600 font-bold text-xs py-2.5 rounded-xl hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win Celebration Modal */}
      {wonModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-sky-950 via-[#0a192f] to-[#040e1d] border-2 border-sky-400 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
            <div className="text-5xl mb-2 animate-bounce">🎉</div>
            <h3 className="font-['Outfit'] font-black text-2xl text-amber-300 mb-1">
              CONGRATULATIONS!
            </h3>
            <p className="text-slate-200 text-xs mb-3">You just won instant real cash!</p>

            <div className="bg-sky-500/20 border border-sky-400/50 rounded-2xl py-4 my-3">
              <span className="text-slate-300 text-xs uppercase tracking-wider block font-semibold">
                CASH ADDED TO WALLET
              </span>
              <span className="font-['Outfit'] font-black text-4xl text-[#38bdf8]">
                + ₹{wonModal.amount}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-5">
              Cash has been directly added to your balance. You can withdraw anytime via UPI or Bank!
            </p>

            <button
              onClick={() => setWonModal(null)}
              className="w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 text-white font-black text-sm py-3 rounded-2xl shadow-lg shadow-sky-500/40"
            >
              COLLECT REWARD 💰
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
