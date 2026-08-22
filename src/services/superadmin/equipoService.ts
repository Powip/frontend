import { IMiembroPowip, RolInterno } from "@/interfaces/superadmin";
import { equipoPowipMock, ROL_MODULOS } from "@/mocks/superadmin";
import { mockDelay } from "./shared";

export async function getEquipo(): Promise<IMiembroPowip[]> {
  return mockDelay([...equipoPowipMock]);
}

export async function getKpisEquipo() {
  const total = equipoPowipMock.length;
  const roles = new Set(equipoPowipMock.map((m) => m.rol)).size;
  const invitaciones = equipoPowipMock.filter((m) => m.estado === "invitado").length;
  const superAdmins = equipoPowipMock.filter((m) => m.rol === "super").length;
  return mockDelay({ total, roles, invitaciones, superAdmins });
}

export interface NuevoMiembroInput {
  nombre: string;
  email: string;
  rol: RolInterno;
}

/** Simula POST /equipo (invitación) — Sección 8.11. Muta el mock en memoria. */
export async function invitarMiembro(input: NuevoMiembroInput): Promise<IMiembroPowip> {
  const nuevo: IMiembroPowip = {
    id: `team-new-${Date.now()}`,
    nombre: input.nombre,
    email: input.email,
    rol: input.rol,
    estado: "invitado",
    creadoEn: new Date().toISOString(),
  };
  equipoPowipMock.unshift(nuevo);
  return mockDelay(nuevo, 400);
}

/** Copia editable de ROL_MODULOS para la matriz de permisos (demo visual, no persiste). */
export async function getMatrizPermisos(): Promise<Record<RolInterno, string[]>> {
  const copia = Object.fromEntries(
    Object.entries(ROL_MODULOS).map(([rol, modulos]) => [rol, [...modulos]])
  ) as Record<RolInterno, string[]>;
  return mockDelay(copia);
}
