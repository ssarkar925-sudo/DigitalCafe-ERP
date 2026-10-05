import React, { useState, useMemo, useEffect } from "react";
import {
  TreasuryAccount,
  DigitalTransaction,
  FeeCollectionMode,
  Customer,
} from "../core/contracts";
import {
  createAepsJournal,
  createDmtJournal,
  createUpiCashoutJournal,
  JournalEntry,
} from "../core/ledger";
import { sendWhatsAppMessage } from "../core/whatsapp";
import { jsPDF } from "jspdf";
import {
  Landmark,
  Wallet,
  QrCode,
  ArrowRightLeft,
  Search,
  Printer,
  FileDown,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Sparkles,
  Clipboard,
  AlertCircle,
  Building,
  User,
  Phone,
  ShieldCheck,
  Zap,
  TrendingUp,
  Clock,
  Layers,
} from "lucide-react";

const COMMON_CSP_PORTALS = [
  { name: "CSC DigiPay", type: "WALLET" as const, code: "1021", desc: "CSC e-Gov AePS" },
  { name: "Spice Money", type: "WALLET" as const, code: "1022", desc: "Spicemoney AePS / DMT" },
  { name: "Fino Mitra", type: "WALLET" as const, code: "1023", desc: "Fino Payment Bank BC" },
  { name: "PayNearby", type: "WALLET" as const, code: "1024", desc: "PayNearby Retailer" },
  { name: "SBI Current A/C", type: "BANK" as const, code: "1031", desc: "SBI Commercial Banking" },
  { name: "Counter UPI QR", type: "UPI_HOLDING" as const, code: "1041", desc: "Merchant Soundbox QR" },
];

interface CspKioskProps {
  accounts: TreasuryAccount[];
  customers: Customer[];
  timeStr: string;
  onRecordDigitalTransaction: (params: {
    transaction: DigitalTransaction;
    journal: JournalEntry;
    cashDeltaPaisa: bigint;
    sourceDeltaPaisa: bigint;
    portalDeltaPaisa: bigint;
    qrDeltaPaisa?: bigint;
    khataDeltaPaisa?: bigint;
    customerPhone?: string;
    customerName?: string;
  }) => void;
  onVoidDigitalTransaction?: (txnId: string) => void;
  onAddAccount?: (account: TreasuryAccount) => void;
  onOpenAccountManager?: () => void;
  showToast?: (msg: string) => void;
}

