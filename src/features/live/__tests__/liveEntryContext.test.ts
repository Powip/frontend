import { liveEntryContext } from "../liveService";

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
