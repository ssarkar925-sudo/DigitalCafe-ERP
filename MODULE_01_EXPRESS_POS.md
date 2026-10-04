# Module 1: Express Counter POS & Catalog Manager
**Sarkar Communication — West Bengal Cyber Cafe, Digital Seva Kendra & Banking CSP**

---

## 1. Module Overview
Module 1 (`src/components/PosTerminal.tsx`) delivers the counter retail billing engine for high-velocity cyber cafe operations (Xerox, Printout, Aadhaar card PVC prints, Photo studio instant prints, Lamination, Online Govt Form fill-ups, and Stationery).

### Strict Architectural Invariants Maintained:
1. **Zero Preloaded / Mock Items:** Catalog starts clean at `₹0.00`. An educational onboarding card with an optional 1-click starter initializer allows loading 8 standard cafe items (Xerox ₹2, Color Print ₹10, Aadhaar PVC ₹30, Passport Photo ₹50, Lamination ₹20, Online Form ₹70, Scan & Email ₹15) or building custom services from scratch.
2. **Strict Integer Paisa BigInt:** All prices, unit costs, discounts, and subtotals calculated in BigInt integer paisa (`100n` = ₹1.00).
3. **No Black Shades in Light Mode:** Multi-colored pastel gradients (Emerald, Sky, Purple, Amber, Teal).
4. **Light Dark Tinted Shades in Dark Mode:** Uses rich slate-800/slate-900 with luminous borders (`dark:border-emerald-700/60`), never pitch-black `#000000`.

---

## 2. Key Features Implemented

### A. Catalog & Quick Multipliers
- **Category Filter Tabs:** `All`, `Xerox & Print`, `Photos & Docs`, `Online Forms`, `Lamination & Binding`, `Consumables Goods`, `Others`.
- **Instant Search:** Filters by title and category in real time.
- **Counter Multiplier Chips (`+1`, `+5`, `+25`, `+50`, `+100`):** Cyber cafe customers frequently request bulk photocopy runs (e.g., 25 copies of a marksheet or 50 copies of a notice). Clicking `+25` or `+50` immediately adds the exact quantity to cart in 1 click.
- **"+ Add Service / Product" Modal:** Add custom services or physical stationery goods with price, cost margin, stock, and emoji icon. Automatically synced to Supabase `catalog_items`.

### B. Counter Billing Desk & 4 Tenders
- **Customer Identity:** Customer Name + WhatsApp Phone number.
- **Cart Stepper:** Modify item quantities, delete items, enter cash discount in Rupees.
- **4 Payment Tenders:**
  1. **Cash (`F9`):** Includes **Cash Tendered Input & Instant Change Calculator** (e.g. ₹500 note given for ₹70 bill -> displays `Change to Return: ₹430.00` in high contrast).
  2. **UPI QR (`F10`):** Merchant QR soundbox / UPI collection tender.
  3. **Khata (Udhaar):** Adds receivable to customer ledger.
  4. **Split Tender:** Simultaneous partial Cash + partial UPI QR.

### C. 3-Way Instant Output Engine
Once a sale is completed, the modal gives 3 one-click dispatch options:
1. **📄 Download PDF Receipt:** Generates an 80mm thermal slip PDF using `jspdf` containing shop header, date/time, customer details, itemized breakdown, and tax notes.
2. **🖨️ Thermal Print (ESC/POS 58mm / 80mm):** Triggers browser thermal print popup formatted for receipt roll printers.
3. **💬 WhatsApp Dispatch:** Opens `wa.me/91<phone>` with a pre-formatted invoice summary message for paperless digital delivery.

### D. Automated Double-Entry & Cash Book Sync
- Calls `createPosSaleJournal` in `src/core/ledger.ts`:
  - Credits Sales Revenue (`INCOME`)
  - Debits Cash Drawer (`CASH`) or UPI Collections (`UPI_HOLDING`) or Customer Receivable (`KHATA`)
- Writes entry to `cashBookEntries` with running balance when Cash is tendered.
- Syncs invoice to Supabase `invoices` table.

---

## 3. Git Commits
- `a8a086b`: Multi-color card themes in light mode and rich light-dark palette in dark mode (no black shades).
- `0782319`: Module 1 Express Counter POS with catalog manager, quick multipliers, 4 tenders, PDF receipt, thermal print, and WhatsApp dispatch.
