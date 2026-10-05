import React, { useState, useMemo } from "react";
import {
  TreasuryAccount,
  Customer,
  CatalogItem,
  InvoiceRecord,
  DigitalTransaction,
  StockMovement,
  KhataSettlement,
} from "../core/contracts";
import {
  createKhataSettlementJournal,
  createExpenseJournal,
  JournalEntry,
} from "../core/ledger";
import { jsPDF } from "jspdf";
import {
  Users,
  Package,
  History,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Phone,
  UserCheck,
  CreditCard,
  MessageSquare,
  FileDown,
  Printer,
  Edit2,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Boxes,
  Layers,
  Sparkles,
  ShieldCheck,
  Receipt,
  DollarSign,
  AlertCircle,
  Tag,
  ShoppingBag,
} from "lucide-react";

export interface KhataStockHubProps {
  customers: Customer[];
  catalogItems: CatalogItem[];
  accounts: TreasuryAccount[];
  invoices: InvoiceRecord[];
  digitalTransactions: DigitalTransaction[];
  timeStr: string;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onRecordKhataSettlement: (params: {
    settlement: KhataSettlement;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    qrDeltaPaisa: bigint;
  }) => void;
  onAddCatalogItem: (item: CatalogItem) => void;
  onEditCatalogItem: (item: CatalogItem) => void;
  onDeleteCatalogItem: (id: string) => void;
  onRecordStockMovement: (params: {
    movement: StockMovement;
    updatedItem: CatalogItem;
    expenseJournal?: JournalEntry;
    treasuryDeltaPaisa?: bigint;
    fundingAccountId?: string;
  }) => void;
  showToast: (msg: string) => void;
}

// Preset Cyber Cafe Consumables for 1-Tap Quick Setup
const CYBER_CAFE_PRESET_ITEMS: Omit<CatalogItem, "id">[] = [
  {
    name: "JK Copier A4 Paper (75 GSM)",
    category: "PAPER",
    kind: "GOODS",
    pricePaisa: 32000n, // ₹320
    costPricePaisa: 27000n, // ₹270
    currentStock: 15,
    minStockAlert: 5,
    icon: "📄",
  },
  {
    name: "Century Star A4 Paper (70 GSM)",
    category: "PAPER",
    kind: "GOODS",
    pricePaisa: 28000n, // ₹280
    costPricePaisa: 23000n, // ₹230
    currentStock: 10,
    minStockAlert: 4,
    icon: "📄",
  },
  {
    name: "100 Micron A4 Lamination Pouches (100 Pcs)",
    category: "LAMINATION",
    kind: "GOODS",
    pricePaisa: 35000n, // ₹350
    costPricePaisa: 22000n, // ₹220
    currentStock: 6,
    minStockAlert: 2,
    icon: "📑",
  },
  {
    name: "250 Micron Identity Card Pouches (100 Pcs)",
    category: "LAMINATION",
    kind: "GOODS",
    pricePaisa: 20000n, // ₹200
    costPricePaisa: 11000n, // ₹110
    currentStock: 5,
    minStockAlert: 2,
    icon: "💳",
  },
  {
    name: "HP 88A / 36A Black Toner Cartridge",
    category: "INK_TONER",
    kind: "GOODS",
    pricePaisa: 55000n, // ₹550
    costPricePaisa: 32000n, // ₹320
    currentStock: 4,
    minStockAlert: 2,
    icon: "🖨️",
  },
  {
    name: "Epson 003 Black Ink Bottle (65ml)",
    category: "INK_TONER",
    kind: "GOODS",
    pricePaisa: 38000n, // ₹380
    costPricePaisa: 29000n, // ₹290
    currentStock: 8,
    minStockAlert: 3,
    icon: "🧪",
  },
  {
    name: "Glossy Photo Paper 4x6 (180 GSM, 100 Sheets)",
    category: "PAPER",
    kind: "GOODS",
    pricePaisa: 22000n, // ₹220
    costPricePaisa: 12000n, // ₹120
    currentStock: 12,
    minStockAlert: 4,
    icon: "🖼️",
  },
  {
    name: "PVC Inkjet Smart Aadhaar Cards (230 Pcs Box)",
    category: "CARDS",
    kind: "GOODS",
    pricePaisa: 80000n, // ₹800
    costPricePaisa: 45000n, // ₹450
    currentStock: 2,
    minStockAlert: 1,
    icon: "🪪",
  },
  {
    name: "Spiral Binding Coils (Assorted, 100 Pcs)",
    category: "BINDING",
    kind: "GOODS",
    pricePaisa: 30000n, // ₹300
    costPricePaisa: 18000n, // ₹180
    currentStock: 5,
    minStockAlert: 2,
    icon: "🌀",
  },
];

