import { EstadoSuscripcion, ISuscripcion, PlanEmpresa } from "@/interfaces/superadmin";
import { suscripcionesMock, mrrHistoricoMock, mrrPorPlanMock } from "@/mocks/superadmin";
import { mockDelay, matchesQuery, paginate, PageParams, PagedResponse } from "./shared";

export interface SuscripcionesFilters extends PageParams {
  q?: string;
  estado?: EstadoSuscripcion | "todos";
  plan?: PlanEmpresa | "todos";
}

export async function getSuscripciones(filters: SuscripcionesFilters = {}): Promise<PagedResponse<ISuscripcion>> {
  let items = [...suscripcionesMock];
  if (filters.estado && filters.estado !== "todos") items = items.filter((s) => s.estado === filters.estado);
  if (filters.plan && filters.plan !== "todos") items = items.filter((s) => s.plan === filters.plan);
  if (filters.q) items = items.filter((s) => matchesQuery([s.empresaNombre, s.plan, s.metodoPago], filters.q!));
  return mockDelay(paginate(items, filters));
}

export async function getKpisSuscripciones() {
  const activas = suscripcionesMock.filter((s) => s.estado === "activa");
  const trial = suscripcionesMock.filter((s) => s.estado === "trial");
  const vencidas = suscripcionesMock.filter((s) => s.estado === "vencida");
  const canceladas = suscripcionesMock.filter((s) => s.estado === "cancelada");
  const mrrTotal = activas.reduce((sum, s) => sum + s.mrr, 0);
  const nuevas30d = suscripcionesMock.filter((s) => {
    const dias = (Date.now() - new Date(s.creadoEn).getTime()) / 86400000;
    return dias <= 30;
  }).length;
  const totalConsiderado = activas.length + vencidas.length + canceladas.length || 1;
  const tasaChurnPct = Math.round((canceladas.length / totalConsiderado) * 1000) / 10;
  return mockDelay({
    mrrTotal,
    arr: mrrTotal * 12,
    activas: activas.length,
    trial: trial.length,
    vencidas: vencidas.length,
    canceladas: canceladas.length,
    nuevas30d,
    tasaChurnPct,
  });
}

export async function getProximosVencimientos(limit = 8) {
  const activas = suscripcionesMock.filter((s) => s.estado === "activa" || s.estado === "trial");
  const ordenadas = [...activas].sort((a, b) => new Date(a.proximoPago).getTime() - new Date(b.proximoPago).getTime());
  return mockDelay(ordenadas.slice(0, limit));
}

export async function getMrrHistoricoSuscripciones() {
  return mockDelay(mrrHistoricoMock);
}

export async function getMrrPorPlan() {
  return mockDelay(mrrPorPlanMock);
}

export async function getEstadoSuscripcionesResumen() {
  const conteos: Record<EstadoSuscripcion, number> = { activa: 0, trial: 0, vencida: 0, cancelada: 0 };
  suscripcionesMock.forEach((s) => {
    conteos[s.estado] += 1;
  });
  return mockDelay(conteos);
}
