import React, { useState, useMemo, useEffect } from "react";
import {
  CatalogItem,
  Customer,
  InvoiceRecord,
  InvoiceItem,
  PaymentMethod,
  TreasuryAccount,
  ItemKind,
} from "../core/contracts";
import { createPosSaleJournal, JournalEntry } from "../core/ledger";
import { syncInvoiceToCloud, syncCatalogItemToCloud } from "../core/supabase";
import { jsPDF } from "jspdf";
import {
  Search,
  Plus,
  Trash2,
  Printer,
  FileDown,
  MessageSquare,
  CheckCircle2,
  Wallet,
  QrCode,
  Users,
  Layers,
  ShoppingBag,
  Receipt,
  X,
  Pencil,
  LayoutGrid,
  List,
  PauseCircle,
  PlayCircle,
  Database,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  ChevronRight,
} from "lucide-react";

export interface HeldOrder {
  id: string;
  heldAt: string;
  time: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  discountRupees: string;
  subtotalPaisa: bigint;
  totalPaisa: bigint;
}

interface PosTerminalProps {
  catalogItems: CatalogItem[];
  onAddCatalogItem: (item: CatalogItem) => void;
  onEditCatalogItem: (item: CatalogItem) => void;
  onDeleteCatalogItem: (id: string) => void;
  onClearCatalog?: () => void;
  customers: Customer[];
  onAddCustomer?: (customer: Customer) => void;
  accounts: TreasuryAccount[];
  onRecordSale: (params: {
    invoice: InvoiceRecord;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    qrDeltaPaisa: bigint;
    khataDeltaPaisa: bigint;
    customerPhone?: string;
  }) => void;
  timeStr: string;
}

interface CartItem extends InvoiceItem {
  catalogId: string;
  costPricePaisa: bigint;
}

const CATEGORIES = [
  "All",
  "Xerox & Print",
  "Photos & Docs",
  "Online Forms",
  "Lamination & Binding",
  "Consumables Goods",
  "Others",
];

const EMOJI_OPTIONS = ["📄", "📑", "🎨", "🪪", "📸", "🛡️", "📝", "📤", "📦", "✏️", "🎫", "💻"];

