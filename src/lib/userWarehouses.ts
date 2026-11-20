import type { UserWarehouseAssignment } from "@/services/userWarehousesService";

// FEAT-24 H6 (H6-D5) — Configuración › Usuarios y almacenes: por usuario, qué
// almacenes ve y en cuáles opera. Sin filas el usuario ve y opera todos (lo de
// siempre); con filas, solo esos. Guardar REEMPLAZA la lista del usuario.

export type AccessLevel = "none" | "view" | "operate";

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  none: "No ve",
  view: "Ve",
  operate: "Ve y opera",
};

export interface UserWarehouseDraft {
  /** Sin restricciones: ve y opera todos los almacenes (lista vacía en el servidor). */
  all: boolean;
  /** Nivel por almacén (lo que no está = no lo ve). */
  levels: Record<string, AccessLevel>;
}

export function groupAssignments(items: UserWarehouseAssignment[]): Map<string, UserWarehouseAssignment[]> {
  const byUser = new Map<string, UserWarehouseAssignment[]>();
  for (const item of items) byUser.set(item.userId, [...(byUser.get(item.userId) ?? []), item]);
  return byUser;
}

export function draftFromAssignments(assignments: UserWarehouseAssignment[] | undefined): UserWarehouseDraft {
  if (!assignments || assignments.length === 0) return { all: true, levels: {} };
  return { all: false, levels: Object.fromEntries(assignments.map((item) => [item.inventoryId, item.canOperate ? "operate" : "view"])) };
}

const assigned = (draft: UserWarehouseDraft) =>
  Object.entries(draft.levels)
    .filter(([, level]) => level !== "none")
    .sort(([a], [b]) => a.localeCompare(b));

export function sameDraft(a: UserWarehouseDraft, b: UserWarehouseDraft): boolean {
  if (a.all !== b.all) return false;
  if (a.all) return true;
  return JSON.stringify(assigned(a)) === JSON.stringify(assigned(b));
}

export function draftProblem(draft: UserWarehouseDraft): string | null {
  if (draft.all) return null;
  return assigned(draft).length === 0 ? "Elige al menos un almacén o marca «Todos»: sin almacenes, el usuario vería todos." : null;
}

export function buildSaveBody(userId: string, draft: UserWarehouseDraft): { userId: string; warehouses: Array<{ inventoryId: string; canOperate: boolean }> } {
  if (draft.all) return { userId, warehouses: [] };
  return { userId, warehouses: assigned(draft).map(([inventoryId, level]) => ({ inventoryId, canOperate: level === "operate" })) };
}

/** Resumen corto para la fila: «Todos», «2 almacenes (1 opera)». */
export function draftSummary(draft: UserWarehouseDraft): string {
  if (draft.all) return "Todos los almacenes";
  const list = assigned(draft);
  const operate = list.filter(([, level]) => level === "operate").length;
  return `${list.length === 1 ? "1 almacén" : `${list.length} almacenes`} · opera en ${operate}`;
}
