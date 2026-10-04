-- ==============================================================================
-- DigitalCafe ERP — Supabase Database Schema
-- Project: https://qpveotirexgkfgkmlbjg.supabase.co
-- Owner: Sarkar Communication (West Bengal)
-- Description: 100% clean, empty tables with zero preloaded/demo data.
-- ==============================================================================

-- 1. LIQUIDITY & NOMINAL ACCOUNTS
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'CASH', 'BANK', 'WALLET', 'UPI_HOLDING', 'CREDIT_CARD', 'INCOME', 'EXPENSE'
  current_balance_paisa BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CUSTOMER KHATA DIRECTORY
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  current_due_paisa BIGINT NOT NULL DEFAULT 0,
  credit_limit_paisa BIGINT NOT NULL DEFAULT 200000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. POS CATALOG & INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'SERVICE', 'GOODS'
  price_paisa BIGINT NOT NULL,
  cost_price_paisa BIGINT NOT NULL DEFAULT 0,
  current_stock INT NOT NULL DEFAULT 0,
  min_stock_alert INT NOT NULL DEFAULT 3,
  hotkey TEXT,
  icon TEXT NOT NULL DEFAULT '📄',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COUNTER INVOICES & POS RECEIPTS
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone TEXT,
  items JSONB NOT NULL,
  subtotal_paisa BIGINT NOT NULL,
  discount_paisa BIGINT NOT NULL DEFAULT 0,
  total_paisa BIGINT NOT NULL,
  payment_method TEXT NOT NULL, -- 'CASH', 'UPI', 'KHATA', 'SPLIT'
  allocations JSONB,
  status TEXT NOT NULL DEFAULT 'PAID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DIGITAL TRANSACTIONS (AEPS, DMT, UPI CASHOUT, RECHARGE, BBPS, GOOGLE PLAY)
CREATE TABLE IF NOT EXISTS digital_transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  service_type TEXT NOT NULL, -- 'AEPS', 'DMT', 'UPI_CASHOUT', 'RECHARGE', 'UTILITY_BILL', 'FASTAG', 'GOOGLE_PLAY'
  customer_mobile TEXT,
  beneficiary_details TEXT,
  amount_paisa BIGINT NOT NULL,
  customer_fee_paisa BIGINT NOT NULL DEFAULT 0,
  portal_commission_paisa BIGINT NOT NULL DEFAULT 0,
  portal_surcharge_paisa BIGINT NOT NULL DEFAULT 0,
  net_profit_paisa BIGINT NOT NULL,
  fee_collection_mode TEXT, -- 'CUT_FROM_CASH', 'SEPARATE_CASH', 'UPI_QR', 'KHATA', 'INCLUDED_IN_QR'
  source_account_id TEXT,
  inward_account_id TEXT,
  rrn_or_utr TEXT,
  voucher_code TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. REAL-TIME DAILY CASH BOOK
CREATE TABLE IF NOT EXISTS cashbook_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL, -- 'IN', 'OUT'
  amount_paisa BIGINT NOT NULL,
  running_balance_paisa BIGINT NOT NULL,
  category TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CREDIT CARD ACCOUNTS
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  card_network TEXT NOT NULL DEFAULT 'VISA',
  credit_limit_paisa BIGINT NOT NULL DEFAULT 0,
  current_outstanding_paisa BIGINT NOT NULL DEFAULT 0,
  billing_day INT NOT NULL DEFAULT 15,
  due_day INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EVENING DAY-CLOSE DENOMINATION AUDITS
CREATE TABLE IF NOT EXISTS day_close_audits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  opening_cash_paisa BIGINT NOT NULL,
  system_expected_cash_paisa BIGINT NOT NULL,
  physical_counted_cash_paisa BIGINT NOT NULL,
  variance_paisa BIGINT NOT NULL,
  denominations JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables (allow all for anon key locally)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_close_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on catalog_items" ON catalog_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on digital_transactions" ON digital_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on cashbook_entries" ON cashbook_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on credit_cards" ON credit_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on day_close_audits" ON day_close_audits FOR ALL USING (true) WITH CHECK (true);
