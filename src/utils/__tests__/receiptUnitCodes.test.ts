import {
  getPrintableUnitCodes,
  renderPrintableUnitCodesHtml,
  type PrintableReceiptItem,
  type PrintableReceiptTracking,
} from "../receiptUnitCodes";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture(mode = "IMEI") {
  const item: PrintableReceiptItem = {
    quantity: 2,
    trackingMode: mode,
    unitIds: [id(1), id(2)],
    units: [
      {
        id: id(1),
        code: mode === "IMEI" ? "001234567890123" : "Original/Serie-A",
        status: "RESERVED",
      },
      {
        id: id(2),
        code: mode === "IMEI" ? "001234567890124" : "Original/Serie-B",
        status: "RESERVED",
      },
    ],
  };
  const receipt: PrintableReceiptTracking = {
    status: "PREPARADO",
    unitAssignmentStatus: "CONFIRMED",
    unitCatalogValidated: true,
    stockVersion: 2,
    confirmedStockVersion: 2,
    items: [item],
  };
  return { item, receipt };
}
describe("Confirmed unit codes for every print template", () => {
  it("prints exactly the confirmed selection as text, preserving zeroes and original series", () => {
    for (const mode of ["IMEI", "SERIAL"]) {
      const { receipt, item } = fixture(mode);
      const result = getPrintableUnitCodes(receipt, item);
      expect(result?.codes).toEqual(item.units!.map((u) => u.code));
      expect(result?.label).toBe(mode === "IMEI" ? "IMEI" : "Serie");
      expect(item.units![0].status).toBe("RESERVED");
    }
  });
  it.each([undefined, "NONE"])(
    "keeps ordinary quantity line rendering unchanged (%s)",
    (mode) => {
      const item = { quantity: 3, trackingMode: mode };
      expect(getPrintableUnitCodes({}, item)).toBeNull();
      expect(renderPrintableUnitCodesHtml({}, item)).toBe("");
    },
  );
  it("never interprets stray identifiers in an explicit NONE line", () => {
    const { item, receipt } = fixture("NONE");
    expect(getPrintableUnitCodes(receipt, item)).toBeNull();
  });
  it.each(["PENDING_SELECTION", "PENDING", "REJECTED", "NONE", undefined])(
    "never prints requested or old codes under %s",
    (state) => {
      const { item, receipt } = fixture();
      receipt.unitAssignmentStatus = state;
      expect(getPrintableUnitCodes(receipt, item)).toMatchObject({
        codes: [],
        notice: expect.any(String),
      });
      expect(renderPrintableUnitCodesHtml(receipt, item)).not.toContain(
        item.units![0].code,
      );
    },
  );
  it.each([
    { stockVersion: 3 },
    { stockVersion: undefined },
    { stockVersion: 0 },
    { confirmedStockVersion: null },
    { unitCatalogValidated: false },
  ])("requires confirmation of the current version %p", (patch) => {
    const { item, receipt } = fixture();
    expect(
      getPrintableUnitCodes({ ...receipt, ...patch }, item)?.codes,
    ).toEqual([]);
  });
  it.each(["UNKNOWN", undefined])(
    "does not infer a mode from a code when policy is %s",
    (mode) => {
      const { item, receipt } = fixture();
      item.trackingMode = mode;
      expect(getPrintableUnitCodes(receipt, item)?.codes).toEqual([]);
    },
  );
  it.each([
    [
      "quantity",
      (i: PrintableReceiptItem) => {
        i.quantity = 3;
      },
    ],
    [
      "fraction",
      (i: PrintableReceiptItem) => {
        i.quantity = 1.5;
      },
    ],
    [
      "ids",
      (i: PrintableReceiptItem) => {
        i.unitIds = [];
      },
    ],
    [
      "foreign code owner",
      (i: PrintableReceiptItem) => {
        i.units![0].id = id(99);
      },
    ],
    [
      "duplicate unit",
      (i: PrintableReceiptItem) => {
        i.units![1] = { ...i.units![0] };
      },
    ],
    [
      "duplicate code",
      (i: PrintableReceiptItem) => {
        i.units![1].code = i.units![0].code;
      },
    ],
    [
      "numeric code",
      (i: PrintableReceiptItem) => {
        i.units![0].code = 123 as any;
      },
    ],
    [
      "invalid IMEI",
      (i: PrintableReceiptItem) => {
        i.units![0].code = "123";
      },
    ],
    [
      "wrong status",
      (i: PrintableReceiptItem) => {
        i.units![0].status = "SOLD";
      },
    ],
    [
      "script",
      (i: PrintableReceiptItem) => {
        i.units![0].code = "<script>alert(1)</script>";
      },
    ],
  ])("does not expose an incomplete or invalid line: %s", (_name, change) => {
    const { receipt, item } = fixture();
    change(item);
    expect(getPrintableUnitCodes(receipt, item)?.codes).toEqual([]);
  });
  it("rejects duplicate identities across packs, gifts and other receipt lines", () => {
    const { receipt, item } = fixture();
    receipt.items = [
      item,
      { ...item, units: item.units!.map((u) => ({ ...u })) },
    ];
    expect(getPrintableUnitCodes(receipt, item)?.codes).toEqual([]);
  });
  it("validates normalized codes across lines without changing their original case", () => {
    const { receipt, item } = fixture("SERIAL");
    const other = {
      quantity: 1,
      trackingMode: "SERIAL",
      unitIds: [id(3)],
      units: [{ id: id(3), code: "original/serie-a", status: "RESERVED" }],
    };
    receipt.items = [item, other];
    expect(getPrintableUnitCodes(receipt, item)?.codes).toEqual([]);
  });
  it("prints a delivered snapshot only as sold, and a cancelled snapshot explicitly as historical", () => {
    const { receipt, item } = fixture();
    receipt.status = "ENTREGADO";
    item.units!.forEach((u) => (u.status = "SOLD"));
    expect(getPrintableUnitCodes(receipt, item)?.codes).toHaveLength(2);
    receipt.status = "ANULADO";
    expect(getPrintableUnitCodes(receipt, item)?.codes).toHaveLength(0);
    item.units!.forEach((u) => (u.status = "AVAILABLE"));
    expect(getPrintableUnitCodes(receipt, item)).toMatchObject({
      codes: item.units!.map((u) => u.code),
      notice: "Referencia histórica de la venta anulada.",
    });
  });
  it("retains all long codes with wrapping instead of ellipsis, and never changes the receipt", () => {
    const { receipt, item } = fixture("SERIAL");
    item.units![0].code = "A".repeat(100);
    const before = JSON.stringify(receipt);
    const html = renderPrintableUnitCodesHtml(receipt, item);
    expect(html).toContain("A".repeat(100));
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).not.toContain("text-overflow");
    expect(JSON.stringify(receipt)).toBe(before);
  });
});
