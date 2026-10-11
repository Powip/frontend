"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import Header from "@/components/header/Header";
import { AdminPeriodProvider, useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  AdvertisingQuickPeriodButtons,
  advertisingQuickRange,
} from "./AdvertisingQuickPeriodButtons";
import { ADVERTISING_SECTIONS, advertisingSectionActive } from "./advertising-sections";

function AdvertisingShell({ children }: { children: ReactNode }) {
  const { auth, loading, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const canView = !!auth && hasPermission("VIEW_FINANCES");
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !canView) router.replace("/dashboard");
  }, [loading, canView, router]);
  useEffect(() => {
    if (
      !canView ||
      !ADVERTISING_SECTIONS.some(({ href }) => advertisingSectionActive(pathname, href))
    )
      return;
    navigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname, canView]);

  if (loading || !canView) return null;
  const connections = pathname === "/publicidad/conexiones";

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <Header />
      <div className="space-y-4 border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Publicidad</h1>
          <p className="text-sm text-muted-foreground">
            {connections
              ? "Conecta tus cuentas y consulta su historial."
              : "Consulta la publicidad de tu empresa."}
          </p>
        </div>
        {!connections && (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <AdvertisingQuickPeriodButtons />
            <PeriodSelector
              className="w-full min-w-0 sm:w-auto"
              value={{ from: fromDate, to: toDate }}
              onPeriodChange={setPeriod}
            />
          </div>
        )}
      </div>
      <nav
        ref={navigationRef}
        aria-label="Secciones de publicidad"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 lg:px-8"
      >
        {ADVERTISING_SECTIONS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            aria-current={advertisingSectionActive(pathname, href) ? "page" : undefined}
            className={cn(
              "border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors",
              advertisingSectionActive(pathname, href)
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function AdvertisingModuleShell({ children }: { children: ReactNode }) {
  return (
    <AdminPeriodProvider initialRange={advertisingQuickRange("30d")}>
      <AdvertisingShell>{children}</AdvertisingShell>
    </AdminPeriodProvider>
  );
}
