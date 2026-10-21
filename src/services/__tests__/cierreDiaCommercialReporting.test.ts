import { getCierreDiaClosingData } from "../cierreDiaProductosService";
import { getPedidosCC, getUpsellRecords } from "../atencionClienteService";
jest.mock("../atencionClienteService", () => ({
  getPedidosCC: jest.fn(),
  getUpsellRecords: jest.fn(),
}));
const getOrders = jest.mocked(getPedidosCC);
const base = {
  id: "order",
  orderNumber: "order",
  commercialStage: "SALE",
  currency: "PEN",
  status: "PENDIENTE",
  grandTotal: "100.00",
  created_at: "2026-09-01T05:00:00Z",
  updated_at: "2026-11-01T05:00:00Z",
  items: [],
  commercialLead: {
    receivedAt: "2026-10-01T05:00:00Z",
    confirmedAt: "2026-10-03T05:00:00Z",
    confirmationBasis: "SELLER",
  },
};
const start = "2026-10-01T05:00:00Z",
  end = "2026-11-01T04:59:59.999Z";
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUpsellRecords).mockResolvedValue({ items: [] } as any);
  getOrders.mockResolvedValue({ data: [base], totalPages: 1 } as any);
});
it("uses real acquisition and first seller confirmation, independent of last order edit", async () => {
  const data = await getCierreDiaClosingData("store", start, end);
  expect(getOrders).toHaveBeenCalledWith(
    expect.objectContaining({
      dateBasis: "COMMERCIAL_EVENTS",
      startDate: start,
      endDate: end,
    }),
  );
  expect(data.byDay.find((row) => row.date === "2026-10-01")).toMatchObject({
    pedidosIngresados: 1,
    ingreso: 0,
  });
  expect(data.byDay.find((row) => row.date === "2026-10-03")).toMatchObject({
    confirmado: 1,
    ingreso: 100,
  });
  expect(data.byDay.some((row) => row.date === "2026-11-01")).toBe(false);
});
it("does not infer a sale from an imported operative state/payment or count prepaid web as a seller closure", async () => {
  getOrders.mockResolvedValue({
    data: [
      {
        ...base,
        id: "lead",
        commercialStage: "LEAD",
        status: "ENTREGADO",
        grandTotal: "99999",
        commercialLead: {
          receivedAt: "2026-10-01T05:00:00Z",
          confirmedAt: null,
          confirmationBasis: null,
        },
      },
      {
        ...base,
        id: "web",
        commercialLead: {
          ...base.commercialLead,
          confirmationBasis: "WEB_PREPAID",
        },
      },
      {
        ...base,
        id: "unknown-date",
        commercialLead: { ...base.commercialLead, confirmedAt: null },
      },
    ],
    totalPages: 1,
  } as any);
  const data = await getCierreDiaClosingData("store", start, end);
  expect(data.upsellSummary.pedidosConfirmados).toBe(0);
  expect(data.byDay.reduce((sum, row) => sum + row.ingreso, 0)).toBe(0);
  expect(
    data.byDay.find((row) => row.date === "2026-10-01")?.porConfirmar,
  ).toBe(1);
});
it.each(["USD", null])(
  "blocks live PEN autofill for %s without rewriting saved closings or assigning NULL to PEN",
  async (currency) => {
    getOrders.mockResolvedValue({
      data: [{ ...base, currency }],
      totalPages: 1,
    } as any);
    await expect(getCierreDiaClosingData("store", start, end)).rejects.toThrow(
      "Los cierres guardados se conservan como históricos",
    );
  },
);
it("does not move an out-of-period first confirmation into a later edit period", async () => {
  const data = await getCierreDiaClosingData(
    "store",
    "2026-11-01T05:00:00Z",
    "2026-12-01T04:59:59.999Z",
  );
  expect(data.byDay).toEqual([]);
  expect(data.upsellSummary.pedidosConfirmados).toBe(0);
});
