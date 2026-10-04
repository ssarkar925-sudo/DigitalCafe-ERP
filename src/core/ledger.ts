/**
 * src/core/ledger.ts
 * Core double-entry & passbook statement accounting engine for DigitalCafe ERP.
 * 100% BigInt Integer Paisa Precision.
 * Verified against Indian CSP & Cyber Cafe counter standards.
 */

import { TreasuryAccount, FeeCollectionMode } from "./contracts";

export interface JournalLine {
  accountId: string;
  accountName: string;
  accountType: string;
  debitPaisa: bigint;  // DR (Outflow / Money Deducted from Asset or Expense Incurred)
  creditPaisa: bigint; // CR (Inflow / Money Added to Asset or Revenue Earned)
  narration?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  time?: string;
  sourceType: "POS_SALE" | "AEPS" | "DMT" | "UPI_CASHOUT" | "RECHARGE_BILL" | "CONTRA_TRANSFER" | "EXPENSE" | "KHATA_SETTLEMENT";
  sourceId: string;
  narration: string;
  lines: JournalLine[];
}

/**
 * Validate that a passbook statement entry is 100% mathematically balanced:
 * Net Liquid Movement (Asset Credits - Asset Debits) === Net Income Earned
 */
export function isJournalBalanced(entry: JournalEntry): boolean {
  let assetCredits = 0n;
  let assetDebits = 0n;
  let incomeCredits = 0n;

  for (const line of entry.lines) {
    if (line.accountType === "INCOME") {
      incomeCredits += line.creditPaisa;
    } else {
      assetCredits += line.creditPaisa;
      assetDebits += line.debitPaisa;
    }
  }

  // Net Liquid Asset Increase must equal Net Profit Earned
  return (assetCredits - assetDebits) === incomeCredits;
}

