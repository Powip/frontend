import { LockKeyhole, MapPin, Truck } from "lucide-react";
import type { PublicOrderTracking } from "@/types/quotations";
import { quotationMoney as money } from "@/services/quotationService";

function safeTrackingUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export default function PublicQuotationTrackingDetails({
  tracking,
}: {
  tracking: PublicOrderTracking;
}) {
  if (tracking.status === "ANULADO" || tracking.status === "LEAD") return null;

  const shipping = tracking.shippingInfo;
  const trackingUrl = safeTrackingUrl(shipping?.trackingUrl);
  const location = [tracking.customer.district, tracking.customer.city, tracking.customer.province]
    .filter(Boolean)
    .join(", ");
  const fullyPaid = tracking.totals.pendingAmount <= 0;
  const deliveryType = tracking.deliveryType.replace(/_/g, " ").toLocaleLowerCase("es-PE");

  return (
    <>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <MapPin size={18} className="text-teal-700" />
          Información de entrega
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Cliente</dt>
            <dd className="mt-1 font-semibold">{tracking.customer.fullName}</dd>
          </div>
          {tracking.customer.address && (
            <div>
              <dt className="text-slate-500">Dirección</dt>
              <dd className="mt-1 break-words">{tracking.customer.address}</dd>
            </div>
          )}
          {location && (
            <div>
              <dt className="text-slate-500">Ubicación</dt>
              <dd className="mt-1">{location}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">Tipo de entrega</dt>
            <dd className="mt-1 capitalize">{deliveryType}</dd>
          </div>
          {tracking.courier && (
            <div>
              <dt className="text-slate-500">Courier asignado</dt>
              <dd className="mt-1 font-semibold">{tracking.courier}</dd>
            </div>
          )}
        </dl>
        <div className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">
          <p>Pagos aprobados: {money(tracking.totals.totalPaid)}</p>
          <p className="mt-2 font-semibold">
            {fullyPaid
              ? "Pedido pagado en su totalidad"
              : `Saldo pendiente: ${money(tracking.totals.pendingAmount)}`}
          </p>
        </div>
      </section>

      {shipping && (
        <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="flex items-center gap-2 font-bold text-blue-900">
            <Truck size={19} />
            Tu pedido fue despachado
          </h2>
          <p className="mt-2 text-sm text-blue-800">
            {tracking.courier || "El transportista"} ya tiene tu paquete.
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            {shipping.externalTrackingNumber && (
              <div className="min-w-0 rounded-xl bg-white p-4">
                <dt className="text-slate-500">Número de guía</dt>
                <dd className="mt-1 break-words font-mono font-bold">
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline underline-offset-2"
                    >
                      {shipping.externalTrackingNumber}
                    </a>
                  ) : (
                    shipping.externalTrackingNumber
                  )}
                </dd>
              </div>
            )}
            {trackingUrl && (
              <div className="min-w-0 rounded-xl bg-white p-4">
                <dt className="text-slate-500">Rastreo del envío</dt>
                <dd className="mt-1">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-700 underline underline-offset-2"
                  >
                    Rastrear envío
                  </a>
                </dd>
              </div>
            )}
            {shipping.shippingCode && (
              <div className="min-w-0 rounded-xl bg-white p-4">
                <dt className="text-slate-500">Código de envío</dt>
                <dd className="mt-1 break-words font-mono font-bold">{shipping.shippingCode}</dd>
              </div>
            )}
            {shipping.shalomDestinationAgency && (
              <div className="min-w-0 rounded-xl bg-white p-4">
                <dt className="text-slate-500">Agencia de retiro</dt>
                <dd className="mt-1 break-words font-semibold">{shipping.shalomDestinationAgency}</dd>
              </div>
            )}
            <div className="min-w-0 rounded-xl bg-white p-4">
              <dt className="text-slate-500">Clave de retiro</dt>
              <dd className="mt-1">
                {fullyPaid ? (
                  <>
                    <p className="break-words font-mono text-xl font-bold tracking-widest text-teal-800">
                      {shipping.shippingKey || "—"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Necesaria para retirar en agencia.</p>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-amber-800">
                    <LockKeyhole size={16} className="mt-0.5 shrink-0" />
                    <span>
                      Para ver la clave debes saldar el total del pedido ({money(tracking.totals.pendingAmount)} pendiente).
                    </span>
                  </p>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
