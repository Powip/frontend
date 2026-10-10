"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isPartnersFeatureUnavailable } from "@/features/partners/utils/unavailable-partners-feature";

interface PartnerSectionErrorProps {
  message: string;
  onRetry?: () => void;
  error?: unknown;
}

export function PartnerSectionError({ message, onRetry, error }: PartnerSectionErrorProps) {
  const unavailable = isPartnersFeatureUnavailable(error);
  return (
    <Card role="alert" className="rounded-2xl">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">{unavailable ? error.message : message}</p>
        {onRetry && !unavailable && (
          <Button size="sm" onClick={onRetry} className="rounded-xl">
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
