import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppPermissionMatrix } from "@/features/whatsapp/models/settings-tab.model";
import type {
  AlertSettingsValues,
  ProtectionSettingsValues,
} from "@/features/whatsapp/schemas/settings-tab.schema";

export interface SettingsMutations {
  saveProtection?: (values: ProtectionSettingsValues) => Promise<void>;
  addOptOut?: (input: {
    phone: string;
    customerName: string | null;
    storeId: string;
    note: string | null;
  }) => Promise<void>;
  reactivateOptOut?: (input: { optOutId: string; note: string }) => Promise<void>;
  saveAlerts?: (values: AlertSettingsValues) => Promise<void>;
  savePermissions?: (matrix: WhatsAppPermissionMatrix) => Promise<void>;
}

export const SETTINGS_PENDING_REASON =
  "Pendiente de integración: todavía no se puede guardar en POWIP. No se guardó nada.";

export type SettingsSource<V> = { values: V; note: "pending" | "not-configured" | null };

export function resolveSettingsSource<T, V>(
  state: WhatsAppResourceState<T | null>,
  toValues: (settings: T | null) => V,
): SettingsSource<V> | null {
  if (state.kind === "pending-integration") return { values: toValues(null), note: "pending" };
  if (state.kind === "ready") {
    return { values: toValues(state.data), note: state.data === null ? "not-configured" : null };
  }
  return null;
}
