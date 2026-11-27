import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { printOrderLabelsBatch } from "@/utils/printOrderLabel";
import { printShippingGuide } from "@/utils/printShippingGuide";
import {
  asOrderHeader,
  fetchOrderReceipt,
  loadPrintableGuideOrders,
  type PrintableOrder,
} from "../utils/fetch-order-receipts";
import { usePrintScopeGuard } from "./use-print-scope-guard";

type UseOlvaPrintOrdersParams = Parameters<typeof usePrintScopeGuard>[0];

/** The two documents the team prints once orders are registered: dispatch labels and the departure guide. */
export function useOlvaPrintOrders(params: UseOlvaPrintOrdersParams) {
  const { auth } = useAuth();
  const { guide } = params;
  const { isPrinting, run } = usePrintScopeGuard(params);

  const printGuide = (orders: readonly PrintableOrder[]) =>
    run(
      orders,
      {
        requireGuide: true,
        errorMessage: "No se pudieron cargar los datos de los pedidos para imprimir la guía",
      },
      async (context) => {
        const printable = await loadPrintableGuideOrders(orders, context);

        if (!context.isCurrent() || !guide) return;

        await printShippingGuide(guide, printable, auth?.company, {
          isCurrent: context.isCurrent,
          signal: context.signal,
        });
      },
    );

  const printLabels = (orders: readonly PrintableOrder[]) =>
    run(
      orders,
      { errorMessage: "No se pudieron cargar los datos de los pedidos para imprimir" },
      async (context) => {
        const receipts = await Promise.all(
          orders.map((order) => fetchOrderReceipt(order, context)),
        );

        if (!context.isCurrent()) return;

        await printOrderLabelsBatch(
          orders.map((order, index) => ({
            receipt: receipts[index],
            orderHeader: asOrderHeader(order),
          })),
          auth?.company,
          context.isCurrent,
          context.signal,
        );

        if (context.isCurrent()) toast.success(`${orders.length} etiqueta(s) enviadas a imprimir`);
      },
    );

  return { isPrinting, printGuide, printLabels };
}
