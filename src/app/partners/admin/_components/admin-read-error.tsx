import { PartnersRequestErrorAlert } from "@/components/partners/partners-request-error-alert";
import { toPartnersRequestError } from "@/features/partners/mappers/to-partners-request-error";

export function AdminReadError({
  error,
  message,
  onRetry,
}: {
  error: unknown;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <PartnersRequestErrorAlert
      error={toPartnersRequestError(error)}
      fallbackMessage={message}
      onRetry={onRetry}
    />
  );
}

export function AdminReadAccessDenied() {
  return (
    <p role="alert" className="rounded-xl border p-6 text-sm text-muted-foreground">
      Necesitás el permiso PARTNERS_VIEW para consultar estos datos.
    </p>
  );
}
