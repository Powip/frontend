import { Suspense } from "react";
import LiveConsolePage from "@/features/live/LiveConsolePage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando live…</div>}>
      <LiveConsolePage />
    </Suspense>
  );
}
