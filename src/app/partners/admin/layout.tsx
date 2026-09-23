import type { Metadata } from "next";
import { PartnersAdminTabs } from "./_components/partners-admin-tabs";

export const metadata: Metadata = {
  title: { template: "%s | Partners Admin | Powip", default: "Partners Admin | Powip" },
  description: "Panel interno de Powip para administrar el programa de partners.",
  robots: { index: false, follow: false },
};

export default function PartnersAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            PARTNERS · ADMINISTRACIÓN
          </h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Gestión del programa de referidos
          </p>
        </div>
      </header>

      <PartnersAdminTabs />

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
