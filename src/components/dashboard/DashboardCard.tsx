"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Download, Filter } from "lucide-react";
import { exportToExcel } from "@/lib/excel";

interface FilterConfig {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

interface SummaryStat {
  label: string;
  value: string | number;
}

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  data: any[];
  filters?: FilterConfig[];
  summaryStats?: SummaryStat[];
  isLoading?: boolean;
  className?: string;
  renderRowAction?: (row: any) => React.ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  children,
  data,
  filters,
  summaryStats,
  isLoading,
  className,
  renderRowAction,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleExport = () => {
    exportToExcel(data, title.toLowerCase().replace(/\s+/g, "-"));
  };

  return (
    <Card
      className={`w-full shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden bg-card/50 backdrop-blur-sm border-border flex flex-col ${className || "h-full"}`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </CardTitle>
          {summaryStats && (
            <div className="flex gap-4">
              {summaryStats.map((stat, idx) => (
                <div key={idx} className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {stat.label}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        {filters && filters.length > 0 && (
          <div className="flex gap-2 mt-2">
            {filters.map((filter, idx) => (
              <div key={idx} className="flex-1 min-w-[100px]">
                <Select value={filter.value} onValueChange={filter.onChange}>
                  <SelectTrigger className="h-8 text-xs bg-muted/50 border-border">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0 pb-4 flex-1 relative min-h-[120px] flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="flex-1">{children}</div>

            {data && data.length > 0 && (
              <div className="absolute bottom-2 right-2 flex gap-2">
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
                      <DialogTitle>{title} - Detalle de Datos</DialogTitle>
                      <Button
                        onClick={handleExport}
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                      </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto mt-4 rounded-md border">
                      <Table>
                        <TableHeader className="bg-muted sticky top-0">
                          <TableRow>
                            {data.length > 0 &&
                              Object.keys(data[0])
                                .filter(
                                  (key) =>
                                    ![
                                      "id",
                                      "_id",
                                      "tenant_id",
                                      "tenantid",
                                    ].includes(key.toLowerCase()) &&
                                    !key.toLowerCase().endsWith("_id"),
                                )
                                .map((key) => {
                                  // Mapeo simple de headers a español
                                  const headerLabel =
                                    {
                                      orderNumber: "N° Orden",
                                      customerName: "Cliente",
                                      grandTotal: "Monto Total",
                                      createdAt: "Fecha",
                                      status: "Estado",
                                      salesChannel: "Canal",
                                      producto: "Producto",
                                      cantidad: "Cant.",
                                      precio_unit: "Precio Unit.",
                                      subtotal: "Subtotal",
                                      fecha: "Fecha",
                                      n_orden: "N° Orden",
                                      date: "Fecha",
                                      orders: "Órdenes",
                                      amount: "Monto",
                                      products: "Productos",
                                      sellerName: "Vendedor",
                                      totalSales: "Ventas Totales",
                                      orderCount: "N° Órdenes",
                                      productsCount: "Productos",
                                      averageTicket: "Ticket Promedio",
                                      monthlySales: "Venta Mes",
                                      weeklySales: "Venta Sem.",
                                      deliveredCount: "Entregados",
                                      createdCount: "Total Órdenes",
                                      deliveryEffectiveness: "% Efectividad",
                                    }[key] ||
                                    key.replace(/_/g, " ").toUpperCase();

                                  return (
                                    <TableHead
                                      key={key}
                                      className="text-xs uppercase font-bold text-muted-foreground"
                                    >
                                      {headerLabel}
                                    </TableHead>
                                  );
                                })}
                            {renderRowAction && (
                              <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                                Acciones
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.map((row, i) => (
                            <TableRow key={i}>
                              {Object.entries(row)
                                .filter(
                                  ([key]) =>
                                    ![
                                      "id",
                                      "_id",
                                      "tenant_id",
                                      "tenantid",
                                    ].includes(key.toLowerCase()) &&
                                    !key.toLowerCase().endsWith("_id"),
                                )
                                .map(([key, val]: [string, any], j) => {
                                  let displayValue = val;

                                  // Formateo inteligente basado en la clave o tipo
                                  if (
                                    typeof val === "number" &&
                                    (key.toLowerCase().includes("total") ||
                                      key.toLowerCase().includes("monto") ||
                                      key.toLowerCase().includes("precio") ||
                                      key.toLowerCase().includes("amount") ||
                                      key.toLowerCase().includes("subtotal"))
                                  ) {
                                    displayValue = `S/ ${val.toLocaleString(
                                      "es-PE",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}`;
                                  } else if (
                                    key.toLowerCase().includes("fecha") ||
                                    key.toLowerCase().includes("date") ||
                                    key.toLowerCase().includes("createdat")
                                  ) {
                                    try {
                                      displayValue = new Date(
                                        val,
                                      ).toLocaleDateString("es-PE", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      });
                                    } catch (e) {
                                      displayValue = String(val);
                                    }
                                  } else if (
                                    key === "status" ||
                                    key === "estado"
                                  ) {
                                    displayValue = String(val).toUpperCase();
                                  }

                                  return (
                                    <TableCell
                                      key={j}
                                      className="text-xs py-2 whitespace-nowrap"
                                    >
                                      {typeof val === "object" && val !== null
                                        ? JSON.stringify(val)
                                        : String(displayValue)}
                                    </TableCell>
                                  );
                                })}
                              {renderRowAction && (
                                <TableCell className="text-right py-1">
                                  {renderRowAction(row)}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
