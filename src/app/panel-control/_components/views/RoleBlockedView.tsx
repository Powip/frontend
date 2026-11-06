"use client";

import { ShieldQuestion } from "lucide-react";
import { PANEL_ROLE_POLICIES } from "@/features/panel-control/shared/config/panel-roles.config";
import {
  PANEL_ROLE_PERMISSION_CLAIMS,
  PANEL_ROLES,
} from "@/features/panel-control/shared/models/panel-role.model";

interface RoleBlockedViewProps {
  rolJwt: string | null;
  motivo: string;
}

export function RoleBlockedView({ rolJwt, motivo }: RoleBlockedViewProps) {
  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-pc-border bg-pc-card p-6">
        <div className="flex items-center gap-3">
          <ShieldQuestion className="size-6 text-pc-warn" aria-hidden />
          <h2 className="text-lg font-bold text-pc-text">
            Tu rol todavía no tiene una vista del panel
          </h2>
        </div>
        <p className="mt-3 text-sm text-pc-text-muted">
          Rol recibido: <b className="text-pc-text">{rolJwt ?? "sin rol"}</b>. {motivo}.
        </p>
        <p className="mt-3 text-sm text-pc-text-muted">
          Contrato pendiente: el JWT debe incluir uno de estos permisos para asignar la vista del
          panel:
        </p>
        <ul className="mt-2 grid gap-1 text-xs">
          {PANEL_ROLES.map((role) => (
            <li key={role} className="flex gap-2">
              <code className="rounded bg-pc-surface-muted px-1.5 py-0.5">
                {PANEL_ROLE_PERMISSION_CLAIMS[role]}
              </code>
              <span className="text-pc-text-muted">→ {PANEL_ROLE_POLICIES[role].etiqueta}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
