import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  addPublicQuotationLine,
  convertQuotation,
  getPublicQuotation,
  getPublicQuotationCatalog,
  getQuotationCatalog,
  listQuotations,
  registerPublicQuotationPayment,
  reconcileQuotationLeadPayment,
  uploadQuotationProof,
  uploadPublicQuotationProof,
} from "../quotationService";
import type { ConvertQuotationInput } from "@/types/quotations";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), isAxiosError: jest.fn() },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
const randomUUID = jest.fn();
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: randomUUID });
});
afterAll(() => {
  if (originalRandomUUID) Object.defineProperty(crypto, "randomUUID", originalRandomUUID);
  else Reflect.deleteProperty(crypto, "randomUUID");
});
beforeEach(() => {
  jest.clearAllMocks();
  randomUUID.mockReset().mockReturnValue("0135c7ce-c3e7-47ac-a604-bf389071e031");
});

const conversionInput: ConvertQuotationInput = {
  address: "Jr. Lima 123",
  district: "Breña",
  salesChannel: "WHATSAPP",
  closingChannel: "LLAMADA",
  deliveryType: "DOMICILIO",
};

it("reconciles the selected quotation advance explicitly with authenticated Finance and no inferred currency or approval", async () => {
  const payment = {
    id: "payment-a",
    leadId: "lead-a",
    currency: "USD",
    status: "PENDING",
    amount: "30.00",
    leadPaymentVersion: 1,
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: payment });
  await expect(
    reconcileQuotationLeadPayment("quote/a", "snapshot/b", { currency: "USD" }),
  ).resolves.toEqual(payment);
  expect(axiosAuth.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/quotations\/quote%2Fa\/payments\/snapshot%2Fb\/reconcile-lead$/),
    { currency: "USD" },
  );
  expect(axios.post).not.toHaveBeenCalled();
  expect(randomUUID).not.toHaveBeenCalled();
});

it("passes an explicit acknowledgement of the approved snapshot without inventing a paid status", async () => {
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
  await reconcileQuotationLeadPayment("quote-a", "snapshot-a", {
    currency: "PEN",
    confirmApproved: true,
  });
  expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/reconcile-lead$/), {
    currency: "PEN",
    confirmApproved: true,
  });
});

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

it("keeps the legacy public catalog array response and request shape when no pagination is requested", async () => {
  const items = [
    { productVariantId: "variant-a", name: "Crema", unitPrice: 20, stockAvailable: 1 },
  ];
  jest.mocked(axios.get).mockResolvedValue({ data: items });
  await expect(getPublicQuotationCatalog("opaque/token")).resolves.toEqual(items);
  expect(axios.get).toHaveBeenCalledWith(
    expect.stringMatching(/\/public\/quotations\/opaque%2Ftoken\/catalog$/),
    { withCredentials: false },
  );
  expect(axiosAuth.get).not.toHaveBeenCalled();
});

it("passes server search, bounded pagination and cancellation through the public capability endpoint", async () => {
  const controller = new AbortController();
  const page = {
    data: [
      {
        productVariantId: "variant-120",
        name: "SKU después de 100",
        unitPrice: 20,
        stockAvailable: 1,
      },
    ],
    page: 2,
    limit: 30,
    hasMore: true,
  };
  jest.mocked(axios.get).mockResolvedValue({ data: page });
  await expect(
    getPublicQuotationCatalog("public-token", {
      search: "SKU-120",
      page: 2,
      limit: 30,
      signal: controller.signal,
    }),
  ).resolves.toEqual(page);
  expect(axios.get).toHaveBeenCalledWith(
    expect.stringMatching(/\/public\/quotations\/public-token\/catalog$/),
    {
      withCredentials: false,
      signal: controller.signal,
      params: { search: "SKU-120", page: 2, limit: 30 },
    },
  );
  expect(axiosAuth.get).not.toHaveBeenCalled();
});

it("omits absent catalog options while retaining an explicitly empty search for a reset", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: [] });
  const controller = new AbortController();
  await getPublicQuotationCatalog("token", { signal: controller.signal });
  expect(axios.get).toHaveBeenLastCalledWith(expect.any(String), {
    withCredentials: false,
    signal: controller.signal,
  });
  await getPublicQuotationCatalog("token", { search: "", page: 1 });
  expect(axios.get).toHaveBeenLastCalledWith(expect.any(String), {
    withCredentials: false,
    params: { search: "", page: 1 },
  });
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

it("adds a conversion command accepted by both legacy and seller confirmation without reading flags", async () => {
  const response = { id: "convert-new", status: "CONVERTIDA", orderId: "order-a" };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: response });

  await expect(convertQuotation("convert-new", conversionInput)).resolves.toBe(response);

  expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/convert-new\/convert$/), {
    ...conversionInput,
    commandId: "0135c7ce-c3e7-47ac-a604-bf389071e031",
  });
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(randomUUID).toHaveBeenCalledTimes(1);
});

