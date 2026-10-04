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
import { Sidebar } from "./components/Sidebar";
import { DashboardOverview } from "./components/DashboardOverview";
import { PosTerminal } from "./components/PosTerminal";

export type NavTab = "dashboard" | "pos" | "csp" | "bbps" | "khata_stock" | "accounts" | "settings";

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");

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

      if (e.key === "Escape") {
        setActiveTab("dashboard");
      } else if (e.key === "F1") {
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

  // Handle POS Counter Sale Record
  const handleRecordPosSale = ({
    invoice,
    journal,
    cashDeltaPaisa,
    qrDeltaPaisa,
    khataDeltaPaisa,
    customerPhone,
  }: {
    invoice: InvoiceRecord;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    qrDeltaPaisa: bigint;
    khataDeltaPaisa: bigint;
    customerPhone?: string;
  }) => {
    // 1. Invoices
    setInvoices((prev) => [invoice, ...prev]);

    // 2. Journal Entries
    setJournalEntries((prev) => [journal, ...prev]);

    // 3. Update accounts
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.type === "CASH" && cashDeltaPaisa > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + cashDeltaPaisa };
        }
        if (acc.type === "UPI_HOLDING" && qrDeltaPaisa > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + qrDeltaPaisa };
        }
        return acc;
      })
    );

    // 4. If Cash Tendered, write to Cash Book
    if (cashDeltaPaisa > 0n) {
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: invoice.date,
          time: invoice.time,
          description: `Counter POS #${invoice.invoiceNumber} (${invoice.items.map((i) => i.name).join(", ")})`,
          type: "IN",
          amountPaisa: cashDeltaPaisa,
          runningBalancePaisa: cashAccount.currentBalancePaisa + cashDeltaPaisa,
          category: "POS_SALE",
          referenceId: invoice.invoiceNumber,
        },
        ...prev,
      ]);
    }

    // 5. If Khata, update or add customer due
    if (khataDeltaPaisa > 0n) {
      setCustomers((prev) => {
        const existing = prev.find(
          (c) => (customerPhone && c.phone === customerPhone) || c.name === invoice.customerName
        );
        if (existing) {
          return prev.map((c) =>
            c.id === existing.id
              ? { ...c, currentDuePaisa: c.currentDuePaisa + khataDeltaPaisa }
              : c
          );
        } else {
          return [
            ...prev,
            {
              id: `cust-${Date.now()}`,
              name: invoice.customerName,
              phone: customerPhone || "",
              currentDuePaisa: khataDeltaPaisa,
              creditLimitPaisa: 200000n,
            },
          ];
        }
      });
    }

    showToast(`✓ Sale #${invoice.invoiceNumber} Completed (${formatPaisa(invoice.totalPaisa)})`);
  };

  const handleAddCatalogItem = (item: CatalogItem) => {
    setCatalogItems((prev) => [item, ...prev]);
    showToast(`✓ Added "${item.name}" to Catalog (${formatPaisa(item.pricePaisa)})`);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      {/* ==================================================================== */}
      {/* 1. CLEAN SIDEBAR (With Dashboard tab, NO top Move Money button)       */}
      {/* ==================================================================== */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isCloudSynced={!!supabase}
      />

      {/* ==================================================================== */}
      {/* 2. MAIN APPLICATION WORKSPACE AREA (NO TOPBAR, PURE CONTENT)         */}
      {/* ==================================================================== */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto p-6 transition-colors">
        {/* TOAST NOTICE */}
        {toastNotice && (
          <div className="mb-4 bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-150 flex items-center justify-between">
            <span>{toastNotice}</span>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-white/80 hover:text-white font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* WORKSPACE VIEW: DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <DashboardOverview
            cashDrawerPaisa={cashAccount.currentBalancePaisa}
            bankTotalPaisa={totalBankPaisa}
            qrTotalPaisa={totalQrPaisa}
            portalFloatTotalPaisa={totalPortalFloatPaisa}
            khataDueTotalPaisa={totalKhataDuePaisa}
            timeStr={timeStr}
            onSelectTab={setActiveTab}
            onOpenMoveMoney={() => setIsMoveOpen(true)}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 1 POS */}
        {activeTab === "pos" && (
          <PosTerminal
            catalogItems={catalogItems}
            onAddCatalogItem={handleAddCatalogItem}
            customers={customers}
            accounts={accounts}
            onRecordSale={handleRecordPosSale}
            timeStr={timeStr}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 2 CSP */}
        {activeTab === "csp" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">🏧</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 2: Biometric CSP Kiosk</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              AEPS, DMT, and UPI Cash Out with passbook statement calculations and 4 fee collection modes.
            </p>
          </div>
        )}

        {/* WORKSPACE VIEW: MODULE 3 BBPS */}
        {activeTab === "bbps" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">⚡</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 3: Recharges, BBPS & Utility Hub</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Mobile/DTH, WBSEDCL electricity bills, Fastag, and Google Play voucher record-keeping.
            </p>
          </div>
        )}

        {/* WORKSPACE VIEW: MODULE 4 KHATA & STOCK */}
        {activeTab === "khata_stock" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">👥</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 4: Customer Khata & Consumables Stock</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Customer udhaar credit ledger + wholesale consumables purchase & stock tracking.
            </p>
          </div>
        )}

        {/* WORKSPACE VIEW: MODULE 5 ACCOUNTS & CASHBOOK */}
        {activeTab === "accounts" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">🏦</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 5: Cash Drawer & Accounts Hub</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Daily Cash Book, physical note denomination counter, Section 194N tracker, and P&L.
            </p>
          </div>
        )}

        {/* WORKSPACE VIEW: MODULE 6 SETTINGS */}
        {activeTab === "settings" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-8 text-center shadow-xs">
            <span className="text-4xl block mb-2">⚙️</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Module 6: Settings & Backup</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Shop profile, accounts manager, printer configurations, and local backup.
            </p>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* UNIVERSAL CONTRA MOVE MONEY MODAL                                    */}
      {/* ==================================================================== */}
      {isMoveOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
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
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Source Account (FROM)
                </label>
                <select
                  value={moveFromId}
                  onChange={(e) => setMoveFromId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Destination Account (TO)
                </label>
                <select
                  value={moveToId}
                  onChange={(e) => setMoveToId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Transfer Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Remarks / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ATM cash withdrawal for drawer"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoveOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer"
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
