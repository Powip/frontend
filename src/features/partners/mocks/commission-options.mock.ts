import type { CommissionOptionDetail } from "../models/commission-option-detail";

export const COMMISSION_OPTIONS_MOCK: CommissionOptionDetail[] = [
  {
    code: "A",
    label: "Agencias y developers",
    description: "Para agencias y developers que integran Powip a sus clientes.",
    firstMonthPct: 40,
    recurringPct: 6,
  },
  {
    code: "C",
    label: "Creadores",
    description: "Para creadores de contenido que recomiendan Powip a su audiencia.",
    firstMonthPct: 50,
    recurringPct: 8,
  },
  {
    code: "B",
    label: "Todos los perfiles",
    description: "Más pago al inicio y menos recurrente — para cualquier perfil.",
    firstMonthPct: 70,
    recurringPct: 3,
  },
];
