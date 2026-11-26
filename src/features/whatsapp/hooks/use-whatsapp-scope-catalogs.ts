import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DELIVERY_TYPE_OPTIONS } from "@/constants/operationsDomain";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCouriers } from "@/services/courierService";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import { whatsappKeys } from "../keys/whatsapp.keys";
import type { WhatsAppResourceState } from "../models/resource-state.model";
import type { WhatsAppCatalogOption, WhatsAppScopeCatalogs } from "../models/scope-catalog.model";

async function loadCourierOptions(companyId: string): Promise<WhatsAppCatalogOption[]> {
  assertWhatsAppContractAvailable("companyCouriers");
  const couriers = await fetchCouriers(companyId);
  return couriers
    .filter((courier) => courier.isActive)
    .map((courier) => ({ value: courier.id, label: courier.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function useWhatsAppScopeCatalogs(): WhatsAppScopeCatalogs {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? null;
  const storesSource = auth?.company?.stores;
  const channelsSource = auth?.company?.sales_channels;

  const couriersQuery = useQuery({
    queryKey: whatsappKeys.courierCatalog(companyId ?? "none"),
    queryFn: () => loadCourierOptions(companyId as string),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    assertWhatsAppContractAvailable("companyStores");
    assertWhatsAppContractAvailable("companySalesChannels");
    assertWhatsAppContractAvailable("shippingTypes");

    const stores: WhatsAppResourceState<WhatsAppCatalogOption[]> = {
      kind: "ready",
      data: (storesSource ?? []).map((store) => ({ value: store.id, label: store.name })),
    };
    const salesChannels: WhatsAppResourceState<WhatsAppCatalogOption[]> = {
      kind: "ready",
      data: (channelsSource ?? []).map((channel) => ({ value: channel, label: channel })),
    };
    const shippingTypes: WhatsAppResourceState<WhatsAppCatalogOption[]> = {
      kind: "ready",
      data: DELIVERY_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    };
    const couriers: WhatsAppResourceState<WhatsAppCatalogOption[]> = !companyId
      ? { kind: "ready", data: [] }
      : couriersQuery.isPending
        ? { kind: "loading" }
        : couriersQuery.isError
          ? { kind: "error", message: "No se pudo cargar la lista de couriers." }
          : { kind: "ready", data: couriersQuery.data ?? [] };

    return { stores, salesChannels, shippingTypes, couriers };
  }, [
    storesSource,
    channelsSource,
    companyId,
    couriersQuery.isPending,
    couriersQuery.isError,
    couriersQuery.data,
  ]);
}
