import { liveEntryContext, rememberCreatorLive } from "../liveService";

// FEAT-33 A12/D2: el link de asesora (…/live?a=CÓDIGO) es POWIP Link a precio normal; sin código es el live.
const at = (path: string) => window.history.pushState({}, "", path);
afterEach(() => at("/"));

test.each([
  ["/live/kunca", { channel: "LIVE", advisorCode: undefined, sellerCode: undefined }],
  ["/live/kunca?a=ana-111111", { channel: "WHATSAPP", advisorCode: "ana-111111", sellerCode: undefined }],
  ["/live/kunca?v=ana-111111", { channel: "LIVE", advisorCode: undefined, sellerCode: "ana-111111" }],
  ["/catalogo/kunca", { channel: "WHATSAPP", advisorCode: undefined, sellerCode: undefined }],
  ["/catalogo/kunca?a=ana-111111", { channel: "WHATSAPP", advisorCode: "ana-111111", sellerCode: undefined }],
])("%s", (path, expected) => {
  at(path);
  expect(liveEntryContext()).toEqual(expected);
});

// FEAT-33 C5: si el último catálogo dice que la creadora del link está en vivo, se compra como Live (precio live).
describe("creator live", () => {
  afterEach(() => rememberCreatorLive(false));
  test("her link buys as Live while she is on air and goes back to POWIP Link when she ends", () => {
    at("/live/kunca?a=rei-1a2b");
    rememberCreatorLive(true);
    expect(liveEntryContext()).toEqual({ channel: "LIVE", advisorCode: "rei-1a2b", sellerCode: undefined });
    rememberCreatorLive(false);
    expect(liveEntryContext().channel).toBe("WHATSAPP");
  });
  test("without a link code nothing changes", () => {
    at("/catalogo/kunca");
    rememberCreatorLive(true);
    expect(liveEntryContext().channel).toBe("WHATSAPP");
  });
});
