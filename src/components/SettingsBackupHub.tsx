import React, { useState } from "react";
import {
  ShopProfile,
  HardwareConfig,
  WhatsAppConfig,
  TreasuryAccount,
  Customer,
  CatalogItem,
  InvoiceRecord,
  DigitalTransaction,
  CashBookEntry,
  DEFAULT_SHOP_PROFILE,
  DEFAULT_HARDWARE_CONFIG,
  DEFAULT_WHATSAPP_CONFIG,
} from "../core/contracts";
import {
  Settings,
  Store,
  Printer,
  Database,
  Cloud,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldAlert,
  Server,
  Layers,
  Sparkles,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Send,
} from "lucide-react";

interface SettingsBackupHubProps {
  shopProfile: ShopProfile;
  hardwareConfig: HardwareConfig;
  onUpdateShopProfile: (profile: ShopProfile) => void;
  onUpdateHardwareConfig: (config: HardwareConfig) => void;
  accounts: TreasuryAccount[];
  customers: Customer[];
  catalogItems: CatalogItem[];
  invoices: InvoiceRecord[];
  digitalTransactions: DigitalTransaction[];
  cashBookEntries: CashBookEntry[];
  onRestoreAllData: (data: {
    accounts?: TreasuryAccount[];
    customers?: Customer[];
    catalogItems?: CatalogItem[];
    invoices?: InvoiceRecord[];
    digitalTransactions?: DigitalTransaction[];
    cashBookEntries?: CashBookEntry[];
    shopProfile?: ShopProfile;
    hardwareConfig?: HardwareConfig;
  }) => void;
  onResetFactoryData: () => void;
  showToast: (msg: string) => void;
}

