/**
 * @jest-environment node
 *
 * Tests: GET /api/superadmin/shopify-health (FEAT-22 M3)
 * El token interno solo se usa si ms-auth confirma que el JWT es válido y de un superadmin.
 */
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const req = (auth?: string) =>
  new Request("http://localhost/api/superadmin/shopify-health", {
    headers: auth ? { Authorization: auth } : {},
  });

describe("GET /api/superadmin/shopify-health", () => {
  let GET: (r: Request) => Promise<Response>;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "http://integrations";
    process.env.NEXT_PUBLIC_API_USERS = "http://auth/api/v1";
    process.env.INTERNAL_SERVICE_TOKEN = "tok";
    ({ GET } = await import("../route"));
  });
  beforeEach(() => jest.resetAllMocks());

  it("sin Authorization → 401 y no llama a nadie", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("token que ms-auth rechaza (firma inválida o vencido) → 401 y no consulta ms-integrations", async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
    const res = await GET(req("Bearer falso"));
    expect(res.status).toBe(401);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get.mock.calls[0][0]).toBe("http://auth/api/v1/auth/user/me");
  });

  it("token válido de alguien que no es superadmin → 403", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { email: "otro@empresa.com" } });
    const res = await GET(req("Bearer real"));
    expect(res.status).toBe(403);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("superadmin → consulta ms-integrations con el token interno", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { email: "OctaToledo7@gmail.com" } })
      .mockResolvedValueOnce({ data: { summary: { ok: 1 } } });
    const res = await GET(req("Bearer real"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: { ok: 1 } });
    expect(mockedAxios.get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer real" } });
    expect(mockedAxios.get.mock.calls[1]).toEqual([
      "http://integrations/shopify/health",
      { headers: { "x-internal-token": "tok" }, timeout: 10000 },
    ]);
  });
});
