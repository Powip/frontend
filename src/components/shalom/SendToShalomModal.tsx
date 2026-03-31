"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Truck, 
  Search, 
  MapPin, 
  AlertCircle, 
  Package, 
  ChevronRight,
  Info,
  CheckCircle2,
  Package2,
  ExternalLink,
  Plus,
  User,
  Copy
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API } from "@/lib/api";

const PACKAGE_TYPES = [
  { label: "SOBRE (5x30x20 cm)", value: "SOBRE", h: 5, w: 30, l: 20 },
  { label: "PAQUETE XXS (10x15x10 cm)", value: "PAQUETE XXS", h: 10, w: 15, l: 10 },
  { label: "PAQUETE XS (15x20x12 cm)", value: "PAQUETE XS", h: 15, w: 20, l: 12 },
  { label: "PAQUETE S (20x30x12 cm)", value: "PAQUETE S", h: 20, w: 30, l: 12 },
  { label: "PAQUETE M (24x30x20 cm)", value: "PAQUETE M", h: 24, w: 30, l: 20 },
  { label: "PAQUETE L (30x42x23 cm)", value: "PAQUETE L", h: 30, w: 42, l: 23 },
  { label: "CAJA (30x30x30 cm)", value: "CAJA", h: 30, w: 30, l: 30 },
  { label: "BULTO (40x40x40 cm)", value: "BULTO", h: 40, w: 40, l: 40 },
  { label: "Mercadería General (Manual)", value: "MERCADERIA" }
];

interface Agency {
  id_agencia: string;
  nombre_agencia: string;
  direccion: string;
  api_name: string;
}

interface District {
  id_distrito: string;
  nombre_distrito: string;
}

interface AgencySelectorProps {
  label: string;
  agencyLabel?: string;
  searchPlaceholder: string;
  agencies: Agency[];
  searchValue: string;
  selectedAgency: string;
  onSearchChange: (val: string) => void;
  onAgencyChange: (id: string) => void;
  isLoadingAgencies?: boolean;
  error?: boolean;
}

