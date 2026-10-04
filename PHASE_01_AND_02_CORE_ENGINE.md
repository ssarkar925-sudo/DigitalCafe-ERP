# Phase 01 & 02: Core Financial Engine & Database Architecture
**DigitalCafe ERP • Sarkar Communication (West Bengal)**

---

## 1. Project Infrastructure
* **Workspace Directory:** `E:\DigitalCafe ERP`
* **Remote Git Repository:** `https://github.com/ssarkar925-sudo/DigitalCafe-ERP.git` (Branch: `main`)
* **Cloud Database:** `https://qpveotirexgkfgkmlbjg.supabase.co`
* **Zero Preloaded Data Invariant:** All tables, balances, customer lists, and catalogs start at ₹0.00 / empty (`[]`).

---

## 2. Cloud Database Schema (`supabase/schema.sql`)
The clean SQL schema has been generated for your Supabase SQL Editor:
1. `accounts`: Liquidity accounts (Cash Drawer, SBI, Fino, DigiPay, UPI QR, Credit Cards).
2. `customers`: Customer Khata directory.
3. `catalog_items`: POS services and retail goods with stock tracking.
4. `invoices`: Counter POS receipts with thermal and PDF metadata.
5. `digital_transactions`: AEPS, DMT, UPI Cash Out, Recharges, BBPS, and Google Play logs.
6. `cashbook_entries`: Daily physical cash drawer running ledger.
7. `credit_cards`: Shop credit cards with billing and due dates.
8. `day_close_audits`: Evening physical note count and variance audits.

---

## 3. Core Financial Engine (`src/core/`)
* **`contracts.ts`:** Data models, BigInt paisa types, fee modes (`CUT_FROM_CASH`, `SEPARATE_CASH`, `UPI_QR`, `KHATA`, `INCLUDED_IN_QR`), and clean starter seeds.
* **`ledger.ts`:** Passbook statement double-entry engine where:
  $$\Delta \text{Net Liquid Capital (Inflows - Outflows)} \equiv \text{Net Income Earned}$$
* **`cashbook.ts`:**
  * Physical Note Denomination Counter math: $(n_{500} \times 50000n) + \dots + \text{coins}$
  * Day-Close variance audit (Balanced, Surplus, Shortage).
  * Section 194N cumulative cash withdrawal tracker (₹20L / ₹1Cr limit monitoring).
* **`supabase.ts`:** Safe local-first initialization avoiding runtime crashes when offline or missing keys.

---

## 4. Automated Verification Results (`verify-core.ts`)
**29/29 Automated Tests Passed (100% Success Rate):**
* **Suite 1: AEPS Cash Withdrawal Math** (Cut from Cash, Separate Cash, QR, Khata) — 100% Passed.
* **Suite 2: DMT Money Transfer Math** (Separate Cash, Cut from Cash, QR, Khata) — 100% Passed.
* **Suite 3: UPI Cash Out (QR Cash Withdrawal) Math** (Included in QR, Cut, Separate, Khata) — 100% Passed.
* **Suite 4: Recharges, BBPS & Utility Bills** (Dual Inward/Outward, Fixed & Floating rates) — 100% Passed.
* **Suite 5: Universal Contra Move Money** (Bank $\to$ Cash Drawer) — 100% Passed.
* **Suite 6: Physical Note Denomination Counter Math** — 100% Passed.
* **Suite 7: Day-Close Variance Audit** (Balanced, Surplus, Shortage) — 100% Passed.
* **Suite 8: Section 194N Bank TDS Cash Tracker** — 100% Passed.
