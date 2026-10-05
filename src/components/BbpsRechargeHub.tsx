import React, { useState, useMemo, useEffect } from "react";
import {
  TreasuryAccount,
  DigitalTransaction,
  FeeCollectionMode,
  Customer,
} from "../core/contracts";
import {
  createRechargeUtilityJournal,
  JournalEntry,
} from "../core/ledger";
import { sendWhatsAppMessage } from "../core/whatsapp";
import { jsPDF } from "jspdf";
import {
  Zap,
  Smartphone,
  Gamepad2,
  Tv,
  Car,
  Flame,
  Droplets,
  Wifi,
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
  TrendingUp,
  Clock,
  Layers,
  Copy,
  Dice5,
  Receipt,
  Wallet,
  ArrowRightLeft,
} from "lucide-react";

const COMMON_PORTALS = [
  { name: "CSC DigiPay", type: "WALLET" as const, code: "1021", desc: "CSC e-Gov Utility/AePS" },
  { name: "Spice Money", type: "WALLET" as const, code: "1022", desc: "Spicemoney BBPS & Recharges" },
  { name: "PayNearby", type: "WALLET" as const, code: "1024", desc: "PayNearby Retailer Hub" },
  { name: "SBI Current A/C", type: "BANK" as const, code: "1031", desc: "SBI Commercial Banking" },
  { name: "Counter UPI QR", type: "UPI_HOLDING" as const, code: "1041", desc: "Merchant Soundbox QR" },
];

