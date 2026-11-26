"use client";

import { Suspense } from "react";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { WhatsAppSettingsContent } from "./_components/WhatsAppSettingsContent";

export default function WhatsAppSettingsPage() {
  return (
    <Suspense fallback={<PowipPulseLoader label="Cargando WhatsApp..." />}>
      <WhatsAppSettingsContent />
    </Suspense>
  );
}
