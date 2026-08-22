"use client";

import { PageHeader } from "@/components/superadmin/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanesTab } from "@/components/superadmin/config/PlanesTab";
import { ParametrosTab } from "@/components/superadmin/config/ParametrosTab";
import { SeguridadTab } from "@/components/superadmin/config/SeguridadTab";
import { BrandingTab } from "@/components/superadmin/config/BrandingTab";
import { CuponesTab } from "@/components/superadmin/config/CuponesTab";
import { AlertasTab } from "@/components/superadmin/config/AlertasTab";
import { AnunciosTab } from "@/components/superadmin/config/AnunciosTab";

export default function ConfigPage() {
  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes globales de la plataforma." />

      <Tabs defaultValue="planes">
        <TabsList className="mb-4 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
          {[
            ["planes", "Planes y precios"],
            ["parametros", "Parámetros generales"],
            ["seguridad", "Seguridad"],
            ["branding", "Branding"],
            ["cupones", "Cupones"],
            ["alertas", "Alertas configurables"],
            ["anuncios", "Anuncios & Changelog"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="planes">
          <PlanesTab />
        </TabsContent>
        <TabsContent value="parametros">
          <ParametrosTab />
        </TabsContent>
        <TabsContent value="seguridad">
          <SeguridadTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="cupones">
          <CuponesTab />
        </TabsContent>
        <TabsContent value="alertas">
          <AlertasTab />
        </TabsContent>
        <TabsContent value="anuncios">
          <AnunciosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
