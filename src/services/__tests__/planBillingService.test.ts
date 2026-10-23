import axiosAuth from "@/lib/axiosAuth";
import { billingErrorMessage, cancelSubscription, removeAddOn, undoPlanChange } from "../planBillingService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

describe("planBillingService", () => {
  beforeEach(() => jest.mocked(axiosAuth.delete).mockResolvedValue({ data: {} }));

  it("usa las rutas del contrato bajo /subscriptions/billing", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
    await undoPlanChange();
    await removeAddOn("a1");
    await cancelSubscription();
    expect(axiosAuth.delete).toHaveBeenCalledWith(expect.stringMatching(/\/subscriptions\/billing\/change-plan$/));
    expect(axiosAuth.delete).toHaveBeenCalledWith(expect.stringMatching(/\/subscriptions\/billing\/add-ons\/a1$/));
    expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/subscriptions\/billing\/cancel$/));
  });

  it("traduce el code del backend y tiene un mensaje por defecto", () => {
    const err = { isAxiosError: true, response: { data: { code: "PENDING_INVOICE" } } };
    expect(billingErrorMessage(err)).toMatch(/cobro pendiente/);
    expect(billingErrorMessage(new Error("x"))).toMatch(/No se pudo completar/);
  });
});
