"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CurrentPartnerProvider } from "@/features/partners/context/current-partner.context";
import { usePartnerIdentity } from "@/features/partners/hooks/use-partner-identity";
import {
  getRequiredPartnerPermission,
  hasPartnerPermission,
  isPartnerAdminPath,
  resolvePartnerAccess,
} from "@/features/partners/utils/partner-access";
import { PartnerAccessState } from "./partner-access-state";
import { PartnersTabs } from "./partners-tabs";

interface PartnerPortalGateProps {
  children: ReactNode;
}

function PartnerPortalAccess({ children }: PartnerPortalGateProps) {
  const pathname = usePathname() ?? "";
  const identityQuery = usePartnerIdentity();
  const access = resolvePartnerAccess(identityQuery);

  if (access.kind !== "active") {
    return (
      <div className="flex-1 overflow-auto p-6">
        <PartnerAccessState state={access} onRetry={() => identityQuery.refetch()} />
      </div>
    );
  }

  const requiredPermission = getRequiredPartnerPermission(pathname);
  const canViewSection =
    requiredPermission === null || hasPartnerPermission(access.profile, requiredPermission);

  return (
    <CurrentPartnerProvider profile={access.profile}>
      <PartnersTabs permissions={access.profile.permissions} />
      <div className="flex-1 overflow-auto">
        {canViewSection ? (
          children
        ) : (
          <div className="p-6">
            <PartnerAccessState state={{ kind: "forbidden_section" }} />
          </div>
        )}
      </div>
    </CurrentPartnerProvider>
  );
}

export function PartnerPortalGate({ children }: PartnerPortalGateProps) {
  const pathname = usePathname() ?? "";

  if (isPartnerAdminPath(pathname)) {
    return <div className="flex-1 overflow-auto">{children}</div>;
  }

  return <PartnerPortalAccess>{children}</PartnerPortalAccess>;
}
