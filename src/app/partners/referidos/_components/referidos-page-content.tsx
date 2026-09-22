"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useReferrals } from "@/features/partners/hooks/use-referrals";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";
import { filterReferrals, type ReferralFilterKey } from "../_lib/referral-filters";
import { ReferralDetailDrawer } from "./referral-detail-drawer";
import { ReferralFilters } from "./referral-filters";
import { RegisterReferralDialog } from "./register-referral-dialog";
import { ReferralsTable } from "./referrals-table";

export function ReferidosPageContent() {
  const referralsQuery = useReferrals();
  const [filter, setFilter] = useState<ReferralFilterKey>("all");
  const [selectedReferral, setSelectedReferral] = useState<PartnerReferral | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const filteredReferrals = useMemo(() => {
    if (!referralsQuery.data) return undefined;
    return filterReferrals(referralsQuery.data, filter);
  }, [referralsQuery.data, filter]);

  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Mis referidos</CardTitle>
          <Button onClick={() => setIsRegisterOpen(true)}>+ Registrar referido</Button>
        </CardHeader>
        <CardContent>
          <ReferralFilters value={filter} onChange={setFilter} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent>
          {referralsQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar tus referidos."
              onRetry={() => referralsQuery.refetch()}
            />
          ) : (
            <ReferralsTable
              referrals={filteredReferrals}
              isLoading={referralsQuery.isLoading}
              hasAnyReferral={(referralsQuery.data?.length ?? 0) > 0}
              onSelectReferral={setSelectedReferral}
              onRegisterReferral={() => setIsRegisterOpen(true)}
            />
          )}
        </CardContent>
      </Card>

      <RegisterReferralDialog isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />
      <ReferralDetailDrawer referral={selectedReferral} onClose={() => setSelectedReferral(null)} />
    </div>
  );
}
