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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Sarkar Communication — Counter Cockpit
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Terminal 01
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Real-time liquid capital, banking balances, and counter operations overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <span className="text-xs font-black text-slate-800 dark:text-zinc-200 block">
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
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
            <span>Move Money (Contra)</span>
            <kbd className="bg-slate-800 dark:bg-zinc-900 px-1 py-0.5 rounded text-[9px] font-mono text-slate-300">
              F6
            </kbd>
          </button>
        </div>
      </div>

      {/* 2. TOTAL LIQUID CAPITAL HERO CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-zinc-900 text-white p-7 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>🛡️ Total Conserved Liquid Capital</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px]">
                4 Asset Pools
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white mt-2">
              {formatPaisa(totalLiquidCapital)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Cumulative cash drawer, bank balances, portal floats, and unsettled QR funds.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onSelectTab("pos")}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Open POS (F1)</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("csp")}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>🏧 Biometric CSP (F2)</span>
            </button>
          </div>
        </div>

        {/* Subtle background glow */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* 3. THE 5 LIQUIDITY PILLAR CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Cash Drawer */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Cash Drawer
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-2">
            {formatPaisa(cashDrawerPaisa)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
            Physical desk cash box
          </span>
        </div>

        {/* Bank Accounts */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Bank Accounts
            </span>
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-2">
            {formatPaisa(bankTotalPaisa)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
            SBI, PNB & UPI apps
          </span>
        </div>

        {/* UPI QR Holding */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              UPI QR Collections
            </span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <QrCode className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-2">
            {formatPaisa(qrTotalPaisa)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
            Soundbox & counter QR
          </span>
        </div>

        {/* Portal Floats */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Portal Floats
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Globe className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-2">
            {formatPaisa(portalFloatTotalPaisa)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
            DigiPay & Fino Mitra
          </span>
        </div>

        {/* Khata Due */}
        <div className="bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-950/60 p-4.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
              Khata Due (Udhaar)
            </span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-300 mt-2">
            {formatPaisa(khataDueTotalPaisa)}
          </p>
          <span className="text-[10px] text-rose-400 dark:text-zinc-500 mt-1 block">
            Customer receivables
          </span>
        </div>
      </div>

      {/* 4. TODAY'S BUSINESS SNAPSHOT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rapid Counter Launchpad */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <span>⚡</span> Quick Counter Actions
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectTab("pos")}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-left transition cursor-pointer"
            >
              <Zap className="w-4 h-4 text-emerald-500 mb-1" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Express POS</p>
              <p className="text-[10px] text-slate-400">Xerox, Print, Photos</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("csp")}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-left transition cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-sky-500 mb-1" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Biometric CSP</p>
              <p className="text-[10px] text-slate-400">AEPS & Money Transfer</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("bbps")}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-left transition cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-indigo-500 mb-1" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">BBPS & Utility</p>
              <p className="text-[10px] text-slate-400">WBSEDCL & Recharges</p>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("khata_stock")}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-left transition cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-500 mb-1" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Khata & Stock</p>
              <p className="text-[10px] text-slate-400">Udhaar & Paper inventory</p>
            </button>
          </div>
        </div>

        {/* Today's Net Take-Home Profit */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>Today's Profit Snapshot</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-400">Real-Time</span>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 dark:text-zinc-400">POS Service Margins</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 dark:text-zinc-400">AEPS & DMT Commissions</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 dark:text-zinc-400">Recharge & BBPS Cashback</span>
              <span className="font-mono text-slate-900 dark:text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-slate-200 dark:border-zinc-700">
              <span className="font-bold text-slate-900 dark:text-white">Net Take-Home Profit</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">₹0.00</span>
            </div>
          </div>
        </div>

        {/* Counter Safety & Compliance */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <span>🛡️</span> Bank & Tax Safety
          </h2>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-[11px]">Section 194N TDS Tracker</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">SAFE (0%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[0%]"></div>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                ₹0.00 withdrawn of ₹20,00,000 threshold
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-[11px]">ITR 44AD Presumptive Split</span>
                <button
                  type="button"
                  onClick={() => onSelectTab("accounts")}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  View Details ➔
                </button>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 block">
                Separates pass-through client banking funds from real income.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
