"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PaymentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  fromDate: string;
  toDate: string;
}

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  open,
  onOpenChange,
  storeId,
  fromDate,
  toDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchPaymentDetails = async () => {
    if (!storeId || !open) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/payment-details`,
        {
          params: {
            storeId,
            fromDate,
            toDate,
            status: statusFilter,
          },
        },
      );
      setPayments(response.data || []);
    } catch (error) {
      console.error("Error fetching payment details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentDetails();
  }, [open, storeId, fromDate, toDate, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">PAGADO</Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600">PENDIENTE</Badge>
        );
      case "LOST":
        return <Badge className="bg-red-500 hover:bg-red-600">PERDIDO</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[90vw] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <DialogTitle className="text-xl font-bold">
            Detalle de Pagos
          </DialogTitle>
          <div className="flex items-center gap-2 mr-6">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Filtrar por estado:
            </span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">TODOS</SelectItem>
                <SelectItem value="PAID">PAGADOS</SelectItem>
                <SelectItem value="PENDING">PENDIENTES</SelectItem>
                <SelectItem value="LOST">PERDIDOS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center p-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              No se encontraron pagos para el período y estado seleccionado.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Fecha
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Orden
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Cliente
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Método
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground text-right">
                    Monto
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-xs">
                      {new Date(payment.paymentDate).toLocaleDateString(
                        "es-PE",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.orderNumber}
                    </TableCell>
                    <TableCell className="text-xs">
                      {payment.customerName || "Sin nombre"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {payment.paymentMethod}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right font-bold">
                      S/{" "}
                      {payment.amount.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
