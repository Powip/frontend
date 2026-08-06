"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

/** Indica si una fila viene de un cierre guardado a mano o se autocompletó desde pedidos reales. */
export function CcCierreDiaEstadoBadge({ isAuto }: { isAuto: boolean }) {
  if (isAuto) {
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-800 gap-1">
        <Sparkles className="h-3 w-3" /> Automático
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800">
      Guardado
    </Badge>
  );
}
