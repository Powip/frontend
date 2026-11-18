"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import CatalogCategoriesManager from "@/components/catalog/CatalogCategoriesManager";

/** FEAT-24 H4 (H4-D4) — Catálogo › Categorías. */
export default function CategoriasPage() {
  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Categorías" description="Categorías propias del catálogo, hasta 3 niveles" />
      <Button variant="ghost" size="sm" asChild><Link href="/productos"><ArrowLeft className="mr-2 h-4 w-4" />Volver al catálogo</Link></Button>
      <CatalogCategoriesManager />
    </div>
  );
}
