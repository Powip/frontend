"use client";

import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { usePartnerLink } from "@/features/partners/hooks/use-partner-link";
import { usePartnerResources } from "@/features/partners/hooks/use-partner-resources";
import { PartnerLinkCard } from "./partner-link-card";
import { ShareKitCard } from "./share-kit-card";

export function LinkPageContent() {
  const linkQuery = usePartnerLink();
  const resourcesQuery = usePartnerResources();

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-2">
      <h2 className="sr-only">Mi link y código</h2>

      {linkQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar tu link y código."
          onRetry={() => linkQuery.refetch()}
        />
      ) : (
        <PartnerLinkCard link={linkQuery.data} isLoading={linkQuery.isLoading} />
      )}

      <ShareKitCard
        link={linkQuery.data}
        resources={resourcesQuery.data}
        isLoadingResources={resourcesQuery.isLoading}
        isResourcesError={resourcesQuery.isError}
        onRetryResources={() => resourcesQuery.refetch()}
      />
    </div>
  );
}
