"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Package, CheckCircle2, Truck, MapPin, Clock, AlertCircle, ShoppingBag } from "lucide-react";

/* -----------------------------------------
   Types
----------------------------------------- */

interface TrackingItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    attributes?: Record<string, any>;
}

interface TrackingTimeline {
    step: string;
    label: string;
    completed: boolean;
    current: boolean;
}

interface TrackingData {
    orderNumber: string;
    status: string;
    deliveryType: string;
    createdAt: string;
    customer: {
        fullName: string;
        district?: string;
        city?: string;
        province?: string;
    };
    items: TrackingItem[];
    totals: {
        grandTotal: number;
        totalPaid: number;
        pendingAmount: number;
    };
    timeline: TrackingTimeline[];
}

/* -----------------------------------------
   Status Color/Icon Helpers
----------------------------------------- */

const getStatusColor = (status: string) => {
    switch (status) {
        case "PENDIENTE":
            return "text-amber-500";
        case "PREPARADO":
            return "text-blue-500";
        case "EN_ENVIO":
            return "text-purple-500";
        case "ENTREGADO":
            return "text-green-500";
        case "ANULADO":
            return "text-red-500";
        default:
            return "text-gray-500";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case "PENDIENTE":
            return "Pedido Recibido";
        case "PREPARADO":
            return "En Preparación";
        case "LLAMADO":
            return "Contactándote";
        case "EN_ENVIO":
            return "En Camino";
        case "ENTREGADO":
            return "Entregado";
        case "ANULADO":
            return "Anulado";
        default:
            return status;
    }
};

/* -----------------------------------------
   Page Component
----------------------------------------- */

