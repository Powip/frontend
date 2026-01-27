"use client";

import { useQuery } from "@tanstack/react-query";
import { getSellerSummary } from "@/api/Ventas";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export function SellerStats() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["sellerStats", companyId],
    queryFn: () => getSellerSummary(companyId!),
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay datos de ventas registrados para mostrar métricas de
            vendedores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">
        Rendimiento de Vendedores
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((seller: any) => (
          <Card key={seller.sellerName}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {seller.sellerName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                S/ {Number(seller.totalSales).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {seller.orderCount} ventas totales
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Ventas Totales</TableHead>
                <TableHead className="text-right">Ticket Promedio</TableHead>
                <TableHead className="text-right">Mes Actual</TableHead>
                <TableHead className="text-right">Semana Actual</TableHead>
                <TableHead className="text-right"># Órdenes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((seller: any) => (
                <TableRow key={seller.sellerName}>
                  <TableCell className="font-medium">
                    {seller.sellerName}
                  </TableCell>
                  <TableCell className="text-right">
                    S/ {Number(seller.totalSales).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    S/ {Number(seller.averageTicket).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    S/ {Number(seller.monthlySales).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    S/ {Number(seller.weeklySales).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {seller.orderCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
