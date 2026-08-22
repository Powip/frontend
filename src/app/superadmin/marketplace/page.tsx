"use client";

import { PageHeader } from "@/components/superadmin/shared";
import { MarketplaceKpis } from "@/components/superadmin/marketplace/MarketplaceKpis";
import { AppsPendientes } from "@/components/superadmin/marketplace/AppsPendientes";
import { AppsCatalogo } from "@/components/superadmin/marketplace/AppsCatalogo";

export default function MarketplacePage() {
  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Apps y partners integrados; cola de aprobación." />

      <div className="mb-5">
        <MarketplaceKpis />
      </div>

      <AppsPendientes />
      <AppsCatalogo />
    </div>
  );
}
