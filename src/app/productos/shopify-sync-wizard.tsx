"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopifyStatus,
  syncShopifyProducts,
} from "@/services/shopifyService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ShopifySyncWizardProps {
  onBack: () => void;
}

export default function ShopifySyncWizard({ onBack }: ShopifySyncWizardProps) {
  const { auth } = useAuth();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      if (!auth?.company?.id) return;
      try {
        const data = await getShopifyStatus(auth.company.id);
        setShops(data);
      } catch (error) {
        console.error("Error loading Shopify status:", error);
        toast.error("Error al cargar el estado de Shopify");
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, [auth]);

  const handleSync = async (shopUrl: string) => {
    if (!auth?.company?.id) return;
    setSyncing(shopUrl);
    try {
      const result = await syncShopifyProducts(
        shopUrl,
        auth.company.id,
        auth.company.stores?.[0]?.id, // Default to first store for inventory if not selected
      );
      toast.success(
        `Sincronización completada: ${result.success} productos procesados`,
      );
    } catch (error) {
      console.error("Error syncing products:", error);
      toast.error("Error al sincronizar productos");
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          Verificando conexión con Shopify...
        </p>
      </div>
    );
  }

  const activeShops = shops.filter((s) => s.isConnected);

  return (
    <div className="max-w-4xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Sincronización con Shopify
          </h2>
          <p className="text-muted-foreground">
            Trae tus productos y variantes directamente desde tu tienda Shopify
          </p>
        </div>
      </div>

      {activeShops.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="rounded-full bg-amber-50 dark:bg-amber-950/30 p-4">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                No hay tiendas conectadas
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Para sincronizar productos, primero debes conectar tu tienda
                Shopify en la sección de integraciones.
              </p>
            </div>
            <Link href="/configuracion/integraciones">
              <Button className="mt-2">
                Ir a Integraciones
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {activeShops.map((shop) => (
            <Card key={shop.shop_url} className="overflow-hidden">
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center border border-teal-100 dark:border-teal-900">
                    <CheckCircle2 className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{shop.shop_url}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex h-2 w-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Conectado
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleSync(shop.shop_url)}
                    disabled={!!syncing}
                    className="bg-teal-600 hover:bg-teal-700 text-white min-w-[150px]"
                  >
                    {syncing === shop.shop_url ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sincronizar ahora
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 px-6 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Esta acción actualizará productos existentes y creará nuevos.
                  El inventario se sincronizará automáticamente.
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
            ¿Cómo funciona?
          </p>
          <p className="text-sm text-blue-800/80 dark:text-blue-400/80">
            Una vez activado, los cambios en Shopify (nuevos productos,
            actualizaciones) se reflejarán automáticamente en Powip mediante
            webhooks en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
