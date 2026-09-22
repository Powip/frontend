"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PartnerSectionErrorProps {
  message: string;
  onRetry: () => void;
}

export function PartnerSectionError({ message, onRetry }: PartnerSectionErrorProps) {
  return (
    <Card role="alert" className="rounded-2xl">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button size="sm" onClick={onRetry} className="rounded-xl">
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}
