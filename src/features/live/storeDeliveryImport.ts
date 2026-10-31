import ubigeo from "@/utils/json/ubigeos.json";
import type { StoreDeliveryOption } from "./types";

const norm = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const price = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100000 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
const sameRegion = (left: string, right: unknown) =>
  norm(left) === norm(right) ||
  (norm(left) === "PROV. CONST. DEL CALLAO" && norm(right) === "CALLAO");

/** Imports explicit merchant prices, never the carrier's wholesale quote or mockup values. */
export function prepareStoreDeliveryImport(
  config: { homeShipping?: unknown; agencyShipping?: unknown },
  raw: unknown,
) {
  const options: StoreDeliveryOption[] = [];
  if (price(config.homeShipping)) {
    for (const department of ubigeo[0].departments) {
      for (const province of department.provinces) {
        if (
          (department.name === "Lima" && province.name === "Lima") ||
          ["Callao", "Prov. Const. del Callao"].includes(department.name)
        )
          options.push({
            id: `home-${norm(department.name)}-${norm(province.name)}`,
            enabled: true,
            type: "HOME",
            courier: "MOTORIZADO",
            department: department.name,
            province: province.name,
            price: config.homeShipping,
          });
      }
    }
  }
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && "data" in raw && Array.isArray(raw.data)
      ? raw.data
      : [];
  let skipped = 0;
  const seen = new Set<string>();
  if (price(config.agencyShipping))
    for (const value of rows) {
      if (!value || typeof value !== "object") {
        skipped++;
        continue;
      }
      const row = value as Record<string, unknown>;
      const department = ubigeo[0].departments.find((d) => sameRegion(d.name, row.departamento));
      const province = department?.provinces.find((p) => sameRegion(p.name, row.provincia));
      const name = typeof row.nombre === "string" ? row.nombre.trim() : "";
      const district = province?.districts.find((d) => norm(d) === norm(name.split("/")[2]));
      const address = typeof row.direccion === "string" ? row.direccion.trim() : "";
      const agencyId = String(row.ter_id ?? "");
      if (
        !department ||
        !province ||
        !district ||
        !/^\d+$/.test(agencyId) ||
        agencyId.length > 100 ||
        seen.has(agencyId) ||
        Number(row.destino) !== 1 ||
        Number(row.ter_habilitado_OS) !== 1 ||
        !name ||
        name.length > 150 ||
        !address ||
        address.length > 250 ||
        options.length >= 1000
      ) {
        skipped++;
        continue;
      }
      seen.add(agencyId);
      const hours =
        typeof row.hora_atencion === "string" && row.hora_atencion.length <= 120
          ? row.hora_atencion
          : undefined;
      options.push({
        id: `shalom-${agencyId}`,
        enabled: true,
        type: "AGENCY",
        courier: "SHALOM",
        department: department.name,
        province: province.name,
        district,
        agencyId,
        agency: name,
        address,
        hours,
        price: config.agencyShipping,
      });
    }
  return { options, skipped };
}
