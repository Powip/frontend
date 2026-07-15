import { FlaskConical } from "lucide-react";

export function BetaBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary-foreground/90">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="text-foreground/80">
        <span className="font-semibold text-foreground">Beta — aún no conectado a SUNAT. </span>
        {children}
      </div>
    </div>
  );
}
