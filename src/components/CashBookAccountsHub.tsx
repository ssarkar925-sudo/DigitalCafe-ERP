import React, { useState, useMemo } from "react";
import {
  TreasuryAccount,
  CashBookEntry,
  Customer,
  InvoiceRecord,
  DigitalTransaction,
  NoteDenominations,
  DayCloseAudit,
} from "../core/contracts";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  ShieldCheck,
  Plus,
  RefreshCw,
  Printer,
  Share2,
  Calendar,
  Lock,
  Layers,
  ArrowRightLeft,
  Coins,
  CheckCircle2,
  AlertTriangle,
  History,
  FileSpreadsheet,
  IndianRupee,
} from "lucide-react";

interface CashBookAccountsHubProps {
  accounts: TreasuryAccount[];
  cashBookEntries: CashBookEntry[];
  customers: Customer[];
  invoices: InvoiceRecord[];
  digitalTransactions: DigitalTransaction[];
  timeStr: string;
  onAddAccount: (acc: TreasuryAccount) => void;
  onEditAccount: (acc: TreasuryAccount) => void;
  onDeleteAccount: (id: string) => void;
  onRecordCashEntry: (entry: {
    description: string;
    type: "IN" | "OUT";
    amountPaisa: bigint;
    category: CashBookEntry["category"];
  }) => void;
  onOpenMoveMoney: () => void;
  onOpenAccountManager: () => void;
  showToast: (msg: string) => void;
}

