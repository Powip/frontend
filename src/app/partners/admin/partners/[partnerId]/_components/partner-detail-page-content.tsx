"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminPartner } from "@/features/partners/hooks/use-admin-partner";
import { useAdminPartnerActivity } from "@/features/partners/hooks/use-admin-partner-activity";
import { useAdminPartnerReferrals } from "@/features/partners/hooks/use-admin-partner-referrals";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import { AdminReadAccessDenied, AdminReadError } from "../../../_components/admin-read-error";
import { PartnerActivityTab } from "./partner-activity-tab";
import { PartnerDetailHeader } from "./partner-detail-header";
import { PartnerDetailKpis } from "./partner-detail-kpis";
import { PartnerReferralsTab } from "./partner-referrals-tab";
import { PartnerStatusControls } from "./partner-status-controls";

export function PartnerDetailPageContent({ partnerId }: { partnerId: string }) {
  const access = useAdminReadAccess();
  const partnerQuery = useAdminPartner(partnerId);
  const referralsQuery = useAdminPartnerReferrals(
    partnerId,
    partnerQuery.isSuccess && !partnerQuery.isError,
  );
  const activityQuery = useAdminPartnerActivity(
    partnerId,
    partnerQuery.isSuccess && !partnerQuery.isError,
  );
  if (access.denied)
    return (
      <div className="p-6">
        <AdminReadError
          error={access.denied}
          message="No pudimos verificar tu acceso a Partners."
        />
      </div>
    );
  if (!access.canView)
    return (
      <div className="p-6">
        <AdminReadAccessDenied />
      </div>
    );
  return (
    <div className="space-y-4 p-6">
      <Link
        href="/partners/admin/partners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver a Partners
      </Link>
      {partnerQuery.isError ? (
        getHttpStatus(partnerQuery.error) === 404 ? (
          <p role="status" className="py-16 text-center text-sm text-muted-foreground">
            No encontramos este partner.
          </p>
        ) : (
          <AdminReadError
            message="No pudimos cargar la ficha del partner."
            onRetry={() => partnerQuery.refetch()}
            error={partnerQuery.error}
          />
        )
      ) : (
        <>
          <PartnerDetailHeader partner={partnerQuery.data} isLoading={partnerQuery.isLoading} />
          {partnerQuery.data ? (
            <Link
              className="inline-block text-sm underline"
              href={`/partners/admin/partners/${encodeURIComponent(partnerQuery.data.id)}/libro`}
            >
              Consultar libro y saldo contable · solo lectura
            </Link>
          ) : null}
          {partnerQuery.data ? <PartnerStatusControls partner={partnerQuery.data} /> : null}
          <PartnerDetailKpis partner={partnerQuery.data} isLoading={partnerQuery.isLoading} />
          {partnerQuery.data ? (
            <Tabs defaultValue="referidos">
              <TabsList>
                <TabsTrigger value="referidos">Referidos y atribuciones</TabsTrigger>
                <TabsTrigger value="actividad">Actividad</TabsTrigger>
              </TabsList>
              <TabsContent value="referidos" className="space-y-4 pt-4">
                {referralsQuery.isError ? (
                  <AdminReadError
                    message="No pudimos cargar los referidos."
                    onRetry={() => referralsQuery.refetch()}
                    error={referralsQuery.error}
                  />
                ) : (
                  <>
                    <PartnerReferralsTab
                      referrals={referralsQuery.data?.pages.flatMap((page) => page.items)}
                      isLoading={referralsQuery.isLoading}
                    />
                    {referralsQuery.hasNextPage ? (
                      <Button
                        variant="outline"
                        disabled={referralsQuery.isFetchingNextPage}
                        onClick={() => referralsQuery.fetchNextPage()}
                      >
                        Cargar más registros
                      </Button>
                    ) : null}
                  </>
                )}
              </TabsContent>
              <TabsContent value="actividad" className="space-y-4 pt-4">
                {activityQuery.isError ? (
                  <AdminReadError
                    message="No pudimos cargar la actividad."
                    onRetry={() => activityQuery.refetch()}
                    error={activityQuery.error}
                  />
                ) : (
                  <>
                    <PartnerActivityTab
                      activity={activityQuery.data?.pages.flatMap((page) => page.items)}
                      isLoading={activityQuery.isLoading}
                    />
                    {activityQuery.hasNextPage ? (
                      <Button
                        variant="outline"
                        disabled={activityQuery.isFetchingNextPage}
                        onClick={() => activityQuery.fetchNextPage()}
                      >
                        Cargar más eventos
                      </Button>
                    ) : null}
                  </>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </>
      )}
    </div>
  );
}
