import type { LiveCustomer, LiveQuoteInput } from "./types";

export type LiveCheckoutDetailGroup = "customer" | "delivery" | "receipt";

export default function LiveCheckoutDetails({
  customer,
  delivery,
  receipt,
  onModify,
  disabled,
}: {
  customer?: LiveCustomer;
  delivery?: LiveQuoteInput["delivery"];
  receipt?: LiveQuoteInput["receipt"];
  onModify?: (group: LiveCheckoutDetailGroup) => void;
  disabled?: boolean;
}) {
  const modify = (group: LiveCheckoutDetailGroup, label: string) =>
    onModify ? (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onModify(group)}
        className="shrink-0 rounded-md px-1 py-1 text-xs font-semibold text-[#25F4EE] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:opacity-40"
      >
        Modificar {label}
      </button>
    ) : null;
  return (
    <div className="space-y-4 text-sm">
      {customer ? (
        <section className="rounded-xl border border-white/10 p-4" aria-label="Comprador">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Comprador</h3>
            {modify("customer", "comprador")}
          </div>
          <p className="break-words">{customer.name.trim()}</p>
          <p className="mt-1 text-zinc-300">WhatsApp: {customer.phone}</p>
          {customer.socialUsername?.trim() ? (
            <p className="mt-1 break-words text-zinc-300">{customer.socialUsername.trim()}</p>
          ) : null}
        </section>
      ) : null}
      {delivery ? (
        <section
          className="rounded-xl border border-white/10 p-4"
          aria-label="Entrega de esta compra"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Entrega</h3>
            {modify("delivery", "entrega")}
          </div>
          <p>{delivery.type === "AGENCY" ? "Recojo en agencia" : "Envío a domicilio"}</p>
          {delivery.type === "AGENCY" && delivery.agency ? (
            <p className="mt-1 break-words">{delivery.agency.trim()}</p>
          ) : null}
          <p className="mt-1 break-words">{delivery.address.trim()}</p>
          <p className="mt-1 break-words text-zinc-300">
            {delivery.district}, {delivery.province}, {delivery.department}
          </p>
        </section>
      ) : null}
      {receipt ? (
        <section
          className="rounded-xl border border-white/10 p-4"
          aria-label="Comprobante de esta compra"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Comprobante</h3>
            {modify("receipt", "comprobante")}
          </div>
          {receipt.type === "FACTURA" ? (
            <>
              <p>Factura · RUC {receipt.ruc}</p>
              <p className="mt-1 break-words text-zinc-300">{receipt.businessName.trim()}</p>
            </>
          ) : (
            <p>Boleta · DNI {receipt.dni}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
