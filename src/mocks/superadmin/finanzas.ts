import {
  ISuscripcion,
  IFactura,
  IMrrWaterfallItem,
  IIngresoFuente,
  ICobro,
  ICohorte,
  IMrrHistorico,
  IMrrPorPlan,
  PlanEmpresa,
} from "@/interfaces/superadmin";
import { daysAgoISO, daysFromNowISO, money, nextId } from "./seed";
import { empresasMock } from "./empresas";

export const suscripcionesMock: ISuscripcion[] = empresasMock.map((emp, i) => ({
  id: nextId("sus"),
  empresaId: emp.id,
  empresaNombre: emp.nombre,
  plan: emp.plan,
  mrr: emp.mrr,
  ciclo: i % 5 === 0 ? "anual" : "mensual",
  estado: emp.estado === "inactivo" ? "cancelada" : emp.plan === "Trial" ? "trial" : emp.estado === "riesgo" && i % 3 === 0 ? "vencida" : "activa",
  proximoPago: daysFromNowISO((i % 20) + 1),
  metodoPago: ["Tarjeta", "Transferencia", "Yape"][i % 3],
  addOns: i % 4 === 0 ? ["SUNAT Pro"] : [],
  creadoEn: emp.creadoEn,
}));

export const facturasMock: IFactura[] = suscripcionesMock
  .filter((s) => s.plan !== "Trial")
  .map((sus, i) => {
    const estado = i % 7 === 0 ? "vencido" : i % 3 === 0 ? "pendiente" : "pagado";
    return {
      id: `FAC-2026-${String(i + 1).padStart(4, "0")}`,
      empresaId: sus.empresaId,
      empresaNombre: sus.empresaNombre,
      plan: sus.plan,
      monto: sus.mrr,
      igv: Math.round(sus.mrr * 0.18 * 100) / 100,
      fechaEmision: daysAgoISO(5 + (i % 25)),
      fechaVence: estado === "vencido" ? daysAgoISO(3 + (i % 15)) : daysFromNowISO(5 + (i % 10)),
      metodo: sus.metodoPago,
      estado,
      diasVencida: estado === "vencido" ? 3 + (i % 15) : undefined,
      reintentos: estado === "vencido" ? 1 + (i % 3) : undefined,
    };
  });

export const mrrWaterfallMock: IMrrWaterfallItem[] = [
  { label: "MRR inicial", valor: 42800, tipo: "inicial" },
  { label: "Nuevo", valor: 5200, tipo: "positivo" },
  { label: "Expansión", valor: 1850, tipo: "positivo" },
  { label: "Downgrade", valor: -980, tipo: "negativo" },
  { label: "Churn", valor: -2340, tipo: "negativo" },
  { label: "MRR cierre", valor: 46530, tipo: "cierre" },
];

export const ingresosFuenteMock: IIngresoFuente[] = [
  { fuente: "Suscripciones", monto: 38400, pct: 71 },
  { fuente: "POWIP Payment", monto: 11200, pct: 21 },
  { fuente: "Add-ons", monto: 4300, pct: 8 },
];

export const cobrosMock: ICobro[] = facturasMock.slice(0, 20).map((f) => ({
  id: f.id,
  empresaNombre: f.empresaNombre,
  monto: f.monto,
  estado: f.estado,
  fecha: f.estado === "vencido" ? f.fechaVence : f.fechaEmision,
}));

export const cohortesMock: ICohorte[] = [
  { mes: "Mar 2026", tamano: 18, retencion: [100, 94, 89, 83, 78, 78] },
  { mes: "Abr 2026", tamano: 22, retencion: [100, 91, 86, 82, 79] },
  { mes: "May 2026", tamano: 15, retencion: [100, 93, 87, 84] },
  { mes: "Jun 2026", tamano: 26, retencion: [100, 96, 90] },
  { mes: "Jul 2026", tamano: 19, retencion: [100, 92] },
  { mes: "Ago 2026", tamano: 14, retencion: [100] },
];

export const mrrHistoricoMock: IMrrHistorico[] = [
  { mes: "Mar", mrr: 38200 },
  { mes: "Abr", mrr: 40100 },
  { mes: "May", mrr: 41500 },
  { mes: "Jun", mrr: 43800 },
  { mes: "Jul", mrr: 44900 },
  { mes: "Ago", mrr: 46530 },
];

export const mrrPorPlanMock: IMrrPorPlan[] = (() => {
  const totales = new Map<PlanEmpresa, number>();
  suscripcionesMock.forEach((s) => totales.set(s.plan, (totales.get(s.plan) || 0) + s.mrr));
  const total = Array.from(totales.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(totales.entries())
    .filter(([plan]) => plan !== "Trial")
    .map(([plan, mrr]) => ({ plan, mrr, pct: Math.round((mrr / total) * 1000) / 10 }));
})();
