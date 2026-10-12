import { AxiosError } from "axios";
import type {
  ProgramPreferencesCommand,
  ProgramPreferencesResponse,
} from "../../models/program-preferences";
import {
  type ProgramPreferencesWriteRequest,
  programPreferencesClient,
  requestProgramPreferences,
  requestUpdateProgramPreferences,
} from "../program-preferences.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));

afterEach(() => jest.restoreAllMocks());

const command: ProgramPreferencesCommand = {
  optionCode: "B",
  discountPct: "5.00",
  expectedVersion: 4,
  reason: "Protected reason",
};

function response(): ProgramPreferencesResponse {
  return {
    settings: {
      optionCode: "B",
      discountPct: "5",
      version: 5,
      updatedAt: "2026-10-11T10:00:00Z",
    },
    effectiveTerms: {
      status: "NOT_CONFIGURED",
      policyVersion: null,
      firstPaymentRate: null,
      recurringPaymentRate: null,
    },
    catalog: {
      source: "POWIP_PARTNERS_PROGRAM_SPEC",
      version: "2.0",
      date: "2026-08-17",
      options: [
        { code: "A", firstPaymentPct: "40", recurringPaymentPct: "6" },
        { code: "B", firstPaymentPct: "70", recurringPaymentPct: "3" },
        { code: "C", firstPaymentPct: "50", recurringPaymentPct: "8" },
      ],
    },
  };
}

function writeRequest(
  overrides: Partial<ProgramPreferencesWriteRequest> = {},
): ProgramPreferencesWriteRequest {
  return {
    accessToken: "captured-A",
    idempotencyKey: "stable-key-123",
    command,
    ...overrides,
  };
}

it("reads the actual endpoint using only the captured bearer and abort signal", async () => {
  const actual = response();
  const get = jest.spyOn(programPreferencesClient, "get").mockResolvedValue({ data: actual });
  const signal = new AbortController().signal;
  expect(await requestProgramPreferences({ accessToken: "captured-A", signal })).toEqual(actual);
  expect(get).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/me/program-preferences",
    {
      headers: { Authorization: "Bearer captured-A" },
      signal,
    },
  );
});

it("keeps absent settings and arbitrary historical decimals without a selector default", async () => {
  const actual = response();
  const get = jest
    .spyOn(programPreferencesClient, "get")
    .mockResolvedValue({ data: { ...actual, settings: null } });
  expect((await requestProgramPreferences({ accessToken: "A" })).settings).toBeNull();
  get.mockResolvedValueOnce({
    data: { ...actual, settings: { ...actual.settings, discountPct: "2.7500000000" } },
  });
  expect((await requestProgramPreferences({ accessToken: "A" })).settings?.discountPct).toBe(
    "2.7500000000",
  );
});

it("writes exact decimals, trimmed reason, expected version, captured bearer, stable key and abort signal", async () => {
  const actual = response();
  const post = jest.spyOn(programPreferencesClient, "post").mockResolvedValue({ data: actual });
  const signal = new AbortController().signal;
  expect(
    await requestUpdateProgramPreferences(
      writeRequest({ command: { ...command, reason: " Protected reason " }, signal }),
    ),
  ).toEqual(actual);
  expect(post).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/me/program-preferences",
    command,
    {
      headers: { Authorization: "Bearer captured-A", "Idempotency-Key": "stable-key-123" },
      signal,
    },
  );
});

it("confirms initial version zero only for an explicit null expected version", async () => {
  const actual = response();
  const post = jest
    .spyOn(programPreferencesClient, "post")
    .mockResolvedValue({ data: { ...actual, settings: { ...actual.settings, version: 0 } } });
  expect(
    (
      await requestUpdateProgramPreferences(
        writeRequest({ command: { ...command, expectedVersion: null } }),
      )
    ).settings?.version,
  ).toBe(0);
  post.mockResolvedValueOnce({ data: { ...actual, settings: { ...actual.settings, version: 1 } } });
  await expect(
    requestUpdateProgramPreferences(
      writeRequest({ command: { ...command, expectedVersion: null } }),
    ),
  ).rejects.toThrow();
});

it.each([
  ["0.0000000000", "0"],
  ["2.7500000000", "2.75"],
  ["9.9999999999", "9.9999999999"],
  ["10.0000000000", "10"],
])(
  "matches exact decimal value without converting %s or overwriting the returned %s",
  async (requested, returned) => {
    const actual = response();
    const post = jest.spyOn(programPreferencesClient, "post").mockResolvedValue({
      data: { ...actual, settings: { ...actual.settings, discountPct: returned } },
    });
    expect(
      (
        await requestUpdateProgramPreferences(
          writeRequest({ command: { ...command, discountPct: requested } }),
        )
      ).settings?.discountPct,
    ).toBe(returned);
    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      { ...command, discountPct: requested },
      expect.any(Object),
    );
  },
);

