"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "@/components/header/Header";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { AdminPeriodProvider, useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Resumen", href: "/administracion/resumen" },
  { label: "Gastos & Costos", href: "/administracion/gastos" },
  { label: "Utilidad & Margen", href: "/administracion/utilidad" },
  { label: "Canales & Marketplaces", href: "/administracion/canales" },
  { label: "Punto de Equilibrio", href: "/administracion/equilibrio" },
  { label: "Margen x Producto", href: "/administracion/margen-producto" },
  { label: "Merma", href: "/administracion/merma" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setPeriod } = useAdminPeriod();
  const { auth, loading, hasPermission } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!auth || !hasPermission("VIEW_FINANCES")) {
      router.replace("/dashboard");
    }
  }, [auth, loading, hasPermission, router]);

  if (loading || !auth || !hasPermission("VIEW_FINANCES")) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      <Header />

      <div className="px-8 py-4 flex items-center justify-between border-b border-border bg-card shadow-sm">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">
            ADMINISTRACIÓN
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            Gestión Financiera
          </p>
        </div>
        <PeriodSelector onPeriodChange={setPeriod} />
      </div>

      <div className="flex border-b border-border px-8 overflow-x-auto bg-background">
        {TABS.map((tab) => (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={cn(
              "px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors",
              pathname === tab.href
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPeriodProvider>
      <AdminShell>{children}</AdminShell>
    </AdminPeriodProvider>
  );
}
