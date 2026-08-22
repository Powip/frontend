import {
  mrrWaterfallMock,
  ingresosFuenteMock,
  cobrosMock,
  cohortesMock,
  mrrHistoricoMock,
} from "@/mocks/superadmin";
import { mockDelay } from "./shared";

/**
 * Meta de facturación mensual — Sección 8.7 ("meta del mes vs avance").
 * La spec permite inventar una meta razonable ya que no viene en el mock.
 */
export const META_MES = 50000;

/**
 * KPIs de resumen del mes — Sección 8.7.
 * Regla de oro: nunca recalcular dinero, solo leer/sumar lo que ya viene en los mocks.
 */
export async function getResumenMes() {
  const cierre = mrrWaterfallMock.find((w) => w.tipo === "cierre")?.valor ?? 0;
  const inicial = mrrWaterfallMock.find((w) => w.tipo === "inicial")?.valor ?? 0;
  const mrrActual = mrrHistoricoMock.length >= 2 ? mrrHistoricoMock[mrrHistoricoMock.length - 2].mrr : mrrHistoricoMock[0]?.mrr ?? 0;
  const mrrProyectado = mrrHistoricoMock[mrrHistoricoMock.length - 1]?.mrr ?? 0;
  return mockDelay({
    facturadoMes: cierre,
    proyeccionCierre: cierre,
    mrrActual,
    mrrProyectado,
    mrrInicial: inicial,
    meta: META_MES,
    avancePct: Math.min(100, Math.round((cierre / META_MES) * 100)),
  });
}

export async function getMrrWaterfall() {
  return mockDelay(mrrWaterfallMock);
}

export async function getIngresosFuente() {
  return mockDelay(ingresosFuenteMock);
}

export async function getCobros() {
  return mockDelay(cobrosMock);
}

export async function getCohortes() {
  return mockDelay(cohortesMock);
}

export async function getMrrHistorico() {
  return mockDelay(mrrHistoricoMock);
}