it("reuses the command after timeout even when the caller reconstructs the same selection", async () => {
  const timeout = new Error("Respuesta interrumpida");
  jest.mocked(axiosAuth.post).mockRejectedValueOnce(timeout).mockResolvedValueOnce({ data: {} });

  await expect(convertQuotation("convert-retry", conversionInput)).rejects.toBe(timeout);
  await convertQuotation("convert-retry", {
    deliveryType: conversionInput.deliveryType,
    closingChannel: conversionInput.closingChannel,
    salesChannel: conversionInput.salesChannel,
    district: conversionInput.district,
    address: conversionInput.address,
  });

  const bodies = jest.mocked(axiosAuth.post).mock.calls.map((call) => call[1]);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(randomUUID).toHaveBeenCalledTimes(1);
});

it("shares a command for simultaneous requests of the same quotation and selection", async () => {
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { status: "CONVERTIDA" } });

  await Promise.all([
    convertQuotation("convert-concurrent", { ...conversionInput }),
    convertQuotation("convert-concurrent", { ...conversionInput }),
  ]);

  const bodies = jest.mocked(axiosAuth.post).mock.calls.map((call) => call[1]);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(randomUUID).toHaveBeenCalledTimes(1);
});

it("starts another attempt when the commercial selection changes after a failure", async () => {
  randomUUID
    .mockReturnValueOnce("0135c7ce-c3e7-47ac-a604-bf389071e031")
    .mockReturnValueOnce("11b7960c-a8f7-4551-8e90-de2c82d4ec25");
  jest
    .mocked(axiosAuth.post)
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValueOnce({ data: {} });

  await expect(convertQuotation("convert-changed", conversionInput)).rejects.toThrow("Timeout");
  await convertQuotation("convert-changed", { ...conversionInput, address: "Otra dirección" });

  expect(
    jest
      .mocked(axiosAuth.post)
      .mock.calls.map((call) => (call[1] as { commandId: string }).commandId),
  ).toEqual(["0135c7ce-c3e7-47ac-a604-bf389071e031", "11b7960c-a8f7-4551-8e90-de2c82d4ec25"]);
});

it("preserves an explicit caller command and the new lead version on a retry", async () => {
  const input = {
    ...conversionInput,
    commandId: "11b7960c-a8f7-4551-8e90-de2c82d4ec25",
    leadId: "lead-a",
    leadVersion: 2,
  };
  jest
    .mocked(axiosAuth.post)
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({ data: {} });

  await expect(convertQuotation("convert-version", input)).rejects.toEqual({
    response: { status: 409 },
  });
  await convertQuotation("convert-version", { ...input, leadVersion: 3 });

  expect(axiosAuth.post).toHaveBeenLastCalledWith(
    expect.stringMatching(/\/convert-version\/convert$/),
    {
      ...input,
      leadVersion: 3,
    },
  );
  expect(randomUUID).not.toHaveBeenCalled();
});

it("keeps the generated command when a retry adds the associated lead and refreshes its version", async () => {
  jest
    .mocked(axiosAuth.post)
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValueOnce({ data: {} });

  await expect(convertQuotation("convert-auto-associated", conversionInput)).rejects.toThrow(
    "Timeout",
  );
  await convertQuotation("convert-auto-associated", {
    ...conversionInput,
    leadId: "lead-a",
    leadVersion: 4,
  });

  const bodies = jest.mocked(axiosAuth.post).mock.calls.map((call) => call[1]) as Array<
    Record<string, unknown>
  >;
  expect(bodies[0].commandId).toBe(bodies[1].commandId);
  expect(bodies[1]).toMatchObject({ leadId: "lead-a", leadVersion: 4 });
  expect(randomUUID).toHaveBeenCalledTimes(1);
});

it("does not share conversion commands across different quotations", async () => {
  randomUUID
    .mockReturnValueOnce("0135c7ce-c3e7-47ac-a604-bf389071e031")
    .mockReturnValueOnce("11b7960c-a8f7-4551-8e90-de2c82d4ec25");
  jest
    .mocked(axiosAuth.post)
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValueOnce({ data: {} });

  await expect(convertQuotation("convert-quote-a", conversionInput)).rejects.toThrow("Timeout");
  await convertQuotation("convert-quote-b", conversionInput);

  expect(
    jest
      .mocked(axiosAuth.post)
      .mock.calls.map((call) => (call[1] as { commandId: string }).commandId),
  ).toEqual(["0135c7ce-c3e7-47ac-a604-bf389071e031", "11b7960c-a8f7-4551-8e90-de2c82d4ec25"]);
});

it("ends the pending attempt on success while the server remains responsible for conversion replay", async () => {
  randomUUID
    .mockReturnValueOnce("0135c7ce-c3e7-47ac-a604-bf389071e031")
    .mockReturnValueOnce("11b7960c-a8f7-4551-8e90-de2c82d4ec25");
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { status: "CONVERTIDA" } });

  await convertQuotation("convert-success", conversionInput);
  await convertQuotation("convert-success", conversionInput);

  expect(randomUUID).toHaveBeenCalledTimes(2);
});
