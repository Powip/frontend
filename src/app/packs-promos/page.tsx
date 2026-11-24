"use client";

import { Suspense } from "react";
import { PacksPromosTabs } from "./_components/PacksPromosTabs";

/** FEAT-32 M4 — Comercial › Packs y promociones (la pestaña se lee de `?tab=`, por eso el Suspense). */
export default function PacksPromosPage() {
  return (
    <Suspense fallback={null}>
      <PacksPromosTabs />
    </Suspense>
  );
}
