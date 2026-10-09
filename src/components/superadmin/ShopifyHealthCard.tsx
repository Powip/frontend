"use client";

import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShopifyHealthReport, useShopifyHealth } from "@/hooks/useShopifyHealth";

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  error: "Error",
  token_revocado: "Token revocado",
  plan_impago: "Plan impago",
  desinstalada: "Desinstalada",
};

const ISSUE_LABEL: Record<string, string> = {
  falta_en_powip: "Falta en Powip",
  pago_distinto: "Pago distinto",
  cancelacion_sin_reflejar: "Cancelación sin reflejar",
  total_distinto: "Total distinto",
  faltan_datos_cliente: "Faltan datos del cliente",
  producto_sin_vincular: "Producto sin vincular",
};

const shortShop = (url: string) => url.replace(/\.myshopify\.com$/, "");

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" })
    : "—";

/** Contenido de la tarjeta (sin datos remotos), separado para poder testearlo. */
export function ShopifyHealthContent({ report }: { report: ShopifyHealthReport }) {
  const s = report.summary;
  const problems = s.error + s.token_revocado + s.plan_impago + s.desinstalada + s.openIssues + (s.dlq ?? 0);
  const allOk = problems === 0 && report.shops.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {allOk ? (
          <Badge className="bg-green-500">Todo OK</Badge>
        ) : (
          <>
            <span>{s.ok} OK</span>
            {s.error > 0 && <span>{s.error} con error</span>}
            {s.token_revocado > 0 && <span>{s.token_revocado} token revocado</span>}
            {s.plan_impago > 0 && <span>{s.plan_impago} plan impago</span>}
            {s.desinstalada > 0 && <span>{s.desinstalada} desinstalada</span>}
            {s.openIssues > 0 && <span>{s.openIssues} pedidos con problemas</span>}
          </>
        )}
        <span className="text-muted-foreground">DLQ: {s.dlq === null ? "sin dato" : s.dlq}</span>
      </div>

      {report.shops.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Tiendas con problemas</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última sync OK</TableHead>
                  <TableHead>Último error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.shops.map((shop) => (
                  <TableRow key={shop.shopUrl}>
                    <TableCell>{shortShop(shop.shopUrl)}</TableCell>
                    <TableCell className="font-mono text-xs">{shop.companyId.slice(0, 8)}</TableCell>
                    <TableCell>
                      {`${STATUS_LABEL[shop.healthStatus] ?? shop.healthStatus}${
                        shop.needsReauthorization ? " · falta un permiso" : ""
                      }`}
                    </TableCell>
                    <TableCell>{fmt(shop.lastSuccessAt)}</TableCell>
                    <TableCell>{shop.lastError ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {report.issues.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Pedidos con problemas ({s.openIssues} abiertos)</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.issues.map((issue) => (
                  <TableRow key={`${issue.shopUrl}-${issue.orderName}-${issue.type}`}>
                    <TableCell>{shortShop(issue.shopUrl)}</TableCell>
                    <TableCell>{issue.orderName ?? "—"}</TableCell>
                    <TableCell>{issue.orderNumber ?? "—"}</TableCell>
                    <TableCell>{ISSUE_LABEL[issue.type] ?? issue.type}</TableCell>
                    <TableCell className="text-xs">{issue.detail}</TableCell>
                    <TableCell>{fmt(issue.detectedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Último chequeo de pedidos: {report.lastAuditAt ? fmt(report.lastAuditAt) : "sin corridas todavía"}
      </p>
    </div>
  );
}

/** FEAT-22 M3 — salud de la integración Shopify en superadmin → Sistema. */
export function ShopifyHealthCard({ token }: { token?: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useShopifyHealth(token);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Shopify</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refrescar">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-red-600">No se pudo consultar el estado de Shopify.</p>}
        {data && <ShopifyHealthContent report={data} />}
      </CardContent>
    </Card>
  );
}
