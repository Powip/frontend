"use client";

import { SubEstadoCc, TipoGestionCC } from "@/interfaces/IOrder";

interface SubTab {
  key: SubEstadoCc;
  label: string;
  activeClass: string;
  badgeClass: string;
}

const SUB_TABS: Record<TipoGestionCC, SubTab[]> = {
  cod: [
    { key: "por_confirmar",  label: "Por confirmar",  activeClass: "text-red-600 dark:text-red-400 border-b-2 border-red-500 dark:border-red-400",    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
    { key: "contactado",     label: "Contactado",     activeClass: "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400",  badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { key: "no_contesta",    label: "No contesta",    activeClass: "text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
    { key: "anulado_cc",     label: "Anulados",       activeClass: "text-gray-500 dark:text-slate-400 border-b-2 border-gray-400 dark:border-slate-500",  badgeClass: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400" },
  ],
  lima: [
    { key: "entrega_lima",   label: "Por coordinar",      activeClass: "text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400",   badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
    { key: "confirmado",     label: "Confirmados hoy",    activeClass: "text-green-600 dark:text-green-400 border-b-2 border-green-500 dark:border-green-400", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    { key: "reprogramado",   label: "Reprogramados",      activeClass: "text-gray-500 dark:text-slate-400 border-b-2 border-gray-400 dark:border-slate-500",   badgeClass: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400" },
  ],
  carrito: [
    { key: "carrito_sin_contactar", label: "Sin contactar", activeClass: "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 dark:border-purple-400", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
    { key: "carrito_contactado",    label: "Contactados",   activeClass: "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400",     badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { key: "carrito_recuperado",    label: "Recuperados",   activeClass: "text-green-600 dark:text-green-400 border-b-2 border-green-500 dark:border-green-400",   badgeClass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  ],
};

interface Props {
  tipoGestion: TipoGestionCC;
  active: SubEstadoCc;
  onChange: (sub: SubEstadoCc) => void;
  counts: Partial<Record<SubEstadoCc, number>>;
}

export function CcTabsL2({ tipoGestion, active, onChange, counts }: Props) {
  const tabs = SUB_TABS[tipoGestion];

  return (
    <div className="flex bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 px-4 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const count = counts[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 text-xs whitespace-nowrap flex-shrink-0
              transition-all duration-100 -mb-px
              ${isActive ? tab.activeClass : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border-b-2 border-transparent"}
            `}
          >
            {tab.label}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? tab.badgeClass : "bg-gray-200 text-gray-500 dark:bg-slate-600 dark:text-slate-300"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function defaultSubEstado(tipo: TipoGestionCC): SubEstadoCc {
  return SUB_TABS[tipo][0].key;
}
