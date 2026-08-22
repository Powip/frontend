export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="h-8 flex-1 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <span>{message ?? "Ocurrió un error al cargar los datos."}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  );
}
