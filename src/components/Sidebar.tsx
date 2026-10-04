import React from "react";
import { NavTab } from "../App";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  cashDrawerPaisa: bigint;
  bankTotalPaisa: bigint;
  qrTotalPaisa: bigint;
  portalFloatTotalPaisa: bigint;
  khataDueTotalPaisa: bigint;
  timeStr: string;
  isCloudSynced: boolean;
  onOpenMoveMoney: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  cashDrawerPaisa,
  bankTotalPaisa,
  qrTotalPaisa,
  portalFloatTotalPaisa,
  khataDueTotalPaisa,
  timeStr,
  isCloudSynced,
  onOpenMoveMoney,
}) => {
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, "0");
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${cents}`;
  };

  const totalLiquidPaisa = cashDrawerPaisa + bankTotalPaisa + qrTotalPaisa + portalFloatTotalPaisa;

  return (
    <aside className="w-68 shrink-0 bg-slate-900 dark:bg-zinc-950 text-white flex flex-col h-screen border-r border-slate-800 dark:border-zinc-850 select-none sticky top-0 z-30 transition-colors">
      {/* 1. HEADER: BRAND & LIVE TIME */}
      <div className="p-4 border-b border-slate-800 dark:border-zinc-850">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-base font-black shadow-md shadow-emerald-500/20">
              ⚡
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight uppercase leading-none text-white">
                Sarkar Communication
              </h1>
              <p className="text-[9px] font-semibold text-emerald-400 tracking-wide mt-0.5">
                • Digital Seva & Banking CSP
              </p>
            </div>
          </div>
        </div>

        {/* CLOCK & STATUS */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-mono bg-slate-800/80 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-slate-700/60 dark:border-zinc-800">
          <span className="text-slate-300 dark:text-zinc-300 font-bold">{timeStr}</span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE
          </span>
        </div>
      </div>

      {/* 2. LIQUIDITY CARD: TOTAL CONSERVED CAPITAL & BALANCES */}
      <div className="p-3.5 border-b border-slate-800 dark:border-zinc-850 space-y-2.5">
        <div className="bg-gradient-to-br from-slate-800 to-slate-850 dark:from-zinc-900 dark:to-zinc-925 p-3 rounded-xl border border-slate-700/70 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">
              Total Liquid Capital
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
              Active
            </span>
          </div>
          <p className="text-lg font-black font-mono tracking-tight text-white mt-1">
            {formatPaisa(totalLiquidPaisa)}
          </p>
        </div>

        {/* MICRO-BALANCES MATRIX */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          {/* Drawer */}
          <div className="bg-slate-800/60 dark:bg-zinc-900/80 p-2 rounded-lg border border-slate-700/50 dark:border-zinc-800">
            <span className="text-[8px] block uppercase text-slate-400 dark:text-zinc-500 font-bold">
              💵 Drawer
            </span>
            <span className="font-bold text-emerald-400 block mt-0.5 truncate">
              {formatPaisa(cashDrawerPaisa)}
            </span>
          </div>

          {/* Banks */}
          <div className="bg-slate-800/60 dark:bg-zinc-900/80 p-2 rounded-lg border border-slate-700/50 dark:border-zinc-800">
            <span className="text-[8px] block uppercase text-slate-400 dark:text-zinc-500 font-bold">
              🏦 Banks
            </span>
            <span className="font-bold text-sky-400 block mt-0.5 truncate">
              {formatPaisa(bankTotalPaisa)}
            </span>
          </div>

          {/* UPI QR */}
          <div className="bg-slate-800/60 dark:bg-zinc-900/80 p-2 rounded-lg border border-slate-700/50 dark:border-zinc-800">
            <span className="text-[8px] block uppercase text-slate-400 dark:text-zinc-500 font-bold">
              📱 UPI QR
            </span>
            <span className="font-bold text-purple-400 block mt-0.5 truncate">
              {formatPaisa(qrTotalPaisa)}
            </span>
          </div>

          {/* Portal Floats */}
          <div className="bg-slate-800/60 dark:bg-zinc-900/80 p-2 rounded-lg border border-slate-700/50 dark:border-zinc-800">
            <span className="text-[8px] block uppercase text-slate-400 dark:text-zinc-500 font-bold">
              🌐 Floats
            </span>
            <span className="font-bold text-amber-400 block mt-0.5 truncate">
              {formatPaisa(portalFloatTotalPaisa)}
            </span>
          </div>
        </div>

        {/* Khata Due Bar */}
        <div className="bg-rose-950/30 border border-rose-500/20 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[10px] font-mono">
          <span className="text-rose-400 font-bold">👥 Khata Due:</span>
          <span className="font-black text-rose-300">{formatPaisa(khataDueTotalPaisa)}</span>
        </div>

        {/* RAPID MOVE MONEY ACTION */}
        <button
          type="button"
          onClick={onOpenMoveMoney}
          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 transition cursor-pointer"
        >
          <span>🔄</span> Move Money (Contra) <kbd className="bg-indigo-700 px-1 py-0.5 rounded text-[9px]">F6</kbd>
        </button>
      </div>

      {/* 3. CORE 6 NAVIGATION MODULES */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2.5 py-1">
          Counter Operations
        </p>

        {/* 1. Express POS */}
        <button
          type="button"
          onClick={() => onSelectTab("pos")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "pos"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-300 dark:text-zinc-400 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚡</span>
            <span>Express POS</span>
          </div>
          <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${activeTab === "pos" ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            F1
          </kbd>
        </button>

        {/* 2. Biometric CSP */}
        <button
          type="button"
          onClick={() => onSelectTab("csp")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "csp"
              ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
              : "text-slate-300 dark:text-zinc-400 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🏧</span>
            <span>Biometric CSP (AEPS)</span>
          </div>
          <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${activeTab === "csp" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            F2
          </kbd>
        </button>

        {/* 3. Recharges & BBPS */}
        <button
          type="button"
          onClick={() => onSelectTab("bbps")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "bbps"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-300 dark:text-zinc-400 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚡</span>
            <span>Recharges & BBPS</span>
          </div>
          <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${activeTab === "bbps" ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            F3
          </kbd>
        </button>

        {/* 4. Khata & Stock */}
        <button
          type="button"
          onClick={() => onSelectTab("khata_stock")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "khata_stock"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-300 dark:text-zinc-400 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">👥</span>
            <span>Khata & Stock</span>
          </div>
          <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${activeTab === "khata_stock" ? "bg-purple-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            F4
          </kbd>
        </button>

        {/* 5. CashBook & Accounts */}
        <button
          type="button"
          onClick={() => onSelectTab("accounts")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "accounts"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-300 dark:text-zinc-400 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🏦</span>
            <span>CashBook & Accounts</span>
          </div>
          <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${activeTab === "accounts" ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            F5
          </kbd>
        </button>

        {/* 6. Settings */}
        <button
          type="button"
          onClick={() => onSelectTab("settings")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "settings"
              ? "bg-slate-700 dark:bg-zinc-800 text-white shadow-md"
              : "text-slate-400 dark:text-zinc-500 hover:bg-slate-800 dark:hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚙️</span>
            <span>Settings</span>
          </div>
        </button>
      </div>

      {/* 4. FOOTER: OPERATOR & THEME SWITCH */}
      <div className="p-3 border-t border-slate-800 dark:border-zinc-850 space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <div>
            <p className="font-bold text-white text-[11px]">Saikat Sarkar</p>
            <p className="text-[9px] text-slate-400">Admin • Counter 01</p>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            title="Toggle Daylight / Dark Theme (Alt+T)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>

        <div className="flex items-center justify-between text-[9px] px-1 text-slate-500 dark:text-zinc-500 font-mono">
          <span>DigitalCafe ERP v1.0</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {isCloudSynced ? "Cloud Synced" : "Local-First"}
          </span>
        </div>
      </div>
    </aside>
  );
};
