"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Truck,
  Search,
  RefreshCw,
  FileText,
  Printer,
  Calculator,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { toast } from "sonner";
import { 
  getShalomLabelPdfUrl, 
  getShalomTicketPdfUrl,
  quoteShalom,
  trackShalomGuide,
  updateGuideQuote
} from "@/services/shalomService";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck as TruckIcon, MapPin, ArrowRight, Clock, CheckCircle2, User, X } from "lucide-react";

interface TrackingGuide {
  id: string;
  guideNumber: string;
  courierName: string;
  status: string;
  created_at: string;
  quotedAmount?: number;
  quotedCurrency?: string;
  shalomTrackingData?: any;
}

export default function GuidesSummaryView() {
  const { auth, selectedStoreId } = useAuth();
  const [guides, setGuides] = useState<TrackingGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Tracking State
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  // Details State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [guideForDetails, setGuideForDetails] = useState<string | null>(null);

  const fetchGuides = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axiosAuth.get(
        `${GATEWAY.courier}/shipping-guides/store/${selectedStoreId}`,
      );
      const sorted = res.data.sort((a: TrackingGuide, b: TrackingGuide) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setGuides(sorted);
    } catch {
      toast.error("No se pudieron cargar las guías");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchGuides();
  }, [fetchGuides]);

  const filteredGuides = useMemo(() => {
    return guides.filter(g => 
      g.guideNumber?.toLowerCase().includes(search.toLowerCase()) ||
      g.courierName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [guides, search]);

  const handleTrackShalom = async (guide: TrackingGuide) => {
    setTrackingModalOpen(true);
    setTrackLoading(true);
    setTrackResult(null);
    try {
      const result = await trackShalomGuide(guide.id);
      setTrackResult(result);
    } catch (error) {
      setTrackResult({ error: "Error al rastrear guía" });
    } finally {
      setTrackLoading(false);
    }
  };

  const handleRowClick = (guideId: string) => {
    setGuideForDetails(guideId);
    setDetailsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por guía o courier..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={fetchGuides} variant="outline" size="icon" className="h-10 w-10">
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-xs uppercase font-bold">Guía</TableHead>
              <TableHead className="text-xs uppercase font-bold text-center">Fecha</TableHead>
              <TableHead className="text-xs uppercase font-bold text-center">Courier</TableHead>
              <TableHead className="text-xs uppercase font-bold text-center">Costo</TableHead>
              <TableHead className="text-xs uppercase font-bold text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5} className="h-12 animate-pulse bg-muted/10" /></TableRow>
              ))
            ) : filteredGuides.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No hay guías registradas</TableCell></TableRow>
            ) : (
              filteredGuides.map((guide) => (
                <TableRow key={guide.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleRowClick(guide.id)}>
                  <TableCell className="font-semibold text-primary text-xs">{guide.guideNumber}</TableCell>
                  <TableCell className="text-center text-[10px] whitespace-nowrap">
                    {new Date(guide.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={guide.courierName?.toUpperCase().includes("SHALOM") ? "default" : "secondary"} className="text-[10px] px-1.5 h-5">
                      {guide.courierName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs font-medium">
                    {guide.quotedAmount ? `${guide.quotedCurrency || "S/"} ${guide.quotedAmount}` : "-"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {guide.courierName?.toUpperCase().includes("SHALOM") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleTrackShalom(guide)}><Truck className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRowClick(guide.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <GuideDetailsModal 
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        guideId={guideForDetails || undefined}
        onGuideUpdated={fetchGuides}
      />

      <Dialog open={trackingModalOpen} onOpenChange={setTrackingModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TruckIcon className="text-primary" /> Rastreo Shalom</DialogTitle></DialogHeader>
          <div className="py-4">
            {trackLoading ? <div className="text-center py-10"><RefreshCw className="animate-spin h-8 w-8 mx-auto" /></div> : 
             trackResult?.error ? <div className="text-center text-red-500">{trackResult.error}</div> :
             <div className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Orden:</span> {trackResult?.search?.data?.numero_orden}</div>
                  <div><span className="text-muted-foreground">Estado:</span> {trackResult?.statuses?.message}</div>
                </div>
                {/* Simplified timeline */}
                <div className="space-y-2">
                  {trackResult?.statuses?.data && Object.entries(trackResult.statuses.data).map(([key, val]: any) => (
                    val.fecha && <div key={key} className="flex gap-2 text-[10px]"><span className="font-bold uppercase w-20">{key}</span> <span>{val.fecha}</span></div>
                  ))}
                </div>
             </div>
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
