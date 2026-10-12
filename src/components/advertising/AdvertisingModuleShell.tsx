"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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

function periodSummary(from: string, to: string) {
  const start = parseISO(from);
  const end = parseISO(to);
  const currentYear = new Date().getFullYear();
  const showYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
  const endLabel = format(end, showYear ? "d MMM yyyy" : "d MMM", { locale: es });
  if (from === to) return endLabel;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const startLabel = format(start, sameMonth ? "d" : showYear ? "d MMM yyyy" : "d MMM", {
    locale: es,
  });
  return `${startLabel}–${endLabel}`;
}

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
      <div className="shrink-0 border-b border-border bg-card">
        <h1 className="sr-only">Publicidad</h1>
        <nav
          ref={navigationRef}
          aria-label="Secciones de publicidad"
          className="flex min-w-0 gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8"
        >
          {ADVERTISING_SECTIONS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={advertisingSectionActive(pathname, href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                advertisingSectionActive(pathname, href)
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {!connections && (
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border px-4 py-2 sm:px-6 lg:px-8">
            <div className="min-w-0 overflow-x-auto [&>fieldset]:w-max [&>fieldset]:flex-nowrap [&_button]:shrink-0">
              <AdvertisingQuickPeriodButtons />
            </div>
            <fieldset
              aria-label="Periodo seleccionado"
              className="flex shrink-0 items-center gap-2"
            >
              <span
                aria-hidden="true"
                className="max-w-36 truncate text-xs whitespace-nowrap text-muted-foreground sm:max-w-none sm:text-sm"
                title={`${fromDate} / ${toDate}`}
              >
                {periodSummary(fromDate, toDate)}
              </span>
              <PeriodSelector
                className="w-10 shrink-0 [&>button]:h-10 [&>button]:w-10 [&>button]:justify-center [&>button]:p-0 [&>button>span]:sr-only [&>button>svg:first-child]:mr-0 [&>button>svg:last-child]:hidden"
                value={{ from: fromDate, to: toDate }}
                onPeriodChange={setPeriod}
              />
            </fieldset>
          </div>
        )}
      </div>
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
