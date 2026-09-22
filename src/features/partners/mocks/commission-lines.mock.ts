import type { CommissionLine } from "../models/commission-line";

export const COMMISSION_LINES_MOCK: CommissionLine[] = [
  {
    id: "cl-livii-moda",
    businessName: "Livii Moda SAC",
    planName: "Standard",
    netFirstMonthAmount: 170.1,
    firstMonthCommission: 68.04,
    recurringCommission: 11.34,
    status: "activa",
  },
  {
    id: "cl-techperu-store",
    businessName: "TechPeru Store",
    planName: "Full",
    netFirstMonthAmount: 242.1,
    firstMonthCommission: 96.84,
    recurringCommission: 16.14,
    status: "activa",
  },
  {
    id: "cl-kunca-deco",
    businessName: "Kunca Deco",
    planName: "Standard",
    netFirstMonthAmount: null,
    firstMonthCommission: null,
    recurringCommission: null,
    status: "pendiente",
  },
  {
    id: "cl-zapateria-andes",
    businessName: "Zapatería Andes",
    planName: null,
    netFirstMonthAmount: null,
    firstMonthCommission: null,
    recurringCommission: null,
    status: "pendiente",
  },
  {
    id: "cl-moda-urbana",
    businessName: "Moda Urbana EIRL",
    planName: "Basic",
    netFirstMonthAmount: 89.1,
    firstMonthCommission: -35.64,
    recurringCommission: 0,
    status: "reverso",
  },
];

export const EMPTY_COMMISSION_LINES: CommissionLine[] = [];
