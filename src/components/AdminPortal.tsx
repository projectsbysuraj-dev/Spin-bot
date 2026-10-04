import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  RotateCw,
  CheckCircle,
  XCircle,
  LogOut,
  ArrowLeft,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  Palette,
  Code2,
  Check,
  Copy,
  Download,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Sliders,
  Plus,
  Minus,
  Tag,
  Wallet,
} from 'lucide-react';
import {
  AppSettings,
  ThemeSettings,
  ThemePreset,
  UserProfile,
} from '../types';
import {
  getAllWithdrawals,
  refreshWithdrawalsFromRemote,
  refreshUsersFromRemote,
  approveWithdrawal,
  rejectWithdrawal,
  deletePermanentWithdrawal,
  deleteProcessedWithdrawals,
  clearAllWithdrawalsPermanent,
  saveSettings,
  saveTheme,
  THEME_PRESETS,
  getAllUsers,
  addSpinsToUser,
  addBalanceToUser,
  adjustUserBalance,
  subscribeRealtime,
  getAdminCredentials,
  verifyAdminLogin,
  updateAdminPassword,
  updateAdminEmail,
  isAdminLoggedIn,
  setAdminLoggedIn,
  logoutAdmin,
} from '../services/store';
import { generateStandaloneHtml } from '../services/standaloneHtmlGenerator';
import { triggerHaptic } from '../services/telegram';
import { AppLogo } from './AppLogo';

interface AdminPortalProps {
  settings: AppSettings;
  theme: ThemeSettings;
  onNavigateToUserApp: () => void;
}

