import React, { useState, useMemo } from "react";
import { InvoiceRecord } from "../core/contracts";
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
} from "lucide-react";

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  onVoidInvoice?: (invoiceId: string) => void;
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
  onPrintThermal,
  onDownloadPdf,
  onWhatsApp,
  formatPaisa,
}) => {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

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
    </div>
  );
};
