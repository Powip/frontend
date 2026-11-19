import { AxiosError, AxiosHeaders } from "axios";
import {
  apiErrorInfo,
  buildProductPatch,
  buildVariantPatch,
  duplicateSkuKeys,
  isEmptyPatch,
  skuKey,
  type ProductGeneralForm,
} from "../catalogPayloads";

const BASE: ProductGeneralForm = {
  name: "Polo básico", description: "", companySku: "POL0001", brandId: "nike", categoryId: "pol",
  purchaseUnit: "", purchaseFactor: "1", imageUrl: "https://img/a.png",
};

const axiosError = (status: number, message: unknown) =>
  new AxiosError("fail", "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

describe("catalogPayloads (FEAT-24 H4)", () => {
  it("compara SKU como el índice del servidor y detecta repetidos en el formulario", () => {
    expect(skuKey(" pol-1 ")).toBe("POL-1");
    expect([...duplicateSkuKeys(["A-1", "a-1 ", "", null, "B"])]).toEqual(["A-1"]);
  });

  it("sin cambios no manda nada", () => {
    const { patch, errors } = buildProductPatch(BASE, { ...BASE });
    expect(errors).toEqual([]);
    expect(isEmptyPatch(patch)).toBe(true);
  });

  it("manda solo lo que cambió y con null para quitar", () => {
    const { patch } = buildProductPatch(BASE, {
      ...BASE, name: " Polo  premium ", companySku: "", brandId: "", categoryId: "ropa", purchaseUnit: " Caja ", purchaseFactor: "12", imageUrl: "",
    });
    expect(patch).toEqual({ name: "Polo premium", companySku: null, brandId: null, categoryId: "ropa", purchaseUnit: "Caja", purchaseFactor: 12, imageUrl: null });
  });

  it("valida nombre, largo del SKU, unidad y factor", () => {
    expect(buildProductPatch(BASE, { ...BASE, name: "ab" }).errors).toEqual(["El nombre debe tener entre 3 y 100 caracteres."]);
    expect(buildProductPatch(BASE, { ...BASE, companySku: "X".repeat(51) }).errors[0]).toMatch(/SKU base tiene más de 50/);
    expect(buildProductPatch(BASE, { ...BASE, purchaseFactor: "0" }).errors[0]).toMatch(/factor de compra/);
    expect(buildProductPatch(BASE, { ...BASE, purchaseFactor: "2.5" }).errors[0]).toMatch(/factor de compra/);
    expect(buildProductPatch(BASE, { ...BASE, purchaseFactor: "" }).patch).toEqual({});
    const withErrors = buildProductPatch(BASE, { ...BASE, name: "x", categoryId: "otra" });
    expect(withErrors.patch).toEqual({});
  });

  it("variante: SKU y código de barras, solo si cambiaron", () => {
    expect(buildVariantPatch({ companySku: "A", barcode: "" }, { companySku: " A ", barcode: "" }).patch).toEqual({});
    expect(buildVariantPatch({ companySku: "A", barcode: "" }, { companySku: "B", barcode: " 775 0001 " }).patch).toEqual({ companySku: "B", barcode: "7750001" });
    expect(buildVariantPatch({ companySku: "A", barcode: "123" }, { companySku: "", barcode: "" }).patch).toEqual({ companySku: null, barcode: null });
    expect(buildVariantPatch({ companySku: "", barcode: "" }, { companySku: "X".repeat(61), barcode: "" }).errors[0]).toMatch(/más de 60/);
  });

  it("lee el 409 y el 400 del servidor", () => {
    expect(apiErrorInfo(axiosError(409, "El SKU POL-1 ya existe en tu empresa (producto «Polo»)"), "No se pudo")).toEqual({
      status: 409, conflict: true, message: "El SKU POL-1 ya existe en tu empresa (producto «Polo»)",
    });
    expect(apiErrorInfo(axiosError(400, ["name must be a string", "otro"]), "No se pudo")).toEqual({ status: 400, conflict: false, message: "name must be a string otro" });
    expect(apiErrorInfo(axiosError(500, undefined), "No se pudo guardar")).toMatchObject({ message: "No se pudo guardar" });
    expect(apiErrorInfo(new Error("red caída"), "x")).toEqual({ message: "red caída", conflict: false });
    expect(apiErrorInfo("raro", "x")).toEqual({ message: "x", conflict: false });
  });
});
