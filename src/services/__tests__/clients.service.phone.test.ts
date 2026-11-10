import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { fetchClientByPhone } from "../clients.service";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/lib/gateway", () => ({ GATEWAY: { ventas: "https://gateway.test/ventas" } }));

const get = jest.mocked(axiosAuth.get);

const clientRow = {
  id: "client-1",
  companyId: "company-1",
  fullName: "Clienta",
  phoneNumber: "+5491123456789",
  clientType: "TRADICIONAL",
};

beforeEach(() => get.mockReset());

/**
 * B2 · la búsqueda por teléfono manda el número en la ruta. Un extranjero lleva "+" (y puede
 * llevar espacios o paréntesis si se pegó tal cual): debe ir codificado para que el backend lo
 * reciba íntegro.
 */
describe("fetchClientByPhone · teléfonos internacionales", () => {
  it.each([
    ["+5491123456789", "%2B5491123456789"],
    ["+1 (415) 555-2671", "%2B1%20(415)%20555-2671"],
    ["+34612345678", "%2B34612345678"],
  ])("codifica %s en la ruta", async (phone, encoded) => {
    get.mockResolvedValueOnce({ data: clientRow });
    await fetchClientByPhone("company-1", phone);
    expect(get).toHaveBeenCalledWith(`https://gateway.test/ventas/clients/company/company-1/phone/${encoded}`);
  });

  it("un celular peruano de 9 dígitos va igual que antes", async () => {
    get.mockResolvedValueOnce({ data: clientRow });
    await fetchClientByPhone("company-1", "999888777");
    expect(get).toHaveBeenCalledWith("https://gateway.test/ventas/clients/company/company-1/phone/999888777");
  });

  it("devuelve el cliente encontrado", async () => {
    get.mockResolvedValueOnce({ data: clientRow });
    await expect(fetchClientByPhone("company-1", "+5491123456789")).resolves.toMatchObject({
      id: "client-1",
      phoneNumber: "+5491123456789",
    });
  });

  it("un 404 significa cliente no registrado", async () => {
    const notFound = Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } });
    jest.spyOn(axios, "isAxiosError").mockReturnValueOnce(true);
    get.mockRejectedValueOnce(notFound);
    await expect(fetchClientByPhone("company-1", "+5491123456789")).resolves.toBeNull();
  });
});
