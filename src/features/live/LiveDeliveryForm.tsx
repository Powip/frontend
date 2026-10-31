"use client";
import ubigeo from "@/utils/json/ubigeos.json";
import type { LiveDelivery, LivePurchaseInput, StoreDeliveryOption } from "./types";
import { liveMoney } from "./liveService";
export const purchaseField =
  "mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-sm text-white focus:outline-emerald-300";
const norm = (s = "") =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
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
  const provinces = departments.find((d) => d.name === delivery.department)?.provinces || [];
  const districts = provinces.find((p) => p.name === delivery.province)?.districts || [];
  const agencies = options.filter(
    (o) =>
      o.enabled &&
      o.type === "AGENCY" &&
      norm(o.department) === norm(delivery.department) &&
      norm(o.province) === norm(delivery.province) &&
      o.courier === delivery.courier,
  );
  const set = (patch: Partial<LiveDelivery>) => onDelivery({ ...delivery, ...patch });
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Departamento
        <select
          aria-label="Departamento"
          className={purchaseField}
          value={delivery.department || ""}
          onChange={(e) =>
            set({
              department: e.target.value,
              province: "",
              district: "",
              agencyId: "",
              agency: "",
              type: "AGENCY",
            })
          }
        >
          <option value="">Elige tu departamento</option>
          {departments.map((d) => (
            <option key={d.name}>{d.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Provincia
        <select
          aria-label="Provincia"
          className={purchaseField}
          disabled={!delivery.department}
          value={delivery.province || ""}
          onChange={(e) => {
            const d = {
              ...delivery,
              province: e.target.value,
              district: "",
              agencyId: "",
              agency: "",
            };
            onDelivery({
              ...d,
              type: isMetro(d) ? "HOME" : "AGENCY",
              courier: isMetro(d) ? "MOTORIZADO" : "SHALOM",
            });
          }}
        >
          <option value="">Elige tu provincia</option>
          {provinces.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Distrito
        <select
          aria-label="Distrito"
          className={purchaseField}
          disabled={!delivery.province}
          value={delivery.district || ""}
          onChange={(e) => set({ district: e.target.value })}
        >
          <option value="">Elige tu distrito</option>
          {districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      {delivery.province ? (
        isMetro(delivery) ? (
          <fieldset className="flex gap-3">
            <legend className="mb-2 text-sm">¿Cómo lo recibes?</legend>
            {(["HOME", "AGENCY"] as const).map((type) => (
              <label
                key={type}
                className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-white/20 p-3 text-sm"
              >
                <input
                  type="radio"
                  name="delivery"
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
                {type === "HOME" ? "A domicilio" : "Recojo en agencia"}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="rounded-xl bg-blue-400/10 p-3 text-sm text-blue-100">
            A esta provincia enviamos a una agencia.
          </p>
        )
      ) : null}
      {delivery.type === "HOME" ? (
        <>
          <label className="block text-sm">
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
          <label className="block text-sm">
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
            className="min-h-11 rounded-xl border border-white/20 px-4 text-sm"
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
          <label className="block text-sm">
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
          <label className="block text-sm">
            Agencia
            <select
              aria-label="Agencia"
              className={purchaseField}
              disabled={!delivery.province}
              value={delivery.agencyId || ""}
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
          {agencies.find((a) => a.agencyId === delivery.agencyId) ? (
            <p className="text-sm text-slate-300">
              {agencies.find((a) => a.agencyId === delivery.agencyId)?.address} ·{" "}
              {agencies.find((a) => a.agencyId === delivery.agencyId)?.hours}
            </p>
          ) : delivery.province && !agencies.length ? (
            <p className="text-sm text-amber-200">
              La tienda aún no tiene agencias habilitadas de este courier en esta provincia.
            </p>
          ) : null}
          <label className="block text-sm">
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
          <label className="block text-sm">
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
          <label className="block text-sm">
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
        <label className="block text-sm">
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
