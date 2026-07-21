"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Truck,
  Search,
  RefreshCw,
  FileText,
  Printer,
  Package,
  Clock,
  MapPin,
  AlertCircle,
  Calculator,
  ArrowRight,
  User,
  CheckCircle2,
  X,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { 
  getShalomLabelPdfUrl, 
  getShalomTicketPdfUrl,
  quoteShalom,
  trackShalomGuide,
  updateGuideQuote
} from "@/services/shalomService";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import ShalomOrderTrackingView from "@/components/tracking/ShalomOrderTrackingView";
import AliclikOrderTrackingView from "@/components/tracking/AliclikOrderTrackingView";

interface TrackingGuide {
  id: string;
  guideNumber: string;
  courierName: string;
  status: string;
  created_at: string;
  originAgencyName?: string;
  destinationAgencyName?: string;
  quotedAmount?: number;
  quotedCurrency?: string;
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    trackingInfo?: {
      orderNumber: string;
      orderCode: string;
    };
  }[];
  externalGuideReference?: string;
  externalCarrierId?: string;
  shalomTrackingData?: any;
}

export default function CourierTrackingView() {
  const { auth, selectedStoreId } = useAuth();
  const [guides, setGuides] = useState<TrackingGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCarrierTab, setActiveCarrierTab] = useState("shalom");

  // Track State
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<TrackingGuide | null>(null);

  // Details State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [guideForDetails, setGuideForDetails] = useState<string | null>(null);

  const fetchGuides = useCallback(async () => {
    if (!selectedStoreId || !auth?.accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${selectedStoreId}`,
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` }
        }
      );
      setGuides(res.data);
    } catch {
      toast.error("No se pudieron cargar las guías de envío");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, auth]);

  useEffect(() => {
    fetchGuides();
  }, [fetchGuides]);

  const handleTrackShalom = async (guide: TrackingGuide) => {
    if (!auth?.accessToken || !auth?.company?.id) return;
    
    setSelectedGuide(guide);
    setTrackingModalOpen(true);
    setTrackLoading(true);
    setTrackResult(null);

    try {
      const result = await trackShalomGuide(
        auth.accessToken,
        guide.id
      );
      setTrackResult(result);
    } catch (error) {
      setTrackResult({ error: "No se pudo obtener el rastreo de Shalom" });
    } finally {
      setTrackLoading(false);
    }
  };

  const handleQuoteDirectly = async (guide: TrackingGuide) => {
    if (!auth?.accessToken || !selectedStoreId) return;

    // Para cotizar necesitamos los detalles de la guía (agencia origen, destino, paquetes)
    // Pero el usuario dice que "la cotización debería de poderse calcular" si ya existe.
    // Vamos a obtener los detalles de la guía para tener los bultos reales.
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );
      const fullGuide = res.data;

      // Necesitamos al menos una orden para sacar los datos de bultos
      // O los datos guardados en la guía si los hubiera.
      // Como no tenemos un endpoint de "re-quote", vamos a simularlo obteniendo datos del primer pedido
      // o usando valores por defecto razonables si no están.
      
      // Fetch details of orders in guide to get package info
      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${fullGuide.orderIds[0]}/receipt`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );
      const order = orderRes.data;

      // Intentar reconstruir la cotización usando el payload guardado
      const shalomPayload = fullGuide.shalomRequestPayload;
      const meta = shalomPayload?.meta;
      const shipments = Array.isArray(shalomPayload) 
        ? shalomPayload 
        : (shalomPayload?.shipments || []);
      const firstShipment = shipments[0];
      
      const h = Number(firstShipment?.height) || 10;
      const w = Number(firstShipment?.width) || 10;
      const l = Number(firstShipment?.length) || 15;

      const quoteData = {
        origin: meta?.originAgencyId || firstShipment?.origin || fullGuide.shippingOffice || "1",
        destination: meta?.orderDestinations?.[fullGuide.orderIds?.[0]] || firstShipment?.destination || order.shippingOffice || "1",
        content: firstShipment?.content || "MERCADERIA",
        // Heurística: si es >= 1, asumimos CM y dividimos por 100. Si es < 1, ya está en metros.
        height: h < 1 ? h : h / 100,
        width: w < 1 ? w : w / 100,
        length: l < 1 ? l : l / 100,
        weight: Number(firstShipment?.weight) || 1,
        quantity: Number(firstShipment?.quantity) || 1
      };

      const quoteRes = await quoteShalom(auth.accessToken, quoteData);
      
      if (quoteRes.precio) {
        await updateGuideQuote(auth.accessToken, guide.id, quoteRes.precio, quoteRes.moneda);
        toast.success(`Cotización actualizada: ${quoteRes.moneda} ${quoteRes.precio}`);
        fetchGuides(); // Recargar tabla
      }
    } catch {
      toast.error("No se pudo calcular la cotización automáticamente");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (guideId: string) => {
    setGuideForDetails(guideId);
    setDetailsModalOpen(true);
  };

  const openDocument = (url: string) => {
    window.open(url, "_blank");
  };

  // Usado por la pestaña "Todos": todas las guías reales de la tienda que
  // matchean la búsqueda, sin filtrar por courier (Shalom y Aliclik tienen
  // su propia vista dedicada con datos en vivo de su respectiva API).
  const filteredGuides = guides.filter(
    (g) =>
      (g.guideNumber?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (g.courierName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (g.orders?.some((o) =>
        o.orderNumber?.toLowerCase().includes(search.toLowerCase()),
      ) ?? false),
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeCarrierTab} onValueChange={setActiveCarrierTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="shalom">Shalom</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aliclik">Aliclik</TabsTrigger>
        </TabsList>

        <TabsContent value="shalom">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-lg">Seguimiento Detallado Shalom</CardTitle>
              <CardDescription>Gestiona las órdenes de Shalom con información de rastreo granular.</CardDescription>
            </CardHeader>
            <CardContent>
              <ShalomOrderTrackingView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aliclik">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-lg">Seguimiento Aliclik</CardTitle>
              <CardDescription>Gestiona los pedidos enviados a Aliclik con información de estado y cancelación.</CardDescription>
            </CardHeader>
            <CardContent>
              <AliclikOrderTrackingView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todos">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 px-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <CardTitle className="text-lg">Todas las Guías</CardTitle>
                  <CardDescription>Resumen general de guías de todos los couriers.</CardDescription>
                </div>
                <div className="text-muted-foreground text-xs font-medium bg-muted/50 px-2 py-1 rounded">
                  {filteredGuides.length} guías
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por guía, orden o courier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
                <Button onClick={fetchGuides} variant="outline" size="sm" className="gap-2 shrink-0">
                  <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="border-t border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold px-4 h-10 text-xs">N° Guía</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center">Fecha</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center">Courier</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center">Costo</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-right text-xs">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5} className="h-16 animate-pulse bg-muted/10 px-4" />
                        </TableRow>
                      ))
                    ) : filteredGuides.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                          No hay guías para mostrar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGuides.map((guide) => (
                        <TableRow 
                          key={guide.id} 
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(guide.id)}
                        >
                          <TableCell className="font-medium px-4 py-3 text-xs">{guide.guideNumber}</TableCell>
                          <TableCell className="px-4 py-3 text-[10px] text-center whitespace-nowrap">{new Date(guide.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <Badge variant="outline" className="text-[10px]">{guide.courierName}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center text-[10px]">
                            {guide.quotedAmount ? `${guide.quotedCurrency || "S/"} ${guide.quotedAmount}` : "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                             <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRowClick(guide.id)}><Eye className="h-3.5 w-3.5" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE TRACKING */}
      <Dialog open={trackingModalOpen} onOpenChange={setTrackingModalOpen}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Tracking en Tiempo Real - Shalom
            </DialogTitle>
          </DialogHeader>

          {trackLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Consultando terminal de Shalom...</p>
            </div>
          ) : trackResult?.error ? (
            <div className="py-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-10 w-10" />
              <p>{trackResult.error}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. RESUMEN DE ORDEN */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Orden</label>
                  <p className="font-mono text-sm font-semibold">{trackResult?.search?.data?.numero_orden || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Código</label>
                  <p className="font-mono text-sm font-semibold">{trackResult?.search?.data?.codigo_orden || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Monto</label>
                  <p className="text-sm font-bold text-primary">S/ {trackResult?.search?.data?.monto || "0.00"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Estado Actual</label>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                    {trackResult?.statuses?.message || "Registrado"}
                  </Badge>
                </div>
              </div>

              {/* 2. RUTA DE ENVÍO */}
              <div className="relative p-4 bg-muted/20 border border-border rounded-xl">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-primary">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Origen</span>
                      </div>
                      <p className="text-sm font-bold">{trackResult?.search?.data?.origen?.nombre}</p>
                      <p className="text-[10px] text-muted-foreground italic">
                        {trackResult?.search?.data?.origen?.distrito}, {trackResult?.search?.data?.origen?.provincia}
                      </p>
                    </div>

                    <div className="hidden md:flex flex-col items-center px-4">
                      <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                      <span className="text-[9px] text-muted-foreground font-medium mt-1 uppercase">{trackResult?.search?.data?.tiempo_llegada}</span>
                    </div>

                    <div className="flex-1 space-y-1 text-right">
                      <div className="flex items-center gap-2 text-green-600 justify-end">
                        <span className="text-xs font-bold uppercase">Destino</span>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold">{trackResult?.search?.data?.destino?.nombre}</p>
                      <p className="text-[10px] text-muted-foreground italic">
                        {trackResult?.search?.data?.destino?.distrito}, {trackResult?.search?.data?.destino?.provincia}
                      </p>
                    </div>
                 </div>
                 
                 <div className="mt-4 pt-3 border-t border-border flex justify-between text-[11px]">
                   <div className="flex items-center gap-1.5">
                     <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                     <span className="text-muted-foreground">Emisión:</span>
                     <span className="font-semibold">{trackResult?.search?.data?.fecha_emision?.split(' ')[0]}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                     <CheckCircle2 className={`h-3.5 w-3.5 ${trackResult?.search?.data?.entregado ? "text-green-500" : "text-amber-500"}`} />
                     <span className="font-semibold uppercase">{trackResult?.search?.data?.entregado ? "Entregado" : "En Camino"}</span>
                   </div>
                 </div>
              </div>

              {/* 3. PARTICIPANTES Y DETALLES */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Remitente</span>
                   </div>
                   <div>
                     <p className="text-xs font-bold truncate">{trackResult?.search?.data?.remitente?.nombre}</p>
                     <p className="text-[10px] text-muted-foreground">{trackResult?.search?.data?.remitente?.documento}</p>
                   </div>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Destinatario</span>
                   </div>
                   <div>
                     <p className="text-xs font-bold truncate">{trackResult?.search?.data?.destinatario?.nombre}</p>
                     <p className="text-[10px] text-muted-foreground">{trackResult?.search?.data?.destinatario?.documento}</p>
                   </div>
                </div>
              </div>

              {/* 4. TIMELINE DE ESTADOS SHALOM */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" /> Línea de Tiempo Shalom
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 relative pl-4 border-l-2 border-primary/20 ml-2">
                  {Object.entries(trackResult?.statuses?.data || {}).map(([key, value]: [string, any], idx) => {
                    const hasData = value && value.fecha;
                    return (
                      <div key={key} className="relative py-1">
                        <div className={`absolute -left-[23px] top-1.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${hasData ? "bg-primary text-white" : "bg-muted text-muted-foreground/30"}`}>
                          {hasData && <CheckCircle2 className="h-2.5 w-2.5" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className={`text-[11px] font-bold uppercase ${hasData ? "text-foreground" : "text-muted-foreground/50"}`}>
                            {key.replace('_', ' ')}
                          </p>
                          {hasData ? (
                            <p className="text-[10px] font-medium text-muted-foreground">{value.fecha}</p>
                          ) : (
                            <p className="text-[9px] italic text-muted-foreground/40">Pendiente</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setTrackingModalOpen(false)} className="gap-2">
                  <X className="h-4 w-4" /> Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALLES DE GUIA */}
      <GuideDetailsModal 
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        guideId={guideForDetails || undefined}
        onGuideUpdated={fetchGuides}
        isCourierView={true}
      />
    </div>
  );
}
