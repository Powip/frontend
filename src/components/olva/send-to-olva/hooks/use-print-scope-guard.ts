import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ShippingGuide } from "@/components/modals/GuideDetailsModal";
import { useAuth } from "@/contexts/AuthContext";
import { requiresAuthenticatedSaleMutation } from "@/services/saleTrackingService";
import {
  asSaleState,
  type PrintableOrder,
  type ReceiptRequestContext,
} from "../utils/fetch-order-receipts";

interface UsePrintScopeGuardParams {
  open: boolean;
  companyId: string | undefined;
  guideId: string | undefined;
  guide: ShippingGuide | null | undefined;
  /** Every order the modal was opened with: a change in them cancels a print in flight. */
  orders: readonly PrintableOrder[];
}

interface RunOptions {
  /** The guide must be loaded and be the one the modal was opened for. */
  requireGuide?: boolean;
  errorMessage: string;
}

export interface PrintTaskContext extends ReceiptRequestContext {
  isCurrent: () => boolean;
}

const SESSION_CHANGED_MESSAGE =
  "La sesión o empresa cambió. Vuelve a abrir los pedidos para imprimir.";

/**
 * Keeps a print from running against the wrong session: it only starts while the person and
 * company that opened the modal are still the signed-in ones, and it is cancelled (abort signal +
 * `isCurrent()`) as soon as the modal closes or its orders, guide or session change. Printing
 * documents can take a while, so a late result must never reach another company's data.
 */
export function usePrintScopeGuard({
  open,
  companyId,
  guideId,
  guide,
  orders,
}: UsePrintScopeGuardParams) {
  const { auth } = useAuth();
  const [isPrinting, setIsPrinting] = useState(false);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const ownerKey = JSON.stringify([companyId, auth?.company?.id, auth?.user?.id]);
  const openedOwner = useRef(ownerKey);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the owner is captured when it opens
  useEffect(() => {
    // The orders belong to the session that opened the modal; a later login cannot print them
    if (open) openedOwner.current = ownerKey;
  }, [open]);

  const ordersKey = JSON.stringify(
    orders
      .map((order) => [
        order.id,
        order.companyId,
        order.status,
        order.stockVersion,
        order.confirmedStockVersion,
        order.unitAssignmentStatus,
        order.unitCatalogValidated,
        (order as { hasTrackedUnits?: boolean }).hasTrackedUnits,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  const scopeKey = JSON.stringify([
    open,
    companyId,
    auth?.company?.id,
    auth?.user?.id,
    auth?.accessToken,
    ordersKey,
    guideId,
    guide?.id,
    guide?.guideNumber,
    guide?.status,
  ]);
  const currentScope = useRef(scopeKey);

  currentScope.current = scopeKey;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scopeKey alone restarts the guard
  useEffect(() => {
    setIsPrinting(false);

    return () => {
      generation.current += 1;
      abort.current?.abort();
      abort.current = null;
    };
  }, [scopeKey]);

  const run = async (
    targets: readonly PrintableOrder[],
    { requireGuide = false, errorMessage }: RunOptions,
    task: (context: PrintTaskContext) => Promise<void>,
  ) => {
    if (targets.length === 0) {
      toast.warning("No hay pedidos exitosos para imprimir");
      return;
    }

    if (requireGuide && !guide) {
      toast.error("No se pudo cargar la información de la guía para imprimir");
      return;
    }

    const token = auth?.accessToken;
    const sessionChanged =
      !open ||
      openedOwner.current !== ownerKey ||
      !companyId ||
      companyId !== auth?.company?.id ||
      !auth?.user?.id ||
      (requireGuide && Boolean(guideId) && guide?.id !== guideId) ||
      targets.some(
        (order) =>
          (order.companyId && order.companyId !== companyId) ||
          (requiresAuthenticatedSaleMutation(asSaleState(order)) && !token),
      );

    if (sessionChanged) {
      toast.error(SESSION_CHANGED_MESSAGE);
      return;
    }

    const scope = scopeKey;

    abort.current?.abort();

    const controller = new AbortController();

    abort.current = controller;

    const run = ++generation.current;
    const isCurrent = () =>
      !controller.signal.aborted && currentScope.current === scope && generation.current === run;

    setIsPrinting(true);

    try {
      await task({ companyId, token, signal: controller.signal, isCurrent });
    } catch {
      if (isCurrent()) toast.error(errorMessage);
    } finally {
      if (isCurrent()) {
        setIsPrinting(false);
        abort.current = null;
      }
    }
  };

  return { isPrinting, run };
}
