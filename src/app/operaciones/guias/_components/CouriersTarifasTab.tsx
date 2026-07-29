"use client";

import { Separator } from "@/components/ui/separator";
import CourierTransportTable from "./CourierTransportTable";
import FulfillmentIntegrationsSection from "./FulfillmentIntegrationsSection";
import CourierStatusMappingTable from "./CourierStatusMappingTable";
import WhatsAppNotificationsSection from "./WhatsAppNotificationsSection";

/* -----------------------------------------------------------------------
   Couriers & Tarifas — dos secciones principales (tabla de couriers de
   transporte + integraciones de fulfillment, deliberadamente separadas,
   ver operationsDomain.ts) más dos secciones de referencia/mockup.
------------------------------------------------------------------------ */

export default function CouriersTarifasTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <CourierTransportTable />
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <FulfillmentIntegrationsSection />
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
