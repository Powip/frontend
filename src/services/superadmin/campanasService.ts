import { CanalCampana, EstadoCampana, ICampana } from "@/interfaces/superadmin";
import { campanasMock } from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import { mockDelay } from "./shared";

export async function getCampanas(): Promise<ICampana[]> {
  return mockDelay([...campanasMock]);
}

export async function getKpisCampanas() {
  const activas = campanasMock.filter((c) => c.estado === "activa").length;
  const enviados = campanasMock.reduce((acc, c) => acc + c.enviados, 0);
  const conEnvios = campanasMock.filter((c) => c.enviados > 0);
  const aperturaProm = conEnvios.length
    ? conEnvios.reduce((acc, c) => acc + c.aperturaPct, 0) / conEnvios.length
    : 0;
  const conversionProm = conEnvios.length
    ? conEnvios.reduce((acc, c) => acc + c.conversionPct, 0) / conEnvios.length
    : 0;
  return mockDelay({
    activas,
    enviados,
    aperturaProm: Math.round(aperturaProm * 10) / 10,
    conversionProm: Math.round(conversionProm * 10) / 10,
  });
}

export interface NuevaCampanaInput {
  nombre: string;
  segmento: string;
  canal: CanalCampana;
  mensaje: string;
}

/** Simula POST /campanas — agrega la campaña como borrador (Sección 8.20). */
export async function crearCampana(input: NuevaCampanaInput): Promise<ICampana> {
  const nueva: ICampana = {
    id: nextId("camp"),
    nombre: input.nombre,
    segmento: input.segmento,
    canal: input.canal,
    estado: "borrador",
    enviados: 0,
    aperturaPct: 0,
    conversionPct: 0,
    mensaje: input.mensaje,
    creadoEn: new Date().toISOString(),
  };
  campanasMock.unshift(nueva);
  return mockDelay(nueva, 400);
}

/** Alterna activa <-> pausada mutando el mock en memoria. */
export async function toggleCampana(id: string): Promise<ICampana | null> {
  const campana = campanasMock.find((c) => c.id === id);
  if (!campana) return mockDelay(null);
  const nuevoEstado: EstadoCampana = campana.estado === "activa" ? "pausada" : "activa";
  campana.estado = nuevoEstado;
  return mockDelay(campana, 300);
}
