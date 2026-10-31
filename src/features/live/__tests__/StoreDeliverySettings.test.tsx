import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StoreDeliverySettings from "@/components/forms/StoreDeliverySettings";
import axiosAuth from "@/lib/axiosAuth";
import { getLiveConsole } from "../liveService";
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock("../liveService", () => ({ getLiveConsole: jest.fn(), liveError: (e: Error) => e.message, liveMoney: (v: number) => `S/ ${v.toFixed(2)}` }));
const agency = { ter_id: 1, nombre: "LIMA / LIMA / MIRAFLORES / MIRAFLORES", departamento: "LIMA", provincia: "LIMA", direccion: "Av. Ejemplo 123", destino: 1, ter_habilitado_OS: 1 };
beforeEach(() => { jest.clearAllMocks(); (getLiveConsole as jest.Mock).mockResolvedValue({ config: { homeShipping: 10, agencyShipping: 10 } }); (axiosAuth.get as jest.Mock).mockResolvedValue({ data: { data: [agency] } }); (axiosAuth.patch as jest.Mock).mockResolvedValue({}); });
it("reviews current merchant prices before saving central coverage", async () => {
  const onSaved = jest.fn();
  render(<StoreDeliverySettings storeId="store-a" initial={[]} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Recuperar tarifas actuales de Live" }));
  expect(await screen.findByText("Domicilio: S/ 10.00 · Shalom: S/ 10.00")).toBeInTheDocument();
  expect(getLiveConsole).toHaveBeenCalledWith("store-a");
  expect(axiosAuth.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar coberturas importadas" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(axiosAuth.patch).toHaveBeenCalledWith(expect.stringContaining("/stores/store-a"), { deliverySettings: { options: expect.arrayContaining([expect.objectContaining({ price: 10, courier: "SHALOM", agencyId: "1" })]) } });
});
it("does not replace an existing store coverage configuration", () => {
  render(<StoreDeliverySettings storeId="store-a" initial={[{ id: "home", enabled: true, type: "HOME", courier: "MOTORIZADO", department: "Lima", province: "Lima", price: 15 }]} onSaved={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Recuperar tarifas actuales de Live" })).not.toBeInTheDocument();
  expect(axiosAuth.get).not.toHaveBeenCalled();
});
it("does not import fallback prices or agencies after a provider failure", async () => {
  (axiosAuth.get as jest.Mock).mockRejectedValue(new Error("Servicio de agencias no disponible"));
  render(<StoreDeliverySettings storeId="store-a" initial={[]} onSaved={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Recuperar tarifas actuales de Live" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Servicio de agencias no disponible");
  expect(screen.queryByRole("button", { name: "Guardar coberturas importadas" })).not.toBeInTheDocument();
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});
