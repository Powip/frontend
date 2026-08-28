"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import NotaCreditoModal from "@/app/facturacion/components/modals/NotaCreditoModal";
import { AyudaTab } from "@/app/facturacion/components/tabs/AyudaTab";
import { CertificadoTab } from "@/app/facturacion/components/tabs/CertificadoTab";
import { GuiasTab } from "@/app/facturacion/components/tabs/GuiasTab";
import { NotasTab } from "@/app/facturacion/components/tabs/NotasTab";
import { ReportesTab } from "@/app/facturacion/components/tabs/ReportesTab";
import { SeriesTab } from "@/app/facturacion/components/tabs/SeriesTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import { getCertificateStatus } from "@/features/sunat/sunat-profile/utils/get-certificate-status";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";
import { useTaxDocuments } from "@/hooks/useTaxDocuments";
import { cn } from "@/lib/utils";
import { TaxDocumentsTab } from "./components/tabs/TaxDocumentsTab";

export default function FacturacionPage() {
  const { auth, loading: authLoading } = useAuth();
  const router = useRouter();

  // Single source of truth for comprobantes: real sales + SUNAT documents.
  // The remaining legacy tabs (Guías, Notas, Reportes) reuse this same
  // real data — only their own local, not-yet-implemented state (guías,
  // notas) still comes from useFacturacionMock.
  const taxDocuments = useTaxDocuments();

  const mock = useFacturacionMock();

  const { data: sunatProfiles = [], isLoading: profilesLoading } = useSunatProfiles();

  const activeProfiles = sunatProfiles.filter((profile) => profile.isActive);

  const hasCertificate = activeProfiles.length > 0;

  const expiringCertificates = activeProfiles
    .map((profile) => ({
      profile,
      ...getCertificateStatus(profile),
    }))
    .filter(({ status }) => status === "bad" || status === "warn");

  const [ncOpen, setNcOpen] = useState(false);
  const [ncPreselectId, setNcPreselectId] = useState<string | undefined>();

  useEffect(() => {
    if (!authLoading && !auth?.company) {
      toast.error("No tienes una empresa asociada.");
      router.push("/dashboard");
    }
  }, [auth, authLoading, router]);

  if (authLoading || !auth?.company) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const openNotaCredito = (row?: TaxDocumentRow) => {
    setNcPreselectId(row?.sale.id);
    setNcOpen(true);
  };

  const aceptados = taxDocuments.rows.filter(
    (row) =>
      row.taxDocument?.cdrStatus === "ACCEPTED" ||
      row.taxDocument?.cdrStatus === "ACCEPTED_WITH_OBSERVATION",
  );

  const refreshAll = () => {
    taxDocuments.refreshSales();
    taxDocuments.refreshListDocuments();
  };

  const isRefreshing = taxDocuments.loading;

  return (
    <div className="facturacion-theme mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación SUNAT</h1>

          <p className="mt-1 text-muted-foreground">
            Comprobantes, guías de remisión y notas de crédito/débito — con reportes listos para tu
            contador.
          </p>
        </div>

        <Button onClick={refreshAll} variant="outline" className="gap-2" disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Actualizar Lista
        </Button>
      </div>

      {/* SUNAT profile / certificate warning */}
      {!profilesLoading && !hasCertificate && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

          <div>
            <span className="font-semibold">Aún no configuraste tu certificado digital. </span>
            Configúralo en la pestaña &quot;Certificado Digital&quot; para poder firmar tus
            comprobantes.
          </div>
        </div>
      )}

      {/* Expiring certificates */}
      {expiringCertificates.map(({ profile, daysToExpire, status }) => (
        <div
          key={profile.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            status === "bad"
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              status === "bad" ? "text-red-600" : "text-amber-600",
            )}
          />

          <div>
            <span className="font-semibold">
              {status === "bad"
                ? `El certificado de ${profile.razonSocial} ha expirado. `
                : `El certificado de ${profile.razonSocial} vence en ${daysToExpire} días. `}
            </span>
            RUC {profile.ruc}. Renuévalo antes de que expire para no interrumpir la emisión de
            comprobantes.
          </div>
        </div>
      ))}

      <Tabs defaultValue="comprobantes">
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger
            value="comprobantes"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Comprobantes
          </TabsTrigger>

          <TabsTrigger
            value="guias"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Guías de Remisión
          </TabsTrigger>

          <TabsTrigger
            value="nc"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Notas de Crédito / Débito
          </TabsTrigger>

          <TabsTrigger
            value="reportes"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Reportes
          </TabsTrigger>

          <TabsTrigger
            value="cert"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Certificado Digital
          </TabsTrigger>

          <TabsTrigger
            value="series"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Series y Correlativos
          </TabsTrigger>

          <TabsTrigger
            value="ayuda"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Ayuda
          </TabsTrigger>
        </TabsList>

        {/* NEW Tax Documents implementation */}
        <TabsContent value="comprobantes" className="pt-4">
          <TaxDocumentsTab comprobantes={taxDocuments} onGenerarNota={openNotaCredito} />
        </TabsContent>

        {/* Legacy tabs: no backend yet for guías/notas emission (mock only),
            but they read real comprobante data from taxDocuments. */}
        <TabsContent value="guias" className="pt-4">
          <GuiasTab mock={mock} comprobanteRows={taxDocuments.rows} />
        </TabsContent>

        <TabsContent value="nc" className="pt-4">
          <NotasTab
            mock={mock}
            hasAceptados={aceptados.length > 0}
            onNuevaNota={() => openNotaCredito()}
          />
        </TabsContent>

        <TabsContent value="reportes" className="pt-4">
          <ReportesTab comprobanteRows={taxDocuments.rows} notas={mock.notas} guias={mock.guias} />
        </TabsContent>

        <TabsContent value="cert" className="pt-4">
          <CertificadoTab />
        </TabsContent>

        <TabsContent value="series" className="pt-4">
          <SeriesTab />
        </TabsContent>

        <TabsContent value="ayuda" className="pt-4">
          <AyudaTab />
        </TabsContent>
      </Tabs>

      <NotaCreditoModal
        isOpen={ncOpen}
        onClose={() => setNcOpen(false)}
        aceptados={aceptados}
        preselectId={ncPreselectId}
        crearNota={mock.crearNota}
      />
    </div>
  );
}
