"use client";

import { PANEL_ROLE_POLICIES } from "@/features/panel-control/shared/config/panel-roles.config";
import {
  PANEL_ROLES,
  type PanelRole,
} from "@/features/panel-control/shared/models/panel-role.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { FilterSelect } from "./FilterSelect";

export function ViewAsControl() {
  const { view, dispatch } = usePanel();
  if (view.access !== "permitido") return null;
  const puedePrevisualizar = PANEL_ROLE_POLICIES[view.actualRole].capacidades.includes("ver_como");
  if (!puedePrevisualizar) return null;

  return (
    <FilterSelect
      label="Ver como"
      value={view.role}
      hint="Solo cambia lo que se muestra; los permisos reales los aplica el backend"
      onChange={(value) =>
        dispatch({
          type: "set_preview_role",
          role: value === view.actualRole ? null : (value as PanelRole),
        })
      }
    >
      {PANEL_ROLES.map((role) => (
        <option key={role} value={role}>
          Vista: {PANEL_ROLE_POLICIES[role].etiqueta}
        </option>
      ))}
    </FilterSelect>
  );
}
