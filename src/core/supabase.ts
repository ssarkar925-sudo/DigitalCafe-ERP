/**
 * src/core/supabase.ts
 * Supabase client and live synchronization layer for DigitalCafe ERP.
 * Safely supports local-first offline operation with fallback to memory/local stores.
 * Project: https://qpveotirexgkfgkmlbjg.supabase.co
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  TreasuryAccount,
  Customer,
  CatalogItem,
  InvoiceRecord,
  DigitalTransaction,
  CashBookEntry,
  CreditCardItem,
  INITIAL_ACCOUNTS,
  INITIAL_CUSTOMERS,
  INITIAL_CATALOG_ITEMS,
  INITIAL_CREDIT_CARDS,
} from "./contracts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qpveotirexgkfgkmlbjg.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function initSupabase(): SupabaseClient | null {
  if (!supabaseAnonKey || supabaseAnonKey.trim() === "" || supabaseAnonKey === "your-supabase-anon-key-here") {
    return null;
  }
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn("[Supabase] Failed to initialize client, running in offline mode:", err);
    return null;
  }
}

export const supabase = initSupabase();

/**
 * Fetch accounts from Supabase or fallback to initial clean seeds
 */
export async function fetchLiveAccounts(): Promise<TreasuryAccount[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("code", { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      currentBalancePaisa: BigInt(row.current_balance_paisa || 0),
      isActive: row.is_active ?? true,
      metadata: row.metadata || {},
    }));
  } catch (err) {
    console.warn("[Supabase] Offline fallback for accounts:", err);
    return null;
  }
}

/**
 * Fetch customers from Supabase or fallback
 */
export async function fetchLiveCustomers(): Promise<Customer[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      phone: row.phone || "",
      currentDuePaisa: BigInt(row.current_due_paisa || 0),
      creditLimitPaisa: BigInt(row.credit_limit_paisa || 200000),
    }));
  } catch (err) {
    return null;
  }
}

/**
 * Fetch catalog items from Supabase or fallback
 */
export async function fetchLiveCatalogItems(): Promise<CatalogItem[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      kind: row.kind,
      pricePaisa: BigInt(row.price_paisa || 0),
      costPricePaisa: BigInt(row.cost_price_paisa || 0),
      currentStock: row.current_stock || 0,
      minStockAlert: row.min_stock_alert || 3,
      hotkey: row.hotkey,
      icon: row.icon || "📄",
    }));
  } catch (err) {
    return INITIAL_CATALOG_ITEMS;
  }
}

/**
 * Sync catalog item to Supabase
 */
export async function syncCatalogItemToCloud(item: CatalogItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("catalog_items").upsert({
      id: item.id,
      name: item.name,
      category: item.category,
      kind: item.kind,
      price_paisa: item.pricePaisa.toString(),
      cost_price_paisa: item.costPricePaisa.toString(),
      current_stock: item.currentStock,
      min_stock_alert: item.minStockAlert,
      hotkey: item.hotkey || null,
      icon: item.icon || "📄",
    });
    return !error;
  } catch (err) {
    console.warn("[Supabase] Failed to sync catalog item:", err);
    return false;
  }
}

/**
 * Sync invoice to Supabase
 */
export async function syncInvoiceToCloud(invoice: InvoiceRecord): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("invoices").insert({
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      date: invoice.date,
      time: invoice.time,
      customer_name: invoice.customerName,
      customer_phone: invoice.customerPhone,
      items: invoice.items.map((i) => ({
        ...i,
        unitPricePaisa: i.unitPricePaisa.toString(),
        totalPaisa: i.totalPaisa.toString(),
      })),
      subtotal_paisa: invoice.subtotalPaisa.toString(),
      discount_paisa: invoice.discountPaisa.toString(),
      total_paisa: invoice.totalPaisa.toString(),
      payment_method: invoice.paymentMethod,
      allocations: invoice.allocations?.map((a) => ({
        ...a,
        amountPaisa: a.amountPaisa.toString(),
      })),
      status: invoice.status,
    });
    return !error;
  } catch (err) {
    console.warn("[Supabase] Failed to sync invoice:", err);
    return false;
  }
}

/**
 * Sync digital transaction to Supabase
 */
export async function syncDigitalTransactionToCloud(tx: DigitalTransaction): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("digital_transactions").insert({
      id: tx.id,
      date: tx.date,
      time: tx.time,
      service_type: tx.serviceType,
      customer_mobile: tx.customerMobile,
      beneficiary_details: tx.beneficiaryDetails,
      amount_paisa: tx.amountPaisa.toString(),
      customer_fee_paisa: tx.customerFeePaisa.toString(),
      portal_commission_paisa: tx.portalCommissionPaisa.toString(),
      portal_surcharge_paisa: tx.portalSurchargePaisa.toString(),
      net_profit_paisa: tx.netProfitPaisa.toString(),
      fee_collection_mode: tx.feeCollectionMode,
      source_account_id: tx.sourceAccountId,
      inward_account_id: tx.inwardAccountId,
      rrn_or_utr: tx.rrnOrUtr,
      voucher_code: tx.voucherCode,
      status: tx.status,
    });
    return !error;
  } catch (err) {
    console.warn("[Supabase] Failed to sync digital transaction:", err);
    return false;
  }
}
