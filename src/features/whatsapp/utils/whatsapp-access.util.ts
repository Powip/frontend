import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";

export interface WhatsAppAccess {
  canManageConfiguration: boolean;
  customerServiceRolesPending: true;
}

export function resolveWhatsAppAccess(user: {
  role?: string | null;
  email?: string | null;
}): WhatsAppAccess {
  return {
    canManageConfiguration:
      isSuperadmin(user.email ?? undefined) || hasAdminAccess(user.role ?? undefined),
    customerServiceRolesPending: true,
  };
}
