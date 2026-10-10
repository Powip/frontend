"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import { advertisingErrorMessage } from "@/services/advertisingService";
import { AdvertisingEffectiveSpend } from "./AdvertisingEffectiveSpend";

export function AdvertisingCompanySpend({ from, to }: { from: string; to: string }) {
  const { auth } = useAuth();
  const query = useAdvertisingSnapshot({
    token: auth?.accessToken,
    actorId: auth?.user?.id,
    companyId: auth?.company?.id,
    from,
    to,
  });
  if (!auth?.accessToken || !auth.user?.id || !auth.company?.id) return null;
  if (query.isLoading)
    return <Skeleton className="h-48 rounded-xl" aria-label="Cargando consumo publicitario" />;
  if (query.isError || !query.data) {
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{advertisingErrorMessage(query.error)}</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!query.data.effective)
    return (
      <Alert>
        <AlertDescription>
          Actualiza el servicio de publicidad para consultar el consumo conciliado.
        </AlertDescription>
      </Alert>
    );
  return (
    <AdvertisingEffectiveSpend effective={query.data.effective} from={from} to={to} showLink />
  );
}
