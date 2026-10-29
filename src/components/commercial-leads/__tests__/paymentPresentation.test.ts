import {
  paymentGroups,
  paymentMoney,
  safePaymentProof,
  validPaymentCurrency,
  validatePaymentProof,
} from "../paymentPresentation";
import type { LeadPayment } from "@/types/leadPayments";

it("groups every payment once by its own currency and approval state", () => {
  const payments = [
    { amount: "10.25", currency: "USD", status: "PAID" },
    { amount: 4, currency: "USD", status: "PENDING" },
    { amount: "30.10", currency: "PEN", status: "PAID" },
    { amount: "5.00", currency: "PEN", status: "LOST" },
    { amount: 7, currency: null, status: "PENDING" },
    { amount: "invalid", currency: "USD", status: "PAID" },
  ] as LeadPayment[];
  expect(paymentGroups(payments)).toEqual([
    { currency: "USD", paid: 10.25, pending: 4, lost: 0 },
    { currency: "PEN", paid: 30.1, pending: 0, lost: 5 },
    { currency: null, paid: 0, pending: 7, lost: 0 },
  ]);
  expect(paymentMoney("10.25", "USD")).toBe("USD 10.25");
  expect(paymentMoney(7, null)).toBe("Moneda no informada 7.00");
  expect(paymentMoney("invalid", "PEN")).toBe("Importe no disponible");
});

it("accepts explicit PEN and USD safely in browsers without the currency enumeration API", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "supportedValuesOf");
  try {
    Object.defineProperty(Intl, "supportedValuesOf", {
      configurable: true,
      value: undefined,
    });
    expect(validPaymentCurrency("PEN")).toBe(true);
    expect(validPaymentCurrency("USD")).toBe(true);
    expect(validPaymentCurrency("")).toBe(false);
    expect(validPaymentCurrency("usd")).toBe(false);
    expect(validPaymentCurrency("PEN ")).toBe(false);
  } finally {
    if (descriptor)
      Object.defineProperty(Intl, "supportedValuesOf", descriptor);
    else Reflect.deleteProperty(Intl, "supportedValuesOf");
  }
});

it("allows only absolute web proof links and limits uploads by MIME type and actual size", () => {
  expect(safePaymentProof("https://proof.example/voucher.pdf")).toBe(
    "https://proof.example/voucher.pdf",
  );
  for (const input of [
    "javascript:alert(1)",
    "data:application/pdf,proof",
    "/private-proof",
    "invalid",
  ]) {
    expect(safePaymentProof(input)).toBeNull();
  }
  expect(
    validatePaymentProof(
      new File(["ok"], "voucher.pdf", { type: "application/pdf" }),
    ),
  ).toBeNull();
  expect(
    validatePaymentProof(
      new File(["bad"], "voucher.svg", { type: "image/svg+xml" }),
    ),
  ).toMatch(/JPG, PNG, WEBP o PDF/);
  const oversized = new File(
    [new Uint8Array(5 * 1024 * 1024 + 1)],
    "large.png",
    { type: "image/png" },
  );
  expect(validatePaymentProof(oversized)).toMatch(/5 MB/);
});
