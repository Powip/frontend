export function CcCierreDiaMoneyNotice({
  error,
  hasSaved,
}: {
  error: unknown;
  hasSaved: boolean;
}) {
  return (
    <>
      {hasSaved ? (
        <p className="rounded-lg border p-3 text-xs text-muted-foreground">
          Los cierres guardados son registros históricos sin moneda verificada y
          conservan sus importes originales.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-sm"
        >
          {error instanceof Error
            ? error.message
            : "No se pudo calcular el cierre vivo. Los registros guardados se conservan."}
        </p>
      ) : null}
    </>
  );
}
