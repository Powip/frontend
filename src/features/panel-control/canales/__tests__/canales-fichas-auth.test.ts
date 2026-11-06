import axiosAuth from "@/lib/axiosAuth";
import { canalesFichasRealSource } from "../sources/canales-fichas.source";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockGet = jest.mocked(axiosAuth.get);

describe("canalesFichasRealSource", () => {
  beforeEach(() => mockGet.mockReset());

  it("pide /config/canales con axiosAuth (el endpoint exige token: sin él responde 401)", async () => {
    mockGet.mockResolvedValue({ data: [] });

    await canalesFichasRealSource.fetch({ empresaId: "emp-1" } as never);

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockGet.mock.calls[0];
    expect(url).toMatch(/\/config\/canales$/);
    expect(config).toEqual({ params: { empresaId: "emp-1" } });
  });
});
