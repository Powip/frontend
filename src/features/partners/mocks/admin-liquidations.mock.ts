import type {
  AdminClawback,
  AdminLiquidationRow,
  AdminThresholdQueueItem,
} from "../models/admin-liquidation-row";

export const ADMIN_LIQUIDATIONS_MOCK: AdminLiquidationRow[] = [
  { id: "liq-maria-torres", partnerName: "María Torres", firstMonthAmount: 340, recurringAmount: 302, totalAmount: 642, paid: false },
  { id: "liq-joel-coila", partnerName: "Joel Coila", firstMonthAmount: 68, recurringAmount: 27, totalAmount: 95, paid: false },
  { id: "liq-dev-studio", partnerName: "Dev Studio", firstMonthAmount: 0, recurringAmount: 27, totalAmount: 27, paid: false },
];

export const ADMIN_CLAWBACKS_MOCK: AdminClawback[] = [
  { id: "clawback-moda-urbana", partnerName: "Moda Urbana", note: "canceló mes 1 · Joel", amount: -39.6 },
  { id: "clawback-bazar-lima", partnerName: "Bazar Lima", note: "reembolso · María", amount: -85.05 },
];

export const ADMIN_THRESHOLD_QUEUE_MOCK: AdminThresholdQueueItem[] = [
  { id: "threshold-carla-vega", partnerName: "Carla Vega", amount: 34, threshold: 50 },
];