export default function RastreoPage() {
    const params = useParams();
    const orderNumber = params.orderNumber as string;

    const [data, setData] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTracking = async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_VENTAS}/tracking/${orderNumber}`
                );

                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Pedido no encontrado");
                    } else {
                        setError("Error al cargar el pedido");
                    }
                    return;
                }

                const json = await res.json();
                setData(json);
            } catch (err) {
                setError("Error de conexión");
            } finally {
                setLoading(false);
            }
        };

        if (orderNumber) {
            fetchTracking();
        }
    }, [orderNumber]);

    /* Loading State */
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-white/70">Cargando tu pedido...</p>
                </div>
            </div>
        );
    }

    /* Error State */
    if (error || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <div className="text-center bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full border border-white/20">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Pedido no encontrado</h1>
                    <p className="text-white/60">
                        No pudimos encontrar el pedido <span className="font-mono text-purple-300">{orderNumber}</span>
                    </p>
                    <p className="text-white/40 text-sm mt-4">
                        Verifica que el número de pedido sea correcto
                    </p>
                </div>
            </div>
        );
    }

    const isDelivered = data.status === "ENTREGADO";
    const isCancelled = data.status === "ANULADO";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="h-6 w-6 text-purple-400" />
                        <span className="font-semibold text-white">Seguimiento de Pedido</span>
                    </div>
                    <span className="text-sm font-mono text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full">
                        {data.orderNumber}
                    </span>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Status Card */}
                <div className={`rounded-3xl p-6 ${isCancelled
                        ? "bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30"
                        : isDelivered
                            ? "bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30"
                            : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30"
                    }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isCancelled
                                ? "bg-red-500/30"
                                : isDelivered
                                    ? "bg-green-500/30"
                                    : "bg-purple-500/30"
                            }`}>
                            {isCancelled ? (
                                <AlertCircle className="h-8 w-8 text-red-400" />
                            ) : isDelivered ? (
                                <CheckCircle2 className="h-8 w-8 text-green-400" />
                            ) : (
                                <Truck className="h-8 w-8 text-purple-400 animate-pulse" />
                            )}
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Estado actual</p>
                            <h2 className={`text-2xl font-bold ${getStatusColor(data.status)}`}>
                                {getStatusLabel(data.status)}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                {!isCancelled && (
                    <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                        <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-400" />
                            Progreso del pedido
                        </h3>
                        <div className="relative">
                            {/* Progress Line */}
                            <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-white/10"></div>
                            <div
                                className="absolute left-[18px] top-2 w-0.5 bg-gradient-to-b from-purple-500 to-pink-500 transition-all duration-500"
                                style={{
                                    height: `${(data.timeline.filter((t) => t.completed || t.current).length /
                                            data.timeline.length) *
                                        100
                                        }%`,
                                }}
                            ></div>

                            {/* Timeline Items */}
                            <div className="space-y-6">
                                {data.timeline.map((item, index) => (
                                    <div key={item.step} className="flex items-center gap-4 relative">
                                        <div
                                            className={`w-9 h-9 rounded-full flex items-center justify-center z-10 transition-all ${item.completed
                                                    ? "bg-gradient-to-r from-purple-500 to-pink-500"
                                                    : item.current
                                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 ring-4 ring-purple-500/30 animate-pulse"
                                                        : "bg-white/10 border border-white/20"
                                                }`}
                                        >
                                            {item.completed ? (
                                                <CheckCircle2 className="h-5 w-5 text-white" />
                                            ) : (
                                                <span className="text-sm font-medium text-white/60">{index + 1}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p
                                                className={`font-medium ${item.completed || item.current ? "text-white" : "text-white/40"
                                                    }`}
                                            >
                                                {item.label}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Customer Info */}
                <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-purple-400" />
                        Información de entrega
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-white/50 text-sm">Cliente</p>
                            <p className="text-white font-medium">{data.customer.fullName}</p>
                        </div>
                        {(data.customer.district || data.customer.city || data.customer.province) && (
                            <div>
                                <p className="text-white/50 text-sm">Ubicación</p>
                                <p className="text-white">
                                    {[data.customer.district, data.customer.city, data.customer.province]
                                        .filter(Boolean)
                                        .join(", ")}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="text-white/50 text-sm">Tipo de entrega</p>
                            <p className="text-white capitalize">{data.deliveryType.replace("_", " ").toLowerCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Products */}
                <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-purple-400" />
                        Tu pedido ({data.items.length} {data.items.length === 1 ? "producto" : "productos"})
                    </h3>
                    <div className="space-y-3">
                        {data.items.map((item, index) => (
                            <div
                                key={index}
                                className="flex justify-between items-start py-3 border-b border-white/10 last:border-0"
                            >
                                <div className="flex-1">
                                    <p className="text-white font-medium">{item.productName}</p>
                                    {item.attributes && Object.keys(item.attributes).length > 0 && (
                                        <p className="text-white/50 text-sm">
                                            {Object.entries(item.attributes)
                                                .map(([key, value]) => `${key}: ${value}`)
                                                .join(" | ")}
                                        </p>
                                    )}
                                    <p className="text-white/50 text-sm">
                                        Cantidad: {item.quantity} × S/ {item.unitPrice.toFixed(2)}
                                    </p>
                                </div>
                                <p className="text-white font-medium">S/ {item.subtotal.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <div className="flex justify-between text-white">
                            <span className="text-white/70">Total del pedido</span>
                            <span className="font-bold text-lg">S/ {data.totals.grandTotal.toFixed(2)}</span>
                        </div>
                        {data.totals.totalPaid > 0 && (
                            <div className="flex justify-between text-green-400">
                                <span>Pagado</span>
                                <span>- S/ {data.totals.totalPaid.toFixed(2)}</span>
                            </div>
                        )}
                        {data.totals.pendingAmount > 0 && (
                            <div className="flex justify-between text-amber-400">
                                <span>Pendiente de pago</span>
                                <span className="font-semibold">S/ {data.totals.pendingAmount.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-white/40 text-sm py-4">
                    <p>¿Tienes alguna pregunta sobre tu pedido?</p>
                    <p>Contáctanos con tu número de orden: <span className="font-mono text-purple-300">{data.orderNumber}</span></p>
                </div>
            </main>
        </div>
    );
}
