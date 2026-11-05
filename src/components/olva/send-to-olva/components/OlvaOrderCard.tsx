"use client";

import { Trash2 } from "lucide-react";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { OlvaDestinationFields } from "./OlvaDestinationFields";
import { OlvaPackageFields } from "./OlvaPackageFields";
import { OlvaQuoteSummary } from "./OlvaQuoteSummary";
import { OlvaRecipientFields } from "./OlvaRecipientFields";

interface OlvaOrderCardProps {
  index: number;
  order: OrderDetail;
  headquarter: OlvaHeadquarter | undefined;
  /** Why the last attempt for this order failed, when it is being retried. */
  previousError?: string;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

/** One order of the lot: recipient, destination and package, with its own price. */
export function OlvaOrderCard({
  index,
  order,
  headquarter,
  previousError,
  onRemove,
  canRemove,
}: OlvaOrderCardProps) {
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Pedido {order.orderNumber}</h3>
            <p className="text-muted-foreground text-sm">{order.customer?.fullName}</p>
          </div>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar el pedido ${order.orderNumber} del lote`}
              onClick={() => onRemove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        {previousError ? (
          <Alert variant="destructive">
            <AlertDescription>{previousError}</AlertDescription>
          </Alert>
        ) : null}

        <OlvaRecipientFields index={index} />
        <OlvaDestinationFields index={index} customer={order.customer} />
        <OlvaPackageFields index={index} headquarter={headquarter} />
        <OlvaQuoteSummary index={index} headquarter={headquarter} />
      </CardContent>
    </Card>
  );
}
