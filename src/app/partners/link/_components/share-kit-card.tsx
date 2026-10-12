"use client";

import { saveAs } from "file-saver";
import { FileArchive, Instagram, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { PartnerResource } from "@/features/partners/models/partner-resource";
import { useQRCode } from "@/hooks/useQrCode";

interface ShareKitCardProps {
  referralLink: string | null;
  referralCode: string | null;
  resources: PartnerResource[] | undefined;
  isLoadingResources: boolean;
  isResourcesError: boolean;
  resourcesError?: unknown;
  onRetryResources: () => void;
}

export function ShareKitCard({
  referralLink,
  referralCode,
  resources,
  isLoadingResources,
  isResourcesError,
  resourcesError,
  onRetryResources,
}: ShareKitCardProps) {
  const qrDataUrl = useQRCode(referralLink ?? "");

  function shareOnWhatsApp() {
    if (!referralLink) return;
    const message = `Te recomiendo POWIP para centralizar tus pedidos: ${referralLink}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function shareOnInstagram() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Link copiado — pegalo en tu bio o historia de Instagram");
    } catch {
      toast.error("No pudimos copiar. Copialo manualmente.");
    }
  }

  function downloadQr() {
    if (!qrDataUrl || !referralLink) return;
    saveAs(qrDataUrl, `powip-${referralCode ?? "partner"}.png`);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Compartir y kit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={shareOnWhatsApp} disabled={!referralLink}>
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={shareOnInstagram} disabled={!referralLink}>
            <Instagram aria-hidden="true" className="h-4 w-4" />
            Instagram
          </Button>
          <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
            <QrCode aria-hidden="true" className="h-4 w-4" />
            Descargar QR
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recursos
          </p>
          {isResourcesError ? (
            <PartnerSectionError
              message="No pudimos cargar los recursos."
              onRetry={onRetryResources}
              error={resourcesError}
            />
          ) : isLoadingResources || !resources ? (
            <div className="space-y-2">
              {["resource-loading-1", "resource-loading-2", "resource-loading-3"].map((key) => (
                <Skeleton key={key} className="h-14 w-full" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              icon={FileArchive}
              title="Sin recursos todavía"
              description="Cuando estén listos, vas a poder descargarlos acá."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium text-foreground">{resource.title}</div>
                    {resource.description && (
                      <div className="text-xs text-muted-foreground">{resource.description}</div>
                    )}
                  </div>
                  {resource.downloadUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={resource.downloadUrl} target="_blank" rel="noopener noreferrer">
                        Abrir <span className="sr-only">{resource.title}</span>
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin descarga disponible</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
