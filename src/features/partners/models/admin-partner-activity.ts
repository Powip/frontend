import type { AdminPage } from "./admin-partner";

export interface AdminPartnerActivity {
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
}

export type AdminPartnerActivityPage = AdminPage<AdminPartnerActivity>;
