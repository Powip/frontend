import { CircleAlert, Lock, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { cn } from "@/lib/utils";
import { PendingIntegrationNotice } from "./PendingIntegrationNotice";
import { waButton } from "./ui/wa-classes";

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

export function WhatsAppErrorNotice({
  title,
  message,
  onRetry,
  className,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl bg-wa-red-soft px-4 py-3.5 text-[13px] text-wa-fg",
        className,
      )}
    >
      <CircleAlert className="mt-px size-[18px] shrink-0 text-wa-red" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-semibold">{title}</p>
          {message && <p className="text-wa-muted">{message}</p>}
        </div>
        {onRetry && (
          <Button type="button" className={waButton({ size: "sm" })} onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}

const LOADING_ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

export function WhatsAppLoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">{label}</span>
      {LOADING_ROW_KEYS.slice(0, rows).map((key) => (
        <Skeleton key={key} className="h-10 w-full rounded-xl bg-wa-surface-2" />
      ))}
    </div>
  );
}

export function WhatsAppForbiddenNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-wa-border bg-wa-surface-2 px-3.5 py-3 text-[13px] text-wa-fg",
        className,
      )}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-wa-muted" aria-hidden="true" />
      <p className="font-medium">No tienes permiso para ver esta sección.</p>
    </div>
  );
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
      return <WhatsAppLoadingRows label={loadingLabel} />;
    case "forbidden":
      return <WhatsAppForbiddenNotice />;
    case "error":
      return <WhatsAppErrorNotice title={errorTitle} message={state.message} onRetry={onRetry} />;
    case "ready":
      if (isEmpty?.(state.data)) return <>{empty}</>;
      return <>{children(state.data)}</>;
  }
}