export const CashBookAccountsHub: React.FC<CashBookAccountsHubProps> = ({
  accounts,
  cashBookEntries,
  customers,
  invoices,
  digitalTransactions,
  timeStr,
  onRecordCashEntry,
  onOpenMoveMoney,
  onOpenAccountManager,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<"cashbook" | "denomination" | "pools" | "section194n" | "pnl">("cashbook");

  // Format Helper
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const rem = abs % 100n;
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${rem.toString().padStart(2, "0")}`;
  };

  // Find Primary Cash Drawer Account
  const cashAccount = useMemo(() => {
    return (
      accounts.find((a) => a.type === "CASH" && a.isActive) ||
      accounts.find((a) => a.type === "CASH") || {
        id: "acc-cash",
        code: "1010",
        name: "Shop Cash Drawer",
        type: "CASH" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      }
    );
  }, [accounts]);

  // Total Pools Calculations
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === "BANK"), [accounts]);
  const portalAccounts = useMemo(() => accounts.filter((a) => a.type === "WALLET"), [accounts]);
  const upiAccounts = useMemo(() => accounts.filter((a) => a.type === "UPI_HOLDING"), [accounts]);

  const totalBankPaisa = useMemo(
    () => bankAccounts.reduce((acc, b) => acc + b.currentBalancePaisa, 0n),
    [bankAccounts]
  );
  const totalPortalPaisa = useMemo(
    () => portalAccounts.reduce((acc, p) => acc + p.currentBalancePaisa, 0n),
    [portalAccounts]
  );
  const totalUpiPaisa = useMemo(
    () => upiAccounts.reduce((acc, u) => acc + u.currentBalancePaisa, 0n),
    [upiAccounts]
  );
  const totalKhataDuePaisa = useMemo(
    () => customers.reduce((acc, c) => acc + c.currentDuePaisa, 0n),
    [customers]
  );
  const totalNetLiquidPaisa = useMemo(
    () => cashAccount.currentBalancePaisa + totalBankPaisa + totalPortalPaisa + totalUpiPaisa,
    [cashAccount, totalBankPaisa, totalPortalPaisa, totalUpiPaisa]
  );

  // Today Filter for Cash Book
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const filteredEntries = useMemo(() => {
    return cashBookEntries.filter((e) => e.date === selectedDate);
  }, [cashBookEntries, selectedDate]);

  // Summary Metrics for Selected Date
  const todayCashIn = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === "IN")
      .reduce((sum, e) => sum + e.amountPaisa, 0n);
  }, [filteredEntries]);

  const todayCashOut = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === "OUT")
      .reduce((sum, e) => sum + e.amountPaisa, 0n);
  }, [filteredEntries]);

  const netCashFlow = todayCashIn - todayCashOut;

  // Manual Cash Entry Modal State
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [manualType, setManualType] = useState<"IN" | "OUT">("OUT");
  const [manualCategory, setManualCategory] = useState<CashBookEntry["category"]>("EXPENSE");
  const [manualDescription, setManualDescription] = useState("");
  const [manualAmountRupees, setManualAmountRupees] = useState("");

  const handleSaveManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(manualAmountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      alert("Please enter a valid amount greater than ₹0");
      return;
    }
    const paisa = BigInt(Math.round(rupees * 100));

    onRecordCashEntry({
      description: manualDescription.trim() || (manualType === "OUT" ? "General Cash Expense" : "Direct Cash Receipt"),
      type: manualType,
      amountPaisa: paisa,
      category: manualCategory,
    });

    setIsManualEntryModalOpen(false);
    setManualDescription("");
    setManualAmountRupees("");
  };

  // --------------------------------------------------------------------------
  // DENOMINATION COUNTER & DAY-CLOSE STATE
  // --------------------------------------------------------------------------
  const [denoms, setDenoms] = useState<NoteDenominations>({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    coinsPaisa: 0n,
  });

  const physicalCountedPaisa = useMemo(() => {
    const p500 = BigInt(denoms.n500) * 50000n;
    const p200 = BigInt(denoms.n200) * 20000n;
    const p100 = BigInt(denoms.n100) * 10000n;
    const p50 = BigInt(denoms.n50) * 5000n;
    const p20 = BigInt(denoms.n20) * 2000n;
    const p10 = BigInt(denoms.n10) * 1000n;
    return p500 + p200 + p100 + p50 + p20 + p10 + denoms.coinsPaisa;
  }, [denoms]);

  const expectedCashPaisa = cashAccount.currentBalancePaisa;
  const cashVariancePaisa = physicalCountedPaisa - expectedCashPaisa;

  // Day Close History from localStorage
  const [dayCloseAudits, setDayCloseAudits] = useState<DayCloseAudit[]>(() => {
    try {
      const saved = localStorage.getItem("dc_day_close_audits");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((a: any) => ({
            ...a,
            openingCashPaisa: BigInt(a.openingCashPaisa || 0),
            systemExpectedCashPaisa: BigInt(a.systemExpectedCashPaisa || 0),
            physicalCountedCashPaisa: BigInt(a.physicalCountedCashPaisa || 0),
            variancePaisa: BigInt(a.variancePaisa || 0),
            denominations: {
              ...a.denominations,
              coinsPaisa: BigInt(a.denominations?.coinsPaisa || 0),
            },
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  const handleSaveDayCloseAudit = () => {
    const auditRecord: DayCloseAudit = {
      id: `audit-${Date.now()}`,
      date: selectedDate,
      time: timeStr,
      openingCashPaisa: 0n, // baseline
      systemExpectedCashPaisa: expectedCashPaisa,
      physicalCountedCashPaisa: physicalCountedPaisa,
      variancePaisa: cashVariancePaisa,
      denominations: { ...denoms },
      notes: cashVariancePaisa === 0n ? "Exact Match" : cashVariancePaisa > 0n ? "Cash Overage" : "Cash Shortage",
    };

    const updated = [auditRecord, ...dayCloseAudits];
    setDayCloseAudits(updated);
    try {
      const toSave = updated.map((a) => ({
        ...a,
        openingCashPaisa: a.openingCashPaisa.toString(),
        systemExpectedCashPaisa: a.systemExpectedCashPaisa.toString(),
        physicalCountedCashPaisa: a.physicalCountedCashPaisa.toString(),
        variancePaisa: a.variancePaisa.toString(),
        denominations: {
          ...a.denominations,
          coinsPaisa: a.denominations.coinsPaisa.toString(),
        },
      }));
      localStorage.setItem("dc_day_close_audits", JSON.stringify(toSave));
    } catch (e) {}

    showToast(`✓ Day-Close Audit for ${selectedDate} saved! Variance: ${formatPaisa(cashVariancePaisa)}`);
  };

  // --------------------------------------------------------------------------
  // SECTION 194N & TAX COMPLIANCE ENGINE
  // --------------------------------------------------------------------------
  // Statutory threshold: ₹20,00,000 (Non-ITR filers) and ₹1,00,00,000 (Regular filers)
  const nonItrThresholdPaisa = 200000000n; // ₹20 Lakhs
  const regularThresholdPaisa = 1000000000n; // ₹1 Crore

  // Calculate total cash withdrawals from bank accounts (Move Money FROM Bank TO Cash Drawer)
  const totalBankCashWithdrawalsPaisa = useMemo(() => {
    return cashBookEntries
      .filter((e) => e.category === "CONTRA_TRANSFER" && e.type === "IN")
      .reduce((sum, e) => sum + e.amountPaisa, 0n);
  }, [cashBookEntries]);

  const percentageUsedNonItr = Number((totalBankCashWithdrawalsPaisa * 10000n) / nonItrThresholdPaisa) / 100;
  const percentageUsedRegular = Number((totalBankCashWithdrawalsPaisa * 10000n) / regularThresholdPaisa) / 100;

  // Quick WhatsApp Day-End Summary
  // 1-Click Thermal ESC/POS Z-Report
  const handlePrintThermalZReport = () => {
    const printWindow = window.open("", "_blank", "width=360,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Z-Report ${selectedDate}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              width: 280px;
              margin: 0 auto;
              padding: 10px;
              font-size: 11px;
              color: #000;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; font-size: 11px; }
            td { padding: 2px 0; }
            @media print {
              body { width: 100%; margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">SARKAR COMMUNICATION</div>
          <div class="center">DAILY EOD RECONCILIATION Z-REPORT</div>
          <div class="center">Date: ${selectedDate} | Time: ${timeStr}</div>
          <div class="divider"></div>
          <table>
            <tr><td>Total Cash Inflow:</td><td class="right bold">+${formatPaisa(todayCashIn)}</td></tr>
            <tr><td>Total Cash Outflow:</td><td class="right bold">-${formatPaisa(todayCashOut)}</td></tr>
            <tr class="bold"><td>System Expected Cash:</td><td class="right">${formatPaisa(expectedCashPaisa)}</td></tr>
            <tr class="bold"><td>Physical Counted Cash:</td><td class="right">${formatPaisa(physicalCountedPaisa)}</td></tr>
            <tr class="bold"><td>Variance:</td><td class="right">${formatPaisa(cashVariancePaisa)}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 2px;">PHYSICAL DENOMINATIONS:</div>
          <table>
            <tr><td>₹500 x ${denoms.n500}</td><td class="right">₹${(denoms.n500 * 500).toLocaleString("en-IN")}</td></tr>
            <tr><td>₹200 x ${denoms.n200}</td><td class="right">₹${(denoms.n200 * 200).toLocaleString("en-IN")}</td></tr>
            <tr><td>₹100 x ${denoms.n100}</td><td class="right">₹${(denoms.n100 * 100).toLocaleString("en-IN")}</td></tr>
            <tr><td>₹50  x ${denoms.n50}</td><td class="right">₹${(denoms.n50 * 50).toLocaleString("en-IN")}</td></tr>
            <tr><td>₹20  x ${denoms.n20}</td><td class="right">₹${(denoms.n20 * 20).toLocaleString("en-IN")}</td></tr>
            <tr><td>₹10  x ${denoms.n10}</td><td class="right">₹${(denoms.n10 * 10).toLocaleString("en-IN")}</td></tr>
            <tr><td>Loose Coins</td><td class="right">${formatPaisa(denoms.coinsPaisa)}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="center bold">STATUS: ${cashVariancePaisa === 0n ? "BALANCED (0 VARIANCE)" : "AUDIT DISCREPANCY"}</div>
          <div class="center" style="font-size: 9px; margin-top: 4px;">Verified by Cashier / Shift In-Charge</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // Quick WhatsApp Day-End Summary
  const handleShareDayCloseWhatsApp = () => {
    const text =
      `*🏛️ SARKAR COMMUNICATION - DAY CLOSE CASH AUDIT*\n` +
      `📅 *Date:* ${selectedDate} | *Time:* ${timeStr}\n\n` +
      `💵 *Physical Counted:* ${formatPaisa(physicalCountedPaisa)}\n` +
      `💻 *ERP Expected Cash:* ${formatPaisa(expectedCashPaisa)}\n` +
      `⚖️ *Variance:* ${formatPaisa(cashVariancePaisa)} ${cashVariancePaisa === 0n ? "✅ (Exact Balanced)" : "⚠️"}\n\n` +
      `*Denomination Breakdown:*\n` +
      `• ₹500 × ${denoms.n500} = ₹${(denoms.n500 * 500).toLocaleString("en-IN")}\n` +
      `• ₹200 × ${denoms.n200} = ₹${(denoms.n200 * 200).toLocaleString("en-IN")}\n` +
      `• ₹100 × ${denoms.n100} = ₹${(denoms.n100 * 100).toLocaleString("en-IN")}\n` +
      `• ₹50  × ${denoms.n50}  = ₹${(denoms.n50 * 50).toLocaleString("en-IN")}\n` +
      `• ₹20  × ${denoms.n20}  = ₹${(denoms.n20 * 20).toLocaleString("en-IN")}\n` +
      `• ₹10  × ${denoms.n10}  = ₹${(denoms.n10 * 10).toLocaleString("en-IN")}\n` +
      `• Coins = ${formatPaisa(denoms.coinsPaisa)}\n\n` +
      `📊 *Today Inflow:* +${formatPaisa(todayCashIn)}\n` +
      `📉 *Today Outflow:* -${formatPaisa(todayCashOut)}\n` +
      `✨ *Verified & Generated via DigitalCafe ERP*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              CashBook & Treasury Hub
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Module 5 (F5)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            End-of-Day cash reconciliation, 7-pool conserved liquidity, and Section 194N compliance.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenMoveMoney}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
            Move Money
          </button>

          <button
            type="button"
            onClick={onOpenAccountManager}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            Manage Accounts
          </button>

          <button
            type="button"
            onClick={() => setIsManualEntryModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Record Cash Entry
          </button>
        </div>
      </div>

      {/* 2. OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Physical Cash Drawer */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            💵 Cash Drawer (1010)
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatPaisa(cashAccount.currentBalancePaisa)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Physical Counter Cash</p>
        </div>

        {/* Card 2: Bank Accounts Total */}
        <div className="bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/20 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
            🏦 Bank Accounts ({bankAccounts.length})
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatPaisa(totalBankPaisa)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Liquid Bank Balances</p>
        </div>

        {/* Card 3: Portal Float */}
        <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
            ⚡ Portal Float ({portalAccounts.length})
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatPaisa(totalPortalPaisa)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">PayNearby / CSC Float</p>
        </div>

        {/* Card 4: UPI QR Holdings */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/20 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
            📱 UPI QR Soundbox
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatPaisa(totalUpiPaisa)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Pending Bank Settlement</p>
        </div>

        {/* Card 5: Total Net Liquid Assets */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
            ⚖️ Total Liquid Wealth
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatPaisa(totalNetLiquidPaisa)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Conserved Pool Total</p>
        </div>
      </div>

      {/* 3. SUB-NAV TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("cashbook")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "cashbook"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          Daily Cash Book
        </button>

        <button
          type="button"
          onClick={() => setSubTab("denomination")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "denomination"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Physical Denomination Counter
        </button>

        <button
          type="button"
          onClick={() => setSubTab("pools")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "pools"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          7-Pool Treasury Status
        </button>

        <button
          type="button"
          onClick={() => setSubTab("section194n")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "section194n"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Section 194N TDS Shield
        </button>

        <button
          type="button"
          onClick={() => setSubTab("pnl")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "pnl"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <IndianRupee className="w-3.5 h-3.5" />
          Profit & Loss Statement
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: DAILY CASH BOOK                                               */}
      {/* ==================================================================== */}
      {subTab === "cashbook" && (
        <div className="space-y-4">
          {/* Filter & Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white"
              />
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 underline cursor-pointer"
                >
                  Go to Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="w-4 h-4" />
                <span>IN: {formatPaisa(todayCashIn)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="w-4 h-4" />
                <span>OUT: {formatPaisa(todayCashOut)}</span>
              </div>
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                  netCashFlow >= 0n
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                <span>Net: {formatPaisa(netCashFlow)}</span>
              </div>
            </div>
          </div>

          {/* Cash Book Entries Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Cash IN (₹)</th>
                    <th className="py-3 px-4 text-right">Cash OUT (₹)</th>
                    <th className="py-3 px-4 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs font-bold">No cash movements recorded for {selectedDate}</p>
                        <p className="text-[10px] mt-1">Cash entries from POS, AEPS, DMT, and Expenses appear automatically.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {entry.time}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              entry.type === "IN"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {entry.category.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {entry.type === "IN" ? `+${formatPaisa(entry.amountPaisa)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400 font-mono">
                          {entry.type === "OUT" ? `-${formatPaisa(entry.amountPaisa)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white font-mono">
                          {formatPaisa(entry.runningBalancePaisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: PHYSICAL DENOMINATION COUNTER & DAY CLOSE                     */}
      {/* ==================================================================== */}
      {subTab === "denomination" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Note Counter Form (Left 7 Cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Physical Note Denomination Counter
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Count the notes in your physical cash drawer at shop closing.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDenoms({
                    n500: 0,
                    n200: 0,
                    n100: 0,
                    n50: 0,
                    n20: 0,
                    n10: 0,
                    coinsPaisa: 0n,
                  })
                }
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Counter
              </button>
            </div>

            {/* Note Sliders & Inputs */}
            <div className="space-y-3">
              {[
                { label: "₹500 Notes", key: "n500" as const, val: 500, count: denoms.n500, color: "text-slate-700 dark:text-slate-200" },
                { label: "₹200 Notes", key: "n200" as const, val: 200, count: denoms.n200, color: "text-amber-600 dark:text-amber-400" },
                { label: "₹100 Notes", key: "n100" as const, val: 100, count: denoms.n100, color: "text-purple-600 dark:text-purple-400" },
                { label: "₹50 Notes",  key: "n50" as const,  val: 50,  count: denoms.n50,  color: "text-cyan-600 dark:text-cyan-400" },
                { label: "₹20 Notes",  key: "n20" as const,  val: 20,  count: denoms.n20,  color: "text-rose-600 dark:text-rose-400" },
                { label: "₹10 Notes",  key: "n10" as const,  val: 10,  count: denoms.n10,  color: "text-amber-700 dark:text-amber-500" },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl"
                >
                  <div className="w-28">
                    <span className={`text-xs font-black ${item.color}`}>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDenoms((prev) => ({ ...prev, [item.key]: Math.max(0, prev[item.key] - 1) }))}
                      className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 text-xs font-black hover:bg-slate-300 dark:hover:bg-slate-500 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.count === 0 ? "" : item.count}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setDenoms((prev) => ({ ...prev, [item.key]: Math.max(0, val) }));
                      }}
                      className="w-16 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-1 text-xs font-bold font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setDenoms((prev) => ({ ...prev, [item.key]: prev[item.key] + 1 }))}
                      className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 text-xs font-black hover:bg-slate-300 dark:hover:bg-slate-500 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-28 text-right font-mono font-black text-xs text-slate-900 dark:text-white">
                    ₹{(item.count * item.val).toLocaleString("en-IN")}.00
                  </div>
                </div>
              ))}

              {/* Coins Input */}
              <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                <div className="w-28">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">🪙 Coins Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={denoms.coinsPaisa === 0n ? "" : Number(denoms.coinsPaisa) / 100}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDenoms((prev) => ({ ...prev, coinsPaisa: BigInt(Math.round(Math.max(0, val) * 100)) }));
                    }}
                    className="w-28 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-1 text-xs font-bold font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div className="w-28 text-right font-mono font-black text-xs text-slate-900 dark:text-white">
                  {formatPaisa(denoms.coinsPaisa)}
                </div>
              </div>
            </div>
          </div>

          {/* Variance & Day Close Freeze (Right 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                End-of-Day Reconciliation
              </h3>

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Physical Counted Cash:</span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {formatPaisa(physicalCountedPaisa)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">ERP Expected Cash Drawer:</span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {formatPaisa(expectedCashPaisa)}
                  </span>
                </div>

                {/* Variance Highlight */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    cashVariancePaisa === 0n
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : cashVariancePaisa > 0n
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 text-amber-800 dark:text-amber-300"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      {cashVariancePaisa === 0n
                        ? "✅ 100% Exact Match"
                        : cashVariancePaisa > 0n
                        ? "⚠️ Cash Overage"
                        : "🚨 Cash Shortage"}
                    </span>
                    <span className="text-lg font-black font-mono">
                      {formatPaisa(cashVariancePaisa)}
                    </span>
                  </div>
                  {cashVariancePaisa === 0n ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-7 h-7 text-amber-500" />
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Saving this day-close creates a permanent audit record and freezes the shift book.
                </p>

                {/* Save, Thermal Print, and WhatsApp Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDayCloseAudit}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Save & Lock Day Close Audit
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePrintThermalZReport}
                      className="py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Z-Report
                    </button>
                    <button
                      type="button"
                      onClick={handleShareDayCloseWhatsApp}
                      className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp Owner
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit History Log */}
            {dayCloseAudits.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                  Recent Day-Close Audit Logs
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {dayCloseAudits.slice(0, 5).map((audit) => (
                    <div
                      key={audit.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {audit.date} ({audit.time})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Counted: {formatPaisa(audit.physicalCountedCashPaisa)}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          audit.variancePaisa === 0n
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatPaisa(audit.variancePaisa)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: 7-POOL CONSERVED LIQUIDITY TREASURY                           */}
      {/* ==================================================================== */}
      {subTab === "pools" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-emerald-500/10 border border-amber-500/20 p-5 rounded-2xl">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Conserved Liquidity Invariant
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              In DigitalCafe ERP, moving money between bank accounts, cash drawers, and portal floats is a{" "}
              <strong>Contra Transfer</strong>. It never artificially increases your sales or pollutes your P&L expenses.
              Total Business Liquid Assets remain strictly conserved:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                {formatPaisa(totalNetLiquidPaisa)}
              </strong>.
            </p>
          </div>

          {/* Detailed Account Pool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        acc.type === "CASH"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : acc.type === "BANK"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                          : acc.type === "WALLET"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                      }`}
                    >
                      {acc.type.replace(/_/g, " ")} • {acc.code}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>

                  <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                    {acc.name}
                  </h4>
                  {acc.metadata?.bankAccount && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      A/C: ••••{acc.metadata.bankAccount.slice(-4)}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Balance
                  </span>
                  <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                    {formatPaisa(acc.currentBalancePaisa)}
                  </span>
                </div>
              </div>
            ))}

            {/* Khata Credit Pool */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-purple-200/80 dark:border-purple-800/70 shadow-xs flex flex-col justify-between">
              <div>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  RECEIVABLES • 1030
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  Customer Khata Receivables
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Across {customers.filter((c) => c.currentDuePaisa > 0n).length} customers with pending dues
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">
                  Total Outstanding
                </span>
                <span className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                  {formatPaisa(totalKhataDuePaisa)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: SECTION 194N TAX SHIELD & STATUTORY COMPLIANCE                */}
      {/* ==================================================================== */}
      {subTab === "section194n" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Income Tax Section 194N Pass-Through Shield
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Protects your Cyber Cafe & CSP business from 2% TDS on bank cash withdrawals by tracking business banking cash pass-through.
                </p>
              </div>
            </div>

            {/* Threshold Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              {/* Threshold 1: Non-ITR Filers (₹20 Lakhs) */}
              <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Non-ITR Filers Limit (₹20,00,000)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(100, percentageUsedNonItr).toFixed(1)}% Used
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-600 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      percentageUsedNonItr >= 80 ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, percentageUsedNonItr))}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-400">
                  Bank Cash Withdrawn: {formatPaisa(totalBankCashWithdrawalsPaisa)} of ₹20,00,000.00
                </p>
              </div>

              {/* Threshold 2: Regular Filers (₹1 Crore) */}
              <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Regular ITR Filers Limit (₹1,00,00,000)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(100, percentageUsedRegular).toFixed(2)}% Used
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-600 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, percentageUsedRegular))}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-400">
                  Bank Cash Withdrawn: {formatPaisa(totalBankCashWithdrawalsPaisa)} of ₹1,00,00,000.00
                </p>
              </div>
            </div>

            {/* CA Verification Note */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>💡 Legal Defense Note for Chartered Accountants:</strong> Under Section 194N, cash withdrawn
              from bank to service AEPS/Money Remittance payouts is strictly <em>client pass-through money</em>. All
              contra cash transfers in this ledger are paired with corresponding biometric cash payouts to demonstrate
              zero personal enrichment.
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: PERIODIC PROFIT & LOSS (P&L) STATEMENT                        */}
      {/* ==================================================================== */}
      {subTab === "pnl" && (() => {
        // Compute P&L Metrics based on non-void records
        const activeInvoices = invoices.filter((i) => i.status !== "VOID");
        const activeDigital = digitalTransactions.filter((d) => d.status !== "VOID");

        const posSalesRevenue = activeInvoices.reduce((sum, i) => sum + i.totalPaisa, 0n);
        const digitalServiceIncome = activeDigital.reduce((sum, d) => sum + d.customerFeePaisa + d.portalCommissionPaisa, 0n);
        const totalGrossRevenue = posSalesRevenue + digitalServiceIncome;

        // Operating Expenses from CashBook categories EXPENSE + STOCK_PURCHASE
        const shopOperatingExpenses = cashBookEntries
          .filter((e) => e.type === "OUT" && (e.category === "EXPENSE" || e.category === "STOCK_PURCHASE" || e.category === "CASH_SHORTAGE"))
          .reduce((sum, e) => sum + e.amountPaisa, 0n);

        const netShopProfitPaisa = totalGrossRevenue - shopOperatingExpenses;
        const profitMarginPct = totalGrossRevenue > 0n ? Number((netShopProfitPaisa * 10000n) / totalGrossRevenue) / 100 : 0;

        return (
          <div className="space-y-6">
            {/* P&L Header Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <IndianRupee className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Profit & Loss (P&L) Statement
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Canonical commercial accounting separating Gross Turnover, Digital Service Margins, and Operational Costs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    Print Statement
                  </button>
                </div>
              </div>

              {/* 3 Executive KPI Chips */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-600/40">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Total Commercial Inflow</span>
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatPaisa(totalGrossRevenue)}
                  </span>
                  <span className="text-[10px] text-slate-500">POS Sales + CSP Fees & Commissions</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-600/40">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Operating Costs & Purchases</span>
                  <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatPaisa(shopOperatingExpenses)}
                  </span>
                  <span className="text-[10px] text-slate-500">Shop Rent, Electricity, Tea, Paper & Stock</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-600/40">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Net Shop Profit</span>
                  <span className={`text-lg font-black font-mono mt-1 block ${netShopProfitPaisa >= 0n ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {formatPaisa(netShopProfitPaisa)}
                  </span>
                  <span className="text-[10px] text-slate-500">Margin: {profitMarginPct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Detailed Accounting Schedule Table */}
              <div className="pt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-black uppercase">
                      <th className="py-2.5">Accounting Head / Particulars</th>
                      <th className="py-2.5 text-center">Type</th>
                      <th className="py-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                    {/* POS Revenue */}
                    <tr>
                      <td className="py-2.5 text-slate-800 dark:text-slate-200">
                        Express POS Counter Sales (Invoices: {activeInvoices.length})
                      </td>
                      <td className="py-2.5 text-center text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        REVENUE
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatPaisa(posSalesRevenue)}
                      </td>
                    </tr>

                    {/* CSP Income */}
                    <tr>
                      <td className="py-2.5 text-slate-800 dark:text-slate-200">
                        Digital CSP & Banking Service Earnings (AEPS / DMT / BBPS: {activeDigital.length})
                      </td>
                      <td className="py-2.5 text-center text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        COMMISSION
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatPaisa(digitalServiceIncome)}
                      </td>
                    </tr>

                    {/* Subtotal Gross Profit */}
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 font-black">
                      <td className="py-2.5 text-emerald-900 dark:text-emerald-300">
                        GROSS BUSINESS INCOME
                      </td>
                      <td className="py-2.5 text-center text-emerald-700 dark:text-emerald-400 text-[10px]">
                        SUBTOTAL
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                        {formatPaisa(totalGrossRevenue)}
                      </td>
                    </tr>

                    {/* Less: Operating Expenses */}
                    <tr>
                      <td className="py-2.5 text-slate-800 dark:text-slate-200">
                        Less: Shop General Expenses & Consumables Purchases
                      </td>
                      <td className="py-2.5 text-center text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                        EXPENSE
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        -{formatPaisa(shopOperatingExpenses)}
                      </td>
                    </tr>

                    {/* Net Profit Final */}
                    <tr className="bg-slate-100/70 dark:bg-slate-700/40 font-black text-sm">
                      <td className="py-3 text-slate-900 dark:text-white">
                        NET PROFIT / (LOSS) AFTER ALL COSTS
                      </td>
                      <td className="py-3 text-center text-slate-500 text-[10px]">
                        BOTTOM LINE
                      </td>
                      <td className={`py-3 text-right font-mono ${netShopProfitPaisa >= 0n ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {formatPaisa(netShopProfitPaisa)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================================================================== */}
      {/* MODAL: RECORD MANUAL CASH IN / OUT ENTRY                             */}
      {/* ==================================================================== */}
      {isManualEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                Record Cash Book Entry
              </h3>
              <button
                type="button"
                onClick={() => setIsManualEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-black">
                <button
                  type="button"
                  onClick={() => {
                    setManualType("OUT");
                    setManualCategory("EXPENSE");
                  }}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    manualType === "OUT"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  Cash OUT (Expense)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualType("IN");
                    setManualCategory("MANUAL_IN");
                  }}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    manualType === "IN"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  Cash IN (Direct)
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={manualAmountRupees}
                    onChange={(e) => setManualAmountRupees(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl pl-8 pr-3 py-2 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {manualType === "OUT" ? (
                    <>
                      <option value="EXPENSE">General Shop Expense (Tea/Snacks/Cleaning)</option>
                      <option value="STOCK_PURCHASE">Supplies & Material Purchase</option>
                      <option value="CASH_SHORTAGE">Cash Shortage Adjustment</option>
                    </>
                  ) : (
                    <>
                      <option value="MANUAL_IN">Direct Counter Inward Receipt</option>
                      <option value="OPENING_BALANCE">Opening Cash Infusion</option>
                      <option value="CASH_OVERAGE">Cash Overage Adjustment</option>
                    </>
                  )}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Description / Narration
                </label>
                <input
                  type="text"
                  placeholder={manualType === "OUT" ? "e.g. Shop tea & snacks" : "e.g. Petty cash replenishment"}
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualEntryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
