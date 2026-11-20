"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { hasAdminAccess } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { getShopifyReauthorizationStatus, listShopifyStockShops } from "@/services/shopifyStockService";
import { listWarehouses } from "@/services/warehousesService";
import ShopifyStockShopCard from "./ShopifyStockShopCard";

// FEAT-24 H1-D (H1D-5) — «Stock de Shopify» en Tiendas y almacenes: por cada
// tienda de Shopify de la empresa, quién manda el stock, si hay que volver a
// autorizar la app y el último reporte Powip vs Shopify. Todos los usuarios de
// la empresa ven el estado; solo un administrador genera reportes y cambia el modo.

export default function ShopifyStockSection() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  const enabled = Boolean(companyId && auth?.accessToken);
  const isAdmin = hasAdminAccess(auth?.user?.role);

  const shopsKey = useMemo(() => ["shopify-stock-shops", companyId], [companyId]);
  const shopsQuery = useQuery({
    queryKey: shopsKey,
    queryFn: () => listShopifyStockShops(),
    enabled,
    retry: false,
    staleTime: 0,
  });
  const shops = useMemo(() => shopsQuery.data?.shops ?? [], [shopsQuery.data]);

  const reauthQuery = useQuery({
    queryKey: ["shopify-reauthorization", companyId],
    queryFn: () => getShopifyReauthorizationStatus(),
    enabled: enabled && shops.length > 0,
    retry: false,
    staleTime: 60_000,
  });
  // Los mismos almacenes que muestra la sección de arriba (misma clave de caché).
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: enabled && shops.length > 0,
    retry: false,
    staleTime: 0,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: shopsKey });
    void queryClient.invalidateQueries({ queryKey: ["shopify-stock-report"] });
    void queryClient.invalidateQueries({ queryKey: ["shopify-reauthorization", companyId] });
  }, [queryClient, shopsKey, companyId]);

  if (!companyId || shopsQuery.isPending) return null;

  if (shopsQuery.isError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border bg-card p-6 text-sm">
        <p className="font-medium">No se pudo cargar el stock de Shopify</p>
        <p className="text-muted-foreground">
          {warehouseErrorMessage(shopsQuery.error, "Inténtalo de nuevo en unos minutos.")}
        </p>
        <Button variant="outline" size="sm" disabled={shopsQuery.isFetching} onClick={() => void shopsQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (shops.length === 0) return null;

  const stores = auth?.company?.stores ?? [];
  const warehouses = warehousesQuery.data?.warehouses ?? [];
  const reauthByShop = new Map((reauthQuery.data?.shops ?? []).map((s) => [s.shopId, s]));

  return (
    <section aria-labelledby="shopify-stock-title" className="space-y-3 rounded-lg border bg-card p-6">
      <div>
        <h3 id="shopify-stock-title" className="text-lg font-medium">
          Stock de Shopify
        </h3>
        <p className="text-sm text-muted-foreground">
          Quién manda el stock de cada tienda de Shopify: «Shopify manda» (como hasta hoy), «Solo reporte» (Powip compara
          sin escribir) o «Powip manda» (Powip publica su disponible en Shopify).
        </p>
      </div>
      {reauthQuery.isError ? (
        <p className="text-xs text-muted-foreground">No se pudo revisar si alguna tienda tiene que volver a autorizar la app.</p>
      ) : null}
      <div className="space-y-3">
        {shops.map((shop) => (
          <ShopifyStockShopCard
            key={shop.id}
            shop={shop}
            shops={shops}
            reauthorization={reauthByShop.get(shop.id)}
            storeName={stores.find((s) => s.id === shop.storeId)?.name ?? null}
            warehouseName={warehouses.find((w) => w.id === shop.inventoryId)?.name ?? null}
            isAdmin={isAdmin}
            onRefresh={refresh}
          />
        ))}
      </div>
    </section>
  );
}
