"use client";

import { Copy, ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGoogleMapsUrl, toSafeHttpUrl } from "./MapsLink";

interface GoogleMapsUrlFieldProps {
  url?: string | null;
  label?: string;
  className?: string;
}

/**
 * "Ubicación en Google Maps" del pedido: muestra la URL completa como texto
 * seleccionable (ajusta línea en vez de desbordar), la abre en una pestaña
 * nueva y la copia completa. Sin ubicación muestra "-" — ni enlace ni botón.
 * Los clics no se propagan a la fila/encabezado que lo contenga.
 */
export function GoogleMapsUrlField({
  url,
  label = "Ubicación en Google Maps",
  className,
}: GoogleMapsUrlFieldProps) {
  const mapsUrl = getGoogleMapsUrl(url);
  const href = mapsUrl ? toSafeHttpUrl(mapsUrl) : null;

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!mapsUrl) return;
    try {
      await navigator.clipboard.writeText(mapsUrl);
      toast.success("Enlace de Google Maps copiado");
    } catch (error) {
      console.error("Error copiando el enlace de Google Maps", error);
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <div className={cn("min-w-0", className)}>
      <span className="text-muted-foreground">{label}: </span>
      {mapsUrl && href ? (
        <span className="inline-flex max-w-full items-start gap-1 align-top">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 select-text break-all font-medium text-primary underline underline-offset-2"
            aria-label={`Abrir ubicación en Google Maps: ${mapsUrl}`}
          >
            {mapsUrl}
            <ExternalLink className="ml-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
          </a>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copiar enlace de Google Maps"
            aria-label="Copiar enlace de Google Maps"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
          </Button>
        </span>
      ) : (
        <span className="font-medium">-</span>
      )}
    </div>
  );
}
