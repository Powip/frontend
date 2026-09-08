"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Badge de estado Shalom a partir de `order.shalomStatus` (lo que ya
 * guardó el backend vía webhook, sin fetch en vivo) — extraído de
 * `ShalomOrderTrackingView` para poder mostrar el mismo estado
 * (Entregado/En tránsito/etc.) en cualquier tabla de pedidos, no solo en
 * la pestaña dedicada de Shalom.
 */
export function ShalomStatusBadge({
  status,
  error,
}: {
  status?: string | null;
  error?: string | null;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300 text-[10px]">
        Sin registrar
      </Badge>
    );
  }
  if (status === "PENDIENTE" || status === "EXITOSO") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
        ✅ Registrado
      </Badge>
    );
  }
  if (status === "FALLIDO") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
          ❌ Fallido
        </Badge>
        {error && (
          <span className="text-[9px] text-red-500 max-w-[140px] truncate" title={error}>
            {error}
          </span>
        )}
      </div>
    );
  }
  if (status === "EN_TRANSITO") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
        🚚 En tránsito
      </Badge>
    );
  }
  if (status === "EN_DESTINO") {
    return (
      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
        📍 En destino
      </Badge>
    );
  }
  if (status === "EN_REPARTO") {
    return (
      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
        🛵 En reparto
      </Badge>
    );
  }
  if (status === "ENTREGADO") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
        📦 Entregado
      </Badge>
    );
  }
  if (status === "DEVUELTO") {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
        🔄 Devuelto
      </Badge>
    );
  }
  if (status === "CANCELADO") {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300 text-[10px]">
        ✖ Cancelado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
      {status}
    </Badge>
  );
}
