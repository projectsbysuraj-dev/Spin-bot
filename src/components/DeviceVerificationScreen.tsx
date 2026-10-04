import { useState, useEffect } from 'react';
import { UserProfile, AppSettings } from '../types';
import { Check, ShieldAlert, Smartphone } from 'lucide-react';
import { rtdb, ref, get, set, update } from '../services/firebase';
import { recordPendingReferral, creditReferralAfterFirstSpin } from '../services/store';

interface DeviceVerificationScreenProps {
  user: UserProfile;
  settings: AppSettings;
  referrerId?: string | null;
  onContinue: () => void;
}

const DEVICE_STORAGE_KEY = 'rg_phone_registered_device_v1';
const BOUND_TELEGRAM_ID_KEY = 'rg_bound_telegram_id_v1';
const BOT_TOKEN = '8639853090:AAGSrArc6Xtm5309WpZeGih1H7evsvJstWE';
const MINI_APP_URL = 'https://cashback-psi-fawn.vercel.app/';

function getHardwareFingerprint(): string {
  try {
    const parts = [
      typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '',
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : '',
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '',
      typeof navigator !== 'undefined' ? navigator.language || '' : '',
      typeof navigator !== 'undefined' ? navigator.platform || '' : '',
    ];

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 5, 60, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('telebot_device_v1', 12, 10);
        parts.push(canvas.toDataURL().slice(-40));
      }
    }

    const str = parts.join('###');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return 'hw_' + Math.abs(hash).toString(36);
  } catch {
    return 'hw_fallback';
  }
}

