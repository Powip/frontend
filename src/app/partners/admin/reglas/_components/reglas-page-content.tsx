"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAdminCommissionSettings } from "@/features/partners/hooks/use-admin-commission-settings";
import { CommissionRulesEditor } from "./commission-rules-editor";
import { DiscountSettingsCard } from "./discount-settings-card";
import { EmailTemplatesCard } from "./email-templates-card";
import { ProgramRulesCard } from "./program-rules-card";

export function ReglasPageContent() {
  const settingsQuery = useAdminCommissionSettings();

  return (
    <div className="space-y-4 p-6">
      <h2 className="sr-only">Reglas & Comisiones</h2>

      <Alert>
        <AlertCircle aria-hidden="true" />
        <AlertDescription>
          Este es el módulo de control. Definí comisión de 1er mes y recurrente por opción, el
          descuento al referido y quién lo asume. Al guardar se aplica a los nuevos referidos.
        </AlertDescription>
      </Alert>

      {settingsQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar las reglas del programa."
          onRetry={() => settingsQuery.refetch()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CommissionRulesEditor settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
          <div className="space-y-4">
            <DiscountSettingsCard settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
            <ProgramRulesCard settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
            <EmailTemplatesCard />
          </div>
        </div>
      )}
    </div>
  );
}
