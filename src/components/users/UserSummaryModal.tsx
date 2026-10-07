"use client";

import type { User } from "@/interfaces/IUser";
import { loginOf } from "@/services/userListing";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { UsersModalShell } from "./UsersModalShell";
import { roleStyle, usersTheme } from "./usersTheme";

interface UserSummaryModalProps {
  user: User | null;
  onOpenChange: (open: boolean) => void;
}

const orDash = (value?: string | null) => value?.trim() || "—";

export function UserSummaryModal({ user, onOpenChange }: UserSummaryModalProps) {
  const fullName = user ? `${user.name} ${user.surname}`.trim() : "";
  const roleName = user?.role?.name?.trim();
  const location = user
    ? [user.district, user.province, user.department || user.city].filter(Boolean).join(", ")
    : "";

  const rows: Array<[string, string]> = user
    ? [
        ["Usuario", orDash(loginOf(user))],
        ["Email", orDash(user.email)],
        ["Documento", orDash(user.identityDocument)],
        ["Teléfono", orDash(user.phoneNumber)],
        ["Dirección", orDash(user.address)],
        ["Ubicación", orDash(location)],
        ["Género", orDash(user.gender)],
      ]
    : [];

  return (
    <UsersModalShell
      open={!!user}
      onOpenChange={onOpenChange}
      icon="📋"
      iconClassName="bg-[#e6f7f7]"
      title={user ? `Resumen — ${fullName}` : "Resumen"}
      subtitle="Perfil y estado del colaborador"
      footer={
        <button type="button" className={usersTheme.secondaryButton} onClick={() => onOpenChange(false)}>
          Cerrar
        </button>
      }
    >
      {user && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-[10px] px-2.5 py-0.5 text-[11px] font-semibold ${roleStyle(roleName).pill}`}>
              {roleName || "Sin rol"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] rounded-full ${user.status === true ? "bg-[#22c55e]" : "bg-[#b8b5cc]"}`}
              />
              {user.status === true ? "Activo" : "Inactivo"}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className={usersTheme.fieldLabel}>{label}</dt>
                <dd className="break-words text-[13px]">{value}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="user-summary-activity" className="space-y-2">
            <h3 id="user-summary-activity" className={usersTheme.sectionTitle}>
              Actividad
            </h3>
            <PendingBackendNotice title="Última conexión y actividad no disponibles">
              La actividad del colaborador todavía no está disponible.
            </PendingBackendNotice>
          </section>
        </div>
      )}
    </UsersModalShell>
  );
}
