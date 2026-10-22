"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  commercialLeadError,
  confirmCommercialOrderPurchase,
  getCommercialLeadConfirmationCapabilities,
} from "@/services/commercialLeadsService";
import type { ConfirmCommercialOrderPurchaseInput } from "@/types/leads";
import { commercialLeadHref, notifyCommercialChange } from "@/utils/commercialOrders";
import { leadCommandId } from "@/components/commercial-leads/lead-ui";
import {
  confirmarVentaCc,
  getCcOrderConfirmationCapabilities,
} from "@/services/atencionClienteService";

interface Props {
  orderId: string;
  commercialLeadId?: string | null;
  canalOrigen?: string | null;
  orderUpdatedAt?: string;
  datosCompletos: boolean;
  onUpdated: () => void;
}

export function CcSaleConfirmationPanel({
  orderId,
  commercialLeadId,
  canalOrigen,
  orderUpdatedAt,
  datosCompletos,
  onUpdated,
}: Props) {
  const { auth, hasPermission } = useAuth();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const canManage = hasPermission("MANAGE_CUSTOMER_SERVICE");
  const isShopifyCod = canalOrigen === "shopify_cod";
  const queryClient = useQueryClient();
  const capabilities = useQuery({
    queryKey: [
      "cc-sale-confirmation-capabilities",
      companyId,
      userId,
      isShopifyCod ? orderId : null,
    ],
    queryFn: () =>
      isShopifyCod
        ? getCcOrderConfirmationCapabilities(orderId)
        : getCommercialLeadConfirmationCapabilities(),
    enabled: canManage,
    retry: false,
  });
  const canConfirm =
    canManage &&
    capabilities.isSuccess &&
    capabilities.data?.enabled === true &&
    capabilities.data.canConfirm;
  const scope = JSON.stringify([
    companyId,
    userId,
    orderId,
    commercialLeadId,
    orderUpdatedAt,
    isShopifyCod,
  ]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true);
  const mutationLock = useRef(false);
  const command = useRef<{
    scope: string;
    input: ConfirmCommercialOrderPurchaseInput;
  } | null>(null);
  const [review, setReview] = useState<{
    scope: string;
    accepted: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmedScope, setConfirmedScope] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const reviewing = review?.scope === scope;
  const actor =
    [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ").trim() ||
    auth?.user?.email ||
    "Cuenta actual";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function startReview() {
    if (!canConfirm || !datosCompletos || !orderUpdatedAt || mutationLock.current) return;
    if (command.current?.scope !== scope) {
      command.current = {
        scope,
        input: {
          commandId: leadCommandId(),
          ...(commercialLeadId ? { leadId: commercialLeadId } : {}),
          expectedOrderUpdatedAt: orderUpdatedAt,
        },
      };
    }
    setFailure(null);
    setReview({ scope, accepted: false });
  }

  async function confirmSale() {
    if (
      mutationLock.current ||
      !canConfirm ||
      !datosCompletos ||
      !orderUpdatedAt ||
      !reviewing ||
      !review?.accepted ||
      command.current?.scope !== scope
    )
      return;
    mutationLock.current = true;
    setPending(true);
    setFailure(null);
    try {
      const result = await (isShopifyCod ? confirmarVentaCc : confirmCommercialOrderPurchase)(
        orderId,
        command.current.input,
      );
      if (!mounted.current || currentScope.current !== scope) return;
      setConfirmedScope(scope);
      setReview(null);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      notifyCommercialChange(companyId, result.lead.id);
      toast.success("Venta confirmada. Continúa la gestión del pedido en CC.");
      onUpdated();
    } catch (error) {
      if (mounted.current && currentScope.current === scope) {
        const message = commercialLeadError(error);
        setFailure({ scope, message });
        toast.error(message);
      }
    } finally {
      mutationLock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (confirmedScope === scope)
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
        Venta confirmada. Continúa la gestión del pedido en CC.
      </p>
    );

  return (
    <section
      className="space-y-3 rounded-lg border p-4 text-sm"
      aria-label="Confirmación de venta en Gestión CC"
    >
      <h3 className="font-semibold">Gestión CC</h3>
      <p>La compra sigue pendiente de confirmación del vendedor.</p>
      {!canManage || (capabilities.data?.enabled && !capabilities.data.canConfirm) ? (
        <p className="text-muted-foreground">Tu rol no permite confirmar ventas.</p>
      ) : capabilities.isPending ? (
        <p className="text-muted-foreground">Verificando permiso para confirmar la venta…</p>
      ) : capabilities.isError ? (
        <div role="alert" className="space-y-2">
          <p>No se pudo verificar el permiso para confirmar la venta.</p>
          <Button variant="outline" size="sm" onClick={() => void capabilities.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : !capabilities.data?.enabled ? (
        <p className="text-muted-foreground">La confirmación de ventas no está habilitada.</p>
      ) : null}

      {failure?.scope === scope ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {failure.message}
        </p>
      ) : null}
      {canConfirm && !datosCompletos ? (
        <p className="text-amber-700 dark:text-amber-400">
          Completa y guarda los datos del cliente antes de confirmar la venta.
        </p>
      ) : null}
      {canConfirm && !orderUpdatedAt ? (
        <p className="text-amber-700 dark:text-amber-400">
          Vuelve a abrir el pedido para revisar sus datos actualizados.
        </p>
      ) : null}

      {canConfirm && reviewing ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="font-medium">Confirmará: {actor} (tú)</p>
          <p>
            La compra quedará confirmada con sus productos y pagos registrados. Continúa su gestión
            aquí.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={review.accepted}
              disabled={pending}
              onChange={(event) => setReview({ scope, accepted: event.target.checked })}
            />
            <span>El cliente aceptó los productos y el total del pedido</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!review.accepted || !datosCompletos || pending}
              onClick={() => void confirmSale()}
            >
              {pending ? "Confirmando…" : "Confirmar y continuar en CC"}
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setReview(null)}>
              Volver
            </Button>
          </div>
        </div>
      ) : canConfirm ? (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700"
          disabled={!datosCompletos || !orderUpdatedAt || pending}
          onClick={startReview}
        >
          <Check className="mr-1 h-3 w-3" />
          Confirmar venta
        </Button>
      ) : null}

      {!isShopifyCod ? (
        <div>
          <Button asChild variant="outline" size="sm">
            <Link
              href={commercialLeadId ? commercialLeadHref(commercialLeadId) : "/leads-comerciales"}
            >
              Gestionar y confirmar Lead
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
