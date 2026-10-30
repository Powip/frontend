import { toast } from "sonner";
import {
  buildCustomerShippingLabelHtml,
  type CustomerShippingReceipt,
  printCustomerShippingLabel,
} from "../printCustomerShippingLabel";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
const receipt = (mode = "IMEI"): CustomerShippingReceipt => ({
  orderNumber: "ORD-001",
  status: "PENDIENTE",
  unitAssignmentStatus: "CONFIRMED",
  unitCatalogValidated: true,
  stockVersion: 2,
  confirmedStockVersion: 2,
  customer: {
    fullName: "Cliente Uno",
    dni: "12345678",
    phoneNumber: "999111222",
    address: "Jr. Cliente 123",
    province: "Lima",
    city: "Lima",
    district: "Centro",
  },
  items: [
    {
      productName: "Celular azul",
      sku: "PHONE-BLUE",
      quantity: 1,
      attributes: { color: "Azul" },
      trackingMode: mode,
      unitIds: ["00000000-0000-4000-8000-000000000001"],
      units: [
        { id: "00000000-0000-4000-8000-000000000001", code: "001234567890123", status: "RESERVED" },
      ],
    },
  ],
});
const guide = { courierName: "Shalom", shippingOffice: "Agencia Centro" };
const company = {
  name: "Empresa",
  cuit: "20123456789",
  billingAddress: "Av. Remitente 1",
  phone: "912345678",
};
function fakePopup() {
  const written: string[] = [];
  const popup = {
    document: {
      open: jest.fn(),
      write: jest.fn((html: string) => written.push(html)),
      close: jest.fn(),
    },
    focus: jest.fn(),
    print: jest.fn(),
    close: jest.fn(),
    onload: null as (() => void) | null,
    onafterprint: null as (() => void) | null,
    onbeforeunload: null as (() => void) | null,
  };
  popup.document.open.mockImplementation(() => {
    popup.onload = null;
    popup.onafterprint = null;
    popup.onbeforeunload = null;
  });
  jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  return { popup, written };
}
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test("preserves the courier-office address and existing sender layout for NONE without adding products", () => {
  const doc = new DOMParser().parseFromString(
    buildCustomerShippingLabelHtml(receipt("NONE"), guide, company),
    "text/html",
  );
  expect(doc.querySelector(".tracked-products")).toBeNull();
  expect(doc.querySelector(".address-line")?.textContent).toContain("Shalom Agencia Centro");
  expect(doc.querySelector(".courier-name")?.textContent).toContain("SHALOM");
  expect(doc.querySelector(".col-left")?.textContent).toContain("Empresa");
  expect(doc.querySelector(".container")?.textContent).not.toContain("Celular azul");
  const home = new DOMParser().parseFromString(
    buildCustomerShippingLabelHtml(receipt("NONE"), { courierName: "Courier" }, company),
    "text/html",
  );
  expect(home.querySelector(".address-line")?.textContent).toContain("Jr. Cliente 123");
});
test("snapshot labels keep accepted delivery ahead of a previous courier office", () => {
  const data = { ...receipt("NONE"), delivery: { type: "AGENCY" as const, department: "Ancash", province: "Huaraz", district: "Huaraz", address: "Av. Nueva 456", agency: "Shalom Huaraz" } };
  const doc = new DOMParser().parseFromString(buildCustomerShippingLabelHtml(data, guide, company), "text/html");
  expect(doc.body.textContent).toContain("Av. Nueva 456");
  expect(doc.body.textContent).toContain("Shalom Huaraz");
  expect(doc.body.textContent).not.toContain("Agencia Centro");
  expect(doc.body.textContent).not.toContain("Jr. Cliente 123");
});
test("prints complete confirmed leading-zero codes under their product with quantity and attributes", () => {
  const doc = new DOMParser().parseFromString(
    buildCustomerShippingLabelHtml(receipt(), guide, company),
    "text/html",
  );
  const product = doc.querySelector(".tracked-product");
  expect(product?.textContent).toContain("Celular azul");
  expect(product?.textContent).toContain("Cantidad: 1");
  expect(product?.textContent).toContain("SKU: PHONE-BLUE");
  expect(product?.textContent).toContain("color: Azul");
  expect(product?.querySelector(".unit-code")?.textContent).toContain("IMEI: 001234567890123");
});
test.each(["UNKNOWN", "PENDING", "STALE"])(
  "uses an explanation rather than candidate codes for %s",
  (state) => {
    const data = receipt(state === "UNKNOWN" ? "UNKNOWN" : "IMEI");
    if (state === "PENDING") data.unitAssignmentStatus = "PENDING";
    if (state === "STALE") data.confirmedStockVersion = 1;
    const doc = new DOMParser().parseFromString(
      buildCustomerShippingLabelHtml(data, guide, company),
      "text/html",
    );
    expect(doc.querySelector(".tracked-product")?.textContent).toContain(
      "Códigos pendientes de confirmación.",
    );
    expect(doc.body.textContent).not.toContain("001234567890123");
  },
);
test("preserves every full long serial and escapes all user-supplied HTML", () => {
  const data = receipt("SERIAL");
  const long = `0${"S".repeat(99)}`;
  const item = data.items?.[0];
  const unit = item?.units?.[0];
  if (!item || !unit) throw new Error("Expected a product with a serial in the fixture");
  unit.code = long;
  item.productName = '<img src="x" onerror="alert(1)">';
  item.attributes = { "<b>Color</b>": '<script>alert("attr")</script>' };
  data.customer.fullName = '<script>alert("customer")</script>';
  const html = buildCustomerShippingLabelHtml(
    data,
    { courierName: "<script>courier</script>", shippingOffice: '<img src="office">' },
    {
      name: '<img onerror="alert(2)">',
      cuit: "<script>ruc</script>",
      phone: "<b>phone</b>",
      billingAddress: "<script>address</script>",
      logoUrl: 'x" onerror="alert(3)',
    },
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("script")).toBeNull();
  expect(doc.querySelector("[onerror]")).toBeNull();
  expect(doc.querySelector(".unit-code")?.textContent).toBe(`Serie: ${long}`);
  expect(doc.querySelector(".tracked-product")?.textContent).toContain(item.productName);
  expect(doc.body.textContent).toContain(data.customer.fullName);
  expect(html).toContain("overflow-wrap:anywhere");
});
test("waits for popup load, prints the exact builder content once and cleans every callback", async () => {
  const { popup, written } = fakePopup();
  let complete = false;
  const done = printCustomerShippingLabel(receipt(), guide, company).then(() => {
    complete = true;
  });
  await Promise.resolve();
  expect(complete).toBe(false);
  expect(popup.print).not.toHaveBeenCalled();
  expect(written).toEqual([buildCustomerShippingLabelHtml(receipt(), guide, company)]);
  popup.onload?.();
  await done;
  expect(popup.print).toHaveBeenCalledTimes(1);
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(popup.onload).toBeNull();
  expect(popup.onafterprint).toBeNull();
  expect(popup.onbeforeunload).toBeNull();
});
test("aborting while the popup is loading closes it immediately and prevents a saved late onload", async () => {
  const { popup } = fakePopup();
  const controller = new AbortController();
  const done = printCustomerShippingLabel(receipt(), guide, company, { signal: controller.signal });
  const oldLoad = popup.onload;
  controller.abort();
  expect(popup.close).toHaveBeenCalledTimes(1);
  await done;
  oldLoad?.();
  expect(popup.print).not.toHaveBeenCalled();
  expect(popup.onload).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
});
test("a changed scope at load closes without printing even when no signal was supplied", async () => {
  const { popup } = fakePopup();
  let current = true;
  const done = printCustomerShippingLabel(receipt(), guide, company, { isCurrent: () => current });
  current = false;
  popup.onload?.();
  await done;
  expect(popup.print).not.toHaveBeenCalled();
  expect(popup.close).toHaveBeenCalledTimes(1);
});
test("already invalid work never opens a popup and a blocked popup reports the existing error", async () => {
  const open = jest.spyOn(window, "open").mockReturnValue(null);
  await printCustomerShippingLabel(receipt(), guide, company, { isCurrent: () => false });
  expect(open).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  await printCustomerShippingLabel(receipt(), guide, company);
  expect(toast.error).toHaveBeenCalledWith("No se pudo abrir la ventana de impresión");
});
test("print errors close and release listeners before rejecting to the caller", async () => {
  const { popup } = fakePopup();
  popup.print.mockImplementation(() => {
    throw new Error("printer unavailable");
  });
  const done = printCustomerShippingLabel(receipt(), guide, company);
  const check = expect(done).rejects.toThrow("printer unavailable");
  popup.onload?.();
  await check;
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(popup.onload).toBeNull();
});