export interface BbpsRechargeHubProps {
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

export const BbpsRechargeHub: React.FC<BbpsRechargeHubProps> = ({
  accounts,
  customers,
  timeStr,
  onRecordDigitalTransaction,
  onVoidDigitalTransaction,
  onAddAccount,
  onOpenAccountManager,
  showToast,
}) => {
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<"utility" | "recharge" | "gaming" | "register">("utility");

  // Local persistence for transactions
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(() => {
    try {
      const saved = localStorage.getItem("dc_bbps_recharge_txns");
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
      const toSave = transactions.map((t) => ({
        ...t,
        amountPaisa: t.amountPaisa.toString(),
        customerFeePaisa: t.customerFeePaisa.toString(),
        portalCommissionPaisa: t.portalCommissionPaisa.toString(),
        portalSurchargePaisa: t.portalSurchargePaisa.toString(),
        netProfitPaisa: t.netProfitPaisa.toString(),
      }));
      localStorage.setItem("dc_bbps_recharge_txns", JSON.stringify(toSave));
    } catch (e) {}
  }, [transactions]);

  // Treasury Accounts Isolation
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

  const incomeAccount = useMemo(() => {
    return (
      accounts.find((a) => a.type === "INCOME") || {
        id: "acc-income",
        code: "4100",
        name: "Commission & Fee Income",
        type: "INCOME" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      }
    );
  }, [accounts]);

  const portalAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== "acc-cash" && a.type !== "CASH");
  }, [accounts]);

  const qrAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== "acc-cash" && a.type === "UPI_HOLDING");
  }, [accounts]);

  const formatPaisa = (paisa: bigint) => {
    const isNeg = paisa < 0n;
    const abs = isNeg ? -paisa : paisa;
    const rupees = Number(abs / 100n);
    const remainder = Number(abs % 100n);
    const formatted = remainder > 0 ? `${rupees}.${remainder.toString().padStart(2, "0")}` : `${rupees}`;
    return `${isNeg ? "-" : ""}₹${formatted}`;
  };

  const handleQuickAddPortal = (portalPreset: typeof COMMON_PORTALS[0]) => {
    if (!onAddAccount) return;
    const newAcc: TreasuryAccount = {
      id: `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: portalPreset.code,
      name: portalPreset.name,
      type: portalPreset.type,
      currentBalancePaisa: 0n,
      isActive: true,
      metadata: { description: portalPreset.desc },
    };
    onAddAccount(newAcc);
  };

  // Completed transaction for receipt dialog
  const [completedTxn, setCompletedTxn] = useState<DigitalTransaction | null>(null);

  // ============================================================================
  // TAB 1: BBPS UTILITY BILLS & FASTAG STATE
  // ============================================================================
  type UtilityCategory = "ELECTRICITY" | "FASTAG" | "GAS" | "WATER" | "BROADBAND";
  const [utilityCat, setUtilityCat] = useState<UtilityCategory>("ELECTRICITY");

  const BILLER_PRESETS: Record<UtilityCategory, { id: string; name: string; idLabel: string; example: string }[]> = {
    ELECTRICITY: [
      { id: "wbsedcl", name: "WBSEDCL (West Bengal State Electricity)", idLabel: "Consumer ID (9 Digits)", example: "102345678" },
      { id: "cesc", name: "CESC Limited (Kolkata & Howrah)", idLabel: "Consumer Number (11 Digits)", example: "01002345678" },
      { id: "tatapower", name: "Tata Power (TPDDL)", idLabel: "CA Number", example: "60012345678" },
      { id: "bses_rajdhani", name: "BSES Rajdhani Power", idLabel: "CA Number (9 Digits)", example: "100234567" },
    ],
    FASTAG: [
      { id: "paytm_fastag", name: "Paytm Payments Bank FASTag", idLabel: "Vehicle Number", example: "WB02AX1234" },
      { id: "sbi_fastag", name: "State Bank of India (SBI) FASTag", idLabel: "Vehicle Number", example: "WB19B5678" },
      { id: "icici_fastag", name: "ICICI Bank FASTag", idLabel: "Vehicle Number", example: "WB06D9012" },
      { id: "indusind_fastag", name: "IndusInd Bank FASTag", idLabel: "Vehicle Number", example: "WB24K3456" },
    ],
    GAS: [
      { id: "indane_gas", name: "Indane Gas (Indian Oil)", idLabel: "LPG ID / Consumer No (16-17 Digits)", example: "3700000012345678" },
      { id: "bharat_gas", name: "Bharat Gas (BPCL)", idLabel: "Consumer No / Registered Mobile", example: "9830123456" },
      { id: "hp_gas", name: "HP Gas (HPCL)", idLabel: "Consumer No (6 Digits)", example: "654321" },
    ],
    WATER: [
      { id: "kmc_water", name: "Kolkata Municipal Corporation (KMC)", idLabel: "Assessee Number", example: "1102938475" },
      { id: "delhi_jal", name: "Delhi Jal Board (DJB)", idLabel: "K No (10 Digits)", example: "1029384756" },
    ],
    BROADBAND: [
      { id: "bsnl_broadband", name: "BSNL Landline & Bharat Fiber", idLabel: "Telephone No with STD Code", example: "03211255678" },
      { id: "airtel_broadband", name: "Airtel Xstream Fiber", idLabel: "Landline No with STD", example: "03340056789" },
      { id: "jio_fiber", name: "JioFiber Fixedline", idLabel: "Service ID (10-12 Digits)", example: "2019283746" },
    ],
  };

  const [utilityBillerId, setUtilityBillerId] = useState<string>("wbsedcl");
  const [utilityConsumerNo, setUtilityConsumerNo] = useState<string>("");
  const [utilityCustomerName, setUtilityCustomerName] = useState<string>("");
  const [utilityCustomerMobile, setUtilityCustomerMobile] = useState<string>("");
  const [utilityAmount, setUtilityAmount] = useState<string>("1250");
  const [utilityCustomerFee, setUtilityCustomerFee] = useState<string>("10");
  const [utilityCashback, setUtilityCashback] = useState<string>("5");
  const [utilityInwardMode, setUtilityInwardMode] = useState<FeeCollectionMode>("SEPARATE_CASH");
  const [utilitySourceId, setUtilitySourceId] = useState<string>(() => portalAccounts[0]?.id || "");
  const [utilityOperatorRef, setUtilityOperatorRef] = useState<string>("");
  const [utilityScanText, setUtilityScanText] = useState<string>("");
  const [utilityScanNotice, setUtilityScanNotice] = useState<string | null>(null);

  useEffect(() => {
    const list = BILLER_PRESETS[utilityCat];
    if (list && list.length > 0) {
      setUtilityBillerId(list[0].id);
    }
  }, [utilityCat]);

  useEffect(() => {
    if (portalAccounts.length > 0 && !portalAccounts.some((a) => a.id === utilitySourceId)) {
      setUtilitySourceId(portalAccounts[0].id);
    }
  }, [portalAccounts, utilitySourceId]);

  const currentBiller = useMemo(() => {
    return (
      BILLER_PRESETS[utilityCat].find((b) => b.id === utilityBillerId) ||
      BILLER_PRESETS[utilityCat][0]
    );
  }, [utilityCat, utilityBillerId]);

  const utilityAmountPaisa = useMemo(() => {
    const n = parseFloat(utilityAmount) || 0;
    return BigInt(Math.round(n * 100));
  }, [utilityAmount]);

  const utilityFeePaisa = useMemo(() => {
    const n = parseFloat(utilityCustomerFee) || 0;
    return BigInt(Math.round(n * 100));
  }, [utilityCustomerFee]);

  const utilityCashbackPaisa = useMemo(() => {
    const n = parseFloat(utilityCashback) || 0;
    return BigInt(Math.round(n * 100));
  }, [utilityCashback]);

  const utilityCustomerTotalPaisa = useMemo(() => {
    return utilityAmountPaisa + utilityFeePaisa;
  }, [utilityAmountPaisa, utilityFeePaisa]);

  const utilityOutwardCostPaisa = useMemo(() => {
    return utilityAmountPaisa >= utilityCashbackPaisa ? utilityAmountPaisa - utilityCashbackPaisa : utilityAmountPaisa;
  }, [utilityAmountPaisa, utilityCashbackPaisa]);

  const utilityNetProfitPaisa = useMemo(() => {
    return utilityFeePaisa + utilityCashbackPaisa;
  }, [utilityFeePaisa, utilityCashbackPaisa]);

  const handleParseUtilitySms = () => {
    if (!utilityScanText.trim()) return;
    const txt = utilityScanText;
    let found = [];

    // Amount: Rs. 1450, INR 1450, Bill: 1450
    const amtMatch = txt.match(/(?:Rs\.?|INR|Bill\s*(?:Amt|Amount)?[:\s]*)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (amtMatch) {
      const clean = amtMatch[1].replace(/,/g, "");
      if (parseFloat(clean) > 0) {
        setUtilityAmount(clean);
        found.push(`₹${clean}`);
      }
    }

    // Ref / Txn ID / Biller Ref: 8-16 digits
    const refMatch = txt.match(/(?:Txn\s*ID|Ref\s*(?:No\.?)?|UTR|Receipt\s*No)[:\s]*([0-9A-Z]{8,20})/i);
    if (refMatch) {
      setUtilityOperatorRef(refMatch[1]);
      found.push(`Ref:${refMatch[1].slice(-4)}`);
    }

    // Consumer ID / Vehicle:
    const consMatch = txt.match(/(?:Consumer\s*(?:ID|No\.?)|CA\s*No|Vehicle)[:\s]*([0-9A-Z]{6,16})/i);
    if (consMatch) {
      setUtilityConsumerNo(consMatch[1]);
      found.push(`ID:${consMatch[1]}`);
    }

    if (found.length > 0) {
      setUtilityScanNotice(`✓ Extracted: ${found.join(" • ")}`);
    } else {
      setUtilityScanNotice("⚠️ No recognized bill pattern found in pasted text.");
    }
  };

  const handleProcessUtilityBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (utilityAmountPaisa <= 0n) {
      alert("Please enter a valid bill amount greater than ₹0.");
      return;
    }
    if (!utilityConsumerNo.trim()) {
      alert(`Please enter ${currentBiller.idLabel}.`);
      return;
    }
    const sourceAcc = accounts.find((a) => a.id === utilitySourceId);
    if (!sourceAcc) {
      alert("Please select a valid funding portal or bank account.");
      return;
    }

    const qrAcc = qrAccounts[0] || {
      id: "acc-qr-temp",
      code: "1041",
      name: "Counter UPI QR",
      type: "UPI_HOLDING" as const,
      currentBalancePaisa: 0n,
      isActive: true,
    };

    let inwardAcc = cashAccount;
    if (utilityInwardMode === "UPI_QR") {
      inwardAcc = qrAcc;
    } else if (utilityInwardMode === "KHATA") {
      inwardAcc = {
        id: "acc-khata",
        code: "1030",
        name: "Customer Khata (Udhaar)",
        type: "KHATA" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      };
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const newTxnId = `BIL-${Date.now().toString().slice(-6)}`;

    const newTxn: DigitalTransaction = {
      id: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: utilityCat === "FASTAG" ? "FASTAG" : "UTILITY_BILL",
      customerName: utilityCustomerName.trim() || undefined,
      customerMobile: utilityCustomerMobile.trim() || undefined,
      beneficiaryDetails: `${currentBiller.name} • ${currentBiller.idLabel}: ${utilityConsumerNo.trim()}`,
      amountPaisa: utilityAmountPaisa,
      customerFeePaisa: utilityFeePaisa,
      portalCommissionPaisa: utilityCashbackPaisa,
      portalSurchargePaisa: 0n,
      netProfitPaisa: utilityNetProfitPaisa,
      feeCollectionMode: utilityInwardMode,
      sourceAccountId: sourceAcc.id,
      sourceAccountName: sourceAcc.name,
      inwardAccountId: inwardAcc.id,
      inwardAccountName: inwardAcc.name,
      rrnOrUtr: utilityOperatorRef.trim() || undefined,
      status: "SUCCESS",
    };

    const journal = createRechargeUtilityJournal({
      txnId: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: utilityCat === "FASTAG" ? "FASTAG" : "UTILITY_BILL",
      billOrFaceAmountPaisa: utilityAmountPaisa,
      customerFeePaisa: utilityFeePaisa,
      providerCashbackPaisa: utilityCashbackPaisa,
      inwardAccount: inwardAcc,
      outwardAccount: sourceAcc,
      incomeAccount,
    });

    let cashDelta = 0n;
    let qrDelta = 0n;
    let khataDelta = 0n;
    const sourceDelta = -utilityOutwardCostPaisa;

    if (utilityInwardMode === "SEPARATE_CASH" || utilityInwardMode === "CUT_FROM_CASH") {
      cashDelta = utilityCustomerTotalPaisa;
    } else if (utilityInwardMode === "UPI_QR") {
      qrDelta = utilityCustomerTotalPaisa;
    } else if (utilityInwardMode === "KHATA") {
      khataDelta = utilityCustomerTotalPaisa;
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: sourceDelta,
      portalDeltaPaisa: sourceDelta,
      qrDeltaPaisa: qrDelta,
      khataDeltaPaisa: khataDelta,
      customerPhone: utilityCustomerMobile.trim() || undefined,
      customerName: utilityCustomerName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);
    setUtilityOperatorRef("");
    setUtilityScanText("");
    setUtilityScanNotice(null);
  };

  // ============================================================================
  // TAB 2: MOBILE & DTH RECHARGE STATE
  // ============================================================================
  type RechargeType = "MOBILE" | "DTH";
  const [rechargeType, setRechargeType] = useState<RechargeType>("MOBILE");

  const MOBILE_OPERATORS = [
    { id: "jio", name: "Jio Infocomm", code: "JIO", color: "from-blue-600 to-indigo-600", commPct: 2.0 },
    { id: "airtel", name: "Bharti Airtel", code: "AIRTEL", color: "from-red-600 to-rose-600", commPct: 2.5 },
    { id: "vi", name: "Vodafone Idea (Vi)", code: "VI", color: "from-amber-500 to-red-500", commPct: 3.5 },
    { id: "bsnl", name: "BSNL Prepaid", code: "BSNL", color: "from-teal-600 to-emerald-600", commPct: 4.0 },
  ];

  const DTH_OPERATORS = [
    { id: "tataplay", name: "Tata Play", code: "TATAPLAY", color: "from-purple-600 to-indigo-600", commPct: 3.0 },
    { id: "airteldth", name: "Airtel Digital TV", code: "AIRTEL_DTH", color: "from-rose-600 to-red-600", commPct: 3.0 },
    { id: "dishtv", name: "Dish TV", code: "DISHTV", color: "from-orange-500 to-amber-600", commPct: 3.2 },
    { id: "sundirect", name: "Sun Direct", code: "SUNDIRECT", color: "from-yellow-500 to-orange-500", commPct: 3.5 },
    { id: "d2h", name: "d2h Videocon", code: "D2H", color: "from-blue-500 to-cyan-600", commPct: 3.0 },
  ];

  const [selectedMobileOp, setSelectedMobileOp] = useState<string>("jio");
  const [selectedDthOp, setSelectedDthOp] = useState<string>("tataplay");
  const [rechargeTarget, setRechargeTarget] = useState<string>("");
  const [rechargeCustomerName, setRechargeCustomerName] = useState<string>("");
  const [rechargeAmount, setRechargeAmount] = useState<string>("239");
  const [rechargeCustomerFee, setRechargeCustomerFee] = useState<string>("0");
  const [rechargeInwardMode, setRechargeInwardMode] = useState<FeeCollectionMode>("SEPARATE_CASH");
  const [rechargeSourceId, setRechargeSourceId] = useState<string>(() => portalAccounts[0]?.id || "");
  const [rechargeOperatorRef, setRechargeOperatorRef] = useState<string>("");
  const [detectedCircle, setDetectedCircle] = useState<string>("West Bengal & Kolkata");

  // Auto-detect operator on 4 digits
  useEffect(() => {
    if (rechargeType === "MOBILE" && rechargeTarget.length >= 4) {
      const prefix = rechargeTarget.slice(0, 4);
      if (/^(7003|7001|6290|6291|7980|8910|7439|7044)/.test(prefix)) {
        setSelectedMobileOp("jio");
        setDetectedCircle("Kolkata / WB (Jio)");
      } else if (/^(9830|9831|9832|9836|9433|9874|9051)/.test(prefix)) {
        setSelectedMobileOp("airtel");
        setDetectedCircle("West Bengal (Airtel)");
      } else if (/^(9804|9883|9007|9163|9748)/.test(prefix)) {
        setSelectedMobileOp("vi");
        setDetectedCircle("Kolkata / WB (Vi)");
      } else if (/^(9434|9432|9474|9475|9477)/.test(prefix)) {
        setSelectedMobileOp("bsnl");
        setDetectedCircle("West Bengal Telecom (BSNL)");
      }
    }
  }, [rechargeTarget, rechargeType]);

  useEffect(() => {
    if (portalAccounts.length > 0 && !portalAccounts.some((a) => a.id === rechargeSourceId)) {
      setRechargeSourceId(portalAccounts[0].id);
    }
  }, [portalAccounts, rechargeSourceId]);

  const activeOpObj = useMemo(() => {
    if (rechargeType === "MOBILE") {
      return MOBILE_OPERATORS.find((o) => o.id === selectedMobileOp) || MOBILE_OPERATORS[0];
    }
    return DTH_OPERATORS.find((o) => o.id === selectedDthOp) || DTH_OPERATORS[0];
  }, [rechargeType, selectedMobileOp, selectedDthOp]);

  const rechargeAmountPaisa = useMemo(() => {
    const n = parseFloat(rechargeAmount) || 0;
    return BigInt(Math.round(n * 100));
  }, [rechargeAmount]);

  const rechargeCustomerFeePaisa = useMemo(() => {
    const n = parseFloat(rechargeCustomerFee) || 0;
    return BigInt(Math.round(n * 100));
  }, [rechargeCustomerFee]);

  // Manual override for operator commission (empty = use operator default rate)
  const [rechargeCommissionOverride, setRechargeCommissionOverride] = useState<string>("");

  const rechargeDefaultCommissionPaisa = useMemo(() => {
    if (rechargeAmountPaisa <= 0n) return 0n;
    const commPct = activeOpObj.commPct;
    const commAmt = (Number(rechargeAmountPaisa) * commPct) / 100;
    return BigInt(Math.round(commAmt));
  }, [rechargeAmountPaisa, activeOpObj]);

  const rechargeCommissionPaisa = useMemo(() => {
    if (rechargeCommissionOverride.trim() === "") return rechargeDefaultCommissionPaisa;
    const n = parseFloat(rechargeCommissionOverride);
    if (isNaN(n) || n < 0) return 0n;
    return BigInt(Math.round(n * 100));
  }, [rechargeCommissionOverride, rechargeDefaultCommissionPaisa]);

  const rechargeCustomerTotalPaisa = useMemo(() => {
    return rechargeAmountPaisa + rechargeCustomerFeePaisa;
  }, [rechargeAmountPaisa, rechargeCustomerFeePaisa]);

  const rechargeOutwardCostPaisa = useMemo(() => {
    return rechargeAmountPaisa >= rechargeCommissionPaisa
      ? rechargeAmountPaisa - rechargeCommissionPaisa
      : rechargeAmountPaisa;
  }, [rechargeAmountPaisa, rechargeCommissionPaisa]);

  const rechargeNetProfitPaisa = useMemo(() => {
    return rechargeCustomerFeePaisa + rechargeCommissionPaisa;
  }, [rechargeCustomerFeePaisa, rechargeCommissionPaisa]);

  const POPULAR_MOBILE_PACKS = [
    { amt: "19", label: "1GB Data", desc: "1 Day 4G Boost" },
    { amt: "29", label: "2GB Data", desc: "1 Day High-Speed" },
    { amt: "239", label: "₹239 Plan", desc: "28 Days • 1.5GB/Day • Calls" },
    { amt: "299", label: "₹299 Hero", desc: "28 Days • 2GB/Day + Night Data" },
    { amt: "666", label: "₹666 Trio", desc: "70 Days • 1.5GB/Day • Voice" },
    { amt: "719", label: "₹719 Pack", desc: "84 Days • 1.5GB/Day • Full Season" },
    { amt: "2999", label: "₹2999 Annual", desc: "365 Days • 2.5GB/Day • 5G Ultra" },
  ];

  const POPULAR_DTH_PACKS = [
    { amt: "150", label: "₹150 Pack", desc: "Regional Bengali Lite" },
    { amt: "250", label: "₹250 Family", desc: "News, Kids & Bengali HD" },
    { amt: "350", label: "₹350 Sports", desc: "Full Sports HD + Movies" },
    { amt: "500", label: "₹500 2-Month", desc: "Family Saver Combo" },
    { amt: "1000", label: "₹1000 Mega", desc: "Quarterly Mega Premium" },
  ];

  const handleProcessRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (rechargeAmountPaisa <= 0n) {
      alert("Please enter a recharge amount greater than ₹0.");
      return;
    }
    if (!rechargeTarget.trim()) {
      alert(rechargeType === "MOBILE" ? "Please enter 10-digit Mobile Number." : "Please enter Subscriber ID.");
      return;
    }
    const sourceAcc = accounts.find((a) => a.id === rechargeSourceId);
    if (!sourceAcc) {
      alert("Please select a valid funding portal or bank wallet.");
      return;
    }

    const qrAcc = qrAccounts[0] || {
      id: "acc-qr-temp",
      code: "1041",
      name: "Counter UPI QR",
      type: "UPI_HOLDING" as const,
      currentBalancePaisa: 0n,
      isActive: true,
    };

    let inwardAcc = cashAccount;
    if (rechargeInwardMode === "UPI_QR") {
      inwardAcc = qrAcc;
    } else if (rechargeInwardMode === "KHATA") {
      inwardAcc = {
        id: "acc-khata",
        code: "1030",
        name: "Customer Khata (Udhaar)",
        type: "KHATA" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      };
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const newTxnId = `RCH-${Date.now().toString().slice(-6)}`;

    const newTxn: DigitalTransaction = {
      id: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: "RECHARGE",
      customerName: rechargeCustomerName.trim() || undefined,
      customerMobile: rechargeType === "MOBILE" ? rechargeTarget.trim() : undefined,
      beneficiaryDetails: `${activeOpObj.name} • ${rechargeType === "MOBILE" ? "Mob" : "DTH"}: ${rechargeTarget.trim()}`,
      amountPaisa: rechargeAmountPaisa,
      customerFeePaisa: rechargeCustomerFeePaisa,
      portalCommissionPaisa: rechargeCommissionPaisa,
      portalSurchargePaisa: 0n,
      netProfitPaisa: rechargeNetProfitPaisa,
      feeCollectionMode: rechargeInwardMode,
      sourceAccountId: sourceAcc.id,
      sourceAccountName: sourceAcc.name,
      inwardAccountId: inwardAcc.id,
      inwardAccountName: inwardAcc.name,
      rrnOrUtr: rechargeOperatorRef.trim() || undefined,
      status: "SUCCESS",
    };

    const journal = createRechargeUtilityJournal({
      txnId: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: "RECHARGE",
      billOrFaceAmountPaisa: rechargeAmountPaisa,
      customerFeePaisa: rechargeCustomerFeePaisa,
      providerCashbackPaisa: rechargeCommissionPaisa,
      inwardAccount: inwardAcc,
      outwardAccount: sourceAcc,
      incomeAccount,
    });

    let cashDelta = 0n;
    let qrDelta = 0n;
    let khataDelta = 0n;
    const sourceDelta = -rechargeOutwardCostPaisa;

    if (rechargeInwardMode === "SEPARATE_CASH" || rechargeInwardMode === "CUT_FROM_CASH") {
      cashDelta = rechargeCustomerTotalPaisa;
    } else if (rechargeInwardMode === "UPI_QR") {
      qrDelta = rechargeCustomerTotalPaisa;
    } else if (rechargeInwardMode === "KHATA") {
      khataDelta = rechargeCustomerTotalPaisa;
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: sourceDelta,
      portalDeltaPaisa: sourceDelta,
      qrDeltaPaisa: qrDelta,
      khataDeltaPaisa: khataDelta,
      customerPhone: rechargeType === "MOBILE" ? rechargeTarget.trim() : undefined,
      customerName: rechargeCustomerName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);
    setRechargeOperatorRef("");
  };

  // ============================================================================
  // TAB 3: GOOGLE PLAY & GAMING VOUCHERS STATE
  // ============================================================================
  type GamePlatform = "FREE_FIRE" | "BGMI" | "GOOGLE_PLAY";
  const [gamingPlatform, setGamingPlatform] = useState<GamePlatform>("FREE_FIRE");

  const GAMING_PACKS: Record<GamePlatform, { amt: string; title: string; desc: string }[]> = {
    FREE_FIRE: [
      { amt: "10", title: "₹10 Airdrop", desc: "Special Promo Drop" },
      { amt: "29", title: "₹29 Airdrop", desc: "300 Diamonds + Gun Crates" },
      { amt: "80", title: "₹80 Pack", desc: "100 Diamonds Topup" },
      { amt: "160", title: "₹160 Weekly", desc: "Weekly Membership Pass" },
      { amt: "240", title: "₹240 Pack", desc: "310 Diamonds Topup" },
      { amt: "400", title: "₹400 Monthly", desc: "Monthly Membership Pass" },
      { amt: "800", title: "₹800 Mega", desc: "1060 Diamonds Topup" },
    ],
    BGMI: [
      { amt: "75", title: "₹75 Pack", desc: "60 UC Instant" },
      { amt: "380", title: "₹380 Royale Pass", desc: "300 UC + 60 Bonus UC" },
      { amt: "750", title: "₹750 Pack", desc: "660 UC Battle Pass" },
      { amt: "1900", title: "₹1900 Elite", desc: "1800 UC Elite Pass" },
    ],
    GOOGLE_PLAY: [
      { amt: "10", title: "₹10 Voucher", desc: "Micro Topup" },
      { amt: "50", title: "₹50 Voucher", desc: "App / In-App Item" },
      { amt: "100", title: "₹100 Voucher", desc: "Standard Play Credit" },
      { amt: "200", title: "₹200 Voucher", desc: "Book / Game Purchase" },
      { amt: "500", title: "₹500 Voucher", desc: "Gaming Currency Pack" },
      { amt: "1000", title: "₹1000 Mega", desc: "Subscription & Games" },
    ],
  };

  const [gamingPlayerName, setGamingPlayerName] = useState<string>("");
  const [gamingPlayerMobile, setGamingPlayerMobile] = useState<string>("");
  const [gamingPlayerUid, setGamingPlayerUid] = useState<string>("");
  const [gamingAmount, setGamingAmount] = useState<string>("80");
  const [gamingCustomerFee, setGamingCustomerFee] = useState<string>("5");
  const [gamingDiscountPaisa, setGamingDiscountPaisa] = useState<string>("2"); // Shop commission/discount
  const [gamingVoucherCode, setGamingVoucherCode] = useState<string>("");
  const [gamingInwardMode, setGamingInwardMode] = useState<FeeCollectionMode>("SEPARATE_CASH");
  const [gamingSourceId, setGamingSourceId] = useState<string>(() => portalAccounts[0]?.id || "");

  const generateVoucherCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let seg = 0; seg < 4; seg++) {
      let segment = "";
      for (let i = 0; i < 4; i++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code += (seg > 0 ? "-" : "") + segment;
    }
    setGamingVoucherCode(code);
  };

  useEffect(() => {
    generateVoucherCode();
  }, [gamingPlatform]);

  useEffect(() => {
    if (portalAccounts.length > 0 && !portalAccounts.some((a) => a.id === gamingSourceId)) {
      setGamingSourceId(portalAccounts[0].id);
    }
  }, [portalAccounts, gamingSourceId]);

  const gamingAmountPaisa = useMemo(() => {
    const n = parseFloat(gamingAmount) || 0;
    return BigInt(Math.round(n * 100));
  }, [gamingAmount]);

  const gamingFeePaisa = useMemo(() => {
    const n = parseFloat(gamingCustomerFee) || 0;
    return BigInt(Math.round(n * 100));
  }, [gamingCustomerFee]);

  const gamingCommPaisa = useMemo(() => {
    const n = parseFloat(gamingDiscountPaisa) || 0;
    return BigInt(Math.round(n * 100));
  }, [gamingDiscountPaisa]);

  const gamingCustomerTotalPaisa = useMemo(() => {
    return gamingAmountPaisa + gamingFeePaisa;
  }, [gamingAmountPaisa, gamingFeePaisa]);

  const gamingOutwardCostPaisa = useMemo(() => {
    return gamingAmountPaisa >= gamingCommPaisa ? gamingAmountPaisa - gamingCommPaisa : gamingAmountPaisa;
  }, [gamingAmountPaisa, gamingCommPaisa]);

  const gamingNetProfitPaisa = useMemo(() => {
    return gamingFeePaisa + gamingCommPaisa;
  }, [gamingFeePaisa, gamingCommPaisa]);

  const handleProcessGamingVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (gamingAmountPaisa <= 0n) {
      alert("Please enter a voucher amount greater than ₹0.");
      return;
    }
    if (!gamingVoucherCode.trim()) {
      alert("Please generate or enter a 16-character Voucher Code.");
      return;
    }
    const sourceAcc = accounts.find((a) => a.id === gamingSourceId);
    if (!sourceAcc) {
      alert("Please select a valid funding portal or bank wallet.");
      return;
    }

    const qrAcc = qrAccounts[0] || {
      id: "acc-qr-temp",
      code: "1041",
      name: "Counter UPI QR",
      type: "UPI_HOLDING" as const,
      currentBalancePaisa: 0n,
      isActive: true,
    };

    let inwardAcc = cashAccount;
    if (gamingInwardMode === "UPI_QR") {
      inwardAcc = qrAcc;
    } else if (gamingInwardMode === "KHATA") {
      inwardAcc = {
        id: "acc-khata",
        code: "1030",
        name: "Customer Khata (Udhaar)",
        type: "KHATA" as const,
        currentBalancePaisa: 0n,
        isActive: true,
      };
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const newTxnId = `PLY-${Date.now().toString().slice(-6)}`;

    const platformLabel =
      gamingPlatform === "FREE_FIRE"
        ? "Free Fire Max"
        : gamingPlatform === "BGMI"
        ? "BGMI (Battlegrounds Mobile)"
        : "Google Play Store";

    const newTxn: DigitalTransaction = {
      id: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: "GOOGLE_PLAY",
      customerName: gamingPlayerName.trim() || undefined,
      customerMobile: gamingPlayerMobile.trim() || undefined,
      beneficiaryDetails: `${platformLabel} • ${gamingPlayerUid ? `UID: ${gamingPlayerUid} • ` : ""}Code: ${gamingVoucherCode}`,
      amountPaisa: gamingAmountPaisa,
      customerFeePaisa: gamingFeePaisa,
      portalCommissionPaisa: gamingCommPaisa,
      portalSurchargePaisa: 0n,
      netProfitPaisa: gamingNetProfitPaisa,
      feeCollectionMode: gamingInwardMode,
      sourceAccountId: sourceAcc.id,
      sourceAccountName: sourceAcc.name,
      inwardAccountId: inwardAcc.id,
      inwardAccountName: inwardAcc.name,
      voucherCode: gamingVoucherCode.trim(),
      status: "SUCCESS",
    };

    const journal = createRechargeUtilityJournal({
      txnId: newTxnId,
      date: todayDate,
      time: timeStr,
      serviceType: "GOOGLE_PLAY",
      billOrFaceAmountPaisa: gamingAmountPaisa,
      customerFeePaisa: gamingFeePaisa,
      providerCashbackPaisa: gamingCommPaisa,
      inwardAccount: inwardAcc,
      outwardAccount: sourceAcc,
      incomeAccount,
    });

    let cashDelta = 0n;
    let qrDelta = 0n;
    let khataDelta = 0n;
    const sourceDelta = -gamingOutwardCostPaisa;

    if (gamingInwardMode === "SEPARATE_CASH" || gamingInwardMode === "CUT_FROM_CASH") {
      cashDelta = gamingCustomerTotalPaisa;
    } else if (gamingInwardMode === "UPI_QR") {
      qrDelta = gamingCustomerTotalPaisa;
    } else if (gamingInwardMode === "KHATA") {
      khataDelta = gamingCustomerTotalPaisa;
    }

    onRecordDigitalTransaction({
      transaction: newTxn,
      journal,
      cashDeltaPaisa: cashDelta,
      sourceDeltaPaisa: sourceDelta,
      portalDeltaPaisa: sourceDelta,
      qrDeltaPaisa: qrDelta,
      khataDeltaPaisa: khataDelta,
      customerPhone: gamingPlayerMobile.trim() || undefined,
      customerName: gamingPlayerName.trim() || undefined,
    });

    setTransactions((prev) => [newTxn, ...prev]);
    setCompletedTxn(newTxn);
    generateVoucherCode();
  };

  // ============================================================================
  // RECEIPTS & DISPATCH ENGINE (PDF, THERMAL, WHATSAPP)
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
    doc.text("Digital Seva & Utility Bill Payment Hub", 40, 14, { align: "center" });
    doc.text("Arambagh, Hooghly • WB", 40, 18, { align: "center" });
    doc.text("--------------------------------------------------", 40, 22, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const title =
      txn.serviceType === "UTILITY_BILL"
        ? "BBPS ELECTRICITY / UTILITY RECEIPT"
        : txn.serviceType === "RECHARGE"
        ? "MOBILE / DTH RECHARGE SLIP"
        : txn.serviceType === "FASTAG"
        ? "FASTAG TOLL RECHARGE SLIP"
        : "GOOGLE PLAY GAMING VOUCHER";
    doc.text(title, 40, 27, { align: "center" });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    let y = 33;
    doc.text(`Receipt No: ${txn.id}`, 6, y);
    y += 4;
    doc.text(`Date & Time: ${txn.date} ${txn.time}`, 6, y);
    y += 4;
    if (txn.rrnOrUtr) {
      doc.text(`Operator Ref: ${txn.rrnOrUtr}`, 6, y);
      y += 4;
    }
    if (txn.voucherCode) {
      doc.setFont("helvetica", "bold");
      doc.text(`REDEEM CODE: ${txn.voucherCode}`, 6, y);
      doc.setFont("helvetica", "normal");
      y += 4.5;
    }
    if (txn.customerName) {
      doc.text(`Customer Name: ${txn.customerName}`, 6, y);
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
    doc.text("Face / Bill Value:", 6, y);
    doc.text(formatPaisa(txn.amountPaisa), 74, y, { align: "right" });
    y += 5;

    if (txn.customerFeePaisa > 0n) {
      doc.setFont("helvetica", "normal");
      doc.text("Service Convenience Fee:", 6, y);
      doc.text(formatPaisa(txn.customerFeePaisa), 74, y, { align: "right" });
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL AMOUNT PAID:", 6, y);
    doc.text(formatPaisa(txn.amountPaisa + txn.customerFeePaisa), 74, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Payment Tender: ${txn.feeCollectionMode}`, 6, y);
    y += 4;
    doc.text(`Status: ${txn.status} (Verified)`, 6, y);
    y += 6;

    doc.text("--------------------------------------------------", 40, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your visit!", 40, y, { align: "center" });
    y += 4;
    doc.text("Computer Generated Slip • Sarkar Communication", 40, y, { align: "center" });

    doc.save(`Receipt_${txn.id}.pdf`);
  };

  const handlePrintThermal = (txn: DigitalTransaction) => {
    const printWindow = window.open("", "_blank", "width=320,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${txn.id}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: monospace; font-size: 11px; padding: 12px; margin: 0; line-height: 1.35; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .code-box { border: 1px solid #000; padding: 6px; text-align: center; font-size: 13px; font-weight: bold; margin: 6px 0; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">SARKAR COMMUNICATION</div>
          <div class="center" style="font-size: 10px;">Digital Seva & Utility Bill Hub</div>
          <div class="center" style="font-size: 10px;">Arambagh, Hooghly • WB</div>
          <div class="divider"></div>
          <div class="center bold">${txn.serviceType} RECEIPT</div>
          <div class="row"><span>Txn ID:</span><span>${txn.id}</span></div>
          <div class="row"><span>Date:</span><span>${txn.date} ${txn.time}</span></div>
          ${txn.customerName ? `<div class="row"><span>Customer:</span><span>${txn.customerName}</span></div>` : ""}
          ${txn.customerMobile ? `<div class="row"><span>Mobile:</span><span>${txn.customerMobile}</span></div>` : ""}
          ${txn.rrnOrUtr ? `<div class="row"><span>Ref/UTR:</span><span>${txn.rrnOrUtr}</span></div>` : ""}
          ${txn.voucherCode ? `<div class="code-box">REDEEM CODE:<br/>${txn.voucherCode}</div>` : ""}
          <div style="font-size: 9.5px; margin: 4px 0;">${txn.beneficiaryDetails || ""}</div>
          <div class="divider"></div>
          <div class="row"><span>Face/Bill:</span><span>${formatPaisa(txn.amountPaisa)}</span></div>
          ${txn.customerFeePaisa > 0n ? `<div class="row"><span>Fee:</span><span>${formatPaisa(txn.customerFeePaisa)}</span></div>` : ""}
          <div class="row bold" style="font-size: 13px;"><span>TOTAL PAID:</span><span>${formatPaisa(txn.amountPaisa + txn.customerFeePaisa)}</span></div>
          <div class="row"><span>Payment Tender:</span><span>${txn.feeCollectionMode}</span></div>
          <div class="divider"></div>
          <div class="center" style="font-size: 9.5px;">Status: SUCCESS • Verified</div>
          <div class="center" style="font-size: 9px; margin-top: 4px;">Thank You • Visit Again!</div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsApp = async (txn: DigitalTransaction) => {
    let msg = `⚡ *SARKAR COMMUNICATION - DIGITAL RECEIPT*\n`;
    msg += `----------------------------------------\n`;
    msg += `📄 *Receipt No:* ${txn.id}\n`;
    msg += `📅 *Date & Time:* ${txn.date} ${txn.time}\n`;
    msg += `🛠️ *Service:* ${txn.serviceType}\n`;
    if (txn.customerName) msg += `👤 *Customer:* ${txn.customerName}\n`;
    if (txn.beneficiaryDetails) msg += `📌 *Details:* ${txn.beneficiaryDetails}\n`;
    if (txn.rrnOrUtr) msg += `🔢 *Operator Ref:* ${txn.rrnOrUtr}\n`;

    if (txn.voucherCode) {
      msg += `\n🔑 *PLAY STORE REDEEM CODE:*\n👉 \`${txn.voucherCode}\` 👈\n\n`;
      msg += `*How to Redeem on Android:*\n`;
      msg += `1. Open Google Play Store app.\n`;
      msg += `2. Tap profile icon (top right) -> Payments & subscriptions.\n`;
      msg += `3. Tap 'Redeem code' & paste the code above.\n`;
      msg += `4. Tap Confirm! 🎉\n\n`;
    }

    msg += `💰 *Bill Amount:* ${formatPaisa(txn.amountPaisa)}\n`;
    if (txn.customerFeePaisa > 0n) {
      msg += `🏷️ *Service Fee:* ${formatPaisa(txn.customerFeePaisa)}\n`;
    }
    msg += `💵 *Total Paid:* ${formatPaisa(txn.amountPaisa + txn.customerFeePaisa)}\n`;
    msg += `✅ *Status:* SUCCESS / COMPLETED\n`;
    msg += `----------------------------------------\n`;
    msg += `Thank you for choosing Sarkar Communication!`;

    const phone = txn.customerMobile ? txn.customerMobile.replace(/\D/g, "") : "";
    await sendWhatsAppMessage(phone, msg, (toastMsg) => {
      if (showToast) showToast(toastMsg);
    });
  };

  // Day Register Filter & Stats
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredRegister = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "ALL" && t.serviceType !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          t.id.toLowerCase().includes(q) ||
          (t.customerName && t.customerName.toLowerCase().includes(q)) ||
          (t.customerMobile && t.customerMobile.includes(q)) ||
          (t.beneficiaryDetails && t.beneficiaryDetails.toLowerCase().includes(q)) ||
          (t.rrnOrUtr && t.rrnOrUtr.toLowerCase().includes(q)) ||
          (t.voucherCode && t.voucherCode.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayTransactions = useMemo(() => transactions.filter((t) => t.date === todayStr), [transactions, todayStr]);

  const todayVolumePaisa = useMemo(() => {
    return todayTransactions.reduce((acc, t) => acc + t.amountPaisa, 0n);
  }, [todayTransactions]);

  const todayProfitPaisa = useMemo(() => {
    return todayTransactions.reduce((acc, t) => acc + t.netProfitPaisa, 0n);
  }, [todayTransactions]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & METRIC CARDS */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Digital Seva • BBPS, Recharges & Gaming Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  DR ≡ CR Sealed
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Electricity bills (WBSEDCL/CESC), FASTag, Mobile & DTH top-ups, and Free Fire/Google Play vouchers.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-right">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Today Volume</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{formatPaisa(todayVolumePaisa)}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-right">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Today Margin</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPaisa(todayProfitPaisa)}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-right">
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Orders</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{todayTransactions.length}</span>
            </div>
          </div>
        </div>

        {/* 1-Tap Quick Portals Setup Ribbon */}
        {portalAccounts.length === 0 && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No utility wallet or bank portal added yet. 1-Tap quick create to start processing:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COMMON_PORTALS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleQuickAddPortal(p)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB SELECTOR BAR */}
        <div className="mt-5 flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("utility")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "utility"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            1. BBPS Utility & FASTag
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("recharge")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "recharge"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            2. Mobile & DTH Recharge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gaming")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "gaming"
                ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            3. Free Fire & Google Play
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("register")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === "register"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Receipt className="w-4 h-4" />
            4. Digital Register & Void ({transactions.length})
          </button>
        </div>
      </div>

      {/* 2. TAB 1: BBPS UTILITY BILLS & FASTAG WORKSPACE */}
      {activeTab === "utility" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 8 COLS: BILL FORM */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-6 shadow-xs space-y-6">
            {/* Category Cards */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                Select Biller Category
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {[
                  { id: "ELECTRICITY", label: "Electricity", icon: <Zap className="w-4 h-4 text-amber-500" /> },
                  { id: "FASTAG", label: "FASTag Toll", icon: <Car className="w-4 h-4 text-sky-500" /> },
                  { id: "GAS", label: "LPG Gas", icon: <Flame className="w-4 h-4 text-rose-500" /> },
                  { id: "WATER", label: "Water Tax", icon: <Droplets className="w-4 h-4 text-blue-500" /> },
                  { id: "BROADBAND", label: "Broadband", icon: <Wifi className="w-4 h-4 text-purple-500" /> },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setUtilityCat(cat.id as UtilityCategory)}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      utilityCat === cat.id
                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black shadow-xs ring-1 ring-indigo-500/30"
                        : "border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-600 dark:text-slate-300 font-semibold"
                    }`}
                  >
                    {cat.icon}
                    <span className="text-[11px] leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Biller Provider Selector */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Provider / Board
              </label>
              <select
                value={utilityBillerId}
                onChange={(e) => setUtilityBillerId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {BILLER_PRESETS[utilityCat].map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SMS Scan-Fill Accordion */}
            <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  SMS / Web Confirmation Scan-Fill
                </span>
                {utilityScanNotice && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {utilityScanNotice}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste SMS: 'Bill paid Rs. 1250 for WBSEDCL Cons ID 102345678 Ref: 893201...'"
                  value={utilityScanText}
                  onChange={(e) => setUtilityScanText(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleParseUtilitySms}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Scan-Fill
                </button>
              </div>
            </div>

            {/* Bill Form Fields */}
            <form onSubmit={handleProcessUtilityBill} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>{currentBiller.idLabel} *</span>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. {currentBiller.example}</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Enter ${currentBiller.idLabel}`}
                    value={utilityConsumerNo}
                    onChange={(e) => setUtilityConsumerNo(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Name (Khata Linked)
                  </label>
                  <input
                    type="text"
                    list="bbps-customers-list"
                    placeholder="Enter Customer Name"
                    value={utilityCustomerName}
                    onChange={(e) => setUtilityCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="bbps-customers-list">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.phone ? `Mob: ${c.phone}` : ""}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Mobile No
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={utilityCustomerMobile}
                    onChange={(e) => setUtilityCustomerMobile(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Bill Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min={1}
                      step="any"
                      placeholder="0.00"
                      value={utilityAmount}
                      onChange={(e) => setUtilityAmount(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={utilityCustomerFee}
                      onChange={(e) => setUtilityCustomerFee(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {["0", "5", "10", "20", "50"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setUtilityCustomerFee(f)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                          utilityCustomerFee === f ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        ₹{f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inward Tender & Outward Funding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Payment Mode (Inward)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "SEPARATE_CASH", label: "Cash Drawer" },
                      { id: "UPI_QR", label: "Counter QR" },
                      { id: "KHATA", label: "Khata Due" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setUtilityInwardMode(m.id as FeeCollectionMode)}
                        className={`py-2 px-2 text-[11px] rounded-xl font-bold border transition cursor-pointer text-center ${
                          utilityInwardMode === m.id
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Funding Source (Outward Portal / Bank) *
                  </label>
                  <select
                    value={utilitySourceId}
                    onChange={(e) => setUtilitySourceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {portalAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPaisa(a.currentBalancePaisa)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Portal Cashback / Comm (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={utilityCashback}
                    onChange={(e) => setUtilityCashback(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Biller Operator Ref / UTR
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TXN9823019284"
                    value={utilityOperatorRef}
                    onChange={(e) => setUtilityOperatorRef(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Record Bill Payment • Total Inward {formatPaisa(utilityCustomerTotalPaisa)}
              </button>
            </form>
          </div>

          {/* RIGHT 4 COLS: LIVE DOUBLE-ENTRY AUDIT */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Double-Entry Audit</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DR ≡ CR Sealed
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Customer Tender Inward:</span>
                  <span className="font-mono font-bold text-white">{formatPaisa(utilityCustomerTotalPaisa)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Outward Portal Cost:</span>
                  <span className="font-mono font-bold text-rose-400">-{formatPaisa(utilityOutwardCostPaisa)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-emerald-400">Net Shop Margin:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">+{formatPaisa(utilityNetProfitPaisa)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] space-y-1">
                <div className="font-bold text-slate-300">Accounting Invariant:</div>
                <div className="text-slate-400 font-mono text-[10px]">
                  DR Inward ({utilityInwardMode}): +{formatPaisa(utilityCustomerTotalPaisa)}<br />
                  CR Outward ({accounts.find((a) => a.id === utilitySourceId)?.name || "Portal"}): -{formatPaisa(utilityOutwardCostPaisa)}<br />
                  CR Revenue: +{formatPaisa(utilityNetProfitPaisa)}
                </div>
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-4 shadow-xs text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Custodial Pass-Through Integrity
              </span>
              <p className="text-[11px] leading-relaxed">
                Bill payments are pass-through custodial funds under Section 194N. Only the ₹{Number(utilityFeePaisa)/100} convenience fee and ₹{Number(utilityCashbackPaisa)/100} cashback are treated as shop taxable revenue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB 2: MOBILE & DTH RECHARGES WORKSPACE */}
      {activeTab === "recharge" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-6 shadow-xs space-y-6">
            {/* Top Toggle: Mobile vs DTH */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl max-w-xs">
              <button
                type="button"
                onClick={() => setRechargeType("MOBILE")}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rechargeType === "MOBILE"
                    ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile Topup
              </button>
              <button
                type="button"
                onClick={() => setRechargeType("DTH")}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rechargeType === "DTH"
                    ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                DTH Satellite
              </button>
            </div>

            {/* Operator Cards */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                {rechargeType === "MOBILE" ? "Mobile Operator" : "DTH Provider"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(rechargeType === "MOBILE" ? MOBILE_OPERATORS : DTH_OPERATORS).map((op) => {
                  const isSelected =
                    rechargeType === "MOBILE" ? selectedMobileOp === op.id : selectedDthOp === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        if (rechargeType === "MOBILE") setSelectedMobileOp(op.id);
                        else setSelectedDthOp(op.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-slate-900 dark:text-white shadow-xs ring-1 ring-sky-500/30 font-black"
                          : "border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-300 font-semibold"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs">{op.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                          {op.commPct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handleProcessRecharge} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>{rechargeType === "MOBILE" ? "10-Digit Mobile Number *" : "Subscriber ID *"}</span>
                    {rechargeType === "MOBILE" && (
                      <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                        {detectedCircle}
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={rechargeType === "MOBILE" ? 10 : 16}
                    placeholder={rechargeType === "MOBILE" ? "Enter Mobile Number" : "Enter Subscriber ID"}
                    value={rechargeTarget}
                    onChange={(e) => setRechargeTarget(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Name (Khata Linked)
                  </label>
                  <input
                    type="text"
                    list="bbps-customers-list"
                    placeholder="Enter Customer Name"
                    value={rechargeCustomerName}
                    onChange={(e) => setRechargeCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Popular Packs Bar */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Popular Plans / Slabs
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {(rechargeType === "MOBILE" ? POPULAR_MOBILE_PACKS : POPULAR_DTH_PACKS).map((pack) => (
                    <button
                      key={pack.amt}
                      type="button"
                      onClick={() => setRechargeAmount(pack.amt)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center ${
                        rechargeAmount === pack.amt
                          ? "border-sky-500 bg-sky-500 text-white font-black shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs font-black">₹{pack.amt}</span>
                      <span className="text-[9px] truncate w-full mt-0.5 opacity-80">{pack.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Recharge MRP (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min={10}
                      step="any"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Convenience Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={rechargeCustomerFee}
                      onChange={(e) => setRechargeCustomerFee(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {["0", "5", "10", "20"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setRechargeCustomerFee(f)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                          rechargeCustomerFee === f ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        ₹{f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Operator Commission (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={rechargeCommissionOverride}
                      onChange={(e) => setRechargeCommissionOverride(e.target.value)}
                      placeholder={(Number(rechargeDefaultCommissionPaisa) / 100).toFixed(2)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">
                    Default {activeOpObj.commPct}%: {formatPaisa(rechargeDefaultCommissionPaisa)} • Net: {formatPaisa(rechargeNetProfitPaisa)}
                    {rechargeCommissionOverride.trim() !== "" && (
                      <button type="button" onClick={() => setRechargeCommissionOverride("")} className="ml-1.5 text-emerald-600 font-bold hover:underline cursor-pointer">
                        Reset
                      </button>
                    )}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Operator Ref / Txn ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OP892301"
                    value={rechargeOperatorRef}
                    onChange={(e) => setRechargeOperatorRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* Inward & Outward Accounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Payment Mode (Inward)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "SEPARATE_CASH", label: "Cash Drawer" },
                      { id: "UPI_QR", label: "Counter QR" },
                      { id: "KHATA", label: "Khata Due" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRechargeInwardMode(m.id as FeeCollectionMode)}
                        className={`py-2 px-2 text-[11px] rounded-xl font-bold border transition cursor-pointer text-center ${
                          rechargeInwardMode === m.id
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Funding Source (LAPU / Portal / Bank) *
                  </label>
                  <select
                    value={rechargeSourceId}
                    onChange={(e) => setRechargeSourceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {portalAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPaisa(a.currentBalancePaisa)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black text-sm shadow-md shadow-sky-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Process Recharge • Collect {formatPaisa(rechargeCustomerTotalPaisa)}
              </button>
            </form>
          </div>

          {/* Right 4 Cols: Live Audit */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recharge Audit</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {activeOpObj.commPct}% Commission
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Customer Tender Inward:</span>
                  <span className="font-mono font-bold text-white">{formatPaisa(rechargeCustomerTotalPaisa)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>LAPU / Portal Float Burn:</span>
                  <span className="font-mono font-bold text-rose-400">-{formatPaisa(rechargeOutwardCostPaisa)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Retailer Margin ({activeOpObj.commPct}%):</span>
                  <span className="font-mono font-bold text-emerald-400">+{formatPaisa(rechargeCommissionPaisa)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-emerald-400">Total Net Margin:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">+{formatPaisa(rechargeNetProfitPaisa)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 3: FREE FIRE & GOOGLE PLAY GAMING HUB */}
      {activeTab === "gaming" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-6 shadow-xs space-y-6">
            {/* Gaming Platform Picker */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                Gaming Title / Platform
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "FREE_FIRE", name: "Free Fire Max", icon: "🔥", color: "from-amber-500 to-orange-600" },
                  { id: "BGMI", name: "BGMI Battlegrounds", icon: "🪖", color: "from-emerald-600 to-teal-700" },
                  { id: "GOOGLE_PLAY", name: "Google Play Store", icon: "🎮", color: "from-blue-600 to-indigo-600" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setGamingPlatform(p.id as GamePlatform)}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      gamingPlatform === p.id
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-black shadow-xs ring-1 ring-purple-500/30"
                        : "border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-600 dark:text-slate-300 font-semibold"
                    }`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-xs font-bold">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gaming Slabs Cards */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Popular Denominations & Packs
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {GAMING_PACKS[gamingPlatform].map((pack) => (
                  <button
                    key={pack.amt}
                    type="button"
                    onClick={() => setGamingAmount(pack.amt)}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center ${
                      gamingAmount === pack.amt
                        ? "border-purple-500 bg-purple-600 text-white font-black shadow-xs"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xs font-black">₹{pack.amt}</span>
                    <span className="text-[9px] truncate w-full mt-0.5 opacity-80">{pack.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voucher Code Generator Banner */}
            <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl border border-purple-700/60 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4 text-purple-400" />
                  16-Character Redeem Code Generator
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={generateVoucherCode}
                    className="px-2.5 py-1 rounded-lg bg-purple-700/80 hover:bg-purple-600 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Dice5 className="w-3.5 h-3.5" />
                    Randomize
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(gamingVoucherCode);
                      alert("Copied code to clipboard!");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-700/80 hover:bg-purple-600 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="text"
                  required
                  value={gamingVoucherCode}
                  onChange={(e) => setGamingVoucherCode(e.target.value.toUpperCase())}
                  className="w-full text-center py-2 px-3 bg-purple-950/80 border border-purple-500/50 rounded-xl text-lg font-black tracking-widest font-mono text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Inputs */}
            <form onSubmit={handleProcessGamingVoucher} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Gamer / Customer Name
                  </label>
                  <input
                    type="text"
                    list="bbps-customers-list"
                    placeholder="Enter Gamer Name"
                    value={gamingPlayerName}
                    onChange={(e) => setGamingPlayerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    WhatsApp Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={gamingPlayerMobile}
                    onChange={(e) => setGamingPlayerMobile(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Gamer UID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2938472910"
                    value={gamingPlayerUid}
                    onChange={(e) => setGamingPlayerUid(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Voucher MRP (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min={10}
                      step="any"
                      value={gamingAmount}
                      onChange={(e) => setGamingAmount(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Convenience Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={gamingCustomerFee}
                      onChange={(e) => setGamingCustomerFee(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Shop Purchase Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={gamingDiscountPaisa}
                    onChange={(e) => setGamingDiscountPaisa(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* Inward & Outward */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Customer Payment Mode (Inward)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "SEPARATE_CASH", label: "Cash Drawer" },
                      { id: "UPI_QR", label: "Counter QR" },
                      { id: "KHATA", label: "Khata Due" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGamingInwardMode(m.id as FeeCollectionMode)}
                        className={`py-2 px-2 text-[11px] rounded-xl font-bold border transition cursor-pointer text-center ${
                          gamingInwardMode === m.id
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Funding Source (Bank / Card / Portal) *
                  </label>
                  <select
                    value={gamingSourceId}
                    onChange={(e) => setGamingSourceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {portalAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPaisa(a.currentBalancePaisa)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-sm shadow-md shadow-purple-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Issue Voucher & Collect {formatPaisa(gamingCustomerTotalPaisa)}
              </button>
            </form>
          </div>

          {/* Right 4 Cols: Live Audit */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gaming Voucher Audit</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  DR ≡ CR Sealed
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Customer Tender Inward:</span>
                  <span className="font-mono font-bold text-white">{formatPaisa(gamingCustomerTotalPaisa)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Funding Source Outward:</span>
                  <span className="font-mono font-bold text-rose-400">-{formatPaisa(gamingOutwardCostPaisa)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-emerald-400">Net Shop Margin:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">+{formatPaisa(gamingNetProfitPaisa)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 4: DIGITAL REGISTER & VOID REVERSAL */}
      {activeTab === "register" && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter:</span>
              {["ALL", "UTILITY_BILL", "RECHARGE", "FASTAG", "GOOGLE_PLAY"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    filterType === f
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {f === "ALL" ? "All Services" : f}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ID, customer, ref, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">Txn ID / Time</th>
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">Customer / Details</th>
                  <th className="py-3 px-3 text-right">Face Amount</th>
                  <th className="py-3 px-3 text-right">Net Margin</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Receipt & Void</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No digital transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map((txn) => {
                    const isVoid = txn.status === "VOID";
                    return (
                      <tr key={txn.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${isVoid ? "opacity-60 bg-rose-50/20" : ""}`}>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">{txn.id}</div>
                          <div className="text-[10px] text-slate-400">{txn.date} • {txn.time}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                            {txn.serviceType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {txn.customerName || txn.customerMobile || "Walk-in Customer"}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">
                            {txn.beneficiaryDetails || txn.voucherCode || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatPaisa(txn.amountPaisa)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatPaisa(txn.netProfitPaisa)}
                        </td>
                        <td className="py-3 px-3">
                          {isVoid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              [VOID]
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              SUCCESS
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="Print Thermal 80mm"
                              onClick={() => handlePrintThermal(txn)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Download PDF"
                              onClick={() => handleDownloadPdf(txn)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="WhatsApp Slip"
                              onClick={() => handleShareWhatsApp(txn)}
                              className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            {onVoidDigitalTransaction && !isVoid && (
                              <button
                                type="button"
                                title="Void & Reverse Ledger"
                                onClick={() => {
                                  if (confirm(`Void transaction ${txn.id}? This will reverse drawer cash and portal balances.`)) {
                                    onVoidDigitalTransaction(txn.id);
                                    setTransactions((prev) =>
                                      prev.map((t) => (t.id === txn.id ? { ...t, status: "VOID" } : t))
                                    );
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* 6. SUCCESS RECEIPT DIALOG MODAL */}
      {completedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {completedTxn.serviceType} Recorded Successfully!
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Receipt #{completedTxn.id} • {completedTxn.date} {completedTxn.time}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2 text-xs border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedTxn.serviceType}</span>
              </div>
              {completedTxn.customerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{completedTxn.customerName}</span>
                </div>
              )}
              {completedTxn.beneficiaryDetails && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Details:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">
                    {completedTxn.beneficiaryDetails}
                  </span>
                </div>
              )}
              {completedTxn.voucherCode && (
                <div className="p-2.5 bg-purple-900 text-amber-300 font-mono font-black text-center rounded-lg text-sm tracking-wider">
                  {completedTxn.voucherCode}
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-black text-sm">
                <span>Total Collected:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatPaisa(completedTxn.amountPaisa + completedTxn.customerFeePaisa)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePrintThermal(completedTxn)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Thermal 80mm
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(completedTxn)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                PDF Slip
              </button>
              <button
                type="button"
                onClick={() => handleShareWhatsApp(completedTxn)}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedTxn(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
