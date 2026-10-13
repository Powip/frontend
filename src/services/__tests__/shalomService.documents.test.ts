jest.mock("axios", () => ({ get: jest.fn() }));

import axios from "axios";
import {
  generateShalomLabelPdf,
  generateShalomTicketPdf,
  getShalomLabelPdfUrl,
  getShalomTicketPdfUrl,
} from "../shalomService";

const companyId = "985c1265-5c19-43de-a578-cc0dd29f8ef7";

beforeEach(() => jest.clearAllMocks());

it.each([
  ["ticket-pdf", generateShalomTicketPdf],
  ["label", generateShalomLabelPdf],
] as const)("requests %s in the current company scope", async (path, generate) => {
  const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
  (axios.get as jest.Mock).mockResolvedValue({ data: blob });

  const result = await generate("token", "12345678", "AB12", companyId);

  expect(result === blob).toBe(true);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`/shalom/${path}/12345678/AB12`), {
    headers: { Authorization: "Bearer token" },
    params: { companyId },
    responseType: "blob",
  });
});

it.each([
  ["ticket-pdf", getShalomTicketPdfUrl],
  ["label", getShalomLabelPdfUrl],
] as const)("includes companyId in a direct %s document URL", (path, getUrl) => {
  const url = new URL(getUrl("12345678", "AB12", companyId));

  expect(url.pathname).toBe(`/shalom/${path}/12345678/AB12`);
  expect(url.searchParams.get("companyId")).toBe(companyId);
});
