"use client";

import { Button } from "@/components/ui/button";
import type { User } from "@/interfaces/IUser";
import { loginOf } from "@/services/userListing";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { UsersModalShell } from "./UsersModalShell";
import { roleStyle } from "./usersTheme";

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
      size="md"
      icon="📋"
      iconClassName="bg-teal-100 dark:bg-teal-500/20"
      title={user ? `Resumen — ${fullName}` : "Resumen"}
      subtitle="Perfil y estado del colaborador"
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      }
    >
      {user && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`max-w-full break-words rounded-md px-2.5 py-0.5 text-xs font-semibold ${roleStyle(roleName).pill}`}>
              {roleName || "Sin rol"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${user.status === true ? "bg-green-500" : "bg-muted-foreground/50"}`}
              />
              {user.status === true ? "Activo" : "Inactivo"}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="user-summary-activity" className="space-y-2">
            <h3 id="user-summary-activity" className="text-sm font-medium">
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
