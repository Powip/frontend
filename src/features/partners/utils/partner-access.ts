import { getHttpStatus, toPartnersApiError } from "../mappers/to-partner-identity-from-error";
import type { PartnerIdentity } from "../models/partner-identity";
import type { PartnerPermission } from "../models/partner-permission.enum";
import type { PartnerProfile } from "../models/partner-profile";
import type { PartnerStatus } from "../models/partner-status.enum";

export type PartnerAccess =
  | { kind: "loading" }
  | { kind: "error"; correlationId: string | null }
  | { kind: "unauthorized" }
  | { kind: "no_profile" }
  | { kind: "suspended" }
  | { kind: "inactive"; status: Exclude<PartnerStatus, "active" | "suspended"> }
  | { kind: "active"; profile: PartnerProfile };

interface PartnerIdentityQueryState {
  data: PartnerIdentity | undefined;
  error: Error | null;
}

const ROUTE_PERMISSIONS: { href: string; permission: PartnerPermission }[] = [
  { href: "/partners/referidos", permission: "REFERRALS_READ" },
  { href: "/partners/comisiones", permission: "COMMISSIONS_READ" },
  { href: "/partners/pagos", permission: "PAYOUTS_READ" },
];

function toInactiveAccess(status: PartnerStatus): PartnerAccess {
  if (status === "suspended") return { kind: "suspended" };
  if (status === "active") return { kind: "inactive", status: "unknown" };
  return { kind: "inactive", status };
}

export function resolvePartnerAccess({ data, error }: PartnerIdentityQueryState): PartnerAccess {
  if (data) {
    switch (data.kind) {
      case "not_partner":
        return { kind: "no_profile" };
      case "not_active":
        return toInactiveAccess(data.status);
      case "partner":
        return data.profile.status === "active"
          ? { kind: "active", profile: data.profile }
          : toInactiveAccess(data.profile.status);
    }
  }

  if (error) {
    if (getHttpStatus(error) === 401) {
      return { kind: "unauthorized" };
    }
    return { kind: "error", correlationId: toPartnersApiError(error)?.correlationId ?? null };
  }

  return { kind: "loading" };
}

export function hasPartnerPermission(
  profile: Pick<PartnerProfile, "permissions">,
  permission: PartnerPermission,
): boolean {
  return profile.permissions.includes(permission);
}

export function getRequiredPartnerPermission(pathname: string): PartnerPermission | null {
  const match = ROUTE_PERMISSIONS.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return match?.permission ?? null;
}

export function isPartnerAdminPath(pathname: string): boolean {
  return pathname === "/partners/admin" || pathname.startsWith("/partners/admin/");
}