// ==============================================================================
// 1. AEPS CASH WITHDRAWAL JOURNAL
// Passbook Math:
// CR Portal Wallet: +(A + C) (Amount + Portal Commission)
// DR Cash Drawer: -(Cash Handed)
// CR Commission Income: +(Drawer Fee F + Portal Commission C)
// ==============================================================================
export function createAepsJournal(params: {
  txnId: string;
  date: string;
  time?: string;
  amountPaisa: bigint;             // A: Customer withdrawn amount
  portalCommissionPaisa: bigint;   // C: Credited by portal
  customerFeePaisa: bigint;        // F: Counter fee charged to customer
  feeMode: FeeCollectionMode;
  cashAccount: TreasuryAccount;
  portalAccount: TreasuryAccount;
  commissionAccount: TreasuryAccount;
  qrAccount?: TreasuryAccount;
  customerKhataAccountId?: string;
}): JournalEntry {
  const {
    txnId,
    date,
    time,
    amountPaisa,
    portalCommissionPaisa,
    customerFeePaisa,
    feeMode,
    cashAccount,
    portalAccount,
    commissionAccount,
    qrAccount,
    customerKhataAccountId,
  } = params;

  const lines: JournalLine[] = [];
  const totalPortalCredit = amountPaisa + portalCommissionPaisa;
  const totalCommissionEarned = customerFeePaisa + portalCommissionPaisa;

  // 1. Portal Wallet receives Amount + Portal Commission
  lines.push({
    accountId: portalAccount.id,
    accountName: portalAccount.name,
    accountType: portalAccount.type,
    debitPaisa: 0n,
    creditPaisa: totalPortalCredit,
    narration: `AEPS Inward: ₹${Number(amountPaisa) / 100} + Portal Comm ₹${Number(portalCommissionPaisa) / 100}`,
  });

  // 2. Commission Income receives total earnings (split: Drawer Fee + Portal Comm)
  lines.push({
    accountId: commissionAccount.id,
    accountName: commissionAccount.name,
    accountType: commissionAccount.type,
    debitPaisa: 0n,
    creditPaisa: totalCommissionEarned,
    narration: `AEPS Profit: Fee ₹${Number(customerFeePaisa) / 100} + Portal ₹${Number(portalCommissionPaisa) / 100}`,
  });

  // 3. Handle the 4 Fee Modes for Cash Drawer and other accounts
  if (feeMode === "CUT_FROM_CASH") {
    // Handed to customer: A - F
    const cashHanded = amountPaisa - customerFeePaisa;
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: cashHanded,
      creditPaisa: 0n,
      narration: `AEPS Cash Handed (after ₹${Number(customerFeePaisa) / 100} fee cut)`,
    });
  } else if (feeMode === "SEPARATE_CASH") {
    // Handed to customer: A (Payout DR)
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: amountPaisa,
      creditPaisa: 0n,
      narration: `AEPS Cash Payout to Customer`,
    });
    // Customer gives separate cash: F (Fee in CR)
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: customerFeePaisa,
      narration: `AEPS Separate Cash Fee In`,
    });
  } else if (feeMode === "UPI_QR") {
    // Handed to customer: A from drawer
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: amountPaisa,
      creditPaisa: 0n,
      narration: `AEPS Cash Handed to Customer`,
    });
    // Fee received via QR
    const destQr = qrAccount || cashAccount;
    lines.push({
      accountId: destQr.id,
      accountName: destQr.name,
      accountType: destQr.type,
      debitPaisa: 0n,
      creditPaisa: customerFeePaisa,
      narration: `AEPS Customer Fee collected via UPI QR`,
    });
  } else if (feeMode === "KHATA") {
    // Handed to customer: A from drawer
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: amountPaisa,
      creditPaisa: 0n,
      narration: `AEPS Cash Handed to Customer`,
    });
    // Fee added to Khata
    lines.push({
      accountId: customerKhataAccountId || "acc-khata",
      accountName: "Customer Khata (Udhaar)",
      accountType: "KHATA",
      debitPaisa: 0n,
      creditPaisa: customerFeePaisa,
      narration: `AEPS Customer Fee added to Khata Due`,
    });
  }

  return {
    id: `JRN-AEPS-${txnId}`,
    date,
    time,
    sourceType: "AEPS",
    sourceId: txnId,
    narration: `AEPS Biometric Cash Out #${txnId}`,
    lines,
  };
}

