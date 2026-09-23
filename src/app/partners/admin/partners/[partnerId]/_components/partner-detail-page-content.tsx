"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminPartner } from "@/features/partners/hooks/use-admin-partner";
import { useAdminPartnerReferrals } from "@/features/partners/hooks/use-admin-partner-referrals";
import { PartnerActivityTab } from "./partner-activity-tab";
import { PartnerDetailHeader } from "./partner-detail-header";
import { PartnerDetailKpis } from "./partner-detail-kpis";
import { PartnerReferralsTab } from "./partner-referrals-tab";

interface PartnerDetailPageContentProps {
  partnerId: string;
}

export function PartnerDetailPageContent({ partnerId }: PartnerDetailPageContentProps) {
  const partnerQuery = useAdminPartner(partnerId);
  const referralsQuery = useAdminPartnerReferrals(partnerId);

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
        <PartnerSectionError
          message="No pudimos cargar la ficha del partner."
          onRetry={() => partnerQuery.refetch()}
        />
      ) : !partnerQuery.isLoading && partnerQuery.data === null ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No encontramos este partner.
        </p>
      ) : (
        <>
          <PartnerDetailHeader partner={partnerQuery.data} isLoading={partnerQuery.isLoading} />
          <PartnerDetailKpis partner={partnerQuery.data} isLoading={partnerQuery.isLoading} />

          <Tabs defaultValue="referidos">
            <TabsList>
              <TabsTrigger value="referidos">Referidos</TabsTrigger>
              <TabsTrigger value="actividad">Actividad</TabsTrigger>
            </TabsList>
            <TabsContent value="referidos" className="pt-4">
              {referralsQuery.isError ? (
                <PartnerSectionError
                  message="No pudimos cargar los referidos."
                  onRetry={() => referralsQuery.refetch()}
                />
              ) : (
                <PartnerReferralsTab referrals={referralsQuery.data} isLoading={referralsQuery.isLoading} />
              )}
            </TabsContent>
            <TabsContent value="actividad" className="pt-4">
              <PartnerActivityTab
                partner={partnerQuery.data}
                referrals={referralsQuery.data}
                isLoading={partnerQuery.isLoading || referralsQuery.isLoading}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
