import { IIntegracion } from "@/interfaces/superadmin";
import { integracionesMock } from "@/mocks/superadmin";
import { mockDelay } from "./shared";

export async function getIntegraciones(): Promise<IIntegracion[]> {
  return mockDelay([...integracionesMock]);
}

export async function getKpisIntegraciones() {
  const total = integracionesMock.length;
  const activas = integracionesMock.filter((i) => i.activa).length;
  const conError = integracionesMock.filter((i) => i.estado === "error").length;
  const uptimePromedio = total
    ? Number((integracionesMock.reduce((sum, i) => sum + i.uptimePct, 0) / total).toFixed(1))
    : 0;
  return mockDelay({ total, activas, conError, uptimePromedio });
}

/** Togglea `activa` en el mock. Al apagar, la integración pasa a "desconectado". */
export async function toggleIntegracion(id: string): Promise<IIntegracion | null> {
  const integracion = integracionesMock.find((i) => i.id === id);
  if (!integracion) return mockDelay(null);
  integracion.activa = !integracion.activa;
  if (!integracion.activa) integracion.estado = "desconectado";
  return mockDelay(integracion, 350);
}

/** Simula una reconexión: fuerza estado "operativo" y refresca el último evento. */
export async function reconectarIntegracion(id: string): Promise<IIntegracion | null> {
  const integracion = integracionesMock.find((i) => i.id === id);
  if (!integracion) return mockDelay(null);
  integracion.estado = "operativo";
  integracion.activa = true;
  integracion.uptimePct = 99.9;
  integracion.ultimoEvento = new Date().toISOString();
  return mockDelay(integracion, 500);
}
