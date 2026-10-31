import { prepareStoreDeliveryImport } from "../storeDeliveryImport";
const agency = {
  ter_id: 1, nombre: "LIMA / LIMA / MIRAFLORES / MIRAFLORES", departamento: "LIMA", provincia: "LIMA",
  direccion: "Av. Ejemplo 123", hora_atencion: "Lun–Vie", destino: 1, ter_habilitado_OS: 1,
};
describe("import existing merchant delivery settings", () => {
  it("preserves real store prices and maps provider geography to canonical names", () => {
    const result = prepareStoreDeliveryImport({ homeShipping: 10, agencyShipping: 10 }, { data: [agency] });
    expect(result.options.filter(o => o.type === "HOME")).toHaveLength(2);
    expect(result.options.every(o => o.price === 10)).toBe(true);
    expect(result.options.find(o => o.type === "AGENCY")).toMatchObject({ agencyId: "1", district: "Miraflores", province: "Lima", department: "Lima", courier: "SHALOM" });
  });
  it("keeps explicit free delivery but does not invent missing tariffs", () => {
    expect(prepareStoreDeliveryImport({ homeShipping: 0, agencyShipping: null }, [agency]).options).toHaveLength(2);
    expect(prepareStoreDeliveryImport({}, [agency]).options).toEqual([]);
  });
  it.each([-1, "10", Number.NaN, 10.001])("rejects an invalid configured tariff %s", value => {
    expect(prepareStoreDeliveryImport({ homeShipping: value, agencyShipping: value }, [agency]).options).toEqual([]);
  });
  it("omits disabled, unknown, incomplete and duplicate agencies", () => {
    const result = prepareStoreDeliveryImport({ agencyShipping: 10 }, [agency, { ...agency, destino: 0 }, { ...agency, ter_id: 2, nombre: "LIMA / LIMA / UNKNOWN" }, { ...agency, ter_id: 3, direccion: "" }, agency]);
    expect(result.options).toHaveLength(1);
    expect(result.skipped).toBe(4);
    expect(result.options.some(o => o.courier === "OLVA")).toBe(false);
  });
});
