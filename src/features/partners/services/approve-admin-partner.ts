import { updateAdminPartner } from "../mocks/admin-partners.store";
import type { AdminPartner } from "../models/admin-partner";

function suggestCode(name: string): string {
  const base = name.split(" ")[0]?.toUpperCase().slice(0, 5) ?? "PART";
  return `${base}10`;
}

export async function approveAdminPartner(id: string): Promise<AdminPartner> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const current = updateAdminPartner(id, {});
  if (!current) {
    throw new Error("Partner no encontrado");
  }

  const commissionOptionCode = current.profile === "creador" ? "C" : "A";

  const updated = updateAdminPartner(id, {
    status: "activo",
    code: current.code ?? suggestCode(current.name),
    commissionOptionCode,
    joinedAt: new Date().toISOString().slice(0, 10),
  });

  if (!updated) {
    throw new Error("Partner no encontrado");
  }

  return updated;
}
