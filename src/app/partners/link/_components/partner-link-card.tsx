"use client";

import { Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PartnerLink } from "@/features/partners/models/partner-link";

interface PartnerLinkCardProps {
  link: PartnerLink | undefined;
  isLoading: boolean;
}

async function copyToClipboard(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("No pudimos copiar. Copialo manualmente.");
  }
}

export function PartnerLinkCard({ link, isLoading }: PartnerLinkCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Tu link y tu código de referido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !link ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Link único
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/60 bg-muted/40 px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm font-semibold text-primary">
                  {link.url}
                </span>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(link.url, "Link copiado")}
                >
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Código de referido
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/40">
                <span className="flex-1 truncate text-lg font-bold tracking-wide text-amber-700 dark:text-amber-300">
                  {link.code}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(link.code, `Código ${link.code} copiado`)}
                >
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copiar código
                </Button>
              </div>
            </div>

            <Alert>
              <Gift aria-hidden="true" />
              <AlertDescription>
                Tus referidos reciben <b>{link.discountPct}% de descuento el primer mes</b> — un
                beneficio exclusivo por venir de un partner.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
              <Stat value={link.clicks} label="Clics link" />
              <Stat value={link.codeUses} label="Usos del código" />
              <Stat value={link.conversions} label="Cerraron" accent />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-extrabold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