it("allows replay of a proposal that advances MAX_SAFE_INTEGER - 1 to the terminal read version", async () => {
  const actual = response();
  jest.spyOn(programPreferencesClient, "post").mockResolvedValue({
    data: { ...actual, settings: { ...actual.settings, version: Number.MAX_SAFE_INTEGER } },
  });
  expect(
    (
      await requestUpdateProgramPreferences(
        writeRequest({ command: { ...command, expectedVersion: Number.MAX_SAFE_INTEGER - 1 } }),
      )
    ).settings?.version,
  ).toBe(Number.MAX_SAFE_INTEGER);
});

it.each([
  { optionCode: "D" },
  { discountPct: 5 },
  { discountPct: "10.0000000001" },
  { expectedVersion: undefined },
  { expectedVersion: -1 },
  { expectedVersion: Number.MAX_SAFE_INTEGER },
  { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
  { reason: " " },
  { reason: "line\nbreak" },
  { reason: "a".repeat(1001) },
  { partnerId: "client-selected-owner" },
])("rejects malformed, expanded or terminal proposals before dispatch %#", async (override) => {
  const post = jest.spyOn(programPreferencesClient, "post");
  await expect(
    requestUpdateProgramPreferences(
      writeRequest({ command: { ...command, ...override } as ProgramPreferencesCommand }),
    ),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each(["", "short", " stable-key-123", "key/unsafe", "a".repeat(201)])(
  "rejects an unsafe idempotency key before dispatch %#",
  async (idempotencyKey) => {
    const post = jest.spyOn(programPreferencesClient, "post");
    await expect(
      requestUpdateProgramPreferences(writeRequest({ idempotencyKey })),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  },
);

it.each(["", " ", " captured-A", "captured-A "])(
  "rejects an absent or expanded bearer before either dispatch %#",
  async (accessToken) => {
    const get = jest.spyOn(programPreferencesClient, "get");
    const post = jest.spyOn(programPreferencesClient, "post");
    await expect(requestProgramPreferences({ accessToken })).rejects.toThrow();
    await expect(requestUpdateProgramPreferences(writeRequest({ accessToken }))).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  },
);

it.each([
  { optionCode: "A" },
  { discountPct: "5.0000000001" },
  { discountPct: 5 },
  { version: 4 },
  { version: 6 },
  { version: "5" },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { updatedAt: "2026-02-30T10:00:00Z" },
  { reason: "private" },
])("does not acknowledge malformed or mismatched saved settings %#", async (override) => {
  const actual = response();
  jest
    .spyOn(programPreferencesClient, "post")
    .mockResolvedValue({ data: { ...actual, settings: { ...actual.settings, ...override } } });
  await expect(requestUpdateProgramPreferences(writeRequest())).rejects.toThrow();
});

it("does not acknowledge null saved settings or invented financial terms", async () => {
  const actual = response();
  const post = jest
    .spyOn(programPreferencesClient, "post")
    .mockResolvedValue({ data: { ...actual, settings: null } });
  await expect(requestUpdateProgramPreferences(writeRequest())).rejects.toThrow();
  post.mockResolvedValueOnce({
    data: { ...actual, effectiveTerms: { ...actual.effectiveTerms, firstPaymentRate: "0.7" } },
  });
  await expect(requestUpdateProgramPreferences(writeRequest())).rejects.toThrow();
});

it("rejects an altered catalog or expanded read response without a success fallback", async () => {
  const actual = response();
  const get = jest
    .spyOn(programPreferencesClient, "get")
    .mockResolvedValue({ data: { ...actual, catalog: { ...actual.catalog, version: "3.0" } } });
  await expect(requestProgramPreferences({ accessToken: "A" })).rejects.toThrow();
  get.mockResolvedValueOnce({ data: { ...actual, mrr: "0" } });
  await expect(requestProgramPreferences({ accessToken: "A" })).rejects.toThrow();
});

it.each([401, 403, 409, 503])(
  "preserves authoritative HTTP %i failures without fallback",
  async (status) => {
    const error = new AxiosError("Service rejected", undefined, undefined, undefined, {
      status,
      data: { code: "TEST_ONLY" },
      statusText: "error",
      headers: {},
      config: {} as never,
    });
    jest.spyOn(programPreferencesClient, "get").mockRejectedValue(error);
    jest.spyOn(programPreferencesClient, "post").mockRejectedValue(error);
    await expect(requestProgramPreferences({ accessToken: "A" })).rejects.toBe(error);
    await expect(requestUpdateProgramPreferences(writeRequest())).rejects.toBe(error);
  },
);

it("preserves aborted requests and unknown transport outcomes for the owning hook", async () => {
  const error = new AxiosError("Request canceled", "ERR_CANCELED");
  jest.spyOn(programPreferencesClient, "get").mockRejectedValue(error);
  jest.spyOn(programPreferencesClient, "post").mockRejectedValue(error);
  await expect(requestProgramPreferences({ accessToken: "A" })).rejects.toBe(error);
  await expect(requestUpdateProgramPreferences(writeRequest())).rejects.toBe(error);
});