export const CspKiosk: React.FC<CspKioskProps> = ({
  accounts,
  customers,
  timeStr,
  onRecordDigitalTransaction,
  onVoidDigitalTransaction,
  onAddAccount,
  onOpenAccountManager,
  showToast,
}) => {
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<"aeps" | "dmt" | "cashout" | "register">("aeps");

  // Local persistence for transactions
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(() => {
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
      const serializable = transactions.map((t) => ({
        ...t,
        amountPaisa: t.amountPaisa.toString(),
        customerFeePaisa: t.customerFeePaisa.toString(),
        portalCommissionPaisa: t.portalCommissionPaisa.toString(),
        portalSurchargePaisa: t.portalSurchargePaisa.toString(),
        netProfitPaisa: t.netProfitPaisa.toString(),
      }));
      localStorage.setItem("dc_csp_transactions", JSON.stringify(serializable));
    } catch (e) {}
  }, [transactions]);

  // Success dialog modal
  const [completedTxn, setCompletedTxn] = useState<DigitalTransaction | null>(null);

  // Currency Formatter
  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, "0");
    return `${isNeg ? "-" : ""}₹${rupees.toLocaleString("en-IN")}.${cents}`;
  };

  // Strictly isolate Treasury accounts - Shop Cash Drawer is NEVER a portal or bank account
  const cashAccount = accounts.find((a) => a.type === "CASH") || accounts[0];
  const portalAccounts = useMemo(() => {
    return accounts.filter((a) => (a.type === "WALLET" || a.type === "BANK") && a.id !== "acc-cash");
  }, [accounts]);
  const qrAccounts = useMemo(() => {
    return accounts.filter((a) => a.type === "UPI_HOLDING" && a.id !== "acc-cash");
  }, [accounts]);
  const incomeAccount = accounts.find((a) => a.type === "INCOME") || accounts[accounts.length - 1];

  // Quick 1-tap add preset portal
  const handleQuickAddPortal = (portalPreset: typeof COMMON_CSP_PORTALS[0]) => {
    if (onAddAccount) {
      const newAcc: TreasuryAccount = {
        id: `acc-${portalPreset.type.toLowerCase()}-${Date.now()}`,
        code: portalPreset.code,
        name: portalPreset.name,
        type: portalPreset.type,
        currentBalancePaisa: 0n,
        isActive: true,
        metadata: { source: portalPreset.desc },
      };
      onAddAccount(newAcc);
      if (portalPreset.type === "WALLET" || portalPreset.type === "BANK") {
        setAepsPortalId(newAcc.id);
        setDmtSourceId(newAcc.id);
      }
      if (portalPreset.type === "UPI_HOLDING" || portalPreset.type === "BANK") {
        setCashoutQrId(newAcc.id);
      }
    } else if (onOpenAccountManager) {
      onOpenAccountManager();
    }
  };

  // ============================================================================
  // TAB 1: AEPS AADHAAR ATM STATE
  // ============================================================================
  const [aepsCustomerName, setAepsCustomerName] = useState<string>("");
  const [aepsAmount, setAepsAmount] = useState<string>("3000");
  const [aepsAadhaar, setAepsAadhaar] = useState<string>("");
  const [aepsBank, setAepsBank] = useState<string>("State Bank of India");
  const [aepsMobile, setAepsMobile] = useState<string>("");
  const [aepsRrn, setAepsRrn] = useState<string>("");
  const [aepsPortalId, setAepsPortalId] = useState<string>(() => portalAccounts[0]?.id || "");
  const [aepsFeeMode, setAepsFeeMode] = useState<FeeCollectionMode>("CUT_FROM_CASH");
  const [aepsCustomFee, setAepsCustomFee] = useState<string>("0");
  const [aepsScanText, setAepsScanText] = useState<string>("");
  const [aepsScanNotice, setAepsScanNotice] = useState<string | null>(null);

  // Sync portal selections whenever accounts are created
  useEffect(() => {
    if (portalAccounts.length > 0) {
      if (!portalAccounts.some((a) => a.id === aepsPortalId)) {
        setAepsPortalId(portalAccounts[0].id);
      }
    }
  }, [portalAccounts, aepsPortalId]);

  // Default AEPS Commission calculation table (standard Indian BC slabs)
  // Manual override for portal commission (empty string = use standard slab)
  const [aepsCommissionOverride, setAepsCommissionOverride] = useState<string>("");

  const aepsSlabCommissionPaisa = useMemo(() => {
    const amt = parseFloat(aepsAmount) || 0;
    if (amt <= 0) return 0n;
    if (amt < 500) return 50n;        // ₹0.50
    if (amt < 1000) return 100n;      // ₹1.00
    if (amt < 1500) return 250n;      // ₹2.50
    if (amt < 2000) return 400n;      // ₹4.00
    if (amt < 3000) return 600n;      // ₹6.00
    return 800n;                      // ₹8.00 (Standard ₹3000+ max commission)
  }, [aepsAmount]);

  const aepsCommissionPaisa = useMemo(() => {
    if (aepsCommissionOverride.trim() === "") return aepsSlabCommissionPaisa;
    const num = parseFloat(aepsCommissionOverride);
    if (isNaN(num) || num < 0) return 0n;
    return BigInt(Math.round(num * 100));
  }, [aepsCommissionOverride, aepsSlabCommissionPaisa]);

  const aepsAmountPaisa = useMemo(() => {
    const num = parseFloat(aepsAmount) || 0;
    return BigInt(Math.round(num * 100));
  }, [aepsAmount]);

  const aepsFeePaisa = useMemo(() => {
    const num = parseFloat(aepsCustomFee) || 0;
    return BigInt(Math.round(num * 100));
  }, [aepsCustomFee]);

  // Net physical cash customer walks away with
  const aepsCashHandedPaisa = useMemo(() => {
    if (aepsFeeMode === "CUT_FROM_CASH") {
      return aepsAmountPaisa >= aepsFeePaisa ? aepsAmountPaisa - aepsFeePaisa : 0n;
    }
    return aepsAmountPaisa;
  }, [aepsAmountPaisa, aepsFeePaisa, aepsFeeMode]);

  const aepsNetProfitPaisa = useMemo(() => {
    return aepsCommissionPaisa + aepsFeePaisa;
  }, [aepsCommissionPaisa, aepsFeePaisa]);

  // Enhanced Scan-Fill SMS / Notification Parser for AEPS (Spice Money, DigiPay, Fino, PayNearby)
  const handleParseAepsSms = () => {
    if (!aepsScanText.trim()) return;
    const txt = aepsScanText;
    let parsedFields: string[] = [];

    // 1. Amount: "Rs. 3000" or "INR 3,000.00" or "Amt: 3000" or "Amount: 3000"
    const amtMatch = txt.match(/(?:Rs\.?|INR|Amt[:\s]*|Amount[:\s]*)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (amtMatch) {
      const cleanAmt = amtMatch[1].replace(/,/g, "");
      if (parseFloat(cleanAmt) > 0) {
        setAepsAmount(cleanAmt);
        parsedFields.push(`₹${cleanAmt}`);
      }
    }

    // 2. RRN / UTR / Reference: 8-18 digit numeric ID
    const rrnMatch = txt.match(/(?:RRN|Ref(?:erence)?\s*(?:No\.?)?|UTR|Txn\s*ID)[:\s]*([0-9]{8,18})/i);
    if (rrnMatch) {
      setAepsRrn(rrnMatch[1]);
      parsedFields.push(`RRN:${rrnMatch[1].slice(-4)}`);
    }

    // 3. Aadhaar: "ending with 5482", "XXXXXXXX5482", "XXXX-XXXX-5482", "Aadhaar: 5482"
    const aadhaarMatch =
      txt.match(/(?:Aadhaar(?:\s+No)?(?:\s+ending\s+with)?|A\/C|Acct)[:\s]*(?:[X*]{4,8}[-\s]*)?([0-9]{4})/i) ||
      txt.match(/[X*]{4,8}[-\s]*([0-9]{4})/i);
    if (aadhaarMatch) {
      setAepsAadhaar(aadhaarMatch[1]);
      parsedFields.push(`Aadhaar:••${aadhaarMatch[1]}`);
    }

    // 4. Mobile number: 10 digits starting with 6, 7, 8, or 9
    const mobileMatch = txt.match(/(?:Mob(?:ile)?|Phone|Customer)[:\s]*([6-9][0-9]{9})/i);
    if (mobileMatch) {
      setAepsMobile(mobileMatch[1]);
      parsedFields.push(`Mob:${mobileMatch[1]}`);
    }

    // 5. Customer Bank identification
    const banks: { name: string; regex: RegExp }[] = [
      { name: "State Bank of India", regex: /\b(SBI|State Bank of India)\b/i },
      { name: "Bangiya Gramin Vikash Bank", regex: /\b(BGVB|Bangiya Gramin|Bangiya Gramin Vikash Bank)\b/i },
      { name: "Paschim Banga Gramin Bank", regex: /\b(PBGB|Paschim Banga|Paschim Banga Gramin Bank)\b/i },
      { name: "Punjab National Bank", regex: /\b(PNB|Punjab National Bank)\b/i },
      { name: "UCO Bank", regex: /\b(UCO Bank|UCO)\b/i },
      { name: "Central Bank of India", regex: /\b(Central Bank|CBI)\b/i },
      { name: "Bank of India", regex: /\b(Bank of India|BOI)\b/i },
      { name: "Union Bank of India", regex: /\b(Union Bank|UBI)\b/i },
      { name: "Canara Bank", regex: /\b(Canara Bank|Canara)\b/i },
      { name: "Airtel Payments Bank", regex: /\b(Airtel Payments Bank|Airtel)\b/i },
      { name: "Fino Payments Bank", regex: /\b(Fino Payments Bank|Fino Mitra|Fino)\b/i },
      { name: "Paytm Payments Bank", regex: /\b(Paytm Payments Bank|Paytm)\b/i },
      { name: "Bandhan Bank", regex: /\b(Bandhan Bank|Bandhan)\b/i },
      { name: "Indian Bank", regex: /\b(Indian Bank)\b/i },
      { name: "Axis Bank", regex: /\b(Axis Bank)\b/i },
      { name: "HDFC Bank", regex: /\b(HDFC Bank|HDFC)\b/i },
      { name: "ICICI Bank", regex: /\b(ICICI Bank|ICICI)\b/i },
    ];
    for (const b of banks) {
      if (b.regex.test(txt)) {
        setAepsBank(b.name);
        parsedFields.push(b.name);
        break;
      }
    }

    // 6. Detect portal provider if mentioned
    const portalKeywords = [
      { key: /digipay/i, namePart: "digipay" },
      { key: /spice\s*money/i, namePart: "spice" },
      { key: /fino/i, namePart: "fino" },
      { key: /paynearby/i, namePart: "paynearby" },
    ];
    for (const pk of portalKeywords) {
      if (pk.key.test(txt)) {
        const matchingAcc = accounts.find((a) => a.name.toLowerCase().includes(pk.namePart));
        if (matchingAcc) {
          setAepsPortalId(matchingAcc.id);
          parsedFields.push(matchingAcc.name);
        }
        break;
      }
    }

    if (parsedFields.length > 0) {
      setAepsScanNotice(`✓ Auto-filled: ${parsedFields.join(" • ")}`);
    } else {
      setAepsScanNotice("⚠️ Could not detect standard fields. Please verify format.");
    }
    setTimeout(() => setAepsScanNotice(null), 5000);
    setAepsScanText("");
  };

  const handleProcessAeps = (e: React.FormEvent) => {
    e.preventDefault();
    if (aepsAmountPaisa <= 0n) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }

    if (portalAccounts.length === 0) {
      alert("Please add or select a CSP portal wallet (e.g. DigiPay, Spice Money, Fino) first.");
      return;
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const txnId = `AEPS-${Date.now().toString().slice(-6)}`;
    const portalAcc = accounts.find((a) => a.id === aepsPortalId) || portalAccounts[0];
    const qrAcc = qrAccounts[0] || accounts.find((a) => a.type === "BANK") || cashAccount;

    const newTxn: DigitalTransaction = {
      id: txnId,
      date: todayDate,
      time: timeStr,
      serviceType: "AEPS",
      customerName: aepsCustomerName.trim() || undefined,
      customerMobile: aepsMobile.trim() || undefined,
      beneficiaryDetails: `${aepsBank} • Aadhaar: ${aepsAadhaar.trim() || "XXXX"}`,
      amountPaisa: aepsAmountPaisa,
      customerFeePaisa: aepsFeePaisa,
      portalCommissionPaisa: aepsCommissionPaisa,
      portalSurchargePaisa: 0n,
      netProfitPaisa: aepsNetProfitPaisa,
      feeCollectionMode: aepsFeeMode,
      sourceAccountId: portalAcc.id,
      sourceAccountName: portalAcc.name,
      rrnOrUtr: aepsRrn.trim() || `RRN-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      status: "SUCCESS",
    };

    const journal = createAepsJournal({
      txnId,
      date: todayDate,
      time: timeStr,
      amountPaisa: aepsAmountPaisa,
      portalCommissionPaisa: aepsCommissionPaisa,
      customerFeePaisa: aepsFeePaisa,
      feeMode: aepsFeeMode,
      cashAccount,
      portalAccount: portalAcc,
      commissionAccount: incomeAccount,
      qrAccount: qrAcc,
    });

    // Exact Double-Entry Cash & Balance Calculations
    let cashDelta = 0n;
    let qrDelta = 0n;
    let khataDelta = 0n;
    const portalDelta = aepsAmountPaisa + aepsCommissionPaisa;

    if (aepsFeeMode === "CUT_FROM_CASH") {
      // Customer handed (Amount - Fee). Drawer pays out (Amount - Fee).
      cashDelta = -(aepsAmountPaisa >= aepsFeePaisa ? aepsAmountPaisa - aepsFeePaisa : 0n);
    } else if (aepsFeeMode === "SEPARATE_CASH") {
      // Drawer hands Amount notes, drawer receives Fee notes. Net physical cash leaving drawer is -(Amount - Fee)
      cashDelta = -(aepsAmountPaisa >= aepsFeePaisa ? aepsAmountPaisa - aepsFeePaisa : 0n);
    } else if (aepsFeeMode === "UPI_QR") {
      // Drawer hands Amount notes. Fee received in Shop QR holding.
      cashDelta = -aepsAmountPaisa;
      qrDelta = aepsFeePaisa;
    } else if (aepsFeeMode === "KHATA") {
      // Drawer hands Amount notes. Fee debited to customer Khata debt.
      cashDelta = -aepsAmountPaisa;
      khataDelta = aepsFeePaisa;
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: portalDelta,
      portalDeltaPaisa: portalDelta,
      qrDeltaPaisa: qrDelta,
      khataDeltaPaisa: khataDelta,
      customerPhone: aepsMobile.trim() || undefined,
      customerName: aepsCustomerName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);

    // Reset fields
    setAepsRrn("");
  };

  // ============================================================================
  // TAB 2: DMT MONEY REMITTANCE STATE
  // ============================================================================
  const [dmtSenderName, setDmtSenderName] = useState<string>("");
  const [dmtAmount, setDmtAmount] = useState<string>("5000");
  const [dmtSenderMobile, setDmtSenderMobile] = useState<string>("");
  const [dmtAccountNum, setDmtAccountNum] = useState<string>("");
  const [dmtAccountConfirm, setDmtAccountConfirm] = useState<string>("");
  const [dmtIfsc, setDmtIfsc] = useState<string>("SBIN0001234");
  const [dmtBeneficiaryName, setDmtBeneficiaryName] = useState<string>("");
  const [dmtSourceId, setDmtSourceId] = useState<string>(() => portalAccounts[0]?.id || "");
  const [dmtFeeMode, setDmtFeeMode] = useState<FeeCollectionMode>("SEPARATE_CASH");
  const [dmtCustomerFeePct, setDmtCustomerFeePct] = useState<string>("1.0");
  const [dmtPortalSurchargePct, setDmtPortalSurchargePct] = useState<string>("0.4");
  const [dmtUtr, setDmtUtr] = useState<string>("");

  useEffect(() => {
    if (portalAccounts.length > 0) {
      if (!portalAccounts.some((a) => a.id === dmtSourceId)) {
        setDmtSourceId(portalAccounts[0].id);
      }
    }
  }, [portalAccounts, dmtSourceId]);

  const dmtAmountPaisa = useMemo(() => {
    const num = parseFloat(dmtAmount) || 0;
    return BigInt(Math.round(num * 100));
  }, [dmtAmount]);

  const dmtCustomerFeePaisa = useMemo(() => {
    const raw = parseFloat(dmtCustomerFeePct);
    const pct = isNaN(raw) || raw < 0 ? 0 : raw;
    return (dmtAmountPaisa * BigInt(Math.round(pct * 100))) / 10000n;
  }, [dmtAmountPaisa, dmtCustomerFeePct]);

  const dmtPortalSurchargePaisa = useMemo(() => {
    const raw = parseFloat(dmtPortalSurchargePct);
    const pct = isNaN(raw) || raw < 0 ? 0 : raw;
    return (dmtAmountPaisa * BigInt(Math.round(pct * 100))) / 10000n;
  }, [dmtAmountPaisa, dmtPortalSurchargePct]);

  const dmtNetProfitPaisa = useMemo(() => {
    return dmtCustomerFeePaisa >= dmtPortalSurchargePaisa
      ? dmtCustomerFeePaisa - dmtPortalSurchargePaisa
      : 0n;
  }, [dmtCustomerFeePaisa, dmtPortalSurchargePaisa]);

  const handleProcessDmt = (e: React.FormEvent) => {
    e.preventDefault();
    if (dmtAmountPaisa <= 0n) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    if (dmtAccountConfirm && dmtAccountNum !== dmtAccountConfirm) {
      alert("Beneficiary account numbers do not match!");
      return;
    }
    if (portalAccounts.length === 0) {
      alert("Please add or select a source portal or bank account first.");
      return;
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const txnId = `DMT-${Date.now().toString().slice(-6)}`;
    const sourceAcc = accounts.find((a) => a.id === dmtSourceId) || portalAccounts[0];
    const qrAcc = qrAccounts[0] || accounts.find((a) => a.type === "BANK") || cashAccount;

    const newTxn: DigitalTransaction = {
      id: txnId,
      date: todayDate,
      time: timeStr,
      serviceType: "DMT",
      customerName: dmtSenderName.trim() || undefined,
      customerMobile: dmtSenderMobile.trim() || undefined,
      beneficiaryDetails: `${dmtBeneficiaryName.trim() || "Beneficiary"} • A/C: ${dmtAccountNum.trim()} • ${dmtIfsc.toUpperCase().trim()}`,
      amountPaisa: dmtAmountPaisa,
      customerFeePaisa: dmtCustomerFeePaisa,
      portalCommissionPaisa: 0n,
      portalSurchargePaisa: dmtPortalSurchargePaisa,
      netProfitPaisa: dmtNetProfitPaisa,
      feeCollectionMode: dmtFeeMode,
      sourceAccountId: sourceAcc.id,
      sourceAccountName: sourceAcc.name,
      rrnOrUtr: dmtUtr.trim() || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      status: "SUCCESS",
    };

    const journal = createDmtJournal({
      txnId,
      date: todayDate,
      time: timeStr,
      amountPaisa: dmtAmountPaisa,
      portalSurchargePaisa: dmtPortalSurchargePaisa,
      customerFeePaisa: dmtCustomerFeePaisa,
      feeMode: dmtFeeMode,
      sourceAccount: sourceAcc,
      cashAccount,
      commissionAccount: incomeAccount,
      qrAccount: qrAcc,
    });

    let cashDelta = 0n;
    let sourceDelta = 0n;
    let qrDelta = 0n;
    let khataDelta = 0n;

    if (dmtFeeMode === "SEPARATE_CASH") {
      cashDelta = dmtAmountPaisa + dmtCustomerFeePaisa;
      sourceDelta = -(dmtAmountPaisa + dmtPortalSurchargePaisa);
    } else if (dmtFeeMode === "CUT_FROM_CASH") {
      cashDelta = dmtAmountPaisa;
      const transferSent =
        dmtAmountPaisa >= dmtCustomerFeePaisa ? dmtAmountPaisa - dmtCustomerFeePaisa : dmtAmountPaisa;
      sourceDelta = -(transferSent + dmtPortalSurchargePaisa);
    } else if (dmtFeeMode === "UPI_QR") {
      cashDelta = dmtAmountPaisa;
      qrDelta = dmtCustomerFeePaisa;
      sourceDelta = -(dmtAmountPaisa + dmtPortalSurchargePaisa);
    } else if (dmtFeeMode === "KHATA") {
      cashDelta = dmtAmountPaisa;
      khataDelta = dmtCustomerFeePaisa;
      sourceDelta = -(dmtAmountPaisa + dmtPortalSurchargePaisa);
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: sourceDelta,
      portalDeltaPaisa: sourceDelta,
      qrDeltaPaisa: qrDelta,
      khataDeltaPaisa: khataDelta,
      customerPhone: dmtSenderMobile.trim() || undefined,
      customerName: dmtSenderName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);
    setDmtUtr("");
  };

  // ============================================================================
  // TAB 3: UPI CASH OUT STATE
  // ============================================================================
  const [cashoutCustomerName, setCashoutCustomerName] = useState<string>("Walk-in Customer");
  const [cashoutAmount, setCashoutAmount] = useState<string>("1000");
  const [cashoutFee, setCashoutFee] = useState<string>("10");
  const [cashoutFeeMode, setCashoutFeeMode] = useState<FeeCollectionMode>("INCLUDED_IN_QR");
  const [cashoutQrId, setCashoutQrId] = useState<string>(() => qrAccounts[0]?.id || portalAccounts[0]?.id || "");
  const [cashoutUtr, setCashoutUtr] = useState<string>("");
  const [cashoutCustomerMobile, setCashoutCustomerMobile] = useState<string>("");

  useEffect(() => {
    const validQrs = accounts.filter((a) => (a.type === "UPI_HOLDING" || a.type === "BANK") && a.id !== "acc-cash");
    if (validQrs.length > 0 && !validQrs.some((a) => a.id === cashoutQrId)) {
      setCashoutQrId(validQrs[0].id);
    }
  }, [accounts, cashoutQrId]);

  const cashoutAmountPaisa = useMemo(() => {
    const num = parseFloat(cashoutAmount) || 0;
    return BigInt(Math.round(num * 100));
  }, [cashoutAmount]);

  const cashoutFeePaisa = useMemo(() => {
    const num = parseFloat(cashoutFee) || 0;
    return BigInt(Math.round(num * 100));
  }, [cashoutFee]);

  const cashoutQrTotalPaisa = useMemo(() => {
    if (cashoutFeeMode === "INCLUDED_IN_QR") {
      return cashoutAmountPaisa + cashoutFeePaisa;
    }
    return cashoutAmountPaisa;
  }, [cashoutAmountPaisa, cashoutFeePaisa, cashoutFeeMode]);

  const cashoutCashHandedPaisa = useMemo(() => {
    if (cashoutFeeMode === "CUT_FROM_CASH") {
      return cashoutAmountPaisa >= cashoutFeePaisa ? cashoutAmountPaisa - cashoutFeePaisa : 0n;
    }
    return cashoutAmountPaisa;
  }, [cashoutAmountPaisa, cashoutFeePaisa, cashoutFeeMode]);

  const handleProcessCashout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashoutAmountPaisa <= 0n) {
      alert("Please enter a valid cash out amount.");
      return;
    }

    const validQrs = accounts.filter((a) => (a.type === "UPI_HOLDING" || a.type === "BANK") && a.id !== "acc-cash");
    const qrAcc = accounts.find((a) => a.id === cashoutQrId) || validQrs[0] || cashAccount;

    const todayDate = new Date().toISOString().split("T")[0];
    const txnId = `QROUT-${Date.now().toString().slice(-6)}`;

    const newTxn: DigitalTransaction = {
      id: txnId,
      date: todayDate,
      time: timeStr,
      serviceType: "UPI_CASHOUT",
      customerName: cashoutCustomerName.trim() || undefined,
      customerMobile: cashoutCustomerMobile.trim() || undefined,
      beneficiaryDetails: `UPI Cash Out via ${qrAcc.name}`,
      amountPaisa: cashoutAmountPaisa,
      customerFeePaisa: cashoutFeePaisa,
      portalCommissionPaisa: 0n,
      portalSurchargePaisa: 0n,
      netProfitPaisa: cashoutFeePaisa,
      feeCollectionMode: cashoutFeeMode,
      sourceAccountId: qrAcc.id,
      sourceAccountName: qrAcc.name,
      rrnOrUtr: cashoutUtr.trim() || `UPI-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      status: "SUCCESS",
    };

    const journal = createUpiCashoutJournal({
      txnId,
      date: todayDate,
      time: timeStr,
      cashAmountPaisa: cashoutAmountPaisa,
      feePaisa: cashoutFeePaisa,
      feeMode: cashoutFeeMode,
      cashAccount,
      qrAccount: qrAcc,
      feeIncomeAccount: incomeAccount,
    });

    let cashDelta = 0n;
    let sourceDelta = 0n;

    if (cashoutFeeMode === "INCLUDED_IN_QR") {
      cashDelta = -cashoutAmountPaisa;
      sourceDelta = cashoutAmountPaisa + cashoutFeePaisa;
    } else {
      const netCashHanded =
        cashoutAmountPaisa >= cashoutFeePaisa ? cashoutAmountPaisa - cashoutFeePaisa : 0n;
      cashDelta = -netCashHanded;
      sourceDelta = cashoutAmountPaisa;
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: sourceDelta,
      portalDeltaPaisa: sourceDelta,
      customerPhone: cashoutCustomerMobile.trim() || undefined,
      customerName: cashoutCustomerName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);
    setCashoutUtr("");
  };

  // ============================================================================
  // TAB 4: REGISTER AUDIT & SEARCH
  // ============================================================================
  const [registerSearch, setRegisterSearch] = useState("");
  const [registerFilter, setRegisterFilter] = useState<string>("ALL");

  const filteredRegister = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = registerFilter === "ALL" || t.serviceType === registerFilter;
      const q = registerSearch.toLowerCase();
      const matchesSearch =
        !q ||
        t.id.toLowerCase().includes(q) ||
        (t.rrnOrUtr && t.rrnOrUtr.toLowerCase().includes(q)) ||
        (t.customerMobile && t.customerMobile.includes(q)) ||
        (t.beneficiaryDetails && t.beneficiaryDetails.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [transactions, registerFilter, registerSearch]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayTransactions = useMemo(() => transactions.filter((t) => t.date === todayStr), [transactions, todayStr]);

  const todayVolumePaisa = useMemo(() => {
    return todayTransactions.reduce((sum, t) => sum + t.amountPaisa, 0n);
  }, [todayTransactions]);

  const todayProfitPaisa = useMemo(() => {
    return todayTransactions.reduce((sum, t) => sum + t.netProfitPaisa, 0n);
  }, [todayTransactions]);

  // ============================================================================
  // DISPATCH RECEIPT ACTIONS: PDF, THERMAL, WHATSAPP
  // ============================================================================
  const handleDownloadPdf = (txn: DigitalTransaction) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 150],
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("SARKAR COMMUNICATION", 40, 10, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Customer Service Point (CSP) & Banking Kiosk", 40, 14, { align: "center" });
    doc.text("West Bengal • Mob: +91 98765 43210", 40, 18, { align: "center" });
    doc.text("--------------------------------------------------", 40, 22, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    const title =
      txn.serviceType === "AEPS"
        ? "AEPS CASH WITHDRAWAL SLIP"
        : txn.serviceType === "DMT"
        ? "DMT MONEY TRANSFER RECEIPT"
        : "UPI CASH WITHDRAWAL SLIP";
    doc.text(title, 40, 27, { align: "center" });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    let y = 33;
    doc.text(`Txn ID: ${txn.id}`, 6, y);
    y += 4;
    doc.text(`Date & Time: ${txn.date} ${txn.time}`, 6, y);
    y += 4;
    if (txn.rrnOrUtr) {
      doc.text(`Bank RRN/UTR: ${txn.rrnOrUtr}`, 6, y);
      y += 4;
    }
    if (txn.customerName) {
      doc.text(`Customer: ${txn.customerName}`, 6, y);
      y += 4;
    }
    if (txn.customerMobile) {
      doc.text(`Customer Mobile: ${txn.customerMobile}`, 6, y);
      y += 4;
    }
    if (txn.beneficiaryDetails) {
      doc.text(`Details: ${txn.beneficiaryDetails}`, 6, y);
      y += 5;
    }

    doc.text("--------------------------------------------------", 40, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Amount:", 6, y);
    doc.text(formatPaisa(txn.amountPaisa), 74, y, { align: "right" });
    y += 5;

    if (txn.customerFeePaisa > 0n) {
      doc.setFont("helvetica", "normal");
      doc.text(`Counter Fee (${txn.feeCollectionMode}):`, 6, y);
      doc.text(formatPaisa(txn.customerFeePaisa), 74, y, { align: "right" });
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Status: SUCCESS / PROCESSED", 6, y);
    y += 6;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for using Sarkar Communication CSP!", 40, y, { align: "center" });
    y += 4;
    doc.text("Certified Banking Point • Safe & Secure", 40, y, { align: "center" });

    doc.save(`${txn.id}.pdf`);
  };

  const handleThermalPrint = (txn: DigitalTransaction) => {
    const printWindow = window.open("", "_blank", "width=360,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${txn.id}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 4px;
              font-size: 11px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .title { font-size: 13px; font-weight: bold; text-align: center; }
          </style>
        </head>
        <body>
          <div class="center title">SARKAR COMMUNICATION</div>
          <div class="center" style="font-size: 9px;">Digital Banking CSP & Cyber Cafe</div>
          <div class="center" style="font-size: 9px;">West Bengal • +91 98765 43210</div>
          <div class="divider"></div>
          <div class="center bold">${txn.serviceType} TRANSACTION ADVICE</div>
          <div class="divider"></div>
          <div class="row"><span>Txn ID:</span><span class="bold">${txn.id}</span></div>
          <div class="row"><span>Date:</span><span>${txn.date} ${txn.time}</span></div>
          ${txn.customerName ? `<div class="row"><span>Customer:</span><span class="bold">${txn.customerName}</span></div>` : ""}
          ${txn.rrnOrUtr ? `<div class="row"><span>RRN/UTR:</span><span class="bold">${txn.rrnOrUtr}</span></div>` : ""}
          ${txn.customerMobile ? `<div class="row"><span>Mobile:</span><span>${txn.customerMobile}</span></div>` : ""}
          ${txn.beneficiaryDetails ? `<div style="font-size: 9px; margin-top: 2px;">${txn.beneficiaryDetails}</div>` : ""}
          <div class="divider"></div>
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>TRANSACTION AMT:</span>
            <span>${formatPaisa(txn.amountPaisa)}</span>
          </div>
          ${txn.customerFeePaisa > 0n ? `<div class="row"><span>Convenience Fee:</span><span>${formatPaisa(txn.customerFeePaisa)}</span></div>` : ""}
          <div class="divider"></div>
          <div class="center bold">STATUS: SUCCESSFUL</div>
          <div class="divider"></div>
          <div class="center" style="font-size: 8px;">Thank you for visiting Sarkar Communication!</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleWhatsApp = async (txn: DigitalTransaction) => {
    const phone = txn.customerMobile ? txn.customerMobile.replace(/\D/g, "") : "";

    const text =
      `*SARKAR COMMUNICATION — BANKING CSP SLIP*\n` +
      `--------------------------------\n` +
      `*Service:* ${txn.serviceType} Banking\n` +
      `*Txn ID:* ${txn.id}\n` +
      `*Date:* ${txn.date} ${txn.time}\n` +
      (txn.customerName ? `*Customer:* ${txn.customerName}\n` : "") +
      (txn.rrnOrUtr ? `*Bank RRN/UTR:* ${txn.rrnOrUtr}\n` : "") +
      `*Amount:* ${formatPaisa(txn.amountPaisa)}\n` +
      (txn.customerFeePaisa > 0n ? `*Fee:* ${formatPaisa(txn.customerFeePaisa)}\n` : "") +
      `*Status:* SUCCESSFUL ✅\n` +
      `--------------------------------\n` +
      `Thank you for visiting Sarkar Communication!`;

    await sendWhatsAppMessage(phone, text, (toastMsg) => {
      if (showToast) showToast(toastMsg);
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. EXECUTIVE COMMAND DECK (MULTI-COLOR PASTEL THEME, NEVER BLACK) */}
      <div className="bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-4.5 rounded-2xl shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-500/15 to-blue-500/15 text-sky-600 dark:text-sky-400 border border-sky-300/40">
              <Landmark className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Biometric CSP Banking Kiosk
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  AEPS • DMT • CashOut
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sarkar Communication • Direct passbook double-entry settlement
              </p>
            </div>
          </div>

          {/* Today's CSP Revenue Ticker */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-750 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Today's Volume</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                  {formatPaisa(todayVolumePaisa)}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Margin</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  +{formatPaisa(todayProfitPaisa)}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Count</span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                  {todayTransactions.length} txns
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {timeStr}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          {[
            { id: "aeps" as const, label: "🏧 AEPS Cash Withdrawal", color: "text-emerald-700 dark:text-emerald-300 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
            { id: "dmt" as const, label: "💸 DMT Money Remittance", color: "text-sky-700 dark:text-sky-300 border-sky-400 bg-sky-50 dark:bg-sky-950/40" },
            { id: "cashout" as const, label: "📱 UPI QR Cash-Out", color: "text-purple-700 dark:text-purple-300 border-purple-400 bg-purple-50 dark:bg-purple-950/40" },
            { id: "register" as const, label: `📋 Day Register (${transactions.length})`, color: "text-amber-700 dark:text-amber-300 border-amber-400 bg-amber-50 dark:bg-amber-950/40" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                activeSubTab === tab.id
                  ? `${tab.color} shadow-xs scale-[1.01]`
                  : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-750/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1-TAP QUICK SETUP BAR WHEN NO PORTALS ARE AVAILABLE */}
        {portalAccounts.length === 0 && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <div>
                <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                  Quick Setup CSP Portals:
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 ml-1.5 hidden sm:inline">
                  Click your portal below to link float balances instantly.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COMMON_CSP_PORTALS.slice(0, 5).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleQuickAddPortal(p)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer shadow-xs transition active:scale-95"
                >
                  + {p.name}
                </button>
              ))}
              {onOpenAccountManager && (
                <button
                  type="button"
                  onClick={onOpenAccountManager}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                >
                  ⚙️ Custom...
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 2. SUB-PANEL 1: AEPS AADHAAR ATM                                     */}
      {/* ==================================================================== */}
      {activeSubTab === "aeps" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Form: 8 Cols */}
          <div className="lg:col-span-8 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs space-y-4">
            {/* Scan-Fill Quick Paste Ribbon */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-teal-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Clipboard className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Scan-Fill: Paste Spice Money / Fino / DigiPay confirmation text here..."
                  value={aepsScanText}
                  onChange={(e) => setAepsScanText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-teal-200 dark:border-teal-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleParseAepsSms}
                className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shrink-0 cursor-pointer"
              >
                Auto-Fill
              </button>
            </div>

            {aepsScanNotice && (
              <div className="p-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold animate-in slide-in-from-top-1 flex items-center justify-between">
                <span>{aepsScanNotice}</span>
                <button
                  type="button"
                  onClick={() => setAepsScanNotice(null)}
                  className="text-white/80 hover:text-white ml-2 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleProcessAeps} className="space-y-4">
              {/* Express Withdrawal Chips */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Express Amount Quick Chips
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {["500", "1000", "2000", "3000", "5000", "10000"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAepsAmount(amt)}
                      className={`py-1.5 rounded-xl font-mono text-xs font-black transition cursor-pointer ${
                        aepsAmount === amt
                          ? "bg-emerald-600 text-white shadow-xs scale-102"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Withdrawal Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    max="10000"
                    required
                    value={aepsAmount}
                    onChange={(e) => setAepsAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Bank *
                  </label>
                  <input
                    type="text"
                    required
                    list="aeps-banks-list"
                    value={aepsBank}
                    onChange={(e) => setAepsBank(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                  <datalist id="aeps-banks-list">
                    <option value="State Bank of India" />
                    <option value="Bangiya Gramin Vikash Bank (BGVB)" />
                    <option value="Punjab National Bank" />
                    <option value="Central Bank of India" />
                    <option value="UCO Bank" />
                    <option value="Bank of India" />
                    <option value="Union Bank of India" />
                    <option value="Airtel Payments Bank" />
                    <option value="Fino Payments Bank" />
                    <option value="Paytm Payments Bank" />
                    <option value="Canara Bank" />
                  </datalist>
                </div>
              </div>

              {/* Customer Name, Aadhaar Last 4 & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Name (Khata/Receipt)
                  </label>
                  <input
                    type="text"
                    list="csp-customers-list"
                    placeholder="e.g. Ramesh Mondal"
                    value={aepsCustomerName}
                    onChange={(e) => {
                      setAepsCustomerName(e.target.value);
                      const matched = customers.find(
                        (c) => c.name.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (matched && matched.phone) {
                        setAepsMobile(matched.phone);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                  <datalist id="csp-customers-list">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.phone ? `${c.phone} • Due: ${formatPaisa(c.currentDuePaisa)}` : ""}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Aadhaar Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. 5482"
                    value={aepsAadhaar}
                    onChange={(e) => setAepsAadhaar(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={aepsMobile}
                    onChange={(e) => setAepsMobile(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              {/* Fee & Commission Pricing Engine */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    💰 Fee &amp; Commission Pricing Engine
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Total Earnings: {formatPaisa(aepsNetProfitPaisa)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Portal Commission (₹)</label>
                      <span className="text-[9px] text-slate-400">Paid by Bank</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={aepsCommissionOverride}
                      onChange={(e) => setAepsCommissionOverride(e.target.value)}
                      placeholder={(Number(aepsSlabCommissionPaisa) / 100).toFixed(2)}
                      className="w-full bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-emerald-500"
                    />
                    <span className="text-[9px] text-slate-400 mt-0.5 block">
                      Standard slab: {formatPaisa(aepsSlabCommissionPaisa)}
                      {aepsCommissionOverride.trim() !== "" && (
                        <button type="button" onClick={() => setAepsCommissionOverride("")} className="ml-1.5 text-emerald-600 font-bold hover:underline cursor-pointer">
                          Reset
                        </button>
                      )}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-purple-800 dark:text-purple-300">Customer Fee (₹)</label>
                      <span className="text-[9px] text-slate-400">Charged at Counter</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={aepsCustomFee}
                      onChange={(e) => setAepsCustomFee(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-purple-500"
                    />
                    <div className="flex gap-1 mt-1">
                      {["0", "10", "20", "30", "50"].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAepsCustomFee(f)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                            aepsCustomFee === f ? "bg-purple-600 text-white" : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          ₹{f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Collection Mode */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Fee Collection Mode
                  </label>
                  <select
                    value={aepsFeeMode}
                    onChange={(e) => setAepsFeeMode(e.target.value as FeeCollectionMode)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="CUT_FROM_CASH">✂️ Cut Fee from Cash Handed</option>
                    <option value="SEPARATE_CASH">💵 Customer Pays Separate Cash</option>
                    <option value="UPI_QR">📱 Collect via UPI QR</option>
                    <option value="KHATA">👥 Add to Customer Khata</option>
                  </select>
                </div>
              </div>

              {/* Portal Source & RRN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Credited Portal Wallet / Bank *
                    </label>
                    <div className="flex items-center gap-1.5">
                      {onOpenAccountManager && (
                        <button
                          type="button"
                          onClick={onOpenAccountManager}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          + Manage
                        </button>
                      )}
                    </div>
                  </div>
                  <select
                    value={aepsPortalId}
                    onChange={(e) => setAepsPortalId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {portalAccounts.length === 0 ? (
                      <option value="">⚠️ No portal wallet configured (Add below)</option>
                    ) : (
                      portalAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatPaisa(a.currentBalancePaisa)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Bank RRN / UTR (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 308912345678"
                    value={aepsRrn}
                    onChange={(e) => setAepsRrn(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Setup Bar if no portals configured */}
              {portalAccounts.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs font-black">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Please add your CSP portal to record withdrawals:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_CSP_PORTALS.slice(0, 4).map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleQuickAddPortal(p)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={portalAccounts.length === 0}
                className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition-transform flex items-center justify-center gap-2 ${
                  portalAccounts.length === 0
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-99"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Record AEPS Withdrawal ({formatPaisa(aepsAmountPaisa)})</span>
              </button>
            </form>
          </div>

          {/* Right Live Double-Entry Breakdown Card: 4 Cols */}
          <div className="lg:col-span-4 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 dark:from-emerald-950/40 dark:via-slate-800/90 dark:to-teal-950/30 border-2 border-emerald-200/90 dark:border-emerald-700/60 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 border-b border-emerald-200/70 dark:border-emerald-700/70 pb-2">
                <span>🛡️</span> Live Passbook Settlement
              </h3>

              <div className="space-y-3 mt-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-emerald-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">💵 Hand Cash to Customer:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {formatPaisa(aepsCashHandedPaisa)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-emerald-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">🌐 Portal Credited (Principal):</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    +{formatPaisa(aepsAmountPaisa)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-emerald-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">💰 Bank Commission:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatPaisa(aepsCommissionPaisa)}
                  </span>
                </div>

                {aepsFeePaisa > 0n && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-emerald-200/80 dark:border-slate-600 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">⚡ Counter Fee:</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      +{formatPaisa(aepsFeePaisa)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-100 block">Total Shop Profit</span>
              <span className="text-2xl font-black font-mono tracking-tight block mt-0.5">
                +{formatPaisa(aepsNetProfitPaisa)}
              </span>
              <span className="text-[9px] text-emerald-200 mt-1 block">
                Drawer cash reduced • Portal float credited
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. SUB-PANEL 2: DMT MONEY REMITTANCE                                 */}
      {/* ==================================================================== */}
      {activeSubTab === "dmt" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs space-y-4">
            <form onSubmit={handleProcessDmt} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Transfer Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    required
                    value={dmtAmount}
                    onChange={(e) => setDmtAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["1000", "2000", "5000", "10000", "25000"].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDmtAmount(amt)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                          dmtAmount === amt ? "bg-sky-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Sender Name (Customer)
                  </label>
                  <input
                    type="text"
                    list="csp-customers-list"
                    placeholder="e.g. Ramesh Mondal"
                    value={dmtSenderName}
                    onChange={(e) => {
                      setDmtSenderName(e.target.value);
                      const matched = customers.find(
                        (c) => c.name.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (matched && matched.phone) {
                        setDmtSenderMobile(matched.phone);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Sender Mobile *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    placeholder="e.g. 9876543210"
                    value={dmtSenderMobile}
                    onChange={(e) => setDmtSenderMobile(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                </div>
              </div>

              {/* Beneficiary Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Beneficiary Account No. *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30891234567"
                    value={dmtAccountNum}
                    onChange={(e) => setDmtAccountNum(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Re-enter Account No. (Verification)
                  </label>
                  <input
                    type="text"
                    placeholder="Confirm account number"
                    value={dmtAccountConfirm}
                    onChange={(e) => setDmtAccountConfirm(e.target.value)}
                    className={`w-full bg-slate-50 dark:bg-slate-700 border rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-sky-500 ${
                      dmtAccountConfirm && dmtAccountConfirm !== dmtAccountNum
                        ? "border-rose-400 bg-rose-50/50"
                        : "border-slate-200 dark:border-slate-600"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Bank IFSC Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={dmtIfsc}
                    onChange={(e) => setDmtIfsc(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra Mondal"
                    value={dmtBeneficiaryName}
                    onChange={(e) => setDmtBeneficiaryName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                </div>
              </div>

              {/* Surcharge & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Outward Source Account *
                    </label>
                    <div className="flex items-center gap-1.5">
                      {onOpenAccountManager && (
                        <button
                          type="button"
                          onClick={onOpenAccountManager}
                          className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          + Manage
                        </button>
                      )}
                    </div>
                  </div>
                  <select
                    value={dmtSourceId}
                    onChange={(e) => setDmtSourceId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {portalAccounts.length === 0 ? (
                      <option value="">⚠️ No portal/bank account configured</option>
                    ) : (
                      portalAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatPaisa(a.currentBalancePaisa)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Charge (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={dmtCustomerFeePct}
                    onChange={(e) => setDmtCustomerFeePct(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-[9px] font-mono font-bold text-sky-700 dark:text-sky-400 mt-0.5 block">
                    Fee: +{formatPaisa(dmtCustomerFeePaisa)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Portal Surcharge (%)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={dmtPortalSurchargePct}
                    onChange={(e) => setDmtPortalSurchargePct(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                    Cost: -{formatPaisa(dmtPortalSurchargePaisa)}
                  </span>
                </div>
              </div>

              {/* Live DMT margin strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] font-bold">
                <span className="text-sky-900 dark:text-sky-200">
                  Customer Fee: <span className="font-mono">+{formatPaisa(dmtCustomerFeePaisa)}</span>
                </span>
                <span className="text-rose-700 dark:text-rose-300">
                  Portal Surcharge: <span className="font-mono">-{formatPaisa(dmtPortalSurchargePaisa)}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-mono">
                  Net Margin: +{formatPaisa(dmtNetProfitPaisa)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Fee Collection Mode
                  </label>
                  <select
                    value={dmtFeeMode}
                    onChange={(e) => setDmtFeeMode(e.target.value as FeeCollectionMode)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="SEPARATE_CASH">💵 Separate Cash (Amount + Fee)</option>
                    <option value="CUT_FROM_CASH">✂️ Cut Fee from Cash (Send Less)</option>
                    <option value="UPI_QR">📱 Collect Fee via UPI QR</option>
                    <option value="KHATA">👥 Add Fee to Customer Khata</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Bank UTR / Reference ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 308912345678"
                    value={dmtUtr}
                    onChange={(e) => setDmtUtr(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Quick Setup Bar if no portals configured */}
              {portalAccounts.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs font-black">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Please add your outward remittance portal to send DMT:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_CSP_PORTALS.slice(0, 4).map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleQuickAddPortal(p)}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={portalAccounts.length === 0}
                className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition-transform flex items-center justify-center gap-2 ${
                  portalAccounts.length === 0
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-600/30 cursor-pointer active:scale-99"
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirm & Send DMT Remittance ({formatPaisa(dmtAmountPaisa)})</span>
              </button>
            </form>
          </div>

          {/* Right Live DMT Math */}
          <div className="lg:col-span-4 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/40 dark:from-sky-950/40 dark:via-slate-800/90 dark:to-indigo-950/30 border-2 border-sky-200/90 dark:border-sky-700/60 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-sky-900 dark:text-sky-200 flex items-center gap-1.5 border-b border-sky-200/70 dark:border-sky-700/70 pb-2">
                <span>📊</span> DMT Remittance Settlement
              </h3>

              <div className="space-y-3 mt-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-sky-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">💵 Inward Cash from Customer:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    +{formatPaisa(dmtFeeMode === "SEPARATE_CASH" ? dmtAmountPaisa + dmtCustomerFeePaisa : dmtAmountPaisa)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-sky-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">🌐 Deducted from Portal / Bank:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    -{formatPaisa(
                      dmtFeeMode === "CUT_FROM_CASH"
                        ? (dmtAmountPaisa >= dmtCustomerFeePaisa ? dmtAmountPaisa - dmtCustomerFeePaisa : 0n) + dmtPortalSurchargePaisa
                        : dmtAmountPaisa + dmtPortalSurchargePaisa
                    )}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-sky-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">⚡ Customer Fee Collected:</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    +{formatPaisa(dmtCustomerFeePaisa)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/80 border border-sky-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">🏢 Portal Surcharge Paid:</span>
                  <span className="font-mono font-bold text-slate-500">
                    -{formatPaisa(dmtPortalSurchargePaisa)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/20 text-center">
              <span className="text-[10px] uppercase font-bold text-sky-100 block">Net Shop Commission Earned</span>
              <span className="text-2xl font-black font-mono tracking-tight block mt-0.5">
                +{formatPaisa(dmtNetProfitPaisa)}
              </span>
              <span className="text-[9px] text-sky-200 mt-1 block">
                Cash in desk drawer • Wallet/Bank sent to customer
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SUB-PANEL 3: UPI CASH OUT (QR CASH WITHDRAWAL)                    */}
      {/* ==================================================================== */}
      {activeSubTab === "cashout" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-white/95 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 p-5 rounded-2xl shadow-xs space-y-4">
            <form onSubmit={handleProcessCashout} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Cash Customer Wants (₹) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    required
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-purple-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["200", "500", "1000", "2000", "5000"].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashoutAmount(amt)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                          cashoutAmount === amt ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Name (Khata/Receipt)
                  </label>
                  <input
                    type="text"
                    list="csp-customers-list"
                    placeholder="e.g. Ramesh Mondal"
                    value={cashoutCustomerName}
                    onChange={(e) => {
                      setCashoutCustomerName(e.target.value);
                      const matched = customers.find(
                        (c) => c.name.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (matched && matched.phone) {
                        setCashoutCustomerMobile(matched.phone);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Shop Convenience Fee (₹)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={cashoutFee}
                    onChange={(e) => setCashoutFee(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Fee Collection Method
                  </label>
                  <select
                    value={cashoutFeeMode}
                    onChange={(e) => setCashoutFeeMode(e.target.value as FeeCollectionMode)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="INCLUDED_IN_QR">📱 Include Fee in QR Scan (e.g. Scan ₹1010, Hand ₹1000)</option>
                    <option value="SEPARATE_CASH">💵 Customer Pays Fee in Separate Cash</option>
                    <option value="CUT_FROM_CASH">✂️ Deduct Fee from Cash Given (e.g. Hand ₹990)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Destination QR / Bank Account *
                    </label>
                    <div className="flex items-center gap-1.5">
                      {onOpenAccountManager && (
                        <button
                          type="button"
                          onClick={onOpenAccountManager}
                          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          + Manage
                        </button>
                      )}
                    </div>
                  </div>
                  <select
                    value={cashoutQrId}
                    onChange={(e) => setCashoutQrId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {qrAccounts.length === 0 ? (
                      <option value="">⚠️ No UPI QR account configured (Add below)</option>
                    ) : (
                      qrAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatPaisa(a.currentBalancePaisa)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={cashoutCustomerMobile}
                    onChange={(e) => setCashoutCustomerMobile(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    UPI Reference / UTR
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 308912345678"
                    value={cashoutUtr}
                    onChange={(e) => setCashoutUtr(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Quick Setup for QR Soundbox if none configured */}
              {qrAccounts.length === 0 && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 text-xs font-bold">
                    <QrCode className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>No Counter UPI QR found:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPortal(COMMON_CSP_PORTALS[5])}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    + Add Counter UPI QR
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={qrAccounts.length === 0}
                className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition-transform flex items-center justify-center gap-2 ${
                  qrAccounts.length === 0
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-purple-600/30 cursor-pointer active:scale-99"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Confirm & Dispense Physical Cash ({formatPaisa(cashoutCashHandedPaisa)})</span>
              </button>
            </form>
          </div>

          {/* Right Live QR & Breakdown */}
          <div className="lg:col-span-4 bg-gradient-to-br from-purple-50/80 via-white to-violet-50/40 dark:from-purple-950/40 dark:via-slate-800/90 dark:to-violet-950/30 border-2 border-purple-200/90 dark:border-purple-700/60 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between text-center">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 border-b border-purple-200/70 dark:border-purple-700/70 pb-2">
                📱 Customer Scan QR Code
              </h3>

              <div className="p-3 bg-white rounded-2xl border border-purple-200 inline-block shadow-2xs mx-auto mt-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=2&data=${encodeURIComponent(
                    `upi://pay?pa=sarkarcommunication@sbi&pn=Sarkar+Communication&am=${(Number(cashoutQrTotalPaisa) / 100).toFixed(2)}&cu=INR`
                  )}`}
                  alt="Customer Scan QR"
                  className="w-28 h-28 mx-auto rounded-lg"
                />
                <span className="text-[10px] font-mono font-bold text-purple-700 dark:text-purple-900 block mt-1">
                  Amount to Scan: {formatPaisa(cashoutQrTotalPaisa)}
                </span>
              </div>

              <div className="space-y-2 mt-3 text-xs text-left">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-700/80 border border-purple-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">💵 Hand Cash to Customer:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                    {formatPaisa(cashoutCashHandedPaisa)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-700/80 border border-purple-200/80 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">📱 QR Inflow Received:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    +{formatPaisa(cashoutQrTotalPaisa)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/20 text-center">
              <span className="text-[10px] uppercase font-bold text-purple-100 block">Net Fee Retained</span>
              <span className="text-2xl font-black font-mono tracking-tight block mt-0.5">
                +{formatPaisa(cashoutFeePaisa)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. SUB-PANEL 4: CSP DAY TRANSACTION REGISTER                         */}
      {/* ==================================================================== */}
      {activeSubTab === "register" && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter:</span>
              {["ALL", "AEPS", "DMT", "UPI_CASHOUT"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRegisterFilter(mode)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    registerFilter === mode
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {mode === "ALL" ? "All" : mode}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search UTR, RRN, mobile, customer..."
                value={registerSearch}
                onChange={(e) => setRegisterSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium focus:outline-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            {filteredRegister.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No banking transactions recorded yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-750 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Txn ID / Time</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Details / Customer</th>
                    <th className="p-3">RRN / UTR</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Net Margin</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                  {filteredRegister.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-750/50 ${
                        t.status === "VOID" ? "opacity-60 bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          {t.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t.date} • {t.time}
                        </span>
                      </td>

                      <td className="p-3">
                        {t.status === "VOID" ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 line-through">
                            VOID {t.serviceType}
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${
                              t.serviceType === "AEPS"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : t.serviceType === "DMT"
                                ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {t.serviceType}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {t.customerName && (
                          <span className="font-black text-slate-900 dark:text-white block">
                            {t.customerName}
                          </span>
                        )}
                        <span className="text-[11px] block">{t.beneficiaryDetails || "General"}</span>
                        {t.customerMobile && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {t.customerMobile}
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {t.rrnOrUtr || "-"}
                      </td>

                      <td
                        className={`p-3 text-right font-mono font-black ${
                          t.status === "VOID" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {formatPaisa(t.amountPaisa)}
                      </td>

                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          t.status === "VOID"
                            ? "line-through text-slate-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        +{formatPaisa(t.netProfitPaisa)}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleThermalPrint(t)}
                            title="Thermal Print"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(t)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(t)}
                            title="WhatsApp Slip"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {onVoidDigitalTransaction && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Void / Cancel transaction "${t.id}"? This will reverse the balances in your cash drawer and accounts.`
                                  )
                                ) {
                                  onVoidDigitalTransaction(t.id);
                                  setTransactions((prev) =>
                                    prev.map((item) => (item.id === t.id ? { ...item, status: "VOID" } : item))
                                  );
                                }
                              }}
                              disabled={t.status === "VOID"}
                              title={t.status === "VOID" ? "Transaction already voided" : "Void Transaction"}
                              className={`p-1.5 rounded-lg transition ${
                                t.status === "VOID"
                                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. POST-TRANSACTION SUCCESS DIALOG MODAL                             */}
      {/* ==================================================================== */}
      {completedTxn && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-xs">
              ✓
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {completedTxn.serviceType} Successful
              </span>
              <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {formatPaisa(completedTxn.amountPaisa)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                {completedTxn.id} • {completedTxn.rrnOrUtr}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(completedTxn)}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition"
              >
                <FileDown className="w-4 h-4 text-emerald-600" />
                <span>PDF Slip</span>
              </button>
              <button
                type="button"
                onClick={() => handleThermalPrint(completedTxn)}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition"
              >
                <Printer className="w-4 h-4 text-sky-600" />
                <span>Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => handleWhatsApp(completedTxn)}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition"
              >
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedTxn(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs cursor-pointer"
            >
              Done & Next Transaction ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
