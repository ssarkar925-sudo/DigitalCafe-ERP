import React, { useState, useMemo, useEffect } from "react";
import {
  CatalogItem,
  Customer,
  InvoiceRecord,
  InvoiceItem,
  ReturnRecord,
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
import { SalesHistoryModal } from "./SalesHistoryModal";

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
  invoices?: InvoiceRecord[];
  onRecordSale: (params: {
    invoice: InvoiceRecord;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    qrDeltaPaisa: bigint;
    khataDeltaPaisa: bigint;
    customerPhone?: string;
  }) => void;
  onVoidInvoice?: (invoiceId: string) => void;
  onRecordReturn?: (params: { returnRecord: ReturnRecord; refundDeltaPaisa: bigint }) => void;
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

export type SplitMode = "CASH_UPI" | "CASH_KHATA" | "UPI_KHATA" | "3WAY";

export const PosTerminal: React.FC<PosTerminalProps> = ({
  catalogItems,
  onAddCatalogItem,
  onEditCatalogItem,
  onDeleteCatalogItem,
  onClearCatalog,
  customers,
  onAddCustomer,
  accounts,
  invoices = [],
  onRecordSale,
  onVoidInvoice,
  onRecordReturn,
  timeStr,
}) => {
  // --- View Mode: Grid vs List ---
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("dc_pos_view_mode") as "grid" | "list") || "grid";
  });

  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);

  const toggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("dc_pos_view_mode", mode);
  };

  // --- Today's Sales Ticker Memo ---
  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todaySalesPaisa = useMemo(() => {
    if (!invoices) return 0n;
    return invoices
      .filter((inv) => inv.date === todayDateStr)
      .reduce((sum, inv) => sum + inv.totalPaisa, 0n);
  }, [invoices, todayDateStr]);

  const todayInvoicesCount = useMemo(() => {
    if (!invoices) return 0;
    return invoices.filter((inv) => inv.date === todayDateStr).length;
  }, [invoices, todayDateStr]);

  // --- Quick Custom Charge (One-Time Fast Line Item) State ---
  const [isQuickChargeModalOpen, setIsQuickChargeModalOpen] = useState(false);
  const [quickChargeName, setQuickChargeName] = useState("Print / Xerox");
  const [quickChargePrice, setQuickChargePrice] = useState("");
  const [quickChargeQty, setQuickChargeQty] = useState("1");

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

  // Split Payment Inputs & Selected Mode
  const [splitMode, setSplitMode] = useState<SplitMode>("CASH_UPI");
  const [splitCashRupees, setSplitCashRupees] = useState("");
  const [splitUpiRupees, setSplitUpiRupees] = useState("");
  const [splitKhataRupees, setSplitKhataRupees] = useState("");

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
  const [formBarcode, setFormBarcode] = useState("");
  const [formHsn, setFormHsn] = useState("");
  const [formGstRate, setFormGstRate] = useState<number>(0);

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
    setFormBarcode(item.barcode || "");
    setFormHsn(item.hsnCode || "");
    setFormGstRate(item.gstRatePercent || 0);
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
    setFormBarcode("");
    setFormHsn("");
    setFormGstRate(0);
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
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.hsnCode && item.hsnCode.toLowerCase().includes(q));
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

  // Split Calculations (Cash + UPI QR + Khata Udhaar, filtered by selected splitMode)
  const splitCashPaisa = useMemo(() => {
    if (splitMode === "UPI_KHATA") return 0n;
    const num = parseFloat(splitCashRupees);
    if (isNaN(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [splitCashRupees, splitMode]);

  const splitUpiPaisa = useMemo(() => {
    if (splitMode === "CASH_KHATA") return 0n;
    const num = parseFloat(splitUpiRupees);
    if (isNaN(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [splitUpiRupees, splitMode]);

  const splitKhataPaisa = useMemo(() => {
    if (splitMode === "CASH_UPI") return 0n;
    const num = parseFloat(splitKhataRupees);
    if (isNaN(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [splitKhataRupees, splitMode]);

  const totalSplitAllocatedPaisa = useMemo(() => {
    return splitCashPaisa + splitUpiPaisa + splitKhataPaisa;
  }, [splitCashPaisa, splitUpiPaisa, splitKhataPaisa]);

  const splitRemainingPaisa = useMemo(() => {
    return payableTotalPaisa - totalSplitAllocatedPaisa;
  }, [payableTotalPaisa, totalSplitAllocatedPaisa]);

  // Split Visual Percentages for Segmented Progress Bar
  const splitPcts = useMemo(() => {
    if (payableTotalPaisa <= 0n) return { cash: 0, upi: 0, khata: 0, remaining: 0 };
    const c = Math.min(100, Math.round(Number((splitCashPaisa * 1000n) / payableTotalPaisa) / 10));
    const u = Math.min(100 - c, Math.round(Number((splitUpiPaisa * 1000n) / payableTotalPaisa) / 10));
    const k = Math.min(100 - c - u, Math.round(Number((splitKhataPaisa * 1000n) / payableTotalPaisa) / 10));
    const r = Math.max(0, 100 - c - u - k);
    return { cash: c, upi: u, khata: k, remaining: r };
  }, [payableTotalPaisa, splitCashPaisa, splitUpiPaisa, splitKhataPaisa]);

  // Instant Smart-Balancing Helpers for 2-Way & 3-Way Splits
  const handleCashSplitChange = (val: string) => {
    setSplitCashRupees(val);
    if (splitMode === "CASH_UPI") {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        const enteredPaisa = BigInt(Math.round(num * 100));
        const remPaisa = payableTotalPaisa - enteredPaisa;
        setSplitUpiRupees(remPaisa > 0n ? (Number(remPaisa) / 100).toFixed(2).replace(/\.00$/, "") : "0");
      } else {
        setSplitUpiRupees("");
      }
    } else if (splitMode === "CASH_KHATA") {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        const enteredPaisa = BigInt(Math.round(num * 100));
        const remPaisa = payableTotalPaisa - enteredPaisa;
        setSplitKhataRupees(remPaisa > 0n ? (Number(remPaisa) / 100).toFixed(2).replace(/\.00$/, "") : "0");
      } else {
        setSplitKhataRupees("");
      }
    }
  };

  const handleUpiSplitChange = (val: string) => {
    setSplitUpiRupees(val);
    if (splitMode === "UPI_KHATA") {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        const enteredPaisa = BigInt(Math.round(num * 100));
        const remPaisa = payableTotalPaisa - enteredPaisa;
        setSplitKhataRupees(remPaisa > 0n ? (Number(remPaisa) / 100).toFixed(2).replace(/\.00$/, "") : "0");
      } else {
        setSplitKhataRupees("");
      }
    }
  };

  const handleSelectSplitMode = (mode: SplitMode) => {
    setSplitMode(mode);
    setSplitCashRupees("");
    setSplitUpiRupees("");
    setSplitKhataRupees("");
  };

  // Fast Cash Quick-Denomination Suggestions (e.g. Exact, 50, 100, 200, 500)
  const cashDenominations = useMemo(() => {
    const totalRupees = Math.ceil(Number(payableTotalPaisa) / 100);
    if (totalRupees <= 0) return [10, 20, 50, 100, 500];
    const set = new Set<number>();
    set.add(totalRupees);
    [10, 20, 50, 100, 200, 500].forEach((d) => {
      if (d >= totalRupees) set.add(d);
    });
    const next50 = Math.ceil(totalRupees / 50) * 50;
    const next100 = Math.ceil(totalRupees / 100) * 100;
    const next500 = Math.ceil(totalRupees / 500) * 500;
    if (next50 > totalRupees) set.add(next50);
    if (next100 > totalRupees) set.add(next100);
    if (next500 > totalRupees) set.add(next500);
    return Array.from(set).sort((a, b) => a - b).slice(0, 5);
  }, [payableTotalPaisa]);

  // Customer Auto-Search & Existing Khata Due Detector
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const matchedCustomers = useMemo(() => {
    if (!customerName.trim() || customerName.trim() === "Walk-in Customer") return [];
    const query = customerName.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query)
    );
  }, [customers, customerName]);

  const selectedCustomerRecord = useMemo(() => {
    return customers.find(
      (c) =>
        (customerPhone && c.phone === customerPhone) ||
        (customerName && c.name.toLowerCase() === customerName.toLowerCase())
    );
  }, [customers, customerName, customerPhone]);

  // Quick Cyber Cafe Starter Presets (1-Click Catalog Launcher when 0 items)
  const COMMON_CYBER_SERVICES: Omit<CatalogItem, "id">[] = [
    { name: "B&W Xerox (Single)", category: "Xerox & Print", kind: "SERVICE", pricePaisa: 200n, costPricePaisa: 50n, currentStock: 999, minStockAlert: 10, icon: "📄" },
    { name: "B&W Xerox (B2B Double)", category: "Xerox & Print", kind: "SERVICE", pricePaisa: 300n, costPricePaisa: 80n, currentStock: 999, minStockAlert: 10, icon: "📑" },
    { name: "Color Print (A4)", category: "Xerox & Print", kind: "SERVICE", pricePaisa: 1000n, costPricePaisa: 300n, currentStock: 999, minStockAlert: 10, icon: "🎨" },
    { name: "Passport Photos (8x)", category: "Photos & Docs", kind: "SERVICE", pricePaisa: 4000n, costPricePaisa: 1000n, currentStock: 999, minStockAlert: 10, icon: "📸" },
    { name: "PVC Aadhaar / Smart Card", category: "Photos & Docs", kind: "SERVICE", pricePaisa: 5000n, costPricePaisa: 1500n, currentStock: 999, minStockAlert: 10, icon: "🪪" },
    { name: "Govt Job Application Form", category: "Online Forms", kind: "SERVICE", pricePaisa: 10000n, costPricePaisa: 0n, currentStock: 999, minStockAlert: 10, icon: "💻" },
    { name: "Lamination (A4 Pouch)", category: "Lamination & Binding", kind: "SERVICE", pricePaisa: 2000n, costPricePaisa: 500n, currentStock: 999, minStockAlert: 10, icon: "🛡️" },
    { name: "PAN Card Application", category: "Online Forms", kind: "SERVICE", pricePaisa: 15000n, costPricePaisa: 10700n, currentStock: 999, minStockAlert: 10, icon: "📝" },
  ];

  const handleAddPresetItem = (preset: Omit<CatalogItem, "id">) => {
    const newItem: CatalogItem = {
      ...preset,
      id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    onAddCatalogItem(newItem);
    syncCatalogItemToCloud(newItem);
  };

  const handleAddAllPresets = () => {
    COMMON_CYBER_SERVICES.forEach((preset, idx) => {
      const newItem: CatalogItem = {
        ...preset,
        id: `cat-${Date.now()}-${idx}`,
      };
      onAddCatalogItem(newItem);
      syncCatalogItemToCloud(newItem);
    });
  };

  // Popular Presets not yet in catalog (for Quick-Add bar)
  const remainingPresets = useMemo(() => {
    const existingNames = new Set(catalogItems.map((c) => c.name.toLowerCase()));
    return COMMON_CYBER_SERVICES.filter((preset) => !existingNames.has(preset.name.toLowerCase()));
  }, [catalogItems]);

  // Handle Quick Custom Line Item
  const handleAddQuickCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(quickChargePrice);
    if (isNaN(priceNum) || priceNum <= 0) return;
    const qty = Math.max(1, parseInt(quickChargeQty, 10) || 1);
    const pricePaisa = BigInt(Math.round(priceNum * 100));

    const customItem: CartItem = {
      id: `custom-${Date.now()}`,
      catalogId: `custom-cat-${Date.now()}`,
      name: quickChargeName.trim() || "Custom Service",
      quantity: qty,
      unitPricePaisa: pricePaisa,
      costPricePaisa: 0n,
      totalPaisa: BigInt(qty) * pricePaisa,
      kind: "SERVICE",
    };

    setCart((prev) => [...prev, customItem]);
    setIsQuickChargeModalOpen(false);
    setQuickChargePrice("");
    setQuickChargeQty("1");
    setQuickChargeName("Print / Xerox");
  };

  // Quick Discount Selector
  const applyQuickDiscount = (val: "none" | "5" | "10" | "20" | "5pct" | "10pct") => {
    if (val === "none") {
      setDiscountRupees("");
    } else if (val === "5pct") {
      const disc = (subtotalPaisa * 5n) / 100n;
      setDiscountRupees((Number(disc) / 100).toFixed(0));
    } else if (val === "10pct") {
      const disc = (subtotalPaisa * 10n) / 100n;
      setDiscountRupees((Number(disc) / 100).toFixed(0));
    } else {
      setDiscountRupees(val);
    }
  };

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
            barcode: item.barcode,
            hsnCode: item.hsnCode,
            gstRatePercent: item.gstRatePercent,
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
    setPaymentMethod("CASH");
    setSplitMode("CASH_UPI");
    setSplitCashRupees("");
    setSplitUpiRupees("");
    setSplitKhataRupees("");
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
        barcode: formBarcode.trim() || undefined,
        hsnCode: formHsn.trim() || undefined,
        gstRatePercent: formGstRate > 0 ? formGstRate : undefined,
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
        barcode: formBarcode.trim() || undefined,
        hsnCode: formHsn.trim() || undefined,
        gstRatePercent: formGstRate > 0 ? formGstRate : undefined,
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

    let finalCustomerName = customerName.trim() || "Walk-in Customer";

    if (paymentMethod === "CASH") {
      cashDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "CASH", amountPaisa: payableTotalPaisa, accountId: cashAcc.id });
    } else if (paymentMethod === "UPI") {
      qrDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "UPI", amountPaisa: payableTotalPaisa, accountId: qrAcc.id });
    } else if (paymentMethod === "KHATA") {
      if (finalCustomerName === "Walk-in Customer" || finalCustomerName === "") {
        const entered = prompt(
          `Khata (Udhaar) sale is ${formatPaisa(payableTotalPaisa)}.\nPlease enter Customer Name for Khata ledger:`
        );
        if (!entered || !entered.trim()) {
          alert("Customer Name is required when recording Khata (Udhaar) sales.");
          return;
        }
        finalCustomerName = entered.trim();
        setCustomerName(finalCustomerName);
      }
      khataDeltaPaisa = payableTotalPaisa;
      allocations.push({ method: "KHATA", amountPaisa: payableTotalPaisa });
    } else if (paymentMethod === "SPLIT") {
      if (splitRemainingPaisa !== 0n) {
        alert(
          `Split allocations do not match total bill!\nBill Total: ${formatPaisa(payableTotalPaisa)}\nAllocated: ${formatPaisa(totalSplitAllocatedPaisa)}\nDifference: ${formatPaisa(splitRemainingPaisa)}`
        );
        return;
      }

      cashDeltaPaisa = splitCashPaisa;
      qrDeltaPaisa = splitUpiPaisa;
      khataDeltaPaisa = splitKhataPaisa;

      if (khataDeltaPaisa > 0n && (finalCustomerName === "Walk-in Customer" || finalCustomerName === "")) {
        const entered = prompt(
          `Khata (Udhaar) portion is ${formatPaisa(khataDeltaPaisa)}.\nPlease enter Customer Name for Khata ledger:`
        );
        if (!entered || !entered.trim()) {
          alert("Customer Name is required when allocating to Khata udhaar.");
          return;
        }
        finalCustomerName = entered.trim();
        setCustomerName(finalCustomerName);
      }

      if (cashDeltaPaisa > 0n) {
        allocations.push({ method: "CASH", amountPaisa: cashDeltaPaisa, accountId: cashAcc.id });
      }
      if (qrDeltaPaisa > 0n) {
        allocations.push({ method: "UPI", amountPaisa: qrDeltaPaisa, accountId: qrAcc.id });
      }
      if (khataDeltaPaisa > 0n) {
        allocations.push({ method: "KHATA", amountPaisa: khataDeltaPaisa });
      }
    }

    // Calculate GST tax splits
    let totalTaxablePaisa = 0n;
    let totalCgstPaisa = 0n;
    let totalSgstPaisa = 0n;

    const mappedItems: InvoiceItem[] = cart.map((c) => {
      const gstRate = c.gstRatePercent || 0;
      let taxablePaisa = c.totalPaisa;
      let cgst = 0n;
      let sgst = 0n;

      if (gstRate > 0) {
        // Price is inclusive of GST: Taxable = (Total * 100) / (100 + Rate)
        taxablePaisa = (c.totalPaisa * 100n) / BigInt(100 + gstRate);
        const totalTax = c.totalPaisa - taxablePaisa;
        cgst = totalTax / 2n;
        sgst = totalTax - cgst; // Prevent 1 paisa rounding loss
      }

      totalTaxablePaisa += taxablePaisa;
      totalCgstPaisa += cgst;
      totalSgstPaisa += sgst;

      return {
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        unitPricePaisa: c.unitPricePaisa,
        totalPaisa: c.totalPaisa,
        kind: c.kind,
        barcode: c.barcode,
        hsnCode: c.hsnCode,
        gstRatePercent: c.gstRatePercent,
        taxableAmountPaisa: taxablePaisa,
        cgstPaisa: cgst,
        sgstPaisa: sgst,
      };
    });

    const totalTaxPaisa = totalCgstPaisa + totalSgstPaisa;

    const newInvoice: InvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNum,
      date: todayDate,
      time: timeStr,
      customerName: finalCustomerName,
      customerPhone: customerPhone.trim() || undefined,
      items: mappedItems,
      subtotalPaisa,
      discountPaisa,
      totalTaxablePaisa: totalTaxPaisa > 0n ? totalTaxablePaisa : undefined,
      totalCgstPaisa: totalCgstPaisa > 0n ? totalCgstPaisa : undefined,
      totalSgstPaisa: totalSgstPaisa > 0n ? totalSgstPaisa : undefined,
      totalTaxPaisa: totalTaxPaisa > 0n ? totalTaxPaisa : undefined,
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

  // Keyboard Shortcut: F12 to complete sale immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0 && (paymentMethod !== "SPLIT" || splitRemainingPaisa === 0n)) {
          handleCompleteSale();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, paymentMethod, splitRemainingPaisa, customerName, customerPhone, payableTotalPaisa]);

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

    if (inv.totalTaxPaisa && inv.totalTaxPaisa > 0n) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      if (inv.totalTaxablePaisa) {
        doc.text("Taxable Value:", 6, y);
        doc.text(formatPaisa(inv.totalTaxablePaisa), 74, y, { align: "right" });
        y += 3.5;
      }
      if (inv.totalCgstPaisa) {
        doc.text("CGST:", 6, y);
        doc.text(formatPaisa(inv.totalCgstPaisa), 74, y, { align: "right" });
        y += 3.5;
      }
      if (inv.totalSgstPaisa) {
        doc.text("SGST:", 6, y);
        doc.text(formatPaisa(inv.totalSgstPaisa), 74, y, { align: "right" });
        y += 3.5;
      }
      doc.setFont("helvetica", "bold");
    }

    doc.setFontSize(9);
    doc.text("TOTAL PAID:", 6, y);
    doc.text(formatPaisa(inv.totalPaisa), 74, y, { align: "right" });
    y += 5;

    if (inv.paymentMethod === "SPLIT" && inv.allocations && inv.allocations.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("Tender Mode: SPLIT BREAKDOWN", 6, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      inv.allocations.forEach((alloc) => {
        const label =
          alloc.method === "CASH"
            ? "Cash Paid"
            : alloc.method === "UPI"
            ? "UPI QR Paid"
            : "Khata (Udhaar Due)";
        doc.text(`  • ${label}:`, 6, y);
        doc.text(formatPaisa(alloc.amountPaisa), 74, y, { align: "right" });
        y += 4;
      });
      y += 2;
    } else {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Tender Mode: ${inv.paymentMethod}`, 6, y);
      y += 6;
    }

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
          <div class="center">Phone: +91 98765 43210 • GSTIN: 19AAAAA0000A1Z5</div>
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
                  <td>${i.name}${i.hsnCode ? ` <span style="font-size:9px;color:#555;">[HSN:${i.hsnCode}]</span>` : ""}</td>
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
            ${
              inv.totalTaxPaisa && inv.totalTaxPaisa > 0n
                ? `
                  ${inv.totalTaxablePaisa ? `<tr><td>Taxable Value</td><td class="right">${formatPaisa(inv.totalTaxablePaisa)}</td></tr>` : ""}
                  ${inv.totalCgstPaisa ? `<tr><td>CGST</td><td class="right">${formatPaisa(inv.totalCgstPaisa)}</td></tr>` : ""}
                  ${inv.totalSgstPaisa ? `<tr><td>SGST</td><td class="right">${formatPaisa(inv.totalSgstPaisa)}</td></tr>` : ""}
                `
                : ""
            }
            <tr class="bold" style="font-size: 13px;">
              <td>TOTAL PAID</td>
              <td class="right">${formatPaisa(inv.totalPaisa)}</td>
            </tr>
          </table>
          <div style="margin-top: 4px;">Paid via: <span class="bold">${inv.paymentMethod}</span></div>
          ${
            inv.paymentMethod === "SPLIT" && inv.allocations && inv.allocations.length > 0
              ? `<table>${inv.allocations
                  .map(
                    (a) => `<tr>
                      <td>• ${a.method === "CASH" ? "Cash Paid" : a.method === "UPI" ? "UPI QR Paid" : "Khata (Udhaar Due)"}</td>
                      <td class="right bold">${formatPaisa(a.amountPaisa)}</td>
                    </tr>`
                  )
                  .join("")}</table>`
              : ""
          }
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
    let paymentText = `*Payment:* Paid via ${inv.paymentMethod} ✅`;
    if (inv.paymentMethod === "SPLIT" && inv.allocations && inv.allocations.length > 0) {
      const breakdown = inv.allocations
        .map(
          (a) =>
            `  • ${a.method === "CASH" ? "Cash Paid" : a.method === "UPI" ? "UPI QR Paid" : "Khata Udhaar Due"}: ${formatPaisa(a.amountPaisa)}`
        )
        .join("\n");
      paymentText = `*Payment:* Split Tender Breakdown:\n${breakdown}`;
    }

    const msg = `🧾 *SARKAR COMMUNICATION RECEIPT*\n` +
      `--------------------------------\n` +
      `*Invoice:* ${inv.invoiceNumber}\n` +
      `*Date:* ${inv.date} ${inv.time}\n` +
      `*Customer:* ${inv.customerName}\n\n` +
      `*Items:*\n${itemsList}\n` +
      `--------------------------------\n` +
      `*Grand Total:* ${formatPaisa(inv.totalPaisa)}\n` +
      `${paymentText}\n\n` +
      `Thank you for visiting Sarkar Communication! 🙏`;

    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Category Multi-Colour Themes (Avoids pure black, vibrant cards in light & dark mode)
  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case "Xerox & Print":
        return {
          pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
          topBorder: "border-t-4 border-t-emerald-500",
          border: "border-emerald-200/80 hover:border-emerald-400 dark:border-emerald-800/60 dark:hover:border-emerald-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
          color: "text-emerald-600 dark:text-emerald-400",
        };
      case "Photos & Docs":
        return {
          pill: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
          topBorder: "border-t-4 border-t-indigo-500",
          border: "border-indigo-200/80 hover:border-indigo-400 dark:border-indigo-800/60 dark:hover:border-indigo-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
          color: "text-indigo-600 dark:text-indigo-400",
        };
      case "Online Forms":
        return {
          pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
          topBorder: "border-t-4 border-t-violet-500",
          border: "border-violet-200/80 hover:border-violet-400 dark:border-violet-800/60 dark:hover:border-violet-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
          color: "text-violet-600 dark:text-violet-400",
        };
      case "Lamination & Binding":
        return {
          pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
          topBorder: "border-t-4 border-t-amber-500",
          border: "border-amber-200/80 hover:border-amber-400 dark:border-amber-800/60 dark:hover:border-amber-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
          color: "text-amber-600 dark:text-amber-400",
        };
      case "Consumables Goods":
        return {
          pill: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
          topBorder: "border-t-4 border-t-rose-500",
          border: "border-rose-200/80 hover:border-rose-400 dark:border-rose-800/60 dark:hover:border-rose-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
          color: "text-rose-600 dark:text-rose-400",
        };
      default:
        return {
          pill: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
          topBorder: "border-t-4 border-t-teal-500",
          border: "border-teal-200/80 hover:border-teal-400 dark:border-teal-800/60 dark:hover:border-teal-500",
          bg: "bg-white dark:bg-slate-800",
          accentBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
          color: "text-teal-600 dark:text-teal-400",
        };
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden space-y-3">
      {/* 1. EXECUTIVE POS COMMAND DECK (shrink-0) */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-white/95 dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 px-4 py-2 rounded-2xl shadow-xs transition-colors">
        {/* Left: Counter 01 Live Beacon */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="leading-tight">
              <h1 className="text-xs font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <span>Express Counter 01</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Ready
                </span>
              </h1>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                Sarkar Communication • Digital Seva & CSP
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Revenue Ticker + Clock */}
        <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-750 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-slate-400 font-medium">Today's Sales:</span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {formatPaisa(todaySalesPaisa)}
            </span>
            <span className="text-[10px] text-slate-400">({todayInvoicesCount} bills)</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Custom Charge Button */}
          <button
            type="button"
            onClick={() => setIsQuickChargeModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Charge custom amount on the fly without saving to catalog"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">+ Custom Charge</span>
            <span className="sm:hidden">+ Custom</span>
          </button>

          {/* Held Orders Button */}
          {heldOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHeldOrdersModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer animate-pulse"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Held ({heldOrders.length})</span>
            </button>
          )}

          {/* Sales History Register Button */}
          <button
            type="button"
            onClick={() => setIsSalesHistoryOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="View today's sales, reprint slips, or void transactions"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Bills ({invoices.length})</span>
            <span className="sm:hidden">Bills</span>
          </button>

          {/* Manage Catalog Button */}
          <button
            type="button"
            onClick={() => setIsCatalogManagerOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Catalog</span>
          </button>

          {/* Add Service Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1 shadow-sm shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Service</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN FULL-VIEWPORT 2-COLUMN HARDWARE POS REGISTER */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3.5 items-stretch">
        {/* ================================================================= */}
        {/* LEFT COLUMN: CATALOG HUB (7 Cols)                                 */}
        {/* ================================================================= */}
        <div className="col-span-12 lg:col-span-7 flex flex-col min-h-0 h-full bg-slate-50/60 dark:bg-slate-850/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 p-3 overflow-hidden">
          {/* Top Controls: Search, View Switch, Category Tabs (shrink-0) */}
          <div className="shrink-0 space-y-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      const trimmed = searchQuery.trim().toLowerCase();
                      const exact = catalogItems.find(
                        (i) =>
                          (i.barcode && i.barcode.toLowerCase() === trimmed) ||
                          i.name.toLowerCase() === trimmed
                      );
                      if (exact) {
                        e.preventDefault();
                        addToCart(exact, 1);
                        setSearchQuery("");
                      }
                    }
                  }}
                  placeholder="Search item, scan barcode (press Enter to add)..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Grid / List Switch */}
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

            {/* Category Filter Pills with Live Item Counts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const count = cat === "All" ? catalogItems.length : catalogItems.filter((i) => i.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                      selectedCategory === cat
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-600"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[9px] px-1 rounded-full ${
                      selectedCategory === cat ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Catalog Body (flex-1 min-h-0 overflow-y-auto pr-1 space-y-3) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {catalogItems.length === 0 ? (
              /* Clean 0-Items State: 100% Zero Preloaded Data with Clear + Add Option + 1-Click Starters */
              <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-6 rounded-2xl space-y-5 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-xs">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Fresh Catalog Ready (0 Items)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                    Your catalog starts 100% clean without demo data. Add your custom services or tap standard presets below to start in 1 click.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Custom Service</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAllPresets}
                    className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>⚡ Add All 8 Standard Services (1-Click)</span>
                  </button>
                </div>

                {/* 1-Click Preset Cards */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2 text-left">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>⚡</span> 1-Click Popular Presets (Tap to Add):
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_CYBER_SERVICES.map((srv, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddPresetItem(srv)}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/80 dark:bg-slate-750/70 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition flex flex-col justify-between gap-1.5 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg p-1 rounded-lg bg-white dark:bg-slate-700 shadow-2xs group-hover:scale-105 transition-transform">
                            {srv.icon}
                          </span>
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            +{formatPaisa(srv.pricePaisa)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {srv.name}
                          </p>
                          <span className="text-[9px] text-slate-400 block truncate">
                            {srv.category}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl text-center text-xs text-slate-400">
                No services match "{searchQuery}" in "{selectedCategory}".
              </div>
            ) : viewMode === "grid" ? (
              /* GRID VIEW: High-Impact Hardware POS Touch Tiles */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* TILE 1: Quick Custom Charge Tile (Permanent Fast Utility) */}
                <div
                  onClick={() => setIsQuickChargeModalOpen(true)}
                  className="p-3.5 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700/80 bg-gradient-to-br from-indigo-50/70 via-purple-50/30 to-white dark:from-indigo-950/30 dark:via-slate-800 dark:to-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group min-h-[115px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-indigo-500 text-white shadow-sm group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                          + Quick Custom Charge
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                          Ad-hoc print, scan, form
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      ⚡ Instant
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    <span>Charge custom amount on the fly</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* USER CATALOG TILES */}
                {filteredItems.map((item) => {
                  const inCart = cart.find((c) => c.catalogId === item.id);
                  const theme = getCategoryTheme(item.category);
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item, 1)}
                      className={`p-3 rounded-2xl border-2 transition-all flex flex-col justify-between relative group cursor-pointer select-none ${theme.topBorder} ${
                        inCart
                          ? "bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-800 border-emerald-400 dark:border-emerald-500 shadow-md scale-[1.01]"
                          : `${theme.bg} ${theme.border} shadow-2xs hover:shadow-sm hover:scale-[1.01]`
                      }`}
                    >
                      {/* Top Action Icons: Edit (✏️) and Delete (🗑️) */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(item);
                          }}
                          title="Edit this service"
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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

                      {/* Main Tile Details */}
                      <div>
                        <div className="flex items-start justify-between gap-2 pr-12">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`text-xl p-2 rounded-xl ${theme.accentBg} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
                              {item.icon}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {item.name}
                              </h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border ${theme.pill} inline-block mt-0.5`}>
                                {item.category}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                              {formatPaisa(item.pricePaisa)}
                            </span>
                            {inCart && (
                              <span className="inline-block text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded-md mt-0.5 shadow-2xs animate-pulse">
                                🛒 {inCart.quantity} in cart
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Multiplier Stepper Row */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                          Tap to Add:
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 5, 25, 50, 100].map((mult) => (
                            <button
                              key={mult}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(item, mult);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 dark:hover:bg-emerald-600 text-[10px] font-black font-mono text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95"
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
              /* VIEW B: LIST VIEW */
              <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredItems.map((item) => {
                  const inCart = cart.find((c) => c.catalogId === item.id);
                  const theme = getCategoryTheme(item.category);
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item, 1)}
                      className={`p-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-750/50 transition cursor-pointer ${
                        inCart ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-base p-1 rounded-lg ${theme.accentBg} shrink-0`}>
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {item.name}
                            </p>
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-md border ${theme.pill}`}>
                              {item.category}
                            </span>
                          </div>
                          <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatPaisa(item.pricePaisa)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {[1, 5, 25, 50].map((mult) => (
                          <button
                            key={mult}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(item, mult);
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-slate-700 dark:hover:bg-emerald-600 text-[10px] font-black font-mono text-slate-700 dark:text-slate-200 transition cursor-pointer"
                          >
                            +{mult}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 dark:border-slate-700 pl-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(item);
                          }}
                          title="Edit service"
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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

            {/* 1-Click Popular Cyber Cafe Shortcuts Bar (when catalog has < 8 items) */}
            {catalogItems.length > 0 && catalogItems.length < 8 && remainingPresets.length > 0 && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>⚡</span> Quick-Add Popular Services to Your Shop:
                  </span>
                  <span className="text-[9px] text-slate-400">1-Tap to add to shop</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {remainingPresets.slice(0, 4).map((srv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddPresetItem(srv)}
                      className="p-2 rounded-xl bg-white hover:bg-emerald-50 dark:bg-slate-750 dark:hover:bg-emerald-950/30 border border-slate-200 hover:border-emerald-400 dark:border-slate-700 dark:hover:border-emerald-600 text-left transition flex items-center justify-between gap-2 group cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base p-1 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:scale-110 transition-transform">
                          {srv.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            {srv.name}
                          </p>
                          <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            +{formatPaisa(srv.pricePaisa)}
                          </span>
                        </div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: ACTIVE SALE REGISTER & CHECKOUT (5 Cols)            */}
        {/* ================================================================= */}
        <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-3.5 shadow-sm overflow-hidden">
          {/* Register Top Bar (shrink-0) */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Active Sale Register
              </h3>
              {cart.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {cart.reduce((sum, ci) => sum + ci.quantity, 0)} items
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleHoldOrder}
                  title="Suspend & hold this order to serve next customer"
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <PauseCircle className="w-3 h-3 text-amber-500" />
                  <span>Hold</span>
                </button>
              )}

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          {/* Compact Customer Pill Ribbon (Takes only 34px! shrink-0 my-2) */}
          <div className="shrink-0 my-2 relative bg-slate-50 dark:bg-slate-750/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
            <div className="relative flex-1 min-w-0 flex items-center gap-1.5 pl-1">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={customerName}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setIsCustomerDropdownOpen(true);
                }}
                placeholder="Walk-in Customer"
                className="bg-transparent border-0 p-0 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden w-full truncate"
              />

              {/* Auto-suggest dropdown */}
              {isCustomerDropdownOpen && matchedCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 animate-in fade-in-50 duration-100">
                  {matchedCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(c.name);
                        if (c.phone) setCustomerPhone(c.phone);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="w-full p-2 text-left hover:bg-emerald-50/80 dark:hover:bg-slate-700 flex items-center justify-between text-xs transition cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{c.phone || "No phone"}</p>
                      </div>
                      {c.currentDuePaisa > 0n && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                          Due: {formatPaisa(c.currentDuePaisa)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 shrink-0" />

            <div className="flex items-center gap-1 w-32 shrink-0 pr-1">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">📱</span>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="WhatsApp Phone"
                className="bg-transparent border-0 p-0 text-xs font-mono font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden w-full"
              />
            </div>

            {customerName !== "Walk-in Customer" && (
              <button
                type="button"
                onClick={() => {
                  setCustomerName("Walk-in Customer");
                  setCustomerPhone("");
                }}
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Reset to Walk-in"
              >
                ✕
              </button>
            )}
          </div>

          {/* Existing Khata Due Debt Alert for this Customer */}
          {selectedCustomerRecord && selectedCustomerRecord.currentDuePaisa > 0n && (
            <div className="shrink-0 mb-2 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-[10px] font-bold text-rose-800 dark:text-rose-300">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Existing Khata Due:
              </span>
              <span className="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
                {formatPaisa(selectedCustomerRecord.currentDuePaisa)}
              </span>
            </div>
          )}

          {/* Scrollable Cart Items List (flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    Register Standby • Cart Empty
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                    Tap any service on the left or click "+ Quick Custom Charge" to add items to bill.
                  </p>
                </div>
              </div>
            ) : (
              cart.map((ci) => (
                <div
                  key={ci.catalogId}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {ci.name}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatPaisa(ci.unitPricePaisa)} each
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stepper */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-2xs">
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
                        className="w-9 text-center font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-hidden"
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
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout & Tender Dock (shrink-0 pt-2 border-t border-slate-200/80 dark:border-slate-700 space-y-2) */}
          <div className="shrink-0 pt-2 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
            {cart.length === 0 ? (
              /* Clean Standby State */
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
                  <span>Payable Total:</span>
                  <span className="font-mono font-bold text-slate-400">₹0.00</span>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 font-bold text-xs cursor-not-allowed border border-slate-200/60 dark:border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                  <span>Select Items to Tender Sale</span>
                </button>
              </div>
            ) : (
              /* ACTIVE CHECKOUT & TENDER DOCK (ZERO INNER SCROLLBAR!) */
              <div className="space-y-2">
                {/* 1. Subtotal, Fast Discounts & Net Payable Banner */}
                <div className="bg-slate-50 dark:bg-slate-750/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Subtotal: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatPaisa(subtotalPaisa)}</strong>
                    </span>

                    {/* Quick Discount Selector */}
                    <div className="flex items-center gap-1">
                      {[
                        { label: "None", val: "none" as const },
                        { label: "-₹5", val: "5" as const },
                        { label: "-₹10", val: "10" as const },
                        { label: "-5%", val: "5pct" as const },
                        { label: "-10%", val: "10pct" as const },
                      ].map((chip) => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => applyQuickDiscount(chip.val)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                            (chip.val === "none" && !discountRupees) || (discountRupees && discountRupees === chip.val)
                              ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                              : "bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Net Payable Display Banner */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Net Payable:
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {cart.reduce((sum, ci) => sum + ci.quantity, 0)} items
                      </span>
                    </div>
                    <span className="text-xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                      {formatPaisa(payableTotalPaisa)}
                    </span>
                  </div>
                </div>

                {/* 2. Tender Selection Pills (4 Buttons) */}
                <div className="grid grid-cols-4 gap-1">
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
                      className={`py-1.5 px-1 rounded-xl text-center flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                        paymentMethod === m.id
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold shadow-sm shadow-emerald-600/30 scale-[1.02]"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200/60 dark:border-slate-700"
                      }`}
                    >
                      {m.icon}
                      <span className="text-[10px] font-bold">{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* 3. Tender Input Fields (Compact, No Scrollbars!) */}
                {/* If CASH Tender */}
                {paymentMethod === "CASH" && (
                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/30 dark:from-emerald-950/40 dark:to-slate-800 border-2 border-emerald-300/80 dark:border-emerald-700/60 p-2.5 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-emerald-950 dark:text-emerald-200 font-bold">
                        <span>💵 Received (₹):</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          placeholder="e.g. 500"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          className="w-24 bg-white dark:bg-slate-700 border border-emerald-400 dark:border-emerald-600 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                      <span className="text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase">
                        Quick:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {cashDenominations.map((denom) => (
                          <button
                            key={denom}
                            type="button"
                            onClick={() => setCashTendered(denom.toString())}
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                              cashTendered === denom.toString()
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-600 hover:bg-emerald-100"
                            }`}
                          >
                            ₹{denom}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cashTenderedPaisa > 0n && (
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/90 dark:bg-slate-700/80 border border-emerald-200 dark:border-emerald-700 text-xs font-black">
                        <span className="text-emerald-900 dark:text-emerald-300 text-[11px]">
                          Change to Return:
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                          {formatPaisa(cashChangeToReturnPaisa)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* If UPI QR Tender */}
                {paymentMethod === "UPI" && (
                  <div className="bg-gradient-to-br from-purple-50/80 to-violet-50/30 dark:from-purple-950/40 dark:to-slate-800 border-2 border-purple-300/80 dark:border-purple-700/60 p-2.5 rounded-xl space-y-1.5 text-center">
                    <div className="flex items-center justify-between border-b border-purple-200/60 dark:border-purple-800/60 pb-1">
                      <span className="font-extrabold text-xs text-purple-950 dark:text-purple-200 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Scan UPI QR
                      </span>
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.2 rounded-full">
                        {formatPaisa(payableTotalPaisa)}
                      </span>
                    </div>

                    <div className="p-1.5 bg-white rounded-xl border border-purple-200 inline-block shadow-2xs mx-auto">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=95x95&margin=2&data=${encodeURIComponent(
                          `upi://pay?pa=sarkarcommunication@sbi&pn=Sarkar+Communication&am=${(Number(payableTotalPaisa) / 100).toFixed(2)}&cu=INR`
                        )}`}
                        alt="Scan UPI QR"
                        className="w-20 h-20 mx-auto rounded-lg"
                      />
                      <span className="text-[8px] font-mono text-slate-500 block mt-0.5">
                        sarkarcommunication@sbi
                      </span>
                    </div>

                    <p className="text-[9px] font-bold text-purple-900 dark:text-purple-200">
                      GPay • PhonePe • Paytm • BHIM
                    </p>
                  </div>
                )}

                {/* If pure KHATA Tender */}
                {paymentMethod === "KHATA" && (
                  <div className="bg-gradient-to-br from-rose-50/80 to-pink-50/30 dark:from-rose-950/40 dark:to-slate-800 border-2 border-rose-300/80 dark:border-rose-800/60 p-2.5 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-rose-900 dark:text-rose-300">
                      <span className="flex items-center gap-1.5 font-extrabold text-[11px]">
                        <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        Khata Udhaar:
                      </span>
                      <span className="font-mono text-xs font-black">{formatPaisa(payableTotalPaisa)}</span>
                    </div>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold truncate">
                      📌 Posting to Customer Ledger for{" "}
                      <strong className="underline">
                        {customerName.trim() && customerName.trim() !== "Walk-in Customer"
                          ? customerName
                          : "⚠️ Customer Name"}
                      </strong>
                    </p>
                  </div>
                )}

                {/* If SPLIT Tender */}
                {paymentMethod === "SPLIT" && (
                  <div className="bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-slate-50 dark:from-slate-800 dark:to-indigo-950/30 border-2 border-indigo-200/90 dark:border-indigo-800/70 p-2.5 rounded-xl space-y-1.5 text-xs">
                    {/* Split Mode Selector Tabs */}
                    <div className="grid grid-cols-4 gap-1 p-0.5 bg-white dark:bg-slate-700/80 rounded-lg border border-indigo-100 dark:border-slate-600">
                      {[
                        { id: "CASH_UPI" as const, label: "💵+📱 Cash&UPI" },
                        { id: "CASH_KHATA" as const, label: "💵+👥 Cash&Khata" },
                        { id: "UPI_KHATA" as const, label: "📱+👥 UPI&Khata" },
                        { id: "3WAY" as const, label: "✨ All 3" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectSplitMode(m.id)}
                          className={`py-0.5 px-0.5 rounded text-[9px] font-bold transition text-center cursor-pointer ${
                            splitMode === m.id
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Compact Inputs */}
                    <div className="space-y-1">
                      {(splitMode === "CASH_UPI" || splitMode === "CASH_KHATA" || splitMode === "3WAY") && (
                        <div className="flex items-center justify-between gap-1 p-1 rounded-lg bg-white/80 dark:bg-slate-700/60 border border-emerald-200 dark:border-emerald-800/60">
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            💵 Cash:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const other = splitUpiPaisa + splitKhataPaisa;
                                const rem = payableTotalPaisa - other;
                                handleCashSplitChange(rem > 0n ? (Number(rem) / 100).toFixed(2).replace(/\.00$/, "") : "0");
                              }}
                              className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[9px] font-bold"
                            >
                              Fill
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0"
                              value={splitCashRupees}
                              onChange={(e) => handleCashSplitChange(e.target.value)}
                              className="w-20 bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {(splitMode === "CASH_UPI" || splitMode === "UPI_KHATA" || splitMode === "3WAY") && (
                        <div className="flex items-center justify-between gap-1 p-1 rounded-lg bg-white/80 dark:bg-slate-700/60 border border-purple-200 dark:border-purple-800/60">
                          <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300">
                            📱 UPI QR:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const other = splitCashPaisa + splitKhataPaisa;
                                const rem = payableTotalPaisa - other;
                                handleUpiSplitChange(rem > 0n ? (Number(rem) / 100).toFixed(2).replace(/\.00$/, "") : "0");
                              }}
                              className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-[9px] font-bold"
                            >
                              Fill
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0"
                              value={splitUpiRupees}
                              onChange={(e) => handleUpiSplitChange(e.target.value)}
                              className="w-20 bg-slate-50 dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {(splitMode === "CASH_KHATA" || splitMode === "UPI_KHATA" || splitMode === "3WAY") && (
                        <div className="flex items-center justify-between gap-1 p-1 rounded-lg bg-white/80 dark:bg-slate-700/60 border border-rose-200 dark:border-rose-800/60">
                          <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300">
                            👥 Khata:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const other = splitCashPaisa + splitUpiPaisa;
                                const rem = payableTotalPaisa - other;
                                setSplitKhataRupees(rem > 0n ? (Number(rem) / 100).toFixed(2).replace(/\.00$/, "") : "0");
                              }}
                              className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[9px] font-bold"
                            >
                              Fill
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0"
                              value={splitKhataRupees}
                              onChange={(e) => setSplitKhataRupees(e.target.value)}
                              className="w-20 bg-slate-50 dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status check */}
                    {payableTotalPaisa > 0n && splitRemainingPaisa === 0n && totalSplitAllocatedPaisa > 0n ? (
                      <div className="p-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-between">
                        <span>✓ Balanced ({formatPaisa(totalSplitAllocatedPaisa)})</span>
                        <span>Ready</span>
                      </div>
                    ) : splitRemainingPaisa > 0n ? (
                      <div className="p-1 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-between">
                        <span>Remaining: {formatPaisa(splitRemainingPaisa)}</span>
                      </div>
                    ) : splitRemainingPaisa < 0n ? (
                      <div className="p-1 rounded bg-rose-500/10 text-rose-800 dark:text-rose-300 text-[10px] font-bold flex items-center justify-between">
                        <span>Exceeds by: {formatPaisa(-splitRemainingPaisa)}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 4. Complete & Tender Primary Button */}
                <button
                  type="button"
                  disabled={cart.length === 0 || (paymentMethod === "SPLIT" && splitRemainingPaisa !== 0n)}
                  onClick={handleCompleteSale}
                  className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    cart.length === 0 || (paymentMethod === "SPLIT" && splitRemainingPaisa !== 0n)
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 hover:scale-[1.01] active:scale-[0.99]"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {paymentMethod === "SPLIT" && splitRemainingPaisa !== 0n
                      ? `Allocate Full Bill (${formatPaisa(splitRemainingPaisa)} remaining)`
                      : `Complete & Tender Sale (${formatPaisa(payableTotalPaisa)})`}
                  </span>
                  <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded font-mono">F12</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 MODAL: QUICK CUSTOM LINE ITEM */}
      {isQuickChargeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Quick Custom Charge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickChargeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuickCharge} className="space-y-3">
              {/* Presets Chips */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Popular Quick Presets
                </label>
                <div className="flex flex-wrap gap-1">
                  {[
                    "Print / Xerox",
                    "Online Form / Admit Card",
                    "Photo / Lamination",
                    "Scan & Email",
                    "PVC Smart Card",
                    "Internet Browsing",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuickChargeName(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        quickChargeName === preset
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Description / Service Name
                </label>
                <input
                  type="text"
                  required
                  value={quickChargeName}
                  onChange={(e) => setQuickChargeName(e.target.value)}
                  placeholder="e.g. Color Print 2 Pages"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Charge Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    autoFocus
                    placeholder="₹ 15"
                    value={quickChargePrice}
                    onChange={(e) => setQuickChargePrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quickChargeQty}
                    onChange={(e) => setQuickChargeQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickChargeModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  + Add to Active Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              {/* GST & Barcode Row */}
              <div className="grid grid-cols-3 gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-750 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    GST Rate
                  </label>
                  <select
                    value={formGstRate}
                    onChange={(e) => setFormGstRate(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Printing/Paper)</option>
                    <option value="12">12% (Services)</option>
                    <option value="18">18% (IT/Cyber/Hardware)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 998313"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Barcode / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="Scan / Type"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
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
      {/* 4.5 MODAL: SALES & INVOICES REGISTER                                  */}
      {/* ===================================================================== */}
      <SalesHistoryModal
        isOpen={isSalesHistoryOpen}
        onClose={() => setIsSalesHistoryOpen(false)}
        invoices={invoices}
        onVoidInvoice={onVoidInvoice}
        onRecordReturn={onRecordReturn}
        onPrintThermal={handleThermalPrint}
        onDownloadPdf={handleDownloadPdf}
        onWhatsApp={handleWhatsAppDispatch}
        formatPaisa={formatPaisa}
      />

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
                      <th className="p-3 text-center">GST % / HSN</th>
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
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                              {item.barcode && (
                                <span className="text-[9px] font-mono text-slate-400">Barcode: {item.barcode}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500">{item.category}</td>
                          <td className="p-3 text-center">
                            {item.gstRatePercent ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                {item.gstRatePercent}% {item.hsnCode ? `(${item.hsnCode})` : ""}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Exempt</span>
                            )}
                          </td>
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
              {completedInvoice.allocations && completedInvoice.allocations.length > 0 && completedInvoice.paymentMethod === "SPLIT" && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                  {completedInvoice.allocations.map((a, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        a.method === "CASH"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : a.method === "UPI"
                          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {a.method === "CASH" ? "💵 Cash" : a.method === "UPI" ? "📱 UPI QR" : "👥 Khata"}: {formatPaisa(a.amountPaisa)}
                    </span>
                  ))}
                </div>
              )}
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
