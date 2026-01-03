"use client";

import { useSearchParams } from "next/navigation";
import ProductCreateForm from "./create-product/create-product";

export default function Productos() {
  const searchParams = useSearchParams();
  const editVariantId = searchParams.get("edit");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <ProductCreateForm editVariantId={editVariantId} />
    </div>
  );
}
