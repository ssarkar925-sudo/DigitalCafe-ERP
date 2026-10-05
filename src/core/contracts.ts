/**
 * src/core/contracts.ts
 * Core contracts, data interfaces, and initial zero-data definitions for DigitalCafe ERP.
 * 100% BigInt Integer Paisa Precision (₹1.00 = 100 Paisa).
 * ZERO PRELOADED FAKE/DEMO DATA.
 */

export type AccountType =
  | "CASH"          // Physical notes & coins in drawer
  | "BANK"          // Bank savings/current accounts (SBI, PNB, etc.)
  | "WALLET"        // Portal floats (Fino Mitra, DigiPay, Recharge portals)
  | "UPI_HOLDING"   // Merchant QR collections (Paytm, PhonePe Soundbox)
  | "CREDIT_CARD"   // Credit cards (HDFC, SBI Cashback, etc.)
  | "KHATA"         // Customer accounts receivable (Udhaar)
  | "INCOME"        // Commercial sales & commissions
  | "EXPENSE";      // Shop expenses & portal surcharges

export interface TreasuryAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currentBalancePaisa: bigint;
  isActive: boolean;
  metadata?: {
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    qrIdentifier?: string;
    portalName?: string;
    creditLimitPaisa?: bigint;
    [key: string]: any;
  };
}

export interface CreditCardItem {
  id: string;
  accountId: string;
  name: string;
  network: "VISA" | "MASTERCARD" | "RUPAY" | "AMEX";
  creditLimitPaisa: bigint;
  currentOutstandingPaisa: bigint;
  billingDay: number;
  dueDay: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  currentDuePaisa: bigint;
  creditLimitPaisa: bigint;
  createdAt?: string;
}

export type ItemKind = "SERVICE" | "GOODS";

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  kind: ItemKind;
  pricePaisa: bigint;
  costPricePaisa: bigint;
  currentStock: number;
  minStockAlert: number;
  hotkey?: string;
  icon: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPricePaisa: bigint;
  totalPaisa: bigint;
  kind?: ItemKind;
}

export type PaymentMethod = "CASH" | "UPI" | "KHATA" | "SPLIT";

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotalPaisa: bigint;
  discountPaisa: bigint;
  totalPaisa: bigint;
  paymentMethod: PaymentMethod;
  allocations?: {
    method: "CASH" | "UPI" | "KHATA";
    amountPaisa: bigint;
    accountId?: string;
    customerId?: string;
  }[];
  status: "PAID" | "REFUNDED" | "VOID";
}

export type StockMovementType = "PURCHASE_IN" | "SALE_OUT" | "INTERNAL_USE" | "SCRAP_ADJUSTMENT";

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  time: string;
  type: StockMovementType;
  quantityChange: number;
  unitCostPaisa: bigint;
  totalCostPaisa: bigint;
  fundingAccountId?: string;
  supplierName?: string;
  notes?: string;
}

export interface KhataSettlement {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  time: string;
  amountPaisa: bigint;
  previousDuePaisa: bigint;
  remainingDuePaisa: bigint;
  paymentMethod: "CASH" | "UPI";
  receivingAccountId: string;
  receivingAccountName: string;
  notes?: string;
}

export type DigitalServiceType =
  | "AEPS"
  | "DMT"
  | "UPI_CASHOUT"
  | "RECHARGE"
  | "UTILITY_BILL"
  | "FASTAG"
  | "GOOGLE_PLAY";

export type FeeCollectionMode =
  | "CUT_FROM_CASH"
  | "SEPARATE_CASH"
  | "UPI_QR"
  | "KHATA"
  | "INCLUDED_IN_QR";

export interface DigitalTransaction {
  id: string;
  date: string;
  time: string;
  serviceType: DigitalServiceType;
  customerName?: string;
  customerMobile?: string;
  beneficiaryDetails?: string;
  amountPaisa: bigint;
  customerFeePaisa: bigint;
  portalCommissionPaisa: bigint;
  portalSurchargePaisa: bigint;
  netProfitPaisa: bigint;
  feeCollectionMode: FeeCollectionMode;
  sourceAccountId: string;
  sourceAccountName?: string;
  inwardAccountId?: string;
  inwardAccountName?: string;
  rrnOrUtr?: string;
  voucherCode?: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "VOID";
}

export interface CashBookEntry {
  id: string;
  date: string;
  time: string;
  description: string;
  type: "IN" | "OUT";
  amountPaisa: bigint;
  runningBalancePaisa: bigint;
  category:
    | "POS_SALE"
    | "AEPS_PAYOUT"
    | "AEPS_FEE"
    | "DMT_CASH_IN"
    | "UPI_CASHOUT_PAYOUT"
    | "EXPENSE"
    | "CONTRA_TRANSFER"
    | "KHATA_PAYMENT"
    | "VOID_REVERSAL"
    | "UTILITY_BILL_CASH"
    | "RECHARGE_CASH"
    | "GAMING_CASH";
  referenceId?: string;
}

export interface NoteDenominations {
  n500: number;
  n200: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  coinsPaisa: bigint;
}

export interface DayCloseAudit {
  id: string;
  date: string;
  time: string;
  openingCashPaisa: bigint;
  systemExpectedCashPaisa: bigint;
  physicalCountedCashPaisa: bigint;
  variancePaisa: bigint;
  denominations: NoteDenominations;
  notes?: string;
}

// ==============================================================================
// ZERO-DATA INITIAL STATE (Starting clean with ₹0.00 balances)
// ==============================================================================

export const INITIAL_ACCOUNTS: TreasuryAccount[] = [
  {
    id: "acc-cash",
    code: "1010",
    name: "Shop Cash Drawer",
    type: "CASH",
    currentBalancePaisa: 0n,
    isActive: true,
  },
  {
    id: "acc-revenue",
    code: "4010",
    name: "Services & Sales Revenue",
    type: "INCOME",
    currentBalancePaisa: 0n,
    isActive: true,
  },
  {
    id: "acc-commissions",
    code: "4020",
    name: "AEPS & CSP Commission Income",
    type: "INCOME",
    currentBalancePaisa: 0n,
    isActive: true,
  },
  {
    id: "acc-expenses",
    code: "5010",
    name: "Shop General Expenses",
    type: "EXPENSE",
    currentBalancePaisa: 0n,
    isActive: true,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_CATALOG_ITEMS: CatalogItem[] = [];
export const INITIAL_CREDIT_CARDS: CreditCardItem[] = [];
