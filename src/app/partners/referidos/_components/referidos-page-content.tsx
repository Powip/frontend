"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { useReferrals } from "@/features/partners/hooks/use-referrals";
import { hasPartnerPermission } from "@/features/partners/utils/partner-access";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";
import { filterReferrals, type ReferralFilterKey } from "../_lib/referral-filters";
import { ReferralDetailDrawer } from "./referral-detail-drawer";
import { ReferralFilters } from "./referral-filters";
import { RegisterReferralDialog } from "./register-referral-dialog";
import { ReferralsTable } from "./referrals-table";

export function ReferidosPageContent() {
  const partner = useCurrentPartner();
  const canCreateReferral = hasPartnerPermission(partner, "REFERRALS_CREATE");
  const referralsQuery = useReferrals();
  const [filter, setFilter] = useState<ReferralFilterKey>("all");
  const [selectedReferral, setSelectedReferral] = useState<PartnerReferral | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const referrals = useMemo(
    () => referralsQuery.data?.pages.flatMap((page) => page.items),
    [referralsQuery.data],
  );

  const filteredReferrals = useMemo(() => {
    if (!referrals) return undefined;
    return filterReferrals(referrals, filter);
  }, [referrals, filter]);

  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Mis referidos</CardTitle>
          {canCreateReferral && (
            <Button onClick={() => setIsRegisterOpen(true)}>+ Registrar referido</Button>
          )}
        </CardHeader>
        <CardContent>
          <ReferralFilters value={filter} onChange={setFilter} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="space-y-4">
          {referralsQuery.isError && !referrals ? (
            <PartnerSectionError
              message="No pudimos cargar tus referidos."
              onRetry={() => referralsQuery.refetch()}
            />
          ) : (
            <ReferralsTable
              referrals={filteredReferrals}
              isLoading={referralsQuery.isLoading}
              hasAnyReferral={(referrals?.length ?? 0) > 0}
              onSelectReferral={setSelectedReferral}
              onRegisterReferral={canCreateReferral ? () => setIsRegisterOpen(true) : undefined}
            />
          )}

          {referralsQuery.isFetchNextPageError && (
            <p role="alert" className="text-center text-sm text-destructive">
              No pudimos cargar más referidos.
            </p>
          )}

          {referralsQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => referralsQuery.fetchNextPage()}
                disabled={referralsQuery.isFetchingNextPage}
              >
                {referralsQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canCreateReferral && (
        <RegisterReferralDialog isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />
      )}
      <ReferralDetailDrawer referral={selectedReferral} onClose={() => setSelectedReferral(null)} />
    </div>
  );
}
