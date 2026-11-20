// FEAT-24 SEC (sec6a): ms-integrations cierra /shalom/* a la sesión. Todo `shalomService` va con axiosAuth (que
// agrega y renueva el Bearer) y los PDF se piden como blob: no hay enlaces directos a los documentos.
const mockAuthGet = jest.fn();
const mockAuthPost = jest.fn();
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockAuthGet(...args),
    post: (...args: unknown[]) => mockAuthPost(...args),
  },
}));
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));

import axios from "axios";
import * as shalomService from "../shalomService";
import {
  generateShalomLabelPdf,
  generateShalomTicketPdf,
  getShalomConfig,
  getShalomStatus,
  trackShalomMassive,
  trackShalomShipment,
} from "../shalomService";

const companyId = "985c1265-5c19-43de-a578-cc0dd29f8ef7";

beforeEach(() => jest.clearAllMocks());

it.each([
  ["ticket-pdf", generateShalomTicketPdf],
  ["label", generateShalomLabelPdf],
] as const)("requests %s as a blob with the session (axiosAuth)", async (path, generate) => {
  const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
  mockAuthGet.mockResolvedValue({ data: blob });

  const result = await generate("token", "12345678", "AB12", companyId);

  expect(result === blob).toBe(true);
  expect(mockAuthGet).toHaveBeenCalledWith(expect.stringContaining(`/shalom/${path}/12345678/AB12`), {
    headers: { Authorization: "Bearer token" },
    params: { companyId },
    responseType: "blob",
  });
  expect(axios.get).not.toHaveBeenCalled();
});

it("no longer exports direct (header-less) document URLs", () => {
  const exported = Object.keys(shalomService);
  expect(exported).not.toContain("getShalomTicketPdfUrl");
  expect(exported).not.toContain("getShalomLabelPdfUrl");
});

it("calls the closed /shalom/* routes through axiosAuth, never plain axios", async () => {
  mockAuthGet.mockResolvedValue({ data: {} });
  mockAuthPost.mockResolvedValue({ data: [] });

  await getShalomConfig("token", companyId);
  await getShalomStatus("token", companyId);
  await trackShalomShipment("token", companyId, "12345678", "AB12");
  await trackShalomMassive("token", [{ orderNumber: "12345678", orderCode: "AB12" }]);

  const urls = [...mockAuthGet.mock.calls, ...mockAuthPost.mock.calls].map(([url]) => String(url));
  expect(urls).toEqual([
    expect.stringMatching(new RegExp(`/shalom/config/${companyId}$`)),
    expect.stringMatching(new RegExp(`/shalom/status/${companyId}$`)),
    expect.stringMatching(/\/shalom\/track$/),
    expect.stringMatching(/\/shalom\/track-massive$/),
  ]);
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

it("without a token argument it lets axiosAuth put the session token (no empty Bearer)", async () => {
  mockAuthGet.mockResolvedValue({ data: { isLoggedIn: true } });

  await getShalomStatus("", companyId);

  expect(mockAuthGet).toHaveBeenCalledWith(expect.stringContaining(`/shalom/status/${companyId}`), { headers: {} });
});

it("trackShalomShipment manda refresh:true solo cuando se pide y conserva syncedAt/fromCache", async () => {
  mockAuthPost.mockResolvedValue({ data: { syncedAt: "2026-11-19T20:00:00.000Z", fromCache: false } });

  const normal = await trackShalomShipment("token", companyId, "12345678", "AB12");
  expect(mockAuthPost.mock.calls[0][1]).toEqual({ companyId, orderNumber: "12345678", orderCode: "AB12" });
  expect(normal.syncedAt).toBe("2026-11-19T20:00:00.000Z");

  await trackShalomShipment("token", companyId, "12345678", "AB12", { refresh: true });
  expect(mockAuthPost.mock.calls[1][1]).toEqual({
    companyId,
    orderNumber: "12345678",
    orderCode: "AB12",
    refresh: true,
  });
});
