"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdsSales } from "@/services/advertisingV22Service";
import { useAdsV22 } from "./context";
import { money, numeric } from "./model";
import { Block, Failure } from "./shared";

const OrdersPanel = dynamic(() =>
  import("../AdvertisingOrdersPanel").then((module) => module.AdvertisingOrdersPanel),
);

export function ProfitConnections({
  from,
  to,
  sales,
  loading,
  error,
  onSection,
}: {
  from: string;
  to: string;
  sales?: AdsSales;
  loading: boolean;
  error: unknown;
  onSection: (section: "products" | "measurement") => void;
}) {
  const { identity, actorId, settings } = useAdsV22();
  const [reviewOpen, setReviewOpen] = useState(false);
  const showCosts = settings?.capabilities.profit === true;
  const canReview = showCosts && settings?.capabilities.configure === true;
  const totals = sales?.totals;
  const attributed = totals?.attributedOrders ?? 0;
  return (
    <Block title="Ventas y costos de POWIP">
      <p className="text-sm text-muted-foreground">
        Las ventas, descuentos y costos registrados del período seleccionado alimentan los
        cálculos de Publicidad. COD se reconoce al entregar; prepago, al completar el cobro.
      </p>
      {loading && <p role="status">Consultando las ventas de POWIP…</p>}
      {error ? <Failure error={error} /> : null}
      {totals && (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Pedidos de Web y Mensajes</dt>
            <dd className="mt-1 text-lg font-semibold">{totals.orders}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Facturación reconocida · PEN</dt>
            <dd className="mt-1 text-lg font-semibold">{money(numeric(totals.billedRevenue))}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Pedidos vinculados a un anuncio</dt>
            <dd className="mt-1 text-lg font-semibold">{attributed} de {totals.orders}</dd>
          </div>
          {showCosts && (
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">
                Pedidos facturados con costos pendientes
              </dt>
              <dd className="mt-1 text-lg font-semibold">{totals.missingCostOrders}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Con un anuncio identificado, ROAS usa la facturación de sus pedidos. Sin esa referencia,
          una distribución basada en resultados de Meta se muestra como estimación cuando hay
          datos suficientes. No demuestra qué anuncio originó una venta.
        </p>
        <p>
          La ganancia usa costos registrados en los pedidos y sus revisiones. El costo actual del
          catálogo no reemplaza el costo histórico. Los importes pendientes se conservan sin
          calcular.
        </p>
        <p>
          Ganancia publicitaria = facturación reconocida − producto − envío − anuncios. Las
          comisiones y otros gastos se conservan en la revisión del pedido; este indicador no es
          el resultado contable final.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onSection("measurement")}>
          Conectar el origen de las ventas
        </Button>
        <Button variant="outline" onClick={() => onSection("products")}>
          Vincular productos con anuncios
        </Button>
        {canReview && (
          <Button
            variant={reviewOpen ? "outline" : "default"}
            aria-expanded={reviewOpen}
            onClick={() => setReviewOpen((open) => !open)}
          >
            {reviewOpen ? "Cerrar revisión de pedidos" : "Revisar anuncios y costos de pedidos"}
          </Button>
        )}
      </div>
      {canReview && reviewOpen && identity && actorId && (
        <OrdersPanel
          token={identity.token}
          companyId={identity.companyId}
          actorId={actorId}
          from={from}
          to={to}
        />
      )}
    </Block>
  );
}