// ==============================================================================
// 2. DMT (DOMESTIC MONEY TRANSFER) JOURNAL
// Passbook Math:
// DR Source (Portal/Bank): -(Amount + Surcharge)
// CR Cash Drawer: +(Cash Inward)
// CR Net DMT Profit: +(Customer Fee F - Portal Surcharge S)
// ==============================================================================
export function createDmtJournal(params: {
  txnId: string;
  date: string;
  time?: string;
  amountPaisa: bigint;
  portalSurchargePaisa: bigint;
  customerFeePaisa: bigint;
  feeMode: FeeCollectionMode;
  sourceAccount: TreasuryAccount; // Portal Wallet or Bank App
  cashAccount: TreasuryAccount;
  commissionAccount: TreasuryAccount;
  qrAccount?: TreasuryAccount;
  customerKhataAccountId?: string;
}): JournalEntry {
  const {
    txnId,
    date,
    time,
    amountPaisa,
    portalSurchargePaisa,
    customerFeePaisa,
    feeMode,
    sourceAccount,
    cashAccount,
    commissionAccount,
    qrAccount,
    customerKhataAccountId,
  } = params;

  const lines: JournalLine[] = [];
  const netProfit = customerFeePaisa - portalSurchargePaisa;

  if (feeMode === "SEPARATE_CASH") {
    // Drawer receives Amount + Fee in cash
    const cashIn = amountPaisa + customerFeePaisa;
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: cashIn,
      narration: `DMT Cash Received (Transfer ₹${Number(amountPaisa) / 100} + Fee ₹${Number(customerFeePaisa) / 100})`,
    });
    // Source Account loses Amount + Surcharge
    const sourceDeduction = amountPaisa + portalSurchargePaisa;
    lines.push({
      accountId: sourceAccount.id,
      accountName: sourceAccount.name,
      accountType: sourceAccount.type,
      debitPaisa: sourceDeduction,
      creditPaisa: 0n,
      narration: `DMT Sent via ${sourceAccount.name} + Surcharge ₹${Number(portalSurchargePaisa) / 100}`,
    });
  } else if (feeMode === "CUT_FROM_CASH") {
    // Drawer receives full Amount A
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: amountPaisa,
      narration: `DMT Cash Received at Counter`,
    });
    // Transferred amount is A - F
    const transferSent = amountPaisa - customerFeePaisa;
    const sourceDeduction = transferSent + portalSurchargePaisa;
    lines.push({
      accountId: sourceAccount.id,
      accountName: sourceAccount.name,
      accountType: sourceAccount.type,
      debitPaisa: sourceDeduction,
      creditPaisa: 0n,
      narration: `DMT Sent (₹${Number(transferSent) / 100} after fee cut) + Surcharge`,
    });
  } else if (feeMode === "UPI_QR") {
    // Drawer receives transfer amount in cash
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: amountPaisa,
      narration: `DMT Transfer Principal Cash in Drawer`,
    });
    // Fee received in QR
    const destQr = qrAccount || cashAccount;
    lines.push({
      accountId: destQr.id,
      accountName: destQr.name,
      accountType: destQr.type,
      debitPaisa: 0n,
      creditPaisa: customerFeePaisa,
      narration: `DMT Fee collected via UPI QR`,
    });
    // Source loses Amount + Surcharge
    lines.push({
      accountId: sourceAccount.id,
      accountName: sourceAccount.name,
      accountType: sourceAccount.type,
      debitPaisa: amountPaisa + portalSurchargePaisa,
      creditPaisa: 0n,
      narration: `DMT Sent + Surcharge`,
    });
  } else if (feeMode === "KHATA") {
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: amountPaisa,
      narration: `DMT Principal Cash in Drawer`,
    });
    lines.push({
      accountId: customerKhataAccountId || "acc-khata",
      accountName: "Customer Khata (Udhaar)",
      accountType: "KHATA",
      debitPaisa: 0n,
      creditPaisa: customerFeePaisa,
      narration: `DMT Fee added to Khata Due`,
    });
    lines.push({
      accountId: sourceAccount.id,
      accountName: sourceAccount.name,
      accountType: sourceAccount.type,
      debitPaisa: amountPaisa + portalSurchargePaisa,
      creditPaisa: 0n,
      narration: `DMT Sent + Surcharge`,
    });
  }

  // Net Profit entry
  lines.push({
    accountId: commissionAccount.id,
    accountName: commissionAccount.name,
    accountType: commissionAccount.type,
    debitPaisa: 0n,
    creditPaisa: netProfit,
    narration: `DMT Net Margin (Fee ₹${Number(customerFeePaisa) / 100} - Surcharge ₹${Number(portalSurchargePaisa) / 100})`,
  });

  return {
    id: `JRN-DMT-${txnId}`,
    date,
    time,
    sourceType: "DMT",
    sourceId: txnId,
    narration: `DMT Money Transfer #${txnId}`,
    lines,
  };
}

