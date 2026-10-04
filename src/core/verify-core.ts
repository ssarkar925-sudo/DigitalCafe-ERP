/**
 * src/core/verify-core.ts
 * Automated financial verification suite for DigitalCafe ERP.
 * Run directly with: npx tsx src/core/verify-core.ts
 */

import {
  INITIAL_ACCOUNTS,
  TreasuryAccount,
} from "./contracts";
import {
  createAepsJournal,
  createDmtJournal,
  createUpiCashoutJournal,
  createRechargeUtilityJournal,
  createContraTransferJournal,
  createPosSaleJournal,
  createExpenseJournal,
  createKhataSettlementJournal,
  isJournalBalanced,
} from "./ledger";
import {
  calculatePhysicalNotesTotal,
  calculateDayCloseVariance,
  summarizeDailyCashBook,
  calculateSection194NStatus,
} from "./cashbook";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("DIGITALCAFE ERP — CORE FINANCIAL ENGINE VERIFICATION");
console.log("=======================================================\n");

const cashAcc = INITIAL_ACCOUNTS.find((a) => a.type === "CASH")!;
const sbiBankAcc = INITIAL_ACCOUNTS.find((a) => a.id === "acc-bank-sbi")!;
const finoWalletAcc = INITIAL_ACCOUNTS.find((a) => a.id === "acc-wallet-fino")!;
const qrAcc = INITIAL_ACCOUNTS.find((a) => a.type === "UPI_HOLDING")!;
const revenueAcc = INITIAL_ACCOUNTS.find((a) => a.id === "acc-revenue")!;
const commIncomeAcc = INITIAL_ACCOUNTS.find((a) => a.id === "acc-commissions")!;
const expenseAcc = INITIAL_ACCOUNTS.find((a) => a.id === "acc-expenses")!;

// -----------------------------------------------------------------------------
// SUITE 1: AEPS Cash Withdrawal Math
// -----------------------------------------------------------------------------
console.log("Suite 1: AEPS Cash Withdrawal Math (CR/DR & 2-Part Commission)");

// 1A. Cut from Cash: ₹1,000 withdrawn, ₹3 portal comm, ₹20 fee cut from cash
const aepsCut = createAepsJournal({
  txnId: "AEPS-001",
  date: "2026-10-04",
  amountPaisa: 100000n, // ₹1,000
  portalCommissionPaisa: 300n, // ₹3
  customerFeePaisa: 2000n, // ₹20
  feeMode: "CUT_FROM_CASH",
  cashAccount: cashAcc,
  portalAccount: finoWalletAcc,
  commissionAccount: commIncomeAcc,
});
assert(isJournalBalanced(aepsCut), "AEPS Cut from Cash: Journal lines balanced");
const aepsCutPortalLine = aepsCut.lines.find((l) => l.accountId === finoWalletAcc.id)!;
const aepsCutCashLine = aepsCut.lines.find((l) => l.accountId === cashAcc.id)!;
const aepsCutCommLine = aepsCut.lines.find((l) => l.accountId === commIncomeAcc.id)!;
assert(aepsCutPortalLine.creditPaisa === 100300n, "AEPS Cut: Portal credited ₹1,003.00");
assert(aepsCutCashLine.debitPaisa === 98000n, "AEPS Cut: Drawer debited ₹980.00 handed");
assert(aepsCutCommLine.creditPaisa === 2300n, "AEPS Cut: Profit credited ₹23.00");

// 1B. Separate Cash: ₹1,000 cash given, ₹20 separate cash taken
const aepsSep = createAepsJournal({
  txnId: "AEPS-002",
  date: "2026-10-04",
  amountPaisa: 100000n,
  portalCommissionPaisa: 300n,
  customerFeePaisa: 2000n,
  feeMode: "SEPARATE_CASH",
  cashAccount: cashAcc,
  portalAccount: finoWalletAcc,
  commissionAccount: commIncomeAcc,
});
assert(isJournalBalanced(aepsSep), "AEPS Separate Cash: Journal lines balanced");
const aepsSepDrawerPayout = aepsSep.lines.find((l) => l.accountId === cashAcc.id && l.debitPaisa > 0n)!;
const aepsSepDrawerFeeIn = aepsSep.lines.find((l) => l.accountId === cashAcc.id && l.creditPaisa > 0n)!;
assert(aepsSepDrawerPayout.debitPaisa === 100000n, "AEPS Separate: Drawer payout ₹1,000");
assert(aepsSepDrawerFeeIn.creditPaisa === 2000n, "AEPS Separate: Separate fee in ₹20");

