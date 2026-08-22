"use client";

import { Eye, X } from "lucide-react";
import { useSuperadminRole } from "./SuperadminRoleContext";
import { ROL_LABEL } from "@/interfaces/superadmin";

export function RolePreviewBanner() {
  const { viewingAs, isPreview, setViewingAs } = useSuperadminRole();
  if (!isPreview) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
      <Eye className="h-3.5 w-3.5" />
      Estás previsualizando la plataforma como <b>{ROL_LABEL[viewingAs]}</b> — no cambia permisos reales, solo la vista.
      <button
        onClick={() => setViewingAs("super")}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-amber-500/15 font-semibold"
      >
        <X className="h-3 w-3" />
        Salir de la vista previa
      </button>
    </div>
  );
}
