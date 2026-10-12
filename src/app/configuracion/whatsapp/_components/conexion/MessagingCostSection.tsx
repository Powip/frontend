import { CreditCard, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import {
  waButton,
  waTable,
  waTableWrap,
  waTd,
  waTh,
  waTr,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type {
  WhatsAppPricing,
  WhatsAppPricingItem,
  WhatsAppUsageSummary,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { isPricingStale } from "@/features/whatsapp/utils/connection.util";
import { formatDateKey, formatLimaDate } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";

const TYPE_CATEGORY: Record<WhatsAppPricingItem["type"], string> = {
  utility: "Plantillas de Utilidad",
  marketing: "Plantillas de Marketing",
  service: "Respuestas dentro de las 24 h",
  authentication: "Plantillas de Autenticación",
};

function UsageLine({
  usage,
  onRetry,
}: {
  usage: ResourceState<WhatsAppUsageSummary>;
  onRetry?: () => void;
}) {
  if (usage.kind === "pending-integration") {
    return (
      <span className="mt-1 block text-wa-muted">
        Uso del mes pendiente de integración: no se muestran cantidades ni montos de ejemplo.
      </span>
    );
  }
  if (usage.kind === "loading") {
    return (
      <span role="status" className="mt-1 block text-wa-muted">
        Cargando el uso del mes…
      </span>
    );
  }
  if (usage.kind !== "ready") {
    return (
      <span role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-wa-red">
        {usage.kind === "forbidden"
          ? "No tienes permiso para ver el uso del mes."
          : "No se pudo cargar el uso del mes."}
        {usage.kind === "error" && onRetry && (
          <Button type="button" className={waButton({ size: "sm" })} onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Reintentar
          </Button>
        )}
      </span>
    );
  }
  const data = usage.data;
  const delivered =
    data.templatesDelivered === null
      ? "avisos del mes sin dato"
      : `${data.templatesDelivered.toLocaleString("es-PE")} avisos`;
  const cost = data.estimatedCost
    ? data.estimatedCost.pen
      ? `aprox. S/ ${data.estimatedCost.pen} (USD ${data.estimatedCost.usd})`
      : `aprox. USD ${data.estimatedCost.usd}`
    : "costo estimado sin dato";
  return (
    <>
      {" "}
      Este mes llevas{" "}
      <b className="wa-num font-semibold">
        {delivered} · {cost}
      </b>
      .
      {data.serviceRepliesUsed !== null && data.serviceRepliesFree !== null && (
        <span className="mt-1 block text-wa-muted">
          Respuestas de servicio: {data.serviceRepliesUsed.toLocaleString("es-PE")} de{" "}
          {data.serviceRepliesFree.toLocaleString("es-PE")} gratis según Meta.
        </span>
      )}
      {data.estimatedCost?.exchangeRate && (
        <span className="mt-1 block text-wa-muted">
          Estimación de POWIP con tipo de cambio {data.estimatedCost.exchangeRate}
          {data.estimatedCost.rateDate ? ` del ${formatDateKey(data.estimatedCost.rateDate)}` : ""}.
          Lo que cobra Meta puede variar.
        </span>
      )}
    </>
  );
}

interface MessagingCostSectionProps {
  pricing: ResourceState<WhatsAppPricing>;
  usage: ResourceState<WhatsAppUsageSummary>;
  now: Date;
  onRetry?: () => void;
}

export function MessagingCostSection({ pricing, usage, now, onRetry }: MessagingCostSectionProps) {
  return (
    <WaCard aria-labelledby="cost-title">
      <WaCardHeader
        titleId="cost-title"
        title="Costo de los mensajes"
        description="Meta cobra los avisos de envío y las respuestas en el chat. Las tarifas se muestran con su fuente y su fecha de vigencia."
      />
      <div className="mb-[18px]">
        <WhatsAppResourceState
          state={pricing}
          pendingTitle="Tarifas pendientes de integración"
          pendingDescription="Las tarifas de Meta cambian: se mostrarán con su fuente y fecha de vigencia cuando POWIP las informe. Los montos del documento funcional no se usan como precios actuales."
          loadingLabel="Cargando tarifas"
          errorTitle="No se pudieron cargar las tarifas"
          onRetry={onRetry}
        >
          {(data) => (
            <div className="flex flex-col gap-2.5">
              {isPricingStale(data.verifiedAt, now) && (
                <WaCallout tone="amber" icon={TriangleAlert} compact>
                  Tarifas no verificadas recientemente: revisa la fuente antes de usarlas.
                </WaCallout>
              )}
              <div className={waTableWrap}>
                <Table className={waTable}>
                  <TableHeader>
                    <TableRow className={waTr}>
                      <TableHead className={waTh}>Tipo de mensaje</TableHead>
                      <TableHead className={waTh}>Cuándo se cobra</TableHead>
                      <TableHead className={cn(waTh, "text-right")}>Meta (USD)</TableHead>
                      <TableHead className={cn(waTh, "text-right")}>Aprox. en soles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.type} className={waTr}>
                        <TableCell className={waTd}>
                          <b className="font-semibold">{item.label}</b>
                          <span className="block text-xs text-wa-muted">
                            {TYPE_CATEGORY[item.type]}
                          </span>
                        </TableCell>
                        <TableCell className={cn(waTd, "min-w-48")}>{item.chargedWhen}</TableCell>
                        <TableCell className={cn(waTd, "wa-num text-right")}>${item.usd}</TableCell>
                        <TableCell className={cn(waTd, "wa-num text-right")}>
                          {item.pen ? `S/ ${item.pen}` : "Sin dato"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="m-0 text-xs text-wa-muted">
                Mercado {data.market} · vigentes desde {formatDateKey(data.effectiveFrom)} · fuente:{" "}
                {data.sourceUrl ? (
                  <a
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {data.source}
                  </a>
                ) : (
                  data.source
                )}
                {data.verifiedAt
                  ? ` · verificadas el ${formatLimaDate(data.verifiedAt)}`
                  : " · sin fecha de verificación"}
                {data.exchangeRate
                  ? ` · tipo de cambio ${data.exchangeRate.value} (${data.exchangeRate.source}, ${formatDateKey(data.exchangeRate.date)})`
                  : ""}
              </p>
            </div>
          )}
        </WhatsAppResourceState>
      </div>
      <WaCallout icon={CreditCard}>
        <b className="font-semibold">Meta te cobra directo.</b> Los mensajes se cargan a la tarjeta
        que registraste en tu cuenta de Meta, en dólares. POWIP no agrega recargo.
        <UsageLine usage={usage} onRetry={onRetry} />
      </WaCallout>
    </WaCard>
  );
}
