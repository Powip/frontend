import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdvertisingActionDialog } from "../Actions";
import type { AdsRow } from "@/services/advertisingV22Service";
import { adsWrite } from "@/services/advertisingV22Service";

const refresh = jest.fn().mockResolvedValue(undefined);
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: { capabilities: { edit: true } },
  }),
  useRefreshAds: () => refresh,
}));
jest.mock("@/services/advertisingV22Service", () => ({ adsWrite: jest.fn() }));
const row = {
  id: "ad",
  name: "Video real",
  level: "ad",
  accountId: "account",
  effectiveStatus: "ACTIVE",
  budget: { objectId: "set", level: "adset", dailyBudget: "50.00", affectedAds: 4 },
} as AdsRow;
describe("Meta actions require an explicit real mutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: () => "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
    });
  });
  it("does not write before confirmation and targets the budget owner with the actual new amount", async () => {
    (adsWrite as jest.Mock).mockResolvedValue({ status: "succeeded" });
    const close = jest.fn();
    render(
      <AdvertisingActionDialog
        selection={{ rows: [row], action: "scale", canManageAds: true }}
        onClose={close}
      />,
    );
    expect(adsWrite).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nuevo presupuesto diario")).toHaveValue(60);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar en Meta" }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(adsWrite).toHaveBeenCalledWith(
      expect.anything(),
      "post",
      "/meta/v22/actions",
      expect.objectContaining({
        objectId: "set",
        level: "adset",
        budget: "60.00",
        action: "budget",
      }),
    );
  });
  it("rejects a negative budget and keeps provider failures visible", async () => {
    (adsWrite as jest.Mock).mockRejectedValue(new Error("La conexión con Meta venció"));
    const close = jest.fn();
    render(
      <AdvertisingActionDialog
        selection={{ rows: [row], action: "budget", canManageAds: true }}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nuevo presupuesto diario"), {
      target: { value: "-10" },
    });
    expect(screen.getByRole("button", { name: "Confirmar en Meta" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nuevo presupuesto diario"), {
      target: { value: "55" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar en Meta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La conexión con Meta venció");
    expect(close).not.toHaveBeenCalled();
  });
  it.each([false, undefined])("does not submit when Meta management is %s", (canManageAds) => {
    render(
      <AdvertisingActionDialog
        selection={{ rows: [row], action: "pause", canManageAds }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No hay acceso confirmado");
    expect(screen.getByRole("button", { name: "Confirmar en Meta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar en Meta" }));
    expect(adsWrite).not.toHaveBeenCalled();
  });
  it("identifies USD budgets without labelling their input as soles", async () => {
    (adsWrite as jest.Mock).mockResolvedValue({ status: "succeeded" });
    render(
      <AdvertisingActionDialog
        selection={{ rows: [{ ...row, currency: "USD" }], action: "budget", canManageAds: true }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("Nuevo presupuesto diario · USD")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo presupuesto diario S/")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nuevo presupuesto diario"), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar en Meta" }));
    await waitFor(() =>
      expect(adsWrite).toHaveBeenCalledWith(
        expect.anything(),
        "post",
        "/meta/v22/actions",
        expect.objectContaining({ budget: "75.00" }),
      ),
    );
  });
  it("does not apply a single budget to a PEN and USD selection", () => {
    render(
      <AdvertisingActionDialog
        selection={{
          rows: [
            { ...row, currency: "PEN" },
            { ...row, id: "usd", currency: "USD" },
          ],
          action: "budget",
          canManageAds: true,
        }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("una sola moneda");
    expect(screen.getByRole("button", { name: "Confirmar en Meta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar en Meta" }));
    expect(adsWrite).not.toHaveBeenCalled();
  });
});
