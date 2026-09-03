import { cn } from "@/lib/utils";

export type Nivel = "verde" | "ambar" | "rojo" | "azul" | "sin-datos";

const DOT_CLASSES: Record<Nivel, string> = {
  verde: "bg-emerald-500",
  ambar: "bg-amber-500",
  rojo: "bg-red-500",
  azul: "bg-blue-500",
  "sin-datos": "bg-slate-300 dark:bg-slate-600",
};

const PILL_CLASSES: Record<Nivel, string> = {
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  ambar: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  rojo: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  azul: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  "sin-datos": "bg-muted text-muted-foreground border-border",
};

export function NivelDot({ nivel, className }: { nivel: Nivel; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", DOT_CLASSES[nivel], className)} />;
}

export function NivelPill({
  nivel,
  children,
  className,
}: {
  nivel: Nivel;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        PILL_CLASSES[nivel],
        className,
      )}
    >
      <NivelDot nivel={nivel} />
      {children}
    </span>
  );
}
