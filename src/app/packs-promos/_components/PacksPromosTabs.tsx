"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromotionsView from "@/components/promotions/PromotionsView";
import PacksView from "@/components/packs/PacksView";
import LegacyBundlesView, { activeBundles, useLegacyBundles } from "@/components/packs/LegacyBundlesView";
import { useAuth } from "@/contexts/AuthContext";
import { listPacks } from "@/services/packsService";

export const PACKS_PROMOS_TABS = ["promociones", "packs", "bundles"] as const;
export type PacksPromosTab = (typeof PACKS_PROMOS_TABS)[number];

/** `?tab=` válido o, si falta o no existe, Promociones. */
export function packsPromosTab(value: string | null): PacksPromosTab {
  return PACKS_PROMOS_TABS.includes(value as PacksPromosTab) ? (value as PacksPromosTab) : "promociones";
}

/** Enlaces de una sola vez que lee Promociones al abrir: al cambiar de pestaña se sacan para no repetirlos. */
const ONE_SHOT_PARAMS = ["nueva", "productos", "editar"];

const COUNT = "ml-1.5 rounded-full px-1.5 text-[10.5px] font-bold";

/**
 * FEAT-32 M4 (spec §3.1, §7.0, §7.12) — Comercial › Packs y promociones: pestañas Promociones (campaña, volumen
 * y regalo), Packs (antes Productos › Packs) y Bundles anteriores. La pestaña sale de `?tab=promociones|packs|bundles`.
 * FEAT-32 M5 (§7.15, §7.16): «N por aprobar» en Packs (packs de creadoras pendientes) y Bundles anteriores solo
 * mientras quede alguno activo (si no quedan, `?tab=bundles` abre Packs).
 */
export function PacksPromosTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const requested = packsPromosTab(searchParams.get("tab"));

  // `meta.pendingCount` no depende de los filtros: alcanza con la primera página de un pack.
  const pending = useQuery({
    queryKey: ["packs", "pending-count", companyId],
    queryFn: async ({ signal }) => (await listPacks({ page: 1, limit: 1 }, signal)).meta.pendingCount ?? 0,
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const bundles = useLegacyBundles();
  const bundleCount = activeBundles(bundles.data).length;
  const noBundles = bundles.isSuccess && bundleCount === 0;
  const tab: PacksPromosTab = requested === "bundles" && noBundles ? "packs" : requested;
  const showBundles = bundleCount > 0 || requested === "bundles";

  const changeTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", packsPromosTab(value));
    for (const key of ONE_SHOT_PARAMS) params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Se convirtió o desactivó el último bundle (o no había): la pestaña se va y queda Packs.
  useEffect(() => {
    if (requested === "bundles" && noBundles) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "packs");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [requested, noBundles, searchParams, pathname, router]);

  const pendingCount = pending.data ?? 0;
  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Packs y promociones" description="Todo lo que cambia cómo se vende: packs y reglas de precio, por tienda y canal" />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="promociones">Promociones</TabsTrigger>
          <TabsTrigger value="packs">
            Packs
            {pendingCount > 0 ? <span className={`${COUNT} bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200`}>{pendingCount} por aprobar</span> : null}
          </TabsTrigger>
          {showBundles && !noBundles ? (
            <TabsTrigger value="bundles">
              Bundles anteriores
              {bundleCount > 0 ? <span className={`${COUNT} bg-muted text-muted-foreground`}>{bundleCount}</span> : null}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="promociones" className="pt-2">
          <PromotionsView />
        </TabsContent>
        <TabsContent value="packs" className="pt-2">
          <PacksView />
        </TabsContent>
        {showBundles && !noBundles ? (
          <TabsContent value="bundles" className="pt-2">
            <LegacyBundlesView />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
