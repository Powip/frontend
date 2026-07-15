"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperadmin } from "@/config/permissions.config";
import { useComprobantesSunat, ComprobanteRow } from "@/hooks/useComprobantesSunat";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";
import { ComprobantesTab } from "@/app/facturacion/components/tabs/ComprobantesTab";
import { GuiasTab } from "@/app/facturacion/components/tabs/GuiasTab";
import { NotasTab } from "@/app/facturacion/components/tabs/NotasTab";
import { CertificadoTab } from "@/app/facturacion/components/tabs/CertificadoTab";
import { SeriesTab } from "@/app/facturacion/components/tabs/SeriesTab";
import { ReportesTab } from "@/app/facturacion/components/tabs/ReportesTab";
import { AyudaTab } from "@/app/facturacion/components/tabs/AyudaTab";
import NotaCreditoModal from "@/app/facturacion/components/modals/NotaCreditoModal";

export default function FacturacionPage() {
  const { auth, loading: authLoading } = useAuth();
  const router = useRouter();

  const comprobantes = useComprobantesSunat();
  const mock = useFacturacionMock();

  const [ncOpen, setNcOpen] = useState(false);
  const [ncPreselectId, setNcPreselectId] = useState<string | undefined>();

  useEffect(() => {
    const userEmail = auth?.user?.email;
    if (!authLoading && userEmail && !isSuperadmin(userEmail)) {
      toast.error("No tienes permisos para acceder a esta sección.");
      router.push("/dashboard");
    }
  }, [auth, authLoading, router]);

  if (authLoading || !isSuperadmin(auth?.user?.email || "")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const aceptados = comprobantes.rows.filter((r) => r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS");

  const openNotaCredito = (row?: ComprobanteRow) => {
    setNcPreselectId(row?.sale.id);
    setNcOpen(true);
  };

  return (
    <div className="facturacion-theme p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación SUNAT</h1>
          <p className="text-muted-foreground mt-1">
            Comprobantes, guías de remisión y notas de crédito/débito — con reportes listos para tu contador.
          </p>
        </div>
        <Button onClick={comprobantes.fetchSales} variant="outline" className="gap-2">
          <RefreshCw className={cn("h-4 w-4", comprobantes.loading && "animate-spin")} />
          Actualizar Lista
        </Button>
      </div>

      {!mock.cert.razon && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Aún no configuraste tu certificado digital. </span>
            Configúralo en la pestaña &quot;Certificado Digital&quot; para poder firmar tus comprobantes.
          </div>
        </div>
      )}
      {!!mock.cert.razon && mock.cert.diasParaVencer <= 30 && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            mock.cert.diasParaVencer <= 0
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
          )}
        >
          <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", mock.cert.diasParaVencer <= 0 ? "text-red-600" : "text-amber-600")} />
          <div>
            <span className="font-semibold">
              {mock.cert.diasParaVencer <= 0
                ? "Tu certificado digital ha expirado. "
                : `Tu certificado digital vence en ${mock.cert.diasParaVencer} días. `}
            </span>
            Renuévalo antes de que expire para no interrumpir la emisión de comprobantes.
          </div>
        </div>
      )}

      <Tabs defaultValue="comprobantes">
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="comprobantes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Comprobantes
          </TabsTrigger>
          <TabsTrigger value="guias" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Guías de Remisión
          </TabsTrigger>
          <TabsTrigger value="nc" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Notas de Crédito / Débito
          </TabsTrigger>
          <TabsTrigger value="reportes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Reportes
          </TabsTrigger>
          <TabsTrigger value="cert" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Certificado Digital
          </TabsTrigger>
          <TabsTrigger value="series" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Series y Correlativos
          </TabsTrigger>
          <TabsTrigger value="ayuda" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Ayuda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comprobantes" className="pt-4">
          <ComprobantesTab comprobantes={comprobantes} onGenerarNota={openNotaCredito} />
        </TabsContent>
        <TabsContent value="guias" className="pt-4">
          <GuiasTab mock={mock} comprobanteRows={comprobantes.rows} />
        </TabsContent>
        <TabsContent value="nc" className="pt-4">
          <NotasTab mock={mock} hasAceptados={aceptados.length > 0} onNuevaNota={() => openNotaCredito()} />
        </TabsContent>
        <TabsContent value="reportes" className="pt-4">
          <ReportesTab comprobanteRows={comprobantes.rows} notas={mock.notas} guias={mock.guias} />
        </TabsContent>
        <TabsContent value="cert" className="pt-4">
          <CertificadoTab mock={mock} />
        </TabsContent>
        <TabsContent value="series" className="pt-4">
          <SeriesTab mock={mock} />
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
