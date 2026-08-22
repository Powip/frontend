import { auditLogMock } from "@/mocks/superadmin";
import { mockDelay, matchesQuery } from "./shared";

export async function getAuditLog(q?: string) {
  let items = [...auditLogMock];
  if (q) items = items.filter((a) => matchesQuery([a.actorNombre, a.accion, a.entidad], q));
  return mockDelay(items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()));
}
