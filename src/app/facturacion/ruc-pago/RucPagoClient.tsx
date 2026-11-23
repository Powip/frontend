"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExtraRucPurchase } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-purchase";
import { useActivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";

/** Pasado este tiempo sin confirmación se ofrece volver a verificar (Flow a veces tarda unos minutos). */
const WAIT_BEFORE_HINT_MS = 60_000;

/**
 * A donde vuelve el usuario después de pagar el RUC extra en Flow (?purchase=<id>). El pago lo confirma el
 * webhook, así que aquí se consulta la compra hasta que pase a PAID o FAILED.
 * - PAID de un RUC que ya existía desactivado: se activa solo y se vuelve a Facturación.
 * - PAID de un RUC nuevo: se vuelve a Facturación con la subida del certificado abierta y el RUC cargado.
 */
export default function RucPagoClient() {
  const router = useRouter();
  const [purchaseId, setPurchaseId] = useState<string | null | undefined>(undefined);
  const [waitedLong, setWaitedLong] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    setPurchaseId(new URLSearchParams(window.location.search).get("purchase"));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLong(true), WAIT_BEFORE_HINT_MS);

    return () => clearTimeout(timer);
  }, []);

  const purchaseQuery = useExtraRucPurchase(purchaseId ?? null);
  const { data: profiles, isLoading: profilesLoading } = useSunatProfiles();
  const activate = useActivateSunatProfile();
  const purchase = purchaseQuery.data;

  useEffect(() => {
    if (!purchase || purchase.status !== "PAID" || profilesLoading || handledRef.current) {
      return;
    }

    handledRef.current = true;

    const existing = (profiles ?? []).find((profile) => profile.ruc === purchase.ruc);

    if (existing && !existing.isActive) {
      activate.mutate(existing.id, { onSettled: () => router.replace("/facturacion") });
      return;
    }

    if (existing) {
      router.replace("/facturacion");
      return;
    }

    const params = new URLSearchParams({
      nuevoRuc: purchase.ruc,
      razonSocial: purchase.razonSocial,
    });
    router.replace(`/facturacion?${params.toString()}`);
  }, [purchase, profiles, profilesLoading, activate, router]);

  if (purchaseId === undefined) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Pago del RUC extra</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {purchaseId === null && (
            <>
              <p>No encontramos el pago que quieres revisar.</p>
              <Button onClick={() => router.replace("/facturacion")}>Volver a Facturación</Button>
            </>
          )}

          {purchaseId !== null && purchaseQuery.isError && (
            <>
              <p className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" /> No pudimos consultar el estado del pago.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => purchaseQuery.refetch()}>Volver a verificar</Button>
                <Button variant="ghost" onClick={() => router.replace("/facturacion")}>
                  Volver a Facturación
                </Button>
              </div>
            </>
          )}

          {purchaseId !== null &&
            !purchaseQuery.isError &&
            (!purchase || purchase.status === "PENDING") && (
              <>
                <p className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Estamos confirmando tu pago con Flow. No cierres esta página.
                </p>
                {waitedLong && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      Todavía no vemos la confirmación. A veces tarda unos minutos.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => purchaseQuery.refetch()}>Volver a verificar</Button>
                      <Button variant="ghost" onClick={() => router.replace("/facturacion")}>
                        Volver a Facturación
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

          {purchase?.status === "PAID" && (
            <p className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Pago confirmado. Te llevamos a configurar el RUC {purchase.ruc}…
            </p>
          )}

          {purchase?.status === "FAILED" && (
            <>
              <p className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                El pago no se completó, así que no se agregó el RUC. No se te cobró.
              </p>
              <Button onClick={() => router.replace("/facturacion")}>Volver a Facturación</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
