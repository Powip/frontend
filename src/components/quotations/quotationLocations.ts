import ubigeos from "@/utils/json/ubigeos.json";

export interface QuotationLocation {
  department: string;
  province: string;
  district: string;
}

const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-PE");
export const quotationDepartments = ubigeos[0].departments;

/** Keep existing data visible while normalizing casing/accents to the normal sale catalog. */
export function quotationLocation(value?: Partial<QuotationLocation> | null): QuotationLocation {
  const department = quotationDepartments.find((item) => normalize(item.name) === normalize(value?.department ?? ""));
  const province = department?.provinces.find((item) => normalize(item.name) === normalize(value?.province ?? ""));
  const district = province?.districts.find((item) => normalize(item) === normalize(value?.district ?? ""));
  return {
    department: department?.name ?? value?.department ?? "",
    province: province?.name ?? value?.province ?? "",
    district: district ?? value?.district ?? "",
  };
}

export function isCompleteQuotationLocation(value: QuotationLocation): boolean {
  const department = quotationDepartments.find((item) => item.name === value.department);
  const province = department?.provinces.find((item) => item.name === value.province);
  return Boolean(province?.districts.includes(value.district));
}

/** Keep the normal metropolitan/province dispatch policy aligned with the API. */
export function quotationSalesRegion(value: Pick<QuotationLocation, "department" | "province">): "LIMA" | "PROVINCIA" {
  return normalize(value.department) === "callao" ||
    (normalize(value.department) === "lima" && normalize(value.province) === "lima")
    ? "LIMA"
    : "PROVINCIA";
}

export function quotationSuggestedZone(value: Pick<QuotationLocation, "department" | "province">): string {
  return value.department && value.province && quotationSalesRegion(value) === "PROVINCIA" ? "PROVINCIAS" : "";
}
