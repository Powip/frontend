"use client";

import { Separator } from "@/components/ui/separator";
import CourierTransportTable from "./CourierTransportTable";
import CourierStatusMappingTable from "./CourierStatusMappingTable";
import WhatsAppNotificationsSection from "./WhatsAppNotificationsSection";

export default function CouriersTarifasTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <CourierTransportTable />
      </section>

      <Separator />

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <CourierStatusMappingTable />
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <WhatsAppNotificationsSection />
      </section>
    </div>
  );
}
