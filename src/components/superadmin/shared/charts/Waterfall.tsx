import { cn } from "@/lib/utils";
import { moneyCompact } from "../format";

interface WaterfallItem {
  label: string;
  valor: number;
  tipo: "inicial" | "positivo" | "negativo" | "cierre";
}

const TONE: Record<WaterfallItem["tipo"], string> = {
  inicial: "bg-slate-400 dark:bg-slate-600",
  positivo: "bg-emerald-500",
  negativo: "bg-red-500",
  cierre: "bg-primary",
};

export function Waterfall({ data }: { data: WaterfallItem[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.valor)));
  return (
    <div className="flex items-end gap-3.5 h-[190px] pt-4">
      {data.map((d) => {
        const heightPct = Math.max(4, (Math.abs(d.valor) / max) * 100);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end h-full">
            <div className={cn("text-[11px] font-extrabold mb-1", d.valor < 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              {d.valor >= 0 ? "+" : ""}
              {moneyCompact(d.valor)}
            </div>
            <div className={cn("w-full rounded-t-md min-h-[3px]", TONE[d.tipo])} style={{ height: `${heightPct}%` }} />
            <div className="mt-2 text-center text-[10.5px] font-semibold text-muted-foreground">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
