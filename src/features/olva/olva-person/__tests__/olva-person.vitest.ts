import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";
import { buildOlvaPersonResponse } from "../test-utils/olva-person.fixtures";

const get = vi.hoisted(() => vi.fn());
const getOlvaPerson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { get } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import { useOlvaPerson } from "../hooks/use-olva-person";
import { olvaPersonLookupSchema } from "../schemas/olva-person-lookup.schema";
import * as service from "../services/olva-person.service";
import { isValidOlvaDocumentNumber } from "../utils/is-valid-olva-document-number";

describe("olva-person", () => {
  beforeEach(() => {
    get.mockReset();
    getOlvaPerson.mockReset();
  });

  it("validates the number by document type", () => {
    expect(isValidOlvaDocumentNumber("dni", "12345678")).toBe(true);
    expect(isValidOlvaDocumentNumber("dni", "1234567")).toBe(false);
    expect(isValidOlvaDocumentNumber("dni", "1234567a")).toBe(false);
    expect(isValidOlvaDocumentNumber("ruc", "20123456789")).toBe(true);
    expect(isValidOlvaDocumentNumber("ruc", "12345678")).toBe(false);
  });

  it("schema reports one message per problem", () => {
    const empty = olvaPersonLookupSchema.safeParse({ documentType: "dni", documentNumber: "" });
    const short = olvaPersonLookupSchema.safeParse({ documentType: "ruc", documentNumber: "123" });
    const ok = olvaPersonLookupSchema.safeParse({
      documentType: "dni",
      documentNumber: " 12345678 ",
    });

    expect(empty.error?.issues).toHaveLength(1);
    expect(short.error?.issues[0].message).toBe("El RUC debe tener 11 dígitos");
    expect(ok.data?.documentNumber).toBe("12345678");
  });

  it("service encodes the path and sends the role", async () => {
    get.mockResolvedValue({ data: buildOlvaPersonResponse() });

    const person = await service.getOlvaPerson({
      documentType: "dni",
      documentNumber: "12345678",
      role: "recipient",
    });

    expect(get).toHaveBeenCalledWith("http://api.test/olva/person/dni/12345678", {
      params: { role: "recipient" },
    });
    expect(person.fullName).toBe("PEREZ GOMEZ JUAN");
  });

  it("hook stays idle for an invalid number and runs for a valid one", async () => {
    get.mockResolvedValue({ data: buildOlvaPersonResponse() });
    const { wrapper } = createQueryClientWrapper();

    const invalid = renderHook(
      () => useOlvaPerson({ documentType: "dni", documentNumber: "123" }),
      { wrapper },
    );
    expect(invalid.result.current.fetchStatus).toBe("idle");
    expect(get).not.toHaveBeenCalled();

    const valid = renderHook(
      () => useOlvaPerson({ documentType: "dni", documentNumber: "12345678" }),
      { wrapper },
    );
    await waitFor(() => expect(valid.result.current.data?.existsInOlva).toBe(true));
  });
});
