"use client";

import { FileText } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type CustomerServiceModalComponent from "@/components/modals/CustomerServiceModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón «Ver» + modal general de detalle del pedido (CustomerServiceModal).
 *
 * El modal vive una sola vez por página dentro de <OrderDetailModalProvider>
 * (no uno por fila): así un refetch que saque la fila de su pestaña no cierra
 * el modal a mitad de la gestión, y las filas no montan contenido pesado.
 * El código del modal se carga recién en la primera apertura y sus fetch
 * siguen condicionados a `open`.
 *
 * Uso habitual:
 *   <OrderDetailModalProvider isOperaciones showTracking onOrderUpdated={refetch}>
 *     ...<OrderDetailButton orderId={sale.id} orderNumber={sale.orderNumber} />
 *   </OrderDetailModalProvider>
 *
 * Apertura programática: useOrderDetailModal().openOrderDetail(orderId).
 */

const CustomerServiceModal = lazy(() => import("@/components/modals/CustomerServiceModal"));

type CustomerServiceModalProps = ComponentProps<typeof CustomerServiceModalComponent>;

/** Opciones del modal fijas para toda la página (permisos, variante, callbacks). */
export type OrderDetailModalOptions = Omit<
  CustomerServiceModalProps,
  "open" | "orderId" | "onClose"
>;

/** Datos propios de la fila que se pasan al abrir (p. ej. la guía de Shalom). */
export type OrderDetailOpenOverrides = Pick<
  OrderDetailModalOptions,
  "shippingGuide" | "initialTab"
>;

interface OrderDetailModalContextValue {
  openOrderDetail: (orderId: string, overrides?: OrderDetailOpenOverrides) => void;
}

const OrderDetailModalContext = createContext<OrderDetailModalContextValue | null>(null);

export function useOrderDetailModal(): OrderDetailModalContextValue {
  const ctx = useContext(OrderDetailModalContext);
  if (!ctx) {
    throw new Error(
      "useOrderDetailModal/OrderDetailButton deben usarse dentro de <OrderDetailModalProvider>",
    );
  }
  return ctx;
}

interface ProviderProps extends OrderDetailModalOptions {
  children: ReactNode;
}

export function OrderDetailModalProvider({ children, ...options }: ProviderProps) {
  const [open, setOpen] = useState(false);
  // Se conserva tras cerrar para que la animación de salida no pierda contenido;
  // null = nunca se abrió → el modal ni siquiera se monta.
  const [current, setCurrent] = useState<{
    orderId: string;
    overrides?: OrderDetailOpenOverrides;
  } | null>(null);

  const openOrderDetail = useCallback((orderId: string, overrides?: OrderDetailOpenOverrides) => {
    setCurrent({ orderId, overrides });
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openOrderDetail }), [openOrderDetail]);

  return (
    <OrderDetailModalContext.Provider value={value}>
      {children}
      {current && (
        <Suspense fallback={null}>
          <CustomerServiceModal
            {...options}
            {...current.overrides}
            open={open}
            orderId={current.orderId}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </OrderDetailModalContext.Provider>
  );
}

interface OrderDetailButtonProps extends OrderDetailOpenOverrides {
  orderId: string;
  /** Número visible del pedido, para el nombre accesible. */
  orderNumber?: string | null;
  /** Reemplaza el nombre accesible por defecto ("Ver detalle del pedido …"). */
  ariaLabel?: string;
  className?: string;
}

/** Estilo único del botón «Ver» en todas las tablas que abren el detalle. */
export const orderDetailButtonClassName =
  "h-7 gap-1 rounded-md border border-violet-300 bg-violet-50 px-2.5 text-xs font-medium text-violet-700 shadow-none hover:bg-violet-100 hover:text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25 dark:hover:text-violet-200 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 has-[>svg]:px-2.5";

export function OrderDetailButton({
  orderId,
  orderNumber,
  ariaLabel,
  className,
  shippingGuide,
  initialTab,
}: OrderDetailButtonProps) {
  const { openOrderDetail } = useOrderDetailModal();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // No dispara selección/expansión/navegación de la fila contenedora.
    e.stopPropagation();
    const overrides: OrderDetailOpenOverrides = {};
    if (shippingGuide !== undefined) overrides.shippingGuide = shippingGuide;
    if (initialTab !== undefined) overrides.initialTab = initialTab;
    openOrderDetail(orderId, overrides);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(orderDetailButtonClassName, className)}
      aria-label={
        ariaLabel ??
        (orderNumber ? `Ver detalle del pedido ${orderNumber}` : "Ver detalle del pedido")
      }
      onClick={handleClick}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      Ver
    </Button>
  );
}
