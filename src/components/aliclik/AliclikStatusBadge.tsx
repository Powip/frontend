"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AliclikStatusBadgeProps {
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;
}

const DISPATCH_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  TO_PREPARE:   { label: "Por preparar",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  IN_TRANSIT:   { label: "En tránsito",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  DELIVERED:    { label: "Entregado",     cls: "bg-green-100 text-green-700 border-green-200" },
  RETURNED:     { label: "Devuelto",      cls: "bg-red-100 text-red-700 border-red-200" },
  CANCELED:     { label: "Cancelado",     cls: "bg-gray-100 text-gray-600 border-gray-200" },
  PENDING:      { label: "Pendiente",     cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  PICKED_UP:    { label: "Recogido",      cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

function formatSyncedAt(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export default function AliclikStatusBadge({
  aliclikDispatchStatus,
  aliclikSyncedAt,
}: AliclikStatusBadgeProps) {
  const hasData = !!aliclikDispatchStatus || !!aliclikSyncedAt;
  if (!hasData) return null;

  const mapped = aliclikDispatchStatus
    ? (DISPATCH_STATUS_MAP[aliclikDispatchStatus] ?? null)
    : null;

  const label = mapped?.label ?? aliclikDispatchStatus ?? "En Aliclik";
  const cls = mapped?.cls ?? "bg-purple-100 text-purple-700 border-purple-200";
  const title = aliclikSyncedAt
    ? `Sync: ${formatSyncedAt(aliclikSyncedAt)}`
    : "Enviado a Aliclik";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls} whitespace-nowrap`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
      {label}
    </span>
  );
}
