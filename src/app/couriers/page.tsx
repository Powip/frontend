"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import CourierTrackingView from "@/components/couriers/CourierTrackingView";

export default function CouriersPage() {
  return (
    <div className="w-full px-6 pb-6">
      <HeaderConfig
        title="Seguimiento de Couriers"
        description="Rastreo en tiempo real y documentos de envío (Shalom / Olva)"
      />
      
      <div className="mt-6">
        <CourierTrackingView />
      </div>
    </div>
  );
}
