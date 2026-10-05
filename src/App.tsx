import { useState, useEffect, useMemo } from "react";
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
  ReturnRecord,
} from "./core/contracts";
import { createContraTransferJournal, JournalEntry } from "./core/ledger";
import {
  fetchLiveAccounts,
  fetchLiveCustomers,
  supabase,
} from "./core/supabase";
import { Sidebar } from "./components/Sidebar";
import { DashboardOverview } from "./components/DashboardOverview";
import { PosTerminal } from "./components/PosTerminal";
import { AccountManagerModal } from "./components/AccountManagerModal";
import { CspKiosk } from "./components/CspKiosk";
import { BbpsRechargeHub } from "./components/BbpsRechargeHub";
import { KhataStockHub } from "./components/KhataStockHub";
import { CashBookAccountsHub } from "./components/CashBookAccountsHub";
import { SettingsBackupHub } from "./components/SettingsBackupHub";
import {
  StockMovement,
  KhataSettlement,
  ShopProfile,
  HardwareConfig,
  DEFAULT_SHOP_PROFILE,
  DEFAULT_HARDWARE_CONFIG,
} from "./core/contracts";
import { ArrowLeftRight, Landmark } from "lucide-react";

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

  // 1. Treasury Accounts (Zero Preloaded Fake Data — starts with Cash Drawer only)
  const [accounts, setAccounts] = useState<TreasuryAccount[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_accounts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((acc: any) => ({
            ...acc,
            currentBalancePaisa: BigInt(acc.currentBalancePaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return INITIAL_ACCOUNTS;
  });

  // Save accounts to localStorage on change
  useEffect(() => {
    try {
      const serializable = accounts.map((acc) => ({
        ...acc,
        currentBalancePaisa: acc.currentBalancePaisa.toString(),
      }));
      localStorage.setItem("dc_user_accounts", JSON.stringify(serializable));
    } catch (e) {}
  }, [accounts]);

  // 2. Customers
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_customers");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            currentDuePaisa: BigInt(c.currentDuePaisa || 0),
            creditLimitPaisa: BigInt(c.creditLimitPaisa || 200000),
            advanceBalancePaisa: BigInt(c.advanceBalancePaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return INITIAL_CUSTOMERS;
  });

  useEffect(() => {
    try {
      const serializable = customers.map((c) => ({
        ...c,
        currentDuePaisa: c.currentDuePaisa.toString(),
        creditLimitPaisa: c.creditLimitPaisa.toString(),
        advanceBalancePaisa: (c.advanceBalancePaisa || 0n).toString(),
      }));
      localStorage.setItem("dc_user_customers", JSON.stringify(serializable));
    } catch (e) {}
  }, [customers]);

  // 3. Catalog Items
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_catalog");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            pricePaisa: BigInt(item.pricePaisa || 0),
            costPricePaisa: BigInt(item.costPricePaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  // 4. Invoices
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_invoices");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((inv: any) => ({
            ...inv,
            subtotalPaisa: BigInt(inv.subtotalPaisa || 0),
            discountPaisa: BigInt(inv.discountPaisa || 0),
            totalTaxablePaisa: inv.totalTaxablePaisa ? BigInt(inv.totalTaxablePaisa) : undefined,
            totalCgstPaisa: inv.totalCgstPaisa ? BigInt(inv.totalCgstPaisa) : undefined,
            totalSgstPaisa: inv.totalSgstPaisa ? BigInt(inv.totalSgstPaisa) : undefined,
            totalTaxPaisa: inv.totalTaxPaisa ? BigInt(inv.totalTaxPaisa) : undefined,
            totalPaisa: BigInt(inv.totalPaisa || 0),
            returnedPaisa: inv.returnedPaisa ? BigInt(inv.returnedPaisa) : undefined,
            items: (inv.items || []).map((it: any) => ({
              ...it,
              unitPricePaisa: BigInt(it.unitPricePaisa || 0),
              totalPaisa: BigInt(it.totalPaisa || 0),
              taxableAmountPaisa: it.taxableAmountPaisa ? BigInt(it.taxableAmountPaisa) : undefined,
              cgstPaisa: it.cgstPaisa ? BigInt(it.cgstPaisa) : undefined,
              sgstPaisa: it.sgstPaisa ? BigInt(it.sgstPaisa) : undefined,
            })),
            allocations: (inv.allocations || []).map((al: any) => ({
              ...al,
              amountPaisa: BigInt(al.amountPaisa || 0),
            })),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      const serializable = invoices.map((inv) => ({
        ...inv,
        subtotalPaisa: inv.subtotalPaisa.toString(),
        discountPaisa: inv.discountPaisa.toString(),
        totalTaxablePaisa: inv.totalTaxablePaisa?.toString(),
        totalCgstPaisa: inv.totalCgstPaisa?.toString(),
        totalSgstPaisa: inv.totalSgstPaisa?.toString(),
        totalTaxPaisa: inv.totalTaxPaisa?.toString(),
        totalPaisa: inv.totalPaisa.toString(),
        returnedPaisa: inv.returnedPaisa?.toString(),
        items: inv.items.map((it) => ({
          ...it,
          unitPricePaisa: it.unitPricePaisa.toString(),
          totalPaisa: it.totalPaisa.toString(),
          taxableAmountPaisa: it.taxableAmountPaisa?.toString(),
          cgstPaisa: it.cgstPaisa?.toString(),
          sgstPaisa: it.sgstPaisa?.toString(),
        })),
        allocations: (inv.allocations || []).map((al) => ({
          ...al,
          amountPaisa: al.amountPaisa.toString(),
        })),
      }));
      localStorage.setItem("dc_user_invoices", JSON.stringify(serializable));
    } catch (e) {}
  }, [invoices]);

  // 5. Cash Book Entries
  const [cashBookEntries, setCashBookEntries] = useState<CashBookEntry[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_cashbook");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((cb: any) => ({
            ...cb,
            amountPaisa: BigInt(cb.amountPaisa || 0),
            runningBalancePaisa: BigInt(cb.runningBalancePaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      const serializable = cashBookEntries.map((cb) => ({
        ...cb,
        amountPaisa: cb.amountPaisa.toString(),
        runningBalancePaisa: cb.runningBalancePaisa.toString(),
      }));
      localStorage.setItem("dc_user_cashbook", JSON.stringify(serializable));
    } catch (e) {}
  }, [cashBookEntries]);

  // 6. Digital Transactions (AEPS, DMT, UPI Cash Out)
  const [digitalTransactions, setDigitalTransactions] = useState<DigitalTransaction[]>(() => {
    try {
      const saved = localStorage.getItem("dc_csp_transactions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((t: any) => ({
            ...t,
            amountPaisa: BigInt(t.amountPaisa || 0),
            customerFeePaisa: BigInt(t.customerFeePaisa || 0),
            portalCommissionPaisa: BigInt(t.portalCommissionPaisa || 0),
            portalSurchargePaisa: BigInt(t.portalSurchargePaisa || 0),
            netProfitPaisa: BigInt(t.netProfitPaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      const serializable = digitalTransactions.map((t) => ({
        ...t,
        amountPaisa: t.amountPaisa.toString(),
        customerFeePaisa: t.customerFeePaisa.toString(),
        portalCommissionPaisa: t.portalCommissionPaisa.toString(),
        portalSurchargePaisa: t.portalSurchargePaisa.toString(),
        netProfitPaisa: t.netProfitPaisa.toString(),
      }));
      localStorage.setItem("dc_csp_transactions", JSON.stringify(serializable));
    } catch (e) {}
  }, [digitalTransactions]);

  const [creditCards] = useState<CreditCardItem[]>(INITIAL_CREDIT_CARDS);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  // 7. Shop Profile & Hardware Configuration
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    try {
      const saved = localStorage.getItem("dc_shop_profile");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SHOP_PROFILE;
  });

  useEffect(() => {
    try {
      localStorage.setItem("dc_shop_profile", JSON.stringify(shopProfile));
    } catch (e) {}
  }, [shopProfile]);

  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>(() => {
    try {
      const saved = localStorage.getItem("dc_hardware_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_HARDWARE_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem("dc_hardware_config", JSON.stringify(hardwareConfig));
    } catch (e) {}
  }, [hardwareConfig]);

  // Cloud Sync on Mount (only if Supabase has real live data)
  useEffect(() => {
    fetchLiveAccounts().then((accs) => {
      if (accs && accs.length > 0) setAccounts(accs);
    });
    fetchLiveCustomers().then((custs) => {
      if (custs && custs.length > 0) setCustomers(custs);
    });
  }, []);

  // Filter liquid accounts (CASH, BANK, WALLET, UPI_HOLDING)
  const liquidAccounts = useMemo(() => {
    return accounts.filter((a) => a.type !== "INCOME" && a.type !== "EXPENSE");
  }, [accounts]);

  // Move Money State
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveFromId, setMoveFromId] = useState<string>("acc-cash");
  const [moveToId, setMoveToId] = useState<string>("");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Sync Move Money default selections to available accounts
  useEffect(() => {
    if (liquidAccounts.length > 0) {
      if (!liquidAccounts.some((a) => a.id === moveFromId)) {
        setMoveFromId(liquidAccounts[0].id);
      }
      if (!liquidAccounts.some((a) => a.id === moveToId)) {
        setMoveToId(liquidAccounts.length > 1 ? liquidAccounts[1].id : liquidAccounts[0].id);
      }
    }
  }, [liquidAccounts]);

  // Account Manager Modal State
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

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

  // Account Management Handlers
  const handleAddAccount = (newAcc: TreasuryAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === newAcc.id);
      if (exists) return prev;
      return [...prev, newAcc];
    });
    showToast(`✓ Created account: ${newAcc.name}`);
  };

  const handleEditAccount = (updatedAcc: TreasuryAccount) => {
    setAccounts((prev) => prev.map((a) => (a.id === updatedAcc.id ? updatedAcc : a)));
    showToast(`✓ Updated account: ${updatedAcc.name}`);
  };

  const handleDeleteAccount = (id: string) => {
    if (id === "acc-cash") {
      alert("Shop Cash Drawer cannot be deleted as it is the primary cash desk.");
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    showToast("✓ Account removed from treasury");
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

    const fromAcc = accounts.find((a) => a.id === moveFromId);
    const toAcc = accounts.find((a) => a.id === moveToId);

    if (!fromAcc || !toAcc) {
      alert("Please select both source and destination accounts.");
      return;
    }

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

    // 3. Update accounts (with auto-instantiation of QR account if none exists yet)
    setAccounts((prev) => {
      let qrAccountFound = false;
      const updated = prev.map((acc) => {
        if (acc.type === "CASH" && cashDeltaPaisa > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + cashDeltaPaisa };
        }
        if (acc.type === "UPI_HOLDING" && qrDeltaPaisa > 0n && !qrAccountFound) {
          qrAccountFound = true;
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + qrDeltaPaisa };
        }
        return acc;
      });

      if (qrDeltaPaisa > 0n && !qrAccountFound) {
        const newQrAccount: TreasuryAccount = {
          id: `acc-upi-qr-${Date.now()}`,
          code: "1040",
          name: "Counter UPI QR Collections",
          type: "UPI_HOLDING",
          currentBalancePaisa: qrDeltaPaisa,
          isActive: true,
          metadata: { qrIdentifier: "Merchant Soundbox" },
        };
        return [...updated, newQrAccount];
      }
      return updated;
    });

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
          (c) =>
            (customerPhone && c.phone === customerPhone) ||
            c.name.toLowerCase() === invoice.customerName.toLowerCase()
        );
        if (existing) {
          const adv = existing.advanceBalancePaisa || 0n;
          if (adv >= khataDeltaPaisa) {
            // Bill fully covered by advance
            return prev.map((c) =>
              c.id === existing.id
                ? { ...c, advanceBalancePaisa: adv - khataDeltaPaisa }
                : c
            );
          } else if (adv > 0n) {
            // Partially covered by advance, rest becomes due
            const remainingDue = khataDeltaPaisa - adv;
            return prev.map((c) =>
              c.id === existing.id
                ? { ...c, advanceBalancePaisa: 0n, currentDuePaisa: c.currentDuePaisa + remainingDue }
                : c
            );
          } else {
            return prev.map((c) =>
              c.id === existing.id
                ? { ...c, currentDuePaisa: c.currentDuePaisa + khataDeltaPaisa }
                : c
            );
          }
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

  // Handle Void / Cancel Sale Reversal
  const handleVoidInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status === "VOID") return;

    let cashReversal = 0n;
    let qrReversal = 0n;
    let khataReversal = 0n;

    if (inv.paymentMethod === "CASH") cashReversal = inv.totalPaisa;
    else if (inv.paymentMethod === "UPI") qrReversal = inv.totalPaisa;
    else if (inv.paymentMethod === "KHATA") khataReversal = inv.totalPaisa;
    else if (inv.paymentMethod === "SPLIT" && inv.allocations) {
      inv.allocations.forEach((al) => {
        if (al.method === "CASH") cashReversal += al.amountPaisa;
        else if (al.method === "UPI") qrReversal += al.amountPaisa;
        else if (al.method === "KHATA") khataReversal += al.amountPaisa;
      });
    }

    setInvoices((prev) =>
      prev.map((i) => (i.id === invoiceId ? { ...i, status: "VOID" } : i))
    );

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.type === "CASH" && cashReversal > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa - cashReversal };
        }
        if (acc.type === "UPI_HOLDING" && qrReversal > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa - qrReversal };
        }
        return acc;
      })
    );

    if (khataReversal > 0n) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.name.toLowerCase() === inv.customerName.toLowerCase() ||
          (inv.customerPhone && c.phone === inv.customerPhone)
            ? {
                ...c,
                currentDuePaisa:
                  c.currentDuePaisa >= khataReversal
                    ? c.currentDuePaisa - khataReversal
                    : 0n,
              }
            : c
        )
      );
    }

    if (cashReversal > 0n) {
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          time: timeStr,
          description: `VOID POS Sale #${inv.invoiceNumber} (Reversal)`,
          type: "OUT",
          amountPaisa: cashReversal,
          runningBalancePaisa: cashAccount.currentBalancePaisa - cashReversal,
          category: "POS_SALE",
          referenceId: inv.invoiceNumber,
        },
        ...prev,
      ]);
    }

    showToast(`✓ Voided invoice #${inv.invoiceNumber} and reversed all balances.`);
  };

  // Handle Item Return & Restock
  const handleRecordReturn = ({
    returnRecord,
    refundDeltaPaisa,
  }: {
    returnRecord: ReturnRecord;
    refundDeltaPaisa: bigint;
  }) => {
    // 1. Update Invoice status & returned quantity
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== returnRecord.invoiceId) return inv;
        const updatedItems = inv.items.map((item) => {
          const retItem = returnRecord.items.find((r) => r.itemId === item.id);
          if (retItem) {
            return {
              ...item,
              returnedQuantity: (item.returnedQuantity || 0) + retItem.quantityReturned,
            };
          }
          return item;
        });

        const newTotalReturned = (inv.returnedPaisa || 0n) + returnRecord.totalRefundPaisa;
        const isFullyReturned = newTotalReturned >= inv.totalPaisa;

        return {
          ...inv,
          items: updatedItems,
          returnedPaisa: newTotalReturned,
          status: isFullyReturned ? "REFUNDED" : "PARTIAL_RETURN",
        };
      })
    );

    // 2. Restock Inventory for returned goods
    returnRecord.items.forEach((r) => {
      setCatalogItems((prev) =>
        prev.map((cat) =>
          cat.id === r.itemId
            ? { ...cat, currentStock: cat.currentStock + r.quantityReturned }
            : cat
        )
      );
    });

    // 3. Refund Tender Reversal (Cash Drawer / Soundbox QR)
    if (returnRecord.refundMethod === "CASH" && refundDeltaPaisa > 0n) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === cashAccount.id
            ? { ...acc, currentBalancePaisa: acc.currentBalancePaisa >= refundDeltaPaisa ? acc.currentBalancePaisa - refundDeltaPaisa : 0n }
            : acc
        )
      );

      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: returnRecord.date,
          time: returnRecord.time,
          description: `REFUND RTN #${returnRecord.returnNumber} for Invoice #${returnRecord.invoiceNumber}`,
          type: "OUT",
          amountPaisa: refundDeltaPaisa,
          runningBalancePaisa: cashAccount.currentBalancePaisa >= refundDeltaPaisa ? cashAccount.currentBalancePaisa - refundDeltaPaisa : 0n,
          category: "POS_SALE",
          referenceId: returnRecord.returnNumber,
        },
        ...prev,
      ]);
    }

    showToast(`✓ Processed Return #${returnRecord.returnNumber} (${formatPaisa(returnRecord.totalRefundPaisa)}) and restocked inventory.`);
  };

  // Digital CSP Transaction Handlers
  const handleRecordDigitalTransaction = ({
    transaction,
    journal,
    cashDeltaPaisa,
    sourceDeltaPaisa,
    qrDeltaPaisa,
    khataDeltaPaisa,
    customerPhone,
    customerName,
  }: {
    transaction: DigitalTransaction;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    sourceDeltaPaisa: bigint;
    portalDeltaPaisa: bigint;
    qrDeltaPaisa?: bigint;
    khataDeltaPaisa?: bigint;
    customerPhone?: string;
    customerName?: string;
  }) => {
    // 1. Digital transactions
    setDigitalTransactions((prev) => [transaction, ...prev]);

    // 2. Journal Entries
    setJournalEntries((prev) => [journal, ...prev]);

    // 3. Update accounts (Cash Drawer, Source Portal/Bank, and Counter UPI QR)
    setAccounts((prev) => {
      let qrCredited = false;
      const updated = prev.map((acc) => {
        if (acc.id === cashAccount.id && cashDeltaPaisa !== 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + cashDeltaPaisa };
        }
        if (acc.id === transaction.sourceAccountId && sourceDeltaPaisa !== 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + sourceDeltaPaisa };
        }
        if (qrDeltaPaisa && qrDeltaPaisa > 0n && acc.type === "UPI_HOLDING" && !qrCredited) {
          qrCredited = true;
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + qrDeltaPaisa };
        }
        return acc;
      });

      // Auto-instantiate UPI_HOLDING account if fee collected via QR but none exists yet
      if (qrDeltaPaisa && qrDeltaPaisa > 0n && !qrCredited) {
        const newQr: TreasuryAccount = {
          id: `acc-upi-qr-${Date.now()}`,
          code: "1040",
          name: "Counter UPI QR Collections",
          type: "UPI_HOLDING",
          currentBalancePaisa: qrDeltaPaisa,
          isActive: true,
          metadata: { qrIdentifier: "Merchant Soundbox" },
        };
        return [...updated, newQr];
      }
      return updated;
    });

    // 4. Update Cash Book if physical cash moved
    if (cashDeltaPaisa !== 0n) {
      const isCashIn = cashDeltaPaisa > 0n;
      const absAmount = isCashIn ? cashDeltaPaisa : -cashDeltaPaisa;
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: transaction.date,
          time: transaction.time,
          description: `${transaction.serviceType} Banking #${transaction.id} (${customerName ? `${customerName} • ` : ""}${transaction.beneficiaryDetails || ""})`,
          type: isCashIn ? "IN" : "OUT",
          amountPaisa: absAmount,
          runningBalancePaisa: cashAccount.currentBalancePaisa + cashDeltaPaisa,
          category:
            transaction.serviceType === "AEPS"
              ? "AEPS_PAYOUT"
              : transaction.serviceType === "DMT"
              ? "DMT_CASH_IN"
              : transaction.serviceType === "UTILITY_BILL"
              ? "UTILITY_BILL_CASH"
              : transaction.serviceType === "RECHARGE"
              ? "RECHARGE_CASH"
              : transaction.serviceType === "GOOGLE_PLAY" || transaction.serviceType === "FASTAG"
              ? "GAMING_CASH"
              : "UPI_CASHOUT_PAYOUT",
          referenceId: transaction.id,
        },
        ...prev,
      ]);
    }

    // 5. Update Khata if fee added to khata
    const feeOnKhata =
      khataDeltaPaisa && khataDeltaPaisa > 0n
        ? khataDeltaPaisa
        : transaction.feeCollectionMode === "KHATA"
        ? transaction.customerFeePaisa
        : 0n;

    if (feeOnKhata > 0n) {
      setCustomers((prev) => {
        const nameToUse =
          customerName || transaction.customerName || `CSP Customer (${customerPhone || "Mobile"})`;
        const existing = prev.find(
          (c) =>
            (customerPhone && c.phone === customerPhone) ||
            (customerName && c.name.toLowerCase() === customerName.toLowerCase())
        );
        if (existing) {
          return prev.map((c) =>
            c.id === existing.id
              ? { ...c, currentDuePaisa: c.currentDuePaisa + feeOnKhata }
              : c
          );
        } else {
          return [
            ...prev,
            {
              id: `cust-${Date.now()}`,
              name: nameToUse,
              phone: customerPhone || "",
              currentDuePaisa: feeOnKhata,
              creditLimitPaisa: 200000n,
            },
          ];
        }
      });
    }

    showToast(`✓ ${transaction.serviceType} #${transaction.id} Recorded (${formatPaisa(transaction.amountPaisa)})`);
  };

  const handleVoidDigitalTransaction = (txnId: string) => {
    const txn = digitalTransactions.find((t) => t.id === txnId);
    if (!txn || txn.status === "VOID") return;

    // Calculate exact reversal deltas based on serviceType and feeCollectionMode
    let cashReversalPaisa = 0n;
    let sourceReversalPaisa = 0n;
    let qrReversalPaisa = 0n;
    let khataReversalPaisa = 0n;

    if (txn.serviceType === "AEPS") {
      sourceReversalPaisa = -(txn.amountPaisa + txn.portalCommissionPaisa);
      if (txn.feeCollectionMode === "CUT_FROM_CASH" || txn.feeCollectionMode === "SEPARATE_CASH") {
        const cashHanded =
          txn.amountPaisa >= txn.customerFeePaisa
            ? txn.amountPaisa - txn.customerFeePaisa
            : txn.amountPaisa;
        cashReversalPaisa = cashHanded;
      } else if (txn.feeCollectionMode === "UPI_QR") {
        cashReversalPaisa = txn.amountPaisa;
        qrReversalPaisa = -txn.customerFeePaisa;
      } else if (txn.feeCollectionMode === "KHATA") {
        cashReversalPaisa = txn.amountPaisa;
        khataReversalPaisa = -txn.customerFeePaisa;
      }
    } else if (txn.serviceType === "DMT") {
      if (txn.feeCollectionMode === "SEPARATE_CASH") {
        cashReversalPaisa = -(txn.amountPaisa + txn.customerFeePaisa);
        sourceReversalPaisa = txn.amountPaisa + txn.portalSurchargePaisa;
      } else if (txn.feeCollectionMode === "CUT_FROM_CASH") {
        cashReversalPaisa = -txn.amountPaisa;
        const transferSent =
          txn.amountPaisa >= txn.customerFeePaisa
            ? txn.amountPaisa - txn.customerFeePaisa
            : txn.amountPaisa;
        sourceReversalPaisa = transferSent + txn.portalSurchargePaisa;
      } else if (txn.feeCollectionMode === "UPI_QR") {
        cashReversalPaisa = -txn.amountPaisa;
        qrReversalPaisa = -txn.customerFeePaisa;
        sourceReversalPaisa = txn.amountPaisa + txn.portalSurchargePaisa;
      } else if (txn.feeCollectionMode === "KHATA") {
        cashReversalPaisa = -txn.amountPaisa;
        khataReversalPaisa = -txn.customerFeePaisa;
        sourceReversalPaisa = txn.amountPaisa + txn.portalSurchargePaisa;
      }
    } else if (txn.serviceType === "UPI_CASHOUT") {
      if (txn.feeCollectionMode === "INCLUDED_IN_QR") {
        cashReversalPaisa = txn.amountPaisa;
        sourceReversalPaisa = -(txn.amountPaisa + txn.customerFeePaisa);
      } else {
        const cashHanded =
          txn.amountPaisa >= txn.customerFeePaisa
            ? txn.amountPaisa - txn.customerFeePaisa
            : txn.amountPaisa;
        cashReversalPaisa = cashHanded;
        sourceReversalPaisa = -txn.amountPaisa;
      }
    } else if (
      txn.serviceType === "UTILITY_BILL" ||
      txn.serviceType === "RECHARGE" ||
      txn.serviceType === "FASTAG" ||
      txn.serviceType === "GOOGLE_PLAY"
    ) {
      const outwardPaid =
        txn.amountPaisa >= txn.portalCommissionPaisa
          ? txn.amountPaisa - txn.portalCommissionPaisa
          : txn.amountPaisa;
      sourceReversalPaisa = outwardPaid;

      const totalCollected = txn.amountPaisa + txn.customerFeePaisa;
      if (txn.feeCollectionMode === "SEPARATE_CASH" || txn.feeCollectionMode === "CUT_FROM_CASH") {
        cashReversalPaisa = -totalCollected;
      } else if (txn.feeCollectionMode === "UPI_QR") {
        qrReversalPaisa = -totalCollected;
      } else if (txn.feeCollectionMode === "KHATA") {
        khataReversalPaisa = -totalCollected;
      }
    }

    // 1. Mark status as VOID
    setDigitalTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, status: "VOID" } : t))
    );

    // 2. Reverse Treasury Accounts
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === cashAccount.id && cashReversalPaisa !== 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + cashReversalPaisa };
        }
        if (acc.id === txn.sourceAccountId && sourceReversalPaisa !== 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + sourceReversalPaisa };
        }
        if (acc.type === "UPI_HOLDING" && qrReversalPaisa !== 0n) {
          return {
            ...acc,
            currentBalancePaisa:
              acc.currentBalancePaisa >= -qrReversalPaisa
                ? acc.currentBalancePaisa + qrReversalPaisa
                : 0n,
          };
        }
        return acc;
      })
    );

    // 3. Reverse Customer Khata Due if applicable
    if (khataReversalPaisa !== 0n) {
      setCustomers((prev) =>
        prev.map((c) => {
          const match =
            (txn.customerMobile && c.phone === txn.customerMobile) ||
            (txn.customerName && c.name.toLowerCase() === txn.customerName.toLowerCase());
          if (match) {
            const dueReduction = -khataReversalPaisa;
            return {
              ...c,
              currentDuePaisa:
                c.currentDuePaisa >= dueReduction ? c.currentDuePaisa - dueReduction : 0n,
            };
          }
          return c;
        })
      );
    }

    // 4. Log VOID entry in Cash Book if physical cash was reversed
    if (cashReversalPaisa !== 0n) {
      const isCashIn = cashReversalPaisa > 0n;
      const absAmount = isCashIn ? cashReversalPaisa : -cashReversalPaisa;
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          time: timeStr,
          description: `VOID Banking #${txn.id} (${txn.serviceType} Reversal)`,
          type: isCashIn ? "IN" : "OUT",
          amountPaisa: absAmount,
          runningBalancePaisa: cashAccount.currentBalancePaisa + cashReversalPaisa,
          category: "VOID_REVERSAL",
          referenceId: txn.id,
        },
        ...prev,
      ]);
    }

    showToast(`✓ Voided ${txn.serviceType} #${txn.id} and reversed all account balances.`);
  };

  // Catalog Item Handlers
  const handleAddCatalogItem = (item: CatalogItem) => {
    setCatalogItems((prev) => {
      const updated = [item, ...prev];
      try {
        const toSave = updated.map((i) => ({
          ...i,
          pricePaisa: i.pricePaisa.toString(),
          costPricePaisa: i.costPricePaisa.toString(),
        }));
        localStorage.setItem("dc_user_catalog", JSON.stringify(toSave));
      } catch (e) {}
      return updated;
    });
    showToast(`✓ Added "${item.name}" to Catalog (${formatPaisa(item.pricePaisa)})`);
  };

  const handleEditCatalogItem = (updatedItem: CatalogItem) => {
    setCatalogItems((prev) => {
      const updated = prev.map((item) => (item.id === updatedItem.id ? updatedItem : item));
      try {
        const toSave = updated.map((i) => ({
          ...i,
          pricePaisa: i.pricePaisa.toString(),
          costPricePaisa: i.costPricePaisa.toString(),
        }));
        localStorage.setItem("dc_user_catalog", JSON.stringify(toSave));
      } catch (e) {}
      return updated;
    });
    showToast(`✓ Updated "${updatedItem.name}" in Catalog`);
  };

  const handleDeleteCatalogItem = (id: string) => {
    setCatalogItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      try {
        const toSave = updated.map((i) => ({
          ...i,
          pricePaisa: i.pricePaisa.toString(),
          costPricePaisa: i.costPricePaisa.toString(),
        }));
        localStorage.setItem("dc_user_catalog", JSON.stringify(toSave));
      } catch (e) {}
      return updated;
    });
    showToast(`✓ Removed item from Catalog`);
  };

  const handleClearCatalog = () => {
    setCatalogItems([]);
    try {
      localStorage.removeItem("dc_user_catalog");
      localStorage.removeItem("dc_catalog_items");
    } catch (e) {}
    showToast(`✓ Catalog cleared (0 items)`);
  };

  // Customer & Khata Handlers
  const handleAddCustomer = (c: Customer) => {
    setCustomers((prev) => [c, ...prev]);
    showToast(`✓ Added customer "${c.name}"`);
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    showToast(`✓ Updated customer "${updated.name}"`);
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    showToast(`✓ Customer removed`);
  };

  const handleRecordKhataSettlement = ({
    settlement,
    journal,
    cashDeltaPaisa,
    qrDeltaPaisa,
  }: {
    settlement: KhataSettlement;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    qrDeltaPaisa: bigint;
  }) => {
    // 1. Update Customer Due Balance & Advance Balance
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== settlement.customerId) return c;
        if (settlement.type === "ADVANCE_DEPOSIT") {
          return {
            ...c,
            advanceBalancePaisa: (c.advanceBalancePaisa || 0n) + settlement.amountPaisa,
          };
        }
        if (c.currentDuePaisa >= settlement.amountPaisa) {
          return {
            ...c,
            currentDuePaisa: c.currentDuePaisa - settlement.amountPaisa,
          };
        } else {
          const excess = settlement.amountPaisa - c.currentDuePaisa;
          return {
            ...c,
            currentDuePaisa: 0n,
            advanceBalancePaisa: (c.advanceBalancePaisa || 0n) + excess,
          };
        }
      })
    );

    // 2. Update Inward Treasury Account
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === cashAccount.id && cashDeltaPaisa > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + cashDeltaPaisa };
        }
        if (acc.type === "UPI_HOLDING" && qrDeltaPaisa > 0n) {
          return { ...acc, currentBalancePaisa: acc.currentBalancePaisa + qrDeltaPaisa };
        }
        return acc;
      })
    );

    // 3. Write to Cash Book if cash collected
    if (cashDeltaPaisa > 0n) {
      setCashBookEntries((prev) => [
        {
          id: `cb-${Date.now()}`,
          date: settlement.date,
          time: settlement.time,
          description: `Khata Due Cleared by ${settlement.customerName} (${settlement.paymentMethod})`,
          type: "IN",
          amountPaisa: settlement.amountPaisa,
          runningBalancePaisa: cashAccount.currentBalancePaisa + cashDeltaPaisa,
          category: "KHATA_PAYMENT",
          referenceId: settlement.id,
        },
        ...prev,
      ]);
    }

    showToast(`✓ Received payment of ${formatPaisa(settlement.amountPaisa)} from ${settlement.customerName}`);
  };

  const handleRecordStockMovement = ({
    movement,
    updatedItem,
    expenseJournal,
    treasuryDeltaPaisa,
    fundingAccountId,
  }: {
    movement: StockMovement;
    updatedItem: CatalogItem;
    expenseJournal?: JournalEntry;
    treasuryDeltaPaisa?: bigint;
    fundingAccountId?: string;
  }) => {
    // 1. Update Catalog Item (WAC and Stock)
    handleEditCatalogItem(updatedItem);

    // 2. Deduct from treasury if paid
    if (fundingAccountId && treasuryDeltaPaisa && treasuryDeltaPaisa < 0n) {
      const absPaisa = -treasuryDeltaPaisa;
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === fundingAccountId
            ? {
                ...acc,
                currentBalancePaisa:
                  acc.currentBalancePaisa >= absPaisa
                    ? acc.currentBalancePaisa - absPaisa
                    : 0n,
              }
            : acc
        )
      );

      if (fundingAccountId === cashAccount.id) {
        setCashBookEntries((prev) => [
          {
            id: `cb-${Date.now()}`,
            date: movement.date,
            time: movement.time,
            description: `Consumable Stock Purchase: ${movement.itemName} (${movement.quantityChange} units)`,
            type: "OUT",
            amountPaisa: absPaisa,
            runningBalancePaisa:
              cashAccount.currentBalancePaisa >= absPaisa
                ? cashAccount.currentBalancePaisa - absPaisa
                : 0n,
            category: "EXPENSE",
            referenceId: movement.id,
          },
          ...prev,
        ]);
      }
    }
  };

  // Direct Cash Book Entry Handler (Manual In / Out)
  const handleRecordCashEntry = ({
    description,
    type,
    amountPaisa,
    category,
  }: {
    description: string;
    type: "IN" | "OUT";
    amountPaisa: bigint;
    category: CashBookEntry["category"];
  }) => {
    // 1. Update Cash Drawer balance
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === cashAccount.id) {
          return {
            ...acc,
            currentBalancePaisa:
              type === "IN"
                ? acc.currentBalancePaisa + amountPaisa
                : acc.currentBalancePaisa >= amountPaisa
                ? acc.currentBalancePaisa - amountPaisa
                : 0n,
          };
        }
        return acc;
      })
    );

    // 2. Append to Cash Book
    const newBal =
      type === "IN"
        ? cashAccount.currentBalancePaisa + amountPaisa
        : cashAccount.currentBalancePaisa >= amountPaisa
        ? cashAccount.currentBalancePaisa - amountPaisa
        : 0n;

    setCashBookEntries((prev) => [
      {
        id: `cb-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        time: timeStr,
        description,
        type,
        amountPaisa,
        runningBalancePaisa: newBal,
        category,
      },
      ...prev,
    ]);

    showToast(`✓ Recorded Cash ${type} (${formatPaisa(amountPaisa)})`);
  };

  // Full Database Backup Restore Handler
  const handleRestoreAllData = (data: {
    accounts?: TreasuryAccount[];
    customers?: Customer[];
    catalogItems?: CatalogItem[];
    invoices?: InvoiceRecord[];
    digitalTransactions?: DigitalTransaction[];
    cashBookEntries?: CashBookEntry[];
    shopProfile?: ShopProfile;
    hardwareConfig?: HardwareConfig;
  }) => {
    if (data.accounts) setAccounts(data.accounts);
    if (data.customers) setCustomers(data.customers);
    if (data.catalogItems) setCatalogItems(data.catalogItems);
    if (data.invoices) setInvoices(data.invoices);
    if (data.digitalTransactions) setDigitalTransactions(data.digitalTransactions);
    if (data.cashBookEntries) setCashBookEntries(data.cashBookEntries);
    if (data.shopProfile) setShopProfile(data.shopProfile);
    if (data.hardwareConfig) setHardwareConfig(data.hardwareConfig);
    showToast("✓ All database records restored from JSON backup!");
  };

  // Factory Data Reset Handler
  const handleResetFactoryData = () => {
    localStorage.removeItem("dc_user_accounts");
    localStorage.removeItem("dc_user_customers");
    localStorage.removeItem("dc_user_catalog");
    localStorage.removeItem("dc_user_invoices");
    localStorage.removeItem("dc_csp_transactions");
    localStorage.removeItem("dc_user_cashbook");
    localStorage.removeItem("dc_day_close_audits");

    setAccounts(INITIAL_ACCOUNTS);
    setCustomers(INITIAL_CUSTOMERS);
    setCatalogItems(INITIAL_CATALOG_ITEMS);
    setInvoices([]);
    setDigitalTransactions([]);
    setCashBookEntries([]);
    showToast("✓ Factory reset complete: All records cleared to initial state.");
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      {/* 1. SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isCloudSynced={!!supabase}
      />

      {/* 2. MAIN WORKSPACE */}
      <main
        className={`flex-1 min-w-0 transition-colors ${
          activeTab === "pos" ? "h-screen overflow-hidden p-4 flex flex-col" : "h-screen overflow-y-auto p-6"
        }`}
      >
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
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 1 POS */}
        {activeTab === "pos" && (
          <PosTerminal
            catalogItems={catalogItems}
            onAddCatalogItem={handleAddCatalogItem}
            onEditCatalogItem={handleEditCatalogItem}
            onDeleteCatalogItem={handleDeleteCatalogItem}
            onClearCatalog={handleClearCatalog}
            customers={customers}
            accounts={accounts}
            invoices={invoices}
            onRecordSale={handleRecordPosSale}
            onVoidInvoice={handleVoidInvoice}
            onRecordReturn={handleRecordReturn}
            timeStr={timeStr}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 2 CSP */}
        {activeTab === "csp" && (
          <CspKiosk
            accounts={accounts}
            customers={customers}
            timeStr={timeStr}
            onRecordDigitalTransaction={handleRecordDigitalTransaction}
            onVoidDigitalTransaction={handleVoidDigitalTransaction}
            onAddAccount={handleAddAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 3 BBPS */}
        {activeTab === "bbps" && (
          <BbpsRechargeHub
            accounts={accounts}
            customers={customers}
            timeStr={timeStr}
            onRecordDigitalTransaction={handleRecordDigitalTransaction}
            onVoidDigitalTransaction={handleVoidDigitalTransaction}
            onAddAccount={handleAddAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 4 KHATA & STOCK */}
        {activeTab === "khata_stock" && (
          <KhataStockHub
            customers={customers}
            catalogItems={catalogItems}
            accounts={accounts}
            invoices={invoices}
            digitalTransactions={digitalTransactions}
            timeStr={timeStr}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onRecordKhataSettlement={handleRecordKhataSettlement}
            onAddCatalogItem={handleAddCatalogItem}
            onEditCatalogItem={handleEditCatalogItem}
            onDeleteCatalogItem={handleDeleteCatalogItem}
            onRecordStockMovement={handleRecordStockMovement}
            showToast={showToast}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 5 ACCOUNTS & CASHBOOK */}
        {activeTab === "accounts" && (
          <CashBookAccountsHub
            accounts={accounts}
            cashBookEntries={cashBookEntries}
            customers={customers}
            invoices={invoices}
            digitalTransactions={digitalTransactions}
            timeStr={timeStr}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onRecordCashEntry={handleRecordCashEntry}
            onOpenMoveMoney={() => setIsMoveOpen(true)}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
            showToast={showToast}
          />
        )}

        {/* WORKSPACE VIEW: MODULE 6 SETTINGS */}
        {activeTab === "settings" && (
          <SettingsBackupHub
            shopProfile={shopProfile}
            hardwareConfig={hardwareConfig}
            onUpdateShopProfile={setShopProfile}
            onUpdateHardwareConfig={setHardwareConfig}
            accounts={accounts}
            customers={customers}
            catalogItems={catalogItems}
            invoices={invoices}
            digitalTransactions={digitalTransactions}
            cashBookEntries={cashBookEntries}
            onRestoreAllData={handleRestoreAllData}
            onResetFactoryData={handleResetFactoryData}
            showToast={showToast}
          />
        )}
      </main>

      {/* ==================================================================== */}
      {/* UNIVERSAL CONTRA MOVE MONEY MODAL                                    */}
      {/* ==================================================================== */}
      {isMoveOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Universal Move Money (Contra)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountManagerOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-lg cursor-pointer"
                >
                  ⚙️ Manage Accounts
                </button>
                <button
                  type="button"
                  onClick={() => setIsMoveOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {liquidAccounts.length < 2 ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-center space-y-3">
                <span className="text-3xl block">🏦</span>
                <div>
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200">
                    Add Another Account to Move Money
                  </h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    You currently have only 1 account (<strong>{cashAccount.name}</strong>). To move money (e.g. Bank ATM cash withdrawal or Portal wallet transfer), please add your Bank account or Wallet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAccountManagerOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  + Add Bank / Wallet Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmMoveMoney} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Source Account (FROM)
                  </label>
                  <select
                    value={moveFromId}
                    onChange={(e) => setMoveFromId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {liquidAccounts.map((a) => (
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
                    {liquidAccounts.map((a) => (
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
                    min="1"
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

                <div className="flex items-center justify-end gap-2 pt-1">
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
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TREASURY & ACCOUNTS MANAGER MODAL                                     */}
      {/* ==================================================================== */}
      <AccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onEditAccount={handleEditAccount}
        onDeleteAccount={handleDeleteAccount}
        formatPaisa={formatPaisa}
      />
    </div>
  );
}
