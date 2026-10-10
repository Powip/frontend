"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAdminPartners } from "@/features/partners/hooks/use-admin-partners";
import { AdminPartnersTable } from "./admin-partners-table";

export function PartnersListPageContent() {
  const partnersQuery = useAdminPartners();

  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Partners</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/partners/admin/solicitudes">Revisar solicitudes</Link>
            </Button>
            <Button disabled title="Las invitaciones todavía no están implementadas.">
              + Invitar partner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {partnersQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar los partners."
              onRetry={() => partnersQuery.refetch()}
              error={partnersQuery.error}
            />
          ) : (
            <AdminPartnersTable partners={partnersQuery.data} isLoading={partnersQuery.isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