// ==============================================================================
// 3. UPI CASH OUT (QR CASH WITHDRAWAL) JOURNAL
// Passbook Math:
// CR QR / Bank: +(QR Amount)
// DR Cash Drawer: -(Cash Handed)
// CR Fee Income: +(Shop Fee)
// ==============================================================================
export function createUpiCashoutJournal(params: {
  txnId: string;
  date: string;
  time?: string;
  cashAmountPaisa: bigint;       // Cash customer needs
  feePaisa: bigint;              // Shop fee
  feeMode: FeeCollectionMode;
  cashAccount: TreasuryAccount;
  qrAccount: TreasuryAccount;
  feeIncomeAccount: TreasuryAccount;
  customerKhataAccountId?: string;
}): JournalEntry {
  const {
    txnId,
    date,
    time,
    cashAmountPaisa,
    feePaisa,
    feeMode,
    cashAccount,
    qrAccount,
    feeIncomeAccount,
    customerKhataAccountId,
  } = params;

  const lines: JournalLine[] = [];

  // Fee Income
  lines.push({
    accountId: feeIncomeAccount.id,
    accountName: feeIncomeAccount.name,
    accountType: feeIncomeAccount.type,
    debitPaisa: 0n,
    creditPaisa: feePaisa,
    narration: `UPI Cash-Out Fee Margin`,
  });

  if (feeMode === "INCLUDED_IN_QR") {
    // QR receives Amount + Fee
    lines.push({
      accountId: qrAccount.id,
      accountName: qrAccount.name,
      accountType: qrAccount.type,
      debitPaisa: 0n,
      creditPaisa: cashAmountPaisa + feePaisa,
      narration: `UPI Cash-Out QR Inward (Principal + Fee)`,
    });
    // Drawer hands out Amount
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: cashAmountPaisa,
      creditPaisa: 0n,
      narration: `Cash Handed to Customer`,
    });
  } else if (feeMode === "CUT_FROM_CASH") {
    // QR receives Amount
    lines.push({
      accountId: qrAccount.id,
      accountName: qrAccount.name,
      accountType: qrAccount.type,
      debitPaisa: 0n,
      creditPaisa: cashAmountPaisa,
      narration: `UPI Cash-Out QR Inward`,
    });
    // Drawer hands out Amount - Fee
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: cashAmountPaisa - feePaisa,
      creditPaisa: 0n,
      narration: `Cash Handed (after ₹${Number(feePaisa) / 100} fee cut)`,
    });
  } else if (feeMode === "SEPARATE_CASH") {
    // QR receives Amount
    lines.push({
      accountId: qrAccount.id,
      accountName: qrAccount.name,
      accountType: qrAccount.type,
      debitPaisa: 0n,
      creditPaisa: cashAmountPaisa,
      narration: `UPI Cash-Out QR Inward`,
    });
    // Drawer hands Amount
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: cashAmountPaisa,
      creditPaisa: 0n,
      narration: `Cash Handed to Customer`,
    });
    // Drawer receives separate Fee cash
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: 0n,
      creditPaisa: feePaisa,
      narration: `Separate Cash Fee In`,
    });
  } else if (feeMode === "KHATA") {
    lines.push({
      accountId: qrAccount.id,
      accountName: qrAccount.name,
      accountType: qrAccount.type,
      debitPaisa: 0n,
      creditPaisa: cashAmountPaisa,
      narration: `UPI Cash-Out QR Inward`,
    });
    lines.push({
      accountId: cashAccount.id,
      accountName: cashAccount.name,
      accountType: cashAccount.type,
      debitPaisa: cashAmountPaisa,
      creditPaisa: 0n,
      narration: `Cash Handed to Customer`,
    });
    lines.push({
      accountId: customerKhataAccountId || "acc-khata",
      accountName: "Customer Khata (Udhaar)",
      accountType: "KHATA",
      debitPaisa: 0n,
      creditPaisa: feePaisa,
      narration: `Fee added to Khata Due`,
    });
  }

  return {
    id: `JRN-CASHOUT-${txnId}`,
    date,
    time,
    sourceType: "UPI_CASHOUT",
    sourceId: txnId,
    narration: `UPI Cash Out (QR Withdrawal) #${txnId}`,
    lines,
  };
}

