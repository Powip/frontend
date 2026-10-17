import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  addPublicQuotationLine,
  getPublicQuotation,
  getQuotationCatalog,
  listQuotations,
  registerPublicQuotationPayment,
  uploadQuotationProof,
  uploadPublicQuotationProof,
} from "../quotationService";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), isAxiosError: jest.fn() },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

it("scopes seller lists and catalog requests to the selected store", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
  await listQuotations({ storeId: "store-a", status: "PREVENTA", page: 2 });
  await getQuotationCatalog({ storeId: "store-a", search: "crema" });
  expect(axiosAuth.get).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/quotations$/), {
    params: { storeId: "store-a", status: "PREVENTA", page: 2 },
  });
  expect(axiosAuth.get).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/\/quotations\/catalog$/),
    {
      params: { storeId: "store-a", search: "crema" },
    },
  );
});

it("uses the public bearer-link API without seller session credentials", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { number: "COT-0001" } });
  await expect(getPublicQuotation("opaque/token")).resolves.toEqual({ number: "COT-0001" });
  expect(axios.get).toHaveBeenCalledWith(
    expect.stringMatching(/\/public\/quotations\/opaque%2Ftoken$/),
    { withCredentials: false },
  );
  expect(axiosAuth.get).not.toHaveBeenCalled();
});

it("lets the server select public product prices", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  await addPublicQuotationLine("public-token", "variant-a", 2);
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/public-token\/lines$/),
    {
      productVariantId: "variant-a",
      quantity: 2,
    },
    { withCredentials: false },
  );
});

it("reports payments without declaring them approved", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  await registerPublicQuotationPayment("public-token", { amount: 25, method: "YAPE_QR" });
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/public-token\/payments$/),
    {
      amount: 25,
      method: "YAPE_QR",
    },
    { withCredentials: false },
  );
});

it("rejects invalid proof files before uploading", async () => {
  const file = new File(["<html>"], "proof.html", { type: "text/html" });
  await expect(uploadQuotationProof("quote-a", file)).rejects.toThrow(/JPG, PNG, WebP o PDF/);
  const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "proof.pdf", {
    type: "application/pdf",
  });
  await expect(uploadPublicQuotationProof("token", oversized)).rejects.toThrow(/5 MB/);
  expect(axiosAuth.post).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

it("uploads the proof on the quotation-scoped endpoint", async () => {
  jest
    .mocked(axiosAuth.post)
    .mockResolvedValue({ data: { url: "https://files.example/proof.pdf" } });
  const file = new File(["proof"], "proof.pdf", { type: "application/pdf" });
  await expect(uploadQuotationProof("quote-a", file)).resolves.toBe(
    "https://files.example/proof.pdf",
  );
  expect(axiosAuth.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/quote-a\/payments\/proof$/),
    expect.any(FormData),
  );
  const form = jest.mocked(axiosAuth.post).mock.calls[0][1] as FormData;
  expect(form.get("file")).toBe(file);
});
