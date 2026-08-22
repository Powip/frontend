import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  num?: number;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ num, title, sub, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5 mb-3", className)}>
      {num !== undefined && (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-extrabold text-primary">
          {num}
        </span>
      )}
      <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
      {sub && <span className="text-[11px] font-medium text-muted-foreground">{sub}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