// ==============================================================================
// 4. RECHARGES, BBPS & UTILITY BILLS JOURNAL
// Dual Inward (Cash/QR/Khata) and Outward (Wallet/Bank/Credit Card/Cash)
// Net Profit = Customer Fee + Provider Cashback
// ==============================================================================
export function createRechargeUtilityJournal(params: {
  txnId: string;
  date: string;
  time?: string;
  serviceType: "RECHARGE" | "UTILITY_BILL" | "FASTAG" | "GOOGLE_PLAY";
  billOrFaceAmountPaisa: bigint;
  customerFeePaisa: bigint;
  providerCashbackPaisa: bigint;
  inwardAccount: TreasuryAccount;   // How customer paid: Cash / QR / Khata
  outwardAccount: TreasuryAccount;  // How you paid: Wallet / Bank / Credit Card
  incomeAccount: TreasuryAccount;
}): JournalEntry {
  const {
    txnId,
    date,
    time,
    serviceType,
    billOrFaceAmountPaisa,
    customerFeePaisa,
    providerCashbackPaisa,
    inwardAccount,
    outwardAccount,
    incomeAccount,
  } = params;

  const lines: JournalLine[] = [];
  const totalCustomerPaid = billOrFaceAmountPaisa + customerFeePaisa;
  const netOutwardCost = billOrFaceAmountPaisa - providerCashbackPaisa;
  const netProfit = customerFeePaisa + providerCashbackPaisa;

  // 1. Inward Account receives Customer Payment
  lines.push({
    accountId: inwardAccount.id,
    accountName: inwardAccount.name,
    accountType: inwardAccount.type,
    debitPaisa: 0n,
    creditPaisa: totalCustomerPaid,
    narration: `${serviceType} Inward from Customer`,
  });

  // 2. Outward Account pays Provider Cost
  lines.push({
    accountId: outwardAccount.id,
    accountName: outwardAccount.name,
    accountType: outwardAccount.type,
    debitPaisa: netOutwardCost,
    creditPaisa: 0n,
    narration: `${serviceType} Outward via ${outwardAccount.name}`,
  });

  // 3. Profit earned
  lines.push({
    accountId: incomeAccount.id,
    accountName: incomeAccount.name,
    accountType: incomeAccount.type,
    debitPaisa: 0n,
    creditPaisa: netProfit,
    narration: `${serviceType} Margin (Fee ₹${Number(customerFeePaisa) / 100} + Cashback ₹${Number(providerCashbackPaisa) / 100})`,
  });

  return {
    id: `JRN-${serviceType}-${txnId}`,
    date,
    time,
    sourceType: "RECHARGE_BILL",
    sourceId: txnId,
    narration: `${serviceType} Transaction #${txnId}`,
    lines,
  };
}

// ==============================================================================
// 5. COUNTER POS SALE JOURNAL
// Handles Cash, QR, Khata, and Split allocations
// ==============================================================================
export function createPosSaleJournal(params: {
  invoiceNumber: string;
  date: string;
  time?: string;
  totalPaisa: bigint;
  salesRevenueAccount: TreasuryAccount;
  allocations: {
    account: { id: string; name: string; type: string };
    amountPaisa: bigint;
  }[];
}): JournalEntry {
  const { invoiceNumber, date, time, totalPaisa, salesRevenueAccount, allocations } = params;

  const lines: JournalLine[] = [];

  // Inward allocations
  for (const alloc of allocations) {
    if (alloc.amountPaisa > 0n) {
      lines.push({
        accountId: alloc.account.id,
        accountName: alloc.account.name,
        accountType: alloc.account.type,
        debitPaisa: 0n,
        creditPaisa: alloc.amountPaisa,
        narration: `POS Sale Inward #${invoiceNumber}`,
      });
    }
  }

  // Credit Sales Revenue
  lines.push({
    accountId: salesRevenueAccount.id,
    accountName: salesRevenueAccount.name,
    accountType: salesRevenueAccount.type,
    debitPaisa: 0n,
    creditPaisa: totalPaisa,
    narration: `Counter POS Sales Revenue #${invoiceNumber}`,
  });

  return {
    id: `JRN-POS-${invoiceNumber}`,
    date,
    time,
    sourceType: "POS_SALE",
    sourceId: invoiceNumber,
    narration: `Counter POS Sale #${invoiceNumber}`,
    lines,
  };
}

