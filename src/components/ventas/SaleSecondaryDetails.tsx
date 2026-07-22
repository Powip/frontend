"use client";

import { Loader2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

export interface TrackingEditValue {
  externalTrackingNumber: string;
  shippingCode: string;
  shippingKey: string;
  shippingOffice: string;
}

interface SaleSecondaryDetailsProps {
  sale: {
    id: string;
    externalId?: string | null;
    district: string;
    zone: string;
    city: string;
    province: string;
    salesRegion: "LIMA" | "PROVINCIA";
  };
  colSpan: number;
  showTracking: boolean;
  trackingEdits: Record<string, TrackingEditValue>;
  savingOrderId: string | null;
  updateTrackingField: (
    orderId: string,
    field: keyof TrackingEditValue,
    value: string,
  ) => void;
  handleSaveTracking: (orderId: string) => void;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value || "-"}</div>
    </div>
  );
}

export function SaleSecondaryDetails({
  sale,
  colSpan,
  showTracking,
  trackingEdits,
  savingOrderId,
  updateTrackingField,
  handleSaveTracking,
}: SaleSecondaryDetailsProps) {
  const isSaving = savingOrderId === sale.id;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell
        colSpan={colSpan}
        className="animate-in fade-in slide-in-from-top-1 duration-150 p-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3">
          <DetailField label="ID Externo" value={sale.externalId || ""} />
          <DetailField label="Distrito" value={sale.district} />
          <DetailField label="Zona" value={sale.zone} />
          <DetailField label="Ciudad" value={sale.city} />
          <DetailField label="Provincia" value={sale.province} />
          <DetailField label="Región" value={sale.salesRegion} />
        </div>

        {showTracking && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
              Datos de tracking
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">
                  Nro Tracking
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className={`w-full h-8 px-2 text-xs border rounded bg-background transition-all ${
                      isSaving
                        ? "opacity-50 border-orange-400 pr-6"
                        : "focus:border-orange-500"
                    }`}
                    placeholder="Nro..."
                    value={
                      trackingEdits[sale.id]?.externalTrackingNumber || ""
                    }
                    onChange={(e) =>
                      updateTrackingField(
                        sale.id,
                        "externalTrackingNumber",
                        e.target.value,
                      )
                    }
                    onBlur={() => handleSaveTracking(sale.id)}
                    disabled={isSaving}
                  />
                  {isSaving && (
                    <Loader2 className="absolute right-2 h-3 w-3 animate-spin text-orange-500" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">
                  Código
                </label>
                <input
                  type="text"
                  className={`w-full h-8 px-2 text-xs border rounded bg-background transition-all ${
                    isSaving ? "opacity-50 border-orange-400" : "focus:border-orange-500"
                  }`}
                  placeholder="Código"
                  value={trackingEdits[sale.id]?.shippingCode || ""}
                  onChange={(e) =>
                    updateTrackingField(sale.id, "shippingCode", e.target.value)
                  }
                  onBlur={() => handleSaveTracking(sale.id)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">
                  Clave
                </label>
                <input
                  type="text"
                  className={`w-full h-8 px-2 text-xs border rounded bg-background transition-all ${
                    isSaving ? "opacity-50 border-orange-400" : "focus:border-orange-500"
                  }`}
                  placeholder="Clave"
                  value={trackingEdits[sale.id]?.shippingKey || ""}
                  onChange={(e) =>
                    updateTrackingField(sale.id, "shippingKey", e.target.value)
                  }
                  onBlur={() => handleSaveTracking(sale.id)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">
                  Oficina
                </label>
                <input
                  type="text"
                  className={`w-full h-8 px-2 text-xs border rounded bg-background transition-all ${
                    isSaving ? "opacity-50 border-orange-400" : "focus:border-orange-500"
                  }`}
                  placeholder="Oficina..."
                  value={trackingEdits[sale.id]?.shippingOffice || ""}
                  onChange={(e) =>
                    updateTrackingField(sale.id, "shippingOffice", e.target.value)
                  }
                  onBlur={() => handleSaveTracking(sale.id)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
