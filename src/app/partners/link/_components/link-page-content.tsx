"use client";

import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { usePartnerLink } from "@/features/partners/hooks/use-partner-link";
import { usePartnerResources } from "@/features/partners/hooks/use-partner-resources";
import { PartnerLinkCard } from "./partner-link-card";
import { ShareKitCard } from "./share-kit-card";

export function LinkPageContent() {
  const partner = useCurrentPartner();
  const linkQuery = usePartnerLink();
  const resourcesQuery = usePartnerResources();

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-2">
      <h2 className="sr-only">Mi link y código</h2>

      <PartnerLinkCard
        referralLink={partner.referralLink}
        referralCode={partner.referralCode}
        metrics={linkQuery.data}
        isLoadingMetrics={linkQuery.isLoading}
        isMetricsError={linkQuery.isError}
        metricsError={linkQuery.error}
        onRetryMetrics={() => linkQuery.refetch()}
      />

      <ShareKitCard
        referralLink={partner.referralLink}
        referralCode={partner.referralCode}
        resources={resourcesQuery.data}
        isLoadingResources={resourcesQuery.isLoading}
        isResourcesError={resourcesQuery.isError}
        resourcesError={resourcesQuery.error}
        onRetryResources={() => resourcesQuery.refetch()}
      />
    </div>
  );
}
