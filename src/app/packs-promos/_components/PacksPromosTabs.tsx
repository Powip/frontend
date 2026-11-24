"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromotionsView from "@/components/promotions/PromotionsView";
import PacksView from "@/components/packs/PacksView";
import { PacksProvider } from "@/contexts/PacksContext";
import { PacksPromosContent } from "./LegacyPacksPromos";

export const PACKS_PROMOS_TABS = ["promociones", "packs", "bundles"] as const;
export type PacksPromosTab = (typeof PACKS_PROMOS_TABS)[number];

/** `?tab=` válido o, si falta o no existe, Promociones. */
export function packsPromosTab(value: string | null): PacksPromosTab {
  return PACKS_PROMOS_TABS.includes(value as PacksPromosTab) ? (value as PacksPromosTab) : "promociones";
}

/** Enlaces de una sola vez que lee Promociones al abrir: al cambiar de pestaña se sacan para no repetirlos. */
const ONE_SHOT_PARAMS = ["nueva", "productos", "editar"];

/**
 * FEAT-32 M4 (spec §3.1, §7.0, §7.12) — Comercial › Packs y promociones: pestañas Promociones (campaña, volumen
 * y regalo), Packs (antes Productos › Packs) y Bundles anteriores. La pestaña sale de `?tab=promociones|packs|bundles`.
 * Cada pestaña se monta al abrirla (el PacksProvider de los bundles, solo en la suya).
 */
export function PacksPromosTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = packsPromosTab(searchParams.get("tab"));

  const changeTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", packsPromosTab(value));
    for (const key of ONE_SHOT_PARAMS) params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Packs y promociones" description="Todo lo que cambia cómo se vende: packs y reglas de precio, por tienda y canal" />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="promociones">Promociones</TabsTrigger>
          <TabsTrigger value="packs">Packs</TabsTrigger>
          <TabsTrigger value="bundles">Bundles anteriores</TabsTrigger>
        </TabsList>
        <TabsContent value="promociones" className="pt-2">
          <PromotionsView />
        </TabsContent>
        <TabsContent value="packs" className="pt-2">
          <PacksView />
        </TabsContent>
        <TabsContent value="bundles" className="pt-2">
          <PacksProvider>
            <PacksPromosContent bundlesOnly />
          </PacksProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
}
