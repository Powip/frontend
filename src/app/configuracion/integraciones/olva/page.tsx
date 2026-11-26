import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OlvaSenderProfilesSection } from "./_components/olva-sender-profiles-section";

export default function OlvaIntegrationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Button size="sm" variant="ghost" asChild>
        <Link href="/configuracion/integraciones">
          <ArrowLeft aria-hidden="true" />
          Integraciones
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold dark:text-slate-100">Integración Olva</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Configura los remitentes con los que Powip genera tus guías de Olva Courier.
        </p>
      </header>

      <OlvaSenderProfilesSection />
    </div>
  );
}
