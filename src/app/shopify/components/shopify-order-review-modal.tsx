"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { toast } from "sonner";

interface ShopifyOrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: any[];
  shopUrl: string;
}

export function ShopifyOrderReviewModal({
  isOpen,
  onClose,
  orders,
  shopUrl,
}: ShopifyOrderReviewModalProps) {
  const { auth } = useAuth();
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map((o) => o.id.toString())));
    }
  };

  const toggleSelectOrder = (id: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleExpandOrder = (id: string) => {
    const newExpanded = new Set(expandedOrderIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedOrderIds(newExpanded);
  };

  const handleSync = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error("Por favor selecciona al menos una orden");
      return;
    }

    setIsSyncing(true);
    const selectedOrders = orders.filter((o) =>
      selectedOrderIds.has(o.id.toString()),
    );

    try {
      await axios.post(
        `http://localhost:3007/shopify/confirm-sync/${shopUrl}`,
        {
          orders: selectedOrders,
          companyId: auth?.company?.id,
          storeId: auth?.company?.stores?.[0]?.id, // Asumimos la primera tienda por defecto si hay varias
        },
      );
      toast.success(`${selectedOrders.length} órdenes enviadas a sincronizar`);
      onClose();
    } catch (error) {
      console.error("Error syncing orders:", error);
      toast.error("Error al sincronizar las órdenes");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Revisar Órdenes de Shopify</span>
            <Badge variant="outline" className="text-teal-600 border-teal-200">
              {orders.length} órdenes encontradas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden my-4 border rounded-md">
          <ScrollArea className="h-full">
            <Table className="min-w-[800px]">
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedOrderIds.size === orders.length &&
                        orders.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[120px]">Orden</TableHead>
                  <TableHead className="w-[150px]">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[100px] text-center">Items</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const id = order.id.toString();
                  const isExpanded = expandedOrderIds.has(id);
                  const isSelected = selectedOrderIds.has(id);
                  const customer = order.customer;

                  return (
                    <React.Fragment key={id}>
                      <TableRow
                        className={
                          isSelected ? "bg-teal-50/30 dark:bg-teal-900/10" : ""
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOrder(id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{order.order_number || order.name}</span>
                            {order.is_draft && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] w-fit h-4 px-1"
                              >
                                BORRADOR
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.created_at), "dd MMM, HH:mm", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col truncate max-w-[200px]">
                            <span className="font-semibold">
                              {customer
                                ? `${customer.first_name || ""} ${customer.last_name || ""}`
                                : "Sin Cliente"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {customer?.email || "Sin email"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {order.currency}{" "}
                          {parseFloat(order.total_price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {order.line_items?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExpandOrder(id)}
                            className="h-8 w-8"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-3">
                              <h4 className="font-bold text-sm border-b pb-1">
                                Detalle de Productos
                              </h4>
                              <Table className="bg-background rounded-md border text-xs">
                                <TableHeader>
                                  <TableRow className="h-8">
                                    <TableHead>Producto</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">
                                      Cant.
                                    </TableHead>
                                    <TableHead className="text-right">
                                      P. Unit
                                    </TableHead>
                                    <TableHead className="text-right">
                                      Subtotal
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.line_items.map(
                                    (item: any, idx: number) => (
                                      <TableRow key={idx} className="h-12">
                                        <TableCell className="font-medium max-w-[300px]">
                                          <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded border bg-muted overflow-hidden flex-shrink-0">
                                              {item.image_url ? (
                                                <img
                                                  src={item.image_url}
                                                  alt={item.title}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground bg-muted/50 uppercase">
                                                  Sin Foto
                                                </div>
                                              )}
                                            </div>
                                            <span className="truncate">
                                              {item.title}{" "}
                                              {item.variant_title !==
                                              "Default Title"
                                                ? `(${item.variant_title})`
                                                : ""}
                                            </span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          {item.sku || "S/SKU"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {item.quantity}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {order.currency}{" "}
                                          {parseFloat(
                                            item.price,
                                          ).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {order.currency}{" "}
                                          {(
                                            item.quantity *
                                            parseFloat(item.price)
                                          ).toLocaleString()}
                                        </TableCell>
                                      </TableRow>
                                    ),
                                  )}
                                </TableBody>
                              </Table>

                              <div className="flex justify-between items-start pt-2">
                                <div className="text-xs space-y-1">
                                  <p>
                                    <span className="font-bold">
                                      Dirección:
                                    </span>{" "}
                                    {order.shipping_address?.address1 ||
                                      "No especificada"}
                                  </p>
                                  <p>
                                    <span className="font-bold">Ciudad:</span>{" "}
                                    {order.shipping_address?.city || ""},{" "}
                                    {order.shipping_address?.province || ""}
                                  </p>
                                </div>
                                <div className="text-right text-xs space-y-1">
                                  <p>
                                    Envío: {order.currency}{" "}
                                    {parseFloat(
                                      order.total_shipping_price_set?.shop_money
                                        ?.amount || "0",
                                    ).toLocaleString()}
                                  </p>
                                  <p>
                                    Impuestos: {order.currency}{" "}
                                    {parseFloat(
                                      order.total_tax || "0",
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div className="text-sm text-muted-foreground italic">
            {selectedOrderIds.size} órdenes seleccionadas para importar
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSyncing}>
              Cancelar
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white min-w-[150px]"
              onClick={handleSync}
              disabled={isSyncing || selectedOrderIds.size === 0}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Importar Selección
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