export const PosTerminal: React.FC<PosTerminalProps> = ({
  catalogItems,
  onAddCatalogItem,
  onEditCatalogItem,
  onDeleteCatalogItem,
  onClearCatalog,
  customers,
  onAddCustomer,
  accounts,
  onRecordSale,
  timeStr,
}) => {
  // --- View Mode: Grid vs List ---
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("dc_pos_view_mode") as "grid" | "list") || "grid";
  });

  const toggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("dc_pos_view_mode", mode);
  };

  // --- Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // --- Cart State ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountRupees, setDiscountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");

  // Cash Tendered & Instant Change Calculator
  const [cashTendered, setCashTendered] = useState("");

  // Split Payment Inputs
  const [splitCashRupees, setSplitCashRupees] = useState("");

  // --- Held Orders State (Suspended Carts) ---
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    try {
      const saved = localStorage.getItem("dc_held_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((h: any) => ({
            ...h,
            subtotalPaisa: BigInt(h.subtotalPaisa || 0),
            totalPaisa: BigInt(h.totalPaisa || 0),
            items: h.items.map((i: any) => ({
              ...i,
              unitPricePaisa: BigInt(i.unitPricePaisa || 0),
              costPricePaisa: BigInt(i.costPricePaisa || 0),
              totalPaisa: BigInt(i.totalPaisa || 0),
            })),
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  // Save held orders to localStorage
  useEffect(() => {
    try {
      const serializable = heldOrders.map((h) => ({
        ...h,
        subtotalPaisa: h.subtotalPaisa.toString(),
        totalPaisa: h.totalPaisa.toString(),
        items: h.items.map((i) => ({
          ...i,
          unitPricePaisa: i.unitPricePaisa.toString(),
          costPricePaisa: i.costPricePaisa.toString(),
          totalPaisa: i.totalPaisa.toString(),
        })),
      }));
      localStorage.setItem("dc_held_orders", JSON.stringify(serializable));
    } catch (e) {}
  }, [heldOrders]);

  // --- Modals State ---
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const [isCatalogManagerOpen, setIsCatalogManagerOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceRecord | null>(null);

  // Add / Edit Catalog Item Form Fields
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Xerox & Print");
  const [formKind, setFormKind] = useState<ItemKind>("SERVICE");
  const [formPrice, setFormPrice] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formStock, setFormStock] = useState("999");
  const [formIcon, setFormIcon] = useState("📄");

  // Open Edit Modal with Pre-filled Values
  const handleOpenEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormKind(item.kind);
    setFormPrice((Number(item.pricePaisa) / 100).toFixed(2));
    setFormCost((Number(item.costPricePaisa) / 100).toFixed(2));
    setFormStock(item.currentStock.toString());
    setFormIcon(item.icon || "📄");
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormCategory("Xerox & Print");
    setFormKind("SERVICE");
    setFormPrice("");
    setFormCost("");
    setFormStock("999");
    setFormIcon("📄");
    setIsAddItemModalOpen(true);
  };

  // Format Paisa to INR String
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, "0");
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${cents}`;
  };

  // Filter Catalog Items
  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === "All" || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [catalogItems, searchQuery, selectedCategory]);

  // Cart Calculations
  const subtotalPaisa = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalPaisa, 0n);
  }, [cart]);

  const discountPaisa = useMemo(() => {
    const num = parseFloat(discountRupees);
    if (isNaN(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [discountRupees]);

  const payableTotalPaisa = useMemo(() => {
    const total = subtotalPaisa - discountPaisa;
    return total > 0n ? total : 0n;
  }, [subtotalPaisa, discountPaisa]);

  // Cash Change Calculation
  const cashTenderedPaisa = useMemo(() => {
    const num = parseFloat(cashTendered);
    if (isNaN(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [cashTendered]);

  const cashChangeToReturnPaisa = useMemo(() => {
    if (cashTenderedPaisa >= payableTotalPaisa) {
      return cashTenderedPaisa - payableTotalPaisa;
    }
    return 0n;
  }, [cashTenderedPaisa, payableTotalPaisa]);

  // Add Item to Cart with multiplier
  const addToCart = (item: CatalogItem, qtyToAdd: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.catalogId === item.id);
      if (existing) {
        const newQty = existing.quantity + qtyToAdd;
        return prev.map((ci) =>
          ci.catalogId === item.id
            ? {
                ...ci,
                quantity: newQty,
                totalPaisa: BigInt(newQty) * ci.unitPricePaisa,
              }
            : ci
        );
      } else {
        return [
          ...prev,
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            catalogId: item.id,
            name: item.name,
            quantity: qtyToAdd,
            unitPricePaisa: item.pricePaisa,
            costPricePaisa: item.costPricePaisa,
            totalPaisa: BigInt(qtyToAdd) * item.pricePaisa,
            kind: item.kind,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (catalogId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(catalogId);
      return;
    }
    setCart((prev) =>
      prev.map((ci) =>
        ci.catalogId === catalogId
          ? {
              ...ci,
              quantity: newQty,
              totalPaisa: BigInt(newQty) * ci.unitPricePaisa,
            }
          : ci
      )
    );
  };

  const removeFromCart = (catalogId: string) => {
    setCart((prev) => prev.filter((ci) => ci.catalogId !== catalogId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setDiscountRupees("");
    setCashTendered("");
    setSplitCashRupees("");
  };

  // --- HOLD ORDER (SUSPEND CURRENT SALE) ---
  const handleHoldOrder = () => {
    if (cart.length === 0) return;

    const newHeld: HeldOrder = {
      id: `hold-${Date.now()}`,
      heldAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      time: timeStr,
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim(),
      items: [...cart],
      discountRupees,
      subtotalPaisa,
      totalPaisa: payableTotalPaisa,
    };

    setHeldOrders((prev) => [newHeld, ...prev]);
    clearCart();
  };

  // --- RESUME HELD ORDER ---
  const handleResumeOrder = (held: HeldOrder) => {
    if (cart.length > 0) {
      const confirmSwap = window.confirm(
        "You have items in your current cart. Do you want to replace them with this held order?"
      );
      if (!confirmSwap) return;
    }

    setCart(held.items);
    setCustomerName(held.customerName);
    setCustomerPhone(held.customerPhone);
    setDiscountRupees(held.discountRupees);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    setIsHeldOrdersModalOpen(false);
  };

  // --- DISCARD HELD ORDER ---
  const handleDiscardHeldOrder = (id: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== id));
  };

  // Save Form (Add or Edit)
  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const priceNum = parseFloat(formPrice) || 0;
    const costNum = parseFloat(formCost) || 0;
    const stockNum = parseInt(formStock, 10) || 999;

    if (editingItem) {
      // Edit existing item
      const updated: CatalogItem = {
        ...editingItem,
        name: formName.trim(),
        category: formCategory,
        kind: formKind,
        pricePaisa: BigInt(Math.round(priceNum * 100)),
        costPricePaisa: BigInt(Math.round(costNum * 100)),
        currentStock: stockNum,
        icon: formIcon || "📄",
      };
      onEditCatalogItem(updated);
      syncCatalogItemToCloud(updated);
      setEditingItem(null);
    } else {
      // Create new item
      const newItem: CatalogItem = {
        id: `cat-${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        kind: formKind,
        pricePaisa: BigInt(Math.round(priceNum * 100)),
        costPricePaisa: BigInt(Math.round(costNum * 100)),
        currentStock: stockNum,
        minStockAlert: 10,
        icon: formIcon || "📄",
      };
      onAddCatalogItem(newItem);
      syncCatalogItemToCloud(newItem);
      setIsAddItemModalOpen(false);
    }
  };

  // Complete Sale & Record Transaction
  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    const todayDate = new Date().toISOString().split("T")[0];
    const invoiceNum = `INV-${todayDate.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const cashAcc = accounts.find((a) => a.type === "CASH") || accounts[0];
    const qrAcc = accounts.find((a) => a.type === "UPI_HOLDING") || accounts[0];
    const salesRevAcc = accounts.find((a) => a.type === "INCOME") || accounts[accounts.length - 1];

    let cashDeltaPaisa = 0n;
    let qrDeltaPaisa = 0n;
    let khataDeltaPaisa = 0n;

    const allocations: {
      method: "CASH" | "UPI" | "KHATA";
      amountPaisa: bigint;
      accountId?: string;
    }[] = [];

    if (paymentMethod === "CASH") {
      cashDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "CASH", amountPaisa: payableTotalPaisa, accountId: cashAcc.id });
    } else if (paymentMethod === "UPI") {
      qrDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "UPI", amountPaisa: payableTotalPaisa, accountId: qrAcc.id });
    } else if (paymentMethod === "KHATA") {
      khataDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "KHATA", amountPaisa: payableTotalPaisa });
    } else if (paymentMethod === "SPLIT") {
      const splitCash = BigInt(Math.round((parseFloat(splitCashRupees) || 0) * 100));
      const splitUpi = payableTotalPaisa - splitCash;
      cashDeltaPaisa = splitCash;
      qrDeltaPaisa = splitUpi > 0n ? splitUpi : 0n;
      allocations.push({ method: "CASH", amountPaisa: cashDeltaPaisa, accountId: cashAcc.id });
      allocations.push({ method: "UPI", amountPaisa: qrDeltaPaisa, accountId: qrAcc.id });
    }

    const newInvoice: InvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNum,
      date: todayDate,
      time: timeStr,
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim() || undefined,
      items: cart.map((c) => ({
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        unitPricePaisa: c.unitPricePaisa,
        totalPaisa: c.totalPaisa,
        kind: c.kind,
      })),
      subtotalPaisa,
      discountPaisa,
      totalPaisa: payableTotalPaisa,
      paymentMethod,
      allocations,
      status: "PAID",
    };

    // Build Double Entry Ledger Journal
    const ledgerAllocations = [];
    if (cashDeltaPaisa > 0n) ledgerAllocations.push({ account: cashAcc, amountPaisa: cashDeltaPaisa });
    if (qrDeltaPaisa > 0n) ledgerAllocations.push({ account: qrAcc, amountPaisa: qrDeltaPaisa });
    if (khataDeltaPaisa > 0n) {
      ledgerAllocations.push({
        account: { id: "acc-khata-receivable", name: "Khata Customer Receivables", type: "KHATA" },
        amountPaisa: khataDeltaPaisa,
      });
    }

    const journal = createPosSaleJournal({
      invoiceNumber: invoiceNum,
      date: todayDate,
      time: timeStr,
      totalPaisa: payableTotalPaisa,
      salesRevenueAccount: salesRevAcc,
      allocations: ledgerAllocations,
    });

    // Record via parent handler
    onRecordSale({
      invoice: newInvoice,
      journal,
      cashDeltaPaisa,
      qrDeltaPaisa,
      khataDeltaPaisa,
      customerPhone: customerPhone.trim() || undefined,
    });

    // Sync cloud asynchronously
    syncInvoiceToCloud(newInvoice);

    // Show Success Modal
    setCompletedInvoice(newInvoice);
    clearCart();
  };

  // 1. Generate & Download PDF Receipt using jsPDF
  const handleDownloadPdf = (inv: InvoiceRecord) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 160], // 80mm thermal receipt format
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("SARKAR COMMUNICATION", 40, 10, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Digital Seva Kendra & Cyber Cafe", 40, 14, { align: "center" });
    doc.text("West Bengal • Mob: +91 98765 43210", 40, 18, { align: "center" });
    doc.text("--------------------------------------------------", 40, 22, { align: "center" });

    doc.setFontSize(7.5);
    doc.text(`Invoice: ${inv.invoiceNumber}`, 6, 26);
    doc.text(`Date: ${inv.date} ${inv.time}`, 6, 30);
    doc.text(`Customer: ${inv.customerName}`, 6, 34);
    if (inv.customerPhone) {
      doc.text(`Phone: ${inv.customerPhone}`, 6, 38);
    }
    doc.text("--------------------------------------------------", 40, 42, { align: "center" });

    // Header Table
    let y = 46;
    doc.setFont("helvetica", "bold");
    doc.text("Item", 6, y);
    doc.text("Qty", 48, y);
    doc.text("Amount", 74, y, { align: "right" });
    y += 4;

    doc.setFont("helvetica", "normal");
    inv.items.forEach((item) => {
      const name = item.name.length > 22 ? item.name.substring(0, 20) + ".." : item.name;
      doc.text(name, 6, y);
      doc.text(`${item.quantity}`, 50, y);
      doc.text(formatPaisa(item.totalPaisa), 74, y, { align: "right" });
      y += 4;
    });

    y += 2;
    doc.text("--------------------------------------------------", 40, y, { align: "center" });
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("Subtotal:", 6, y);
    doc.text(formatPaisa(inv.subtotalPaisa), 74, y, { align: "right" });
    y += 4;

    if (inv.discountPaisa > 0n) {
      doc.text("Discount:", 6, y);
      doc.text(`-${formatPaisa(inv.discountPaisa)}`, 74, y, { align: "right" });
      y += 4;
    }

    doc.setFontSize(9);
    doc.text("TOTAL PAID:", 6, y);
    doc.text(formatPaisa(inv.totalPaisa), 74, y, { align: "right" });
    y += 5;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Tender Mode: ${inv.paymentMethod}`, 6, y);
    y += 6;

    doc.text("Thank you for visiting Sarkar Communication!", 40, y, { align: "center" });
    y += 4;
    doc.text("Govt Services • Banking CSP • Xerox & Print", 40, y, { align: "center" });

    doc.save(`${inv.invoiceNumber}.pdf`);
  };

  // 2. Browser Print (Thermal ESC/POS Layout)
  const handleThermalPrint = (inv: InvoiceRecord) => {
    const printWindow = window.open("", "_blank", "width=360,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${inv.invoiceNumber} Receipt</title>
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
          <div class="center">Digital Seva Kendra & CSP</div>
          <div class="center">Phone: +91 98765 43210</div>
          <div class="divider"></div>
          <div>Inv: ${inv.invoiceNumber}</div>
          <div>Date: ${inv.date} ${inv.time}</div>
          <div>Customer: ${inv.customerName}</div>
          ${inv.customerPhone ? `<div>Mobile: ${inv.customerPhone}</div>` : ""}
          <div class="divider"></div>
          <table>
            <thead>
              <tr class="bold">
                <td>Item</td>
                <td class="center">Qty</td>
                <td class="right">Total</td>
              </tr>
            </thead>
            <tbody>
              ${inv.items
                .map(
                  (i) => `
                <tr>
                  <td>${i.name}</td>
                  <td class="center">${i.quantity}</td>
                  <td class="right">${formatPaisa(i.totalPaisa)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="divider"></div>
          <table>
            <tr>
              <td>Subtotal</td>
              <td class="right">${formatPaisa(inv.subtotalPaisa)}</td>
            </tr>
            ${
              inv.discountPaisa > 0n
                ? `<tr><td>Discount</td><td class="right">-${formatPaisa(inv.discountPaisa)}</td></tr>`
                : ""
            }
            <tr class="bold" style="font-size: 13px;">
              <td>TOTAL PAID</td>
              <td class="right">${formatPaisa(inv.totalPaisa)}</td>
            </tr>
          </table>
          <div style="margin-top: 4px;">Paid via: <span class="bold">${inv.paymentMethod}</span></div>
          <div class="divider"></div>
          <div class="center" style="font-size: 10px;">Thank You! Visit Again</div>
          <div class="center" style="font-size: 9px;">Sarkar Communication Counter</div>
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

  // 3. Direct WhatsApp Dispatch
  const handleWhatsAppDispatch = (inv: InvoiceRecord) => {
    const phone = inv.customerPhone?.replace(/[^0-9]/g, "") || "";
    const itemsList = inv.items.map((i) => `• ${i.name} x${i.quantity} = ${formatPaisa(i.totalPaisa)}`).join("\n");
    const msg = `🧾 *SARKAR COMMUNICATION RECEIPT*\n` +
      `--------------------------------\n` +
      `*Invoice:* ${inv.invoiceNumber}\n` +
      `*Date:* ${inv.date} ${inv.time}\n` +
      `*Customer:* ${inv.customerName}\n\n` +
      `*Items:*\n${itemsList}\n` +
      `--------------------------------\n` +
      `*Grand Total:* ${formatPaisa(inv.totalPaisa)}\n` +
      `*Payment:* Paid via ${inv.paymentMethod} ✅\n\n` +
      `Thank you for visiting Sarkar Communication! 🙏`;

    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-5 h-5" />
              </span>
              Express Counter POS
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
              Module 01
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {catalogItems.length} Services Added
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fast counter billing with thermal receipts, WhatsApp dispatch, Hold order parking, and full catalog control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Storage Information Chip */}
          <button
            type="button"
            onClick={() => setIsCatalogManagerOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Manage all catalog items in a full table view"
          >
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>Manage Catalog ({catalogItems.length})</span>
          </button>

          {/* Held Orders Button with Pulse Badge */}
          {heldOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHeldOrdersModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer animate-pulse"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Held Orders ({heldOrders.length})</span>
            </button>
          )}

          {/* Primary "+ Add Service / Product" Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Service / Product</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN DESK: CATALOG GRID/LIST (LEFT) + BILLING CART (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* LEFT SECTION: CATALOG WITH VIEW TOGGLE (7 Cols)                   */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search, Category Filters, and Grid / List Switch */}
          {catalogItems.length > 0 && (
            <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-4 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search services or products..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Grid / List View Toggle */}
                <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => toggleViewMode("grid")}
                    title="Grid View"
                    className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      viewMode === "grid"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[10px]">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleViewMode("list")}
                    title="List View"
                    className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      viewMode === "list"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[10px]">List</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Catalog Render: Empty State vs Grid vs List */}
          {catalogItems.length === 0 ? (
            /* Clean Empty State: 100% Zero Preloaded Data with Clear + Add Option */
            <div className="bg-white/95 dark:bg-slate-800/90 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 p-12 rounded-3xl text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-xs">
                <Plus className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  No Services or Products in Catalog
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Zero preloaded data. Use the option below to add your exact services (e.g. Xerox, Printing, Photos, Online Forms) with your custom pricing.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/25 flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Your First Service / Product</span>
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl text-center text-xs text-slate-400">
              No services match "{searchQuery}" in "{selectedCategory}".
            </div>
          ) : viewMode === "grid" ? (
            /* ============================================================= */
            /* VIEW A: GRID VIEW (Vibrant Cards with Edit & Delete)          */
            /* ============================================================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.catalogId === item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative group ${
                      inCart
                        ? "bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/30 dark:to-slate-800 border-emerald-400 dark:border-emerald-600 shadow-sm"
                        : "bg-white/95 dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/70 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-xs"
                    }`}
                  >
                    {/* Action Buttons: Edit (✏️) and Delete (🗑️) */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit this service"
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${item.name}" from catalog?`)) {
                            onDeleteCatalogItem(item.id);
                          }
                        }}
                        title="Delete this service"
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-2 pr-14">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {item.name}
                            </h4>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 block">
                              {item.category}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatPaisa(item.pricePaisa)}
                          </span>
                          {inCart && (
                            <span className="block text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded-md mt-0.5">
                              {inCart.quantity} in cart
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Multiplier Chips */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Add:
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 5, 25, 50, 100].map((mult) => (
                          <button
                            key={mult}
                            type="button"
                            onClick={() => addToCart(item, mult)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-slate-700 dark:hover:bg-emerald-600 text-[10px] font-black font-mono text-slate-700 dark:text-slate-200 transition cursor-pointer"
                          >
                            +{mult}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ============================================================= */
            /* VIEW B: LIST VIEW (High-density tabular rows)                  */
            /* ============================================================= */
            <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.catalogId === item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-750/50 transition ${
                      inCart ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                    }`}
                  >
                    {/* Item Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-lg p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatPaisa(item.pricePaisa)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Multipliers in List View */}
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 5, 25, 50].map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => addToCart(item, mult)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-slate-700 dark:hover:bg-emerald-600 text-[10px] font-black font-mono text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                          +{mult}
                        </button>
                      ))}
                    </div>

                    {/* Edit & Delete Actions */}
                    <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 dark:border-slate-700 pl-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit service"
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${item.name}" from catalog?`)) {
                            onDeleteCatalogItem(item.id);
                          }
                        }}
                        title="Delete service"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* RIGHT SECTION: COUNTER BILLING DESK / CART (5 Cols)               */}
        {/* ================================================================= */}
        <div className="lg:col-span-5 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs space-y-4 sticky top-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Active Sale Order
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* HOLD CART BUTTON */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleHoldOrder}
                  title="Suspend & hold this order to serve next customer"
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <PauseCircle className="w-3 h-3 text-amber-500" />
                  <span>Hold Cart</span>
                </button>
              )}

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Customer Input */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-750/70 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                WhatsApp Phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                Cart is empty. Select services from your catalog or click multipliers (+1, +5, +25).
              </div>
            ) : (
              cart.map((ci) => (
                <div
                  key={ci.catalogId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {ci.name}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatPaisa(ci.unitPricePaisa)} each
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(ci.catalogId, ci.quantity - 1)}
                        className="px-2 py-0.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={ci.quantity}
                        onChange={(e) =>
                          updateCartQuantity(ci.catalogId, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-10 text-center font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(ci.catalogId, ci.quantity + 1)}
                        className="px-2 py-0.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-xs font-black font-mono text-slate-900 dark:text-white w-16 text-right">
                      {formatPaisa(ci.totalPaisa)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeFromCart(ci.catalogId)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal, Discount & Grand Total */}
          <div className="bg-slate-50 dark:bg-slate-750/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="font-mono text-slate-900 dark:text-white">
                {formatPaisa(subtotalPaisa)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Discount (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={discountRupees}
                onChange={(e) => setDiscountRupees(e.target.value)}
                className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Payable Total
              </span>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatPaisa(payableTotalPaisa)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector (4 Tenders) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Payment Tender
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "CASH", label: "Cash", icon: <Wallet className="w-3.5 h-3.5" /> },
                { id: "UPI", label: "UPI QR", icon: <QrCode className="w-3.5 h-3.5" /> },
                { id: "KHATA", label: "Khata", icon: <Users className="w-3.5 h-3.5" /> },
                { id: "SPLIT", label: "Split", icon: <Layers className="w-3.5 h-3.5" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-2 rounded-xl text-center flex flex-col items-center gap-1 transition cursor-pointer ${
                    paymentMethod === m.id
                      ? "bg-emerald-600 text-white font-extrabold shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-300 font-bold"
                  }`}
                >
                  {m.icon}
                  <span className="text-[10px]">{m.label}</span>
                </button>
              ))}
            </div>

            {/* If CASH: Cash Tendered & Instant Change Calculator */}
            {paymentMethod === "CASH" && (
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300">
                    Cash Received from Customer (₹):
                  </span>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 500"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-24 bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                {cashTenderedPaisa > 0n && (
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 text-xs font-black">
                    <span className="text-emerald-800 dark:text-emerald-300">
                      Change to Return:
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                      {formatPaisa(cashChangeToReturnPaisa)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* If SPLIT: Cash + UPI Breakdown */}
            {paymentMethod === "SPLIT" && (
              <div className="bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 p-3 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Cash Portion (₹):
                  </span>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 50"
                    value={splitCashRupees}
                    onChange={(e) => setSplitCashRupees(e.target.value)}
                    className="w-24 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs"
                  />
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>UPI Remaining:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatPaisa(
                      payableTotalPaisa -
                        BigInt(Math.round((parseFloat(splitCashRupees) || 0) * 100))
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Complete Sale Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleCompleteSale}
            className={`w-full py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition ${
              cart.length === 0
                ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 cursor-pointer"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete & Tender Sale ({formatPaisa(payableTotalPaisa)})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. MODAL: ADD OR EDIT SERVICE / PRODUCT                               */}
      {/* ===================================================================== */}
      {(isAddItemModalOpen || editingItem) && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {editingItem ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </span>
                {editingItem ? `Edit "${editingItem.name}"` : "Add Service / Product to Catalog"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddItemModalOpen(false);
                  setEditingItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Service / Product Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Xerox B&W, Color Print, Aadhaar PVC, Lamination"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Kind
                  </label>
                  <select
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as ItemKind)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="SERVICE">Service (Print, Xerox, Form)</option>
                    <option value="GOODS">Physical Goods (Paper, Pen)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Xerox & Print">Xerox & Print</option>
                    <option value="Photos & Docs">Photos & Docs</option>
                    <option value="Online Forms">Online Forms</option>
                    <option value="Lamination & Binding">Lamination & Binding</option>
                    <option value="Consumables Goods">Consumables Goods</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Sale Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    placeholder="e.g. 2.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Raw Unit Cost (₹) (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 0.50"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition cursor-pointer ${
                        formIcon === emoji
                          ? "bg-emerald-500 text-white shadow-xs scale-110"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddItemModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  {editingItem ? "Save Changes" : "Save & Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. MODAL: HELD ORDERS DRAWER (PARKED CARTS)                          */}
      {/* ===================================================================== */}
      {isHeldOrdersModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600">
                  <PauseCircle className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Held Orders Parking Lot ({heldOrders.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHeldOrdersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {heldOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No orders are currently held on pause.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {heldOrders.map((h) => (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {h.customerName}
                        </span>
                        {h.customerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({h.customerPhone})
                          </span>
                        )}
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-md font-medium">
                          Held at {h.heldAt}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {h.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                      </p>
                      <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                        Total: {formatPaisa(h.totalPaisa)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResumeOrder(h)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDiscardHeldOrder(h.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Discard held order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL: COMPREHENSIVE CATALOG MANAGER TABLE                         */}
      {/* ===================================================================== */}
      {isCatalogManagerOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Database className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Catalog Storage & Item Manager
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    💾 Stored in local storage (<code className="font-mono text-emerald-600">dc_user_catalog</code>) & synced to Supabase (<code className="font-mono text-indigo-600">catalog_items</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {catalogItems.length > 0 && onClearCatalog && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete ALL catalog items?")) {
                        onClearCatalog();
                        setIsCatalogManagerOpen(false);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCatalogManagerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Table of all items */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              {catalogItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Catalog is completely empty. Click "+ Add Service / Product" to create your first item.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-750 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-3">Service / Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Sale Price</th>
                      <th className="p-3 text-right">Cost Price</th>
                      <th className="p-3 text-center">Margin</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium">
                    {catalogItems.map((item) => {
                      const price = Number(item.pricePaisa);
                      const cost = Number(item.costPricePaisa);
                      const marginPct = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                          <td className="p-3 flex items-center gap-2">
                            <span>{item.icon}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                          </td>
                          <td className="p-3 text-slate-500">{item.category}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatPaisa(item.pricePaisa)}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-500">
                            {formatPaisa(item.costPricePaisa)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {marginPct}%
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCatalogManagerOpen(false);
                                handleOpenEditModal(item);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                              title="Edit item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete "${item.name}" from catalog?`)) {
                                  onDeleteCatalogItem(item.id);
                                }
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 shrink-0">
              <span className="text-[11px] text-slate-500">
                Total items: <strong className="text-slate-900 dark:text-white">{catalogItems.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCatalogManagerOpen(false);
                  handleOpenAddModal();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                + Add Another Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: POST-SALE RECEIPT & MULTI-CHANNEL DISPATCH                 */}
      {/* ===================================================================== */}
      {completedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-xs">
              ✓
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Sale Tendered Successfully
              </span>
              <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-2">
                {formatPaisa(completedInvoice.totalPaisa)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Invoice <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{completedInvoice.invoiceNumber}</span> • {completedInvoice.paymentMethod}
              </p>
            </div>

            {/* 3 One-Click Output Actions */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(completedInvoice)}
                className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:bg-slate-700/80 border border-emerald-200/90 dark:border-emerald-700/60 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition cursor-pointer"
              >
                <FileDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  PDF Slip
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleThermalPrint(completedInvoice)}
                className="p-3 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 dark:bg-slate-700/80 border border-sky-200/90 dark:border-sky-700/60 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition cursor-pointer"
              >
                <Printer className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Thermal Print
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleWhatsAppDispatch(completedInvoice)}
                className="p-3 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:bg-slate-700/80 border border-teal-200/90 dark:border-teal-700/60 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition cursor-pointer"
              >
                <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  WhatsApp
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedInvoice(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-650 text-white font-bold text-xs transition cursor-pointer mt-2"
            >
              Start Next Sale ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