// ==============================================================================
// 6. UNIVERSAL CONTRA MOVE MONEY (INTERNAL TRANSFERS)
// Moving money between Drawer, Bank, Wallets, and Cards without touching sales
// ==============================================================================
export function createContraTransferJournal(params: {
  transferId: string;
  date: string;
  time?: string;
  amountPaisa: bigint;
  fromAccount: TreasuryAccount;
  toAccount: TreasuryAccount;
  note?: string;
}): JournalEntry {
  const { transferId, date, time, amountPaisa, fromAccount, toAccount, note } = params;

  return {
    id: `JRN-CONTRA-${transferId}`,
    date,
    time,
    sourceType: "CONTRA_TRANSFER",
    sourceId: transferId,
    narration: note || `Contra Move Money: ${fromAccount.name} -> ${toAccount.name}`,
    lines: [
      {
        accountId: fromAccount.id,
        accountName: fromAccount.name,
        accountType: fromAccount.type,
        debitPaisa: amountPaisa,
        creditPaisa: 0n,
        narration: `Contra Outflow from ${fromAccount.name}`,
      },
      {
        accountId: toAccount.id,
        accountName: toAccount.name,
        accountType: toAccount.type,
        debitPaisa: 0n,
        creditPaisa: amountPaisa,
        narration: `Contra Inflow to ${toAccount.name}`,
      },
    ],
  };
}

// ==============================================================================
// 7. SHOP EXPENSES & VOUCHERS JOURNAL
// ==============================================================================
export function createExpenseJournal(params: {
  expenseId: string;
  date: string;
  time?: string;
  amountPaisa: bigint;
  sourceAccount: TreasuryAccount;
  expenseAccount: TreasuryAccount;
  category: string;
  paidTo?: string;
  note?: string;
}): JournalEntry {
  const { expenseId, date, time, amountPaisa, sourceAccount, expenseAccount, category, paidTo, note } = params;

  return {
    id: `JRN-EXP-${expenseId}`,
    date,
    time,
    sourceType: "EXPENSE",
    sourceId: expenseId,
    narration: note || `Shop Expense: ${category} paid to ${paidTo || "Vendor"}`,
    lines: [
      {
        accountId: sourceAccount.id,
        accountName: sourceAccount.name,
        accountType: sourceAccount.type,
        debitPaisa: amountPaisa,
        creditPaisa: 0n,
        narration: `Paid from ${sourceAccount.name}`,
      },
      {
        accountId: expenseAccount.id,
        accountName: expenseAccount.name,
        accountType: expenseAccount.type,
        debitPaisa: 0n,
        creditPaisa: amountPaisa,
        narration: `Expense Incurred: ${category}`,
      },
    ],
  };
}

// ==============================================================================
// 8. KHATA PAYMENT SETTLEMENT JOURNAL
// Customer clears udhaar via Cash or UPI QR
// ==============================================================================
export function createKhataSettlementJournal(params: {
  settlementId: string;
  date: string;
  time?: string;
  amountPaisa: bigint;
  customerName: string;
  receivingAccount: TreasuryAccount; // Cash Drawer or Bank/QR
}): JournalEntry {
  const { settlementId, date, time, amountPaisa, customerName, receivingAccount } = params;

  return {
    id: `JRN-KHATA-${settlementId}`,
    date,
    time,
    sourceType: "KHATA_SETTLEMENT",
    sourceId: settlementId,
    narration: `Khata Due Cleared by ${customerName}`,
    lines: [
      {
        accountId: receivingAccount.id,
        accountName: receivingAccount.name,
        accountType: receivingAccount.type,
        debitPaisa: 0n,
        creditPaisa: amountPaisa,
        narration: `Payment received in ${receivingAccount.name}`,
      },
      {
        accountId: "acc-khata",
        accountName: "Customer Khata (Udhaar)",
        accountType: "KHATA",
        debitPaisa: amountPaisa,
        creditPaisa: 0n,
        narration: `Khata credit cleared for ${customerName}`,
      },
    ],
  };
}