export function DeviceVerificationScreen({
  user,
  referrerId,
  onContinue,
}: DeviceVerificationScreenProps) {
  const [status, setStatus] = useState<'verifying' | 'success' | 'blocked'>('verifying');
  const [blockedDetails, setBlockedDetails] = useState<{ originalId: string }>({ originalId: '' });
  const [referrerName, setReferrerName] = useState<string>('MICHAEL');

  const handleDoneSuccess = async () => {
    const rawId = String(user.telegramId || user.id || '').trim();
    const appUrl = referrerId
      ? `${MINI_APP_URL}?start=ref_${referrerId.replace('ref_', '')}`
      : MINI_APP_URL;

    // 1. Mark verified in Firebase RTDB
    if (rtdb && rawId) {
      try {
        await update(ref(rtdb, `users/${rawId}`), {
          isVerified: true,
          deviceVerified: true,
          deviceVerifiedAt: Date.now(),
        });
      } catch (e) {
        console.warn('Error updating verified status in RTDB:', e);
      }
    }

    // Record and credit referral for the referrer instantly upon device verification
    if (referrerId) {
      recordPendingReferral(referrerId, rawId);
    }
    creditReferralAfterFirstSpin(rawId);

    // 2. Send Congratulations message directly via Telegram Bot API with Mini App Link
    if (rawId && rawId.match(/^\d+$/)) {
      try {
        const text = `🎉 <b>Congratulations ${user.name || 'Friend'}</b>\n\nAapka device successfully verify ho gaya hai ✅\n\nNeeche button dabao aur apna Free Spin khelo 🎡`;
        const payload = {
          chat_id: Number(rawId),
          text: text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎁 Open Reward App',
                  web_app: { url: appUrl },
                },
              ],
            ],
          },
        };

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('Could not send congratulations telegram message:', err);
      }
    }

    // 3. Open website / continue directly to app
    onContinue();
  };

  const handleDoneBlocked = async () => {
    const rawId = String(user.telegramId || user.id || '').trim();

    if (rtdb && rawId) {
      try {
        await update(ref(rtdb, `users/${rawId}`), {
          deviceBlocked: true,
          deviceBlockedAt: Date.now(),
        });
      } catch (e) {
        console.warn('Error recording blocked device status:', e);
      }
    }

    if (rawId && rawId.match(/^\d+$/)) {
      try {
        const text = `❌ <b>Device Verification Failed!</b>\n\nEk device me sirf ek hi account ho sakta hai. Multiple accounts allowed nahi hain! 🚫`;
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: Number(rawId),
            text: text,
            parse_mode: 'HTML',
          }),
        });
      } catch (err) {
        console.warn('Could not send blocked message:', err);
      }
    }

    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.close) {
      (window as any).Telegram.WebApp.close();
    }
  };

  useEffect(() => {
    // 1. Fetch referrer name if available (Strictly block self-referral)
    const currentTelegramId = String(user.telegramId || user.id).trim();
    if (referrerId && rtdb) {
      const cleanRef = referrerId.replace(/^(\+?)(ref_|ref-|ref|invite_|invite-)/i, '').trim();
      const boundLocalTelegramId = typeof window !== 'undefined' ? localStorage.getItem(BOUND_TELEGRAM_ID_KEY) : null;

      if (cleanRef === currentTelegramId || (boundLocalTelegramId && cleanRef === boundLocalTelegramId)) {
        setReferrerName(''); // Self-referral attempt
      } else {
        get(ref(rtdb, `users/${cleanRef}`))
          .then((snapshot) => {
            if (snapshot.exists()) {
              const val = snapshot.val();
              if (val.deviceBlocked) {
                setReferrerName('');
              } else {
                setReferrerName(val.name?.toUpperCase() || `USER #${cleanRef.slice(-4)}`);
              }
            } else {
              setReferrerName('');
            }
          })
          .catch(() => {
            setReferrerName('');
          });
      }
    } else {
      setReferrerName('');
    }

    // 2. Perform Single Phone / Anti-Account-Switch Verification
    // Generate or get persistent phone device UUID stored in this phone's browser / Telegram WebView
    let localDeviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!localDeviceId) {
      localDeviceId = 'dev_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem(DEVICE_STORAGE_KEY, localDeviceId);
    }

    const boundLocalTelegramId = localStorage.getItem(BOUND_TELEGRAM_ID_KEY);

    // CHECK A: Is this phone's localStorage already bound to a DIFFERENT Telegram ID?
    if (boundLocalTelegramId && boundLocalTelegramId !== currentTelegramId) {
      // BUSTED: User switched Telegram account on the SAME phone!
      setStatus('blocked');
      setBlockedDetails({ originalId: boundLocalTelegramId });
      return;
    }

    // CHECK B: Double-check with Firebase RTDB device & hardware bindings
    const hwFingerprint = getHardwareFingerprint();

    if (rtdb) {
      // Check both localDeviceId and persistent hardware fingerprint
      Promise.all([
        localDeviceId ? get(ref(rtdb, `devices/${localDeviceId}`)) : Promise.resolve(null),
        hwFingerprint ? get(ref(rtdb, `hardware_fingerprints/${hwFingerprint}`)) : Promise.resolve(null),
      ])
        .then(([deviceSnap, hwSnap]) => {
          let conflictId: string | null = null;

          if (deviceSnap && deviceSnap.exists()) {
            const data = deviceSnap.val();
            const boundId = String(data.boundTelegramId || '').trim();
            if (boundId && boundId !== currentTelegramId) {
              conflictId = boundId;
            }
          }

          if (!conflictId && hwSnap && hwSnap.exists()) {
            const data = hwSnap.val();
            const boundId = String(data.boundTelegramId || '').trim();
            if (boundId && boundId !== currentTelegramId) {
              conflictId = boundId;
            }
          }

          if (conflictId) {
            localStorage.setItem(BOUND_TELEGRAM_ID_KEY, conflictId);
            setStatus('blocked');
            setBlockedDetails({ originalId: conflictId });
            return;
          }

          // CLEAN DEVICE: Bind this phone and hardware permanently
          localStorage.setItem(BOUND_TELEGRAM_ID_KEY, currentTelegramId);

          if (rtdb && localDeviceId) {
            set(ref(rtdb, `devices/${localDeviceId}`), {
              boundTelegramId: currentTelegramId,
              boundName: user.name || 'User',
              firstVerifiedAt: Date.now(),
              hwFingerprint,
            }).catch(() => {});
          }

          if (rtdb && hwFingerprint) {
            set(ref(rtdb, `hardware_fingerprints/${hwFingerprint}`), {
              boundTelegramId: currentTelegramId,
              boundName: user.name || 'User',
              firstVerifiedAt: Date.now(),
            }).catch(() => {});
          }

          setStatus('success');
        })
        .catch(() => {
          localStorage.setItem(BOUND_TELEGRAM_ID_KEY, currentTelegramId);
          setStatus('success');
        });
    } else {
      localStorage.setItem(BOUND_TELEGRAM_ID_KEY, currentTelegramId);
      setStatus('success');
    }
  }, [user, referrerId]);

  // Format Telegram ID with exact spacing like in Screenshot ("7 878 219 676")
  const rawId = String(user.telegramId || user.id || '7878219676');
  // Format as 1 digit then triplets or custom triplets
  const formattedId = rawId.length === 10
    ? `${rawId[0]} ${rawId.slice(1, 4)} ${rawId.slice(4, 7)} ${rawId.slice(7)}`
    : rawId.replace(/(\d{3})(?=\d)/g, '$1 ');

  return (
    <div className="fixed inset-0 z-50 bg-[#0c121d] flex flex-col justify-between p-4 sm:p-6 overflow-y-auto text-white select-none">
      {/* Upper Area: 3D Stacked ID Card */}
      <div className="w-full max-w-sm mx-auto pt-4 relative flex flex-col items-center">
        {/* Top Floating Mini Tab / Dot */}
        <div className="w-2.5 h-1.5 rounded-full bg-[#34d399] -mb-1 z-20 shadow-sm" />

        {/* Background Layer Card (Card Stack Effect) */}
        <div className="w-[88%] h-24 rounded-[28px] bg-[#1a2d48]/70 border border-cyan-400/30 -mb-20 transform -rotate-1 scale-[0.98] opacity-80 pointer-events-none" />

        {/* Foreground Main ID Card */}
        <div className="w-full relative rounded-[30px] p-6 bg-[#0077e6] overflow-hidden shadow-2xl shadow-cyan-950/60 border border-cyan-300/40 z-10">
          {/* Green Curve Graphic on Right */}
          <div className="absolute top-0 right-0 w-[55%] h-full bg-[#00a86b] rounded-l-[180px] pointer-events-none" />

          {/* Wireframe Origami Paper Airplane Illustration */}
          <svg
            className="absolute top-3 right-3 w-32 h-32 opacity-35 pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
            stroke="white"
            strokeWidth="1.2"
          >
            <polygon points="10,45 85,15 55,85 45,55" />
            <line x1="85" y1="15" x2="45" y2="55" />
            <line x1="45" y1="55" x2="35" y2="75" />
            <line x1="35" y1="75" x2="55" y2="85" />
          </svg>

          {/* Card Header */}
          <div className="flex items-center justify-between mb-9 relative z-10">
            <span className="text-xs font-bold text-white tracking-wide">
              Device verification
            </span>
            <span className="bg-black/35 backdrop-blur-sm text-white font-extrabold text-[11px] px-3.5 py-1 rounded-full border border-white/10">
              Verified
            </span>
          </div>

          {/* TELEGRAM ID Section */}
          <div className="relative z-10 pb-1">
            <span className="text-[10px] font-black tracking-widest text-sky-200 uppercase block mb-1">
              TELEGRAM ID
            </span>
            <div className="text-[26px] sm:text-[28px] font-mono font-black tracking-wider text-white">
              {formattedId}
            </div>
          </div>

          {/* Floating Large Mint-Green Checkmark Badge (Bottom Right) */}
          <div className="absolute right-4 -bottom-1 translate-y-1/4 w-16 h-16 rounded-full bg-[#5fe3a1] flex items-center justify-center text-[#064e3b] shadow-xl shadow-emerald-950/50 z-20">
            <Check className="w-8 h-8 stroke-[3.5]" />
          </div>
        </div>
      </div>

      {/* Lower Area: Rounded Bottom Card Container */}
      <div className="w-full max-w-sm mx-auto mt-6 bg-[#131b29] rounded-[32px] p-6 border border-white/5 space-y-5 shadow-2xl">
        {status === 'blocked' ? (
          /* Anti-Account Switch Lock Alert */
          <div className="text-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto text-red-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-['Outfit'] font-black text-white">
              Device Verification Failed!
            </h3>
            <p className="text-xs text-red-400 font-bold">
              Ek device me ek hi account chal sakta hai 🚫
            </p>
            <div className="bg-[#0b121e] rounded-2xl p-3.5 text-left border border-white/5 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Device already linked to Account #{blockedDetails.originalId}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Rules ke mutabiq ek device me sirf ek hi account chal sakta hai. Ek se zyada account chalane par device verification reject kar diya jata hai.
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <div className="p-3 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-300 text-center text-xs font-bold">
                ⛔ Ek device me ek hi account ho sakta hai!
              </div>
              <button
                onClick={handleDoneBlocked}
                className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-['Outfit'] font-black text-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Normal Verified View matching Screenshot */
          <>
            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] font-['Outfit'] font-black text-white leading-none">
              Device verified
            </h1>

            {/* Inviter Credited Pill Box */}
            <div className="bg-[#0c1421] border border-white/10 rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full border-2 border-[#00c896] flex items-center justify-center text-[#00c896] shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold text-[#00c896] block mb-0.5">
                  {referrerName ? 'Invite credited' : 'Device Verified'}
                </span>
                <span className="text-sm font-black text-white">
                  {referrerName ? `${referrerName} got credit for inviting you` : '1 Free Lucky Spin Unlocked!'}
                </span>
              </div>
            </div>

            {/* 3 Step Timeline (Telegram [✓]  This phone [✓]  Approved [✓]) */}
            <div className="pt-2 pb-1">
              <div className="flex items-center justify-between relative px-2">
                {/* Connecting Lines */}
                <div className="absolute left-8 right-8 top-3.5 h-[2px] bg-slate-700 -z-0" />

                {/* Step 1: Telegram */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="w-7 h-7 rounded-full bg-[#5fe3a1] flex items-center justify-center text-[#064e3b] shadow-md shadow-emerald-950/40">
                    <Check className="w-4 h-4 stroke-[3.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Telegram
                  </span>
                </div>

                {/* Step 2: This phone */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="w-7 h-7 rounded-full bg-[#5fe3a1] flex items-center justify-center text-[#064e3b] shadow-md shadow-emerald-950/40">
                    <Check className="w-4 h-4 stroke-[3.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    This phone
                  </span>
                </div>

                {/* Step 3: Approved */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="w-7 h-7 rounded-full bg-[#5fe3a1] flex items-center justify-center text-[#064e3b] shadow-md shadow-emerald-950/40">
                    <Check className="w-4 h-4 stroke-[3.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button: Open Website / App */}
            <button
              onClick={handleDoneSuccess}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#0084ff] to-[#00a8ff] hover:from-[#0072de] hover:to-[#0096e6] active:scale-[0.98] text-white font-['Outfit'] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <span>Open</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Bottom Phone Home Indicator Bar */}
      <div className="w-32 h-1 bg-white/30 rounded-full mx-auto mt-4 mb-1" />
    </div>
  );
}
