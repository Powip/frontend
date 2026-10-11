"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdvertisingLivePanel } from "./AdvertisingLivePanel";
import { advertisingPeriodFromParams } from "./advertising-period";

const ManualAdvertisingPage = dynamic(
  () => import("@/app/administracion/pauta/ManualAdvertisingPage"),
  {
    loading: () => <Skeleton className="h-48 w-full" />,
  },
);
const MetaCatalogPanel = dynamic(
  () =>
    import("./AdvertisingMetaCatalogPanel").then((module) => module.AdvertisingMetaCatalogPanel),
  { loading: () => <Skeleton className="m-4 h-64" /> },
);
const WorkspacePanel = dynamic(
  () => import("./AdvertisingWorkspacePanel").then((module) => module.AdvertisingWorkspacePanel),
  { loading: () => <Skeleton className="m-4 h-64" /> },
);
const OrdersPanel = dynamic(
  () => import("./AdvertisingOrdersPanel").then((module) => module.AdvertisingOrdersPanel),
  { loading: () => <Skeleton className="m-4 h-64" /> },
);
const BusinessAnalyticsPanel = dynamic(
  () =>
    import("./AdvertisingBusinessAnalyticsPanel").then(
      (module) => module.AdvertisingBusinessAnalyticsPanel,
    ),
  { loading: () => <Skeleton className="m-4 h-64" /> },
);

interface PageProps {
  connectionsOnly?: boolean;
  view?:
    | "campaigns"
    | "ads"
    | "assignments"
    | "alerts"
    | "planner"
    | "orders"
    | "quality"
    | "products"
    | "zones"
    | "results";
}

function AdvertisingPageContent({ connectionsOnly = false, view }: PageProps) {
  const { auth } = useAuth();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const queryString = useSearchParams().toString();
  const [readyQuery, setReadyQuery] = useState<string | null>(null);
  const storeIds = useMemo(
    () => auth?.company?.stores?.map((store) => store.id) ?? [],
    [auth?.company?.stores],
  );

  useEffect(() => {
    const period = advertisingPeriodFromParams(new URLSearchParams(queryString));
    if (period) setPeriod(period.from, period.to);
    setReadyQuery(queryString);
  }, [queryString, setPeriod]);

  if (readyQuery !== queryString)
    return <Skeleton className="m-4 h-48" aria-label="Cargando periodo de publicidad" />;
  if (view === "orders") {
    return (
      <OrdersPanel
        key={`${auth?.user.id}:${auth?.company?.id}:${view}:${fromDate}:${toDate}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        from={fromDate}
        to={toDate}
      />
    );
  }
  if (view === "quality" || view === "products" || view === "zones" || view === "results") {
    return (
      <BusinessAnalyticsPanel
        key={`${auth?.user.id}:${auth?.company?.id}:${view}:${fromDate}:${toDate}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        from={fromDate}
        to={toDate}
        view={view}
      />
    );
  }
  if (view === "assignments" || view === "alerts" || view === "planner") {
    return (
      <WorkspacePanel
        key={`${auth?.user.id}:${auth?.company?.id}:${view}:${fromDate}:${toDate}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        from={fromDate}
        to={toDate}
        view={view}
      />
    );
  }
  if (view) {
    const params = new URLSearchParams(queryString);
    const campaignId = params.get("campaignId") ?? undefined;
    const adsetId = params.get("adsetId") ?? undefined;
    const accountId = params.get("accountId") ?? undefined;
    const adId = params.get("adId") ?? undefined;
    return (
      <MetaCatalogPanel
        key={`${auth?.user.id}:${auth?.company?.id}:${view}:${campaignId}:${adsetId}:${accountId}:${adId}:${fromDate}:${toDate}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        from={fromDate}
        to={toDate}
        level={view === "ads" ? "ad" : campaignId ? "adset" : "campaign"}
        campaignId={campaignId}
        adsetId={adsetId}
        initialAccountId={accountId}
        initialAdId={adId}
      />
    );
  }
  return (
    <div className={connectionsOnly ? "p-4 sm:p-6 lg:p-8" : undefined}>
      <AdvertisingLivePanel
        key={`${auth?.user.id}:${auth?.company?.id}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        companyName={auth?.company?.name ?? "Mi empresa"}
        from={fromDate}
        to={toDate}
        storeIds={storeIds}
        presentation="module"
        connectionsOnly={connectionsOnly}
        manualContent={!connectionsOnly ? <ManualAdvertisingPage /> : undefined}
      />
    </div>
  );
}

export function AdvertisingModulePage({ connectionsOnly = false, view }: PageProps) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-48" />}>
      <AdvertisingPageContent connectionsOnly={connectionsOnly} view={view} />
    </Suspense>
  );
}
