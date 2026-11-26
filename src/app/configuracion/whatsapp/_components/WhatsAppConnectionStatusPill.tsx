"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { WaDot } from "@/components/whatsapp/ui/WaPill";
import { useAuth } from "@/contexts/AuthContext";
import { WHATSAPP_CONNECTION_STATES } from "@/features/whatsapp/enums/whatsapp.enums";
import { getWhatsAppStatus } from "@/services/whatsappService";
import { useViewedStore } from "./viewed-store-context";

const MUTED_PILL =
  "inline-flex items-center gap-2 rounded-full border border-wa-border bg-wa-surface-2 px-3 py-[7px] text-[13px] font-semibold text-wa-muted";
const CONNECTED_PILL =
  "inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--wa-whatsapp)_30%,transparent)] bg-wa-whatsapp-soft px-3 py-[7px] text-[13px] font-semibold text-wa-whatsapp-dark";

/** Estado real de la conexión de la tienda seleccionada (GET /wa/status). */
export function WhatsAppConnectionStatusPill() {
  const { auth, selectedStoreId } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const [viewedStoreId] = useViewedStore();
  const storeId =
    viewedStoreId ??
    stores.find((store) => store.id === selectedStoreId)?.id ??
    stores[0]?.id ??
    null;
  const token = auth?.accessToken ?? "";

  const statusQuery = useQuery({
    queryKey: ["whatsapp", "status", storeId ?? "none"],
    queryFn: () => getWhatsAppStatus(token, storeId as string),
    enabled: !!storeId && !!token,
  });

  const raw = statusQuery.data as { state?: string; displayLabel?: string } | undefined;

  if (raw?.state === WHATSAPP_CONNECTION_STATES.CONNECTED) {
    return (
      <span className={CONNECTED_PILL}>
        <WaDot />
        {raw.displayLabel || "Conectado"}
      </span>
    );
  }

  const label = !storeId
    ? "Sin tienda seleccionada"
    : statusQuery.isLoading
      ? "Revisando conexión…"
      : typeof raw?.state === "string"
        ? "Sin conectar"
        : "Estado no disponible";

  return (
    <span className={MUTED_PILL}>
      <Clock className="size-4" aria-hidden="true" />
      {label}
    </span>
  );
}
