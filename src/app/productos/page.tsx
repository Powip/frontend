"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCreateForm from "./create-product/create-product";

function ProductosContent() {
  const searchParams = useSearchParams();
  const editVariantId = searchParams.get("edit");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <ProductCreateForm editVariantId={editVariantId} />
    </div>
  );
}

export default function Productos() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
      <ProductosContent />
    </Suspense>
  );
}
