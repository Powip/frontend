"use client";

import { useId } from "react";
import { PendingIntegration } from "@/components/panel-control/PanelStates";
import { PANEL_ROLE_POLICIES } from "@/features/panel-control/shared/config/panel-roles.config";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";

export function PreviewAsesorPrompt() {
  const { view, dispatch } = usePanel();
  const { asesores } = usePanelOptions();
  const id = useId();
  if (view.access !== "permitido") return null;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-pc-border bg-pc-card p-5">
      <h3 className="text-sm font-semibold text-pc-text">
        Elige a quién previsualizar como {PANEL_ROLE_POLICIES[view.role].etiqueta}
      </h3>
      <p className="mt-1 text-xs text-pc-text-muted">
        Esta vista siempre se filtra por una asesora. La previsualización no cambia permisos reales.
      </p>
      {asesores.status === "listo" ? (
        <div className="mt-3 flex flex-col gap-1">
          <label
            htmlFor={id}
            className="text-[10.5px] font-bold uppercase tracking-wide text-pc-text-muted"
          >
            Asesora
          </label>
          <select
            id={id}
            defaultValue=""
            onChange={(event) =>
              dispatch({ type: "set_preview_asesor", asesorId: event.target.value || null })
            }
            className="h-9 rounded-lg border border-pc-border bg-pc-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {(asesores.data ?? []).map((asesor) => (
              <option key={asesor.id} value={asesor.id}>
                {asesor.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : asesores.status === "cargando" ? (
        <p className="mt-3 text-xs text-pc-text-muted" role="status">
          Cargando asesoras…
        </p>
      ) : (
        <div className="mt-3">
          <PendingIntegration
            origin={asesores.origin}
            titulo="No se pudo obtener la lista de asesoras"
          />
        </div>
      )}
    </div>
  );
}
