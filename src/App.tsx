import { useState, useEffect } from "react";
import {
  INITIAL_ACCOUNTS,
  INITIAL_CUSTOMERS,
  INITIAL_CATALOG_ITEMS,
  INITIAL_CREDIT_CARDS,
  TreasuryAccount,
  Customer,
  CatalogItem,
  CreditCardItem,
  DigitalTransaction,
  InvoiceRecord,
  CashBookEntry,
} from "./core/contracts";
import { createContraTransferJournal, JournalEntry } from "./core/ledger";
import {
  fetchLiveAccounts,
  fetchLiveCustomers,
  fetchLiveCatalogItems,
  supabase,
} from "./core/supabase";

export type NavTab = "pos" | "csp" | "bbps" | "khata_stock" | "accounts" | "settings";

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("pos");

  // Daylight / Obsidian Dark Theme (Default: Daylight)
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("dc_theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dc_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dc_theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Live IST Clock
  const [timeStr, setTimeStr] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live Accounts & State (Zero Preloaded Data)
  const [accounts, setAccounts] = useState<TreasuryAccount[]>(INITIAL_ACCOUNTS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(INITIAL_CATALOG_ITEMS);
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>(INITIAL_CREDIT_CARDS);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [digitalTransactions, setDigitalTransactions] = useState<DigitalTransaction[]>([]);
  const [cashBookEntries, setCashBookEntries] = useState<CashBookEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  // Cloud Sync on Mount
  useEffect(() => {
    fetchLiveAccounts().then((accs) => {
      if (accs && accs.length > 0) setAccounts(accs);
    });
    fetchLiveCustomers().then((custs) => {
      if (custs && custs.length > 0) setCustomers(custs);
    });
    fetchLiveCatalogItems().then((items) => {
      if (items && items.length > 0) setCatalogItems(items);
    });
  }, []);

  // 1-Click Move Money (Contra Modal)
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveFromId, setMoveFromId] = useState("acc-bank-sbi");
  const [moveToId, setMoveToId] = useState("acc-cash");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 4000);
  };

  // 5 Liquidity Pillars Calculations
  const cashAccount = accounts.find((a) => a.type === "CASH") || INITIAL_ACCOUNTS[0];
  const bankAccounts = accounts.filter((a) => a.type === "BANK");
  const qrAccounts = accounts.filter((a) => a.type === "UPI_HOLDING");
  const portalAccounts = accounts.filter((a) => a.type === "WALLET");

  const totalBankPaisa = bankAccounts.reduce((sum, b) => sum + b.currentBalancePaisa, 0n);
  const totalQrPaisa = qrAccounts.reduce((sum, q) => sum + q.currentBalancePaisa, 0n);
  const totalPortalFloatPaisa = portalAccounts.reduce((sum, p) => sum + p.currentBalancePaisa, 0n);
  const totalKhataDuePaisa = customers.reduce((sum, c) => sum + c.currentDuePaisa, 0n);

  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, "0");
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${cents}`;
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("pos");
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("csp");
      } else if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("bbps");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("khata_stock");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveTab("accounts");
      } else if (e.key === "F6") {
        e.preventDefault();
        setIsMoveOpen(true);
      } else if (e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        setIsDark((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle Contra Move Money
  const handleConfirmMoveMoney = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPaisa = BigInt(Math.round(parseFloat(moveAmount || "0") * 100));
    if (parsedPaisa <= 0n) {
      alert("Please enter a valid amount to transfer.");
      return;
    }
    if (moveFromId === moveToId) {
      alert("Source and Destination accounts cannot be the same.");
      return;
    }

    const fromAcc = accounts.find((a) => a.id === moveFromId)!;
    const toAcc = accounts.find((a) => a.id === moveToId)!;

    const contraJournal = createContraTransferJournal({
      transferId: `MOV-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split("T")[0],
      time: timeStr,
      amountPaisa: parsedPaisa,
      fromAccount: fromAcc,
      toAccount: toAcc,
      note: moveNote || `Move ${formatPaisa(parsedPaisa)} from ${fromAcc.name} to ${toAcc.name}`,
    });

    // Update balances
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === fromAcc.id) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa - parsedPaisa };
        }
        if (acc.id === toAcc.id) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + parsedPaisa };
        }
        return acc;
      })
    );

    // If Cash involved, log in Cash Book
    if (fromAcc.type === "CASH") {
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          time: timeStr,
          description: `Move Outward to ${toAcc.name}`,
          type: "OUT",
          amountPaisa: parsedPaisa,
          runningBalancePaisa: cashAccount.currentBalancePaisa - parsedPaisa,
          category: "CONTRA_TRANSFER",
        },
        ...prev,
      ]);
    } else if (toAcc.type === "CASH") {
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          time: timeStr,
          description: `Move Inward from ${fromAcc.name}`,
          type: "IN",
          amountPaisa: parsedPaisa,
          runningBalancePaisa: cashAccount.currentBalancePaisa + parsedPaisa,
          category: "CONTRA_TRANSFER",
        },
        ...prev,
      ]);
    }

    setJournalEntries((prev) => [contraJournal, ...prev]);
    setIsMoveOpen(false);
    setMoveAmount("");
    setMoveNote("");
    showToast(`✓ Moved ${formatPaisa(parsedPaisa)} from ${fromAcc.name} ➔ ${toAcc.name}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* ==================================================================== */}
      {/* ZONE 1: PERMANENT TOP FINANCIAL DASHBOARD (Always Visible Across Tabs) */}
      {/* ==================================================================== */}
      <header className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-6 py-2.5 sticky top-0 z-40 transition-colors shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* BRANDING & IST CLOCK */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white text-lg font-black shadow-md shadow-emerald-500/20">
                ⚡
              </span>
              <div>
                <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
                  Sarkar Communication
                </h1>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 tracking-wide mt-0.5">
                  Digital Seva & Banking CSP
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-zinc-800 text-xs font-mono">
              <span className="text-slate-700 dark:text-zinc-300 font-bold">{timeStr}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>

          {/* 5 LIVE LIQUIDITY PILLARS */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs font-semibold">
            {/* Drawer */}
            <div className="bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-sm">💵</span>
              <div>
                <span className="text-[9px] block uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Cash Drawer
                </span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {formatPaisa(cashAccount.currentBalancePaisa)}
                </span>
              </div>
            </div>

            {/* Banks */}
            <div className="bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-sm">🏦</span>
              <div>
                <span className="text-[9px] block uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Banks
                </span>
                <span className="font-mono font-black text-sky-600 dark:text-sky-400">
                  {formatPaisa(totalBankPaisa)}
                </span>
              </div>
            </div>

            {/* UPI QR */}
            <div className="bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-sm">📱</span>
              <div>
                <span className="text-[9px] block uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  UPI QR
                </span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400">
                  {formatPaisa(totalQrPaisa)}
                </span>
              </div>
            </div>

            {/* Portal Floats */}
            <div className="bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-sm">🌐</span>
              <div>
                <span className="text-[9px] block uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Floats
                </span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                  {formatPaisa(totalPortalFloatPaisa)}
                </span>
              </div>
            </div>

            {/* Khata Due */}
            <div className="bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-sm">👥</span>
              <div>
                <span className="text-[9px] block uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Khata Due
                </span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                  {formatPaisa(totalKhataDuePaisa)}
                </span>
              </div>
            </div>
          </div>

          {/* TOP ACTIONS */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMoveOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition cursor-pointer"
            >
              <span>🔄</span> Move Money <kbd className="hidden lg:inline bg-indigo-700 px-1 rounded text-[9px]">F6</kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle Theme (Alt+T)"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs transition cursor-pointer"
            >
              {isDark ? "☀️" : "🌙"}
            </button>

            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                supabase
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${supabase ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              {supabase ? "Cloud" : "Local"}
            </span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* ZONE 2: 6 CORE DEDICATED WORKSPACE TABS */}
        {/* ==================================================================== */}
        <nav className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "pos"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>⚡</span> Express POS <kbd className="hidden sm:inline bg-black/20 px-1 rounded text-[9px]">F1</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("csp")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "csp"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>🏧</span> Biometric CSP <kbd className="hidden sm:inline bg-black/20 px-1 rounded text-[9px]">F2</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bbps")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "bbps"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>⚡</span> Recharges & BBPS <kbd className="hidden sm:inline bg-black/20 px-1 rounded text-[9px]">F3</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("khata_stock")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "khata_stock"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>👥</span> Khata & Stock <kbd className="hidden sm:inline bg-black/20 px-1 rounded text-[9px]">F4</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "accounts"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>🏦</span> CashBook & Accounts <kbd className="hidden sm:inline bg-black/20 px-1 rounded text-[9px]">F5</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ml-auto cursor-pointer ${
              activeTab === "settings"
                ? "bg-slate-800 dark:bg-zinc-700 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>⚙️</span> Settings
          </button>
        </nav>
      </header>

      {/* TOAST NOTICE */}
      {toastNotice && (
        <div className="bg-emerald-600 text-white text-xs font-black px-6 py-2 text-center shadow-lg animate-in slide-in-from-top-2 duration-150 sticky top-[90px] z-30">
          {toastNotice}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ACTIVE WORKSPACE CONTENT AREA */}
      {/* ==================================================================== */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === "pos" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">⚡</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 1: Express Counter POS</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Ready for Phase 4: One-click service tiles, PDF receipt downloads, thermal printing, and catalog manager.
            </p>
          </div>
        )}

        {activeTab === "csp" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">🏧</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 2: Biometric CSP Kiosk</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              AEPS, DMT, and UPI Cash Out with passbook statement calculations and 4 fee collection modes.
            </p>
          </div>
        )}

        {activeTab === "bbps" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">⚡</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 3: Recharges, BBPS & Utility Hub</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Mobile/DTH, WBSEDCL electricity bills, Fastag, and Google Play voucher record-keeping.
            </p>
          </div>
        )}

        {activeTab === "khata_stock" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">👥</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 4: Customer Khata & Consumables Stock</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Customer udhaar credit ledger + wholesale consumables purchase & stock tracking.
            </p>
          </div>
        )}

        {activeTab === "accounts" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">🏦</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 5: Cash Drawer & Accounts Hub</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Daily Cash Book, physical note denomination counter, Section 194N tracker, and P&L.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">⚙️</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 6: Settings & Backup</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Shop profile, accounts manager, printer configurations, and local backup.
            </p>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* UNIVERSAL CONTRA MOVE MONEY MODAL */}
      {/* ==================================================================== */}
      {isMoveOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🔄</span> Universal Move Money (Contra)
              </h3>
              <button
                type="button"
                onClick={() => setIsMoveOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmMoveMoney} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Source Account (FROM)
                </label>
                <select
                  value={moveFromId}
                  onChange={(e) => setMoveFromId(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts
                    .filter((a) => a.type !== "INCOME" && a.type !== "EXPENSE")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPaisa(a.currentBalancePaisa)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Destination Account (TO)
                </label>
                <select
                  value={moveToId}
                  onChange={(e) => setMoveToId(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts
                    .filter((a) => a.type !== "INCOME" && a.type !== "EXPENSE")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPaisa(a.currentBalancePaisa)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Transfer Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Remarks / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ATM cash withdrawal for drawer"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoveOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
