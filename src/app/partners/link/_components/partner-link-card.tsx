"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import type { PartnerReferralMetrics } from "@/features/partners/models/partner-referral-metrics";

interface PartnerLinkCardProps {
  referralLink: string | null;
  referralCode: string | null;
  metrics: PartnerReferralMetrics | undefined;
  isLoadingMetrics: boolean;
  isMetricsError: boolean;
  metricsError?: unknown;
  onRetryMetrics: () => void;
}

async function copyToClipboard(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("No pudimos copiar. Copialo manualmente.");
  }
}

export function PartnerLinkCard({
  referralLink,
  referralCode,
  metrics,
  isLoadingMetrics,
  isMetricsError,
  metricsError,
  onRetryMetrics,
}: PartnerLinkCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Tu link y tu código de referido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Link único
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/60 bg-muted/40 px-4 py-3">
            {referralLink ? (
              <>
                <span className="flex-1 truncate font-mono text-sm font-semibold text-primary">
                  {referralLink}
                </span>
                <Button size="sm" onClick={() => copyToClipboard(referralLink, "Link copiado")}>
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copiar
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Todavía no tenés un link asignado.
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Código de referido
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/40">
            {referralCode ? (
              <>
                <span className="flex-1 truncate text-lg font-bold tracking-wide text-amber-700 dark:text-amber-300">
                  {referralCode}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(referralCode, `Código ${referralCode} copiado`)}
                >
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copiar código
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Todavía no tenés un código asignado.
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          {isMetricsError ? (
            <PartnerSectionError
              message={
                getHttpStatus(metricsError) === 401 || getHttpStatus(metricsError) === 403
                  ? "No tenés acceso a los contadores de un Partner activo."
                  : "No pudimos cargar los contadores de referido."
              }
              onRetry={
                getHttpStatus(metricsError) === 401 || getHttpStatus(metricsError) === 403
                  ? undefined
                  : onRetryMetrics
              }
              error={metricsError}
            />
          ) : isLoadingMetrics || !metrics ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <section aria-label="Contadores de referido" className="space-y-3">
              <dl className="grid grid-cols-3 gap-4">
                <Stat value={metrics.claimCaptures} label="Capturas de referido" />
                <Stat value={metrics.attachedClaims} label="Claims vinculados" />
                <Stat value={metrics.attributedCompanies} label="Empresas atribuidas" />
              </dl>
              <p className="text-xs text-muted-foreground">
                Son registros de referido y atribución. No representan visitas de navegación, usos
                de código, pagos ni comisiones.
              </p>
              <p className="text-xs text-muted-foreground">
                Datos al <time dateTime={metrics.asOf}>{metrics.asOf}</time> (UTC).
              </p>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-extrabold text-foreground">{value}</dd>
    </div>
  );
}
