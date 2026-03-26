"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listShalomAgencies,
  sendGuideToShalom,
  trackShalomShipment,
  getShalomTicketPdfUrl,
  getShalomLabelPdfUrl,
  ShalomAgency,
} from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onChange: (val: string) => void;
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
    (a: any) => (a.lugar_over || a.lugar || String(a.id)) === value
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
            const val = e.target.value;
            const found = agencies.find(
              (a: any) => (a.lugar_over || a.lugar || String(a.id)) === val
            );
            if (found) {
              console.log("📍 [Shalom] AGENCIA SELECCIONADA:", found.name);
              console.log(JSON.stringify(found, null, 2));
            }
            onChange(val);
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
            <option key={ag.id} value={ag.lugar_over || ag.lugar || ag.id} className="bg-background text-foreground">
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
  { id: "XXS", name: "XXS", width: 10, length: 15, height: 10 },
  { id: "XS", name: "XS", width: 15, length: 20, height: 12 },
  { id: "S", name: "S", width: 20, length: 30, height: 12 },
  { id: "M", name: "M", width: 24, length: 30, height: 20 },
  { id: "L", name: "L", width: 30, length: 42, height: 23 },
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

  // orderDestinations: {orderId → agencyId destino}
  const [orderDestinations, setOrderDestinations] = useState<Record<string, string>>({});

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
      }
    >
  >({});

  useEffect(() => {
    if (orders.length > 0 && Object.keys(packageDetails).length === 0) {
      const initial: Record<string, any> = {};
      orders.forEach((o) => {
        initial[o.id] = {
          weight: "",
          height: "",
          width: "",
          length: "",
          content: "",
          recipientDoc: o.customer?.identityDocument || "",
          recipientPhone: o.customer?.phoneNumber || o.recipientPhone || "",
        };
      });
      setPackageDetails(initial);
    }
  }, [orders, packageDetails]);

  const setDestination = (orderId: string, agencyId: string) => {
    setOrderDestinations((prev) => ({ ...prev, [orderId]: agencyId }));
  };

  const allDestinationsSet =
    originAgencyId &&
    orders.every((o) => orderDestinations[o.id]) &&
    orders.every((o) => {
      const pd = packageDetails[o.id];
      return (
        pd &&
        pd.recipientDoc.trim().length >= 8 &&
        pd.recipientPhone.trim().length >= 9 &&
        pd.content.trim().length > 0 &&
        pd.weight !== "" && pd.weight > 0 &&
        pd.height !== "" && pd.height > 0 &&
        pd.width !== "" && pd.width > 0 &&
        pd.length !== "" && pd.length > 0
      );
    });

  const handleSend = async () => {
    if (!auth?.accessToken || !allDestinationsSet) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendGuideToShalom(auth.accessToken, guideId, {
        companyId,
        orderDestinations,
        originAgencyId,
        packageDetails: Object.fromEntries(
          Object.entries(packageDetails).map(([k, v]) => [
            k,
            { ...v, weight: Number(v.weight), height: Number(v.height), width: Number(v.width), length: Number(v.length) }
          ])
        ),
      });
      setTrackingData(result.trackingData);
      onSuccess?.(result.trackingData);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Error al enviar a Shalom");
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
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                ✓ Envíos registrados en Shalom correctamente.
              </p>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Orden</th>
                    <th className="text-left p-3 font-medium">Nro. Shalom</th>
                    <th className="text-left p-3 font-medium">Código</th>
                    <th className="p-3" />
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
                        <td className="p-3">
                          {t && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => handleTrack(order.id)}
                                disabled={trackLoading && trackingOrderId === order.id}
                                className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                              >
                                Rastrear
                              </button>
                              <a
                                href={getShalomTicketPdfUrl(
                                  t.orderNumber,
                                  t.orderCode
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                              >
                                Ticket
                              </a>
                              <a
                                href={getShalomLabelPdfUrl(
                                  t.orderNumber,
                                  t.orderCode
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
                              >
                                Etiqueta
                              </a>
                            </div>
                          )}
                        </td>
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
                  onChange={(val) => setOriginAgencyId(val)}
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
                    };
                    const updateField = (field: string, value: string | number) => {
                      setPackageDetails((prev) => ({
                        ...prev,
                        [order.id]: {
                          ...prev[order.id],
                          [field]: value,
                        },
                      }));
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
                            onChange={(val) => setDestination(order.id, val)}
                            placeholder="Buscar provincia, ciudad..."
                            defaultSearch={order.district || order.city || order.province || order.customer?.district || order.customer?.city || ""}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 mt-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                          <label className="block text-[11px] font-bold text-foreground/80 lowercase tracking-wider uppercase">
                            Detalles del Paquete <span className="text-destructive invisible sm:visible">*</span>
                          </label>
                          
                          {/* Box Presets */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground mr-1">Caja Shalom:</span>
                            <div className="flex gap-1">
                              {SHALOM_BOXES.map((box) => (
                                <button
                                  key={box.id}
                                  type="button"
                                  onClick={() => {
                                    setPackageDetails((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        height: box.height,
                                        width: box.width,
                                        length: box.length,
                                      },
                                    }));
                                  }}
                                  className={`
                                    w-7 h-7 rounded-full border text-[9px] font-bold flex items-center justify-center transition-all
                                    ${(pd.height === box.height && pd.width === box.width && pd.length === box.length)
                                      ? "bg-red-600 border-red-600 text-white shadow-md scale-110"
                                      : "bg-background border-border text-foreground/70 hover:border-red-500 hover:text-red-500"
                                    }
                                  `}
                                  title={`${box.name}: ${box.width}x${box.length}x${box.height} cm`}
                                >
                                  {box.id}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">DNI / RUC</label>
                            <input
                              type="text"
                              className="w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:ring-1 focus:ring-primary/30 outline-none"
                              value={pd.recipientDoc}
                              onChange={(e) => updateField("recipientDoc", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Teléfono</label>
                            <input
                              type="text"
                              className="w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:ring-1 focus:ring-primary/30 outline-none"
                              value={pd.recipientPhone}
                              onChange={(e) => updateField("recipientPhone", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="col-span-1">
                            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-tight font-medium">Contenido</label>
                            <input
                              type="text"
                              className="w-full border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:ring-1 focus:ring-primary/30 outline-none"
                              value={pd.content}
                              onChange={(e) => updateField("content", e.target.value)}
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
                            <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold">Alto (cm)</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full border-b bg-transparent px-1 py-1 text-xs text-foreground focus:border-primary outline-none text-center"
                              value={pd.height}
                              onChange={(e) => updateField("height", e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold">Ancho (cm)</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full border-b bg-transparent px-1 py-1 text-xs text-foreground focus:border-primary outline-none text-center"
                              value={pd.width}
                              onChange={(e) => updateField("width", e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-muted-foreground mb-1 uppercase font-bold">Largo (cm)</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full border-b bg-transparent px-1 py-1 text-xs text-foreground focus:border-primary outline-none text-center"
                              value={pd.length}
                              onChange={(e) => updateField("length", e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={!allDestinationsSet || sending}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {sending
                  ? "Enviando a Shalom Pro..."
                  : "Confirmar y enviar a Shalom"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