const AgencySelector = ({
  label,
  agencyLabel = "Agencia (Destino)",
  searchPlaceholder,
  agencies,
  searchValue,
  selectedAgency,
  onSearchChange,
  onAgencyChange,
  isLoadingAgencies,
  error
}: AgencySelectorProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</Label>
      {error && !selectedAgency && (
        <span className="text-[10px] font-bold text-red-500">FALTANTE</span>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Buscar distrito / provincia</Label>
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 dark:text-slate-100",
            error && !searchValue && "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20"
          )}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{agencyLabel}</Label>
        <Select
          value={selectedAgency}
          onValueChange={onAgencyChange}
          disabled={isLoadingAgencies}
        >
          <SelectTrigger className={cn(
            "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100",
            error && !selectedAgency && "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20"
          )}>
            <SelectValue placeholder={
              isLoadingAgencies ? "Buscando..." : 
              !searchValue ? "Escribe para buscar..." : "Seleccionar agencia"
            } />
          </SelectTrigger>
          <SelectContent className="max-h-[250px] dark:bg-slate-800 dark:border-slate-700">
            {agencies.length === 0 && searchValue ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No se encontraron agencias
              </div>
            ) : (
              agencies.map((a) => (
                <SelectItem key={a.id_agencia} value={a.api_name} className="py-1 focus:bg-slate-50 dark:focus:bg-slate-700">
                  <div className="flex flex-col gap-0 max-w-[280px]">
                    <span className="font-normal text-[12px] text-slate-700 dark:text-slate-200 line-clamp-1">{a.nombre_agencia}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal line-clamp-1 italic">{a.direccion}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
);

interface SendToShalomModalProps {
  open: boolean;
  onClose: () => void;
  orders: any[];
  onSuccess?: () => void;
  guideId?: string;
  companyId?: string;
}

export default function SendToShalomModal({
  open,
  onClose,
  orders,
  onSuccess,
  guideId,
  companyId: providedCompanyId,
}: SendToShalomModalProps) {
  const { auth } = useAuth();
  const companyId = providedCompanyId || auth?.company?.id;
  const [originAgencies, setOriginAgencies] = useState<Agency[]>([]);
  const [originSearch, setOriginSearch] = useState<string>("");
  const [originAgency, setOriginAgency] = useState<string>("");
  const [loadingOrigins, setLoadingOrigins] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);
  const [totalQuoted, setTotalQuoted] = useState<number | null>(null);
  const [inspectingOrderId, setInspectingOrderId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [shipmentsData, setShipmentsData] = useState<Record<string, any>>({});

  const fetchAgencies = useCallback(async (q: string, type: "origin" | string) => {
    if (!q || q.length < 3) return;
    try {
      if (type === "origin") setLoadingOrigins(true);
      else {
        setShipmentsData(prev => ({
          ...prev,
          [type]: { ...prev[type], loadingAgencies: true }
        }));
      }

      const res = await axios.get(`${API.integrations}/shalom/agencies/search/${encodeURIComponent(q)}`);
      
      if (res.data.success) {
        // Map from results if they differ in structure
        const agencies = (res.data.data || []).map((a: any) => ({
          id_agencia: a.ter_id || a.id || a.id_agencia,
          nombre_agencia: a.nombre || a.name || a.nombre_agencia,
          api_name: a.lugar_over || a.nombre || a.name,
          direccion: a.lugar || a.direccion || "",
        }));

        if (type === "origin") {
          setOriginAgencies(agencies);
        } else {
          setShipmentsData(prev => ({
            ...prev,
            [type]: { 
              ...prev[type], 
              destinationAgencies: agencies,
              loadingAgencies: false 
            }
          }));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (type === "origin") setLoadingOrigins(false);
      else {
        setShipmentsData(prev => ({
          ...prev,
          [type]: { ...prev[type], loadingAgencies: false }
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (open && orders.length > 0) {
      // Pre-fill origin from company if available
      const storeDistrict = (auth?.user as any)?.company_district || (auth?.user as any)?.city || "";
      setOriginSearch(storeDistrict);
      if (storeDistrict) fetchAgencies(storeDistrict, "origin");

      const initialData: Record<string, any> = {};
      orders.forEach((order) => {
        const destSearch = order.customer?.district || order.customer?.city || order.city || "";
        initialData[order.id] = {
          recipientDoc: order.customer?.identityDocument || "",
          recipientPhone: order.recipientPhone || order.customer?.phoneNumber || "",
          content: "ROPA",
          destinationSearch: destSearch,
          destinationAgencyId: "",
          destinationAgencies: [],
          loadingAgencies: false,
          securityCode: "",
          packageDetails: {
            quantity: 1,
            weight: 1,
            height: 10,
            width: 10,
            length: 10,
          }
        };
        // Fetch agencies for each destination
        if (destSearch) fetchAgencies(destSearch, order.id);
      });
      setShipmentsData(initialData);
    }
  }, [open, orders, auth, fetchAgencies]);

  const updateShipmentField = (orderId: string, field: string, value: any) => {
    setShipmentsData(prev => {
      const current = prev[orderId] || {};
      const newShipment = { ...current, [field]: value };

      // If choosing a package type, sync dimensions
      if (field === "content") {
        const pkg = PACKAGE_TYPES.find(p => p.value === value);
        if (pkg && pkg.h) {
          newShipment.packageDetails = {
            ...(current.packageDetails || {}),
            height: pkg.h,
            width: pkg.w,
            length: pkg.l
          };
        }
      }

      return {
        ...prev,
        [orderId]: newShipment
      };
    });

    if (field === "destinationSearch" && value.length >= 3) {
      fetchAgencies(value, orderId);
    }
  };

  const updatePackageDetail = (orderId: string, field: string, value: any) => {
    setShipmentsData(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        packageDetails: {
          ...prev[orderId].packageDetails,
          [field]: value
        }
      }
    }));
  };

  const handleQuote = async () => {
    try {
      setQuoting(true);
      const payload = {
        companyId: auth?.company?.id,
        shipments: orders.map(order => {
          const data = shipmentsData[order.id];
          return {
            origin: originAgency,
            destination: data.destinationAgencyId,
            content: data.content,
            weight: String(data.packageDetails.weight),
            height: (Number(data.packageDetails.height) / 100).toFixed(2),
            width: (Number(data.packageDetails.width) / 100).toFixed(2),
            length: (Number(data.packageDetails.length) / 100).toFixed(2),
            quantity: String(data.packageDetails.quantity)
          };
        })
      };

      const res = await axios.post(`${API.integrations}/shalom/quote`, payload);
      if (res.data.success) {
        setTotalQuoted(res.data.data.total_amount);
        toast.success(`Total: S/ ${res.data.data.total_amount}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Algo salió mal");
    } finally {
      setQuoting(false);
    }
  };

  const handleSend = async () => {
    try {
      setSending(true);
      
      const firstOrderId = orders[0]?.id;
      const globalSecurityCode = firstOrderId ? shipmentsData[firstOrderId]?.securityCode : "";

      const originAgencyObj = originAgencies.find(a => a.api_name === originAgency);
      
      const orderDestinations: Record<string, string> = {};
      const orderDestinationNames: Record<string, string> = {};
      const packageDetails: Record<string, any> = {};

      orders.forEach(order => {
        const data = shipmentsData[order.id];
        orderDestinations[order.id] = data.destinationAgencyId;
        
        const destAgencyObj = data.destinationAgencies?.find((a: any) => a.api_name === data.destinationAgencyId);
        orderDestinationNames[order.id] = destAgencyObj?.api_name || data.destinationAgencyId;

        packageDetails[order.id] = {
          weight: data.packageDetails.weight,
          height: data.packageDetails.height,
          width: data.packageDetails.width,
          length: data.packageDetails.length,
          content: data.content,
          recipientDoc: data.recipientDoc,
          recipientPhone: data.recipientPhone,
          quantity: data.packageDetails.quantity
        };
      });

      const payload = {
        companyId: auth?.company?.id,
        id: guideId,
        originAgencyId: originAgency,
        originAgencyName: originAgencyObj?.api_name || originAgency,
        orderDestinations,
        orderDestinationNames,
        packageDetails,
        securityCode: globalSecurityCode || "",
        quotedAmount: totalQuoted || undefined,
        quotedCurrency: "PEN"
      };

      const res = await axios.post(`${API.courier}/shipping-guides/${guideId}/send-to-shalom`, payload);
      
      if (res.data.success) {
        toast.success("Las guías han sido generadas en Shalom Pro");
        setIsSuccess(true);
        onSuccess?.();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "No se pudieron registrar las guías");
    } finally {
      setSending(false);
    }
  };

  const allDestinationsSet = useMemo(() => {
    if (!originAgency) return false;
    return orders.every(order => {
      const data = shipmentsData[order.id];
      return data?.destinationAgencyId && 
             data?.recipientDoc?.length >= 8 && 
             data?.recipientPhone?.length === 9;
    });
  }, [originAgency, orders, shipmentsData]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const inspectingOrder = orders.find(o => o.id === inspectingOrderId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Wrapper interno que maneja el layout — DialogContent mantiene su comportamiento nativo de Radix UI */}
        <div className="relative flex flex-col" style={{ maxHeight: 'calc(90vh - 2rem)' }}>

          {/* Header fijo */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Enviar a Shalom Pro</h2>
            </div>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
          {orders.length === 0 ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500">
              No hay pedidos seleccionados
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
              </div>
              <div className="text-center space-y-3 max-w-md">
                <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">¡Registro Exitoso!</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-base leading-relaxed">
                  Estas órdenes han sido creadas en Shalom Pro correctamente. 
                  Ahora puedes realizar el seguimiento detallado en la vista de <span className="text-blue-600 font-bold italic underline underline-offset-4 decoration-blue-200">Seguimiento Courier</span>.
                </p>
              </div>
              <Button 
                onClick={onClose} 
                className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-14 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                Entendido, cerrar
              </Button>
            </div>
          ) : (
            <>
              {/* Origen Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-8 space-y-6">
                <AgencySelector
                  label="Agencia de origen (tu tienda)"
                  agencyLabel="Agencia (Origen)"
                  searchPlaceholder="Lima, Arequipa, etc."
                  agencies={originAgencies}
                  searchValue={originSearch}
                  selectedAgency={originAgency}
                  onSearchChange={(val) => {
                    setOriginSearch(val);
                    if (val.length >= 3) fetchAgencies(val, "origin");
                  }}
                  onAgencyChange={setOriginAgency}
                  isLoadingAgencies={loadingOrigins}
                  error={!originAgency}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Destino y Detalles por Orden</h3>

                {orders.map((order) => {
                  const data = shipmentsData[order.id] || {};
                  const details = data.packageDetails || {};

                  return (
                    <Card key={order.id} className="overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          {/* Info Cliente */}
                          <div className="lg:col-span-4 space-y-6 border-r dark:border-slate-700 pr-8">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">#{order.orderNumber}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{order.customer?.fullName}</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">{order.customer?.address || order.address}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-2 px-2"
                                onClick={() => setInspectingOrderId(order.id)}
                              >
                                <Info className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-tight">Ver datos</span>
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">DNI / RUC (DESTINATARIO)</Label>
                                <Input
                                  value={data.recipientDoc}
                                  onChange={(e) => updateShipmentField(order.id, "recipientDoc", e.target.value)}
                                  className={cn("h-8 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100", !data.recipientDoc && "border-red-500 bg-white dark:bg-red-950/20")}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">TELÉFONO (DESTINATARIO)</Label>
                                <Input
                                  value={data.recipientPhone}
                                  onChange={(e) => updateShipmentField(order.id, "recipientPhone", e.target.value)}
                                  className={cn("h-8 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100", data.recipientPhone?.length !== 9 && "border-red-500 bg-white dark:bg-red-950/20")}
                                />
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium ml-1 italic">(9 dígitos)</span>
                              </div>
                            </div>

                            <div className="space-y-1 pt-1">
                              <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">CÓDIGO DE SEGURIDAD (OPCIONAL)</Label>
                              <Input
                                value={data.securityCode}
                                onChange={(e) => updateShipmentField(order.id, "securityCode", e.target.value)}
                                placeholder="Ejem: 1234"
                                className="h-8 text-xs bg-slate-50/50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
                              />
                            </div>
                          </div>

                          {/* Selección Agencia */}
                          <div className="lg:col-span-5 space-y-6">
                            <AgencySelector
                              label={`Agencia de Destino (${order.customer?.city || "Provincia"})`}
                              searchPlaceholder="Buscar distrito / provincia"
                              agencies={data.destinationAgencies || []}
                              searchValue={data.destinationSearch}
                              selectedAgency={data.destinationAgencyId}
                              onSearchChange={(val) => updateShipmentField(order.id, "destinationSearch", val)}
                              onAgencyChange={(id) => updateShipmentField(order.id, "destinationAgencyId", id)}
                              isLoadingAgencies={data.loadingAgencies}
                              error={!data.destinationAgencyId}
                            />

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">DETALLES DEL PAQUETE</Label>
                              <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">MERCADERÍA (TIPO DE CARGA)</Label>
                                  <Select
                                    value={data.content}
                                    onValueChange={(val) => updateShipmentField(order.id, "content", val)}
                                  >
                                    <SelectTrigger className="h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                                      {PACKAGE_TYPES.map(pkg => (
                                        <SelectItem key={pkg.label} value={pkg.value} className="dark:focus:bg-slate-700">{pkg.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">BULTOS (CANT)</Label>
                                  <Input
                                    type="number"
                                    value={details.quantity}
                                    onChange={(e) => updatePackageDetail(order.id, "quantity", Number(e.target.value))}
                                    className="h-9 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Medidas */}
                          <div className="lg:col-span-3 bg-slate-50/50 dark:bg-slate-700/40 p-4 rounded-lg space-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">PESO (KG)</Label>
                              <Input
                                type="number"
                                value={details.weight}
                                onChange={(e) => updatePackageDetail(order.id, "weight", Number(e.target.value))}
                                className="h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1 text-center">
                                <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">ALTO (CM)</Label>
                                <Input
                                  type="number"
                                  value={details.height}
                                  onChange={(e) => updatePackageDetail(order.id, "height", Number(e.target.value))}
                                  className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                />
                              </div>
                              <div className="space-y-1 text-center">
                                <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">ANCHO (CM)</Label>
                                <Input
                                  type="number"
                                  value={details.width}
                                  onChange={(e) => updatePackageDetail(order.id, "width", Number(e.target.value))}
                                  className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                />
                              </div>
                              <div className="space-y-1 text-center">
                                <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">LARGO (CM)</Label>
                                <Input
                                  type="number"
                                  value={details.length}
                                  onChange={(e) => updatePackageDetail(order.id, "length", Number(e.target.value))}
                                  className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex flex-col gap-4 mt-8 pt-6 border-t dark:border-slate-700">
                {totalQuoted !== null && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-bold">Total Cotizado: S/ {Number(totalQuoted).toFixed(2)}</span>
                    <span className="text-xs font-medium uppercase tracking-widest">{orders.length} pedidos</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={handleQuote}
                    disabled={!allDestinationsSet || quoting || sending}
                    className="h-12 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    {quoting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cotizando...</> : "Cotizar Envío"}
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={!allDestinationsSet || sending || quoting}
                    className="h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                  >
                    {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Confirmar y enviar a Shalom"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        </div> {/* fin scroll wrapper */}
      
        {/* Panel lateral para detalles de cliente.
            CLAVE: absolute inset-0 es relativo al wrapper div (relative).
            Cubre el 100% del modal sin importar cuánto se haya scrolleado. */}
        {inspectingOrderId && inspectingOrder && (
          <div className="absolute inset-0 z-[60] flex justify-end animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" 
              onClick={() => setInspectingOrderId(null)}
            />
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100">Detalles del Cliente</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pedido #{inspectingOrder.orderNumber}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-300" 
                  onClick={() => setInspectingOrderId(null)}
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 mb-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-tight">Información Personal</span>
                  </div>
                  
                  <div className="space-y-1 group">
                    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre Completo</Label>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{inspectingOrder.customer?.fullName || "—"}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400" onClick={() => copyToClipboard(inspectingOrder.customer?.fullName || "", "Nombre")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 group">
                    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Teléfono</Label>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{inspectingOrder.recipientPhone || inspectingOrder.customer?.phoneNumber || "—"}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400" onClick={() => copyToClipboard(inspectingOrder.recipientPhone || inspectingOrder.customer?.phoneNumber || "", "Teléfono")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 group">
                    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Documento (DNI/RUC)</Label>
                    <div className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border transition-colors",
                      !inspectingOrder.customer?.identityDocument ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600"
                    )}>
                      <span className={cn(
                        "text-sm font-semibold",
                        !inspectingOrder.customer?.identityDocument ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
                      )}>{inspectingOrder.customer?.identityDocument || "FALTANTE"}</span>
                      {inspectingOrder.customer?.identityDocument && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400" onClick={() => copyToClipboard(inspectingOrder.customer?.identityDocument || "", "Documento")}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-500 mb-2">
                    <Truck className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-tight">Dirección de Entrega</span>
                  </div>

                  <div className="space-y-1 group">
                    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dirección</Label>
                    <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight pr-2">{inspectingOrder.customer?.address || "—"}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 flex-shrink-0" onClick={() => copyToClipboard(inspectingOrder.customer?.address || "", "Dirección")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 group">
                      <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Distrito</Label>
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{inspectingOrder.district || inspectingOrder.customer?.district || "—"}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 dark:text-slate-500" onClick={() => copyToClipboard(inspectingOrder.district || inspectingOrder.customer?.district || "", "Distrito")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 group">
                      <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ciudad/Prov</Label>
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{inspectingOrder.city || inspectingOrder.province || "—"}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 dark:text-slate-500" onClick={() => copyToClipboard(inspectingOrder.city || inspectingOrder.province || "", "Ubicación")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {inspectingOrder.customer?.reference && (
                    <div className="space-y-1 group">
                      <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Referencia</Label>
                      <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {inspectingOrder.customer.reference}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700">
                <Button 
                  className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold" 
                  onClick={() => setInspectingOrderId(null)}
                >
                  Cerrar Detalle
                </Button>
              </div>
            </div>
          </div>
        )}
        </div> {/* fin relative wrapper */}
      </DialogContent>
    </Dialog>
  );
}
