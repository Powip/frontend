"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  FileCheck,
  Clock,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/lib/api";
import { getInvoiceLogByExternalId } from "@/api/Facturacion";
import InvoiceModal from "@/components/modals/InvoiceModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { isSuperadmin } from "@/config/permissions.config";

interface Sale {
  id: string;
  orderNumber: string;
  grandTotal: number;
  status: string;
  created_at: string;
  customer: {
    fullName: string;
    documentNumber?: string;
    email?: string;
  };
  items: {
    productName: string;
    quantity: number;
    price: number;
    sku?: string;
  }[];
}

interface SunatLog {
  status: 'PENDING' | 'ACCEPTED' | 'OBSERVED' | 'REJECTED' | 'NOT_ISSUED';
  document_type?: string;
  series?: string;
  correlative?: number;
  xml_url?: string;
  cdr_url?: string;
  sunat_description?: string;
  observations?: string;
  response_description?: string;
}

export default function FacturacionPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sunatLogs, setSunatLogs] = useState<Record<string, SunatLog>>({});
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedStoreId, auth, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const userEmail = auth?.user?.email;

    if (!authLoading && userEmail && !isSuperadmin(userEmail)) {
      toast.error("No tienes permisos para acceder a esta sección.");
      router.push("/dashboard");
    }
  }, [auth, authLoading, router]);

  const fetchSales = async () => {
    if (!selectedStoreId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`${API.ventas}/order-header/store/${selectedStoreId}`);
      // Filtrar solo entregadas
      const deliveredSales = data.filter((s: any) => s.status === "ENTREGADO");
      setSales(deliveredSales);

      // Fetch status for each sale
      deliveredSales.forEach(async (sale: Sale) => {
        const log = await getInvoiceLogByExternalId(sale.id);
        if (log.success && log.data) {
          setSunatLogs(prev => ({ ...prev, [sale.id]: log.data }));
        } else {
          setSunatLogs(prev => ({ ...prev, [sale.id]: { status: 'NOT_ISSUED' } }));
        }
      });
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Error al cargar las ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchSales();
    }
  }, [selectedStoreId]);

  const filteredSales = sales.filter(s =>
    s.customer.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading || !isSuperadmin(auth?.user?.email || "")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusBadge = (id: string) => {
    const log = sunatLogs[id];
    if (!log || log.status === 'NOT_ISSUED') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-500">Sin Emitir</Badge>;
    }

    switch (log.status) {
      case 'ACCEPTED':
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Aceptado</Badge>;
      case 'OBSERVED':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Observado</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Rechazado</Badge>;
      case 'PENDING':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 animate-pulse">Pendiente</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const handleOpenModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación SUNAT</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona la emisión de comprobantes electrónicos para tus ventas entregadas.
          </p>
        </div>
        <Button onClick={fetchSales} variant="outline" className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Actualizar Lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-900 border-green/20 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green" />
              Emitidos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-[10px] text-muted-foreground mt-1">+0% vs ayer</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-blue-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Pendientes de Envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ventas por regularizar</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-red-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Rechazados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-[10px] text-muted-foreground mt-1">Requieren atención</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Ventas Entregadas</CardTitle>
              <CardDescription>Mostrando ventas con estado &quot;ENTREGADO&quot; listas para facturar.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, correlativo..."
                className="pl-9 bg-gray-50 dark:bg-gray-800 border-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800">
                <TableRow>
                  <TableHead className="font-bold">Fecha</TableHead>
                  <TableHead className="font-bold">Venta / ID</TableHead>
                  <TableHead className="font-bold">Cliente</TableHead>
                  <TableHead className="font-bold text-right">Total</TableHead>
                  <TableHead className="font-bold text-center">Estado SUNAT</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                      {loading ? "Cargando ventas..." : "No se encontraron ventas entregadas."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => {
                    const log = sunatLogs[sale.id];
                    return (
                      <TableRow key={sale.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <TableCell className="text-xs">
                          {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{sale.orderNumber}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{sale.id.substring(0, 8)}...</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{sale.customer.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">{sale.customer.documentNumber || "Sin documento"}</div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-green">
                          S/ {Number(sale.grandTotal).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {getStatusBadge(sale.id)}
                            {log?.sunat_description && (
                              <span className="text-[9px] text-muted-foreground max-w-[120px] truncate" title={log.sunat_description}>
                                {log.sunat_description}
                              </span>
                            )}
                            {log?.status === 'OBSERVED' && log.observations && (
                              <span className="text-[9px] text-yellow-600 font-medium max-w-[120px] truncate" title={log.observations}>
                                Obs: {log.observations}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {log?.status === 'ACCEPTED' && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" asChild title="Descargar XML">
                                  <a href={`${API.integrations}/sunat/xml/${sale.id}`} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4 text-blue-500" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="icon" asChild title="Descargar PDF">
                                  <a href={`${API.integrations}/sunat/pdf/${sale.id}`} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4 text-red-500" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="icon" asChild title="Descargar CDR">
                                  <a href={log.cdr_url} target="_blank" rel="noopener noreferrer">
                                    <FileCheck className="h-4 w-4 text-green" />
                                  </a>
                                </Button>
                              </div>
                            )}

                            {log?.status === 'REJECTED' && (
                              <Button variant="ghost" size="icon" onClick={() => toast.error(log.response_description || "Error desconocido")} title="Ver Error">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant={log?.status === 'ACCEPTED' ? "outline" : "default"}
                              className={cn(log?.status === 'ACCEPTED' ? "border-primary/20 text-primary hover:bg-primary/5" : "bg-primary hover:bg-primary/90 text-white")}
                              onClick={() => handleOpenModal(sale)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              {log?.status === 'ACCEPTED' ? "Re-emitir" : "Gestionar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedSale && (
        <InvoiceModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSale(null);
          }}
          sale={selectedSale}
          onSuccess={() => {
            fetchSales();
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}