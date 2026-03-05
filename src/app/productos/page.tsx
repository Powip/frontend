"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCreateForm from "./create-product/create-product";
import ExcelImportWizard from "@/components/excel/ExcelImportWizard";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, PenLine, ShoppingBag } from "lucide-react";
import ShopifySyncWizard from "./shopify-sync-wizard";

function ProductosContent() {
  const searchParams = useSearchParams();
  const editVariantId = searchParams.get("edit");
  const [mode, setMode] = useState<"select" | "manual" | "excel" | "shopify">(
    editVariantId ? "manual" : "select",
  );

  /* If editing, go straight to manual form */
  if (mode === "manual" || editVariantId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ProductCreateForm editVariantId={editVariantId} />
      </div>
    );
  }

  if (mode === "excel") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ExcelImportWizard onBack={() => setMode("select")} />
      </div>
    );
  }

  if (mode === "shopify") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ShopifySyncWizard onBack={() => setMode("select")} />
      </div>
    );
  }

  /* ─── Mode selector ─── */
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <HeaderConfig
        title="Crear Producto"
        description="Elegí cómo querés cargar tus productos"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full mt-4">
        {/* Manual */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={() => setMode("manual")}
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="rounded-full bg-primary/10 p-4 group-hover:bg-primary/20 transition">
              <PenLine className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Carga Manual</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Creá un producto con variantes paso a paso
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Excel */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={() => setMode("excel")}
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="rounded-full bg-green-100 dark:bg-green-950/30 p-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/40 transition">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Importar Excel</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Carga masiva desde un archivo Excel
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Shopify */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group border-teal-100 dark:border-teal-900/30"
          onClick={() => setMode("shopify")}
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="rounded-full bg-teal-100 dark:bg-teal-950/30 p-4 group-hover:bg-teal-200 dark:group-hover:bg-teal-900/40 transition">
              <ShoppingBag className="h-8 w-8 text-teal-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Sincronizar Shopify</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Importá productos automáticamente desde Shopify
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Productos() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          Cargando...
        </div>
      }
    >
      <ProductosContent />
    </Suspense>
  );
}