export const KhataStockHub: React.FC<KhataStockHubProps> = ({
  customers,
  catalogItems,
  accounts,
  invoices,
  digitalTransactions,
  timeStr,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onRecordKhataSettlement,
  onAddCatalogItem,
  onEditCatalogItem,
  onDeleteCatalogItem,
  onRecordStockMovement,
  showToast,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"khata" | "stock" | "history">("khata");

  // Local persistence for settlements & stock movements history
  const [settlements, setSettlements] = useState<KhataSettlement[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_khata_settlements");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => ({
            ...s,
            amountPaisa: BigInt(s.amountPaisa || 0),
            previousDuePaisa: BigInt(s.previousDuePaisa || 0),
            remainingDuePaisa: BigInt(s.remainingDuePaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem("dc_user_stock_movements");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((m: any) => ({
            ...m,
            unitCostPaisa: BigInt(m.unitCostPaisa || 0),
            totalCostPaisa: BigInt(m.totalCostPaisa || 0),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  // Helper: Format BigInt paisa
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = Number(abs / 100n);
    const remainder = Number(abs % 100n);
    const formatted = remainder > 0 ? `${rupees}.${remainder.toString().padStart(2, "0")}` : `${rupees}`;
    return `${isNeg ? "-" : ""}₹${formatted}`;
  };

  // Cash Account and QR Account for receiving settlements
  const cashAccount = useMemo(() => {
    return (
      accounts.find((a) => a.id === "acc-cash" || a.type === "CASH") || {
        id: "acc-cash",
        code: "1010",
        name: "Shop Cash Drawer",
        type: "CASH" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      }
    );
  }, [accounts]);

  const qrAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== "acc-cash" && a.type === "UPI_HOLDING");
  }, [accounts]);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.type === "BANK");
  }, [accounts]);

  // ============================================================================
  // TAB 1: CUSTOMER KHATA STATE & MODALS
  // ============================================================================
  const [khataSearch, setKhataSearch] = useState<string>("");
  const [khataFilter, setKhataFilter] = useState<"ALL" | "WITH_DUES" | "OVER_LIMIT">("ALL");

  // Add / Edit Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custNameInput, setCustNameInput] = useState("");
  const [custPhoneInput, setCustPhoneInput] = useState("");
  const [custLimitInput, setCustLimitInput] = useState("2000");

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustNameInput("");
    setCustPhoneInput("");
    setCustLimitInput("2000");
    setIsCustomerModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustNameInput(c.name);
    setCustPhoneInput(c.phone || "");
    setCustLimitInput((Number(c.creditLimitPaisa) / 100).toString());
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custNameInput.trim()) {
      alert("Customer name is required.");
      return;
    }
    const limitNum = parseFloat(custLimitInput) || 0;
    const limitPaisa = BigInt(Math.round(limitNum * 100));

    if (editingCustomer) {
      const updated: Customer = {
        ...editingCustomer,
        name: custNameInput.trim(),
        phone: custPhoneInput.trim(),
        creditLimitPaisa: limitPaisa,
      };
      onUpdateCustomer(updated);
      showToast(`✓ Updated customer ${updated.name}`);
    } else {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        name: custNameInput.trim(),
        phone: custPhoneInput.trim(),
        currentDuePaisa: 0n,
        creditLimitPaisa: limitPaisa > 0n ? limitPaisa : 200000n,
        createdAt: new Date().toISOString().split("T")[0],
      };
      onAddCustomer(newCust);
      showToast(`✓ Added customer ${newCust.name}`);
    }
    setIsCustomerModalOpen(false);
  };

  // Receive Payment / Settle Due Modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState("");
  const [settleMethod, setSettleMethod] = useState<"CASH" | "UPI">("CASH");
  const [settleNotes, setSettleNotes] = useState("");
  const [completedSettlement, setCompletedSettlement] = useState<KhataSettlement | null>(null);

  const openSettleModal = (c: Customer) => {
    setSettlingCustomer(c);
    setSettleAmountInput((Number(c.currentDuePaisa) / 100).toString());
    setSettleMethod("CASH");
    setSettleNotes("Settled at counter");
  };

  const settleAmountPaisa = useMemo(() => {
    const num = parseFloat(settleAmountInput) || 0;
    return BigInt(Math.round(num * 100));
  }, [settleAmountInput]);

  const handleConfirmSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer) return;
    if (settleAmountPaisa <= 0n) {
      alert("Please enter a payment amount greater than ₹0.");
      return;
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const settlementId = `SET-${Date.now().toString().slice(-6)}`;

    let receivingAcc = cashAccount;
    let cashDelta = 0n;
    let qrDelta = 0n;

    if (settleMethod === "UPI") {
      receivingAcc = qrAccounts[0] || {
        id: "acc-qr-temp",
        code: "1041",
        name: "Counter UPI QR",
        type: "UPI_HOLDING" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      };
      qrDelta = settleAmountPaisa;
    } else {
      cashDelta = settleAmountPaisa;
    }

    const journal = createKhataSettlementJournal({
      settlementId,
      date: todayDate,
      time: timeStr,
      amountPaisa: settleAmountPaisa,
      customerName: settlingCustomer.name,
      receivingAccount: receivingAcc,
    });

    const previousDue = settlingCustomer.currentDuePaisa;
    const remainingDue = previousDue >= settleAmountPaisa ? previousDue - settleAmountPaisa : 0n;

    const newSettlement: KhataSettlement = {
      id: settlementId,
      customerId: settlingCustomer.id,
      customerName: settlingCustomer.name,
      customerPhone: settlingCustomer.phone,
      date: todayDate,
      time: timeStr,
      amountPaisa: settleAmountPaisa,
      previousDuePaisa: previousDue,
      remainingDuePaisa: remainingDue,
      paymentMethod: settleMethod,
      receivingAccountId: receivingAcc.id,
      receivingAccountName: receivingAcc.name,
      notes: settleNotes.trim() || undefined,
    };

    onRecordKhataSettlement({
      settlement: newSettlement,
      journal,
      cashDeltaPaisa: cashDelta,
      qrDeltaPaisa: qrDelta,
    });

    setSettlements((prev) => {
      const updated = [newSettlement, ...prev];
      try {
        const serializable = updated.map((s) => ({
          ...s,
          amountPaisa: s.amountPaisa.toString(),
          previousDuePaisa: s.previousDuePaisa.toString(),
          remainingDuePaisa: s.remainingDuePaisa.toString(),
        }));
        localStorage.setItem("dc_user_khata_settlements", JSON.stringify(serializable));
      } catch (e) {}
      return updated;
    });

    setCompletedSettlement(newSettlement);
    setSettlingCustomer(null);
  };

  // Customer Ledger Statement View Modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  const customerTransactions = useMemo(() => {
    if (!statementCustomer) return { custInvoices: [], custCsp: [], custSettlements: [] };
    // 1. Credit Invoices
    const custInvoices = invoices.filter(
      (inv) =>
        inv.paymentMethod === "KHATA" ||
        (inv.allocations && inv.allocations.some((al) => al.method === "KHATA" && al.customerId === statementCustomer.id)) ||
        inv.customerName.toLowerCase() === statementCustomer.name.toLowerCase()
    );

    // 2. CSP Transactions on Khata
    const custCsp = digitalTransactions.filter(
      (t) =>
        t.feeCollectionMode === "KHATA" &&
        ((t.customerName && t.customerName.toLowerCase() === statementCustomer.name.toLowerCase()) ||
          (t.customerMobile && t.customerMobile === statementCustomer.phone))
    );

    // 3. Settlements
    const custSettlements = settlements.filter((s) => s.customerId === statementCustomer.id);

    return { custInvoices, custCsp, custSettlements };
  }, [statementCustomer, invoices, digitalTransactions, settlements]);

  // WhatsApp Statement Dispatch
  const handleSendWhatsAppReminder = (c: Customer) => {
    let msg = `🧾 *SARKAR COMMUNICATION - KHATA DUES STATEMENT*\n`;
    msg += `----------------------------------------\n`;
    msg += `👤 *Customer Name:* ${c.name}\n`;
    msg += `📅 *Statement Date:* ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}\n`;
    msg += `💳 *Credit Limit:* ${formatPaisa(c.creditLimitPaisa)}\n`;
    msg += `💰 *Current Outstanding Due:* ${formatPaisa(c.currentDuePaisa)}\n`;
    msg += `----------------------------------------\n`;
    msg += `Dear customer, please clear your outstanding balance at our counter at your earliest convenience.\n\n`;
    msg += `You can pay in Cash at the counter or scan our Soundbox QR on your next visit.\n\n`;
    msg += `Thank you for your business!\n*Sarkar Communication • Digital Seva Hub*`;

    const phone = c.phone ? c.phone.replace(/\D/g, "") : "";
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // WhatsApp Settlement Slip Dispatch
  const handleSendSettlementWhatsApp = (s: KhataSettlement) => {
    let msg = `✅ *SARKAR COMMUNICATION - KHATA PAYMENT RECEIPT*\n`;
    msg += `----------------------------------------\n`;
    msg += `📄 *Receipt No:* ${s.id}\n`;
    msg += `📅 *Date & Time:* ${s.date} ${s.time}\n`;
    msg += `👤 *Customer:* ${s.customerName}\n`;
    msg += `💵 *Amount Paid:* ${formatPaisa(s.amountPaisa)}\n`;
    msg += `💳 *Payment Mode:* ${s.paymentMethod}\n`;
    msg += `💰 *Previous Due:* ${formatPaisa(s.previousDuePaisa)}\n`;
    msg += `✨ *Remaining Outstanding Due:* ${formatPaisa(s.remainingDuePaisa)}\n`;
    msg += `----------------------------------------\n`;
    msg += `Thank you! Your payment has been credited to your Khata ledger.\n`;
    msg += `*Sarkar Communication*`;

    const phone = s.customerPhone ? s.customerPhone.replace(/\D/g, "") : "";
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (khataFilter === "WITH_DUES" && c.currentDuePaisa <= 0n) return false;
      if (khataFilter === "OVER_LIMIT" && c.currentDuePaisa <= c.creditLimitPaisa) return false;
      if (khataSearch.trim()) {
        const q = khataSearch.toLowerCase();
        const match = c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [customers, khataFilter, khataSearch]);

  const totalKhataDuePaisa = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.currentDuePaisa, 0n);
  }, [customers]);

  const overLimitCount = useMemo(() => {
    return customers.filter((c) => c.currentDuePaisa > c.creditLimitPaisa).length;
  }, [customers]);

  // ============================================================================
  // TAB 2: CONSUMABLES STOCK & INVENTORY WAC STATE
  // ============================================================================
  const [stockSearch, setStockSearch] = useState<string>("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Add / Edit Catalog Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [itemNameInput, setItemNameInput] = useState("");
  const [itemCategoryInput, setItemCategoryInput] = useState("PAPER");
  const [itemKindInput, setItemKindInput] = useState<"GOODS" | "SERVICE">("GOODS");
  const [itemPriceInput, setItemPriceInput] = useState("320");
  const [itemCostInput, setItemCostInput] = useState("270");
  const [itemStockInput, setItemStockInput] = useState("10");
  const [itemMinStockInput, setItemMinStockInput] = useState("3");
  const [itemIconInput, setItemIconInput] = useState("📄");

  const openAddItem = () => {
    setEditingItem(null);
    setItemNameInput("");
    setItemCategoryInput("PAPER");
    setItemKindInput("GOODS");
    setItemPriceInput("320");
    setItemCostInput("270");
    setItemStockInput("10");
    setItemMinStockInput("3");
    setItemIconInput("📄");
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: CatalogItem) => {
    setEditingItem(item);
    setItemNameInput(item.name);
    setItemCategoryInput(item.category);
    setItemKindInput(item.kind);
    setItemPriceInput((Number(item.pricePaisa) / 100).toString());
    setItemCostInput((Number(item.costPricePaisa) / 100).toString());
    setItemStockInput(item.currentStock.toString());
    setItemMinStockInput(item.minStockAlert.toString());
    setItemIconInput(item.icon || "📦");
    setIsItemModalOpen(true);
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameInput.trim()) {
      alert("Item name is required.");
      return;
    }
    const priceNum = parseFloat(itemPriceInput) || 0;
    const costNum = parseFloat(itemCostInput) || 0;
    const stockNum = parseInt(itemStockInput, 10) || 0;
    const minAlertNum = parseInt(itemMinStockInput, 10) || 0;

    if (editingItem) {
      const updated: CatalogItem = {
        ...editingItem,
        name: itemNameInput.trim(),
        category: itemCategoryInput,
        kind: itemKindInput,
        pricePaisa: BigInt(Math.round(priceNum * 100)),
        costPricePaisa: BigInt(Math.round(costNum * 100)),
        currentStock: stockNum,
        minStockAlert: minAlertNum,
        icon: itemIconInput.trim() || "📦",
      };
      onEditCatalogItem(updated);
      showToast(`✓ Updated "${updated.name}"`);
    } else {
      const newItem: CatalogItem = {
        id: `item-${Date.now()}`,
        name: itemNameInput.trim(),
        category: itemCategoryInput,
        kind: itemKindInput,
        pricePaisa: BigInt(Math.round(priceNum * 100)),
        costPricePaisa: BigInt(Math.round(costNum * 100)),
        currentStock: stockNum,
        minStockAlert: minAlertNum,
        icon: itemIconInput.trim() || "📦",
      };
      onAddCatalogItem(newItem);
      showToast(`✓ Added "${newItem.name}" to inventory`);
    }
    setIsItemModalOpen(false);
  };

  // Stock In (Purchase & WAC Re-calculation) Modal
  const [stockingInItem, setStockingInItem] = useState<CatalogItem | null>(null);
  const [stockInQty, setStockInQty] = useState<string>("10");
  const [stockInUnitCost, setStockInUnitCost] = useState<string>("270");
  const [stockInFundingId, setStockInFundingId] = useState<string>("acc-cash");
  const [stockInSupplier, setStockInSupplier] = useState<string>("");
  const [stockInNotes, setStockInNotes] = useState<string>("");

  const openStockInModal = (item: CatalogItem) => {
    setStockingInItem(item);
    setStockInQty("10");
    setStockInUnitCost((Number(item.costPricePaisa) / 100).toString());
    setStockInFundingId("acc-cash");
    setStockInSupplier("Local Wholesaler");
    setStockInNotes("Stock replenishment");
  };

  const newWacCalculation = useMemo(() => {
    if (!stockingInItem) return { newWacPaisa: 0n, totalCostPaisa: 0n, newStock: 0, addQty: 0, addUnitCostPaisa: 0n };
    const addQty = parseInt(stockInQty, 10) || 0;
    const addUnitCostNum = parseFloat(stockInUnitCost) || 0;
    const addUnitCostPaisa = BigInt(Math.round(addUnitCostNum * 100));

    const currentStock = stockingInItem.currentStock;
    const currentWacPaisa = stockingInItem.costPricePaisa;

    const totalOldCostPaisa = BigInt(currentStock) * currentWacPaisa;
    const totalNewAddCostPaisa = BigInt(addQty) * addUnitCostPaisa;

    const newStock = currentStock + addQty;
    const totalCombinedCostPaisa = totalOldCostPaisa + totalNewAddCostPaisa;
    const newWacPaisa = newStock > 0 ? totalCombinedCostPaisa / BigInt(newStock) : addUnitCostPaisa;

    return {
      newWacPaisa,
      totalCostPaisa: totalNewAddCostPaisa,
      newStock,
      addQty,
      addUnitCostPaisa,
    };
  }, [stockingInItem, stockInQty, stockInUnitCost]);

  const handleConfirmStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockingInItem) return;
    if (newWacCalculation.addQty <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const movementId = `STK-IN-${Date.now().toString().slice(-6)}`;

    // Create updated item with new stock and new WAC
    const updatedItem: CatalogItem = {
      ...stockingInItem,
      currentStock: newWacCalculation.newStock,
      costPricePaisa: newWacCalculation.newWacPaisa,
    };

    const newMovement: StockMovement = {
      id: movementId,
      itemId: stockingInItem.id,
      itemName: stockingInItem.name,
      date: todayDate,
      time: timeStr,
      type: "PURCHASE_IN",
      quantityChange: newWacCalculation.addQty,
      unitCostPaisa: newWacCalculation.addUnitCostPaisa,
      totalCostPaisa: newWacCalculation.totalCostPaisa,
      fundingAccountId: stockInFundingId !== "none" ? stockInFundingId : undefined,
      supplierName: stockInSupplier.trim() || undefined,
      notes: stockInNotes.trim() || undefined,
    };

    let expenseJournal: JournalEntry | undefined = undefined;
    let treasuryDeltaPaisa = 0n;

    if (stockInFundingId !== "none") {
      const fundingAcc = accounts.find((a) => a.id === stockInFundingId) || cashAccount;
      const expenseAcc = accounts.find((a) => a.type === "EXPENSE") || {
        id: "acc-expenses",
        code: "5010",
        name: "Shop Expenses",
        type: "EXPENSE" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      };

      expenseJournal = createExpenseJournal({
        expenseId: movementId,
        date: todayDate,
        time: timeStr,
        amountPaisa: newWacCalculation.totalCostPaisa,
        sourceAccount: fundingAcc,
        expenseAccount: expenseAcc,
        category: "Consumable Stock Purchase",
        paidTo: stockInSupplier || "Supplier",
        note: `Stock In: ${newWacCalculation.addQty}x ${stockingInItem.name}`,
      });

      treasuryDeltaPaisa = -newWacCalculation.totalCostPaisa;
    }

    onRecordStockMovement({
      movement: newMovement,
      updatedItem,
      expenseJournal,
      treasuryDeltaPaisa,
      fundingAccountId: stockInFundingId !== "none" ? stockInFundingId : undefined,
    });

    setStockMovements((prev) => {
      const updated = [newMovement, ...prev];
      try {
        const serializable = updated.map((m) => ({
          ...m,
          unitCostPaisa: m.unitCostPaisa.toString(),
          totalCostPaisa: m.totalCostPaisa.toString(),
        }));
        localStorage.setItem("dc_user_stock_movements", JSON.stringify(serializable));
      } catch (e) {}
      return updated;
    });

    showToast(`✓ Stock Added: +${newWacCalculation.addQty} ${stockingInItem.name} (New WAC: ${formatPaisa(newWacCalculation.newWacPaisa)})`);
    setStockingInItem(null);
  };

  // Stock Out / Scrap Modal
  const [stockingOutItem, setStockingOutItem] = useState<CatalogItem | null>(null);
  const [stockOutQty, setStockOutQty] = useState<string>("1");
  const [stockOutReason, setStockOutReason] = useState<"INTERNAL_USE" | "SCRAP_ADJUSTMENT">("INTERNAL_USE");
  const [stockOutNotes, setStockOutNotes] = useState<string>("Used for bulk contract");

  const openStockOutModal = (item: CatalogItem) => {
    setStockingOutItem(item);
    setStockOutQty("1");
    setStockOutReason("INTERNAL_USE");
    setStockOutNotes("Used for counter operations");
  };

  const handleConfirmStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockingOutItem) return;
    const qty = parseInt(stockOutQty, 10) || 0;
    if (qty <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }
    if (qty > stockingOutItem.currentStock) {
      alert(`Cannot deduct ${qty}. Only ${stockingOutItem.currentStock} in stock.`);
      return;
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const movementId = `STK-OUT-${Date.now().toString().slice(-6)}`;
    const newStock = stockingOutItem.currentStock - qty;

    const updatedItem: CatalogItem = {
      ...stockingOutItem,
      currentStock: newStock,
    };

    const newMovement: StockMovement = {
      id: movementId,
      itemId: stockingOutItem.id,
      itemName: stockingOutItem.name,
      date: todayDate,
      time: timeStr,
      type: stockOutReason,
      quantityChange: -qty,
      unitCostPaisa: stockingOutItem.costPricePaisa,
      totalCostPaisa: BigInt(qty) * stockingOutItem.costPricePaisa,
      notes: stockOutNotes.trim() || undefined,
    };

    onRecordStockMovement({
      movement: newMovement,
      updatedItem,
    });

    setStockMovements((prev) => {
      const updated = [newMovement, ...prev];
      try {
        const serializable = updated.map((m) => ({
          ...m,
          unitCostPaisa: m.unitCostPaisa.toString(),
          totalCostPaisa: m.totalCostPaisa.toString(),
        }));
        localStorage.setItem("dc_user_stock_movements", JSON.stringify(serializable));
      } catch (e) {}
      return updated;
    });

    showToast(`✓ Deducted -${qty} ${stockingOutItem.name} (${stockOutReason})`);
    setStockingOutItem(null);
  };

  // 1-Tap Quick Stocking Presets
  const handleAddPresetStock = (preset: typeof CYBER_CAFE_PRESET_ITEMS[0]) => {
    const newItem: CatalogItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...preset,
    };
    onAddCatalogItem(newItem);
    showToast(`✓ Added "${preset.name}"`);
  };

  // Filtered Catalog Items
  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((i) => {
      if (stockCategoryFilter !== "ALL" && i.category !== stockCategoryFilter) return false;
      if (stockStatusFilter === "LOW_STOCK" && (i.currentStock > i.minStockAlert || i.currentStock === 0)) return false;
      if (stockStatusFilter === "OUT_OF_STOCK" && i.currentStock > 0) return false;
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase();
        if (!i.name.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [catalogItems, stockCategoryFilter, stockStatusFilter, stockSearch]);

  const totalStockValuationPaisa = useMemo(() => {
    return catalogItems.reduce((sum, item) => sum + (BigInt(item.currentStock) * item.costPricePaisa), 0n);
  }, [catalogItems]);

  const lowStockCount = useMemo(() => {
    return catalogItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStockAlert).length;
  }, [catalogItems]);

  const outOfStockCount = useMemo(() => {
    return catalogItems.filter((i) => i.kind === "GOODS" && i.currentStock === 0).length;
  }, [catalogItems]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & METRICS */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Module 4: Customer Khata & Consumables Stock
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  WAC & AR Kernel
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customer udhaar credit ledger, repayments, and cyber cafe consumables stock (paper, toner, pouches).
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-right">
              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Total Khata Dues</span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatPaisa(totalKhataDuePaisa)}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 text-right">
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Stock Valuation (WAC)</span>
              <span className="text-sm font-black text-purple-600 dark:text-purple-400">{formatPaisa(totalStockValuationPaisa)}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-right">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Alerts</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                {overLimitCount > 0 ? `${overLimitCount} Over Limit` : `${lowStockCount} Low Stock`}
              </span>
            </div>
          </div>
        </div>

        {/* SUB-TABS SELECTOR */}
        <div className="mt-5 flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("khata")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "khata"
                ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            1. Customer Khata & Dues ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "stock"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Package className="w-4 h-4" />
            2. Consumables Stock & WAC ({catalogItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            3. Repayments & Movement Log ({settlements.length + stockMovements.length})
          </button>
        </div>
      </div>

      {/* 2. TAB 1: CUSTOMER KHATA WORKSPACE */}
      {activeTab === "khata" && (
        <div className="space-y-4">
          {/* Top Actions: Search & Filter */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={khataSearch}
                  onChange={(e) => setKhataSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setKhataFilter("ALL")}
                  className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
                    khataFilter === "ALL"
                      ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  All ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setKhataFilter("WITH_DUES")}
                  className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
                    khataFilter === "WITH_DUES"
                      ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  With Dues ({customers.filter((c) => c.currentDuePaisa > 0n).length})
                </button>
                <button
                  type="button"
                  onClick={() => setKhataFilter("OVER_LIMIT")}
                  className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
                    khataFilter === "OVER_LIMIT"
                      ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Over Limit ({overLimitCount})
                </button>
              </div>

              <button
                type="button"
                onClick={openAddCustomer}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Customer
              </button>
            </div>
          </div>

          {/* Customer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-12 text-center text-slate-400 space-y-3">
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Customers Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "+ Add Customer" to register trusted regular customers and track counter udhaar.
                </p>
                <button
                  type="button"
                  onClick={openAddCustomer}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  + Add First Customer
                </button>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isOverLimit = c.currentDuePaisa > c.creditLimitPaisa;
                const hasDues = c.currentDuePaisa > 0n;
                const percentLimit =
                  c.creditLimitPaisa > 0n
                    ? Math.min(100, Math.round((Number(c.currentDuePaisa) / Number(c.creditLimitPaisa)) * 100))
                    : 0;

                return (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-purple-400/60 dark:hover:border-purple-600 transition"
                  >
                    <div>
                      {/* Customer Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            {c.name}
                            {isOverLimit && (
                              <span title="Credit limit exceeded" className="text-rose-500">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.phone || "No phone registered"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            isOverLimit
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                              : hasDues
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {isOverLimit ? "LIMIT EXCEEDED" : hasDues ? "DUE PENDING" : "CLEAR"}
                        </span>
                      </div>

                      {/* Financial Balances */}
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Current Outstanding Due:</span>
                          <span
                            className={`font-mono font-black text-sm ${
                              hasDues ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {formatPaisa(c.currentDuePaisa)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span>Credit Limit:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatPaisa(c.creditLimitPaisa)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isOverLimit ? "bg-rose-500" : percentLimit > 75 ? "bg-amber-500" : "bg-purple-600"
                            }`}
                            style={{ width: `${percentLimit}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-right font-mono text-slate-400">
                          {percentLimit}% of limit utilized
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Edit Customer"
                          onClick={() => openEditCustomer(c)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="View Statement / History"
                          onClick={() => setStatementCustomer(c)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="WhatsApp Statement Reminder"
                          onClick={() => handleSendWhatsAppReminder(c)}
                          className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {c.currentDuePaisa === 0n && (
                          <button
                            type="button"
                            title="Delete Customer"
                            onClick={() => {
                              if (confirm(`Delete customer ${c.name}?`)) {
                                onDeleteCustomer(c.id);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {hasDues ? (
                        <button
                          type="button"
                          onClick={() => openSettleModal(c)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Receive Payment
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {c.advanceBalancePaisa && c.advanceBalancePaisa > 0n ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Adv: {formatPaisa(c.advanceBalancePaisa)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              No Dues
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSettlingCustomer(c);
                              setSettleAmountInput("500");
                              setSettleMethod("CASH");
                              setSettleNotes("Customer Advance Deposit");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition cursor-pointer"
                          >
                            + Advance
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. TAB 2: CONSUMABLES STOCK & WAC WORKSPACE */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {/* 1-Tap Quick Stock Presets Ribbon if catalog is empty */}
          {catalogItems.length === 0 && (
            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  1-Tap Quick Consumables Setup (Preload Standard Cyber Cafe Stock)
                </span>
                <span className="text-[10px] text-slate-500">Zero mock data • Configures real inventory items</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CYBER_CAFE_PRESET_ITEMS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPresetStock(preset)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({formatPaisa(preset.pricePaisa)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search consumables, paper, toner, pouches..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={stockCategoryFilter}
                onChange={(e) => setStockCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Categories</option>
                <option value="PAPER">Paper Reams</option>
                <option value="LAMINATION">Lamination Pouches</option>
                <option value="INK_TONER">Inks & Toners</option>
                <option value="CARDS">PVC Cards</option>
                <option value="BINDING">Binding Materials</option>
                <option value="SERVICES">Services</option>
              </select>

              <button
                type="button"
                onClick={openAddItem}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Consumable
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="py-3 px-4">Item & Category</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-right">WAC Cost</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Inventory Valuation</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Stock Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalogItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                        <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-bold">No consumables found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCatalogItems.map((item) => {
                      const isLowStock = item.currentStock > 0 && item.currentStock <= item.minStockAlert;
                      const isOut = item.kind === "GOODS" && item.currentStock === 0;
                      const valuationPaisa = BigInt(item.currentStock) * item.costPricePaisa;
                      const marginPaisa = item.pricePaisa >= item.costPricePaisa ? item.pricePaisa - item.costPricePaisa : 0n;
                      const marginPct =
                        item.pricePaisa > 0n
                          ? Math.round((Number(marginPaisa) / Number(item.pricePaisa)) * 100)
                          : 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{item.icon || "📦"}</span>
                              <div>
                                <div className="font-black text-slate-900 dark:text-white">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {item.category} • {item.kind}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.kind === "GOODS" ? (
                              <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                {item.currentStock}
                                <span className="text-[10px] font-normal text-slate-400 ml-1">
                                  (Min: {item.minStockAlert})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-bold">N/A (Service)</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 dark:text-slate-300">
                            {formatPaisa(item.costPricePaisa)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatPaisa(item.pricePaisa)}
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              {marginPct}% Margin
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {item.kind === "GOODS" ? formatPaisa(valuationPaisa) : "—"}
                          </td>

                          <td className="py-3 px-4">
                            {item.kind === "SERVICE" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                Unlimited
                              </span>
                            ) : isOut ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                OUT OF STOCK
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                IN STOCK
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.kind === "GOODS" && (
                                <>
                                  <button
                                    type="button"
                                    title="Stock In / Purchase"
                                    onClick={() => openStockInModal(item)}
                                    className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Stock In
                                  </button>
                                  <button
                                    type="button"
                                    title="Stock Out / Scrap"
                                    onClick={() => openStockOutModal(item)}
                                    className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <TrendingDown className="w-3 h-3" />
                                    Deduct
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                title="Edit Item"
                                onClick={() => openEditItem(item)}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete Item"
                                onClick={() => {
                                  if (confirm(`Remove item "${item.name}" from catalog?`)) {
                                    onDeleteCatalogItem(item.id);
                                  }
                                }}
                                className="p-1 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 3: REPAYMENTS & STOCK MOVEMENT AUDIT LOG */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: KHATA REPAYMENTS */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Khata Repayment & Debt Clearance Receipts ({settlements.length})
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[500px]">
              {settlements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No repayment receipts recorded yet.</div>
              ) : (
                settlements.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {s.customerName}
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {s.paymentMethod}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.date} {s.time} • Receipt #{s.id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        +{formatPaisa(s.amountPaisa)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Rem: {formatPaisa(s.remainingDuePaisa)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: STOCK MOVEMENTS LOG */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-500" />
              Consumables Stock Movements Log ({stockMovements.length})
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[500px]">
              {stockMovements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No stock movements recorded yet.</div>
              ) : (
                stockMovements.map((m) => {
                  const isIn = m.quantityChange > 0;
                  return (
                    <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {m.itemName}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              isIn
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {m.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.date} {m.time} {m.supplierName ? `• Supplier: ${m.supplierName}` : ""}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className={`font-black ${isIn ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {isIn ? `+${m.quantityChange}` : m.quantityChange} Units
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatPaisa(m.totalCostPaisa)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 1: ADD / EDIT CUSTOMER */}
      {/* ======================================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              {editingCustomer ? "Edit Customer Profile" : "Register New Customer"}
            </h3>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subrata Mukherjee"
                  value={custNameInput}
                  onChange={(e) => setCustNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  10-Digit Mobile Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9830123456"
                  value={custPhoneInput}
                  onChange={(e) => setCustPhoneInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Credit Limit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-black">₹</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={custLimitInput}
                    onChange={(e) => setCustLimitInput(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Default limit: ₹2,000. Customer will be flagged if due exceeds this amount.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black cursor-pointer shadow-xs"
                >
                  {editingCustomer ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 2: RECEIVE PAYMENT / SETTLE DUE */}
      {/* ======================================================================= */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Receive Khata Payment
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  Customer: {settlingCustomer.name} ({settlingCustomer.phone || "No phone"})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Outstanding</span>
                <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                  {formatPaisa(settlingCustomer.currentDuePaisa)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettlement} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Amount Received (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-black">₹</span>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={settleAmountInput}
                    onChange={(e) => setSettleAmountInput(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setSettleAmountInput((Number(settlingCustomer.currentDuePaisa) / 100).toString())}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold cursor-pointer"
                  >
                    Full Due ({formatPaisa(settlingCustomer.currentDuePaisa)})
                  </button>
                  {settlingCustomer.currentDuePaisa > 20000n && (
                    <button
                      type="button"
                      onClick={() => setSettleAmountInput((Number(settlingCustomer.currentDuePaisa / 2n) / 100).toString())}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                    >
                      50% Due
                    </button>
                  )}
                  {["500", "1000", "2000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSettleAmountInput(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method (Inward Account)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleMethod("CASH")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      settleMethod === "CASH"
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Cash Drawer (Notes)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleMethod("UPI")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      settleMethod === "UPI"
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Counter UPI QR
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at counter"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Balance Preview */}
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Balance Due:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    {formatPaisa(
                      settlingCustomer.currentDuePaisa >= settleAmountPaisa
                        ? settlingCustomer.currentDuePaisa - settleAmountPaisa
                        : 0n
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Receive Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 3: COMPLETED SETTLEMENT RECEIPT DIALOG */}
      {/* ======================================================================= */}
      {completedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Khata Payment Cleared!
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Receipt #{completedSettlement.id} • {completedSettlement.date} {completedSettlement.time}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2 text-xs border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedSettlement.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedSettlement.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Received:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatPaisa(completedSettlement.amountPaisa)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500">Remaining Due:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatPaisa(completedSettlement.remainingDuePaisa)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSendSettlementWhatsApp(completedSettlement)}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp Slip
              </button>
              <button
                type="button"
                onClick={() => setCompletedSettlement(null)}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 4: ADD / EDIT CATALOG ITEM */}
      {/* ======================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              {editingItem ? "Edit Consumable Item" : "Add Consumable Item"}
            </h3>

            <form onSubmit={handleSaveCatalogItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Icon</label>
                  <input
                    type="text"
                    value={itemIconInput}
                    onChange={(e) => setItemIconInput(e.target.value)}
                    className="w-full text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div className="col-span-3">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JK Copier A4 Paper (75 GSM)"
                    value={itemNameInput}
                    onChange={(e) => setItemNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                  <select
                    value={itemCategoryInput}
                    onChange={(e) => setItemCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="PAPER">Paper Reams</option>
                    <option value="LAMINATION">Lamination Pouches</option>
                    <option value="INK_TONER">Inks & Toners</option>
                    <option value="CARDS">PVC Cards</option>
                    <option value="BINDING">Binding Materials</option>
                    <option value="SERVICES">Services</option>
                    <option value="GENERAL">General Consumables</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Kind</label>
                  <select
                    value={itemKindInput}
                    onChange={(e) => setItemKindInput(e.target.value as "GOODS" | "SERVICE")}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="GOODS">Goods (Tracks Stock)</option>
                    <option value="SERVICE">Service (Unlimited)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Unit Cost (WAC) (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={itemCostInput}
                    onChange={(e) => setItemCostInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={itemPriceInput}
                    onChange={(e) => setItemPriceInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                  />
                </div>
              </div>

              {itemKindInput === "GOODS" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Initial Stock</label>
                    <input
                      type="number"
                      min={0}
                      value={itemStockInput}
                      onChange={(e) => setItemStockInput(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Low Stock Alert Limit</label>
                    <input
                      type="number"
                      min={0}
                      value={itemMinStockInput}
                      onChange={(e) => setItemMinStockInput(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black cursor-pointer shadow-xs"
                >
                  {editingItem ? "Update Consumable" : "Save Consumable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 5: STOCK IN / PURCHASE STOCK WITH WAC RECALCULATION */}
      {/* ======================================================================= */}
      {stockingInItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-emerald-600" />
                Stock In: {stockingInItem.name}
              </h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Current Stock: {stockingInItem.currentStock} • Existing WAC: {formatPaisa(stockingInItem.costPricePaisa)}
              </p>
            </div>

            <form onSubmit={handleConfirmStockIn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Units Received *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stockInQty}
                    onChange={(e) => setStockInQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Unit Purchase Cost (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={stockInUnitCost}
                    onChange={(e) => setStockInUnitCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Dynamic WAC recalculation badge */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>Total Purchase Bill:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black">
                    {formatPaisa(newWacCalculation.totalCostPaisa)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>New Total Stock:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {newWacCalculation.newStock} Units
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/50">
                  <span>New Re-calculated WAC:</span>
                  <span className="font-mono font-black">
                    {formatPaisa(newWacCalculation.newWacPaisa)} / unit
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Funding Account (Deduct Bill Amount)
                </label>
                <select
                  value={stockInFundingId}
                  onChange={(e) => setStockInFundingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="acc-cash">Shop Cash Drawer ({formatPaisa(cashAccount.currentBalancePaisa)})</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatPaisa(b.currentBalancePaisa)})
                    </option>
                  ))}
                  <option value="none">None / Direct Expense Unpaid</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Supplier / Depot</label>
                  <input
                    type="text"
                    placeholder="e.g. Burdwan Paper Mart"
                    value={stockInSupplier}
                    onChange={(e) => setStockInSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Bill / Invoice Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Bill #8902"
                    value={stockInNotes}
                    onChange={(e) => setStockInNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setStockingInItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 6: STOCK OUT / INTERNAL CONSUMPTION & SCRAP */}
      {/* ======================================================================= */}
      {stockingOutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                Deduct Stock: {stockingOutItem.name}
              </h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Current In Stock: {stockingOutItem.currentStock} Units
              </p>
            </div>

            <form onSubmit={handleConfirmStockOut} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quantity to Deduct *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={stockingOutItem.currentStock}
                  value={stockOutQty}
                  onChange={(e) => setStockOutQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-amber-600 dark:text-amber-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Reason</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStockOutReason("INTERNAL_USE")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      stockOutReason === "INTERNAL_USE"
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Internal Counter Use
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockOutReason("SCRAP_ADJUSTMENT")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      stockOutReason === "SCRAP_ADJUSTMENT"
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Damaged / Scrap Audit
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 2 reams consumed for school question paper contract"
                  value={stockOutNotes}
                  onChange={(e) => setStockOutNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setStockingOutItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Deduct from Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 7: CUSTOMER STATEMENT & HISTORY VIEW */}
      {/* ======================================================================= */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Receipt className="w-5 h-5 text-purple-600" />
                  Khata Statement: {statementCustomer.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Phone: {statementCustomer.phone || "—"} • Credit Limit: {formatPaisa(statementCustomer.creditLimitPaisa)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Current Outstanding</span>
                <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                  {formatPaisa(statementCustomer.currentDuePaisa)}
                </span>
              </div>
            </div>

            {/* Scrollable Ledger */}
            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              {/* Repayments */}
              {customerTransactions.custSettlements.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider text-emerald-600">
                    Repayments & Debt Settlements
                  </h4>
                  {customerTransactions.custSettlements.map((s) => (
                    <div key={s.id} className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-800/40 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Repayment #{s.id} ({s.paymentMethod})</div>
                        <div className="text-[10px] text-slate-400">{s.date} {s.time} {s.notes ? `• ${s.notes}` : ""}</div>
                      </div>
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        -{formatPaisa(s.amountPaisa)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Invoices on Khata */}
              {customerTransactions.custInvoices.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider text-purple-600">
                    POS Counter Invoices on Credit
                  </h4>
                  {customerTransactions.custInvoices.map((inv) => (
                    <div key={inv.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Invoice #{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {inv.date} {inv.time} • {inv.items.length} item(s)
                        </div>
                      </div>
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        +{formatPaisa(inv.totalPaisa)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CSP Banking on Khata */}
              {customerTransactions.custCsp.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider text-sky-600">
                    CSP Banking Fees on Khata
                  </h4>
                  {customerTransactions.custCsp.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/40 dark:border-sky-800/40 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{t.serviceType} Fee #{t.id}</div>
                        <div className="text-[10px] text-slate-400">{t.date} {t.time} • {t.beneficiaryDetails}</div>
                      </div>
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        +{formatPaisa(t.customerFeePaisa)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {customerTransactions.custInvoices.length === 0 &&
                customerTransactions.custCsp.length === 0 &&
                customerTransactions.custSettlements.length === 0 && (
                  <div className="py-8 text-center text-slate-400">No transaction records found for this customer.</div>
                )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setStatementCustomer(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
