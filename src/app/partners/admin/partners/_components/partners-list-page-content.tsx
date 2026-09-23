"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAdminPartners } from "@/features/partners/hooks/use-admin-partners";
import { useApproveAdminPartner } from "@/features/partners/hooks/use-approve-admin-partner";
import { AdminPartnersTable } from "./admin-partners-table";
import { InvitePartnerDialog } from "./invite-partner-dialog";

export function PartnersListPageContent() {
  const partnersQuery = useAdminPartners();
  const approvePartner = useApproveAdminPartner();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setApprovingId(id);
    approvePartner.mutate(id, {
      onSettled: () => setApprovingId(null),
    });
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Partners</CardTitle>
          <Button onClick={() => setIsInviteOpen(true)}>+ Invitar partner</Button>
        </CardHeader>
        <CardContent>
          {partnersQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar los partners."
              onRetry={() => partnersQuery.refetch()}
            />
          ) : (
            <AdminPartnersTable
              partners={partnersQuery.data}
              isLoading={partnersQuery.isLoading}
              approvingId={approvingId}
              onApprove={handleApprove}
            />
          )}
        </CardContent>
      </Card>

      <InvitePartnerDialog isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </div>
  );
}
