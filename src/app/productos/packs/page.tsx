"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import PacksView from "@/components/packs/PacksView";

/** FEAT-24 H9 (H9-D1) — Catálogo › Packs. */
export default function PacksPage() {
  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Packs" description="Productos con SKU propio que venden varios componentes juntos" />
      <Button variant="ghost" size="sm" asChild><Link href="/productos"><ArrowLeft className="mr-2 h-4 w-4" />Volver al catálogo</Link></Button>
      <PacksView />
    </div>
  );
}
