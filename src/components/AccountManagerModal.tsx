import React, { useState } from "react";
import { TreasuryAccount, AccountType } from "../core/contracts";
import {
  Landmark,
  Wallet,
  QrCode,
  CreditCard,
  Plus,
  Trash2,
  Pencil,
  X,
  Building,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: TreasuryAccount[];
  onAddAccount: (acc: TreasuryAccount) => void;
  onEditAccount: (acc: TreasuryAccount) => void;
  onDeleteAccount: (id: string) => void;
  formatPaisa: (paisa: bigint) => string;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  formatPaisa,
}) => {
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AccountType>("BANK");
  const [formInitialBalance, setFormInitialBalance] = useState("0");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formBankName, setFormBankName] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setFormName("");
    setFormType("BANK");
    setFormInitialBalance("0");
    setFormIdentifier("");
    setFormBankName("");
    setEditingId(null);
    setView("list");
  };

  const handleOpenAdd = () => {
    resetForm();
    setView("add");
  };

  const handleOpenEdit = (acc: TreasuryAccount) => {
    setEditingId(acc.id);
    setFormName(acc.name);
    setFormType(acc.type);
    setFormInitialBalance((Number(acc.currentBalancePaisa) / 100).toFixed(2));
    setFormIdentifier(
      acc.metadata?.accountNumber ||
      acc.metadata?.qrIdentifier ||
      acc.metadata?.portalName ||
      ""
    );
    setFormBankName(acc.metadata?.bankName || "");
    setView("edit");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const balNum = parseFloat(formInitialBalance) || 0;
    const balPaisa = BigInt(Math.round(balNum * 100));

    if (view === "add") {
      const typeCodeMap: Record<AccountType, string> = {
        CASH: "1010",
        BANK: "1020",
        WALLET: "1030",
        UPI_HOLDING: "1040",
        CREDIT_CARD: "2010",
        KHATA: "1050",
        INCOME: "4010",
        EXPENSE: "5010",
      };

      const newAcc: TreasuryAccount = {
        id: `acc-${formType.toLowerCase()}-${Date.now()}`,
        code: typeCodeMap[formType] || "1099",
        name: formName.trim(),
        type: formType,
        currentBalancePaisa: balPaisa,
        isActive: true,
        metadata: {
          accountNumber: formType === "BANK" ? formIdentifier.trim() : undefined,
          bankName: formType === "BANK" ? formBankName.trim() || formName.trim() : undefined,
          portalName: formType === "WALLET" ? formIdentifier.trim() : undefined,
          qrIdentifier: formType === "UPI_HOLDING" ? formIdentifier.trim() : undefined,
        },
      };

      onAddAccount(newAcc);
    } else if (view === "edit" && editingId) {
      const existing = accounts.find((a) => a.id === editingId);
      if (existing) {
        const updated: TreasuryAccount = {
          ...existing,
          name: formName.trim(),
          type: formType,
          currentBalancePaisa: balPaisa,
          metadata: {
            ...existing.metadata,
            accountNumber: formType === "BANK" ? formIdentifier.trim() : undefined,
            bankName: formType === "BANK" ? formBankName.trim() || formName.trim() : undefined,
            portalName: formType === "WALLET" ? formIdentifier.trim() : undefined,
            qrIdentifier: formType === "UPI_HOLDING" ? formIdentifier.trim() : undefined,
          },
        };
        onEditAccount(updated);
      }
    }

    resetForm();
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case "CASH":
        return <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "BANK":
        return <Landmark className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case "WALLET":
        return <Building className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "UPI_HOLDING":
        return <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "CREDIT_CARD":
        return <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Wallet className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeLabel = (type: AccountType) => {
    switch (type) {
      case "CASH":
        return "Physical Cash";
      case "BANK":
        return "Bank Account";
      case "WALLET":
        return "Portal Wallet";
      case "UPI_HOLDING":
        return "UPI QR Holding";
      case "CREDIT_CARD":
        return "Credit Card";
      default:
        return type;
    }
  };

  // Filter out internal nominal ledger accounts for manager list
  const liquidAccounts = accounts.filter(
    (a) => a.type !== "INCOME" && a.type !== "EXPENSE"
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Landmark className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Treasury & Accounts Manager
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage your physical Cash Drawer, Banks, Portals, and UPI QR accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* View Mode: List of Accounts */}
        {view === "list" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Active Liquid Accounts ({liquidAccounts.length})
              </span>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Bank / Wallet</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {liquidAccounts.map((acc) => {
                const isSystemCash = acc.id === "acc-cash";
                return (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        {getAccountIcon(acc.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </h4>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {getTypeLabel(acc.type)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {acc.metadata?.accountNumber
                            ? `A/C: ${acc.metadata.accountNumber}`
                            : acc.metadata?.qrIdentifier
                            ? `QR: ${acc.metadata.qrIdentifier}`
                            : acc.metadata?.portalName
                            ? `Portal: ${acc.metadata.portalName}`
                            : isSystemCash
                            ? "Primary physical cash desk"
                            : "Account ID: " + acc.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatPaisa(acc.currentBalancePaisa)}
                      </span>

                      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(acc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                          title="Edit account"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isSystemCash && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete account "${acc.name}"? This will remove it from your treasury accounts list.`
                                )
                              ) {
                                onDeleteAccount(acc.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/40 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                All accounts are stored securely in your local storage (<code className="text-emerald-600 font-mono">dc_user_accounts</code>).
              </span>
            </div>
          </div>
        )}

        {/* View Mode: Add or Edit Form */}
        {(view === "add" || view === "edit") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {view === "add" ? "+ Add New Account" : `Edit "${formName}"`}
              </span>
              <button
                type="button"
                onClick={() => setView("list")}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ← Back to List
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Account Type *
                </label>
                <select
                  disabled={editingId === "acc-cash"}
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as AccountType)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="BANK">Bank Account (SBI, PNB, etc.)</option>
                  <option value="WALLET">Portal Float (DigiPay, Fino, PayNearby)</option>
                  <option value="UPI_HOLDING">UPI QR (PhonePe QR, Soundbox)</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  {editingId === "acc-cash" && <option value="CASH">Cash Drawer</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formInitialBalance}
                  onChange={(e) => setFormInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Account Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={
                  formType === "BANK"
                    ? "e.g. State Bank of India (Current A/C)"
                    : formType === "WALLET"
                    ? "e.g. CSC DigiPay Wallet Float"
                    : formType === "UPI_HOLDING"
                    ? "e.g. Counter PhonePe Soundbox QR"
                    : "e.g. HDFC Credit Card"
                }
                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {formType === "BANK"
                  ? "Account Number / IFSC (Optional)"
                  : formType === "UPI_HOLDING"
                  ? "UPI VPA Identifier (Optional)"
                  : formType === "WALLET"
                  ? "Portal Agent ID (Optional)"
                  : "Card Details (Optional)"}
              </label>
              <input
                type="text"
                value={formIdentifier}
                onChange={(e) => setFormIdentifier(e.target.value)}
                placeholder={
                  formType === "BANK"
                    ? "e.g. 30891234567 • SBIN0001234"
                    : formType === "UPI_HOLDING"
                    ? "e.g. sarkarcommunication@sbi"
                    : "e.g. CSC123456"
                }
                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setView("list")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                {view === "add" ? "Save New Account" : "Update Account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
