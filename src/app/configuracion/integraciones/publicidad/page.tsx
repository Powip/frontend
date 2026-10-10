"use client";

import { format } from "date-fns";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AdvertisingLivePanel } from "@/components/advertising/AdvertisingLivePanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function AdvertisingIntegrationsPage() {
  const { auth, hasPermission } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const from = `${today.slice(0, 7)}-01`;

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <Button size="sm" variant="ghost" asChild>
        <Link href="/configuracion/integraciones">
          <ArrowLeft aria-hidden="true" />
          Integraciones
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">Cuentas de publicidad</h1>
          <p className="text-xs text-muted-foreground">{auth?.company?.name ?? "Mi empresa"}</p>
        </div>
        {hasPermission("VIEW_FINANCES") ? (
          <Button size="sm" variant="outline" asChild>
            <Link href="/administracion/pauta">
              Ver inversión
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
      <AdvertisingLivePanel
        key={`${auth?.user.id}:${auth?.company?.id}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        companyName={auth?.company?.name ?? "Mi empresa"}
        from={from}
        to={today}
        connectionsOnly
      />
    </main>
  );
}
