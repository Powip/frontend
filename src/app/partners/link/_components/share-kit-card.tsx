"use client";

import { saveAs } from "file-saver";
import { FileArchive, Instagram, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useQRCode } from "@/hooks/useQrCode";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import type { PartnerLink } from "@/features/partners/models/partner-link";
import type { PartnerResource } from "@/features/partners/models/partner-resource";

interface ShareKitCardProps {
  link: PartnerLink | undefined;
  resources: PartnerResource[] | undefined;
  isLoadingResources: boolean;
  isResourcesError: boolean;
  onRetryResources: () => void;
}

export function ShareKitCard({
  link,
  resources,
  isLoadingResources,
  isResourcesError,
  onRetryResources,
}: ShareKitCardProps) {
  const qrDataUrl = useQRCode(link ? `https://${link.url}` : "");

  function shareOnWhatsApp() {
    if (!link) return;
    const message = `Te recomiendo POWIP para centralizar tus pedidos: https://${link.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function shareOnInstagram() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`https://${link.url}`);
      toast.success("Link copiado — pegalo en tu bio o historia de Instagram");
    } catch {
      toast.error("No pudimos copiar. Copialo manualmente.");
    }
  }

  function downloadQr() {
    if (!qrDataUrl || !link) return;
    saveAs(qrDataUrl, `powip-${link.code}.png`);
  }

  function openResource(resource: PartnerResource) {
    toast.info(`"${resource.title}" todavía no está disponible para descargar.`);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Compartir y kit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={shareOnWhatsApp} disabled={!link}>
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={shareOnInstagram} disabled={!link}>
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
            />
          ) : isLoadingResources || !resources ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
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
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => openResource(resource)}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium text-foreground">{resource.title}</div>
                    <div className="text-xs text-muted-foreground">{resource.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
