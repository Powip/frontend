import { Suspense } from "react";
import RestablecerClient from "./restablecer-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-20">Cargando...</div>}>
      <RestablecerClient />
    </Suspense>
  );
}
