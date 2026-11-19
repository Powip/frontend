"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import PriceListsView from "@/components/price-lists/PriceListsView";

/** FEAT-24 H9 (H9-D6) — Catálogo › Listas de precios. */
export default function ListasPreciosPage() {
  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Listas de precios" description="Precio por tienda y canal; lo que no tiene precio propio hereda el precio base" />
      <Button variant="ghost" size="sm" asChild><Link href="/productos"><ArrowLeft className="mr-2 h-4 w-4" />Volver al catálogo</Link></Button>
      <PriceListsView />
    </div>
  );
}