export const SettingsBackupHub: React.FC<SettingsBackupHubProps> = ({
  shopProfile,
  hardwareConfig,
  onUpdateShopProfile,
  onUpdateHardwareConfig,
  accounts,
  customers,
  catalogItems,
  invoices,
  digitalTransactions,
  cashBookEntries,
  onRestoreAllData,
  onResetFactoryData,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<"profile" | "hardware" | "whatsapp" | "backup" | "cloud">("profile");

  // WhatsApp Config State
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>(() => {
    try {
      const saved = localStorage.getItem("dc_whatsapp_config");
      if (saved) return { ...DEFAULT_WHATSAPP_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      // fallback
    }
    return DEFAULT_WHATSAPP_CONFIG;
  });

  const [waPingStatus, setWaPingStatus] = useState<"IDLE" | "CHECKING" | "ONLINE" | "OFFLINE">("IDLE");
  const [waPingDetail, setWaPingDetail] = useState<string>("");

  const handleSaveWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("dc_whatsapp_config", JSON.stringify(waConfig));
      showToast("✓ WhatsApp Gateway settings saved!");
    } catch (e) {
      showToast("Error saving WhatsApp settings to local storage");
    }
  };

  const handleTestWhatsAppConnection = async (targetUrl?: string) => {
    const urlToCheck = (targetUrl || waConfig.gatewayUrl || "http://localhost:3001").replace(/\/+$/, "");
    setWaPingStatus("CHECKING");
    setWaPingDetail("Pinging health endpoint...");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${urlToCheck}/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setWaPingStatus("ONLINE");
        setWaPingDetail(`Online • Service: ${data.service || "WhatsApp Gateway"} • Mode: ${data.mode || "Connected"}`);
        showToast("✓ WhatsApp Gateway is LIVE & REACHABLE!");
      } else {
        setWaPingStatus("OFFLINE");
        setWaPingDetail(`Gateway returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      setWaPingStatus("OFFLINE");
      setWaPingDetail(
        err.name === "AbortError"
          ? "Connection timed out (Service may be asleep or unreachable)"
          : `Connection failed: ${err.message || "Failed to fetch"}`
      );
    }
  };

  // Profile Form State
  const [profileForm, setProfileForm] = useState<ShopProfile>(shopProfile);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateShopProfile(profileForm);
    showToast("✓ Shop Profile updated successfully!");
  };

  // Hardware Config Form State
  const [hwForm, setHwForm] = useState<HardwareConfig>(hardwareConfig);

  const handleSaveHardware = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateHardwareConfig(hwForm);
    showToast("✓ Hardware & Printer preferences saved!");
  };

  // 1-Click JSON Backup Export
  const handleExportBackup = () => {
    const backupPayload = {
      version: "1.0.0",
      system: "DigitalCafe ERP",
      timestamp: new Date().toISOString(),
      shopProfile,
      hardwareConfig,
      data: {
        accounts: accounts.map((a) => ({
          ...a,
          currentBalancePaisa: a.currentBalancePaisa.toString(),
        })),
        customers: customers.map((c) => ({
          ...c,
          currentDuePaisa: c.currentDuePaisa.toString(),
          creditLimitPaisa: c.creditLimitPaisa.toString(),
          advanceBalancePaisa: (c.advanceBalancePaisa || 0n).toString(),
          loyaltyPointsPaisa: (c.loyaltyPointsPaisa || 0n).toString(),
        })),
        catalogItems: catalogItems.map((i) => ({
          ...i,
          pricePaisa: i.pricePaisa.toString(),
          costPricePaisa: i.costPricePaisa.toString(),
        })),
        invoices: invoices.map((inv) => ({
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
          allocations: inv.allocations?.map((al) => ({
            ...al,
            amountPaisa: al.amountPaisa.toString(),
          })),
        })),
        digitalTransactions: digitalTransactions.map((dt) => ({
          ...dt,
          amountPaisa: dt.amountPaisa.toString(),
          customerFeePaisa: dt.customerFeePaisa.toString(),
          portalCommissionPaisa: dt.portalCommissionPaisa.toString(),
          portalSurchargePaisa: dt.portalSurchargePaisa.toString(),
          netProfitPaisa: dt.netProfitPaisa.toString(),
        })),
        cashBookEntries: cashBookEntries.map((cb) => ({
          ...cb,
          amountPaisa: cb.amountPaisa.toString(),
          runningBalancePaisa: cb.runningBalancePaisa.toString(),
        })),
      },
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `DigitalCafe_ERP_Backup_${dateStamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast("✓ Full Database Backup (.JSON) downloaded!");
  };

  // JSON Restore File Handler
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;

    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !parsed.data) {
          throw new Error("Invalid backup structure: Missing root 'data' object.");
        }

        const restoredData: any = {};

        // Parse Accounts
        if (Array.isArray(parsed.data.accounts)) {
          restoredData.accounts = parsed.data.accounts.map((a: any) => ({
            ...a,
            currentBalancePaisa: BigInt(a.currentBalancePaisa || 0),
          }));
        }

        // Parse Customers
        if (Array.isArray(parsed.data.customers)) {
          restoredData.customers = parsed.data.customers.map((c: any) => ({
            ...c,
            currentDuePaisa: BigInt(c.currentDuePaisa || 0),
            creditLimitPaisa: BigInt(c.creditLimitPaisa || 200000),
            advanceBalancePaisa: c.advanceBalancePaisa ? BigInt(c.advanceBalancePaisa) : 0n,
            loyaltyPointsPaisa: c.loyaltyPointsPaisa ? BigInt(c.loyaltyPointsPaisa) : 0n,
          }));
        }

        // Parse Catalog
        if (Array.isArray(parsed.data.catalogItems)) {
          restoredData.catalogItems = parsed.data.catalogItems.map((i: any) => ({
            ...i,
            pricePaisa: BigInt(i.pricePaisa || 0),
            costPricePaisa: BigInt(i.costPricePaisa || 0),
          }));
        }

        // Parse Invoices
        if (Array.isArray(parsed.data.invoices)) {
          restoredData.invoices = parsed.data.invoices.map((inv: any) => ({
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

        // Parse Digital Transactions
        if (Array.isArray(parsed.data.digitalTransactions)) {
          restoredData.digitalTransactions = parsed.data.digitalTransactions.map((dt: any) => ({
            ...dt,
            amountPaisa: BigInt(dt.amountPaisa || 0),
            customerFeePaisa: BigInt(dt.customerFeePaisa || 0),
            portalCommissionPaisa: BigInt(dt.portalCommissionPaisa || 0),
            portalSurchargePaisa: BigInt(dt.portalSurchargePaisa || 0),
            netProfitPaisa: BigInt(dt.netProfitPaisa || 0),
          }));
        }

        // Parse Cash Book
        if (Array.isArray(parsed.data.cashBookEntries)) {
          restoredData.cashBookEntries = parsed.data.cashBookEntries.map((cb: any) => ({
            ...cb,
            amountPaisa: BigInt(cb.amountPaisa || 0),
            runningBalancePaisa: BigInt(cb.runningBalancePaisa || 0),
          }));
        }

        if (parsed.shopProfile) restoredData.shopProfile = parsed.shopProfile;
        if (parsed.hardwareConfig) restoredData.hardwareConfig = parsed.hardwareConfig;

        onRestoreAllData(restoredData);
        showToast("✓ Database restored successfully from backup!");
      } catch (err: any) {
        console.error("Backup restoration failed:", err);
        setRestoreError(err.message || "Failed to parse backup file.");
      }
    };
  };

  // Factory Reset Confirmation State
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Settings & Hardware Hub
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              Module 6
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Shop branding profile, thermal ESC/POS configuration, JSON data backup & cloud synchronization.
          </p>
        </div>

        {/* QUICK STATS CHIPS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Records: <strong className="text-slate-900 dark:text-white">{invoices.length + digitalTransactions.length}</strong> txns
          </div>
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Quick Backup (.JSON)
          </button>
        </div>
      </div>

      {/* 2. SUB-NAV TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "profile"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Store className="w-3.5 h-3.5 text-emerald-500" />
          Shop Identity & Profile
        </button>

        <button
          type="button"
          onClick={() => setSubTab("hardware")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "hardware"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Printer className="w-3.5 h-3.5 text-sky-500" />
          Thermal Printer & Hardware
        </button>

        <button
          type="button"
          onClick={() => setSubTab("whatsapp")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "whatsapp"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
          WhatsApp Gateway
        </button>

        <button
          type="button"
          onClick={() => setSubTab("backup")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "backup"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Database className="w-3.5 h-3.5 text-amber-500" />
          Database Backup & Restore
        </button>

        <button
          type="button"
          onClick={() => setSubTab("cloud")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === "cloud"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Cloud className="w-3.5 h-3.5 text-purple-500" />
          Supabase Cloud Sync
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: SHOP IDENTITY & PROFILE                                       */}
      {/* ==================================================================== */}
      {subTab === "profile" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-3xl">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-500" />
              Shop Identity Details
            </h3>
            {/* LOGO UPLOAD & BRANDING SECTION */}
            <div className="p-4 bg-slate-50 dark:bg-slate-750 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {profileForm.logoBase64 ? (
                  <img
                    src={profileForm.logoBase64}
                    alt="Shop Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Store className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Shop Brand Logo (Invoices & Thermal Slips)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Upload a crisp PNG or JPEG logo (recommended square, under 500KB). It will appear on A4 Tax Invoices and thermal counter receipts.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <label className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold cursor-pointer transition">
                    <span>{profileForm.logoBase64 ? "Change Logo" : "Upload Logo"}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1024 * 1024) {
                            showToast("Logo file too large! Please choose an image under 1MB.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const b64 = event.target?.result as string;
                            if (b64) {
                              setProfileForm((prev) => ({ ...prev, logoBase64: b64 }));
                              showToast("✓ Logo loaded! Click 'Save Profile Changes' below.");
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {profileForm.logoBase64 && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm((prev) => ({ ...prev, logoBase64: undefined }));
                        showToast("Logo removed.");
                      }}
                      className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.shopName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, shopName: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Tagline / Business Nature
                </label>
                <input
                  type="text"
                  value={profileForm.tagline}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Owner / Operator Name
                </label>
                <input
                  type="text"
                  value={profileForm.ownerName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Contact Mobile / WhatsApp
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Shop Physical Address
                </label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 19AAAAA0000A1Z5"
                  value={profileForm.gstin}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Shop UPI ID (For Dynamic QR)
                </label>
                <input
                  type="text"
                  placeholder="e.g. yourname@okaxis"
                  value={profileForm.upiId}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, upiId: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Receipt Footer Thank-You Note
                </label>
                <input
                  type="text"
                  value={profileForm.printFooterNote}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, printFooterNote: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: THERMAL PRINTER & HARDWARE CONFIG                             */}
      {/* ==================================================================== */}
      {subTab === "hardware" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
          <form onSubmit={handleSaveHardware} className="space-y-5 max-w-2xl">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-500" />
              Thermal Receipt & ESC/POS Hardware
            </h3>

            {/* Paper Width Selector */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Receipt Paper Width
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHwForm((prev) => ({ ...prev, printerWidth: "80mm" }))}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                    hwForm.printerWidth === "80mm"
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 shadow-xs"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <span className="block font-black text-xs">80mm (3-Inch Counter)</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Standard high-speed desktop receipt printer (Epson, TVS, NGX, Posiflex).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHwForm((prev) => ({ ...prev, printerWidth: "58mm" }))}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                    hwForm.printerWidth === "58mm"
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 shadow-xs"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <span className="block font-black text-xs">58mm (2-Inch Mobile)</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Compact Bluetooth / USB pocket thermal printer.
                  </span>
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hwForm.autoPrintReceipts}
                  onChange={(e) => setHwForm((prev) => ({ ...prev, autoPrintReceipts: e.target.checked }))}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Auto-trigger Print Dialog immediately when sale is finalized
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hwForm.soundAlerts}
                  onChange={(e) => setHwForm((prev) => ({ ...prev, soundAlerts: e.target.checked }))}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Enable Sound Notifications on Cash Drawer balance changes & completed transactions
                </span>
              </label>
            </div>

            {/* Cash Drawer Pulse */}
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                ESC/POS Cash Drawer Kick Code
              </label>
              <input
                type="text"
                value={hwForm.drawerKickCode}
                onChange={(e) => setHwForm((prev) => ({ ...prev, drawerKickCode: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">Default: 27,112,0,25,250 (Standard RJ11 cash drawer pulse)</p>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Hardware Preferences
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: WHATSAPP GATEWAY CONFIGURATION                                */}
      {/* ==================================================================== */}
      {subTab === "whatsapp" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <MessageSquare className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  WhatsApp Messaging Gateway
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                    Baileys v6 & Cloud Engine
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure real-time slip delivery, automated transaction receipts, and customer notification endpoints.
                </p>
              </div>
            </div>

            {/* Quick Ping Status */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestWhatsAppConnection()}
                disabled={waPingStatus === "CHECKING"}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${waPingStatus === "CHECKING" ? "animate-spin text-emerald-600" : ""}`} />
                Test Connection
              </button>

              {waPingStatus === "ONLINE" && (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Gateway Online
                </span>
              )}
              {waPingStatus === "OFFLINE" && (
                <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-black flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Offline / Asleep
                </span>
              )}
            </div>
          </div>

          {/* Diagnostics banner if pinged */}
          {waPingDetail && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-3 ${
                waPingStatus === "ONLINE"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  : waPingStatus === "OFFLINE"
                  ? "bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-800 dark:text-rose-300"
                  : "bg-sky-50 dark:bg-sky-950/30 border border-sky-500/20 text-sky-800 dark:text-sky-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {waPingStatus === "ONLINE" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : waPingStatus === "OFFLINE" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
                )}
                <span>{waPingDetail}</span>
              </div>
              <a
                href={`${(waConfig.gatewayUrl || "http://localhost:3001").replace(/\/+$/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80 shrink-0"
              >
                Open Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <form onSubmit={handleSaveWhatsApp} className="space-y-6 max-w-3xl">
            {/* Gateway Presets */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Select WhatsApp Gateway Server
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Preset 1: Local Baileys Gateway */}
                <div
                  onClick={() => {
                    setWaConfig((prev) => ({ ...prev, gatewayUrl: "http://localhost:3001" }));
                    handleTestWhatsAppConnection("http://localhost:3001");
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer text-left space-y-1 ${
                    waConfig.gatewayUrl === "http://localhost:3001"
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-xs"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      💻 Local PC Gateway (Port 3001)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      High Speed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    http://localhost:3001
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Runs directly on counter machine. Instant zero-latency dispatch via Baileys Multi-Device.
                  </p>
                </div>

                {/* Preset 2: Render Cloud Service */}
                <div
                  onClick={() => {
                    setWaConfig((prev) => ({ ...prev, gatewayUrl: "https://sccomm-whatsapp-gateway.onrender.com" }));
                    handleTestWhatsAppConnection("https://sccomm-whatsapp-gateway.onrender.com");
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer text-left space-y-1 ${
                    waConfig.gatewayUrl === "https://sccomm-whatsapp-gateway.onrender.com"
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-xs"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      ☁️ Render Cloud Gateway (24/7)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      Cloud Always-On
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    https://sccomm-whatsapp-gateway.onrender.com
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Hosted 24/7 on Render cloud with 5-min wakeup ping. Works even when counter PC is off.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Gateway URL Endpoint
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={waConfig.gatewayUrl}
                  onChange={(e) => setWaConfig((prev) => ({ ...prev, gatewayUrl: e.target.value }))}
                  placeholder="e.g. http://localhost:3001 or https://sccomm-whatsapp-gateway.onrender.com"
                  className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleTestWhatsAppConnection()}
                  className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Ping
                </button>
              </div>
            </div>

            {/* Optional API Key & Country Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Default Country Code
                </label>
                <input
                  type="text"
                  value={waConfig.defaultCountryCode}
                  onChange={(e) => setWaConfig((prev) => ({ ...prev, defaultCountryCode: e.target.value }))}
                  placeholder="+91"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Owner Admin Mobile (Alerts)
                </label>
                <input
                  type="text"
                  value={waConfig.ownerMobile}
                  onChange={(e) => setWaConfig((prev) => ({ ...prev, ownerMobile: e.target.value }))}
                  placeholder="7003037208"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Gateway API Key (Optional)
                </label>
                <input
                  type="password"
                  value={waConfig.gatewayApiKey || ""}
                  onChange={(e) => setWaConfig((prev) => ({ ...prev, gatewayApiKey: e.target.value }))}
                  placeholder="Leave empty if none"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Auto Dispatch Triggers */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Automated Background WhatsApp Dispatch
              </span>

              <div className="space-y-2.5">
                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                  <input
                    type="checkbox"
                    checked={waConfig.autoSendInvoice}
                    onChange={(e) => setWaConfig((prev) => ({ ...prev, autoSendInvoice: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Auto-send POS Invoice on Sale Completion
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Dispatches itemized bill and payment confirmation whenever a customer phone number is captured.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                  <input
                    type="checkbox"
                    checked={waConfig.autoSendKhataReceipt}
                    onChange={(e) => setWaConfig((prev) => ({ ...prev, autoSendKhataReceipt: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Auto-send Khata Settlement Receipt & Remaining Balance
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Notifies customer immediately with credit voucher and updated ledger balance upon payment.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                  <input
                    type="checkbox"
                    checked={waConfig.autoSendCspSlip}
                    onChange={(e) => setWaConfig((prev) => ({ ...prev, autoSendCspSlip: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Auto-send Digital CSP / AEPS / DMT Cash Advice Slip
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Sends banking customer proof with RRN/UTR, cash disbursed, and fee breakdown.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                  <input
                    type="checkbox"
                    checked={waConfig.autoSendDayEndSummary}
                    onChange={(e) => setWaConfig((prev) => ({ ...prev, autoSendDayEndSummary: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Auto-send Day-End Cash & Revenue Summary to Owner
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Sends closing drawer count, day net profit, and total turnover to owner mobile upon day closure.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Custom WhatsApp Slip Footer Note */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                WhatsApp Slip Custom Footer Note
              </label>
              <input
                type="text"
                value={waConfig.customFooterNote || ""}
                onChange={(e) => setWaConfig((prev) => ({ ...prev, customFooterNote: e.target.value }))}
                placeholder="Thank you for visiting Sarkar Communication! 🙏"
                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
              <p className="text-[11px] text-slate-400">
                Configurations are stored safely in local browser storage and persist across counter sessions.
              </p>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save WhatsApp Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: DATABASE BACKUP & RESTORE                                     */}
      {/* ==================================================================== */}
      {subTab === "backup" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Download className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Export Full Shop Backup (.JSON)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Save all POS invoices, CSP banking history, customers, and cash book onto your local drive.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 font-medium">
                <div>• Invoices: <strong>{invoices.length}</strong> records</div>
                <div>• Digital Banking: <strong>{digitalTransactions.length}</strong> records</div>
                <div>• Customers & Khata: <strong>{customers.length}</strong> accounts</div>
                <div>• Cash Book Movements: <strong>{cashBookEntries.length}</strong> records</div>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download JSON Backup File
              </button>
            </div>

            {/* Import / Restore Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Upload className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Restore from JSON Backup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload an earlier `.json` backup file to recover your records.
                  </p>
                </div>
              </div>

              {restoreError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2">
                <Upload className="w-6 h-6 mx-auto text-slate-400" />
                <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 cursor-pointer hover:underline">
                  Select Backup .JSON File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400">Strict schema validation is performed before importing.</p>
              </div>
            </div>
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-6 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-sm font-black">Danger Zone: Reset Local Data</h4>
            </div>
            <p className="text-xs text-rose-600/90 dark:text-rose-300 leading-relaxed max-w-xl">
              Permanently clears all locally saved invoices, digital CSP transactions, and custom catalog items,
              returning the application to a pristine zero-balance state.
            </p>

            {!showConfirmReset ? (
              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Reset All Data to Fresh Start
              </button>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetFactoryData();
                    setShowConfirmReset(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer"
                >
                  Confirm: Wipe Everything Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: SUPABASE CLOUD SYNC STATUS                                    */}
      {/* ==================================================================== */}
      {subTab === "cloud" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <Cloud className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Supabase Real-Time Cloud Synchronization
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ensures all your counter transactions replicate instantly to PostgreSQL cloud storage.
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Local-First Offline Fallback Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Configured Supabase Endpoint</span>
              <p className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                https://qpveotirexgkfgkmlbjg.supabase.co
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Offline Cache Strategy</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                IndexedDB & LocalStorage (Zero network dependency for counter POS)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
