"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPeriodProvider, useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AdvertisingAccountFilterProvider,
  useAdvertisingAccountFilter,
} from "./AdvertisingAccountFilterContext";
import { AdvertisingQuickPeriodButtons } from "./AdvertisingQuickPeriodButtons";
import {
  AdvertisingStoreFilterProvider,
  useAdvertisingStoreFilter,
} from "./AdvertisingStoreFilterContext";
import { advertisingPeriodFromParams } from "./advertising-period";
import {
  ADVERTISING_SECTIONS,
  advertisingSectionActive,
  advertisingSectionHref,
} from "./advertising-sections";
import { AdvertisingV22Provider, useAdsV22 } from "./v22/context";
import { comparisonPeriod, limaToday } from "./v22/model";
import { Failure, SelectField } from "./v22/shared";

function AdvertisingShell({ children }: { children: ReactNode }) {
  const { auth, loading: authLoading } = useAuth();
  const { settings, loading, error, reload } = useAdsV22();
  const pathname = usePathname();
  const router = useRouter();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const { storeId, setStoreId, stores } = useAdvertisingStoreFilter();
  const { accountId, setAccountId, accounts } = useAdvertisingAccountFilter();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const period = advertisingPeriodFromParams(params);
      if (period) setPeriod(period.from, period.to);
      const selected = params.get("storeId");
      if (selected) setStoreId(selected);
      initialized.current = true;
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [setPeriod, setStoreId]);
  useEffect(() => {
    if (!ready || !initialized.current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("from", fromDate);
    url.searchParams.set("to", toDate);
    url.searchParams.set("storeId", storeId);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [fromDate, toDate, storeId, ready]);
  useEffect(() => {
    if (!authLoading && !auth) router.replace("/login");
  }, [authLoading, auth, router]);
  if (authLoading || !auth) return null;
  const hidePeriod = pathname.startsWith("/publicidad/pruebas");
  const comparison = comparisonPeriod(fromDate, toDate);
  const dateLabel = (date: string) => format(parseISO(date), "d MMM", { locale: es });
  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="shrink-0 border-b bg-card px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <h1 className="text-xl font-bold">Publicidad</h1>
            {auth.company?.name && <p className="text-xs text-muted-foreground">{auth.company.name}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SelectField
              label="Cuenta publicitaria"
              value={accountId}
              onChange={setAccountId}
              options={[
                {
                  value: "all",
                  label: accounts.length
                    ? `${accounts.length} cuentas publicitarias conectadas`
                    : "Todas las cuentas",
                },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
            <SelectField
              label="Negocio"
              value={storeId}
              onChange={setStoreId}
              options={[
                { value: "all", label: "Todo el negocio" },
                ...stores.map((store) => ({ value: store.id, label: store.name })),
              ]}
            />
          </div>
        </div>
        <nav aria-label="Secciones de publicidad" className="flex gap-1 overflow-x-auto">
          {ADVERTISING_SECTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={advertisingSectionHref(href, fromDate, toDate, {
                storeId,
                ...(accountId !== "all" ? { adAccountId: accountId } : {}),
              })}
              aria-current={advertisingSectionActive(pathname, href) ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm ${advertisingSectionActive(pathname, href) ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        {!hidePeriod && (
          <div className="space-y-2 border-t py-3">
            <div className="flex flex-wrap items-center gap-3">
              <PeriodSelector value={{ from: fromDate, to: toDate }} onPeriodChange={setPeriod} />
              <AdvertisingQuickPeriodButtons />
            </div>
            <p className="text-xs text-muted-foreground">
              Datos al {dateLabel(comparison.effectiveTo)}
              {comparison.effectiveTo === limaToday() ? " (hoy)" : ""} · comparado con{" "}
              {dateLabel(comparison.from)} – {dateLabel(comparison.to)}
            </p>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        {loading || !ready ? (
          <Skeleton className="m-6 h-64" aria-label="Cargando acceso a publicidad" />
        ) : error ? (
          <div className="p-6">
            <Failure error={error} retry={reload} />
          </div>
        ) : settings?.capabilities.view ? (
          <Fragment key={pathname.startsWith("/publicidad/anuncios") ? "ads" : storeId}>{children}</Fragment>
        ) : (
          <p role="alert" className="p-6 text-sm">
            Tu rol no tiene acceso a Publicidad.
          </p>
        )}
      </div>
    </div>
  );
}

export function AdvertisingModuleShell({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const today = parseISO(limaToday());
  return (
    <AdvertisingStoreFilterProvider
      key={`${auth?.user.id ?? "none"}:${auth?.company?.id ?? "none"}`}
      stores={auth?.company?.stores ?? []}
      allowUnassigned={false}
    >
      <AdminPeriodProvider
        initialRange={{
          from: format(startOfMonth(today), "yyyy-MM-dd"),
          to: format(endOfMonth(today), "yyyy-MM-dd"),
        }}
      >
        <AdvertisingV22Provider>
          <AdvertisingAccountFilterProvider>
            <AdvertisingShell>{children}</AdvertisingShell>
          </AdvertisingAccountFilterProvider>
        </AdvertisingV22Provider>
      </AdminPeriodProvider>
    </AdvertisingStoreFilterProvider>
  );
}
