import axios from "axios";
import { createShrinkage, getShrinkageList, getShrinkageSummary } from "../Admin";

jest.mock("axios");
const mockedGet = axios.get as jest.Mock;
const mockedPost = axios.post as jest.Mock;

// FEAT-24 SEC: las mermas van por la fachada con JWT de ms-products; la empresa y el autor salen del token.
describe("mermas por la fachada de ms-products", () => {
  beforeEach(() => {
    mockedGet.mockReset().mockResolvedValue({ data: [] });
    mockedPost.mockReset().mockResolvedValue({ data: { id: "m1" } });
  });

  it("lista y resumen: /inventory-shrinkage sin la empresa en la URL, con el token y el periodo", async () => {
    await getShrinkageList("company-1", "2026-11-01", "2026-11-30", "jwt");
    await getShrinkageSummary("company-1", "2026-11-01", "2026-11-30", "jwt");

    expect(mockedGet.mock.calls[0][0]).toMatch(/\/inventory-shrinkage$/);
    expect(mockedGet.mock.calls[1][0]).toMatch(/\/inventory-shrinkage\/summary$/);
    for (const [url, config] of mockedGet.mock.calls) {
      expect(url).not.toContain("company-1");
      expect(config).toEqual({
        params: { fromDate: "2026-11-01", toDate: "2026-11-30" },
        headers: { Authorization: "Bearer jwt" },
      });
    }
  });

  it("registrar: POST /inventory-shrinkage sin companyId ni createdBy en el cuerpo", async () => {
    await createShrinkage(
      "company-1",
      { shrinkageType: "otro", quantity: 2, unitCost: 5, recoveredAmount: 0, notes: "caja rota", createdBy: "x@y.pe" },
      "jwt",
    );

    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toMatch(/\/inventory-shrinkage$/);
    expect(url).not.toContain("company-1");
    expect(body).toEqual({ shrinkageType: "otro", quantity: 2, unitCost: 5, recoveredAmount: 0, notes: "caja rota" });
    expect(config).toEqual({ headers: { Authorization: "Bearer jwt" } });
  });
});
