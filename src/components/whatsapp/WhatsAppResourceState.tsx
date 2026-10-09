import { CircleAlert, Lock, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { PendingIntegrationNotice } from "./PendingIntegrationNotice";

interface WhatsAppResourceStateProps<T> {
  state: ResourceState<T>;
  pendingTitle: string;
  pendingDescription?: string;
  pendingItems?: string[];
  loadingLabel: string;
  errorTitle: string;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function WhatsAppResourceState<T>({
  state,
  pendingTitle,
  pendingDescription,
  pendingItems,
  loadingLabel,
  errorTitle,
  onRetry,
  isEmpty,
  empty,
  children,
}: WhatsAppResourceStateProps<T>) {
  switch (state.kind) {
    case "pending-integration":
      return (
        <PendingIntegrationNotice
          title={pendingTitle}
          description={pendingDescription}
          items={pendingItems}
        />
      );
    case "loading":
      return (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">{loadingLabel}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    case "forbidden":
      return (
        <Alert role="note">
          <Lock aria-hidden="true" />
          <AlertTitle className="line-clamp-none whitespace-normal">
            No tienes permiso para ver esta sección.
          </AlertTitle>
        </Alert>
      );
    case "error":
      return (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle className="line-clamp-none whitespace-normal">{errorTitle}</AlertTitle>
          <AlertDescription>
            <p>{state.message}</p>
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      );
    case "ready":
      if (isEmpty?.(state.data)) return <>{empty}</>;
      return <>{children(state.data)}</>;
  }
}
