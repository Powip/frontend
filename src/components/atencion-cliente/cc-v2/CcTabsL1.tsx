"use client";

import { TipoGestionCC } from "@/interfaces/IOrder";

interface TabL1Config {
  key: TipoGestionCC;
  icon: string;
  label: string;
  color: string;
  activeClass: string;
  countClass: string;
}

const TABS: TabL1Config[] = [
  {
    key: "cod",
    icon: "🎯",
    label: "Gestión COD",
    color: "var(--purple-600, #7c3aed)",
    activeClass: "border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 dark:border-purple-400 font-bold",
    countClass: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  {
    key: "lima",
    icon: "📍",
    label: "Gestion de Llamadas",
    color: "var(--teal-600, #0d9488)",
    activeClass: "border-b-2 border-teal-600 text-teal-700 dark:text-teal-400 dark:border-teal-400 font-bold",
    countClass: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  },
  {
    key: "carrito",
    icon: "🛒",
    label: "Carritos Abandonados",
    color: "var(--purple-600, #7c3aed)",
    activeClass: "border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 dark:border-purple-400 font-bold",
    countClass: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
];

interface Props {
  active: TipoGestionCC;
  onChange: (tab: TipoGestionCC) => void;
  counts: Partial<Record<TipoGestionCC, number>>;
  showMovimientos?: boolean;
  isMovimientos?: boolean;
  onMovimientosClick?: () => void;
}

export function CcTabsL1({
  active,
  onChange,
  counts,
  showMovimientos = false,
  isMovimientos = false,
  onMovimientosClick,
}: Props) {
  return (
    <div className="flex border-b-2 border-gray-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => {
        const isActive = !isMovimientos && active === tab.key;
        const count = counts[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap flex-shrink-0
              transition-all duration-100 -mb-0.5
              ${isActive ? tab.activeClass : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 border-b-2 border-transparent"}
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? tab.countClass : "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {showMovimientos && (
        <button
          onClick={onMovimientosClick}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap flex-shrink-0
            transition-all duration-100 -mb-0.5
            ${isMovimientos
              ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400 font-bold"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 border-b-2 border-transparent"
            }
          `}
        >
          <span>💰</span>
          <span>Movimientos</span>
        </button>
      )}
    </div>
  );
}
