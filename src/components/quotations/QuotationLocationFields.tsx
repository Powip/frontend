import { quotationDepartments, type QuotationLocation } from "./quotationLocations";

export default function QuotationLocationFields({
  value,
  onChange,
  idPrefix,
  disabled = false,
  labelSuffix = "",
  className = "mt-1.5 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
}: {
  value: QuotationLocation;
  onChange: (value: QuotationLocation) => void;
  idPrefix: string;
  disabled?: boolean;
  labelSuffix?: string;
  className?: string;
}) {
  const department = quotationDepartments.find((item) => item.name === value.department);
  const provinces = department?.provinces ?? [];
  const districts = provinces.find((item) => item.name === value.province)?.districts ?? [];
  const fields = [
    { key: "department", label: "Departamento", options: quotationDepartments.map((item) => item.name), disabled },
    { key: "province", label: "Provincia", options: provinces.map((item) => item.name), disabled: disabled || !department },
    { key: "district", label: "Distrito", options: districts, disabled: disabled || !districts.length },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {fields.map(({ key, label, options, disabled: fieldDisabled }) => (
        <div key={key} className="min-w-0 text-sm">
          <label htmlFor={`${idPrefix}-${key}`} className="block font-semibold">{label}{labelSuffix}</label>
          <select
            id={`${idPrefix}-${key}`}
            className={className}
            required
            disabled={fieldDisabled}
            value={value[key]}
            onChange={(event) => {
              const next = event.target.value;
              onChange(key === "department"
                ? { department: next, province: "", district: "" }
                : key === "province"
                  ? { ...value, province: next, district: "" }
                  : { ...value, district: next });
            }}
          >
            <option value="">Selecciona {label.toLocaleLowerCase("es-PE")}</option>
            {value[key] && !options.includes(value[key]) && (
              <option value={value[key]} disabled>{value[key]} (revisar)</option>
            )}
            {options.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
