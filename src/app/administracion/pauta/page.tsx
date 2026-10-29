"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AdvertisingAssignedSpendV11 } from "@/components/advertising/AdvertisingAssignedSpendV11";
import { AdvertisingLivePanel } from "@/components/advertising/AdvertisingLivePanel";
import { advertisingPeriodFromParams } from "@/components/advertising/advertising-period";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";

const ManualAdvertisingPage = dynamic(() => import("./ManualAdvertisingPage"), {
  loading: () => <Skeleton className="h-48 w-full" />,
});

function AdvertisingPageContent() {
  const { auth } = useAuth();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
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

  if (!ready)
    return <Skeleton className="h-48 w-full" aria-label="Cargando periodo de inversión" />;

  return (
    <div className="space-y-5">
      <AdvertisingAssignedSpendV11 from={fromDate} to={toDate} />
      <AdvertisingLivePanel
        key={`${auth?.user.id}:${auth?.company?.id}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        companyName={auth?.company?.name ?? "Mi empresa"}
        from={fromDate}
        to={toDate}
        storeIds={storeIds}
        manualContent={<ManualAdvertisingPage />}
      />
    </div>
  );
}

export default function AdvertisingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <AdvertisingPageContent />
    </Suspense>
  );
}
