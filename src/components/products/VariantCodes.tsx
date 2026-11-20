"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// FEAT-24 H2-F — códigos de una variante guardada (solo lectura): el código de
// barras de fábrica y el EAN-13 de POWIP (lo asigna la base y no cambia).
// Cualquiera de los dos sirve para escanear al recibir y en el picking.

interface Props {
  sku?: string | null;
  barcode?: string | null;
  powipEan?: string | null;
}

export default function VariantCodes({ sku, barcode, powipEan }: Props) {
  const copy = async () => {
    if (!powipEan) return;
    try {
      await navigator.clipboard.writeText(powipEan);
      toast.success("EAN de POWIP copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
    }
  };

  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
      {sku ? (
        <div>
          <dt className="text-muted-foreground">SKU POWIP</dt>
          <dd className="font-mono">{sku}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-muted-foreground">Código de fábrica</dt>
        <dd className="font-mono">{barcode?.trim() ? barcode : "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">EAN de POWIP</dt>
        <dd className="flex items-center gap-1 font-mono">
          {powipEan ? (
            <>
              <span>{powipEan}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Copiar EAN de POWIP"
                title="Copiar"
                onClick={() => void copy()}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <span className="font-sans text-muted-foreground">Se asigna al guardar</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
