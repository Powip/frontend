"use client";

interface InnerTab<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs: readonly InnerTab<T>[];
  active: T;
  onChange: (key: T) => void;
}

/**
 * Sub-tabs de Rango/Mes (Resumen · CPV · Productos). El estilo
 * "solo subrayado" que tenían antes se confundía fácil con el borde del
 * contenedor — ahora la pestaña activa también lleva fondo + texto en
 * negrita para que se note de un vistazo cuál está seleccionada.
 */
export function CcCierreDiaInnerTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-1 border-b overflow-x-auto overflow-y-hidden scrollbar-none" role="tablist">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px whitespace-nowrap transition-colors ${
              isActive
                ? "border-teal-600 bg-teal-50 text-teal-700 font-bold dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
