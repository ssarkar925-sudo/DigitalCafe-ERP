import React, { useState, useMemo } from "react";
import { InvoiceRecord, ReturnRecord, ReturnItem } from "../core/contracts";
import {
  Receipt,
  Search,
  Printer,
  FileDown,
  MessageSquare,
  Trash2,
  X,
  AlertTriangle,
  Calendar,
  Wallet,
  QrCode,
  Users,
  Layers,
  RotateCcw,
} from "lucide-react";

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  onVoidInvoice?: (invoiceId: string) => void;
  onRecordReturn?: (params: { returnRecord: ReturnRecord; refundDeltaPaisa: bigint }) => void;
  onPrintThermal: (invoice: InvoiceRecord) => void;
  onDownloadPdf: (invoice: InvoiceRecord) => void;
  onWhatsApp: (invoice: InvoiceRecord) => void;
  formatPaisa: (paisa: bigint) => string;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  invoices,
  onVoidInvoice,
  onRecordReturn,
  onPrintThermal,
  onDownloadPdf,
  onWhatsApp,
  formatPaisa,
}) => {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  // Return Processing State
  const [returningInvoice, setReturningInvoice] = useState<InvoiceRecord | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<"CASH" | "UPI">("CASH");
  const [returnReason, setReturnReason] = useState("Customer requested item return");

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        inv.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [invoices, search]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayInvoices = useMemo(() => {
    return invoices.filter((i) => i.date === todayStr);
  }, [invoices, todayStr]);

  const todayTotalPaisa = useMemo(() => {
    return todayInvoices.reduce((sum, i) => sum + i.totalPaisa, 0n);
  }, [todayInvoices]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Sales & Invoices Register
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                View, reprint thermal receipts, download PDF slips, or void mistaken sales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                Today's Invoices
              </span>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatPaisa(todayTotalPaisa)} ({todayInvoices.length} bills)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="shrink-0 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by invoice #, customer name, phone, or service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-emerald-500"
          />
        </div>

        {/* Invoices List / Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl min-h-0">
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
              <p className="font-bold text-slate-600 dark:text-slate-300">
                No invoices recorded yet.
              </p>
              <p>Completed counter POS sales will be permanently logged here.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-750 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Invoice / Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Items Summary</th>
                  <th className="p-3 text-center">Payment</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredInvoices.map((inv) => {
                  const isVoid = inv.status === "VOID";
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition ${
                        isVoid ? "opacity-50 line-through bg-slate-100/50 dark:bg-slate-900/30" : ""
                      }`}
                    >
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {inv.date} • {inv.time}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {inv.customerName}
                        </span>
                        {inv.customerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {inv.customerPhone}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {inv.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${
                            inv.paymentMethod === "CASH"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : inv.paymentMethod === "UPI"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                              : inv.paymentMethod === "KHATA"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                          }`}
                        >
                          {inv.paymentMethod}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatPaisa(inv.totalPaisa)}
                      </td>

                      <td className="p-3 text-right shrink-0">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onPrintThermal(inv)}
                            title="Thermal Print Slip"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadPdf(inv)}
                            title="Download PDF Slip"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onWhatsApp(inv)}
                            title="Send WhatsApp Receipt"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {onRecordReturn && !isVoid && inv.status !== "REFUNDED" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReturningInvoice(inv);
                                const initialQtys: Record<string, number> = {};
                                inv.items.forEach((item) => {
                                  const alreadyRet = item.returnedQuantity || 0;
                                  const maxAvailable = item.quantity - alreadyRet;
                                  if (maxAvailable > 0) {
                                    initialQtys[item.id] = 0;
                                  }
                                });
                                setReturnQtys(initialQtys);
                                setRefundMethod(inv.paymentMethod === "UPI" ? "UPI" : "CASH");
                                setReturnReason("Customer return / restock");
                              }}
                              title="Process Item Return & Restock"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onVoidInvoice && !isVoid && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Void / Cancel invoice "${inv.invoiceNumber}"? This will reverse the cash, UPI, or Khata balances for this sale.`
                                  )
                                ) {
                                  onVoidInvoice(inv.id);
                                }
                              }}
                              title="Void Invoice"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 shrink-0">
          <span>
            Total recorded invoices: <strong className="text-slate-900 dark:text-white">{invoices.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
          >
            Close Register
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RETURN & RESTOCK MODAL                                                */}
      {/* ===================================================================== */}
      {returningInvoice && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    Return & Restock Items
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Invoice #{returningInvoice.invoiceNumber} • {returningInvoice.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturningInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item List with Quantities to Return */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {returningInvoice.items.map((item) => {
                const alreadyReturned = item.returnedQuantity || 0;
                const maxReturnable = Math.max(0, item.quantity - alreadyReturned);
                const currentReturnQty = returnQtys[item.id] || 0;
                const lineRefund = item.unitPricePaisa * BigInt(currentReturnQty);

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {formatPaisa(item.unitPricePaisa)} each • Sold: {item.quantity}
                        {alreadyReturned > 0 && ` (${alreadyReturned} already returned)`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                        <button
                          type="button"
                          disabled={currentReturnQty <= 0}
                          onClick={() =>
                            setReturnQtys((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                            }))
                          }
                          className="px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white min-w-[28px] text-center">
                          {currentReturnQty}
                        </span>
                        <button
                          type="button"
                          disabled={currentReturnQty >= maxReturnable}
                          onClick={() =>
                            setReturnQtys((prev) => ({
                              ...prev,
                              [item.id]: Math.min(maxReturnable, (prev[item.id] || 0) + 1),
                            }))
                          }
                          className="px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-[11px] font-mono font-black text-amber-600 dark:text-amber-400 block">
                          {formatPaisa(lineRefund)}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Max: {maxReturnable}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Refund & Tender Selector */}
            {(() => {
              const totalRefundPaisa = returningInvoice.items.reduce((sum, item) => {
                const qty = returnQtys[item.id] || 0;
                return sum + item.unitPricePaisa * BigInt(qty);
              }, 0n);

              return (
                <>
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                        Total Refund Amount
                      </span>
                      <span className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        Restocks catalog stock instantly
                      </span>
                    </div>
                    <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-300">
                      {formatPaisa(totalRefundPaisa)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Refund Payout Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundMethod("CASH")}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                          refundMethod === "CASH"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <Wallet className="w-4 h-4" />
                        Cash Drawer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundMethod("UPI")}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                          refundMethod === "UPI"
                            ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        UPI / Soundbox
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Return Reason / Notes
                    </label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. Defective print, customer changed mind"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Submit Return */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReturningInvoice(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={totalRefundPaisa <= 0n}
                      onClick={() => {
                        if (totalRefundPaisa <= 0n) return;
                        const returnItems: ReturnItem[] = [];
                        returningInvoice.items.forEach((item) => {
                          const qty = returnQtys[item.id] || 0;
                          if (qty > 0) {
                            returnItems.push({
                              itemId: item.id,
                              itemName: item.name,
                              quantityReturned: qty,
                              unitRefundPaisa: item.unitPricePaisa,
                              totalRefundPaisa: item.unitPricePaisa * BigInt(qty),
                            });
                          }
                        });

                        const returnRecord: ReturnRecord = {
                          id: `ret-${Date.now()}`,
                          returnNumber: `RET-${Date.now().toString().slice(-6)}`,
                          invoiceId: returningInvoice.id,
                          invoiceNumber: returningInvoice.invoiceNumber,
                          date: new Date().toISOString().split("T")[0],
                          time: new Date().toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          }),
                          customerName: returningInvoice.customerName,
                          customerPhone: returningInvoice.customerPhone,
                          items: returnItems,
                          totalRefundPaisa,
                          refundMethod,
                          reason: returnReason,
                        };

                        if (onRecordReturn) {
                          onRecordReturn({
                            returnRecord,
                            refundDeltaPaisa: totalRefundPaisa,
                          });
                        }
                        setReturningInvoice(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-600/20 cursor-pointer"
                    >
                      Process Refund ({formatPaisa(totalRefundPaisa)})
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
