import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, FlaskConical, type LucideIcon } from "lucide-react";

const COLOR: Record<string, string> = {
  teal: "border-l-primary text-primary",
  green: "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
  blue: "border-l-blue-500 text-blue-600 dark:text-blue-400",
  violet: "border-l-violet-500 text-violet-600 dark:text-violet-400",
};

interface KpiCardProps {
  icon: LucideIcon;
  color?: keyof typeof COLOR;
  label: string;
  value: string | number;
  deltaPct?: number;
  sub?: string;
  /** Todavía no tiene fuente de dato real en el backend — se muestra con aviso visual en vez de mezclarse con datos reales sin avisar. */
  simulado?: boolean;
}

export function KpiCard({ icon: Icon, color = "teal", label, value, deltaPct, sub, simulado }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card p-4 shadow-sm",
        simulado ? "border-l-destructive bg-destructive/[0.04] border-destructive/20" : COLOR[color]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className={cn("h-3.5 w-3.5", simulado ? "text-destructive" : COLOR[color].split(" ")[1])} />
          {label}
        </div>
        {simulado ? (
          <span
            title="Todavía no existe una fuente de dato real para esta métrica en el backend — se muestra un valor de ejemplo."
            className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9.5px] font-bold text-destructive"
          >
            <FlaskConical className="h-2.5 w-2.5" />
            Simulado
          </span>
        ) : (
          deltaPct !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px] font-bold",
                deltaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {deltaPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(deltaPct)}%
            </span>
          )
        )}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function KpiCardSkeleton() {
  return <div className="h-[92px] animate-pulse rounded-xl border bg-muted/40" />;
}