// -----------------------------------------------------------------------------
// SUITE 2: DMT Money Transfer Math
// -----------------------------------------------------------------------------
console.log("\nSuite 2: DMT Money Transfer Math (Source deduction & Net profit)");

// 2A. Separate Cash: Send ₹5,000, Surcharge ₹10, Customer fee ₹50
const dmtSep = createDmtJournal({
  txnId: "DMT-001",
  date: "2026-10-04",
  amountPaisa: 500000n,
  portalSurchargePaisa: 1000n,
  customerFeePaisa: 5000n,
  feeMode: "SEPARATE_CASH",
  sourceAccount: finoWalletAcc,
  cashAccount: cashAcc,
  commissionAccount: commIncomeAcc,
});
assert(isJournalBalanced(dmtSep), "DMT Separate Cash: Journal balanced");
const dmtSepCashIn = dmtSep.lines.find((l) => l.accountId === cashAcc.id)!;
const dmtSepSourceOut = dmtSep.lines.find((l) => l.accountId === finoWalletAcc.id)!;
const dmtSepProfit = dmtSep.lines.find((l) => l.accountId === commIncomeAcc.id)!;
assert(dmtSepCashIn.creditPaisa === 505000n, "DMT Separate: Cash drawer in ₹5,050");
assert(dmtSepSourceOut.debitPaisa === 501000n, "DMT Separate: Source deducted ₹5,010");
assert(dmtSepProfit.creditPaisa === 4000n, "DMT Separate: Net margin ₹40.00");

// 2B. Cut from Cash: Send ₹4,950 after ₹50 fee cut
const dmtCut = createDmtJournal({
  txnId: "DMT-002",
  date: "2026-10-04",
  amountPaisa: 500000n,
  portalSurchargePaisa: 1000n,
  customerFeePaisa: 5000n,
  feeMode: "CUT_FROM_CASH",
  sourceAccount: finoWalletAcc,
  cashAccount: cashAcc,
  commissionAccount: commIncomeAcc,
});
assert(isJournalBalanced(dmtCut), "DMT Cut from Cash: Journal balanced");

// -----------------------------------------------------------------------------
// SUITE 3: UPI Cash Out (QR Cash Withdrawal) Math
// -----------------------------------------------------------------------------
console.log("\nSuite 3: UPI Cash Out (QR Cash Withdrawal) Math");

// 3A. Included in QR: Scanned ₹2,020, handed ₹2,000 cash
const upiInc = createUpiCashoutJournal({
  txnId: "UPI-001",
  date: "2026-10-04",
  cashAmountPaisa: 200000n,
  feePaisa: 2000n,
  feeMode: "INCLUDED_IN_QR",
  cashAccount: cashAcc,
  qrAccount: qrAcc,
  feeIncomeAccount: commIncomeAcc,
});
assert(isJournalBalanced(upiInc), "UPI Cash Out Included in QR: Journal balanced");
const upiIncQrIn = upiInc.lines.find((l) => l.accountId === qrAcc.id)!;
const upiIncCashOut = upiInc.lines.find((l) => l.accountId === cashAcc.id)!;
assert(upiIncQrIn.creditPaisa === 202000n, "UPI Cash Out: QR received ₹2,020");
assert(upiIncCashOut.debitPaisa === 200000n, "UPI Cash Out: Cash handed ₹2,000");

// -----------------------------------------------------------------------------
// SUITE 4: Recharges, BBPS & Utility Bills (Dual Inward/Outward)
// -----------------------------------------------------------------------------
console.log("\nSuite 4: Recharges, BBPS & Utility Bills (Dual Inward/Outward)");

