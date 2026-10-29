import type { QuotationPaymentDestination } from "@/types/quotations";

export default function PublicQuotationPaymentDestinations({
  destinations,
}: {
  destinations?: QuotationPaymentDestination[];
}) {
  const enabled = destinations?.filter((destination) => destination.enabled !== false) ?? [];
  if (!enabled.length)
    return (
      <p className="mt-3 text-sm text-slate-600">
        El negocio aún no ha configurado sus datos de pago. Contacta al vendedor para solicitarlos
        antes de pagar.
      </p>
    );
  return (
    <div className="mt-4 space-y-3" aria-label="Datos de pago del negocio">
      {enabled.map((destination) => {
        let qrUrl: string | null = null;
        try {
          const url = new URL(destination.qrUrl ?? "");
          if (url.protocol === "https:" && !url.username && !url.password) qrUrl = url.href;
        } catch {
          /* A phone number is sufficient for a configured Yape destination. */
        }
        return (
          <section
            key={destination.id}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
          >
            <h3 className="font-semibold text-slate-800">{destination.label}</h3>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-xs text-slate-500">Titular</dt>
                <dd className="break-words font-medium">{destination.holder}</dd>
              </div>
              {destination.method === "YAPE_QR" ? (
                <div>
                  <dt className="text-xs text-slate-500">Número de Yape</dt>
                  <dd className="select-all font-mono font-semibold">{destination.phone}</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt className="text-xs text-slate-500">Banco</dt>
                    <dd>{destination.bank}</dd>
                  </div>
                  {destination.accountNumber && (
                    <div>
                      <dt className="text-xs text-slate-500">Número de cuenta</dt>
                      <dd className="break-all font-mono select-all">
                        {destination.accountNumber}
                      </dd>
                    </div>
                  )}
                  {destination.cci && (
                    <div>
                      <dt className="text-xs text-slate-500">CCI</dt>
                      <dd className="break-all font-mono select-all">{destination.cci}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {destination.method === "YAPE_QR" && qrUrl && (
              <img
                src={qrUrl}
                alt={`QR de Yape de ${destination.holder}`}
                width={192}
                height={192}
                loading="lazy"
                decoding="async"
                className="mt-3 max-h-48 max-w-full rounded-lg bg-white object-contain"
              />
            )}
            {destination.instructions && (
              <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600 [overflow-wrap:anywhere]">
                {destination.instructions}
              </p>
            )}
          </section>
        );
      })}
      <p className="text-xs text-slate-500">
        Verifica el titular antes de pagar. El comprobante quedará pendiente hasta que el negocio lo
        apruebe.
      </p>
    </div>
  );
}
