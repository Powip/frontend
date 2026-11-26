import { cn } from "@/lib/utils";

/** Semáforo del módulo con los colores del Panel de control (`pc-ok`, `pc-warn`, `pc-bad`, `pc-info`). */
export type Nivel = "verde" | "ambar" | "rojo" | "azul" | "sin-datos";

const DOT_CLASSES: Record<Nivel, string> = {
  verde: "bg-pc-ok",
  ambar: "bg-pc-warn",
  rojo: "bg-pc-bad",
  azul: "bg-pc-info",
  "sin-datos": "bg-pc-border",
};

const PILL_CLASSES: Record<Nivel, string> = {
  verde: "bg-pc-ok-soft text-pc-ok border-pc-ok/30",
  ambar: "bg-pc-warn-soft text-pc-warn border-pc-warn/30",
  rojo: "bg-pc-bad-soft text-pc-bad border-pc-bad/30",
  azul: "bg-pc-info-soft text-pc-info border-pc-info/30",
  "sin-datos": "bg-pc-surface-muted text-pc-text-muted border-pc-border",
};

export function NivelDot({ nivel, className }: { nivel: Nivel; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", DOT_CLASSES[nivel], className)} />;
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        PILL_CLASSES[nivel],
        className,
      )}
    >
      <NivelDot nivel={nivel} />
      {children}
    </span>
  );
}
