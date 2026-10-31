"use client";
import { useState } from "react";
import axiosAuth from "@/lib/axiosAuth";
import ubigeo from "@/utils/json/ubigeos.json";
import { liveError, liveMoney } from "@/features/live/liveService";
import type { StoreDeliveryOption } from "@/features/live/types";
import { Button } from "@/components/ui/button";
const field = "min-h-11 w-full rounded-xl border bg-background p-3 text-sm";
export default function StoreDeliverySettings({
  storeId,
  initial,
  onSaved,
}: {
  storeId: string;
  initial: StoreDeliveryOption[];
  onSaved: () => void;
}) {
  const [options, setOptions] = useState(initial),
    [draft, setDraft] = useState<StoreDeliveryOption>({
      id: "",
      enabled: true,
      type: "HOME",
      courier: "MOTORIZADO",
      department: "",
      province: "",
      price: Number.NaN,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const provinces = ubigeo[0].departments.find((d) => d.name === draft.department)?.provinces || [];
  const homeAllowed =
    (draft.department === "Lima" && draft.province === "Lima") ||
    ["Callao", "Prov. Const. del Callao"].includes(draft.department || "");
  const valid =
    (draft.type !== "HOME" || homeAllowed) &&
    !!draft.department &&
    !!draft.province &&
    Number.isFinite(draft.price) &&
    draft.price >= 0 &&
    (draft.type === "HOME" ||
      (!!draft.agency && !!draft.agencyId && !!draft.address && !!draft.district));
  const set = (patch: Partial<StoreDeliveryOption>) => setDraft((d) => ({ ...d, ...patch }));
  async function save(next: StoreDeliveryOption[]) {
    setBusy(true);
    setError("");
    try {
      await axiosAuth.patch(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/stores/${encodeURIComponent(storeId)}`,
        { deliverySettings: { options: next } },
      );
      setOptions(next);
      onSaved();
    } catch (e) {
      setError(liveError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Envíos y coberturas de la tienda</h2>
      <p className="text-sm text-muted-foreground">
        Estas tarifas se usan en el catálogo Live y WhatsApp. Registra el importe final que cobras
        al cliente y las agencias que atiendes.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="divide-y">
        {options.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-semibold">
                {o.type === "HOME" ? "Domicilio" : `${o.courier} · ${o.agency}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.department} / {o.province}
                {o.district ? ` / ${o.district}` : ""} · {liveMoney(o.price)}
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={o.enabled}
                disabled={busy}
                onChange={(e) =>
                  void save(
                    options.map((item) =>
                      item.id === o.id ? { ...item, enabled: e.target.checked } : item,
                    ),
                  )
                }
              />
              Habilitado
            </label>
            <Button variant="outline" disabled={busy} onClick={() => setDraft(o)}>
              Editar
            </Button>
          </div>
        ))}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const row = { ...draft, id: draft.id || crypto.randomUUID() };
          setDraft(row);
          void save([...options.filter((o) => o.id !== row.id), row]);
        }}
      >
        <label className="grid gap-1 text-sm">
          Entrega
          <select
            className={field}
            value={draft.type}
            onChange={(e) =>
              set({
                type: e.target.value as "HOME" | "AGENCY",
                courier: e.target.value === "HOME" ? "MOTORIZADO" : "SHALOM",
              })
            }
          >
            <option value="HOME">A domicilio</option>
            <option value="AGENCY">Recojo en agencia</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Courier
          <select
            className={field}
            value={draft.courier}
            disabled={draft.type === "HOME"}
            onChange={(e) => set({ courier: e.target.value as "SHALOM" | "OLVA" })}
          >
            {draft.type === "HOME" ? (
              <option value="MOTORIZADO">Motorizado</option>
            ) : (
              <>
                <option value="SHALOM">Shalom</option>
                <option value="OLVA">Olva Courier</option>
              </>
            )}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Departamento
          <select
            className={field}
            value={draft.department}
            onChange={(e) => set({ department: e.target.value, province: "", district: "" })}
          >
            <option value="">Selecciona</option>
            {ubigeo[0].departments.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Provincia
          <select
            className={field}
            value={draft.province}
            onChange={(e) => set({ province: e.target.value, district: "" })}
          >
            <option value="">Selecciona</option>
            {provinces.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Distrito
          <select
            className={field}
            value={draft.district || ""}
            onChange={(e) => set({ district: e.target.value || undefined })}
          >
            <option value="">
              {draft.type === "HOME" ? "Toda la provincia" : "Selecciona distrito"}
            </option>
            {provinces
              .find((p) => p.name === draft.province)
              ?.districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tarifa al cliente (S/)
          <input
            className={field}
            type="number"
            placeholder="Sin configurar"
            step="0.01"
            min="0"
            max="100000"
            required
            value={Number.isFinite(draft.price) ? draft.price : ""}
            onChange={(e) =>
              set({ price: e.target.value === "" ? Number.NaN : Number(e.target.value) })
            }
          />
        </label>
        {draft.type === "AGENCY" ? (
          <>
            {(
              [
                ["agencyId", "Código de agencia"],
                ["agency", "Nombre de la agencia"],
                ["address", "Dirección de la agencia"],
                ["hours", "Horario (opcional)"],
              ] as const
            ).map(([key, label]) => (
              <label className="grid gap-1 text-sm" key={key}>
                {label}
                <input
                  className={field}
                  value={draft[key] || ""}
                  maxLength={key === "address" ? 250 : 100}
                  required={key !== "hours"}
                  onChange={(e) => set({ [key]: e.target.value })}
                />
              </label>
            ))}
          </>
        ) : null}
        <Button type="submit" disabled={busy || !valid}>
          {busy ? "Guardando…" : draft.id ? "Guardar cobertura" : "Agregar cobertura"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraft({
              id: "",
              enabled: true,
              type: "HOME",
              courier: "MOTORIZADO",
              department: "",
              province: "",
              price: Number.NaN,
            })
          }
        >
          Nueva cobertura
        </Button>
      </form>
    </section>
  );
}
