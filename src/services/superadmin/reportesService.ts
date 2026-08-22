import { IReporteDisponible, IReporteProgramado } from "@/interfaces/superadmin";
import { reportesDisponiblesMock, reportesProgramadosMock } from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import { mockDelay } from "./shared";

export async function getReportesDisponibles(): Promise<IReporteDisponible[]> {
  return mockDelay([...reportesDisponiblesMock]);
}

export async function getReportesProgramados(): Promise<IReporteProgramado[]> {
  return mockDelay([...reportesProgramadosMock]);
}

/** Alterna activo/inactivo de un reporte programado, mutando el mock. */
export async function toggleReporteProgramado(id: string): Promise<IReporteProgramado | null> {
  const reporte = reportesProgramadosMock.find((r) => r.id === id);
  if (!reporte) return mockDelay(null);
  reporte.activo = !reporte.activo;
  return mockDelay(reporte, 300);
}

export interface NuevoReporteProgramadoInput {
  reporte: string;
  frecuencia: IReporteProgramado["frecuencia"];
  destinatario: string;
}

/** Simula POST /reportes-programados (Sección 8.21). */
export async function crearReporteProgramado(input: NuevoReporteProgramadoInput): Promise<IReporteProgramado> {
  const nuevo: IReporteProgramado = {
    id: nextId("repp"),
    reporte: input.reporte,
    frecuencia: input.frecuencia,
    destinatario: input.destinatario,
    proximoEnvio: new Date(Date.now() + 7 * 86400000).toISOString(),
    activo: true,
  };
  reportesProgramadosMock.unshift(nuevo);
  return mockDelay(nuevo, 400);
}