type AdminTab = 'withdrawals' | 'users' | 'security' | 'settings' | 'theme' | 'code';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  settings,
  theme,
  onNavigateToUserApp,
}) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isAdminLoggedIn());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState(getAllWithdrawals());
  const [users, setUsers] = useState(getAllUsers());
  const [adminCreds, setAdminCreds] = useState(getAdminCredentials());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Settings form state
  const [botUsername, setBotUsername] = useState(settings.botUsername);
  const [channelLink, setChannelLink] = useState(settings.telegramChannelUrl);
  const [appTitle, setAppTitle] = useState(settings.appTitle);
  const [spinWinAmount, setSpinWinAmount] = useState(String(settings.spinWinAmount));
  const [minWithdrawal, setMinWithdrawal] = useState(String(settings.minWithdrawalLimit));
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // User management state
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [spinsToAdd, setSpinsToAdd] = useState('');
  const [balanceToAdd, setBalanceToAdd] = useState('');
  const [userActionToast, setUserActionToast] = useState<string | null>(null);

  // User Amount & Balance Modal state (Add, Deduct, Set + Reason)
  const [balanceModal, setBalanceModal] = useState<{
    isOpen: boolean;
    user: UserProfile | null;
    mode: 'add' | 'deduct' | 'set';
    amount: string;
    reason: string;
    spins: string;
  }>({
    isOpen: false,
    user: null,
    mode: 'set',
    amount: '',
    reason: '',
    spins: '',
  });

  // Security / Password change state
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState(adminCreds.email);
  const [securityToast, setSecurityToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Standalone code state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedItemKey, setCopiedItemKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedItemKey(key);
    triggerHaptic('light');
    setTimeout(() => {
      setCopiedItemKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  useEffect(() => {
    // 1. Initial live fetch directly from Firebase Realtime Database
    refreshWithdrawalsFromRemote().then((res) => setWithdrawals(res));
    refreshUsersFromRemote().then((res) => setUsers(res));

    // 2. Realtime state subscription
    const unsub = subscribeRealtime(() => {
      setWithdrawals(getAllWithdrawals());
      setUsers(getAllUsers());
      setAdminCreds(getAdminCredentials());
    });

    // 3. Periodic background sync every 3 seconds to ensure live cross-device queue updates
    const syncInterval = setInterval(() => {
      refreshWithdrawalsFromRemote().then((res) => setWithdrawals(res));
    }, 3000);

    return () => {
      unsub();
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    setBotUsername(settings.botUsername);
    setChannelLink(settings.telegramChannelUrl);
    setAppTitle(settings.appTitle);
    setSpinWinAmount(String(settings.spinWinAmount));
    setMinWithdrawal(String(settings.minWithdrawalLimit));
    setNewEmailInput(adminCreds.email);
  }, [settings, adminCreds.email]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const result = verifyAdminLogin(loginEmail, loginPassword);
    if (result.success) {
      triggerHaptic('success');
      setIsAuthenticated(true);
      // Fetch live data on successful login
      refreshWithdrawalsFromRemote().then((res) => setWithdrawals(res));
      refreshUsersFromRemote().then((res) => setUsers(res));
    } else {
      triggerHaptic('error');
      setLoginError(result.error || 'Invalid credentials');
    }
  };

  const handleLogout = () => {
    triggerHaptic('medium');
    logoutAdmin();
    setIsAuthenticated(false);
  };

  const handleRefresh = async () => {
    triggerHaptic('light');
    setIsRefreshing(true);
    try {
      const [w, u] = await Promise.all([
        refreshWithdrawalsFromRemote(),
        refreshUsersFromRemote(),
      ]);
      setWithdrawals(w);
      setUsers(u);
      triggerHaptic('success');
    } finally {
      setIsRefreshing(false);
    }
  };

  const [withdrawalToast, setWithdrawalToast] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor?: 'red' | 'amber' | 'emerald';
    showInput?: boolean;
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: string;
    onConfirm: (inputVal?: string) => Promise<void> | void;
  } | null>(null);
  const [dialogInputValue, setDialogInputValue] = useState('');

  const showWithdrawalToast = (msg: string) => {
    setWithdrawalToast(msg);
    setTimeout(() => setWithdrawalToast(null), 3500);
  };

  const handleApproveWithdrawal = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Approve & Mark Paid',
      message: 'Kya aap is withdrawal request ko approve karke paid mark karna chahte hain?',
      confirmLabel: 'Approve & Pay ✅',
      confirmColor: 'emerald',
      onConfirm: async () => {
        triggerHaptic('success');
        await approveWithdrawal(id);
        const updated = await refreshWithdrawalsFromRemote();
        setWithdrawals(updated);
        showWithdrawalToast('✅ Withdrawal approved and marked paid successfully!');
        setConfirmDialog(null);
      },
    });
  };

  const handleRejectWithdrawal = (id: string) => {
    setDialogInputValue('Invalid UPI ID / Details');
    setConfirmDialog({
      isOpen: true,
      title: 'Reject & Refund Withdrawal',
      message: 'Ye amount turant user ke balance mein refund ho jayega. Rejection ka reason likhein:',
      confirmLabel: 'Reject & Refund ❌',
      confirmColor: 'red',
      showInput: true,
      inputLabel: 'Rejection Reason',
      inputPlaceholder: 'e.g. Invalid UPI ID / Incorrect Bank Details',
      onConfirm: async (reason) => {
        triggerHaptic('error');
        await rejectWithdrawal(id, reason || 'Verification failed');
        const updated = await refreshWithdrawalsFromRemote();
        setWithdrawals(updated);
        showWithdrawalToast('❌ Withdrawal rejected and amount refunded to user balance.');
        setConfirmDialog(null);
      },
    });
  };

  const handleDeleteSingleWithdrawal = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete Record',
      message: 'Kya aap is withdrawal request ko Firebase Database aur queue se PERMANENTLY DELETE karna chahte hain?\n\nYe record database se hamesha ke liye gayab ho jayega.',
      confirmLabel: 'Delete Permanently 🗑️',
      confirmColor: 'red',
      onConfirm: async () => {
        triggerHaptic('error');
        await deletePermanentWithdrawal(id);
        const updated = await refreshWithdrawalsFromRemote();
        setWithdrawals(updated);
        showWithdrawalToast('🗑️ Withdrawal record permanently deleted from Firebase database.');
        setConfirmDialog(null);
      },
    });
  };

  const handleCleanProcessedWithdrawals = () => {
    const processedCount = withdrawals.filter((w) => w.status === 'approved' || w.status === 'rejected').length;
    if (processedCount === 0) {
      showWithdrawalToast('ℹ️ Database mein koi bhi Approved ya Rejected records nahi hain.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Clean Processed History',
      message: `Kya aap sabhi ${processedCount} Approved aur Rejected records ko Firebase Database se PERMANENTLY DELETE karna chahte hain?\n\n(Pending requests delete nahi hongi aur safe rahengi).`,
      confirmLabel: `Clean ${processedCount} Records 🧹`,
      confirmColor: 'amber',
      onConfirm: async () => {
        triggerHaptic('medium');
        const count = await deleteProcessedWithdrawals();
        const updated = await refreshWithdrawalsFromRemote();
        setWithdrawals(updated);
        showWithdrawalToast(`🧹 ${count} processed records permanently clean kar diye gaye!`);
        setConfirmDialog(null);
      },
    });
  };

  const handleClearAllWithdrawals = () => {
    setConfirmDialog({
      isOpen: true,
      title: '🚨 KHATRA: Clear Entire Database',
      message: 'Kya aap Firebase Database se SAARI WITHDRAWALS (Approved, Rejected, aur Pending) PERMANENTLY DELETE karna chahte hain?\n\nDatabase 100% KHALI ho jayega aur count 0 ho jayega!',
      confirmLabel: 'Yes, Wipe All Database 💥',
      confirmColor: 'red',
      onConfirm: async () => {
        triggerHaptic('error');
        await clearAllWithdrawalsPermanent();
        const updated = await refreshWithdrawalsFromRemote();
        setWithdrawals(updated);
        showWithdrawalToast('💥 Sabhi withdrawals database se permanently delete ho gayi! Database khali hai.');
        setConfirmDialog(null);
      },
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    let cleanChannel = channelLink.trim();
    if (cleanChannel.startsWith('@')) {
      cleanChannel = `https://t.me/${cleanChannel.replace(/^@/, '')}`;
    } else if (cleanChannel && !cleanChannel.startsWith('http://') && !cleanChannel.startsWith('https://')) {
      cleanChannel = `https://${cleanChannel}`;
    }

    saveSettings({
      botUsername: botUsername.replace(/^@/, '').trim(),
      telegramChannelUrl: cleanChannel,
      appTitle: appTitle.trim() || 'Rohit Giveaway',
      spinWinAmount: Number(spinWinAmount) || 5,
      minWithdrawalLimit: Number(minWithdrawal) || 20,
    });
    setChannelLink(cleanChannel);
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityToast(null);

    if (newPassInput !== confirmPassInput) {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: 'New password and confirm password do not match!' });
      return;
    }

    const res = updateAdminPassword(currentPassInput, newPassInput);
    if (res.success) {
      triggerHaptic('success');
      setSecurityToast({ type: 'success', message: 'Password changed successfully! Keep it safe.' });
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setAdminCreds(getAdminCredentials());
    } else {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: res.error || 'Failed to update password' });
    }
  };

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityToast(null);
    const res = updateAdminEmail(newEmailInput);
    if (res.success) {
      triggerHaptic('success');
      setSecurityToast({ type: 'success', message: 'Admin Gmail updated successfully!' });
      setAdminCreds(getAdminCredentials());
    } else {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: res.error || 'Failed to update email' });
    }
  };

  const handleApplyUserAdjustments = (targetUser: UserProfile) => {
    triggerHaptic('success');
    let msg = '';
    const spins = parseInt(spinsToAdd);
    if (!isNaN(spins) && spins !== 0) {
      addSpinsToUser(targetUser.id, spins);
      msg += `${spins > 0 ? '+' : ''}${spins} Spins `;
    }

    const bal = parseFloat(balanceToAdd);
    if (!isNaN(bal) && bal !== 0) {
      addBalanceToUser(targetUser.id, bal, 'Admin Manual Adjustment');
      msg += `${bal > 0 ? '+' : ''}₹${bal} Balance `;
    }

    if (msg) {
      setUserActionToast(`✅ Successfully applied ${msg} to User #${targetUser.id}`);
      setSpinsToAdd('');
      setBalanceToAdd('');
      setUsers(getAllUsers());
      setTimeout(() => setUserActionToast(null), 3500);
    }
  };

  const handleOpenBalanceModal = (
    user: UserProfile,
    defaultMode: 'add' | 'deduct' | 'set' = 'set',
    defaultAmount = ''
  ) => {
    triggerHaptic('light');
    setBalanceModal({
      isOpen: true,
      user,
      mode: defaultMode,
      amount: defaultAmount || (defaultMode === 'set' ? String(user.balance) : ''),
      reason:
        defaultMode === 'deduct'
          ? 'Manual deduction / correction'
          : defaultMode === 'add'
          ? 'Giveaway bonus'
          : 'Admin balance direct set',
      spins: '',
    });
  };

  const handleConfirmBalanceAdjustment = () => {
    if (!balanceModal.user) return;
    const { user, mode, amount, reason, spins } = balanceModal;
    const numAmount = parseFloat(amount);
    const numSpins = parseInt(spins);

    let hasUpdated = false;
    const toastParts: string[] = [];

    if (!isNaN(numAmount)) {
      const res = adjustUserBalance(user.id, mode, numAmount, reason);
      if (res.success) {
        hasUpdated = true;
        toastParts.push(res.message || 'Balance updated');
      } else {
        triggerHaptic('error');
        setUserActionToast(`❌ ${res.message}`);
        setTimeout(() => setUserActionToast(null), 4000);
        return;
      }
    }

    if (!isNaN(numSpins) && numSpins !== 0) {
      addSpinsToUser(user.id, numSpins);
      hasUpdated = true;
      toastParts.push(`${numSpins > 0 ? '+' : ''}${numSpins} Spins`);
    }

    if (hasUpdated) {
      triggerHaptic('success');
      setUsers(getAllUsers());
      setUserActionToast(`✅ User #${user.id} (${user.name}): ${toastParts.join(' | ')}`);
      setBalanceModal((prev) => ({ ...prev, isOpen: false }));
      setTimeout(() => setUserActionToast(null), 4500);
    } else {
      triggerHaptic('error');
      setUserActionToast('⚠️ Please enter a valid amount or spins to adjust.');
      setTimeout(() => setUserActionToast(null), 3500);
    }
  };

  const handleSelectThemePreset = (presetKey: ThemePreset) => {
    triggerHaptic('medium');
    const p = THEME_PRESETS[presetKey];
    saveTheme({
      preset: presetKey,
      primaryColor: p.primary,
      glowColor: p.glow,
      bgGradientStart: p.bgStart,
      bgGradientEnd: p.bgEnd,
    });
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN: Shown if not authenticated
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900/90 border border-sky-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Top glow decoration */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-sky-500/30 mb-3 border border-white/20">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <h1 className="font-['Outfit'] font-black text-2xl text-white tracking-tight">
              Admin Control Panel
            </h1>
            <p className="text-xs text-sky-200 mt-1">
              Secure Administration Portal (/admin)
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Gmail / Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter admin email address"
                  autoComplete="off"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="new-password"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-sky-600/30 active:scale-95 transition-all mt-2"
            >
              Sign In to Admin Dashboard 🔐
            </button>
          </form>

          {/* Return to user app link */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onNavigateToUserApp}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to User App (Live Client)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length;
  const approvedCount = withdrawals.filter((w) => w.status === 'approved').length;
  const rejectedCount = withdrawals.filter((w) => w.status === 'rejected').length;

  const displayedWithdrawals = withdrawals
    .filter((w) => {
      if (withdrawalFilter === 'all') return true;
      return w.status === withdrawalFilter;
    })
    .sort((a, b) => {
      if (withdrawalFilter === 'all') {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
      u.id.includes(searchUserQuery) ||
      u.username.toLowerCase().includes(searchUserQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Admin Navbar */}
      <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-['Outfit'] font-black text-lg text-white leading-tight">
                  Admin Control Panel
                </h1>
                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {adminCreds.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>

            <button
              onClick={onNavigateToUserApp}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">User App</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 border-b border-slate-800 no-scrollbar">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Withdrawals</span>
            {pendingCount > 0 && (
              <span className="bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-full text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'users'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users &amp; Spins</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'security'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Password &amp; Security</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'settings'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Bot &amp; App Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'theme'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Theme &amp; Colors</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>📥 Download Bot Files &amp; HTML</span>
          </button>
        </div>

        {/* ----------------- TAB 1: WITHDRAWALS ----------------- */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-['Outfit'] font-black text-xl text-white">
                    Withdrawal Requests Queue
                  </h2>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Live Realtime Sync" />
                </div>
                <p className="text-xs text-slate-400">
                  Realtime pending UPI and Bank withdrawal requests from users
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
                </button>

                {/* Clean Approved & Rejected History Button */}
                <button
                  onClick={handleCleanProcessedWithdrawals}
                  className="bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Delete only Approved and Rejected history from database to keep queue clean"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clean History</span>
                </button>

                {/* Clear Entire Database Button */}
                <button
                  onClick={handleClearAllWithdrawals}
                  className="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Permanently delete all withdrawals so database stays completely empty"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All DB 🗑️</span>
                </button>

                <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  Total: {withdrawals.length}
                </span>
              </div>
            </div>

            {/* Live Notification Toast */}
            {withdrawalToast && (
              <div className="p-3 bg-sky-500/20 border border-sky-500/50 text-sky-200 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-fade-in shadow-md">
                <span>{withdrawalToast}</span>
                <button onClick={() => setWithdrawalToast(null)} className="text-sky-300 hover:text-white text-xs">✕</button>
              </div>
            )}

            {/* Pending Requests Alert Banner */}
            {pendingCount > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-lg shadow-amber-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="font-['Outfit'] font-black text-amber-300 text-base leading-tight">
                      {pendingCount} Pending Withdrawal Request{pendingCount > 1 ? 's' : ''} Received!
                    </h4>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      Users have submitted payout requests via UPI &amp; Bank. Review and approve below.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWithdrawalFilter('pending')}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-['Outfit'] font-black text-xs px-4 py-2 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  View Pending Queue ({pendingCount})
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setWithdrawalFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  withdrawalFilter === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                All ({withdrawals.length})
              </button>
              <button
                onClick={() => setWithdrawalFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  withdrawalFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-amber-500/30'
                }`}
              >
                <span>Pending</span>
                <span className="bg-amber-400/30 text-current px-1.5 py-0.2 rounded-full text-[10px]">
                  {pendingCount}
                </span>
              </button>
              <button
                onClick={() => setWithdrawalFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  withdrawalFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-900 text-emerald-400 hover:bg-slate-800 border border-emerald-500/30'
                }`}
              >
                Approved ({approvedCount})
              </button>
              <button
                onClick={() => setWithdrawalFilter('rejected')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  withdrawalFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-slate-900 text-rose-400 hover:bg-slate-800 border border-rose-500/30'
                }`}
              >
                Rejected ({rejectedCount})
              </button>
            </div>

            {displayedWithdrawals.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-500">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50 text-slate-400" />
                <p className="font-bold text-sm">No {withdrawalFilter !== 'all' ? withdrawalFilter : ''} withdrawal requests found</p>
                <p className="text-xs mt-1">
                  Requests created by users will automatically show up here in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedWithdrawals.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-['Outfit'] font-black text-lg text-emerald-400">
                          ₹{item.amount}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            item.status === 'pending'
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : item.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: #{item.id}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                        <strong className="text-white">{item.userName}</strong>
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.userId, `withdrawal_uid_${item.id}`)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                            copiedItemKey === `withdrawal_uid_${item.id}`
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-700 hover:border-slate-600'
                          } cursor-pointer active:scale-95`}
                          title="Click to copy User ID"
                        >
                          <span>User #{item.userId}</span>
                          {copiedItemKey === `withdrawal_uid_${item.id}` ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {item.method === 'upi' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-xs font-mono text-sky-300 bg-sky-950/40 border border-sky-800/40 px-3 py-1.5 rounded-xl inline-flex items-center gap-2">
                            <span>UPI ID: <strong className="text-white select-all">{item.upiId}</strong></span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.upiId || '', `upi_${item.id}`)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              copiedItemKey === `upi_${item.id}`
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700 hover:border-sky-500/50'
                            } active:scale-95 cursor-pointer`}
                            title="Copy UPI ID"
                          >
                            {copiedItemKey === `upi_${item.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy UPI</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-xs font-mono text-sky-300 bg-sky-950/40 border border-sky-800/40 px-3 py-2 rounded-xl flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 flex-wrap">
                            <span>Bank: <strong className="text-white">{item.bankName || 'N/A'}</strong></span>
                            <span>A/C: <strong className="text-white select-all">{item.accountNumber}</strong></span>
                            <span>IFSC: <strong className="text-white select-all">{item.ifsc}</strong></span>
                            <span>Name: <strong className="text-white">{item.accountHolder}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleCopyText(item.accountNumber || '', `acc_${item.id}`)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                copiedItemKey === `acc_${item.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                              } active:scale-95 cursor-pointer`}
                              title="Copy Account Number"
                            >
                              {copiedItemKey === `acc_${item.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>A/C Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy A/C No</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyText(item.ifsc || '', `ifsc_${item.id}`)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                copiedItemKey === `ifsc_${item.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                              } active:scale-95 cursor-pointer`}
                              title="Copy IFSC Code"
                            >
                              {copiedItemKey === `ifsc_${item.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>IFSC Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy IFSC</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const details = `Bank: ${item.bankName || 'N/A'}\nA/C Number: ${item.accountNumber}\nIFSC: ${item.ifsc}\nA/C Holder: ${item.accountHolder}`;
                                handleCopyText(details, `bank_all_${item.id}`);
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                copiedItemKey === `bank_all_${item.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700 hover:border-sky-500/50'
                              } active:scale-95 cursor-pointer`}
                              title="Copy All Bank Details"
                            >
                              {copiedItemKey === `bank_all_${item.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>All Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy All Details</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-500">
                        Created: {new Date(item.createdAt).toLocaleString()}
                        {item.rejectReason && (
                          <span className="text-rose-400 ml-2 font-medium">
                            Reason: {item.rejectReason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {item.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveWithdrawal(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/30 transition-all active:scale-95 cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve &amp; Pay</span>
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(item.id)}
                            className="bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-rose-500/40 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteSingleWithdrawal(item.id)}
                        title="Permanently delete this record from Firebase database"
                        className="bg-slate-800/90 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 hover:border-rose-500 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400 group-hover:text-white" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: USERS & SPINS ----------------- */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-['Outfit'] font-black text-xl text-white">
                  Users Database &amp; Spin Management
                </h2>
                <p className="text-xs text-slate-400">
                  Manage user balances, spins, referrals, and adjustments
                </p>
              </div>

              <input
                type="text"
                placeholder="Search user by name or ID..."
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-sm px-4 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {userActionToast && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold animate-fade-in">
                {userActionToast}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <strong className="text-white text-sm block leading-tight">{u.name}</strong>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">@{u.username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(u.id, `portal_user_${u.id}`)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                                copiedItemKey === `portal_user_${u.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                  : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-700 hover:border-slate-600'
                              } cursor-pointer active:scale-95`}
                              title="Click to copy User ID"
                            >
                              <span>#{u.id}</span>
                              {copiedItemKey === `portal_user_${u.id}` ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                        ₹{u.balance.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Current Spins</span>
                        <strong className="text-sm font-['Outfit'] font-black text-sky-300">{u.spins}</strong>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Friends Joined</span>
                        <strong className="text-sm font-['Outfit'] font-black text-emerald-300">{u.friendsJoined || 0}</strong>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Spins Earned</span>
                        <strong className="text-sm font-['Outfit'] font-black text-amber-300">{u.spinsEarned || 0}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Adjuster for this user */}
                  <div className="border-t border-slate-800 pt-3 space-y-2.5">
                    {/* Primary Button to open rich Balance Manager Modal */}
                    <button
                      type="button"
                      onClick={() => handleOpenBalanceModal(u, 'set')}
                      className="w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-['Outfit'] font-black text-xs py-2.5 rounded-xl shadow-md shadow-sky-950/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust Amount &amp; Reason (बैलेंस सेट / घटाएं)</span>
                    </button>

                    {/* Fast 1-Click Action Chips */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenBalanceModal(u, 'add', '50')}
                        className="py-1 px-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95"
                        title="Add ₹50 to user balance"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>₹50</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBalanceModal(u, 'deduct', '50')}
                        className="py-1 px-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95"
                        title="Deduct ₹50 from user balance"
                      >
                        <Minus className="w-2.5 h-2.5" />
                        <span>₹50</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBalanceModal(u, 'set')}
                        className="py-1 px-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95"
                        title="Directly set exact balance"
                      >
                        <span>Set =₹</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('success');
                          addSpinsToUser(u.id, 5);
                          setUsers(getAllUsers());
                          setUserActionToast(`✅ +5 Spins given to User #${u.id} (${u.name})`);
                          setTimeout(() => setUserActionToast(null), 3000);
                        }}
                        className="py-1 px-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95"
                        title="Directly give +5 spins"
                      >
                        <span>+5 Spins</span>
                      </button>
                    </div>

                    {/* Inline Quick Adjuster Inputs */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        placeholder="+/- Spins"
                        value={selectedUser?.id === u.id ? spinsToAdd : ''}
                        onChange={(e) => {
                          setSelectedUser(u);
                          setSpinsToAdd(e.target.value);
                        }}
                        className="w-1/3 bg-slate-950 border border-slate-800 text-[11px] p-2 rounded-xl text-white placeholder-slate-500 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="+/- ₹ Cash"
                        value={selectedUser?.id === u.id ? balanceToAdd : ''}
                        onChange={(e) => {
                          setSelectedUser(u);
                          setBalanceToAdd(e.target.value);
                        }}
                        className="w-1/3 bg-slate-950 border border-slate-800 text-[11px] p-2 rounded-xl text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyUserAdjustments(u)}
                        className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl whitespace-nowrap border border-slate-700 active:scale-95 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- TAB 3: PASSWORD & SECURITY (ROHIT'S REQUEST) ----------------- */}
        {activeTab === 'security' && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Admin Security &amp; Password Management
              </h2>
              <p className="text-xs text-slate-400">
                Change your admin password and credentials. Saved directly into secure database.
              </p>
            </div>

            {securityToast && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
                  securityToast.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {securityToast.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{securityToast.message}</span>
              </div>
            )}

            {/* Change Password Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-['Outfit'] font-bold text-sm text-white">
                  Change Admin Password
                </h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-['Outfit'] font-black text-sm py-3.5 rounded-xl shadow-lg shadow-amber-600/20 active:scale-95 transition-all"
                >
                  Update Admin Password 🔒
                </button>
              </form>
            </div>

            {/* Change Admin Email Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Mail className="w-5 h-5 text-sky-400" />
                <h3 className="font-['Outfit'] font-bold text-sm text-white">
                  Admin Email / Gmail
                </h3>
              </div>

              <form onSubmit={handleChangeEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Registered Admin Gmail
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="Enter new admin email"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl transition-colors border border-slate-700"
                >
                  Save Admin Gmail
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: APP & BOT SETTINGS ----------------- */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Bot &amp; App Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Manage bot links, channel URL, win amounts, and limits
              </p>
            </div>

            {settingsSavedToast && (
              <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Settings saved and broadcasted to all active clients!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Telegram Bot Username (without @)
                </label>
                <input
                  type="text"
                  required
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="RohitGiveawayBot"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Official Telegram Channel (Link or @username)
                  </label>
                  {channelLink && (
                    <a
                      href={channelLink.startsWith('http') ? channelLink : `https://t.me/${channelLink.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-400 hover:text-sky-300 underline font-semibold flex items-center gap-1"
                    >
                      Test Link ↗
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={channelLink}
                  onChange={(e) => setChannelLink(e.target.value)}
                  placeholder="https://t.me/yourchannel or @yourchannel"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports public channels (e.g. <code>https://t.me/RohitGiveaway</code> or <code>@RohitGiveaway</code>) and private links (e.g. <code>https://t.me/+AbCdEfGh</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Application Title
                </label>
                <input
                  type="text"
                  required
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="Rohit Giveaway"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Spin Win Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={spinWinAmount}
                    onChange={(e) => setSpinWinAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Min Withdrawal Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minWithdrawal}
                    onChange={(e) => setMinWithdrawal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-['Outfit'] font-black text-sm py-3.5 rounded-xl shadow-lg shadow-sky-600/30 active:scale-95 transition-all mt-4"
              >
                Save App Settings 💾
              </button>
            </form>
          </div>
        )}

        {/* ----------------- TAB 5: THEME & BRANDING ----------------- */}
        {activeTab === 'theme' && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Theme Presets &amp; Brand Styling
              </h2>
              <p className="text-xs text-slate-400">
                Choose a visual preset for the Telegram Mini App client
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => {
                const p = THEME_PRESETS[key];
                const isSelected = theme.preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectThemePreset(key)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-sky-400 bg-sky-950/40 shadow-lg shadow-sky-500/20'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-7 h-7 rounded-full shadow-inner border border-white/40"
                        style={{ backgroundColor: p.primary }}
                      />
                      {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                    </div>
                    <span className="font-bold text-xs text-white">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------- TAB 6: BOT FILES & STANDALONE HTML EXPORT ----------------- */}
        {activeTab === 'code' && (
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {/* Telegram Bot Script & Requirements Downloads */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <div className="mb-4">
                <h2 className="font-['Outfit'] font-black text-xl text-white flex items-center gap-2">
                  <span>🤖 Download Telegram Bot Files</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Download production-ready Python Telegram bot script (`bot.py`) and requirements (`requirements.txt`) to run on your VPS or computer.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <a
                  href="/bot.py"
                  download="bot.py"
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                      .py
                    </div>
                    <div>
                      <span className="font-bold text-sm block text-white group-hover:text-emerald-300">
                        bot.py
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Complete Telegram Bot Code
                      </span>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                </a>

                <a
                  href="/requirements.txt"
                  download="requirements.txt"
                  className="bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 p-4 rounded-2xl flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono font-bold text-sm">
                      .txt
                    </div>
                    <div>
                      <span className="font-bold text-sm block text-white group-hover:text-sky-300">
                        requirements.txt
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Python Dependencies
                      </span>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-sky-400 group-hover:translate-y-0.5 transition-transform" />
                </a>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300">
                <span className="text-slate-500 select-none block mb-1"># Command to install &amp; run:</span>
                <span className="text-emerald-400">pip install -r requirements.txt</span>
                <span className="text-slate-400 select-none mx-2">&amp;&amp;</span>
                <span className="text-sky-400">python3 bot.py</span>
              </div>
            </div>

            {/* Standalone HTML Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div>
                <h2 className="font-['Outfit'] font-black text-xl text-white">
                  Standalone Single-File HTML Generator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Export full app as a single .html file that runs directly in Telegram bots or browser!
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    const html = generateStandaloneHtml();
                    navigator.clipboard.writeText(html);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-sky-600/30"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Copied HTML!' : 'Copy Single-File HTML'}</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('success');
                    const html = generateStandaloneHtml();
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${settings.botUsername || 'giveaway'}_miniapp.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .html File</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <pre className="text-xs font-mono text-slate-400 max-h-96 overflow-y-auto whitespace-pre-wrap select-all">
                  {generateStandaloneHtml().slice(0, 3000)}...
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Balance & Amount Adjustment Modal (Add, Deduct, Set + Reason) */}
      {balanceModal.isOpen && balanceModal.user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl animate-scale-up text-slate-100 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-md text-lg">
                  💰
                </div>
                <div>
                  <h3 className="font-['Outfit'] font-black text-lg text-white leading-tight">
                    User Amount &amp; Balance Adjuster
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Set, add, or deduct user balance with custom reason (बैलेंस मैनेजमेंट)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBalanceModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Target User Info Banner */}
            <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {balanceModal.user.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-white text-sm font-bold truncate">
                      {balanceModal.user.name}
                    </strong>
                    <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 border border-sky-800/40 px-1.5 py-0.2 rounded">
                      #{balanceModal.user.id}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono truncate block">
                    @{balanceModal.user.username}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Current Balance
                </span>
                <span className="font-['Outfit'] font-black text-emerald-400 text-base">
                  ₹{balanceModal.user.balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Mode Switcher Tabs: Add (+) / Deduct (-) / Set Exact (=) */}
            <div className="mt-4">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Action Type (क्या करना चाहते हैं?)
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setBalanceModal((prev) => ({
                      ...prev,
                      mode: 'add',
                      reason: prev.reason || 'Giveaway Winner Bonus',
                    }));
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-['Outfit'] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    balanceModal.mode === 'add'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Add (+₹)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setBalanceModal((prev) => ({
                      ...prev,
                      mode: 'deduct',
                      reason: prev.reason || 'Manual Deduction / Penalty',
                    }));
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-['Outfit'] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    balanceModal.mode === 'deduct'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-700/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                  <span>Deduct (-₹)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setBalanceModal((prev) => ({
                      ...prev,
                      mode: 'set',
                      amount: prev.amount || String(balanceModal.user?.balance ?? 0),
                      reason: prev.reason || 'Admin Balance Direct Set',
                    }));
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-['Outfit'] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    balanceModal.mode === 'set'
                      ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Set Exact (=₹)</span>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {balanceModal.mode === 'add'
                    ? 'Amount to Add (₹ जोड़ें)'
                    : balanceModal.mode === 'deduct'
                    ? 'Amount to Deduct (₹ घटाएं - खाते से कम करें)'
                    : 'Set Exact Balance To (₹ सीधा नया बैलेंस सेट करें)'}
                </label>
                {balanceModal.mode === 'deduct' && (
                  <button
                    type="button"
                    onClick={() => {
                      setBalanceModal((prev) => ({
                        ...prev,
                        amount: String(balanceModal.user?.balance ?? 0),
                      }));
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  >
                    Deduct All (₹{balanceModal.user.balance.toFixed(2)})
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={balanceModal.amount}
                  onChange={(e) => setBalanceModal((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder={
                    balanceModal.mode === 'set'
                      ? `e.g. ${balanceModal.user.balance}`
                      : balanceModal.mode === 'deduct'
                      ? 'e.g. 50'
                      : 'e.g. 100'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  autoFocus
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-slate-500 font-medium">Quick Presets:</span>
                {(balanceModal.mode === 'add'
                  ? [10, 20, 50, 100, 200, 500]
                  : balanceModal.mode === 'deduct'
                  ? [10, 20, 50, 100, 200, 500]
                  : [0, 10, 20, 50, 100, 200, 500]
                ).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBalanceModal((prev) => ({ ...prev, amount: String(val) }));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 cursor-pointer active:scale-95"
                  >
                    {balanceModal.mode === 'add'
                      ? `+₹${val}`
                      : balanceModal.mode === 'deduct'
                      ? `-₹${val}`
                      : `₹${val}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Input (Wajah / Karon) - matching Rohit's exact request */}
            <div className="mt-4">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Reason / Karon (वजह / कारण) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={balanceModal.reason}
                onChange={(e) => setBalanceModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Giveaway winner bonus, Multi-account penalty, Refund, Task verification"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />

              {/* Quick Reason Chips */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {[
                  '🎁 Giveaway Winner Bonus',
                  '⭐ Special Reward',
                  '⚠️ Multi-account Penalty',
                  '🔄 Admin Correction',
                  '❌ Fake Referral Reversal',
                  '💰 Manual Compensation',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBalanceModal((prev) => ({ ...prev, reason: chip }));
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                      balanceModal.reason === chip
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Note: Ye reason user ke Wallet passbook aur transactions history me clearly dikhega.
              </p>
            </div>

            {/* Optional Spins Adjuster */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Also Adjust Spins (Optional)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Current Spins: {balanceModal.user.spins}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={balanceModal.spins}
                  onChange={(e) => setBalanceModal((prev) => ({ ...prev, spins: e.target.value }))}
                  placeholder="+/- Spins (e.g. +5 or -2)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setBalanceModal((prev) => ({ ...prev, spins: '5' }))}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer"
                >
                  +5 Spins
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceModal((prev) => ({ ...prev, spins: '10' }))}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer"
                >
                  +10 Spins
                </button>
              </div>
            </div>

            {/* Live Calculation Box */}
            {(() => {
              const current = balanceModal.user.balance;
              const inputNum = parseFloat(balanceModal.amount);
              let nextBal = current;
              let change = 0;
              if (!isNaN(inputNum)) {
                if (balanceModal.mode === 'add') {
                  change = inputNum;
                  nextBal = current + inputNum;
                } else if (balanceModal.mode === 'deduct') {
                  nextBal = Math.max(0, current - inputNum);
                  change = nextBal - current;
                } else if (balanceModal.mode === 'set') {
                  nextBal = Math.max(0, inputNum);
                  change = nextBal - current;
                }
              }

              return (
                <div className="mt-4 p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Calculation Preview
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-slate-400">₹{current.toFixed(2)}</span>
                      <span className="text-slate-500 font-bold">➔</span>
                      <span
                        className={`font-['Outfit'] font-black text-sm ${
                          change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        ₹{nextBal.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                          change > 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : change < 0
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {change >= 0 ? `+₹${change.toFixed(2)}` : `-₹${Math.abs(change).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Passbook Tag
                    </span>
                    <span
                      className="text-[10px] text-slate-300 font-medium truncate max-w-[130px] block"
                      title={balanceModal.reason || 'Admin Adjustment'}
                    >
                      {balanceModal.reason || 'Admin Adjustment'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Bottom Actions */}
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setBalanceModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBalanceAdjustment}
                className={`w-full py-2.5 rounded-xl font-['Outfit'] font-black text-xs text-white transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-1.5 ${
                  balanceModal.mode === 'add'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-700/30'
                    : balanceModal.mode === 'deduct'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-700/30'
                    : 'bg-[#0284c7] hover:bg-[#0369a1] shadow-sky-600/30'
                }`}
              >
                {balanceModal.mode === 'add' ? (
                  <span>Confirm &amp; Add Amount ✅</span>
                ) : balanceModal.mode === 'deduct' ? (
                  <span>Confirm &amp; Deduct Amount 🔻</span>
                ) : (
                  <span>Confirm &amp; Set Balance 🎯</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Rejection Modal Dialog (Iframe & WebApp safe) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scale-up">
            <h3 className="font-['Outfit'] font-black text-lg text-white mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line mb-4">
              {confirmDialog.message}
            </p>

            {confirmDialog.showInput && (
              <div className="mb-4">
                {confirmDialog.inputLabel && (
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    {confirmDialog.inputLabel}
                  </label>
                )}
                <input
                  type="text"
                  value={dialogInputValue}
                  onChange={(e) => setDialogInputValue(e.target.value)}
                  placeholder={confirmDialog.inputPlaceholder}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  autoFocus
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.onConfirm(dialogInputValue)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all cursor-pointer shadow-lg active:scale-95 ${
                  confirmDialog.confirmColor === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-700/30'
                    : confirmDialog.confirmColor === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-700/30'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-700/30'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
