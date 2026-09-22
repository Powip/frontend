import type { Metadata } from "next";
import { PartnersTabs } from "./_components/partners-tabs";

export const metadata: Metadata = {
  title: { template: "%s | Partners | Powip", default: "Partners | Powip" },
  description: "Programa de referidos de Powip: comisiones, pagos y recursos para partners.",
  robots: { index: false, follow: false },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            PROGRAMA DE PARTNERS
          </h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Referí Powip y ganá comisiones
          </p>
        </div>
      </header>

      <PartnersTabs />

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
