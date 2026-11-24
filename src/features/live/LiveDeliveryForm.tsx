"use client";
import ubigeo from "@/utils/json/ubigeos.json";
import type { LiveDelivery, LivePurchaseInput, StoreDeliveryOption } from "./types";
import { liveMoney } from "./liveService";
import LiveSearchSelect from "./LiveSearchSelect";
export const purchaseField =
  "mt-1.5 min-h-12 w-full rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] px-3.5 py-3 text-base font-normal text-[var(--b-ink)] outline-none focus:border-[var(--acc)]";
const norm = (s = "") =>
  s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
function availableAgencies(delivery: LiveDelivery, options: StoreDeliveryOption[]) {
  return options.filter(
    (option) =>
      option.enabled &&
      option.type === "AGENCY" &&
      norm(option.department) === norm(delivery.department) &&
      norm(option.province) === norm(delivery.province) &&
      (!option.district || norm(option.district) === norm(delivery.district)) &&
      option.courier === delivery.courier,
  );
}
export function isMetro(d: LiveDelivery) {
  return (
    (norm(d.department) === "LIMA" && norm(d.province) === "LIMA") ||
    ["CALLAO", "PROV. CONST. DEL CALLAO"].includes(norm(d.department))
  );
}
export function deliveryError(
  d: LiveDelivery,
  receipt: LivePurchaseInput["receipt"],
  total: number,
): string {
  if (!d.department) return "Selecciona el departamento.";
  if (!d.province) return "Selecciona la provincia.";
  if (!d.district) return "Selecciona el distrito.";
  if (d.type === "HOME" && (!isMetro(d) || (d.address?.trim().length || 0) < 5))
    return "Dirección: escribe la calle y el número (al menos 5 caracteres).";
  if (d.type === "AGENCY" && !d.agencyId) return "Selecciona la agencia donde recogerás.";
  if (d.type === "AGENCY" && !/^\d{8}$/.test(d.dni || ""))
    return "DNI de quien recoge: escribe 8 dígitos.";
  if (receipt.type === "FACTURA" && !/^(10|20)\d{9}$/.test(receipt.ruc || ""))
    return "RUC: debe tener 11 dígitos y empezar con 10 o 20.";
  if (receipt.type === "FACTURA" && !receipt.businessName?.trim())
    return "Escribe la razón social.";
  if (receipt.type === "BOLETA" && total >= 700 && !/^\d{8}$/.test(receipt.dni || d.dni || ""))
    return "Para una boleta desde S/ 700, escribe tu DNI de 8 dígitos.";
  return "";
}
export default function LiveDeliveryForm({
  delivery,
  receipt,
  options,
  total,
  name,
  onDelivery,
  onReceipt,
}: {
  delivery: LiveDelivery;
  receipt: LivePurchaseInput["receipt"];
  options: StoreDeliveryOption[];
  total: number;
  name: string;
  onDelivery: (d: LiveDelivery) => void;
  onReceipt: (r: LivePurchaseInput["receipt"]) => void;
}) {
  const departments = ubigeo[0].departments;
  const departmentNames = departments.map((d) => d.name);
  const provinces = departments.find((d) => d.name === delivery.department)?.provinces || [];
  const districts = provinces.find((p) => p.name === delivery.province)?.districts || [];
  const agencies = availableAgencies(delivery, options);
  const selectedAgency = agencies.find((agency) => agency.agencyId === delivery.agencyId);
  const set = (patch: Partial<LiveDelivery>) => onDelivery({ ...delivery, ...patch });
  return (
    <div className="space-y-4">
      <LiveSearchSelect
        label="Departamento"
        placeholder="Escribe o elige tu departamento"
        options={departmentNames}
        value={delivery.department || ""}
        onChange={(department) =>
          set({
            department,
            province: "",
            district: "",
            agencyId: "",
            agency: "",
            type: "AGENCY",
            courier: "SHALOM",
          })
        }
      />
      <LiveSearchSelect
        label="Provincia"
        placeholder={delivery.department ? "Escribe o elige tu provincia" : "Primero el departamento"}
        options={provinces.map((p) => p.name)}
        value={delivery.province || ""}
        disabled={!delivery.department}
        onChange={(province) => {
          const d = { ...delivery, province, district: "", agencyId: "", agency: "" };
          onDelivery({
            ...d,
            type: isMetro(d) ? "HOME" : "AGENCY",
            courier: isMetro(d) ? "MOTORIZADO" : "SHALOM",
          });
        }}
      />
      <LiveSearchSelect
        label="Distrito"
        placeholder={delivery.province ? "Escribe o elige tu distrito" : "Primero la provincia"}
        options={districts}
        value={delivery.district || ""}
        disabled={!delivery.province}
        onChange={(district) => set({ district, agencyId: "", agency: "" })}
      />
      {delivery.province ? (
        isMetro(delivery) ? (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-[var(--b-ink2)]">¿Cómo lo recibes?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["HOME", "AGENCY"] as const).map((type) => (
                <label
                  key={type}
                  className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] p-3 text-center text-sm font-semibold has-[:checked]:border-[var(--acc)] has-[:checked]:bg-[var(--acc-soft)] has-[:checked]:text-[var(--acc-tx)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--acc)]"
                >
                  <input
                    type="radio"
                    name="delivery"
                    className="sr-only"
                    checked={delivery.type === type}
                    onChange={() =>
                      set({
                        type,
                        courier: type === "HOME" ? "MOTORIZADO" : "SHALOM",
                        agencyId: "",
                        agency: "",
                      })
                    }
                  />
                  {type === "HOME" ? "🛵 A domicilio" : "🏢 Recojo en agencia"}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-xl bg-[var(--b-pur-bg)] p-3 text-sm text-[var(--b-pur)]">
            Para {delivery.department} el envío es a una agencia: eliges el courier y la agencia donde
            recoges.
          </p>
        )
      ) : null}
      {delivery.type === "HOME" ? (
        <>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            Dirección
            <input
              aria-label="Dirección"
              autoComplete="street-address"
              className={purchaseField}
              value={delivery.address || ""}
              maxLength={150}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Calle y número"
            />
          </label>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            Referencia (opcional)
            <input
              className={purchaseField}
              value={delivery.reference || ""}
              maxLength={150}
              onChange={(e) => set({ reference: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[var(--b-line)] px-4 text-sm"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(
                (p) => set({ lat: p.coords.latitude, lng: p.coords.longitude }),
                () => {},
                { timeout: 10000 },
              )
            }
          >
            {delivery.lat ? "✓ Ubicación agregada" : "Agregar mi ubicación (opcional)"}
          </button>
        </>
      ) : (
        <>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            Courier
            <select
              aria-label="Courier"
              className={purchaseField}
              value={delivery.courier || "SHALOM"}
              onChange={(e) =>
                set({
                  courier: e.target.value as "SHALOM" | "OLVA",
                  agencyId: "",
                  agency: "",
                })
              }
            >
              <option value="SHALOM">Shalom</option>
              <option value="OLVA">Olva Courier</option>
            </select>
          </label>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            Agencia
            <select
              aria-label="Agencia"
              className={purchaseField}
              disabled={!delivery.district}
              value={selectedAgency?.agencyId || ""}
              onChange={(e) => {
                const a = agencies.find((a) => a.agencyId === e.target.value);
                set({ agencyId: a?.agencyId || "", agency: a?.agency || "" });
              }}
            >
              <option value="">Elige la agencia</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.agencyId}>
                  {a.agency} · {liveMoney(a.price)}
                </option>
              ))}
            </select>
          </label>
          {selectedAgency ? (
            <p className="text-sm text-[var(--b-mut)]">
              {selectedAgency.address} · {selectedAgency.hours}
            </p>
          ) : delivery.district && !agencies.length ? (
            <p className="text-sm text-[var(--b-warn)]">
              La tienda aún no tiene agencias habilitadas de este courier en este distrito.
            </p>
          ) : null}
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            DNI de quien recoge
            <input
              aria-label="DNI de quien recoge"
              className={purchaseField}
              inputMode="numeric"
              maxLength={8}
              value={delivery.dni || ""}
              onChange={(e) => set({ dni: e.target.value.replace(/\D/g, "") })}
            />
          </label>
        </>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={receipt.type === "FACTURA"}
          onChange={(e) =>
            onReceipt({
              ...receipt,
              type: e.target.checked ? "FACTURA" : "BOLETA",
            })
          }
        />
        {receipt.type === "FACTURA" ? "Factura" : `Boleta a nombre de ${name}`} · ¿Necesitas
        factura?
      </label>
      {receipt.type === "FACTURA" ? (
        <>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            RUC
            <input
              aria-label="RUC"
              className={purchaseField}
              inputMode="numeric"
              maxLength={11}
              value={receipt.ruc || ""}
              onChange={(e) =>
                onReceipt({
                  ...receipt,
                  ruc: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
            Razón social
            <input
              className={purchaseField}
              maxLength={150}
              value={receipt.businessName || ""}
              onChange={(e) => onReceipt({ ...receipt, businessName: e.target.value })}
            />
          </label>
        </>
      ) : total >= 700 && !delivery.dni ? (
        <label className="block text-[13px] font-semibold text-[var(--b-ink2)]">
          DNI para boleta
          <input
            aria-label="DNI para boleta"
            className={purchaseField}
            inputMode="numeric"
            maxLength={8}
            value={receipt.dni || ""}
            onChange={(e) => onReceipt({ ...receipt, dni: e.target.value.replace(/\D/g, "") })}
          />
        </label>
      ) : null}
    </div>
  );
}
