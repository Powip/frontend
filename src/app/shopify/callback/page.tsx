"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, LayoutGrid } from "lucide-react";
import axios from "axios";
import { ShopifyOrderReviewModal } from "../components/shopify-order-review-modal";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Procesando conexión con Shopify...");
  const [orders, setOrders] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState("");

  useEffect(() => {
    const shop = searchParams.get("shop");
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(`Error de conexión: ${error}`);
      return;
    }

    if (shop && token) {
      handleSuccess(shop, token);
    } else {
      setStatus("error");
      setMessage("Faltan parámetros de autenticación.");
    }
  }, [searchParams]);

  const handleSuccess = async (shop: string, token: string) => {
    setStatus("success");
    setMessage(`¡Conexión exitosa con ${shop}!`);
    setCurrentShop(shop);

    // Intentar traer órdenes para el PoC
    try {
      console.log("Solicitando órdenes de prueba...");
      const integrationApiUrl =
        process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";
      const response = await axios.post(
        `${integrationApiUrl}/shopify/sync/${shop}`,
        {
          accessToken: token,
        },
      );

      const fetchedOrders = response.data;
      setOrders(fetchedOrders);
      setIsModalOpen(true); // Abrir el modal automáticamente al cargar las órdenes
    } catch (err) {
      console.error("Error al traer órdenes de prueba:", err);
    }
  };

  return (
    <div className="flex items-center justify-center min-vh-100 p-10 mt-20">
      <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-teal-500">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            {status === "loading" && (
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            )}
            {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
            Integración con Shopify
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-300">{message}</p>

          {status === "success" && orders.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-xl text-left border border-teal-100 dark:border-teal-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-teal-800 dark:text-teal-300">
                  Sincronización de Órdenes ({orders.length})
                </p>
                <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-none">
                  Lista para importar
                </Badge>
              </div>
              <p className="text-sm text-teal-700 dark:text-teal-400 mb-6">
                Hemos recuperado las órdenes de tu tienda. Ahora puedes
                revisarlas y seleccionar cuáles deseas importar a Powip.
              </p>
              <Button
                onClick={() => setIsModalOpen(true)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md transition-all active:scale-95"
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Revisar y Sincronizar Órdenes
              </Button>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button
              onClick={() => router.push("/configuracion/tiendas")}
              variant="outline"
              className="px-8"
            >
              Volver
            </Button>
            {status === "success" && (
              <Button
                onClick={() => router.push("/ventas")}
                variant="ghost"
                className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
              >
                Ir a Ventas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ShopifyOrderReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orders={orders}
        shopUrl={currentShop}
      />
    </div>
  );
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
