# Module 1: Express Counter POS & Catalog Manager
**Sarkar Communication — West Bengal Cyber Cafe, Digital Seva Kendra & Banking CSP**

---

## 1. Module Overview
Module 1 (`src/components/PosTerminal.tsx`) delivers the counter retail billing engine for high-velocity cyber cafe operations (Xerox, Printout, Aadhaar card PVC prints, Photo studio instant prints, Lamination, Online Govt Form fill-ups, and Stationery).

### Strict Architectural Invariants Maintained:
1. **Zero Preloaded Data:** Catalog starts 100% clean with zero preloaded items (`[]`). The user creates their own services with their own custom prices.
2. **Where Data is Stored:**
   - **Local Persistence:** Stored in browser storage under `dc_user_catalog` so added services are safely preserved across page reloads and browser restarts even without internet.
   - **Cloud Sync:** Synchronized asynchronously to Supabase PostgreSQL cloud table (`catalog_items`).
3. **Strict Integer Paisa BigInt:** All prices, unit costs, discounts, and subtotals calculated in BigInt integer paisa (`100n` = ₹1.00).
4. **No Black Shades in Light Mode:** Multi-colored pastel gradients (Emerald, Sky, Purple, Amber, Teal).
5. **Light Dark Tinted Shades in Dark Mode:** Uses rich slate-800/slate-900 with luminous borders (`dark:border-emerald-700/60`), never pitch-black `#000000`.

---

## 2. Key Features Implemented

### A. Catalog Creation, Edit & Delete Controls
- **"+ Add Service / Product" Modal:** Add custom services or physical stationery goods with Name, Kind, Category, Sale Price (₹), Unit Cost (₹), Stock, and Emoji Icon.
- **Inline Edit (✏️):** Every service card and row has a pencil icon to edit Name, Category, Price, Cost, and Stock at any time.
- **Inline Delete (🗑️):** Every service card and row has a trash icon to delete items with confirmation.
- **Manage Catalog Table (`Database` button):** Full table modal displaying all services, categories, sale prices, cost prices, estimated profit margin %, with inline Edit & Delete actions.

### B. List View vs Grid View Switcher
- **⊞ Grid View:** Modern visual cards with icon, category tag, price, and quick multipliers (`+1`, `+5`, `+25`, `+50`, `+100`).
- **☰ List View:** Dense, high-density row layout displaying item name, category, price, multipliers, and edit/delete actions for rapid scanning during peak counter rush.
- User preference persisted in `localStorage` (`dc_pos_view_mode`).

### C. Hold & Resume Order Parking Lot ("Hold Option")
- **⏸️ Hold Cart:** If a customer steps aside to find OTP or cash, the operator can click **"Hold Cart"**.
- Saves the entire cart (items, quantities, customer name, phone, discount) into the Held Orders parking lot (`dc_held_orders`).
- Frees up the counter immediately for the next customer.
- **▶️ Resume Order:** Header displays `Held Orders (N)` with an animated badge. The operator clicks it to view parked carts, inspect items, and click **Resume** to restore the cart instantly.

### D. Counter Billing Desk & 4 Tenders
- **Customer Identity:** Customer Name + WhatsApp Phone number.
- **Cart Stepper:** Modify item quantities, delete items, enter cash discount in Rupees.
- **4 Payment Tenders:**
  1. **Cash (`F9`):** Includes **Cash Tendered Input & Instant Change Calculator** (e.g. ₹500 note given for ₹70 bill -> displays `Change to Return: ₹430.00` in high contrast).
  2. **UPI QR (`F10`):** Merchant QR soundbox / UPI collection tender.
  3. **Khata (Udhaar):** Adds receivable to customer ledger.
  4. **Split Tender:** Simultaneous partial Cash + partial UPI QR.

### E. 3-Way Instant Output Engine
Once a sale is completed, the modal gives 3 one-click dispatch options:
1. **📄 Download PDF Receipt:** Generates an 80mm thermal slip PDF using `jspdf` containing shop header, date/time, customer details, itemized breakdown, and tax notes.
2. **🖨️ Thermal Print (ESC/POS 58mm / 80mm):** Triggers browser thermal print popup formatted for receipt roll printers.
3. **💬 WhatsApp Dispatch:** Opens `wa.me/91<phone>` with a pre-formatted invoice summary message for paperless digital delivery.

### F. Automated Double-Entry & Cash Book Sync
- Calls `createPosSaleJournal` in `src/core/ledger.ts`:
  - Credits Sales Revenue (`INCOME`)
  - Debits Cash Drawer (`CASH`) or UPI Collections (`UPI_HOLDING`) or Customer Receivable (`KHATA`)
- Writes entry to `cashBookEntries` with running balance when Cash is tendered.
- Syncs invoice to Supabase `invoices` table.

---

## 3. Git Commits
- `a8a086b`: Multi-color card themes in light mode and rich light-dark palette in dark mode (no black shades).
- `0782319`: Module 1 Express Counter POS with catalog manager, quick multipliers, 4 tenders, PDF receipt, thermal print, and WhatsApp dispatch.
- `61bf0fe`: Purged all preloaded starter items; 100% clean zero-data state with prominent Add Service / Product modal.
- `5a7ddc1`: List View toggle, Hold & Resume cart parking, inline Edit/Delete controls, and dedicated Catalog Manager table modal.
