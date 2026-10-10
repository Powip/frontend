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

function AdvertisingPageContent({ connectionsOnly = false }: { connectionsOnly?: boolean }) {
  const { auth } = useAuth();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const queryString = useSearchParams().toString();
  const [ready, setReady] = useState(false);
  const storeIds = useMemo(
    () => auth?.company?.stores?.map((store) => store.id) ?? [],
    [auth?.company?.stores],
  );

  useEffect(() => {
    const period = advertisingPeriodFromParams(new URLSearchParams(queryString));
    if (period) setPeriod(period.from, period.to);
    setReady(true);
  }, [queryString, setPeriod]);

  if (!ready) return <Skeleton className="m-4 h-48" aria-label="Cargando periodo de publicidad" />;
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

export function AdvertisingModulePage({ connectionsOnly = false }: { connectionsOnly?: boolean }) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-48" />}>
      <AdvertisingPageContent connectionsOnly={connectionsOnly} />
    </Suspense>
  );
}