const billEntry = createRechargeUtilityJournal({
  txnId: "BILL-001",
  date: "2026-10-04",
  serviceType: "UTILITY_BILL",
  billOrFaceAmountPaisa: 250000n, // ₹2,500 WBSEDCL
  customerFeePaisa: 2000n,        // ₹20 fee
  providerCashbackPaisa: 2500n,   // ₹25 card/portal cashback
  inwardAccount: cashAcc,         // Customer paid cash
  outwardAccount: sbiBankAcc,     // Paid via SBI Bank
  incomeAccount: commIncomeAcc,
});
assert(isJournalBalanced(billEntry), "Utility Bill Journal balanced");
const billInward = billEntry.lines.find((l) => l.accountId === cashAcc.id)!;
const billOutward = billEntry.lines.find((l) => l.accountId === sbiBankAcc.id)!;
const billProfit = billEntry.lines.find((l) => l.accountId === commIncomeAcc.id)!;
assert(billInward.creditPaisa === 252000n, "Utility Bill: Cash in ₹2,520");
assert(billOutward.debitPaisa === 247500n, "Utility Bill: Outward cost ₹2,475");
assert(billProfit.creditPaisa === 4500n, "Utility Bill: Net profit ₹45.00");

// -----------------------------------------------------------------------------
// SUITE 5: Contra Transfer (Move Money) Math
// -----------------------------------------------------------------------------
console.log("\nSuite 5: Universal Contra Move Money");

const contra = createContraTransferJournal({
  transferId: "CTR-001",
  date: "2026-10-04",
  amountPaisa: 2000000n, // ₹20,000 from Bank to Cash Drawer
  fromAccount: sbiBankAcc,
  toAccount: cashAcc,
  note: "ATM Withdrawal for Cash Drawer",
});
assert(isJournalBalanced(contra), "Contra Transfer Journal balanced");
assert(contra.lines[0].debitPaisa === 2000000n, "Contra Outflow: Bank debited ₹20,000");
assert(contra.lines[1].creditPaisa === 2000000n, "Contra Inflow: Cash credited ₹20,000");

// -----------------------------------------------------------------------------
// SUITE 6: Physical Note Denomination Counter Math
// -----------------------------------------------------------------------------
console.log("\nSuite 6: Physical Note Denomination Counter Math");

const noteTotal = calculatePhysicalNotesTotal({
  n500: 2,   // ₹1,000
  n200: 1,   // ₹200
  n100: 3,   // ₹300
  n50: 1,    // ₹50
  n20: 2,    // ₹40
  n10: 1,    // ₹10
  coinsPaisa: 500n, // ₹5
});
assert(noteTotal === 160500n, "Physical note counter: ₹1,605.00 exact math");

// -----------------------------------------------------------------------------
// SUITE 7: Day-Close Variance Calculation
// -----------------------------------------------------------------------------
console.log("\nSuite 7: Day-Close Variance Calculation");

const balancedAudit = calculateDayCloseVariance(160500n, 160500n);
assert(balancedAudit.status === "BALANCED" && balancedAudit.variancePaisa === 0n, "Day close: Perfect balance (₹0.00)");

const surplusAudit = calculateDayCloseVariance(160500n, 161000n);
assert(surplusAudit.status === "SURPLUS" && surplusAudit.variancePaisa === 500n, "Day close: ₹5.00 Surplus");

const shortageAudit = calculateDayCloseVariance(160500n, 159500n);
assert(shortageAudit.status === "SHORTAGE" && shortageAudit.variancePaisa === -1000n, "Day close: ₹10.00 Shortage");

// -----------------------------------------------------------------------------
// SUITE 8: Section 194N Bank TDS Cash Tracker
// -----------------------------------------------------------------------------
console.log("\nSuite 8: Section 194N Bank TDS Cumulative Cash Tracker");

const sec194Status = calculateSection194NStatus([contra], 200000000n); // ₹20,000 against ₹20L
assert(sec194Status.cumulativeWithdrawnPaisa === 2000000n, "194N: Cumulative withdrawn ₹20,000");
assert(sec194Status.status === "SAFE", "194N: Status is SAFE (< 75%)");
assert(sec194Status.remainingSafeLimitPaisa === 198000000n, "194N: Remaining limit ₹19.80 Lakhs");

console.log("\n=======================================================");
console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
