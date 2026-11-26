"use client";

import { Separator } from "@/components/ui/separator";
import { canSeeWhatsAppTab } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import CourierTransportTable from "./CourierTransportTable";
import CourierStatusMappingTable from "./CourierStatusMappingTable";
import WhatsAppNotificationsSection from "./WhatsAppNotificationsSection";

export default function CouriersTarifasTab() {
  const { auth } = useAuth();
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <CourierTransportTable />
      </section>

      <Separator />

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <CourierStatusMappingTable />
      </section>

      {canSeeWhatsAppTab(auth?.user?.email) && (
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <WhatsAppNotificationsSection />
        </section>
      )}
    </div>
  );
}
