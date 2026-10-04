import React from "react";
import { NavTab } from "../App";
import {
  Wallet,
  Landmark,
  QrCode,
  Globe,
  Users,
  ArrowLeftRight,
  Zap,
  Receipt,
  TrendingUp,
} from "lucide-react";

interface DashboardProps {
  cashDrawerPaisa: bigint;
  bankTotalPaisa: bigint;
  qrTotalPaisa: bigint;
  portalFloatTotalPaisa: bigint;
  khataDueTotalPaisa: bigint;
  timeStr: string;
  onSelectTab: (tab: NavTab) => void;
  onOpenMoveMoney: () => void;
}

export const DashboardOverview: React.FC<DashboardProps> = ({
  cashDrawerPaisa,
  bankTotalPaisa,
  qrTotalPaisa,
  portalFloatTotalPaisa,
  khataDueTotalPaisa,
  timeStr,
  onSelectTab,
  onOpenMoveMoney,
}) => {
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, "0");
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${cents}`;
  };

  const totalLiquidCapital =
    cashDrawerPaisa + bankTotalPaisa + qrTotalPaisa + portalFloatTotalPaisa;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP GREETING & CLOCK HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-6 rounded-2xl shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Sarkar Communication — Counter Cockpit
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Terminal 01
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time liquid capital, banking balances, and counter operations overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              {timeStr}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenMoveMoney}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-emerald-100" />
            <span>Move Money (Contra)</span>
            <kbd className="bg-emerald-700/70 dark:bg-emerald-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-100">
              F6
            </kbd>
          </button>
        </div>
      </div>

      {/* 2. TOTAL LIQUID CAPITAL HERO CARD (MULTI-COLOR GRADIENT, NEVER BLACK) */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-950/90 dark:via-slate-800 dark:to-teal-950/90 text-white p-7 rounded-3xl border border-emerald-500/40 dark:border-emerald-700/50 shadow-xl shadow-emerald-900/10 dark:shadow-emerald-950/50 relative overflow-hidden transition-colors">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-100 dark:text-emerald-300">
              <span>🛡️ Total Conserved Liquid Capital</span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 dark:bg-emerald-500/20 text-white dark:text-emerald-200 text-[10px] backdrop-blur-xs">
                4 Asset Pools
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white mt-2">
              {formatPaisa(totalLiquidCapital)}
            </p>
            <p className="text-xs text-emerald-100/90 dark:text-slate-300 mt-1.5">
              Cumulative cash drawer, bank balances, portal floats, and unsettled QR funds.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onSelectTab("pos")}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/20 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Open POS (F1)</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("csp")}
              className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 text-white backdrop-blur-xs border border-white/30 dark:border-transparent font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>🏧 Biometric CSP (F2)</span>
            </button>
          </div>
        </div>

        {/* Subtle background glow */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-cyan-300/20 dark:bg-emerald-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* 3. THE 5 LIQUIDITY PILLAR CARDS (MULTI-COLOR CARDS: LIGHT VIBRANT / DARK LIGHT-SHADE TINTED) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Pillar 1: Cash Drawer (Emerald Green) */}
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-slate-800/90 dark:to-teal-950/30 border-2 border-emerald-200/90 dark:border-emerald-700/60 p-4.5 rounded-2xl shadow-sm shadow-emerald-500/5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Cash Drawer
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-emerald-950 dark:text-emerald-100 mt-2">
            {formatPaisa(cashDrawerPaisa)}
          </p>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-300/70 mt-1 block font-medium">
            Physical desk cash box
          </span>
        </div>

        {/* Pillar 2: Bank Accounts (Sky Blue) */}
        <div className="bg-gradient-to-br from-sky-50 via-blue-50/50 to-white dark:from-sky-950/40 dark:via-slate-800/90 dark:to-blue-950/30 border-2 border-sky-200/90 dark:border-sky-700/60 p-4.5 rounded-2xl shadow-sm shadow-sky-500/5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Bank Accounts
            </span>
            <span className="p-2 rounded-xl bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/50">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-sky-950 dark:text-sky-100 mt-2">
            {formatPaisa(bankTotalPaisa)}
          </p>
          <span className="text-[10px] text-sky-600/80 dark:text-sky-300/70 mt-1 block font-medium">
            SBI, PNB & UPI apps
          </span>
        </div>

        {/* Pillar 3: UPI QR Collections (Purple Violet) */}
        <div className="bg-gradient-to-br from-purple-50 via-violet-50/50 to-white dark:from-purple-950/40 dark:via-slate-800/90 dark:to-violet-950/30 border-2 border-purple-200/90 dark:border-purple-700/60 p-4.5 rounded-2xl shadow-sm shadow-purple-500/5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              UPI QR Collections
            </span>
            <span className="p-2 rounded-xl bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-300/60 dark:border-purple-700/50">
              <QrCode className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-purple-950 dark:text-purple-100 mt-2">
            {formatPaisa(qrTotalPaisa)}
          </p>
          <span className="text-[10px] text-purple-600/80 dark:text-purple-300/70 mt-1 block font-medium">
            Soundbox & counter QR
          </span>
        </div>

        {/* Pillar 4: Portal Floats (Warm Amber) */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-white dark:from-amber-950/40 dark:via-slate-800/90 dark:to-orange-950/30 border-2 border-amber-200/90 dark:border-amber-700/60 p-4.5 rounded-2xl shadow-sm shadow-amber-500/5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Portal Floats
            </span>
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50">
              <Globe className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-amber-950 dark:text-amber-100 mt-2">
            {formatPaisa(portalFloatTotalPaisa)}
          </p>
          <span className="text-[10px] text-amber-600/80 dark:text-amber-300/70 mt-1 block font-medium">
            DigiPay & Fino Mitra
          </span>
        </div>

        {/* Pillar 5: Customer Khata Due (Coral Rose) */}
        <div className="bg-gradient-to-br from-rose-50 via-pink-50/50 to-white dark:from-rose-950/40 dark:via-slate-800/90 dark:to-pink-950/30 border-2 border-rose-200/90 dark:border-rose-700/60 p-4.5 rounded-2xl shadow-sm shadow-rose-500/5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Khata Due (Udhaar)
            </span>
            <span className="p-2 rounded-xl bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/50">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-rose-950 dark:text-rose-100 mt-2">
            {formatPaisa(khataDueTotalPaisa)}
          </p>
          <span className="text-[10px] text-rose-600/80 dark:text-rose-300/70 mt-1 block font-medium">
            Customer receivables
          </span>
        </div>
      </div>

      {/* 4. TODAY'S BUSINESS SNAPSHOT (MULTI-COLOR THEMED CARDS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card A: Rapid Counter Launchpad */}
        <div className="bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs space-y-3 transition-colors">
          <h2 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-slate-100 flex items-center gap-2">
            <span>⚡</span> Quick Counter Actions
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectTab("pos")}
              className="p-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200/90 dark:border-emerald-800/60 text-left transition cursor-pointer"
            >
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1" />
              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">Express POS</p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/60">Xerox, Print, Photos</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("csp")}
              className="p-3 rounded-xl bg-sky-50/80 hover:bg-sky-100/90 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 border border-sky-200/90 dark:border-sky-800/60 text-left transition cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-sky-600 dark:text-sky-400 mb-1" />
              <p className="text-xs font-bold text-sky-950 dark:text-sky-100">Biometric CSP</p>
              <p className="text-[10px] text-sky-700/70 dark:text-sky-300/60">AEPS & Money Transfer</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("bbps")}
              className="p-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/90 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 border border-indigo-200/90 dark:border-indigo-800/60 text-left transition cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-1" />
              <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100">BBPS & Utility</p>
              <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/60">WBSEDCL & Recharges</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("khata_stock")}
              className="p-3 rounded-xl bg-purple-50/80 hover:bg-purple-100/90 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/90 dark:border-purple-800/60 text-left transition cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 mb-1" />
              <p className="text-xs font-bold text-purple-950 dark:text-purple-100">Khata & Stock</p>
              <p className="text-[10px] text-purple-700/70 dark:text-purple-300/60">Udhaar & Paper inventory</p>
            </button>
          </div>
        </div>

        {/* Card B: Today's Net Take-Home Profit */}
        <div className="bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/40 dark:bg-slate-800/80 border border-emerald-200/80 dark:border-emerald-800/50 p-5 rounded-2xl shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-emerald-950 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>Today's Profit Snapshot</span>
            </h2>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Real-Time</span>
          </div>

          <div className="bg-white/90 dark:bg-slate-800 p-4 rounded-xl border border-emerald-100 dark:border-slate-700/60 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">POS Service Margins</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">AEPS & DMT Commissions</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Recharge & BBPS Cashback</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-slate-200/80 dark:border-slate-700">
              <span className="font-bold text-slate-900 dark:text-white">Net Take-Home Profit</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">₹0.00</span>
            </div>
          </div>
        </div>

        {/* Card C: Counter Safety & Compliance */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/40 dark:bg-slate-800/80 border border-blue-200/80 dark:border-indigo-800/50 p-5 rounded-2xl shadow-xs space-y-3 transition-colors">
          <h2 className="text-xs font-black uppercase tracking-wider text-blue-950 dark:text-slate-100 flex items-center gap-2">
            <span>🛡️</span> Bank & Tax Safety
          </h2>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800 border border-blue-100 dark:border-slate-700/60 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">Section 194N TDS Tracker</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">SAFE (0%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[0%]"></div>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                ₹0.00 withdrawn of ₹20,00,000 threshold
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800 border border-blue-100 dark:border-slate-700/60 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">ITR 44AD Presumptive Split</span>
                <button
                  type="button"
                  onClick={() => onSelectTab("accounts")}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  View Details ➔
                </button>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                Separates pass-through client banking funds from real income.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
