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

interface Order {
  id: string;
  orderNumber: string | number;
  // Shape plana (desde GuideDetailsModal)
  recipientName?: string;
  recipientPhone?: string;
  district?: string;
  content?: string;
  // Shape anidada (legacy)
  customer?: {
    fullName?: string;
    city?: string;
    district?: string;
  };
}

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

  const [agencies, setAgencies] = useState<ShalomAgency[]>([]);
  const [agencySearch, setAgencySearch] = useState("");
  const [loadingAgencies, setLoadingAgencies] = useState(false);

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

  const loadAgencies = useCallback(
    async (q?: string) => {
      if (!auth?.accessToken) return;
      setLoadingAgencies(true);
      try {
        const list = await listShalomAgencies(auth.accessToken, q);
        setAgencies(list);
      } catch {
        setAgencies([]);
      } finally {
        setLoadingAgencies(false);
      }
    },
    [auth?.accessToken, companyId]
  );

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadAgencies(agencySearch || undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [agencySearch]);

  const setDestination = (orderId: string, agencyId: string) => {
    setOrderDestinations((prev) => ({ ...prev, [orderId]: agencyId }));
  };

  const allDestinationsSet =
    originAgencyId &&
    orders.every((o) => orderDestinations[o.id]);

  const handleSend = async () => {
    if (!auth?.accessToken || !allDestinationsSet) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendGuideToShalom(auth.accessToken, guideId, {
        companyId,
        orderDestinations,
        originAgencyId,
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {trackingData ? "Tracking Shalom" : "Enviar a Shalom Pro"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
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
                  {orders.map((order) => {
                    const t = trackingData[order.id];
                    return (
                      <tr key={order.id} className="border-t">
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Agencia origen */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Agencia de origen (tu tienda)
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Buscar agencia..."
                    value={agencySearch}
                    onChange={(e) => setAgencySearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={originAgencyId}
                  onChange={(e) => setOriginAgencyId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingAgencies}
                >
                  <option value="">
                    {loadingAgencies ? "Cargando agencias..." : "Seleccionar agencia de origen"}
                  </option>
                  {agencies.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name}
                      {ag.province ? ` — ${ag.province}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destino por orden */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Agencia de destino por orden
                </label>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          #{order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {order.customer?.fullName ?? order.recipientName ?? "—"}
                          {(order.customer?.district ?? order.district)
                            ? ` · ${order.customer?.district ?? order.district}`
                            : ""}
                          {order.customer?.city
                            ? `, ${order.customer.city}`
                            : ""}
                        </p>
                      </div>
                      <select
                        value={orderDestinations[order.id] ?? ""}
                        onChange={(e) =>
                          setDestination(order.id, e.target.value)
                        }
                        disabled={loadingAgencies}
                        className="border rounded-lg px-2 py-1.5 text-sm sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar destino</option>
                        {agencies.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name}
                            {ag.province ? ` — ${ag.province}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
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
      </div>
    </div>
  );
}
