/**
 * src/core/cashbook.ts
 * Daily Cash Book engine, Physical Note Denomination math,
 * Day-close variance audit, and Section 194N Bank TDS Cash Tracker.
 * 100% BigInt Integer Paisa Precision.
 */

import { CashBookEntry, NoteDenominations } from "./contracts";
import { JournalEntry } from "./ledger";

/**
 * Calculate total physical cash from note counts
 */
export function calculatePhysicalNotesTotal(denominations: NoteDenominations): bigint {
  const n500 = BigInt(Math.max(0, denominations.n500)) * 50000n; // ₹500 = 50000 paisa
  const n200 = BigInt(Math.max(0, denominations.n200)) * 20000n; // ₹200 = 20000 paisa
  const n100 = BigInt(Math.max(0, denominations.n100)) * 10000n; // ₹100 = 10000 paisa
  const n50  = BigInt(Math.max(0, denominations.n50))  * 5000n;  // ₹50  = 5000 paisa
  const n20  = BigInt(Math.max(0, denominations.n20))  * 2000n;  // ₹20  = 2000 paisa
  const n10  = BigInt(Math.max(0, denominations.n10))  * 1000n;  // ₹10  = 1000 paisa
  const coins = denominations.coinsPaisa >= 0n ? denominations.coinsPaisa : 0n;

  return n500 + n200 + n100 + n50 + n20 + n10 + coins;
}

/**
 * Calculate Day-Close Cash Variance:
 * Variance = Physical Counted - System Expected
 */
export function calculateDayCloseVariance(
  systemExpectedCashPaisa: bigint,
  physicalCountedCashPaisa: bigint
): {
  variancePaisa: bigint;
  status: "BALANCED" | "SURPLUS" | "SHORTAGE";
} {
  const variancePaisa = physicalCountedCashPaisa - systemExpectedCashPaisa;

  if (variancePaisa === 0n) {
    return { variancePaisa: 0n, status: "BALANCED" };
  } else if (variancePaisa > 0n) {
    return { variancePaisa, status: "SURPLUS" };
  } else {
    return { variancePaisa, status: "SHORTAGE" };
  }
}

/**
 * Summarize today's cash book entries
 */
export function summarizeDailyCashBook(
  openingCashPaisa: bigint,
  entries: CashBookEntry[]
): {
  openingCashPaisa: bigint;
  totalCashInPaisa: bigint;
  totalCashOutPaisa: bigint;
  closingCashPaisa: bigint;
} {
  let totalCashInPaisa = 0n;
  let totalCashOutPaisa = 0n;

  for (const entry of entries) {
    if (entry.type === "IN") {
      totalCashInPaisa += entry.amountPaisa;
    } else if (entry.type === "OUT") {
      totalCashOutPaisa += entry.amountPaisa;
    }
  }

  const closingCashPaisa = openingCashPaisa + totalCashInPaisa - totalCashOutPaisa;

  return {
    openingCashPaisa,
    totalCashInPaisa,
    totalCashOutPaisa,
    closingCashPaisa,
  };
}

/**
 * Section 194N Cumulative Cash Withdrawal Tracker:
 * Calculates total bank ATM/branch withdrawals to cash drawer across fiscal year (Apr 1 - Mar 31)
 */
export function calculateSection194NStatus(
  journalEntries: JournalEntry[],
  annualThresholdPaisa: bigint = 200000000n // Default ₹20 Lakhs = 20,00,000 * 100 paisa
): {
  cumulativeWithdrawnPaisa: bigint;
  annualThresholdPaisa: bigint;
  remainingSafeLimitPaisa: bigint;
  utilizationPct: number;
  status: "SAFE" | "WARNING" | "CRITICAL";
} {
  let cumulativeWithdrawnPaisa = 0n;

  for (const entry of journalEntries) {
    if (entry.sourceType === "CONTRA_TRANSFER") {
      // Check if from Bank account to Cash account
      const bankLine = entry.lines.find((l) => l.accountType === "BANK" && l.debitPaisa > 0n);
      const cashLine = entry.lines.find((l) => l.accountType === "CASH" && l.creditPaisa > 0n);

      if (bankLine && cashLine) {
        cumulativeWithdrawnPaisa += bankLine.debitPaisa;
      }
    }
  }

  const remainingSafeLimitPaisa =
    cumulativeWithdrawnPaisa >= annualThresholdPaisa
      ? 0n
      : annualThresholdPaisa - cumulativeWithdrawnPaisa;

  const utilizationPct =
    annualThresholdPaisa > 0n
      ? Number((cumulativeWithdrawnPaisa * 10000n) / annualThresholdPaisa) / 100
      : 0;

  let status: "SAFE" | "WARNING" | "CRITICAL" = "SAFE";
  if (utilizationPct >= 90 || cumulativeWithdrawnPaisa >= annualThresholdPaisa) {
    status = "CRITICAL";
  } else if (utilizationPct >= 75) {
    status = "WARNING";
  }

  return {
    cumulativeWithdrawnPaisa,
    annualThresholdPaisa,
    remainingSafeLimitPaisa,
    utilizationPct,
    status,
  };
}
