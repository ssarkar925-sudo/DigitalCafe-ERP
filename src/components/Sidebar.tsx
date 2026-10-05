import { NavTab } from "../App";
import { StaffOperator } from "../core/contracts";
import {
  LayoutDashboard,
  Zap,
  Landmark,
  Smartphone,
  Users,
  Wallet,
  Settings,
  Sun,
  Moon,
  CircleDot,
  KeyRound,
} from "lucide-react";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isCloudSynced: boolean;
  activeOperator: StaffOperator;
  onSwitchOperator: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  isCloudSynced,
  activeOperator,
  onSwitchOperator,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; hotkey?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 text-emerald-500" />, hotkey: "Esc" },
    { id: "pos", label: "Express POS", icon: <Zap className="w-4 h-4 text-emerald-500" />, hotkey: "F1" },
    { id: "csp", label: "Biometric CSP", icon: <Landmark className="w-4 h-4 text-sky-500" />, hotkey: "F2" },
    { id: "bbps", label: "Recharges & BBPS", icon: <Smartphone className="w-4 h-4 text-indigo-500" />, hotkey: "F3" },
    { id: "khata_stock", label: "Khata & Stock", icon: <Users className="w-4 h-4 text-purple-500" />, hotkey: "F4" },
    { id: "accounts", label: "CashBook & Accounts", icon: <Wallet className="w-4 h-4 text-amber-500" />, hotkey: "F5" },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col h-screen border-r border-slate-200/80 dark:border-slate-800 select-none sticky top-0 z-30 transition-colors">
      {/* 1. BRAND HEADER */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black tracking-tight uppercase leading-none text-slate-900 dark:text-white truncate">
              Sarkar Communication
            </h1>
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide mt-1">
              Digital Seva & CSP
            </p>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION MENU (CLEAN, PROPORTIONAL, ZERO OVERFLOW) */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
          Menu
        </p>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 font-extrabold"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? "scale-110 transition-transform text-white" : ""}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.hotkey && (
                <kbd
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition ${
                    isActive
                      ? "bg-emerald-700/60 text-emerald-100"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400"
                  }`}
                >
                  {item.hotkey}
                </kbd>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. FOOTER: USER & SYSTEM STATUS */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div
            onClick={onSwitchOperator}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer p-1 -m-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
            title="Switch Operator / Enter PIN"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
              {activeOperator.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-none">
                {activeOperator.name}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 flex items-center gap-1">
                <span>{activeOperator.role}</span>
                <span className="text-emerald-500 font-bold">• PIN Switch 🔑</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            title="Toggle Theme (Alt+T)"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400 font-mono px-0.5">
          <span>DigitalCafe v1.0</span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <CircleDot className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
            {isCloudSynced ? "Cloud Live" : "Local Mode"}
          </span>
        </div>
      </div>
    </aside>
  );
};
