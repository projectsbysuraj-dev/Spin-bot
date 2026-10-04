import React, { useState, useEffect } from 'react';
import {
  Zap,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  History,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, UserProfile, WithdrawalRequest, Transaction } from '../types';
import {
  getUserTransactions,
  getUserWithdrawals,
  refreshWithdrawalsFromRemote,
  refreshTransactionsFromRemote,
  subscribeRealtime,
  addBalanceToUser,
} from '../services/store';
import { WithdrawModal } from './WithdrawModal';
import { TabType } from './BottomNav';
import { triggerHaptic } from '../services/telegram';

interface WalletScreenProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: TabType) => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ user, settings, onNavigate }) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'transactions'>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(getUserWithdrawals(user.id));
  const [transactions, setTransactions] = useState<Transaction[]>(getUserTransactions(user.id));
  const [isSyncing, setIsSyncing] = useState(false);

  // Live real-time sync with database
  useEffect(() => {
    // 1. Initial live fetch from Firebase RTDB
    refreshWithdrawalsFromRemote().then(() => {
      setWithdrawals(getUserWithdrawals(user.id));
    });
    refreshTransactionsFromRemote().then(() => {
      setTransactions(getUserTransactions(user.id));
    });

    // 2. Realtime listener
    const unsub = subscribeRealtime(() => {
      setWithdrawals(getUserWithdrawals(user.id));
      setTransactions(getUserTransactions(user.id));
    });

    // 3. Periodic background sync every 4 seconds
    const interval = setInterval(() => {
      refreshWithdrawalsFromRemote().then(() => {
        setWithdrawals(getUserWithdrawals(user.id));
      });
      refreshTransactionsFromRemote().then(() => {
        setTransactions(getUserTransactions(user.id));
      });
    }, 4000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user.id]);

  const handleOpenWithdraw = () => {
    triggerHaptic('medium');
    setShowWithdrawModal(true);
  };

  const handleWithdrawSuccess = () => {
    setShowWithdrawModal(false);
    setSuccessToast(true);
    // Refresh list immediately from local & remote
    setWithdrawals(getUserWithdrawals(user.id));
    setTransactions(getUserTransactions(user.id));
    setActiveTab('withdrawals');
    refreshWithdrawalsFromRemote().then(() => {
      setWithdrawals(getUserWithdrawals(user.id));
      setTransactions(getUserTransactions(user.id));
    });
    setTimeout(() => setSuccessToast(false), 4000);
  };

  const handleManualSync = async () => {
    triggerHaptic('light');
    setIsSyncing(true);
    try {
      await refreshWithdrawalsFromRemote();
      setWithdrawals(getUserWithdrawals(user.id));
      setTransactions(getUserTransactions(user.id));
      triggerHaptic('success');
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length;

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in select-none">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="w-full bg-emerald-500 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg shadow-emerald-700/30 flex items-center justify-between animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Withdrawal request submitted! Live sync with Admin Panel active.</span>
          </div>
          <button onClick={() => setSuccessToast(false)} className="text-white ml-2 text-sm">
            ✕
          </button>
        </div>
      )}

      {/* Available Balance Card */}
      <div className="w-full bg-[#0a192f] border border-sky-500/25 rounded-[28px] p-6 text-white shadow-2xl shadow-sky-950/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            AVAILABLE BALANCE
          </span>
          <div className="bg-[#0c2e59] border border-sky-400/40 rounded-full px-3 py-1 text-[11px] font-['Outfit'] font-black text-[#38bdf8]">
            Min ₹{settings.minWithdrawalLimit} Payout
          </div>
        </div>

        <h2 className="font-['Outfit'] font-black text-4xl text-[#38bdf8] tracking-tight mb-2">
          ₹ {user.balance.toFixed(2)}
        </h2>

        <p className="text-xs text-slate-300 font-medium mb-6">
          Instant 100% Payout via UPI &amp; Bank Account
        </p>

        {/* Buttons Row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleOpenWithdraw}
            className="bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-extrabold text-xs py-3 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Withdraw Cash</span>
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="bg-[#0f2744] hover:bg-[#163860] text-sky-200 font-['Outfit'] font-extrabold text-xs py-3 rounded-2xl border border-sky-700/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-sky-300" />
            <span>Go to Spin</span>
          </button>
        </div>
      </div>

      {/* Navigation Switcher: Withdrawals Status vs All Transactions */}
      <div className="w-full flex items-center justify-between gap-2 bg-[#0c1829] p-1.5 rounded-2xl border border-white/5">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('withdrawals');
          }}
          className={`flex-1 py-2.5 rounded-xl font-['Outfit'] font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'withdrawals'
              ? 'bg-[#0284c7] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Withdrawal Status</span>
          {pendingWithdrawalsCount > 0 && (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold animate-pulse">
              {pendingWithdrawalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('transactions');
          }}
          className={`flex-1 py-2.5 rounded-xl font-['Outfit'] font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-[#0284c7] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>All History</span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWALS STATUS (PENDING / COMPLETED / REJECTED) */}
      {activeTab === 'withdrawals' && (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#38bdf8] rounded-full"></span>
              <h3 className="font-['Outfit'] font-bold text-white text-sm">
                Your Payout Requests
              </h3>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-xl cursor-pointer"
            >
              <RotateCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          </div>

          {withdrawals.length === 0 ? (
            <div className="w-full bg-[#0a192f]/60 rounded-3xl p-8 border border-white/5 text-center text-slate-400 space-y-2">
              <CreditCard className="w-10 h-10 mx-auto opacity-40 text-sky-400" />
              <p className="font-['Outfit'] font-bold text-sm text-slate-200">
                No Withdrawal Requests Yet
              </p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Jab aap cash withdraw karenge, aapka <b>Pending</b>, <b>Approved</b> aur <b>Rejected</b> status yahan live dikhega.
              </p>
              <button
                onClick={handleOpenWithdraw}
                className="mt-3 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Withdraw Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className={`w-full rounded-2xl p-4 border transition-all ${
                    w.status === 'pending'
                      ? 'bg-[#101b2f] border-amber-500/30 shadow-lg shadow-amber-950/20'
                      : w.status === 'approved'
                      ? 'bg-[#0a231d] border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                      : 'bg-[#261019] border-rose-500/30 shadow-lg shadow-rose-950/20'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        WITHDRAWAL AMOUNT
                      </span>
                      <span
                        className={`text-2xl font-['Outfit'] font-black ${
                          w.status === 'pending'
                            ? 'text-amber-300'
                            : w.status === 'approved'
                            ? 'text-emerald-400'
                            : 'text-rose-400 line-through'
                        }`}
                      >
                        ₹{w.amount.toFixed(2)}
                      </span>
                    </div>

                    {/* Status Pill Badge */}
                    <div className="text-right">
                      {w.status === 'pending' && (
                        <div className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Pending Review</span>
                        </div>
                      )}

                      {w.status === 'approved' && (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Paid &amp; Approved</span>
                        </div>
                      )}

                      {w.status === 'rejected' && (
                        <div className="inline-flex items-center gap-1.5 bg-rose-500/20 border border-rose-400/40 text-rose-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rejected</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Details Box */}
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1 mb-3 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Method:</span>
                      <span className="font-extrabold uppercase text-white">
                        {w.method === 'upi' ? '⚡ UPI Payout' : '🏦 Bank Transfer'}
                      </span>
                    </div>

                    {w.method === 'upi' ? (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">UPI ID:</span>
                        <span className="font-mono font-bold text-sky-300">
                          {w.upiId}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">A/C Number:</span>
                          <span className="font-mono font-bold text-sky-300">
                            {w.accountNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Bank / IFSC:</span>
                          <span className="font-mono text-slate-200">
                            {w.bankName} ({w.ifsc})
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-white/5">
                      <span>Request ID:</span>
                      <span className="font-mono">#{w.id}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Time:</span>
                      <span>
                        {new Date(w.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* 3 Step Live Status Stepper */}
                  <div className="pt-1 pb-2 px-1">
                    <div className="flex items-center justify-between relative text-[11px] font-bold">
                      {/* Connecting Line */}
                      <div className="absolute left-6 right-6 top-3 h-0.5 bg-white/10 -z-0" />

                      {/* Step 1: Requested */}
                      <div className="flex flex-col items-center gap-1 z-10">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow">
                          ✓
                        </div>
                        <span className="text-slate-300 text-[10px]">Requested</span>
                      </div>

                      {/* Step 2: Under Review / Admin Check */}
                      <div className="flex flex-col items-center gap-1 z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow ${
                            w.status === 'pending'
                              ? 'bg-amber-400 text-slate-950 animate-pulse'
                              : w.status === 'approved'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {w.status === 'rejected' ? '✕' : '✓'}
                        </div>
                        <span className="text-slate-300 text-[10px]">
                          {w.status === 'rejected' ? 'Reviewed' : 'Reviewing'}
                        </span>
                      </div>

                      {/* Step 3: Payout Dispatched / Refunded */}
                      <div className="flex flex-col items-center gap-1 z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow ${
                            w.status === 'approved'
                              ? 'bg-emerald-500 text-slate-950'
                              : w.status === 'rejected'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {w.status === 'approved' ? '✓' : w.status === 'rejected' ? '↩' : '⏳'}
                        </div>
                        <span className="text-slate-300 text-[10px]">
                          {w.status === 'approved'
                            ? 'Paid'
                            : w.status === 'rejected'
                            ? 'Refunded'
                            : 'Transfer'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Informational Message Banner based on status */}
                  {w.status === 'pending' && (
                    <div className="mt-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <b>Verification in progress:</b> Admin aapki request check kar raha hai. Approval hote hi paise aapke account me bhej diye jayenge.
                      </span>
                    </div>
                  )}

                  {w.status === 'approved' && (
                    <div className="mt-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-200 flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <b>Payment Successful:</b> ₹{w.amount.toFixed(2)} aapke {w.method.toUpperCase()} account me transfer kar diye gaye hain.
                      </span>
                    </div>
                  )}

                  {w.status === 'rejected' && (
                    <div className="mt-2.5 p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-[11px] text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-rose-300 block">
                          Reason: {w.rejectReason || 'Invalid details provided'}
                        </span>
                        <span className="text-slate-300 text-[10px]">
                          ₹{w.amount.toFixed(2)} aapke wallet balance me wapas refund kar diye gaye hain. Aap sahi details ke sath dobara withdraw kar sakte hain.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL TRANSACTIONS (SPINS, BONUSES & PAYOUTS) */}
      {activeTab === 'transactions' && (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-4 bg-[#38bdf8] rounded-full"></span>
            <h3 className="font-['Outfit'] font-bold text-white text-sm">
              All Account Transactions
            </h3>
          </div>

          {transactions.length === 0 ? (
            <div className="w-full py-12 px-6 text-center text-slate-400 text-xs font-semibold leading-relaxed bg-[#0a192f]/40 rounded-3xl border border-white/5">
              No transactions found yet. Spin the wheel to win cash!
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 leading-snug">
                      {tx.description}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          tx.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : tx.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-['Outfit'] font-black text-sm block ${
                        tx.type === 'referral_bonus'
                          ? 'text-sky-600'
                          : tx.amount > 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'referral_bonus'
                        ? '+1 SPIN'
                        : `${tx.amount > 0 ? '+' : '-'}₹${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showWithdrawModal && (
        <WithdrawModal
          user={user}
          settings={settings}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </div>
  );
};
