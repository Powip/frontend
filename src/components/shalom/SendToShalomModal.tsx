"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  sendGuideToShalom,
  trackShalomShipment,
  getShalomTicketPdfUrl,
  getShalomLabelPdfUrl,
  quoteShalom,
  updateGuideQuote,
  listShalomAgencies,
  ShalomAgency,
} from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string | number;
  // Shape plana (desde GuideDetailsModal)
  recipientName?: string;
  recipientPhone?: string;
  district?: string;
  province?: string;
  city?: string;
  content?: string;
  // Shape anidada (legacy)
  customer?: {
    fullName?: string;
    city?: string;
    district?: string;
    identityDocument?: string;
    phoneNumber?: string;
  };
}

function AgencySelector({
  token,
  value,
  onChange,
  defaultSearch = "",
  placeholder = "Buscar agencia...",
}: {
  token: string;
  value: string;
  onChange: (val: string, name?: string) => void;
  defaultSearch?: string;
  placeholder?: string;
}) {
  const [search, setSearch] = useState(defaultSearch);
  const [agencies, setAgencies] = useState<ShalomAgency[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // 2 chars minimo para buscar
      if (!search.trim()) {
        setAgencies([]);
        return;
      }
      setLoading(true);
      try {
        const list = await listShalomAgencies(token, search.trim());
        setAgencies(list);
        setHasSearched(true);
      } catch (e) {
        setAgencies([]);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [search, token]);

  const selectedAgencyDefinition = agencies.find(
    (a: any) => String(a.id) === String(value)
  );

  return (
    <div className="flex flex-col gap-2 w-full sm:w-64 flex-1">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Buscar distrito / provincia</label>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Agencia (Destino)</label>
        <select
          value={value}
          onChange={(e) => {
            const id = e.target.value;
            const ag = agencies.find((a: any) => String(a.id) === String(id));
            // Priorizamos lugar_over o lugar que es lo que Shalom Pro espera en /register
            const name = ag?.lugar_over || ag?.lugar || ag?.name || "";
            onChange(id, name);
          }}
          className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={loading || agencies.length === 0}
        >
          <option value="" className="bg-background text-foreground">
            {loading
              ? "Buscando agencias..."
              : agencies.length === 0
              ? hasSearched
                ? "Sin resultados"
                : "Escribe para buscar..."
              : "Seleccionar agencia"}
          </option>
          {agencies.map((ag: any) => (
            <option key={ag.id} value={ag.id} className="bg-background text-foreground">
              {ag.name} {ag.province ? ` — ${ag.province}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedAgencyDefinition && (
        <div className="mt-1 p-2 bg-muted/30 border border-border rounded-lg text-[10px] text-muted-foreground space-y-1.5 shadow-inner">
          {selectedAgencyDefinition.telefono && (
            <p className="flex gap-1.5 items-center">
              <span>📞</span>
              <span className="font-semibold text-foreground/80">Teléfono:</span> 
              <span>{selectedAgencyDefinition.telefono}</span>
            </p>
          )}
          {selectedAgencyDefinition.hora_atencion && (
            <div className="flex gap-1.5 items-start">
              <span>🕒</span>
              <span className="font-semibold text-foreground/80">Horario:</span>
              <div className="leading-tight">
                <div>{selectedAgencyDefinition.hora_atencion}</div>
                {selectedAgencyDefinition.hora_domingo && <div>{selectedAgencyDefinition.hora_domingo}</div>}
              </div>
            </div>
          )}
          {selectedAgencyDefinition.ter_categoria_recibe && selectedAgencyDefinition.ter_categoria_recibe.trim() !== "" && (
            <p className="flex gap-1.5 items-center">
              <span>📦</span>
              <span className="font-semibold text-foreground/80">Límite:</span> 
              <span>Recepción {selectedAgencyDefinition.ter_categoria_recibe.toLowerCase()}</span>
            </p>
          )}
          {selectedAgencyDefinition.detalles && selectedAgencyDefinition.detalles.trim() !== "" && (
            <div className="flex gap-1.5 items-start mt-2 pt-2 border-t border-border/50">
              <span>⚠️</span>
              <span className="leading-tight text-amber-500 font-medium text-[9px]">{selectedAgencyDefinition.detalles}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SHALOM_BOXES = [
  { id: "SOBRE", name: "SOBRE", width: 5, length: 30, height: 20 },
  { id: "XXS", name: "PAQUETE XXS", width: 10, length: 15, height: 10 },
  { id: "XS", name: "PAQUETE XS", width: 15, length: 20, height: 12 },
  { id: "S", name: "PAQUETE S", width: 20, length: 30, height: 12 },
  { id: "M", name: "PAQUETE M", width: 24, length: 30, height: 20 },
  { id: "L", name: "PAQUETE L", width: 30, length: 42, height: 23 },
  { id: "CAJA", name: "CAJA", width: 30, length: 30, height: 30 },
  { id: "BULTO", name: "BULTO", width: 40, length: 40, height: 40 },
];

interface ShalomTrackingEntry {
  orderNumber: string;
  orderCode: string;
}

interface Props {
  open?: boolean;
  guideId: string;
  guideNumber?: string;
  companyId: string;
  orders: Order[];
  existingTrackingData?: Record<string, ShalomTrackingEntry> | null;
  onClose: () => void;
  onSuccess?: (trackingData?: Record<string, ShalomTrackingEntry> | null) => void;
}

export default function SendToShalomModal({
  open = true,
  guideId,
  guideNumber,
  companyId,
  orders,
  existingTrackingData,
  onClose,
  onSuccess,
}: Props) {
  const { auth } = useAuth();

  // originAgencyId: una sola agencia de origen para toda la guía
  const [originAgencyId, setOriginAgencyId] = useState("");
  const [originAgencyName, setOriginAgencyName] = useState("");

  // orderDestinations: {orderId → agencyId destino}
  const [orderDestinations, setOrderDestinations] = useState<Record<string, string>>({});
  const [orderDestinationNames, setOrderDestinationNames] = useState<Record<string, string>>({});

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<
    Record<string, ShalomTrackingEntry> | null
  >(existingTrackingData ?? null);

  // Track view
  const [trackResult, setTrackResult] = useState<Record<string, unknown> | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  // Local state for Package Details
  const [packageDetails, setPackageDetails] = useState<
    Record<
      string,
      {
        weight: number | "";
        height: number | "";
        width: number | "";
        length: number | "";
        content: string;
        recipientDoc: string;
        recipientPhone: string;
        quantity: number;
      }
    >
  >({});
  const [formErrors, setFormErrors] = useState<Record<string, Record<string, string>>>({});

  // Quotation state
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [quoting, setQuoting] = useState(false);
  const [totalQuoted, setTotalQuoted] = useState<number | null>(null);

  const formatShalomError = (err: string) => {
    // Quitar etiquetas HTML y limpiar el mensaje
    const clean = err
      .replace(/<[^>]*>/g, " ")
      .replace(/Upload not successful: /g, "")
      .replace(/En la fila \d+ /g, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // Traducciones comunes para que se vea "bonito"
    if (clean.includes("las columnas teléfono del destinatario no es valido")) {
      return "El número de teléfono del destinatario no es válido.";
    }
    if (clean.includes("no recibe envíos")) {
      return clean; // Ya es bastante descriptivo: "La terminal X no recibe envíos"
    }
    return clean;
  };

  const validateField = (orderId: string, field: string, value: any, currentDetails: any) => {
    let error = "";
    
    if (field === "recipientDoc") {
      const val = String(value).trim();
      if (val.length !== 8 && val.length !== 11) {
        error = "Debe tener 8 (DNI) u 11 (RUC) dígitos.";
      } else if (!/^\d+$/.test(val)) {
        error = "Solo se permiten números.";
      }
    }

    if (field === "recipientPhone") {
      const val = String(value).replace(/[^0-9]/g, "");
      if (val.length !== 9) {
        error = "El teléfono debe tener 9 dígitos.";
      }
    }

    if (["height", "width", "length"].includes(field)) {
      const box = SHALOM_BOXES.find(b => b.name === currentDetails.content);
      if (box) {
        const val = Number(value);
        if (field === "height" && val > box.height) error = `Máx. ${box.height}cm para esta categoría.`;
        if (field === "width" && val > box.width) error = `Máx. ${box.width}cm para esta categoría.`;
        if (field === "length" && val > box.length) error = `Máx. ${box.length}cm para esta categoría.`;
      }
    }

    setFormErrors(prev => {
      const orderErrors = { ...prev[orderId], [field]: error };
      if (!error) delete orderErrors[field];
      
      const newErrors = { ...prev, [orderId]: orderErrors };
      if (Object.keys(orderErrors).length === 0) delete newErrors[orderId];
      return newErrors;
    });
  };

  const cleanDigits = (str: string) => (str || "").replace(/[^0-9]/g, "");

  useEffect(() => {
    if (orders.length > 0) {
      setPackageDetails((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        
        orders.forEach((o) => {
          if (!next[o.id]) {
            const rawPhone = o.customer?.phoneNumber || "";
            const rawDoc = o.customer?.identityDocument || "";
            const phone = (rawPhone || "").replace(/[^0-9]/g, "");
            const doc = (rawDoc || "").replace(/[^0-9]/g, "");

            next[o.id] = {
              recipientDoc: doc,
              recipientPhone: phone,
              content: "PAQUETE XS (15x15x15 cm)",
              weight: 1,
              height: 15,
              width: 15,
              length: 15,
              quantity: 1,
            };
            hasChanges = true;
          }
        });
        
        return hasChanges ? next : prev;
      });
    }
  }, [orders]);

  const setDestination = (orderId: string, agencyId: string, name?: string) => {
    setOrderDestinations((prev) => ({ ...prev, [orderId]: agencyId }));
    setOrderDestinationNames((prev) => ({ ...prev, [orderId]: name || "" }));
  };

  const allDestinationsSet =
    originAgencyId &&
    orders.every((o) => orderDestinations[o.id]) &&
    orders.every((o) => {
      const pd = packageDetails[o.id];
      const hasErrors = formErrors[o.id] && Object.keys(formErrors[o.id]).length > 0;
      return (
        pd &&
        !hasErrors &&
        (pd.recipientDoc || "").trim().length >= 8 &&
        (pd.recipientPhone || "").replace(/[^0-9]/g, "").length === 9 &&
        (pd.content || "").trim().length > 0 &&
        pd.weight !== "" && Number(pd.weight) > 0 &&
        pd.height !== "" && Number(pd.height) > 0 &&
        pd.width !== "" && Number(pd.width) > 0 &&
        pd.length !== "" && Number(pd.length) > 0 &&
        pd.quantity > 0
      );
    });

  const handleQuote = async () => {
    if (!auth?.accessToken || !allDestinationsSet) return;
    setQuoting(true);
    setTotalQuoted(null);
    const newQuotes: Record<string, number> = {};
    let total = 0;

    try {
      for (const order of orders) {
        const pd = packageDetails[order.id];
        const quote = await quoteShalom(auth.accessToken, {
          origin: originAgencyId,
          destination: orderDestinations[order.id],
          content: pd.content,
          height: Number(pd.height) / 100,
          width: Number(pd.width) / 100,
          length: Number(pd.length) / 100,
          weight: Number(pd.weight),
          quantity: pd.quantity,
        });
        newQuotes[order.id] = quote.precio;
        total += quote.precio;
      }
      setQuotes(newQuotes);
      setTotalQuoted(total);
      
      // Persistir en DB inmediatamente
      try {
        await updateGuideQuote(auth.accessToken, guideId, total, "PEN");
      } catch (persistErr) {
        console.error("Error persistiendo cotización:", persistErr);
      }

      toast.success(`Cotización exitosa: S/ ${total.toFixed(2)}`);
    } catch (e: any) {
      toast.error("Error al cotizar: " + (e?.response?.data?.message || e.message));
    } finally {
      setQuoting(false);
    }
  };

  const handleSend = async () => {
    if (!auth?.accessToken || !allDestinationsSet) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendGuideToShalom(auth.accessToken, guideId, {
        companyId,
        orderDestinations: orderDestinations, // IDs numéricos
        orderDestinationNames: orderDestinationNames, // Nombres literales
        originAgencyId: originAgencyId, // ID numérico
        originAgencyName: originAgencyName, // Nombre literal
        packageDetails: Object.fromEntries(
          Object.entries(packageDetails).map(([k, v]) => [
            k,
            { 
              ...v, 
              weight: Number(v.weight), 
              height: Number(v.height) / 100, 
              width: Number(v.width) / 100, 
              length: Number(v.length) / 100 
            }
          ])
        ),
        quotedAmount: totalQuoted ?? undefined,
        quotedCurrency: "PEN",
      });
      setTrackingData(result.trackingData);
      onSuccess?.(result.trackingData);
    } catch (e: any) {
      const rawMsg = e?.response?.data?.message || e?.message || "Error al enviar a Shalom";
      setError(formatShalomError(rawMsg));
    } finally {
      setSending(false);
    }
  };

  const handleTrack = async (orderId: string) => {
    if (!auth?.accessToken) return;
    const tracking = trackingData?.[orderId];
    if (!tracking) return;
    setTrackingOrderId(orderId);
    setTrackLoading(true);
    setTrackResult(null);
    try {
      const result = await trackShalomShipment(
        auth.accessToken,
        companyId,
        tracking.orderNumber,
        tracking.orderCode
      );
      setTrackResult(result as Record<string, unknown>);
    } catch {
      setTrackResult({ error: "No se pudo obtener el tracking" });
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl text-foreground">
        <DialogHeader>
          <DialogTitle>
            {trackingData ? "Tracking Shalom" : "Enviar a Shalom Pro"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Si ya hay tracking, mostrar estado */}
          {trackingData ? (
            <div>
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                ✓ Envíos registrados en Shalom correctamente.
              </p>
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 font-medium flex items-center gap-2">
                <span className="text-lg">ℹ</span> Podrás gestionar estos envíos (etiquetas, tickets y rastreo) desde la sección de <strong>Seguimiento de Courier</strong>.
              </p>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Orden</th>
                    <th className="text-left p-3 font-medium">Nro. Shalom</th>
                    <th className="text-left p-3 font-medium">Código</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => {
                    const t = trackingData[order.id];
                    return (
                      <tr key={`${order.id}-${idx}`} className="border-t">
                        <td className="p-3">#{order.orderNumber}</td>
                        <td className="p-3 font-mono">
                          {t?.orderNumber ?? "—"}
                        </td>
                        <td className="p-3 font-mono">{t?.orderCode ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Track result */}
              {trackResult && (
                <div className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(trackResult, null, 2)}</pre>
                </div>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Agencia origen */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Agencia de origen (tu tienda)
                </label>
                <AgencySelector
                  token={auth?.accessToken || ""}
                  value={originAgencyId}
                  onChange={(val, name) => {
                    setOriginAgencyId(val);
                    setOriginAgencyName(name || "");
                  }}
                  placeholder="Escribe ciudad, provincia o distrito..."
                />
              </div>

              {/* Destino y Detalles por orden */}
              <div className="pt-2">
                <label className="block text-sm font-medium mb-2">
                  Destino y Detalles por Orden
                </label>
                <div className="space-y-4">
                  {orders.map((order, idx) => {
                    const pd = packageDetails[order.id] || {
                      weight: "",
                      height: "",
                      width: "",
                      length: "",
                      content: "",
                      recipientDoc: "",
                      recipientPhone: "",
                      quantity: 1,
                    };
                    const updateField = (field: string, value: any) => {
                      let finalValue = value;
                      if (field === "recipientPhone") {
                        // Limpiar espacios y símbolos al instante
                        finalValue = String(value).replace(/[^0-9]/g, "");
                      }

                      setPackageDetails((prev) => {
                        const newDetails = {
                          ...prev[order.id],
                          [field]: finalValue,
                        };
                        // Validar después de actualizar detalles (para tener acceso al 'content' actual)
                        validateField(order.id, field, finalValue, newDetails);
                        return {
                          ...prev,
                          [order.id]: newDetails,
                        };
                      });
                    };

                    return (
                      <div
                        key={`${order.id}-${idx}`}
                        className="border rounded-lg p-3 flex flex-col gap-3 bg-muted/5 border-border"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">
                              #{order.orderNumber}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {order.customer?.fullName ?? order.recipientName ?? "—"}
                              <br />
                              <span className="text-[10px] opacity-70">
                                {(order.city ?? order.customer?.city)
                                  ? `${order.city ?? order.customer?.city}`
                                  : ""}
                                {(order.district ?? order.customer?.district)
                                  ? `, ${order.district ?? order.customer?.district}`
                                  : ""}
                                {(order.province)
                                  ? ` (${order.province})`
                                  : ""}
                              </span>
                            </p>
                          </div>
                          <div className="w-full sm:w-[250px]">
                            <AgencySelector
                              token={auth?.accessToken || ""}
                              value={orderDestinations[order.id] ?? ""}
                              onChange={(val, name) => setDestination(order.id, val, name)}
                              placeholder="Buscar provincia, ciudad..."
                              defaultSearch={order.district || order.city || order.province || order.customer?.district || order.customer?.city || ""}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50 mt-1">
                          <label className="block text-[11px] font-bold text-foreground/80 tracking-wider uppercase flex items-center gap-2 mb-3">
                            <Package className="size-3.5" />
                            Detalles del Paquete <span className="text-destructive invisible sm:visible">*</span>
                          </label>

                          <div className="grid grid-cols-1 mb-3">
                            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Mercadería (Tipo de Carga)</label>
                            <Select
                              value={pd.content}
                              onValueChange={(val) => {
                                const box = SHALOM_BOXES.find(b => b.name === val);
                                if (box) {
                                  setPackageDetails((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...prev[order.id],
                                      content: box.name,
                                      height: box.height,
                                      width: box.width,
                                      length: box.length,
                                    },
                                  }));
                                  // Limpiar errores de dimensiones al cambiar de caja
                                  setFormErrors(prev => {
                                    const next = { ...prev };
                                    if (next[order.id]) {
                                      const { height, width, length, ...rest } = next[order.id];
                                      if (Object.keys(rest).length > 0) next[order.id] = rest;
                                      else delete next[order.id];
                                    }
                                    return next;
                                  });
                                } else {
                                  updateField("content", val);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Seleccionar tipo de mercadería..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SHALOM_BOXES.map((box) => (
                                  <SelectItem key={box.id} value={box.name}>
                                    {box.name} ({box.width}x{box.length}x{box.height} cm)
                                  </SelectItem>
                                ))}
                                <SelectItem value="MERCADERIA">Mercadería General (Manual)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">DNI / RUC (Destinatario)</label>
                                <input
                                  type="text"
                                  className={`w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground transition-colors outline-none ${
                                    formErrors[order.id]?.recipientDoc ? "border-destructive ring-1 ring-destructive/20" : "focus:ring-1 focus:ring-primary/30 border-border"
                                  }`}
                                  value={pd.recipientDoc}
                                  onChange={(e) => updateField("recipientDoc", e.target.value)}
                                />
                                {formErrors[order.id]?.recipientDoc && (
                                  <p className="text-[9px] text-destructive mt-1 font-medium">{formErrors[order.id].recipientDoc}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Teléfono (Destinatario)</label>
                                <input
                                  type="text"
                                  maxLength={9}
                                  className={`w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground transition-colors outline-none ${
                                    formErrors[order.id]?.recipientPhone ? "border-destructive ring-1 ring-destructive/20" : "focus:ring-1 focus:ring-primary/30 border-border"
                                  }`}
                                  value={pd.recipientPhone}
                                  onChange={(e) => updateField("recipientPhone", e.target.value)}
                                  placeholder="9XXXXXXXX"
                                />
                                {formErrors[order.id]?.recipientPhone && (
                                  <p className="text-[9px] text-destructive mt-1 font-medium">{formErrors[order.id].recipientPhone}</p>
                                )}
                              </div>
                            </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="col-span-1">
                              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Bultos (Cant)</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:ring-1 focus:ring-primary/30 outline-none"
                                value={pd.quantity}
                                onChange={(e) => updateField("quantity", e.target.value === "" ? 1 : Number(e.target.value))}
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Peso (Kg)</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:ring-1 focus:ring-primary/30 outline-none"
                                value={pd.weight}
                                onChange={(e) => updateField("weight", e.target.value === "" ? "" : Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 bg-muted/20 p-2 rounded-lg border border-border/40">
                            <div>
                              <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold text-center">Alto (cm)</label>
                              <input
                                type="number"
                                min="1"
                                className={`w-full border-b bg-transparent px-1 py-1 text-xs text-foreground outline-none text-center transition-colors ${
                                  formErrors[order.id]?.height ? "border-destructive text-destructive" : "focus:border-primary border-border/40"
                                }`}
                                value={pd.height}
                                onChange={(e) => updateField("height", e.target.value === "" ? "" : Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold text-center">Ancho (cm)</label>
                              <input
                                type="number"
                                min="1"
                                className={`w-full border-b bg-transparent px-1 py-1 text-xs text-foreground outline-none text-center transition-colors ${
                                  formErrors[order.id]?.width ? "border-destructive text-destructive" : "focus:border-primary border-border/40"
                                }`}
                                value={pd.width}
                                onChange={(e) => updateField("width", e.target.value === "" ? "" : Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold text-center">Largo (cm)</label>
                              <input
                                type="number"
                                min="1"
                                className={`w-full border-b bg-transparent px-1 py-1 text-xs text-foreground outline-none text-center transition-colors ${
                                  formErrors[order.id]?.length ? "border-destructive text-destructive" : "focus:border-primary border-border/40"
                                }`}
                                value={pd.length}
                                onChange={(e) => updateField("length", e.target.value === "" ? "" : Number(e.target.value))}
                              />
                            </div>
                          </div>
                          {(formErrors[order.id]?.height || formErrors[order.id]?.width || formErrors[order.id]?.length) && (
                            <p className="text-[9px] text-destructive mt-2 text-center font-medium">
                              {formErrors[order.id]?.height || formErrors[order.id]?.width || formErrors[order.id]?.length}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cotización */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleQuote}
                    disabled={!allDestinationsSet || quoting || sending}
                    className="flex-1 bg-muted border border-border text-foreground hover:bg-muted/80 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition"
                  >
                    {quoting ? "Cotizando..." : "Cotizar Envío"}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!allDestinationsSet || sending || quoting}
                    className="flex-[2] bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    {sending
                      ? "Enviando a Shalom Pro..."
                      : "Confirmar y enviar a Shalom"}
                  </button>
                </div>

                {totalQuoted !== null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-600 p-1.5 rounded-full text-white">
                        <Package className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-blue-900">Total Estimado de Envío:</span>
                    </div>
                    <span className="text-xl font-bold text-blue-700">S/ {Number(totalQuoted).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
