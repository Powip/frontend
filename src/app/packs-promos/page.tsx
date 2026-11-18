"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromotionsView from "@/components/promotions/PromotionsView";
import { PacksProvider } from "@/contexts/PacksContext";
import { PacksPromosContent } from "./_components/LegacyPacksPromos";

/**
 * FEAT-24 H9 (H9-D5) — Ventas › Promociones. La pestaña «Bundles» conserva la pantalla anterior solo para
 * los bundles que todavía no se pasaron a packs (su PacksProvider se monta al abrirla).
 */
export default function PromocionesPage() {
  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Promociones" description="Reglas de precio que se aplican solas al registrar la venta, por tienda y canal" />
      <Tabs defaultValue="promos">
        <TabsList>
          <TabsTrigger value="promos">Promociones</TabsTrigger>
          <TabsTrigger value="bundles">Bundles anteriores</TabsTrigger>
        </TabsList>
        <TabsContent value="promos" className="pt-2">
          <PromotionsView />
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
